// Google Places (New) API → magyar magánklinikák import a Supabase clinics táblába
// 
// Használat (curl):
//   curl -X POST https://<project>.supabase.co/functions/v1/google-clinics-import \
//     -H "Authorization: Bearer <service_role_key>" \
//     -H "Content-Type: application/json" \
//     -d '{"queries":["magánklinika Budapest","magánrendelő Szeged"],"max_per_query":20}'
//
// Vagy az alapértelmezett 10 magyar várost futtatja, ha üres a body
//
// Env változók (Supabase Dashboard → Edge Functions → Secrets):
//   GOOGLE_PLACES_API_KEY — a Google Cloud API kulcs

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Alapértelmezett magyar városok és lekérdezések
const DEFAULT_QUERIES = [
  'magánklinika Budapest', 'magánrendelő Budapest', 'szakrendelő Budapest',
  'magánklinika Debrecen', 'magánrendelő Debrecen',
  'magánklinika Szeged', 'magánrendelő Szeged',
  'magánklinika Pécs', 'magánrendelő Pécs',
  'magánklinika Miskolc', 'magánrendelő Miskolc',
  'magánklinika Győr', 'magánrendelő Győr',
  'magánklinika Székesfehérvár',
  'magánklinika Veszprém',
  'magánklinika Kecskemét',
  'magánklinika Nyíregyháza',
  'magánklinika Szombathely',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PlaceSearchResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  primaryType?: string;
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
  attributions?: string[];
}

interface SearchResponse {
  places?: PlaceSearchResult[];
  nextPageToken?: string;
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.primaryType',
  'places.photos',
].join(',');

async function searchPlaces(query: string, maxResults: number): Promise<PlaceSearchResult[]> {
  const all: PlaceSearchResult[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  while (all.length < maxResults && pages < 3) {
    const body: any = {
      textQuery: query,
      languageCode: 'hu',
      regionCode: 'HU',
      maxResultCount: Math.min(20, maxResults - all.length),
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': FIELD_MASK + ',nextPageToken',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`Google API hiba: ${res.status}`, await res.text());
      break;
    }

    const data: SearchResponse = await res.json();
    if (data.places) all.push(...data.places);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    pages++;
    // Google ToS: várj 2s a következő page-tokenre
    await new Promise(r => setTimeout(r, 2000));
  }

  return all;
}

// Egyetlen fotó letöltése és feltöltése Supabase Storage-be
async function downloadAndStorePhoto(
  supabase: any,
  photoName: string,
  clinicSlug: string,
  index: number,
): Promise<string | null> {
  try {
    // Get the actual photo URL (returns redirect)
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_KEY}&maxWidthPx=1200`;
    const photoRes = await fetch(photoUrl);
    if (!photoRes.ok) return null;

    const blob = await photoRes.arrayBuffer();
    const ext = photoRes.headers.get('content-type')?.includes('png') ? 'png' : 'jpg';
    const path = `${clinicSlug}/photo-${index}.${ext}`;

    const { error } = await supabase.storage
      .from('clinic-photos')
      .upload(path, blob, {
        contentType: photoRes.headers.get('content-type') || 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('Storage upload hiba:', error);
      return null;
    }

    const { data: publicUrl } = supabase.storage.from('clinic-photos').getPublicUrl(path);
    return publicUrl.publicUrl;
  } catch (e) {
    console.error('Fotó letöltési hiba:', e);
    return null;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function isHealthcareType(primaryType?: string): boolean {
  if (!primaryType) return true; // adjunk neki esélyt
  const healthTypes = [
    'doctor', 'hospital', 'medical_lab', 'dentist', 'pharmacy',
    'physiotherapist', 'health', 'clinic', 'wellness_center',
  ];
  return healthTypes.some(t => primaryType.toLowerCase().includes(t));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const queries: string[] = body.queries?.length ? body.queries : DEFAULT_QUERIES;
    const maxPerQuery = Math.min(body.max_per_query || 20, 60);
    const downloadPhotos = body.download_photos !== false;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const stats = {
      queries: queries.length,
      total_found: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      photos_downloaded: 0,
      details: [] as any[],
    };

    for (const query of queries) {
      console.log(`Lekérés: ${query}`);
      const results = await searchPlaces(query, maxPerQuery);
      stats.total_found += results.length;

      for (const place of results) {
        try {
          if (!isHealthcareType(place.primaryType)) {
            stats.skipped++;
            continue;
          }

          const name = place.displayName?.text;
          if (!name) {
            stats.skipped++;
            continue;
          }

          // Létezik már?
          const { data: existing } = await supabase
            .from('clinics')
            .select('id, photo_url')
            .eq('google_place_id', place.id)
            .maybeSingle();

          const slug = slugify(name) + '-' + place.id.substring(0, 8);

          // Város heurisztika a címből
          const cityMatch = place.formattedAddress?.match(/(\d{4})\s+([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)/);
          const cityName = cityMatch?.[2];

          let cityId = null;
          if (cityName) {
            const { data: c } = await supabase
              .from('cities')
              .select('id')
              .ilike('name', cityName)
              .maybeSingle();
            cityId = c?.id || null;
          }

          // Nyitvatartás összerakása weekdayDescriptions-ból
          let openingHours: Record<string, string> | null = null;
          if (place.regularOpeningHours?.weekdayDescriptions) {
            openingHours = {};
            const days = ['hetfo','kedd','szerda','csutortok','pentek','szombat','vasarnap'];
            place.regularOpeningHours.weekdayDescriptions.forEach((desc, i) => {
              // pl. "Hétfő: 08:00–17:00" → kivesszük az időt
              const parts = desc.split(':');
              if (parts.length >= 2) {
                openingHours![days[i]] = parts.slice(1).join(':').trim();
              }
            });
          }

          const clinicData: any = {
            name,
            slug,
            address: place.formattedAddress || null,
            latitude: place.location?.latitude || null,
            longitude: place.location?.longitude || null,
            phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
            website: place.websiteUri || null,
            opening_hours: openingHours,
            city_id: cityId,
            google_place_id: place.id,
            google_rating: place.rating || null,
            google_review_count: place.userRatingCount || null,
            google_attribution: place.attributions?.join(' · ') || null,
            last_google_sync: new Date().toISOString(),
            source: 'google',
            is_active: true,
          };

          let clinicId: string;
          if (existing) {
            const { error } = await supabase
              .from('clinics')
              .update(clinicData)
              .eq('id', existing.id);
            if (error) throw error;
            clinicId = existing.id;
            stats.updated++;
          } else {
            const { data: ins, error } = await supabase
              .from('clinics')
              .insert(clinicData)
              .select('id')
              .single();
            if (error) throw error;
            clinicId = ins.id;
            stats.inserted++;
          }

          // Fotó letöltése (csak ha új vagy nincs fotó)
          if (downloadPhotos && place.photos?.length && (!existing || !existing.photo_url)) {
            const photoUrl = await downloadAndStorePhoto(
              supabase,
              place.photos[0].name,
              slug,
              0,
            );
            if (photoUrl) {
              await supabase.from('clinics').update({ photo_url: photoUrl }).eq('id', clinicId);
              stats.photos_downloaded++;
            }
          }

          stats.details.push({
            name,
            google_place_id: place.id,
            action: existing ? 'updated' : 'inserted',
          });
        } catch (e) {
          console.error(`Hiba a ${place.displayName?.text} feldolgozásánál:`, e);
          stats.errors++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, stats }, null, 2), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Globális hiba:', e);
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
