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
  var CONSENT_VERSION = '1';              // ha változik a süti-szabályzat, emeld → újra megkérdez

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
  function saveConsent(analytics) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: CONSENT_VERSION, analytics: !!analytics, ts: Date.now()
      }));
    } catch (e) {}
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
      + '.szk-cc{position:fixed;left:50%;bottom:20px;transform:translateX(-50%) translateY(16px);z-index:9999;width:calc(100% - 32px);max-width:680px;background:#fff;border:1px solid #e4e8f0;border-radius:16px;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 12px 40px rgba(17,50,147,.18);padding:20px 22px;font-family:Inter,system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .35s,transform .35s cubic-bezier(.34,1.4,.64,1)}'
      + '.szk-cc.show{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}'
      + '.szk-cc-title{font-size:15px;font-weight:700;color:#113293;margin:0 0 6px;display:flex;align-items:center;gap:8px}'
      + '.szk-cc-title svg{flex-shrink:0;color:#2C9650}'
      + '.szk-cc-text{font-size:13px;line-height:1.55;color:#52617a;margin:0 0 14px}'
      + '.szk-cc-text a{color:#264ACA;font-weight:600;text-decoration:underline}'
      + '.szk-cc-btns{display:flex;gap:10px;flex-wrap:wrap}'
      + '.szk-cc-btn{flex:1;min-width:120px;font-family:inherit;font-size:13.5px;font-weight:600;padding:11px 16px;border-radius:10px;cursor:pointer;border:1px solid transparent;transition:all .15s}'
      + '.szk-cc-accept{background:linear-gradient(135deg,#2C9650,#35B26B);color:#fff;box-shadow:0 4px 14px rgba(44,150,80,.3)}'
      + '.szk-cc-accept:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(44,150,80,.42)}'
      + '.szk-cc-reject{background:#fff;color:#52617a;border-color:#dce3ea}'
      + '.szk-cc-reject:hover{border-color:#94a3b8;color:#1a1f36}'
      + '@media(max-width:520px){.szk-cc{padding:16px 16px 18px}.szk-cc-btn{min-width:0}}';
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
    wrap.setAttribute('aria-label', 'Süti beállítások');
    wrap.innerHTML =
      '<div class="szk-cc-title">'
      + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/></svg>'
      + 'Sütiket használunk</div>'
      + '<p class="szk-cc-text">A weboldal működéséhez szükséges sütiket mindig használunk. Az <strong>anonimizált látogatottsági statisztikához</strong> (Google Analytics) az Ön hozzájárulását kérjük. Részletek az <a href="/adatvedelem.html">Adatvédelmi szabályzatban</a>.</p>'
      + '<div class="szk-cc-btns">'
      + '<button class="szk-cc-btn szk-cc-reject" type="button">Csak a szükségeseket</button>'
      + '<button class="szk-cc-btn szk-cc-accept" type="button">Elfogadom</button>'
      + '</div>';
    document.body.appendChild(wrap);

    var acc = wrap.querySelector('.szk-cc-accept');
    var rej = wrap.querySelector('.szk-cc-reject');
    acc.addEventListener('click', function () { saveConsent(true); loadGA(); hide(wrap); });
    rej.addEventListener('click', function () { saveConsent(false); hide(wrap); });

    requestAnimationFrame(function () { wrap.classList.add('show'); });
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
  // Indítás
  // ──────────────────────────────────────────────
  function init() {
    var c = readConsent();
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
