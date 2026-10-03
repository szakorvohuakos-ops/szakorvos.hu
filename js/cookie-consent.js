/* ============================================================
   Szakorvos.hu — Süti-banner + Google Analytics (Consent Mode)
   Közös fájl, minden oldal betölti: <script src="/js/cookie-consent.js" defer></script>
   GDPR / ePrivacy: GA CSAK a felhasználó kifejezett elfogadása után tölt be és mér.
   ============================================================ */
(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // KONFIGURÁCIÓ
  // ──────────────────────────────────────────────
  var GA_ID = 'G-XXXXXXXXXX';            // <<< IDE jön a te Measurement ID-d (G-...)
  var STORAGE_KEY = 'szk_cookie_consent'; // localStorage kulcs
  var CONSENT_VERSION = '3';              // ha változik a süti-szabályzat, emeld → újra megkérdez

  // ──────────────────────────────────────────────
  // Állapot beolvasása
  // ──────────────────────────────────────────────
  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj.v !== CONSENT_VERSION) return null; // elavult verzió → újrakérdez
      return obj;
    } catch (e) { return null; }
  }
  var state = { analytics: false, maps: false };
  function saveConsent(analytics, maps) {
    state.analytics = !!analytics; state.maps = !!maps;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: CONSENT_VERSION, analytics: state.analytics, maps: state.maps, ts: Date.now()
      }));
    } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('szk:consent', { detail: { analytics: state.analytics, maps: state.maps } })); } catch (e) {}
  }

  // ──────────────────────────────────────────────
  // Google Analytics betöltése (csak elfogadáskor)
  // ──────────────────────────────────────────────
  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded || !GA_ID || GA_ID.indexOf('G-') !== 0 || GA_ID === 'G-XXXXXXXXXX') return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // IP-anonimizálás bekapcsolva (GDPR-barátabb)
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }

  // ──────────────────────────────────────────────
  // Banner DOM + stílus
  // ──────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('szk-cc-style')) return;
    var css = ''
      + '.szk-cc{position:fixed;left:24px;bottom:24px;z-index:9999;width:400px;max-width:calc(100% - 32px);background:#fff;border:1px solid #E3E9F4;border-radius:18px;box-shadow:0 2px 6px rgba(11,22,51,.06),0 24px 60px -18px rgba(29,53,116,.38);padding:18px 18px 16px;font-family:Manrope,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#2B3752;opacity:0;transform:translateY(18px);pointer-events:none;transition:opacity .3s ease,transform .35s cubic-bezier(.2,.8,.2,1)}'
      + '.szk-cc.show{opacity:1;transform:none;pointer-events:auto}'
      + '.szk-cc *{box-sizing:border-box}'
      + '.szk-cc-hd{display:flex;align-items:center;gap:11px;margin:0 0 8px}'
      + '.szk-cc-ic{width:36px;height:36px;border-radius:11px;background:#FFF6D9;color:#9A7108;display:grid;place-items:center;flex:none}'
      + '.szk-cc-ic svg{width:20px;height:20px}'
      + '.szk-cc-title{margin:0;font-size:15.5px;font-weight:800;color:#0B1633;letter-spacing:-.01em}'
      + '.szk-cc-text{font-size:13px;line-height:1.55;color:#5A6580;margin:0 0 14px}'
      + '.szk-cc-text a{color:#1D4992;font-weight:700;text-decoration:underline;text-underline-offset:2px}'
      + '.szk-cc-set{display:flex;flex-direction:column;gap:8px;margin:0 0 14px}.szk-cc-set[hidden]{display:none}'
      + '.szk-cc-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #E3E9F4;border-radius:12px;background:#F7F9FD;cursor:pointer}'
      + '.szk-cc-row b{display:block;font-size:13px;color:#0B1633}'
      + '.szk-cc-row small{display:block;font-size:11.5px;color:#8A93A8;margin-top:1px;line-height:1.4}'
      + '.szk-cc-row>span:first-child{flex:1;min-width:0}'
      + '.szk-cc-sw{position:relative;width:38px;height:22px;flex:none}'
      + '.szk-cc-sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}'
      + '.szk-cc-sw i{position:absolute;inset:0;border-radius:99px;background:#CBD3E2;transition:background .2s}'
      + '.szk-cc-sw i::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(11,22,51,.3);transition:transform .2s}'
      + '.szk-cc-sw input:checked+i{background:#467A28}'
      + '.szk-cc-sw input:checked+i::after{transform:translateX(16px)}'
      + '.szk-cc-sw input:disabled+i{opacity:.55}'
      + '.szk-cc-sw input:focus-visible+i{outline:2px solid #1D4992;outline-offset:2px}'
      + '.szk-cc-btns{display:flex;align-items:center;gap:8px}'
      + '.szk-cc-btn{font-family:inherit;font-size:13px;font-weight:700;height:38px;padding:0 14px;border-radius:10px;cursor:pointer;border:1px solid transparent;transition:background .15s,border-color .15s,color .15s;white-space:nowrap}'
      + '.szk-cc-more{background:none;border:0;color:#1D4992;padding:0 4px;margin-right:auto;text-decoration:underline;text-underline-offset:3px}'
      + '.szk-cc-reject{background:#fff;color:#2B3752;border-color:#DCE3F0}'
      + '.szk-cc-reject:hover{border-color:#9DB0D9;color:#1D4992}'
      + '.szk-cc-accept{background:#1D4992;color:#fff;box-shadow:0 8px 18px -10px rgba(29,73,146,.9)}'
      + '.szk-cc-accept:hover{background:#163A78}'
      + '.szk-cc-x{position:absolute;top:10px;right:10px;width:28px;height:28px;border:0;border-radius:8px;background:none;color:#8A93A8;font-size:18px;line-height:1;cursor:pointer}'
      + '.szk-cc-x:hover{background:#F1F4FA;color:#2B3752}'
      + '@media(max-width:560px){.szk-cc{left:0;right:0;bottom:0;width:auto;max-width:none;border-radius:20px 20px 0 0;border-bottom:0;padding:16px 16px calc(14px + env(safe-area-inset-bottom));transform:translateY(100%)}.szk-cc.show{transform:none}.szk-cc-btns{flex-wrap:wrap}.szk-cc-more{order:3;width:100%;margin:4px 0 0;text-align:center;height:30px}.szk-cc-reject,.szk-cc-accept{flex:1}}';
    var st = document.createElement('style');
    st.id = 'szk-cc-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function buildBanner() {
    injectStyles();
    var wrap = document.createElement('div');
    wrap.className = 'szk-cc';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-label', 'Süti beállítások');
    wrap.innerHTML =
        '<div class="szk-cc-hd"><span class="szk-cc-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/></svg></span>'
      + '<p class="szk-cc-title">Sütiket használunk</p></div>'
      + '<p class="szk-cc-text">Az oldal működéséhez szükséges sütiket mindig használjuk. Anonim látogatottsági statisztikát (Google Analytics) csak az Ön hozzájárulásával mérünk. <a href="/adatvedelem">Adatvédelem</a></p>'
      + '<div class="szk-cc-set" hidden>'
      + '<label class="szk-cc-row"><span><b>Szükséges sütik</b><small>Az oldal alapvető működéséhez – mindig aktív</small></span><span class="szk-cc-sw"><input type="checkbox" checked disabled aria-label="Szükséges sütik"><i></i></span></label>'
      + '<label class="szk-cc-row"><span><b>Statisztika</b><small>Google Analytics, anonimizált IP-címmel</small></span><span class="szk-cc-sw"><input type="checkbox" class="szk-cc-an" aria-label="Statisztika"><i></i></span></label>'
      + '</div>'
      + '<div class="szk-cc-btns">'
      + '<button class="szk-cc-btn szk-cc-more" type="button">Beállítások</button>'
      + '<button class="szk-cc-btn szk-cc-reject" type="button">Csak a szükségesek</button>'
      + '<button class="szk-cc-btn szk-cc-accept" type="button">Elfogadom</button>'
      + '</div>';
    document.body.appendChild(wrap);

    var acc = wrap.querySelector('.szk-cc-accept');
    var rej = wrap.querySelector('.szk-cc-reject');
    var more = wrap.querySelector('.szk-cc-more');
    var set = wrap.querySelector('.szk-cc-set');
    var an = wrap.querySelector('.szk-cc-an');
    an.checked = !!state.analytics;
    acc.addEventListener('click', function () {
      if (!set.hidden) { saveConsent(an.checked, true); if (an.checked) loadGA(); }
      else { saveConsent(true, true); loadGA(); }
      hide(wrap);
    });
    rej.addEventListener('click', function () { saveConsent(false, true); hide(wrap); });
    more.addEventListener('click', function () {
      set.hidden = !set.hidden;
      more.textContent = set.hidden ? 'Beállítások' : 'Kevesebb';
      acc.textContent = set.hidden ? 'Elfogadom' : 'Mentés';
    });

    requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('show'); }); });
    return wrap;
  }
  function hide(el) {
    el.classList.remove('show');
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 400);
  }

  // ──────────────────────────────────────────────
  // Nyilvános API: süti-beállítások újranyitása
  // (pl. láblécben: <a href="#" onclick="szkCookieSettings();return false">Süti beállítások</a>)
  // ──────────────────────────────────────────────
  window.szkCookieSettings = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    if (!document.querySelector('.szk-cc')) buildBanner();
  };

  // ──────────────────────────────────────────────
  // Hozzájárulás-API (térkép stb.): szkConsent.has('maps'), szkConsent.maps('#map')
  // ──────────────────────────────────────────────
  window.szkConsent = {
    has: function (k) { return k === 'maps' ? true : !!state[k]; },
    maps: function (sel) {
      return new Promise(function (resolve) {
        return resolve(); /* térkép automatikusan (2026.10) */
        var box = sel && document.querySelector(sel);
        var ph = null;
        if (box) {
          ph = document.createElement('div');
          ph.style.cssText = 'position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;text-align:center;background:#EEF2FA;color:#1a1f36;font:600 14px Manrope,sans-serif';
          ph.innerHTML = '<div>A térkép a Google szolgáltatása, betöltéséhez hozzájárulás kell.</div><button type="button" style="font:600 14px Manrope,sans-serif;padding:10px 18px;border:0;border-radius:10px;background:#2A4A9C;color:#fff;cursor:pointer">Térkép betöltése</button>';
          if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
          box.appendChild(ph);
          ph.querySelector('button').addEventListener('click', function () { saveConsent(state.analytics, true); });
        }
        window.addEventListener('szk:consent', function h(e) {
          if (e.detail && e.detail.maps) { window.removeEventListener('szk:consent', h); if (ph && ph.parentNode) ph.parentNode.removeChild(ph); resolve(); }
        });
      });
    }
  };

  // ──────────────────────────────────────────────
  // Indítás
  // ──────────────────────────────────────────────
  function init() {
    var c = readConsent();
    if (c) { state.analytics = !!c.analytics; state.maps = !!c.maps; }
    if (c === null) {
      buildBanner();            // még nem döntött → banner
    } else if (c.analytics) {
      loadGA();                 // korábban elfogadta → GA betölt
    }
    // ha c.analytics === false → nem töltünk semmit
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
