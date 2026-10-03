// Google Places review-k lekérdezése egy klinikára runtime-ban
// A Google ToS megtiltja a tárolást — ezért minden kattintáskor friss adatot kérünk
// v2 (audit, 2026-10-03): rate limit + bemenet-ellenőrzés + napi kvótaplafon
//
// Használat:
//   GET /functions/v1/clinic-google-reviews?place_id=ChIJ...
//   GET /functions/v1/clinic-google-reviews?clinic_id=<uuid>

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DAILY_CAP = 2000; // napi max. Google Places hívás (kvótaplafon)

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'public, max-age=3600', // 1 óra browser cache
};

const FIELD_MASK = [
  'id', 'displayName', 'rating', 'userRatingCount',
  'reviews', 'googleMapsUri', 'reviewSummary',
].join(',');

async function sha(t: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const url = new URL(req.url);
    let placeId = url.searchParams.get('place_id');
    const clinicId = url.searchParams.get('clinic_id');

    // — Bemenet-ellenőrzés (audit, 2026-10-03) —
    if (placeId && !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) placeId = null;
    const clinicOk = clinicId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clinicId);

    if (!placeId && !clinicOk) {
      return new Response(JSON.stringify({ reviews: [], error: 'No place_id' }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // — Rate limit: 10/perc/IP + napi plafon (audit, 2026-10-03) —
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'anon';
    const ipKey = (await sha('gr|' + ip)).slice(0, 24);
    const { data: okMin } = await db.rpc('v2_rate_hit', { p_key: 'gr:' + ipKey, p_window_sec: 60, p_max: 10 });
    if (okMin === false) {
      return new Response(JSON.stringify({ reviews: [], error: 'rate_limited' }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const day = new Date().toISOString().slice(0, 10);
    const { data: okDay } = await db.rpc('v2_rate_hit', { p_key: 'grday:' + day, p_window_sec: 86400, p_max: DAILY_CAP });
    if (okDay === false) {
      return new Response(JSON.stringify({ reviews: [], error: 'daily_cap' }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (!placeId && clinicOk) {
      const { data } = await db
        .from('clinics')
        .select('google_place_id')
        .eq('id', clinicId)
        .single();
      placeId = data?.google_place_id || null;
    }

    if (!placeId) {
      return new Response(JSON.stringify({ reviews: [], error: 'No place_id' }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Google Places Details kérés
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=hu`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Google ${res.status}:`, errText);
      return new Response(JSON.stringify({ reviews: [], error: `Google API hiba: ${res.status}` }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const data: any = await res.json();
    const reviews = (data.reviews || []).map((r: any) => ({
      author_name: r.authorAttribution?.displayName || 'Névtelen',
      author_photo: r.authorAttribution?.photoUri || null,
      rating: r.rating || 0,
      text: r.text?.text || r.originalText?.text || '',
      relative_time: r.relativePublishTimeDescription || '',
      publish_time: r.publishTime || null,
    }));

    return new Response(JSON.stringify({
      rating: data.rating || null,
      review_count: data.userRatingCount || 0,
      reviews,
      google_maps_uri: data.googleMapsUri || null,
      review_summary: data.reviewSummary?.text?.text || null,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Hiba:', e);
    return new Response(JSON.stringify({ reviews: [], error: String(e) }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
