// Klinika címek frissítése Google Places API-ból
// A google_place_id alapján visszanyeri a postal_code, street, district mezőket.
//
// Használat:
//   curl -X POST https://<project>.supabase.co/functions/v1/refresh-clinic-addresses \
//     -H "Authorization: Bearer <service_role_key>"
//   Opcionális: -d '{"limit":50}' a batchezéshez (default 100)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

interface PlaceDetails {
  id: string;
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
}

// Budapesti zip → kerület (mint az SQL-ben)
function bpDistrictFromZip(zip: string): string | null {
  if (!zip || !/^1\d{3}$/.test(zip)) return null;
  const n = parseInt(zip.substring(1, 3), 10);
  if (n < 1 || n > 23) return null;
  const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI','XXII','XXIII'];
  return roman[n - 1];
}

// addressComponents → {postal_code, street, district}
function parseComponents(comps: AddressComponent[] | undefined, formattedAddress: string | undefined): {
  postal_code: string | null;
  street: string | null;
  district: string | null;
} {
  if (!comps) return { postal_code: null, street: null, district: null };

  let postal_code: string | null = null;
  let route: string | null = null;
  let street_number: string | null = null;
  let district: string | null = null;

  for (const c of comps) {
    if (c.types.includes('postal_code')) postal_code = c.longText;
    else if (c.types.includes('route')) route = c.longText;
    else if (c.types.includes('street_number')) street_number = c.longText;
    else if (c.types.includes('sublocality_level_1')) {
      // Budapesti kerület pl. "II. kerület", "XII. kerület"
      const m = c.longText.match(/^([IVX]+)\.\s*kerület/i);
      if (m) district = m[1].toUpperCase();
    }
  }

  // Fallback: budapesti zip-ből számoljuk a kerületet, ha nem volt benne
  if (!district && postal_code) {
    district = bpDistrictFromZip(postal_code);
  }

  // Street = route + házszám
  let street: string | null = null;
  if (route && street_number) street = `${route} ${street_number}`;
  else if (route) street = route;

  return { postal_code, street, district };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  if (!GOOGLE_KEY) {
    return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY missing' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(body.limit || 100, 500);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Lekérjük a klinikákat, amiknek van place_id-juk és nincs még street-jük (vagy hibás)
  const { data: clinics, error } = await db
    .from('clinics')
    .select('id, google_place_id, street, district, postal_code')
    .not('google_place_id', 'is', null)
    .or('street.is.null,street.like.%kerület%') // null vagy a rontott "XII. kerület" maradványok
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  if (!clinics || clinics.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, message: 'Nincs feldolgozandó klinika' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const c of clinics) {
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(c.google_place_id)}?languageCode=hu&regionCode=HU`,
        {
          headers: {
            'X-Goog-Api-Key': GOOGLE_KEY,
            'X-Goog-FieldMask': 'id,formattedAddress,addressComponents'
          }
        }
      );

      if (!res.ok) {
        failed++;
        errors.push(`${c.id}: HTTP ${res.status}`);
        continue;
      }

      const place: PlaceDetails = await res.json();
      const parsed = parseComponents(place.addressComponents, place.formattedAddress);

      // Frissítés (csak ha van valamilyen érdemi adat)
      if (parsed.postal_code || parsed.street) {
        const update: Record<string, unknown> = {};
        if (parsed.postal_code) update.postal_code = parsed.postal_code;
        if (parsed.street) update.street = parsed.street;
        if (parsed.district) update.district = parsed.district;

        const { error: upErr } = await db.from('clinics').update(update).eq('id', c.id);
        if (upErr) {
          failed++;
          errors.push(`${c.id}: ${upErr.message}`);
        } else {
          success++;
        }
      } else {
        failed++;
        errors.push(`${c.id}: nincs használható adat`);
      }

      // Google Places API rate limit: ~60-100 req/sec biztonságos
      await new Promise(r => setTimeout(r, 20));

    } catch (e) {
      failed++;
      errors.push(`${c.id}: ${(e as Error).message}`);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    processed: clinics.length,
    success,
    failed,
    errors: errors.slice(0, 20)
  }), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
});
