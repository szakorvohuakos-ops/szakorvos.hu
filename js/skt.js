/* szakorvos.hu – látogatottságmérés (saját, sütimentes; munkamenet-azonosító csak a böngészőlap élettartamára) */
(function(){
  if(window.SKT) return;
  var URL_='https://asgnkjmwzhbczpvetprh.supabase.co/rest/v1/site_events', KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZ25ram13emhiY3pwdmV0cHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzk1NDMsImV4cCI6MjA5MjgxNTU0M30.WCprcmT4oFq1iPfYeQvwGyDv5Vox6YZdn5efouN_Nc0';
  var off=false, qs=new URLSearchParams(location.search);
  try{
    if(qs.get('notrack')==='1') localStorage.setItem('sk_notrack','1');
    if(qs.get('notrack')==='0') localStorage.removeItem('sk_notrack');
    off=localStorage.getItem('sk_notrack')==='1';
  }catch(e){}
  if(!/^https?:$/.test(location.protocol) || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) || navigator.webdriver) off=true;
  // Munkamenet-azonosító csak statisztikai süti-hozzájárulás után (sessionStorage, a lap bezárásáig);
  // hozzájárulás nélkül oldalanként új, nem tárolt azonosító → csak anonim darabszám.
  var consent=false, sid;
  try{ var cc=JSON.parse(localStorage.getItem('szk_cookie_consent')||'null'); consent=!!(cc&&cc.analytics); }catch(e){}
  var rnd=function(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); };
  if(consent){ try{ sid=sessionStorage.getItem('sk_sid'); if(!sid){ sid=rnd(); sessionStorage.setItem('sk_sid',sid); } }catch(e){ sid='p-'+rnd(); } }
  else sid='p-'+rnd();
  var w=Math.min(screen.width||innerWidth, innerWidth), device=w<700?'mobile':(w<1100?'tablet':'desktop');
  function cut(v,n){ return v==null||v===''?null:String(v).slice(0,n); }
  var ctx={};
  function send(ev,d){
    d=d||{};
    var row={event:ev,page:cut(location.pathname+(ev==='pageview'?location.search:''),300),session_id:sid,device:device,
      query:cut(d.query,300),specialty_slug:cut(d.specialty_slug,100),city:cut(d.city,100),result_count:(typeof d.result_count==='number'?d.result_count:null),
      doctor_id:d.doctor_id||ctx.doctor_id||null,clinic_id:d.clinic_id||ctx.clinic_id||null,target:cut(d.target,40),
      referrer:cut(d.referrer,300),utm_source:cut(d.utm_source,100),utm_medium:cut(d.utm_medium,100),utm_campaign:cut(d.utm_campaign,100)};
    if(off){ try{ if(qs.get('trackdebug')==='1') console.log('[SKT] '+JSON.stringify(row)); }catch(e){} return; }
    try{ fetch(URL_,{method:'POST',keepalive:true,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row)}).catch(function(){}); }catch(e){}
  }
  var sent={};
  window.SKT={
    send:send,
    once:function(key,ev,d){ if(sent[key]) return; sent[key]=1; send(ev,d); },
    ctx:function(o){ for(var k in o) ctx[k]=o[k]; },
    off:function(){ return off; }
  };
  // oldalmegtekintés
  var ref=null; try{ if(document.referrer){ var r=new URL(document.referrer); if(r.hostname!==location.hostname) ref=r.hostname+r.pathname; } }catch(e){}
  send('pageview',{referrer:ref,utm_source:qs.get('utm_source'),utm_medium:qs.get('utm_medium'),utm_campaign:qs.get('utm_campaign')});
  // kattintások: telefon, e-mail, weboldal, időpontfoglalás, útvonal, térkép
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a,button'); if(!a) return;
    if(a.matches('.js-openmap,[data-open-map]')){ send('map_open'); return; }
    if(a.matches('#aex button')){ send('example_click',{query:a.textContent.trim()}); return; }
    var h=(a.getAttribute('href')||'').trim(); if(!h) return;
    var t=null;
    if(/^tel:/i.test(h)) t='phone';
    else if(/^mailto:/i.test(h)) t='email';
    else if(/foglaljorvost|odoktor|teladoc|booking|idopont/i.test(h)) t='booking';
    else if(/google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo|waze\.com/i.test(h)) t='route';
    else if(/^https?:/i.test(h)){ try{ if(new URL(h).hostname!==location.hostname) t=(ctx.doctor_id||ctx.clinic_id)?'website':null; }catch(_){} }
    if(t) send('contact_click',{target:t});
  },true);
  // tünet-asszisztens megnyitása
  var tries=0, iv=setInterval(function(){
    if(window.szChat&&window.szChat.open&&!window.szChat.__skt){ var o=window.szChat.open; window.szChat.open=function(){ send('symptom_chat',{query:arguments[0]||null}); return o.apply(this,arguments); }; window.szChat.__skt=1; clearInterval(iv); }
    if(++tries>40) clearInterval(iv);
  },500);
})();
