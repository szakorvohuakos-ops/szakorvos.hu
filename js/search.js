/**
 * search.js — Search logic
 * Szakorvos.hu
 *
 * ⚠️  SECURITY NOTE:
 *    The Supabase anon key is intentionally NOT included here.
 *    All direct DB calls should go through a backend proxy or
 *    be injected at build time via environment variables.
 *
 *    Replace SUPABASE_URL / SUPABASE_KEY with:
 *    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;   // Vite
 *    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;   // Vite
 *    — or —
 *    window.__SUPABASE_URL__ / window.__SUPABASE_KEY__          // server-injected
 */

'use strict';

// ── Config ────────────────────────────────────────────────────
// TODO: Replace with build-time env injection
const SUPABASE_URL = window.__SUPABASE_URL__ || 'https://asgnkjmwzhbczpvetprh.supabase.co';
const SUPABASE_KEY = window.__SUPABASE_KEY__ || ''; // ← DO NOT commit real keys

/** Simple fetch wrapper for Supabase REST API */
async function supaFetch(path, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${path}${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch error: ${res.status}`);
  return res.json();
}

// ── Current search state ──────────────────────────────────────
export const searchState = {
  specialty: '',
  city:      '',
  query:     '',
};

/**
 * Navigate to results page with current search params.
 * @param {Partial<typeof searchState>} overrides
 */
export function goToResults(overrides = {}) {
  const state  = { ...searchState, ...overrides };
  const params = new URLSearchParams();
  if (state.specialty) params.set('specialty', state.specialty);
  if (state.city)      params.set('city',      state.city);
  if (state.query)     params.set('q',         state.query);
  window.location.href = `talalatok.html?${params.toString()}`;
}

/**
 * Fetch doctors for AI result widget (top 3 by rating).
 * @param {string} specialty
 * @returns {Promise<Array>}
 */
export async function fetchTopDoctors(specialty) {
  // NOTE: ideally filtered by specialty slug; using rating sort as fallback
  return supaFetch(
    'doctors',
    `?select=id,name,rating,review_count,photo_url,experience_years,doctor_specialties(specialties(name)),doctor_clinics(consultation_fee,clinics(name,cities(name)))&is_active=eq.true&order=rating.desc&limit=3`
  );
}

// ── Autocomplete / smart search ───────────────────────────────
const SPECIALTY_LIST = [
  'Kardiológus','Neurológus','Belgyógyász','Bőrgyógyász','Gasztroenterológus',
  'Ortopéd','Szemész','Fogász','Nőgyógyász','Pszichológus','Pszichiáter',
  'Reumatológus','Endokrinológus','Urológus','Fül-orr-gégész','Gyermekgyógyász',
  'Allergológus','Onkológus','Háziorvos',
];

const CITY_LIST = [
  'Budapest','Debrecen','Miskolc','Pécs','Győr','Nyíregyháza',
  'Kecskemét','Székesfehérvár','Szombathely','Érd','Tatabánya','Kaposvár',
];

/**
 * Debounce helper.
 * @param {Function} fn
 * @param {number} delay ms
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Get autocomplete suggestions for a query string.
 * @param {string} query
 * @returns {{ label: string, type: string, icon: string }[]}
 */
export function getSuggestions(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();

  const specs = SPECIALTY_LIST
    .filter(s => s.toLowerCase().includes(q))
    .slice(0, 4)
    .map(s => ({ label: s, type: 'Szakterület', icon: '🔍' }));

  const cities = CITY_LIST
    .filter(c => c.toLowerCase().includes(q))
    .slice(0, 3)
    .map(c => ({ label: c, type: 'Város', icon: '📍' }));

  return [...specs, ...cities];
}

/**
 * Initialise the classic search box (section below popular specialties).
 */
export function initClassicSearch() {
  const specInput = document.getElementById('classicSpec');
  const cityInput = document.getElementById('classicCity');

  if (!specInput || !cityInput) return;

  // Debounced autocomplete
  const handleInput = debounce((e) => {
    const suggestions = getSuggestions(e.target.value);
    renderDropdown('classicDropdown', suggestions, (label) => {
      specInput.value = label;
    });
  }, 200);

  specInput.addEventListener('input', handleInput);
  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doClassicSearch();
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('classicDropdown');
    if (dd && !specInput.contains(e.target)) dd.classList.remove('open');
  });
}

function renderDropdown(id, items, onSelect) {
  const el = document.getElementById(id);
  if (!el) return;

  if (!items.length) { el.classList.remove('open'); return; }

  el.innerHTML = items.map(item => `
    <div class="freetext-dropdown-item" data-label="${item.label}">
      <span class="freetext-dropdown-icon">${item.icon}</span>
      <div>
        <div class="freetext-dropdown-label">${item.label}</div>
        <div class="freetext-dropdown-sub">${item.type}</div>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.freetext-dropdown-item').forEach(row => {
    row.addEventListener('click', () => {
      onSelect(row.dataset.label);
      el.classList.remove('open');
    });
  });

  el.classList.add('open');
}

/** Called by classic search button / Enter */
export function doClassicSearch() {
  const spec = document.getElementById('classicSpec')?.value.trim() || '';
  const city = document.getElementById('classicCity')?.value.trim() || '';
  goToResults({ specialty: spec, city });
}

/** Called by quick-chip buttons */
export function classicChip(specialty) {
  goToResults({ specialty });
}
