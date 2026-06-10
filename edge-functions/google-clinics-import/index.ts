// ─────────────────────────────────────────────────────────────────────────────
//  google-clinics-import  (BIZTONSÁGOS VÁLTOZAT)
//
//  Mit változott a régihez képest:
//   • A titkos (service_role / secret) kulcs SOHA nem érkezik a böngészőből.
//     A függvény a SAJÁT környezeti változójából veszi (szerveroldalon marad).
//   • A hívót a saját bejelentkezett munkamenete (session JWT) azonosítja, és
//     a függvény ellenőrzi, hogy SUPERADMIN — különben 401/403.
//
//  Telepítés (a saját gépeden, a projekt mappájában):
//     supabase functions deploy google-clinics-import --no-verify-jwt
//   A --no-verify-jwt KELL, mert a hitelesítést mi magunk végezzük a kódban
//   (a beépített verify_jwt nem ismeri az új sb_publishable/sb_secret kulcsokat).
//
//  Szükséges Edge Function secret-ek (Dashboard → Edge Functions → Secrets):
//     SUPABASE_URL                (általában automatikusan megvan)
//     SUPABASE_SECRET_KEYS        (új rendszer) VAGY SUPABASE_SERVICE_ROLE_KEY (régi)
//     SUPABASE_PUBLISHABLE_KEYS   (új) VAGY SUPABASE_ANON_KEY (régi)  – a hívó JWT ellenőrzéséhez
//     GOOGLE_MAPS_API_KEY         (a Places API-hoz – ahogy eddig)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Titkos (secret/service_role) kulcs – CSAK szerveroldalon, env-ből.
function getSecretKey(): string {
  const newKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (newKeys) {
    try { return JSON.parse(newKeys)["default"]; } catch { /* fallthrough */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

// Publishable (anon) kulcs – a hívó session JWT ellenőrzéséhez.
function getPublishableKey(): string {
  const newKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (newKeys) {
    try { return JSON.parse(newKeys)["default"]; } catch { /* fallthrough */ }
  }
  return Deno.env.get("SUPABASE_ANON_KEY")!;
}

const CORS = {
  "Access-Control-Allow-Origin": "https://szakorvos.hu",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  // 1) A hívó azonosítása a SAJÁT session JWT-jéből (Authorization: Bearer <user JWT>)
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ success: false, error: "Hiányzó bejelentkezés." }, 401);

  // Kliens a hívó nevében (RLS érvényes rá), a JWT-vel
  const userClient = createClient(SUPABASE_URL, getPublishableKey(), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ success: false, error: "Érvénytelen munkamenet." }, 401);
  }

  // 2) Superadmin ellenőrzés – a hívó user_profiles.role mezője alapján
  const { data: profile, error: profErr } = await userClient
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profErr || !profile || profile.role !== "superadmin") {
    return json({ success: false, error: "Nincs jogosultság (superadmin szükséges)." }, 403);
  }

  // 3) Innen a privilegizált munka a SZERVEROLDALI titkos kulccsal (RLS-t megkerüli)
  const admin = createClient(SUPABASE_URL, getSecretKey());

  // 4) Input
  let body: { queries?: string[]; max_per_query?: number; download_photos?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Hibás JSON." }, 400);
  }

  const maxPer = Math.min(Math.max(parseInt(String(body.max_per_query ?? 20), 10) || 20, 1), 60);
  const downloadPhotos = !!body.download_photos;
  const queries = Array.isArray(body.queries)
    ? body.queries.map((q) => String(q).trim()).filter(Boolean).slice(0, 100)
    : [];

  // ───────────────────────────────────────────────────────────────────────────
  //  INNEN JÖN A TÉNYLEGES IMPORT-LOGIKA.
  //  Másold be ide a régi google-clinics-import függvény belső logikáját
  //  (Google Places hívások, klinikák beszúrása az `admin` klienssel).
  //  FONTOS: mindenhol az `admin` klienst használd az íráshoz, és NE várj
  //  kulcsot a kérés törzséből/headeréből.
  //
  //  Példa-váz:
  //    const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")!;
  //    let imported = 0;
  //    for (const q of (queries.length ? queries : DEFAULT_QUERIES)) {
  //      // ... Places Text Search hívás GOOGLE_KEY-vel ...
  //      // ... await admin.from("clinics").upsert(...) ...
  //      // imported += ...
  //    }
  //    return json({ success: true, imported });
  // ───────────────────────────────────────────────────────────────────────────

  return json({
    success: true,
    note: "Auth + jogosultság rendben. Ide kell bemásolni a régi import-logikát (az 'admin' klienssel írva).",
    received: { queries: queries.length, max_per_query: maxPer, download_photos: downloadPhotos },
  });
});
