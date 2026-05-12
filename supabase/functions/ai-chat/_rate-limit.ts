// supabase/functions/ai-chat/_rate-limit.ts
// ────────────────────────────────────────────────────────────────────────────
// Drop-in IP-alapú rate limiter a Szakorvos.hu ai-chat (és más publikus,
// JWT-nélküli) Edge Function-jeihez.
//
// HASZNÁLAT:
//
//   import { checkRateLimit } from "./_rate-limit.ts";
//
//   Deno.serve(async (req) => {
//     const rl = await checkRateLimit(req, {
//       windowSeconds: 60,
//       maxRequests:  20,    // egy IP-ről max 20 hívás / perc
//     });
//     if (!rl.allowed) {
//       return new Response(
//         JSON.stringify({ error: "Too many requests" }),
//         { status: 429, headers: { "Content-Type": "application/json",
//                                   "Retry-After": String(rl.retryAfter) } },
//       );
//     }
//     // … a normál logika …
//   });
//
//
// HOL TÁROL?
//   Egy `rate_limits` táblában a Supabase-ben. A séma legalul.
//
//   Alternatíva: Upstash Redis vagy Deno KV — de a Postgres-megoldás
//   plusz infra nélkül elindul.
// ────────────────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export interface RateLimitOptions {
  windowSeconds: number;     // pl. 60
  maxRequests:   number;     // pl. 20
  keyPrefix?:    string;     // pl. "ai-chat" — több függvény közötti elkülönítés
}

export interface RateLimitResult {
  allowed:    boolean;
  remaining:  number;
  retryAfter: number;        // mp, csak ha !allowed
}

function getClientIp(req: Request): string {
  // Supabase Edge / Cloudflare / Vercel mind tesz CF-Connecting-IP-t,
  // X-Forwarded-For headert, vagy x-real-ip-t. Próbálkozunk sorban.
  const cf  = req.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  const xff = req.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("X-Real-IP");
  if (xri) return xri;
  return "unknown";
}

export async function checkRateLimit(
  req: Request,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const prefix = opts.keyPrefix ?? "default";
  const bucketKey = `${prefix}:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - opts.windowSeconds;

  const db = getClient();

  try {
    // 1) bejegyzés
    await db.from("rate_limits").insert({
      bucket_key: bucketKey,
      created_at: new Date().toISOString(),
    });

    // 2) ablakon belüli hívások számolása
    const { count, error: countErr } = await db
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("bucket_key", bucketKey)
      .gte("created_at", new Date(windowStart * 1000).toISOString());

    if (countErr) {
      // Adatbázis-hiba esetén ne blokkoljuk a kérést — log + engedélyezés
      console.error("[rate-limit] count error", countErr);
      return { allowed: true, remaining: opts.maxRequests, retryAfter: 0 };
    }

    const used = count ?? 0;
    const remaining = Math.max(0, opts.maxRequests - used);
    if (used > opts.maxRequests) {
      return { allowed: false, remaining: 0, retryAfter: opts.windowSeconds };
    }
    return { allowed: true, remaining, retryAfter: 0 };
  } catch (e) {
    console.error("[rate-limit] exception", e);
    // Fail open
    return { allowed: true, remaining: opts.maxRequests, retryAfter: 0 };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ELŐKÉSZÍTŐ SQL — futtasd le egyszer a Supabase SQL Editor-ben:
//
//   create table if not exists rate_limits (
//     id          bigint generated always as identity primary key,
//     bucket_key  text not null,
//     created_at  timestamptz not null default now()
//   );
//
//   create index if not exists rate_limits_lookup_idx
//     on rate_limits (bucket_key, created_at desc);
//
//   -- Régi bejegyzések takarítása (cron-job vagy pg_cron)
//   -- Naponta: delete from rate_limits where created_at < now() - interval '1 day';
//
//   -- RLS: senki ne férjen hozzá az anon role-lal
//   alter table rate_limits enable row level security;
//   -- (alapból zárva, csak a service_role férhet hozzá)
//
// ────────────────────────────────────────────────────────────────────────────
