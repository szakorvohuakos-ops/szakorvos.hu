/**
 * app.js — Entry point
 * Szakorvos.hu
 *
 * Initialises all modules after DOM is ready.
 * Import order matters: ui → search → ai → app.
 */

'use strict';

import { $, setWidgetState, renderResult, initNavbar } from './ui.js';
import { analyseQuery, startTypewriter }                from './ai.js';
import { fetchTopDoctors, doClassicSearch, classicChip, initClassicSearch } from './search.js';

// ── BFCache: force reload on back-navigation ──────────────────
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initAIWidget();
  initClassicSearch();
  initPopularSpecChips();

  // Expose globals for inline onclick handlers (legacy HTML compatibility)
  // TODO: migrate onclick attrs to event delegation in future refactor
  window.sendChat    = sendChat;
  window.resetChat   = resetChat;
  window.useExample  = useExample;
  window.useTip      = useTip;
  window.doClassicSearch = doClassicSearch;
  window.classicChip     = classicChip;
  window.heroQuickSearch = (spec) => classicChip(spec);
});

// ── AI Widget ─────────────────────────────────────────────────
function initAIWidget() {
  const inputEl = $('#chatInput');
  if (!inputEl) return;

  startTypewriter(inputEl);

  // Enter key
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });
}

async function sendChat() {
  const inputEl  = $('#chatInput');
  const sendBtn  = $('#chatSendBtn');
  const query    = inputEl?.value.trim();

  if (!query) return;

  setWidgetState('loading');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const aiResult = await analyseQuery(query);

    // Fetch doctors if specialty found
    let doctors = [];
    if (aiResult.specialty && aiResult.specialty !== 'Sürgősségi') {
      try {
        doctors = await fetchTopDoctors(aiResult.specialty);
      } catch {
        // Non-critical — show result without doctors
      }
    }

    renderResult({ ...aiResult, doctors });

  } catch (err) {
    console.error('[AI] Error:', err);
    renderResult({ reply: 'Sajnálom, technikai hiba történt. Kérjük, próbálja újra!', specialty: null });
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function resetChat() {
  const inputEl = $('#chatInput');
  if (inputEl) inputEl.value = '';
  setWidgetState('idle');
  startTypewriter(inputEl);
}

function useExample(btn) {
  const inputEl = $('#chatInput');
  if (!inputEl || !btn) return;
  inputEl.value = btn.textContent.replace(/^[^\s]+\s/, '').trim();
  sendChat();
}

function useTip(el) {
  const inputEl = $('#chatInput');
  if (!inputEl || !el) return;
  inputEl.value = el.textContent.trim();
  sendChat();
}

// ── Popular spec chips ────────────────────────────────────────
function initPopularSpecChips() {
  document.querySelectorAll('[data-spec-chip]').forEach(btn => {
    btn.addEventListener('click', () => classicChip(btn.dataset.specChip));
  });
}
