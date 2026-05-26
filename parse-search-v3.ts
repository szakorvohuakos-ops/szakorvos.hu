// parse-search — AI alapú kereső-intent felismerő (v3 — klinika-kereséssel)
// Input: "Memed klinika Budapest" vagy "férfi fül-orr-gégész"
// Output: target ('doctor' | 'clinic') + a megfelelő mezők

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "gpt-5-nano";
const CACHE_TTL_HOURS = 24;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey"
};

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

let _specialtyCache: { list: { slug: string; name: string }[]; timestamp: number } | null = null;
const SPEC_CACHE_TTL_MS = 60 * 60 * 1000;

const ALLOWED_LANGS = ["magyar", "angol", "német", "francia", "orosz", "arab", "román", "olasz"];

const ALLOWED_INSURANCE = [
  "OEP / TAJ kártya", "Magánfizető", "SIGNAL IDUNA", "Generali",
  "Allianz", "UNIQA", "AXA", "CIG Pannónia", "Groupama"
];

async function getSpecialties(): Promise<{ slug: string; name: string }[]> {
  if (_specialtyCache && Date.now() - _specialtyCache.timestamp < SPEC_CACHE_TTL_MS) {
    return _specialtyCache.list;
  }
  const { data, error } = await db.from("specialties")
    .select("doctor_slug, name")
    .eq("is_active", true)
    .order("doctor_count", { ascending: false, nullsFirst: false });
  if (error || !data) return _specialtyCache?.list || [];
  const list = data.map((s: { doctor_slug: string; name: string }) => ({ slug: s.doctor_slug, name: s.name }));
  _specialtyCache = { list, timestamp: Date.now() };
  return list;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function getDateContext(): { isoDate: string; dayOfWeek: number; dayName: string } {
  const now = new Date();
  const days = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  return {
    isoDate: now.toISOString().slice(0, 10),
    dayOfWeek: now.getDay(),
    dayName: days[now.getDay()]
  };
}

interface ParsedIntent {
  target: "doctor" | "clinic";
  specialty_slug: string | null;
  city: string | null;
  district: string | null;
  days: number[];
  weekend: boolean;
  gender: "male" | "female" | null;
  lang: string[];
  online: boolean;
  urgent: boolean;
  price_max: number | null;
  exp_min: number | null;
  insurance: string[];
  clinic_query: string | null;
  confidence: number;
}

async function parseWithAI(query: string): Promise<ParsedIntent> {
  const specs = await getSpecialties();
  const specList = specs.map(s => `${s.slug}: ${s.name}`).join("\n");
  const ctx = getDateContext();

  const systemPrompt = `Te egy magyar nyelvű orvoskereső struktúrált-extrakciós segéd vagy.
A felhasználó magyar nyelvű szabad szövege alapján add vissza EGY JSON objektumot az alábbi mezőkkel:

{
  "target": "doctor" | "clinic",      // mit keres? orvost vagy klinikát/rendelőt/kórházat
  "specialty_slug": string | null,    // PONTOSAN a megadott slug-listából, vagy null
  "city": string | null,              // magyar város, eredeti írásmód, vagy null
  "district": number | null,          // budapesti kerület 1-23, vagy null
  "days": number[],                   // a hét napjai (0=Vasárnap .. 6=Szombat); üres ha nincs
  "weekend": boolean,                 // true ha "hétvégén" / "szombaton vagy vasárnap"
  "gender": "male" | "female" | null, // "férfi orvos" → male, "női orvos" → female
  "lang": string[],                   // nyelvek a felsorolt készletből
  "online": boolean,                  // true ha online / telemedicina / videó jelzett
  "urgent": boolean,                  // true ha "sürgős" / "ma" / "azonnali"
  "price_max": number | null,         // forintban; "max 15 ezer" → 15000
  "exp_min": number | null,           // évek; "10 éves tapasztalat" → 10
  "insurance": string[],              // biztosítók a felsorolt készletből
  "clinic_query": string | null,      // ha target=clinic és van konkrét klinika név (pl. "DemoMed"), írd ide; egyébként null
  "confidence": number                // 0.0-1.0
}

═══ Mit keres? (target) ═══
A "target" mezőt MINDIG add vissza. Alapértelmezés: "doctor".

- target = "clinic", ha a felhasználó konkrét klinikát/rendelőt/kórházat keres, például:
  * "DemoMed klinika" → target=clinic, clinic_query="DemoMed klinika"
  * "Hungária Med-M Győr" → target=clinic, clinic_query="Hungária Med-M Győr", city="Győr"
  * "Pasaréti rendelő" → target=clinic, clinic_query="Pasaréti rendelő"
  * "magánrendelő XII. kerület" → target=clinic, district=12
  * "klinika Pécsen" → target=clinic, city="Pécs"
  * "magánrendelő közelben" → target=clinic
  * "kórház Debrecen" → target=clinic, city="Debrecen"
  * "ortopéd klinika Budapesten" → target=clinic, specialty_slug="ortoped-traumatologus", city="Budapest"
  * Ha tartalmazza ezeket a kulcsszavakat: "klinika", "rendelő", "magánrendelő", "kórház", "egészségház", "centrum" (egészségügyi kontextusban), "intézet" — akkor target=clinic

- target = "doctor" minden más esetben, például:
  * "fáj a térdem" → target=doctor
  * "bőrgyógyász Debrecen" → target=doctor
  * "Dr. Kovács Péter" → target=doctor
  * "férfi nőgyógyász angolul" → target=doctor

═══ Időbeli kontextus ═══
Ma: ${ctx.isoDate} (${ctx.dayName}, dayOfWeek=${ctx.dayOfWeek})
- "ma" → days: [${ctx.dayOfWeek}], urgent: true
- "holnap" → days: [${(ctx.dayOfWeek + 1) % 7}], urgent: true
- "hétvégén" → weekend: true (a days üres marad)
- "hét közben" / "munkanapokon" → days: [1,2,3,4,5]
- "péntek" → days: [5]
- "szombaton" → days: [6]
- "vasárnap" → days: [0]

═══ Szakterület-mapping (példák) ═══
- "fáj a térdem" / "váll" / "derék" / "sportsérülés" → ortoped-traumatologus
- "fáj a fejem" / "migrén" / "zsibbad a kezem" → neurologus
- "fogfájás" / "fogszuvasodás" / "implantátum" → fogorvos
- "fáj a torkom" / "fül" / "orr" / "rekedt" / "horkolás" → ful-orr-gege-szakorvos
- "látás" / "szem" / "homályos látás" → szemeszet-szakorvos
- "anyajegy" / "kiütés" / "akne" / "ekcéma" / "pszoriázis" → borgyogyasz
- "szívdobogás" / "mellkasi fájdalom" / "magas vérnyomás" → kardiologus
- "szorongás" / "depresszió" / "pánik" → pszichiatrus vagy pszichologus
- "terhesség" / "menstruáció" / "fogamzásgátlás" → nogyogyasz
- "vizelési panasz" / "prosztata" / "erekciós" → urologus
- "gyomor" / "reflux" / "puffadás" → gasztroenterologus
- "pajzsmirigy" / "hormonzavar" / "cukor" → endokrinologus
- "reuma" / "ízületi fájdalom" → reumatologus
- Ha közvetlenül szakterület-nevet írt, használd a kanonikus slug-ot.

═══ Engedélyezett értékek ═══
- lang csak: ${ALLOWED_LANGS.join(", ")}
- insurance csak: ${ALLOWED_INSURANCE.join(", ")}
- specialty_slug csak az alábbi listából (vagy null):

${specList}

═══ Példák ═══

Input: "férfi fül-orr-gégész Budapesten hétvégén"
Output: {"target":"doctor","specialty_slug":"ful-orr-gege-szakorvos","city":"Budapest","district":null,"days":[],"weekend":true,"gender":"male","lang":[],"online":false,"urgent":false,"price_max":null,"exp_min":null,"insurance":[],"clinic_query":null,"confidence":0.95}

Input: "DemoMed klinika Budapest"
Output: {"target":"clinic","specialty_slug":null,"city":"Budapest","district":null,"days":[],"weekend":false,"gender":null,"lang":[],"online":false,"urgent":false,"price_max":null,"exp_min":null,"insurance":[],"clinic_query":"DemoMed klinika","confidence":0.95}

Input: "magánrendelő XII. kerület"
Output: {"target":"clinic","specialty_slug":null,"city":"Budapest","district":12,"days":[],"weekend":false,"gender":null,"lang":[],"online":false,"urgent":false,"price_max":null,"exp_min":null,"insurance":[],"clinic_query":null,"confidence":0.85}

Input: "ortopéd klinika Pécsen"
Output: {"target":"clinic","specialty_slug":"ortoped-traumatologus","city":"Pécs","district":null,"days":[],"weekend":false,"gender":null,"lang":[],"online":false,"urgent":false,"price_max":null,"exp_min":null,"insurance":[],"clinic_query":null,"confidence":0.9}

Input: "Hungária Med-M Győr"
Output: {"target":"clinic","specialty_slug":null,"city":"Győr","district":null,"days":[],"weekend":false,"gender":null,"lang":[],"online":false,"urgent":false,"price_max":null,"exp_min":null,"insurance":[],"clinic_query":"Hungária Med-M","confidence":0.95}

Input: "anyajegy vizsgálat sürgősen, max 20000 Ft"
Output: {"target":"doctor","specialty_slug":"borgyogyasz","city":null,"district":null,"days":[],"weekend":false,"gender":null,"lang":[],"online":false,"urgent":true,"price_max":20000,"exp_min":null,"insurance":[],"clinic_query":null,"confidence":0.9}

Input: "tapasztalt nőgyógyász XIII. kerület, angolul"
Output: {"target":"doctor","specialty_slug":"nogyogyasz","city":"Budapest","district":13,"days":[],"weekend":false,"gender":"female","lang":["angol"],"online":false,"urgent":false,"price_max":null,"exp_min":null,"insurance":[],"clinic_query":null,"confidence":0.9}

Input: "fáj a térdem"
Output: {"target":"doctor","specialty_slug":"ortoped-traumatologus","city":null,"district":null,"days":[],"weekend":false,"gender":null,"lang":[],"online":false,"urgent":false,"price_max":null,"exp_min":null,"insurance":[],"clinic_query":null,"confidence":0.85}

Input: "Allianz biztosított online pszichológus"
Output: {"target":"doctor","specialty_slug":"pszichologus","city":null,"district":null,"days":[],"weekend":false,"gender":null,"lang":[],"online":true,"urgent":false,"price_max":null,"exp_min":null,"insurance":["Allianz"],"clinic_query":null,"confidence":0.9}

Input: "kórház Miskolc"
Output: {"target":"clinic","specialty_slug":null,"city":"Miskolc","district":null,"days":[],"weekend":false,"gender":null,"lang":[],"online":false,"urgent":false,"price_max":null,"exp_min":null,"insurance":[],"clinic_query":null,"confidence":0.85}

═══ Fontos szabályok ═══
- A target mezőt MINDIG add vissza ("doctor" vagy "clinic").
- A specialty_slug-nak PONTOSAN egyeznie kell a fenti listával vagy null.
- Soha NE találj ki nem-létező slug-ot, nyelvet vagy biztosítót.
- Ha valami nem szerepel a kérésben, használj alapértelmezett értéket (null, üres tömb, false).
- A válasz EGYETLEN JSON objektum legyen, semmi más.`;

  const userPrompt = `Felhasználói kérés: "${query}"`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      reasoning_effort: "minimal"
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`);
  }
  const out = await res.json();
  const content = out.choices?.[0]?.message?.content || "{}";

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(content); }
  catch { parsed = {}; }

  // ─── Validation ───
  const target: "doctor" | "clinic" = parsed.target === "clinic" ? "clinic" : "doctor";

  const validSlug = specs.some(s => s.slug === parsed.specialty_slug);
  const specialty_slug = validSlug && typeof parsed.specialty_slug === "string" ? parsed.specialty_slug : null;

  let district: string | null = null;
  if (parsed.district != null) {
    const n = typeof parsed.district === "number" ? parsed.district : parseInt(String(parsed.district), 10);
    if (!isNaN(n) && n > 0 && n <= 23) district = String(n);
  }

  let city: string | null = null;
  if (parsed.city && typeof parsed.city === "string") {
    city = parsed.city.trim() || null;
  }

  const days: number[] = Array.isArray(parsed.days)
    ? parsed.days
        .map((x: unknown) => typeof x === "number" ? x : parseInt(String(x), 10))
        .filter((n: number) => !isNaN(n) && n >= 0 && n <= 6)
    : [];

  const weekend = parsed.weekend === true;

  let gender: "male" | "female" | null = null;
  if (parsed.gender === "male" || parsed.gender === "female") gender = parsed.gender;

  const lang: string[] = Array.isArray(parsed.lang)
    ? parsed.lang
        .map((x: unknown) => String(x).toLowerCase().trim())
        .filter((l: string) => ALLOWED_LANGS.includes(l))
    : [];

  const online = parsed.online === true;
  const urgent = parsed.urgent === true;

  let price_max: number | null = null;
  if (typeof parsed.price_max === "number" && parsed.price_max > 0 && parsed.price_max < 1_000_000) {
    price_max = Math.round(parsed.price_max);
  }

  let exp_min: number | null = null;
  if (typeof parsed.exp_min === "number" && parsed.exp_min > 0 && parsed.exp_min < 60) {
    exp_min = Math.round(parsed.exp_min);
  }

  const insurance: string[] = Array.isArray(parsed.insurance)
    ? parsed.insurance
        .map((x: unknown) => String(x).trim())
        .filter((i: string) => ALLOWED_INSURANCE.includes(i))
    : [];

  let clinic_query: string | null = null;
  if (target === "clinic" && parsed.clinic_query && typeof parsed.clinic_query === "string") {
    clinic_query = parsed.clinic_query.trim().slice(0, 200) || null;
  }

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5)));

  return { target, specialty_slug, city, district, days, weekend, gender, lang, online, urgent, price_max, exp_min, insurance, clinic_query, confidence };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawQuery = String(body.query || "").trim();
    if (!rawQuery) {
      return new Response(JSON.stringify({ error: "query kötelező" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }
    if (rawQuery.length > 200) {
      return new Response(JSON.stringify({ error: "query túl hosszú (max 200)" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    const normQuery = normalize(rawQuery);
    const qHash = await sha256(normQuery);

    const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString();
    const { data: cached } = await db.from("search_intent_cache")
      .select("target, specialty_slug, city, district, days, weekend, gender, lang, online, urgent, price_max, exp_min, insurance, clinic_query, confidence, created_at")
      .eq("query_hash", qHash)
      .gte("created_at", cutoff)
      .maybeSingle();

    if (cached) {
      db.rpc("increment_search_intent_hit", { p_hash: qHash }).then(() => {}).catch(() => {});
      return new Response(JSON.stringify({
        query: rawQuery,
        target: cached.target || "doctor",
        specialty_slug: cached.specialty_slug,
        city: cached.city,
        district: cached.district,
        days: cached.days || [],
        weekend: cached.weekend || false,
        gender: cached.gender,
        lang: cached.lang || [],
        online: cached.online || false,
        urgent: cached.urgent || false,
        price_max: cached.price_max,
        exp_min: cached.exp_min,
        insurance: cached.insurance || [],
        clinic_query: cached.clinic_query,
        confidence: cached.confidence,
        cached: true
      }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    const result = await parseWithAI(rawQuery);

    db.from("search_intent_cache").upsert({
      query_hash: qHash,
      raw_query: rawQuery,
      target: result.target,
      specialty_slug: result.specialty_slug,
      city: result.city,
      district: result.district,
      days: result.days,
      weekend: result.weekend,
      gender: result.gender,
      lang: result.lang,
      online: result.online,
      urgent: result.urgent,
      price_max: result.price_max,
      exp_min: result.exp_min,
      insurance: result.insurance,
      clinic_query: result.clinic_query,
      confidence: result.confidence,
      created_at: new Date().toISOString(),
      hits: 1
    }, { onConflict: "query_hash" }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({
      query: rawQuery,
      ...result,
      cached: false
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[parse-search] error", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
});
