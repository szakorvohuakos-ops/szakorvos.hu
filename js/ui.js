/**
 * ui.js — DOM manipulation & UI state helpers
 * Szakorvos.hu
 */

'use strict';

// ── Element refs ──────────────────────────────────────────────
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ── Show / hide ───────────────────────────────────────────────
export function show(el) { if (el) el.style.display = ''; }
export function hide(el) { if (el) el.style.display = 'none'; }
export function toggle(el, force) {
  if (el) el.style.display = (force ?? el.style.display === 'none') ? '' : 'none';
}

// ── Widget state machine ──────────────────────────────────────
const WIDGET_STATES = {
  IDLE:    'idle',
  LOADING: 'loading',
  RESULT:  'result',
};

/**
 * Set the AI widget to idle / loading / result state.
 * @param {'idle'|'loading'|'result'} state
 */
export function setWidgetState(state) {
  const idle    = $('#chatIdleState');
  const loading = $('#chatLoadingState');
  const result  = $('#chatResult');
  const reset   = $('#chatResetBtn');

  hide(idle);
  hide(loading);
  hide(result);

  switch (state) {
    case WIDGET_STATES.IDLE:
      show(idle);
      hide(reset);
      break;
    case WIDGET_STATES.LOADING:
      show(loading);
      break;
    case WIDGET_STATES.RESULT:
      show(result);
      if (reset) reset.style.display = 'inline';
      break;
  }
}

// ── Render AI result ──────────────────────────────────────────
const SPEC_ICONS = {
  'Kardiológia':       '❤️',
  'Neurológia':        '🧠',
  'Gasztroenterológia':'🫁',
  'Bőrgyógyászat':    '🌿',
  'Háziorvos':         '⚕️',
  'Ortopédia':         '🦴',
  'Szemészet':         '👁️',
  'Nőgyógyászat':     '💜',
  'Fogászat':          '🦷',
  'Pszichológia':      '💭',
  'Reumatológia':      '🦴',
  'Endokrinológia':    '⚗️',
  'Urológia':          '🔬',
  'Fül-orr-gégészet': '👂',
  'Pszichiátria':      '🧩',
  'Belgyógyászat':     '🩺',
  'Gyermekgyógyászat': '👶',
  'Allergológia':      '🌸',
  'Onkológia':         '🎗️',
  'Sürgősségi':        '🚨',
};

const COLORS = ['#2f5ddd','#7c3aed','#0d9488','#dc2626','#ec4899','#ea580c','#059669'];

/**
 * Render AI analysis result into #chatResult.
 */
export function renderResult({ reply, specialty, vizsgalat, bizonyossag, secondary, tertiary, doctors }) {
  const resultEl = $('#chatResult');
  if (!resultEl) return;

  const isSurgent = specialty === 'Sürgősségi';
  let html = '';

  if (isSurgent) {
    html = renderUrgentCard(reply);
  } else if (specialty) {
    html = renderSpecCard({ reply, specialty, vizsgalat, bizonyossag, secondary, tertiary });
    html += renderDoctorList(doctors || [], specialty);
    html += renderCtaButton(specialty);
  } else if (reply) {
    html = `<div style="padding:.75rem 1rem;font-size:13.5px;color:#374151;line-height:1.65">${reply}</div>`;
  }

  resultEl.innerHTML = html;
  setWidgetState('result');
}

function renderUrgentCard(reply) {
  return `
    <div style="background:#fee2e2;border:1.5px solid #fca5a5;border-radius:14px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-size:28px">🚨</div>
        <div>
          <div style="font-family:'Nunito',sans-serif;font-size:16px;font-weight:900;color:#b91c1c">Sürgős eset!</div>
          <div style="font-size:12px;color:#dc2626;margin-top:2px">${reply || 'Azonnal hívja a mentőt!'}</div>
        </div>
      </div>
      <a href="tel:104" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#ef4444;border-radius:10px;padding:11px 16px;text-decoration:none;color:#fff;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;box-shadow:0 4px 14px rgba(239,68,68,.35)">
        📞 Mentőhívás: 104
      </a>
    </div>`;
}

function renderSpecCard({ reply, specialty, vizsgalat, bizonyossag, secondary, tertiary }) {
  const icon = SPEC_ICONS[specialty] || '🏥';
  const pct  = bizonyossag || 85;
  const col  = pct >= 90 ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#f97316';

  let html = `
    <div style="background:linear-gradient(135deg,#f0fdf4,#f0f4ff);border:1.5px solid #bbf7d0;border-radius:16px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:42px;height:42px;border-radius:12px;background:#fff;border:1.5px solid #bbf7d0;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${icon}</div>
          <div>
            <div style="font-size:10px;font-weight:700;color:#9aa5c4;text-transform:uppercase;letter-spacing:.07em">Valószínű szakterület:</div>
            <div style="font-family:'Nunito',sans-serif;font-size:17px;font-weight:900;color:#0f172a">${specialty}</div>
            ${vizsgalat ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">Ajánlott vizsgálat: <strong style="color:#374151">${vizsgalat}</strong></div>` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:10px;font-weight:700;color:#9aa5c4;text-transform:uppercase;letter-spacing:.07em">Bizonyság</div>
          <div style="font-family:'Nunito',sans-serif;font-size:22px;font-weight:900;color:${col}">${pct}%</div>
          <div style="width:72px;height:5px;background:#e8edf8;border-radius:99px;margin-top:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:99px;transition:width .6s ease"></div>
          </div>
        </div>
      </div>
      ${reply ? `<div style="font-size:12.5px;color:#4b5563;line-height:1.6;border-top:1px solid #bbf7d0;padding-top:9px">${reply}</div>` : ''}
    </div>`;

  const extras = [secondary, tertiary].filter(Boolean);
  if (extras.length) {
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <span style="font-size:11px;color:#9aa5c4;font-weight:600">Egyéb lehetőség:</span>
      ${extras.map(s => `<a href="talalatok.html?specialty=${encodeURIComponent(s)}" style="display:inline-flex;align-items:center;gap:4px;background:#fff;border:1.5px solid #e8edf8;border-radius:100px;padding:4px 11px;font-size:12px;font-weight:700;color:#283897;text-decoration:none">${SPEC_ICONS[s] || '🏥'} ${s}</a>`).join('')}
    </div>`;
  }

  return html;
}

function renderDoctorList(doctors, specialty) {
  if (!doctors.length) {
    return `<div id="aiDocCards" style="display:flex;flex-direction:column;gap:6px">
      <div style="text-align:center;padding:.75rem;color:#9aa5c4;font-size:13px">Orvosok betöltése…</div>
    </div>`;
  }

  const cards = doctors.map((d, i) => {
    const rat  = parseFloat(d.rating || 0);
    const clinic = d.doctor_clinics?.[0]?.clinics;
    const city   = clinic?.cities?.name || 'Budapest';
    const clinicName = clinic?.name || '–';
    const init = d.name.replace('Dr. ', '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const col  = COLORS[i % COLORS.length];
    const avatar = d.photo_url
      ? `<img src="${d.photo_url}" alt="${d.name}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">${init}</div>`;

    return `
      <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid #e8edf8;border-radius:12px;padding:9px 12px">
        ${avatar}
        <div style="flex:1;min-width:0">
          <div style="font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.name}</div>
          <div style="font-size:11px;color:#6b7280">${clinicName}, ${city}</div>
          <div style="font-size:11px;color:#f59e0b;font-weight:700;margin-top:1px">★ ${rat.toFixed(1)} <span style="color:#9aa5c4;font-weight:400">(${d.review_count || 0} értékelés)</span></div>
        </div>
        <a href="orvos.html?id=${d.id}" style="background:#fff;border:1.5px solid #283897;color:#283897;border-radius:8px;padding:5px 11px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap">Részletek</a>
      </div>`;
  }).join('');

  return `
    <div style="margin-top:2px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;font-weight:700;color:#374151">Ajánlott szakorvosok a közelben</div>
        <a href="talalatok.html?specialty=${encodeURIComponent(specialty)}" style="font-size:12px;font-weight:700;color:#283897;text-decoration:none">További találatok →</a>
      </div>
      <div id="aiDocCards" style="display:flex;flex-direction:column;gap:6px">${cards}</div>
    </div>`;
}

function renderCtaButton(specialty) {
  return `
    <a href="talalatok.html?specialty=${encodeURIComponent(specialty)}" style="display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:13px;padding:13px 16px;text-decoration:none;color:#fff;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;box-shadow:0 4px 14px rgba(34,197,94,.3);margin-top:10px">
      Szakorvosok megtekintése →
    </a>`;
}

// ── Navbar ────────────────────────────────────────────────────
export function initNavbar() {
  const toggle   = $('#navToggle');
  const drawer   = $('#mobileDrawer');
  const mainNav  = $('#mainNav');
  const hero     = document.querySelector('.hero');

  // Mobile drawer
  if (toggle && drawer) {
    toggle.addEventListener('click', () => {
      drawer.classList.toggle('is-open');
      const isOpen = drawer.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !drawer.contains(e.target)) {
        drawer.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Sticky nav shrink on scroll
  if (mainNav && hero) {
    const observer = new IntersectionObserver(
      ([entry]) => mainNav.classList.toggle('navbar--scrolled', !entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(hero);
  }
}
