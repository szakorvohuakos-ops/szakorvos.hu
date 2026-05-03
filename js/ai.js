/**
 * ai.js — AI chat / analysis module
 * Szakorvos.hu
 *
 * ⚠️  SECURITY NOTE:
 *    The Supabase Edge Function URL below is public (no secret key needed for calling).
 *    However, the Supabase anon key used inside the Edge Function should only live
 *    on the server side (Edge Function env var), never in this file.
 *    If you need direct DB access from the frontend, use a backend proxy instead.
 */

'use strict';

// ── Config (replace with env-var injection at build time) ─────
const AI_ENDPOINT = window.__SUPABASE_URL__
  ? `${window.__SUPABASE_URL__}/functions/v1/ai-chat`
  : 'https://asgnkjmwzhbczpvetprh.supabase.co/functions/v1/ai-chat';
  // TODO: Inject via build step (e.g. Vite: import.meta.env.VITE_AI_ENDPOINT)

/**
 * Analyse user input via AI Edge Function.
 * @param {string} query
 * @returns {Promise<{reply, specialty, vizsgalat, bizonyossag, secondary, tertiary}>}
 */
export async function analyseQuery(query) {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: query }] }),
  });

  if (!res.ok) {
    throw new Error(`AI endpoint error: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) throw new Error(data.error);

  return {
    reply:       data.reply       || '',
    specialty:   data.specialty   || null,
    vizsgalat:   data.vizsgalat   || null,
    bizonyossag: data.bizonyossag || null,
    secondary:   data.secondary   || null,
    tertiary:    data.tertiary    || null,
  };
}

// ── Typewriter placeholder animation ─────────────────────────
const PLACEHOLDER_TIPS = [
  'Anyajegyszűrés Győrben…',
  'Kardiológus Debrecenben…',
  'Fáj a térdem lépcsőzéskor…',
  'Mellkasi szorítást érzek terhelésre…',
  'Három napja fáj a fejem és szédülök…',
  'Bőrkiütés jelent meg a karomra…',
  'Látásromlás az utóbbi hetekben…',
];

/**
 * Start typewriter animation on input placeholder.
 * Stops automatically when the user focuses the input.
 * @param {HTMLInputElement} inputEl
 */
export function startTypewriter(inputEl) {
  if (!inputEl) return;

  let tipIdx   = 0;
  let charIdx  = 0;
  let isTyping = true;
  let timer    = null;

  const step = () => {
    if (document.activeElement === inputEl) {
      timer = setTimeout(step, 500);
      return;
    }

    const current = PLACEHOLDER_TIPS[tipIdx];

    if (isTyping) {
      charIdx++;
      inputEl.placeholder = current.slice(0, charIdx);
      timer = setTimeout(step, charIdx < current.length ? 55 + Math.random() * 40 : 1800);
      if (charIdx >= current.length) isTyping = false;
    } else {
      charIdx--;
      inputEl.placeholder = current.slice(0, charIdx);
      if (charIdx <= 0) {
        isTyping = true;
        tipIdx = (tipIdx + 1) % PLACEHOLDER_TIPS.length;
        timer = setTimeout(step, 400);
      } else {
        timer = setTimeout(step, 28);
      }
    }
  };

  // Stop on focus, resume on blur
  inputEl.addEventListener('focus', () => {
    clearTimeout(timer);
    inputEl.placeholder = '';
  });
  inputEl.addEventListener('blur', () => {
    if (!inputEl.value) {
      charIdx = 0;
      isTyping = true;
      timer = setTimeout(step, 600);
    }
  });

  timer = setTimeout(step, 1200);
}
