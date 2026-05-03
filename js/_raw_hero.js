    document.addEventListener('DOMContentLoaded', function() {
      const chatInputEl = document.getElementById('chatInput');

      const ICONS = {
        'Kardiológia':'❤️','Neurológia':'🧠','Gasztroenterológia':'🫁',
        'Bőrgyógyászat':'🌿','Háziorvos':'⚕️','Ortopédia':'🦴',
        'Szemészet':'👁️','Nőgyógyászat':'💜','Fogászat':'🦷',
        'Pszichológia':'💭','Reumatológia':'🦴','Endokrinológia':'⚗️',
        'Urológia':'🔬','Fül-orr-gégészet':'👂','Pszichiátria':'🧩',
        'Belgyógyászat':'🩺','Gyermekgyógyászat':'👶','Allergológia':'🌸',
        'Onkológia':'🎗️','Sürgősségi':'🚨'
      };
      const COLORS=['#2f5ddd','#7c3aed','#0d9488','#dc2626','#ec4899','#ea580c','#059669'];
      const SUPABASE_URL='https://asgnkjmwzhbczpvetprh.supabase.co';
      const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZ25ram13emhiY3pwdmV0cHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzk1NDMsImV4cCI6MjA5MjgxNTU0M30.WCprcmT4oFq1iPfYeQvwGyDv5Vox6YZdn5efouN_Nc0';

      function useExample(btn) {
        const text = btn.textContent.replace(/^[^\s]+\s/, '').trim();
        chatInputEl.value = text;
        chatInputEl.focus();
        sendChat();
      }

      function resetChat() {
        document.getElementById('chatIdleState').style.display = '';
        document.getElementById('chatLoadingState').style.display = 'none';
        document.getElementById('chatResult').style.display = 'none';
        document.getElementById('chatResetBtn').style.display = 'none';
        chatInputEl.value = '';
        chatInputEl.focus();
      }

      async function sendChat() {
        const q = chatInputEl.value.trim();
        if (!q) return;
        document.getElementById('chatIdleState').style.display = 'none';
        document.getElementById('chatLoadingState').style.display = '';
        document.getElementById('chatResult').style.display = 'none';
        document.getElementById('chatSendBtn').disabled = true;
        try {
          const res = await fetch('https://asgnkjmwzhbczpvetprh.supabase.co/functions/v1/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: q }] })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          await showResult(data.reply, data.specialty, data.vizsgalat, data.bizonyossag, data.secondary, data.tertiary);
        } catch(e) {
          console.error('AI hiba:', e);
          await showResult('Sajnálom, technikai hiba történt. Kérjük, próbálja újra!', null, null, null, null, null);
        } finally {
          document.getElementById('chatSendBtn').disabled = false;
        }
      }

      async function showResult(reply, specialty, vizsgalat, bizonyossag, secondary, tertiary) {
        document.getElementById('chatLoadingState').style.display = 'none';
        document.getElementById('chatResetBtn').style.display = 'inline';

        const isSurgent = specialty === 'Sürgősségi';
        let html = '';

        if (isSurgent) {
          html += `<div style="background:#fee2e2;border:1.5px solid #fca5a5;border-radius:14px;padding:14px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="font-size:28px">🚨</div>
              <div>
                <div style="font-family:'Nunito',sans-serif;font-size:16px;font-weight:900;color:#b91c1c">Sürgős eset!</div>
                <div style="font-size:12px;color:#dc2626;margin-top:2px">${reply||'Azonnal hívja a mentőt!'}</div>
              </div>
            </div>
            <a href="tel:104" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#ef4444;border-radius:10px;padding:11px 16px;text-decoration:none;color:#fff;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;box-shadow:0 4px 14px rgba(239,68,68,.35)">
              📞 Mentőhívás: 104
            </a>
          </div>`;
        } else if (specialty) {
          const icon1 = ICONS[specialty] || '🏥';
          const pct = bizonyossag || 85;
          const barCol = pct>=90?'#22c55e':pct>=75?'#f59e0b':'#f97316';

          // ── Szakterület kártya bizonyossággal ──
          html += `<div style="background:linear-gradient(135deg,#f0fdf4,#f0f4ff);border:1.5px solid #bbf7d0;border-radius:16px;padding:14px;margin-bottom:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:42px;height:42px;border-radius:12px;background:#fff;border:1.5px solid #bbf7d0;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${icon1}</div>
                <div>
                  <div style="font-size:10px;font-weight:700;color:#9aa5c4;text-transform:uppercase;letter-spacing:.07em">Valószínű szakterület:</div>
                  <div style="font-family:'Nunito',sans-serif;font-size:17px;font-weight:900;color:#0f172a">${specialty}</div>
                  ${vizsgalat?`<div style="font-size:11px;color:#6b7280;margin-top:2px">Ajánlott vizsgálat: <strong style="color:#374151">${vizsgalat}</strong></div>`:''}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:10px;font-weight:700;color:#9aa5c4;text-transform:uppercase;letter-spacing:.07em">Bizonyság</div>
                <div style="font-family:'Nunito',sans-serif;font-size:22px;font-weight:900;color:${barCol}">${pct}%</div>
                <div style="width:72px;height:5px;background:#e8edf8;border-radius:99px;margin-top:3px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${barCol};border-radius:99px;transition:width .6s ease"></div>
                </div>
              </div>
            </div>
            ${reply?`<div style="font-size:12.5px;color:#4b5563;line-height:1.6;border-top:1px solid #bbf7d0;padding-top:9px">${reply}</div>`:''}
          </div>`;

          // ── Másodlagos chipek ──
          const extras = [secondary, tertiary].filter(Boolean);
          if (extras.length) {
            html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
              <span style="font-size:11px;color:#9aa5c4;font-weight:600">Egyéb lehetőség:</span>
              ${extras.map(s=>`<a href="talalatok.html?specialty=${encodeURIComponent(s)}" style="display:inline-flex;align-items:center;gap:4px;background:#fff;border:1.5px solid #e8edf8;border-radius:100px;padding:4px 11px;font-size:12px;font-weight:700;color:#283897;text-decoration:none">${ICONS[s]||'🏥'} ${s}</a>`).join('')}
            </div>`;
          }

          // ── Orvosok betöltése ──
          html += `<div id="aiDoctorList" style="margin-top:2px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-size:12px;font-weight:700;color:#374151">Ajánlott szakorvosok a közelben</div>
              <a href="talalatok.html?specialty=${encodeURIComponent(specialty)}" style="font-size:12px;font-weight:700;color:#283897;text-decoration:none">További találatok →</a>
            </div>
            <div id="aiDocCards" style="display:flex;flex-direction:column;gap:6px">
              <div style="text-align:center;padding:.75rem;color:#9aa5c4;font-size:13px">Orvosok betöltése…</div>
            </div>
          </div>`;

          // ── Nagy CTA gomb ──
          html += `<a href="talalatok.html?specialty=${encodeURIComponent(specialty)}" style="display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:13px;padding:13px 16px;text-decoration:none;color:#fff;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;box-shadow:0 4px 14px rgba(34,197,94,.3);margin-top:10px;transition:all .2s">
            Szakorvosok megtekintése →
          </a>`;
        } else if (reply) {
          html += `<div style="padding:.75rem 1rem;font-size:13.5px;color:#374151;line-height:1.65">${reply}</div>`;
        }

        const resultEl = document.getElementById('chatResult');
        resultEl.innerHTML = html;
        resultEl.style.display = '';

        // Orvosok betöltése Supabase-ből
        if (specialty && !isSurgent) {
          loadAIDoctors(specialty);
        }
      }

      async function loadAIDoctors(specialty) {
        try {
          // Szakterület neve → slug egyeztetés
          const specMap = {
            'Kardiológia':'kardiológus','Neurológia':'neurológus','Belgyógyászat':'belgyógyász',
            'Bőrgyógyászat':'bőrgyógyász','Gasztroenterológia':'gasztroenterológus',
            'Ortopédia':'ortopéd','Szemészet':'szemész','Fogászat':'fogász',
            'Nőgyógyászat':'nőgyógyász','Pszichológia':'pszichológus','Pszichiátria':'pszichiáter',
            'Reumatológia':'reumatológus','Endokrinológia':'endokrinológus','Urológia':'urológus',
            'Fül-orr-gégészet':'fül-orr-gégész','Gyermekgyógyászat':'gyermekgyógyász',
            'Allergológia':'allergológus','Onkológia':'onkológus','Háziorvos':'háziorvos','Belgyógyászat':'belgyógyász'
          };

          // Lekérés a specialties tábla neve alapján
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/doctors?select=id,name,rating,review_count,photo_url,experience_years,doctor_specialties(specialties(name)),doctor_clinics(consultation_fee,clinics(name,cities(name)))&is_active=eq.true&order=rating.desc&limit=3`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          );
          const doctors = await res.json();

          const container = document.getElementById('aiDocCards');
          if (!container) return;

          if (!doctors || !doctors.length) {
            container.innerHTML = '<div style="text-align:center;padding:.5rem;color:#9aa5c4;font-size:12px">Nem találtunk orvosokat</div>';
            return;
          }

          container.innerHTML = doctors.map((d, i) => {
            const rat = parseFloat(d.rating||0);
            const clinic = d.doctor_clinics?.[0]?.clinics;
            const city = clinic?.cities?.name || 'Budapest';
            const clinicName = clinic?.name || '–';
            const init = d.name.replace('Dr. ','').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            const col = COLORS[i % COLORS.length];
            const avatarHtml = d.photo_url
              ? `<img src="${d.photo_url}" alt="${d.name}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0">`
              : `<div style="width:40px;height:40px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">${init}</div>`;

            return `<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid #e8edf8;border-radius:12px;padding:9px 12px">
              ${avatarHtml}
              <div style="flex:1;min-width:0">
                <div style="font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.name}</div>
                <div style="font-size:11px;color:#6b7280">${clinicName}, ${city}</div>
                <div style="font-size:11px;color:#f59e0b;font-weight:700;margin-top:1px">★ ${rat.toFixed(1)} <span style="color:#9aa5c4;font-weight:400">(${d.review_count||0} értékelés)</span></div>
              </div>
              <a href="orvos.html?id=${d.id}" style="background:#fff;border:1.5px solid #283897;color:#283897;border-radius:8px;padding:5px 11px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;transition:all .2s"
                onmouseover="this.style.background='#283897';this.style.color='#fff'"
                onmouseout="this.style.background='#fff';this.style.color='#283897'">
                Részletek
              </a>
            </div>`;
          }).join('');
        } catch(e) {
          const container = document.getElementById('aiDocCards');
          if (container) container.innerHTML = '';
          console.error('Orvos betöltési hiba:', e);
        }
      }

      chatInputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

      // Globális elérhetőség onclick attribútumokhoz
      // Typewriter animáció az input placeholder-hez
      const tips = [
        'Anyajegyszűrés Győrben…',
        'Kardiológus Debrecenben…',
        'Fáj a térdem lépcsőzéskor…',
        'Mellkasi szorítást érzek terhelésre…',
        'Három napja fáj a fejem és szédülök…',
        'Bőrkiütés jelent meg a karomra…',
        'Látásromlás az utóbbi hetekben…',
      ];
      let tipIdx = 0, charIdx = 0, typing = true, pauseTimer = null;

      function typeTip() {
        const input = document.getElementById('chatInput');
        if (!input || document.activeElement === input) return;

        const current = tips[tipIdx];

        if (typing) {
          charIdx++;
          input.placeholder = current.slice(0, charIdx);
          if (charIdx < current.length) {
            setTimeout(typeTip, 55 + Math.random() * 40);
          } else {
            typing = false;
            setTimeout(typeTip, 1800);
          }
        } else {
          charIdx--;
          input.placeholder = current.slice(0, charIdx);
          if (charIdx > 0) {
            setTimeout(typeTip, 28);
          } else {
            typing = true;
            tipIdx = (tipIdx + 1) % tips.length;
            setTimeout(typeTip, 400);
          }
        }
      }

      setTimeout(typeTip, 1200);
      window.useExample = useExample;
      window.resetChat = resetChat;
      window.useTip = function(el) {
        chatInputEl.value = el.textContent.trim();
        chatInputEl.focus();
        sendChat();
      };

    }); // DOMContentLoaded
    </script>

  </div>

<!-- ── NÉPSZERŰ SZAKTERÜLETEK ── -->
<section class="popular-specs-section">
  <div class="popular-specs-inner">
    <div class="popular-specs-header">
      <h2 class="popular-specs-title">Népszerű szakterületek</h2>
      <p class="popular-specs-sub">Kattintson egy szakterületre és találja meg a legjobb szakorvost</p>
    </div>
    <div class="popular-specs-grid">
      <button class="popular-spec-card" onclick="heroQuickSearch('Kardiológus')">
        <div class="popular-spec-icon" style="background:#fff0f0;">❤️</div>
        <span class="popular-spec-name">Kardiológus</span>
        <span class="popular-spec-sub">Szív- és érrendszer</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Neurológus')">
        <div class="popular-spec-icon" style="background:#f3f0ff;">🧠</div>
        <span class="popular-spec-name">Neurológus</span>
        <span class="popular-spec-sub">Idegrendszer</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Bőrgyógyász')">
        <div class="popular-spec-icon" style="background:#f0fdf4;">🌿</div>
        <span class="popular-spec-name">Bőrgyógyász</span>
        <span class="popular-spec-sub">Bőr- és hajproblémák</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Nőgyógyász')">
        <div class="popular-spec-icon" style="background:#fdf0ff;">💜</div>
        <span class="popular-spec-name">Nőgyógyász</span>
        <span class="popular-spec-sub">Nőgyógyászat</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Ortopéd')">
        <div class="popular-spec-icon" style="background:#fff7ed;">🦴</div>
        <span class="popular-spec-name">Ortopéd</span>
        <span class="popular-spec-sub">Csont- és ízületproblémák</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Szemész')">
        <div class="popular-spec-icon" style="background:#f0fbff;">👁️</div>
        <span class="popular-spec-name">Szemész</span>
        <span class="popular-spec-sub">Szembetegségek</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Fogorvos')">
        <div class="popular-spec-icon" style="background:#f0f9ff;">🦷</div>
        <span class="popular-spec-name">Fogorvos</span>
        <span class="popular-spec-sub">Fogászat</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Gyermekgyógyász')">
        <div class="popular-spec-icon" style="background:#f0fdf4;">👶</div>
        <span class="popular-spec-name">Gyermekgyógyász</span>
        <span class="popular-spec-sub">Gyermekek egészsége</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Pszichiáter')">
        <div class="popular-spec-icon" style="background:#fdf4ff;">🧩</div>
        <span class="popular-spec-name">Pszichiáter</span>
        <span class="popular-spec-sub">Mentális egészség</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Belgyógyász')">
        <div class="popular-spec-icon" style="background:#f0f4ff;">🩺</div>
        <span class="popular-spec-name">Belgyógyász</span>
        <span class="popular-spec-sub">Általános belgyógyászat</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Urológus')">
        <div class="popular-spec-icon" style="background:#f0f9ff;">🔬</div>
        <span class="popular-spec-name">Urológus</span>
        <span class="popular-spec-sub">Húgyúti betegségek</span>
      </button>
      <button class="popular-spec-card" onclick="heroQuickSearch('Fül-orr-gégész')">
        <div class="popular-spec-icon" style="background:#fffbf0;">👂</div>
        <span class="popular-spec-name">Fül-orr-gégész</span>
        <span class="popular-spec-sub">Fül, orr, torok</span>
      </button>
    </div>
  </div>
</section>

<!-- ── KLASSZIKUS KERESŐ SZEKCIÓ ── -->
<section class="classic-search-section">
  <div class="classic-search-inner">
    <div class="classic-search-header">
      <div class="classic-search-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Hagyományos keresés
      </div>
      <h2 class="classic-search-title">Keresse meg a megfelelő szakorvost</h2>
      <p class="classic-search-sub">Szűrjön szakterület, város vagy orvos neve alapján – egyszerűen és gyorsan</p>
    </div>
    <div class="classic-search-box">
      <div class="classic-search-row">
        <div class="classic-field">
          <div class="classic-field-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#283897" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="classic-field-body">
            <div class="classic-field-label">Szakterület / Orvos neve</div>
            <input type="text" id="classicSpec" class="classic-field-input" placeholder="pl. Kardiológus, Dr. Kiss János, EKG…"
              autocomplete="off"
              oninput="smartSearch('classicSpec','classicDropdown')"
              onfocus="smartFocus('classicSpec','classicDropdown')"
              onkeydown="smartKeydown(event,'classicSpec','classicDropdown')">
            <div class="freetext-dropdown" id="classicDropdown"></div>
          </div>
        </div>
        <div class="classic-divider"></div>
        <div class="classic-field">
          <div class="classic-field-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#283897" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div class="classic-field-body">
            <div class="classic-field-label">Helyszín</div>
            <input type="text" id="classicCity" class="classic-field-input" placeholder="Város, pl. Budapest…"
              onkeydown="if(event.key==='Enter') doClassicSearch()">
          </div>
        </div>
        <button class="classic-search-btn" onclick="doClassicSearch()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Keresés
        </button>
      </div>
      <!-- Gyors chip-ek -->
      <div class="classic-chips">
        <span class="classic-chip-label">Gyors keresés:</span>
        <button class="classic-chip" onclick="classicChip('Kardiológus')">❤️ Kardiológus</button>
        <button class="classic-chip" onclick="classicChip('Bőrgyógyász')">🌿 Bőrgyógyász</button>
        <button class="classic-chip" onclick="classicChip('Neurológus')">🧠 Neurológus</button>
        <button class="classic-chip" onclick="classicChip('Fogász')">🦷 Fogász</button>
        <button class="classic-chip" onclick="classicChip('Nőgyógyász')">💜 Nőgyógyász</button>
        <button class="classic-chip" onclick="classicChip('Ortopéd')">🦴 Ortopéd</button>
      </div>
    </div>
  </div>
</section>

<!-- ── VÉLEMÉNYEK ── -->
<section class="reviews-section">
  <div class="reviews-inner">
    <div class="reviews-header">
      <h2 class="reviews-title">Bíznak bennünk</h2>
      <p class="reviews-sub">Több ezer elégedett páciens tapasztalata.</p>
    </div>
    <div class="reviews-grid">
      <div class="review-card">
        <div class="review-stars">★★★★★</div>
        <p class="review-text">„Nagyon gyorsan segített megtalálni a megfelelő szakorvost. Az AI pontosan értette a problémámat."</p>
        <div class="review-footer">
          <div class="review-avatar" style="background:#dcfce7;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <div class="review-name">Kovács Anna</div>
            <div class="review-city">Budapest</div>
          </div>
        </div>
      </div>
      <div class="review-card">
        <div class="review-stars">★★★★★</div>
        <p class="review-text">„Végre egy oldal, ahol tényleg könnyű megtalálni a legjobb szakembereket. Csak ajánlani tudom!"</p>
        <div class="review-footer">
          <div class="review-avatar" style="background:#dbeafe;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <div class="review-name">Nagy Péter</div>
            <div class="review-city">Debrecen</div>
          </div>
        </div>
      </div>
      <div class="review-card">
        <div class="review-stars">★★★★★</div>
        <p class="review-text">„Időt és energiát spóroltam vele. Pár perc alatt megkaptam, amit kerestem."</p>
        <div class="review-footer">
          <div class="review-avatar" style="background:#fce7f3;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#db2777" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <div class="review-name">Szabó Zsófia</div>
            <div class="review-city">Szeged</div>
          </div>
        </div>
      </div>
    </div>
    <div class="reviews-dots">
      <span class="reviews-dot active"></span>
      <span class="reviews-dot"></span>
      <span class="reviews-dot"></span>
    </div>
  </div>
</section>

<!-- ── FAQ ── -->
<section class="faq-section-new">
  <div class="faq-inner">
    <div class="faq-header" data-anim="fade-up">
      <div class="section-eyebrow">Gyakori kérdések</div>
      <h2 class="section-title">Mire gondol leggyakrabban?</h2>
    </div>
    <div class="faq-list" data-anim="fade-up" style="transition-delay:0.15s">
      <details class="faq-item">
        <summary class="faq-q">Ingyenes a szolgáltatás pácienseknek?<span class="faq-arrow">›</span></summary>
        <div class="faq-a">Igen, a Szakorvos.hu teljesen ingyenes a betegek számára. Az időpontfoglalás, az AI asszisztens és az orvoskeresés is díjmentes.</div>
      </details>
      <details class="faq-item">
        <summary class="faq-q">Hogyan működik az AI orvosi asszisztens?<span class="faq-arrow">›</span></summary>
        <div class="faq-a">Az AI asszisztens a leírt tünetei és panaszai alapján azonosítja a legmegfelelőbb szakterületet és konkrét szakorvosokat ajánl az Ön helyszíne közelében.</div>
      </details>
      <details class="faq-item">
        <summary class="faq-q">Módosíthatom vagy lemondhatom az időpontomat?<span class="faq-arrow">›</span></summary>
        <div class="faq-a">Igen, a foglalt időpontok a fiókjából bármikor módosíthatók vagy lemondhatók, az orvos által meghatározott lemondási feltételek figyelembevételével.</div>
      </details>
      <details class="faq-item">
        <summary class="faq-q">Milyen biztosítókat fogadnak el az orvosok?<span class="faq-arrow">›</span></summary>
        <div class="faq-a">Ezt minden orvos profiljánál feltüntetjük. A legtöbb orvos TAJ kártyát és magánfizetőt is elfogad, sokan pedig SIGNAL IDUNA, Generali, Allianz és UNIQA biztosítóval is szerződnek.</div>
      </details>
      <details class="faq-item">
        <summary class="faq-q">Orvosként hogyan csatlakozhatok?<span class="faq-arrow">›</span></summary>
        <div class="faq-a">A „Legyen Ön is a partnerünk" gombra kattintva regisztrálhat. Az alapprofil ingyenesen hozható létre, és azonnal megjelenik a keresési találatokban.</div>
      </details>
    </div>
  </div>
</section>

<!-- ── FOOTER ── -->
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-brand">
        <div class="footer-logo">Szakorvos<span>.hu</span></div>
        <p class="footer-tagline">Az okos orvoskeresés platform</p>
        <div class="footer-social">
          <a href="#" class="footer-social-btn">f</a>
          <a href="#" class="footer-social-btn">in</a>
          <a href="#" class="footer-social-btn">ig</a>
        </div>
      </div>
      <div class="footer-links">
        <div class="footer-col">
          <div class="footer-col-title">Platform</div>
          <a href="#">Orvoskeresés</a>
          <a href="#">AI asszisztens</a>
          <a href="#">Időpontfoglalás</a>
          <a href="#">Szakterületek</a>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Partnereknek</div>
          <a href="#">Orvosoknak</a>
          <a href="#">Klinikáknak</a>
          <a href="#">Árak</a>
          <a href="#">Regisztráció</a>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Cég</div>
          <a href="#">Rólunk</a>
          <a href="#">Kapcsolat</a>
          <a href="#">Blog</a>
          <a href="#">Karrier</a>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Jogi</div>
          <a href="#">Adatvédelem</a>
          <a href="#">ÁSZF</a>
          <a href="#">Cookie</a>
          <a href="#">GDPR</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="footer-copy">© 2025 Szakorvos.hu — Minden jog fenntartva</div>
      <div class="footer-badge">🇭🇺 Magyar fejlesztés</div>
    </div>
  </div>
</footer>

