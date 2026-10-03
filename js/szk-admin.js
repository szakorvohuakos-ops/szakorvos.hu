/* ==========================================================================
   szakorvos.hu – orvos- és klinika-admin közös segédek (2026.10)
   window.szkAdmin: guard, tabs, toast, dirty/savebar, lista-szerkesztő, modál, feltöltés, kérések
   ========================================================================== */
(function(){
  'use strict';
  var $=function(id){ return document.getElementById(id); };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function initials(n){ var w=String(n||'').replace(/^(dr\.?|prof\.?)\s+/gi,'').replace(/^(dr\.?|prof\.?)\s+/gi,'').trim().split(/\s+/).filter(Boolean); return ((w[0]||'')[0]||'').toUpperCase()+((w[1]||'')[0]||'').toUpperCase(); }
  function arr(v){ if(!v) return []; if(Array.isArray(v)) return v.map(function(x){ return String(x).trim(); }).filter(Boolean); return String(v).split(/\n|;/).map(function(x){ return x.trim(); }).filter(Boolean); }
  function num(n){ return (Number(n)||0).toLocaleString('hu-HU'); }

  /* ---------- értesítés ---------- */
  var tt;
  function toast(msg,kind){ var t=$('admToast'); if(!t) return; t.textContent=msg; t.style.background=kind==='err'?'#9B2C1F':(kind==='ok'?'#2E5A18':''); t.classList.add('on'); clearTimeout(tt); tt=setTimeout(function(){ t.classList.remove('on'); },kind==='err'?6000:3200); }

  /* ---------- belépés-ellenőrzés ---------- */
  async function guard(role){
    var gate=$('admGate');
    function show(title,text,btns){ gate.innerHTML='<div><h1>'+esc(title)+'</h1><p>'+text+'</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'+(btns||'')+'</div></div>'; }
    try{
      var s=(await db.auth.getSession()).data.session;
      if(!s){ location.replace('/login?redirect='+encodeURIComponent(location.pathname+location.hash)); return null; }
      var pr=(await db.from('user_profiles').select('role,full_name,email').eq('id',s.user.id).maybeSingle()).data;
      if(pr&&pr.role==='superadmin'){ location.replace('/admin.html'); return null; }
      if(!pr||pr.role!==role){
        var other=pr&&pr.role==='doctor_admin'?'<a class="btn p" href="/admin-orvos.html">Orvos admin</a>':(pr&&pr.role==='clinic_admin'?'<a class="btn p" href="/admin-klinika.html">Klinika admin</a>':'');
        show('Ehhez az oldalhoz nincs jogosultsága',(role==='doctor_admin'?'Ez az orvosok kezelőfelülete.':'Ez a klinikák kezelőfelülete.')+' Ha partnerként szeretne csatlakozni, nézze meg a Partnerprogramot, vagy írjon nekünk.',other+'<a class="btn s" href="/register">Partnerprogram</a><button class="btn s" type="button" onclick="szkAdmin.logout()">Kijelentkezés</button>');
        return null;
      }
      document.querySelectorAll('#sknav a.nv-user span, #sknav a.user span').forEach(function(x){ x.textContent='Saját fiók'; });
      document.querySelectorAll('#sknav a.nv-user, #sknav a.user').forEach(function(x){ x.href=location.pathname; });
      document.querySelectorAll('#nv-drawer a[href="/login"], #sknav .nv-pan a[href="/login"], #mobnav a[href="/login"]').forEach(function(x){ x.textContent='Kijelentkezés'; x.href='#'; x.addEventListener('click',function(e){ e.preventDefault(); logout(); }); });
      return {session:s,user:s.user,profile:pr};
    }catch(e){ show('Nem sikerült betölteni','Hálózati hiba történt. Próbálja újra pár másodperc múlva.','<button class="btn p" type="button" onclick="location.reload()">Újrapróbálás</button>'); return null; }
  }
  async function logout(){ if(window.SZK_DEMO){ location.href='/register'; return; } try{ await db.auth.signOut(); }catch(e){} location.replace('/login'); }

  /* ---------- fülek (#hash) ---------- */
  var TITLES={}, onTab=null;
  function tabs(titles,cb){ TITLES=titles; onTab=cb;
    document.querySelectorAll('.adm-nav [data-tab]').forEach(function(b){ b.addEventListener('click',function(){ go(b.dataset.tab); }); });
    window.addEventListener('hashchange',function(){ go(location.hash.slice(1),true); });
    go(location.hash.slice(1)||Object.keys(titles)[0],true);
  }
  function go(t,fromHash){ if(!TITLES[t]) t=Object.keys(TITLES)[0];
    document.querySelectorAll('.adm-pane').forEach(function(p){ p.classList.toggle('on',p.dataset.pane===t); });
    document.querySelectorAll('.adm-nav [data-tab]').forEach(function(b){ b.classList.toggle('on',b.dataset.tab===t); b.setAttribute('aria-current',b.dataset.tab===t?'page':'false'); });
    if(!fromHash&&location.hash.slice(1)!==t) history.replaceState(null,'','#'+t);
    document.title=TITLES[t]+' | '+(document.body.dataset.title||'Admin')+' – Szakorvos.hu';
    if(!fromHash) window.scrollTo({top:0,behavior:'smooth'});
    if(onTab) onTab(t); }
  function jump(tab,fieldId){ go(tab); setTimeout(function(){ var el=$(fieldId); if(!el) return; var y=el.getBoundingClientRect().top+scrollY-110; scrollTo({top:y,behavior:'smooth'}); el.classList.add('flash'); var f=el.matches('input,textarea,select')?el:el.querySelector('input,textarea,select'); if(f) setTimeout(function(){ try{ f.focus({preventScroll:true}); }catch(e){} },400); setTimeout(function(){ el.classList.remove('flash'); },2200); },80); }

  /* ---------- nem mentett módosítások ---------- */
  var dirty=false, saveFn=null, resetFn=null;
  function track(root,onSave,onReset){ saveFn=onSave; resetFn=onReset;
    root.addEventListener('input',function(e){ if(e.target.closest('[data-nodirty]')) return; setDirty(true); });
    root.addEventListener('change',function(e){ if(e.target.closest('[data-nodirty]')) return; setDirty(true); });
    $('sbSave').addEventListener('click',function(){ if(saveFn) saveFn(); });
    $('sbReset').addEventListener('click',function(){ if(resetFn) resetFn(); setDirty(false); });
    window.addEventListener('beforeunload',function(e){ if(dirty){ e.preventDefault(); e.returnValue=''; } });
  }
  function setDirty(v){ dirty=!!v; var b=$('saveBar'); if(b) b.classList.toggle('on',dirty); }
  function busy(btn,on,label){ if(!btn) return; if(on){ btn._t=btn.innerHTML; btn.disabled=true; btn.innerHTML='<span class="spin"></span>'+(label||'Mentés…'); } else { btn.disabled=false; if(btn._t) btn.innerHTML=btn._t; } }

  /* ---------- lista-szerkesztő ---------- */
  function listEditor(el,items,placeholder){
    var data=arr(items).slice();
    function draw(){ el.innerHTML='<div class="lst">'+(data.length?data.map(function(x,i){ return '<div class="it"><span>'+esc(x)+'</span><button type="button" data-del="'+i+'" aria-label="Törlés">×</button></div>'; }).join(''):'<div class="lst-empty">Még nincs megadva.</div>')+'</div>'+
      '<div class="lst-add"><input type="text" maxlength="300" placeholder="'+esc(placeholder||'Új tétel…')+'" aria-label="'+esc(placeholder||'Új tétel')+'"><button class="btn s sm" type="button">Hozzáadás</button></div>'; }
    function add(){ var inp=el.querySelector('.lst-add input'); var v=inp.value.trim(); if(!v) return; data.push(v); draw(); setDirty(true); el.querySelector('.lst-add input').focus(); }
    el.addEventListener('click',function(e){ var d=e.target.closest('[data-del]'); if(d){ data.splice(+d.dataset.del,1); draw(); setDirty(true); return; } if(e.target.closest('.lst-add .btn')) add(); });
    el.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target.matches('.lst-add input')){ e.preventDefault(); add(); } });
    draw();
    return { get:function(){ var p=el.querySelector('.lst-add input'); var v=p&&p.value.trim(); return v?data.concat([v]):data.slice(); }, set:function(v){ data=arr(v).slice(); draw(); } };
  }

  /* ---------- modál ---------- */
  function modal(id,on){ var m=$(id); if(!m) return; m.classList.toggle('on',on!==false); if(on!==false){ var f=m.querySelector('input,textarea,select'); if(f) setTimeout(function(){ f.focus(); },50); } }
  document.addEventListener('click',function(e){ var c=e.target.closest('[data-close]'); if(c){ modal(c.dataset.close,false); return; } if(e.target.classList&&e.target.classList.contains('mdl')) e.target.classList.remove('on'); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') document.querySelectorAll('.mdl.on').forEach(function(m){ m.classList.remove('on'); }); });

  /* ---------- képfeltöltés ---------- */
  async function upload(bucket,folder,file,prefix,progEl){
    if(!file) throw new Error('Nincs fájl');
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Csak JPG, PNG vagy WebP kép tölthető fel.');
    if(file.size>5*1024*1024) throw new Error('A kép túl nagy (max. 5 MB).');
    var bar=progEl&&progEl.querySelector('i'); if(progEl){ progEl.classList.add('on'); bar.style.width='25%'; }
    var ext=(file.type.split('/')[1]||'jpg').replace('jpeg','jpg');
    var path=folder+'/'+prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,6)+'.'+ext;
    var up=await db.storage.from(bucket).upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type});
    if(up.error){ if(progEl) progEl.classList.remove('on'); throw up.error; }
    if(bar) bar.style.width='90%';
    var url=db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    setTimeout(function(){ if(progEl){ bar.style.width='100%'; setTimeout(function(){ progEl.classList.remove('on'); bar.style.width='0'; },400); } },100);
    return {url:url,path:path};
  }
  function pathOf(bucket,url){ if(!url) return null; var k='/'+bucket+'/'; var i=String(url).indexOf(k); return i<0?null:decodeURIComponent(String(url).slice(i+k.length).split('?')[0]); }
  async function removeFile(bucket,url){ var p=pathOf(bucket,url); if(!p) return; try{ await db.storage.from(bucket).remove([p]); }catch(e){} }

  /* ---------- kérések (admin_requests + e-mail értesítés) ---------- */
  var KIND={clinic_add_doctor:'Orvos felvétele',clinic_remove_doctor:'Orvos eltávolítása',doctor_add_clinic:'Új rendelési hely',doctor_remove_clinic:'Rendelési hely eltávolítása',name_change:'Névváltozás',other:'Egyéb kérés'};
  async function request(row,who){
    var r=await db.from('admin_requests').insert(row);
    if(r.error) throw r.error;
    try{ await db.functions.invoke('bright-responder',{body:{name:who.name||'Admin',email:who.email||'',topic:'partner',message:'[Admin-kérés] '+(KIND[row.kind]||row.kind)+'\n'+(row.message||'')+'\n\n'+JSON.stringify(row.payload||{},null,1)}}); }catch(e){}
  }
  async function myRequests(){ var r=await db.from('admin_requests').select('id,kind,payload,message,status,admin_note,created_at').order('created_at',{ascending:false}).limit(30); return r.data||[]; }
  function requestsHtml(list){
    if(!list.length) return '<div class="adm-empty"><b>Nincs beküldött kérés</b>Az itt indított kéréseket kollégánk 1–2 munkanapon belül feldolgozza.</div>';
    var ST={pending:'Feldolgozás alatt',approved:'Jóváhagyva',done:'Teljesítve',rejected:'Elutasítva'};
    return '<div class="rows">'+list.map(function(q){ var p=q.payload||{}; var d=new Date(q.created_at);
      return '<div class="rw" style="grid-template-columns:minmax(0,1fr) auto"><div><b>'+esc(KIND[q.kind]||q.kind)+(p.name?': '+esc(p.name):'')+'</b><small>'+d.toLocaleDateString('hu-HU')+(q.message?' · '+esc(String(q.message).slice(0,120)):'')+(q.admin_note?'<br>Válasz: '+esc(q.admin_note):'')+'</small></div><div class="acts"><span class="st '+esc(q.status)+'">'+esc(ST[q.status]||q.status)+'</span></div></div>'; }).join('')+'</div>';
  }

  /* ---------- jelszócsere ---------- */
  async function changePassword(p1,p2,btn){
    if(!p1||p1.length<10){ toast('A jelszó legalább 10 karakter legyen.','err'); return false; }
    if(p1!==p2){ toast('A két jelszó nem egyezik.','err'); return false; }
    busy(btn,true,'Mentés…');
    var r=await db.auth.updateUser({password:p1}); busy(btn,false);
    if(r.error){ toast('Nem sikerült: '+r.error.message,'err'); return false; }
    toast('Jelszó módosítva.','ok'); return true;
  }

  window.szkAdmin={$:$,esc:esc,initials:initials,arr:arr,num:num,toast:toast,guard:guard,logout:logout,tabs:tabs,go:go,jump:jump,track:track,setDirty:setDirty,isDirty:function(){return dirty;},busy:busy,listEditor:listEditor,modal:modal,upload:upload,removeFile:removeFile,request:request,myRequests:myRequests,requestsHtml:requestsHtml,changePassword:changePassword,KIND:KIND};
})();
