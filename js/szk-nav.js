/* szakorvos.hu – fő navigáció v2 (2026.10) */
(function(){
'use strict';
var nav=document.getElementById('sknav'); if(!nav||nav.__nv) return; nav.__nv=1;
var items=[].slice.call(nav.querySelectorAll('.nv-it')), burger=nav.querySelector('.nv-burger'), drawer=document.getElementById('nv-drawer');
var fine=window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches, tClose=null;

/* görgetés-árnyék */
function sc(){ nav.classList.toggle('scrolled',window.scrollY>8); } sc(); window.addEventListener('scroll',sc,{passive:true});

/* asztali lenyíló menük */
function setOpen(it,on){ it.classList.toggle('open',on); var b=it.querySelector('.nv-top'); if(b) b.setAttribute('aria-expanded',on?'true':'false'); }
function closeAll(ex){ items.forEach(function(it){ if(it!==ex) setOpen(it,false); }); }
items.forEach(function(it){
  var b=it.querySelector('.nv-top');
  b.addEventListener('click',function(e){ e.stopPropagation(); var on=!it.classList.contains('open')||(Date.now()-(it._ho||0)<600); closeAll(it); setOpen(it,on); if(on&&e.detail===0){ var f=it.querySelector('.nv-pan a'); if(f) f.focus(); } });
  if(fine){
    it.addEventListener('mouseenter',function(){ clearTimeout(tClose); if(!it.classList.contains('open')) it._ho=Date.now(); closeAll(it); setOpen(it,true); });
    it.addEventListener('mouseleave',function(){ clearTimeout(tClose); tClose=setTimeout(function(){ setOpen(it,false); },180); });
  }
  it.addEventListener('keydown',function(e){
    var links=[].slice.call(it.querySelectorAll('.nv-pan a')), i=links.indexOf(document.activeElement);
    if(e.key==='Escape'){ setOpen(it,false); b.focus(); }
    else if(e.key==='ArrowDown'){ e.preventDefault(); if(!it.classList.contains('open')){ closeAll(it); setOpen(it,true); } (links[i+1]||links[0]).focus(); }
    else if(e.key==='ArrowUp'&&i>=0){ e.preventDefault(); (links[i-1]||links[links.length-1]).focus(); }
  });
  it.addEventListener('focusout',function(e){ if(!it.contains(e.relatedTarget)) setOpen(it,false); });
  [].forEach.call(it.querySelectorAll('.nv-pan a'),function(a){ a.addEventListener('click',function(){ setOpen(it,false); }); });
});
document.addEventListener('click',function(e){ if(!nav.contains(e.target)) closeAll(); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ closeAll(); if(drawer&&!drawer.hidden){ setDrawer(false); burger.focus(); } } });

/* mobil fiók */
function setDrawer(on){
  if(!drawer) return;
  if(on) closeAll();
  nav.style.setProperty('--nv-h',Math.round(nav.getBoundingClientRect().bottom)+'px');
  drawer.hidden=!on; burger.setAttribute('aria-expanded',on?'true':'false'); burger.setAttribute('aria-label',on?'Menü bezárása':'Menü megnyitása');
  document.documentElement.classList.toggle('nv-lock',on);
  nav.classList.toggle('dr-open',on);
}
if(burger&&drawer){
  burger.addEventListener('click',function(){ setDrawer(drawer.hidden); });
  drawer.addEventListener('click',function(e){ if(e.target===drawer) setDrawer(false); });
  [].forEach.call(drawer.querySelectorAll('a'),function(a){ a.addEventListener('click',function(){ setDrawer(false); }); });
  [].forEach.call(drawer.querySelectorAll('.nv-acc-h'),function(h){ h.addEventListener('click',function(){ var acc=h.parentNode, on=!acc.classList.contains('open'); acc.classList.toggle('open',on); h.setAttribute('aria-expanded',on?'true':'false'); }); });
  window.addEventListener('resize',function(){ if(!drawer.hidden&&window.innerWidth>1023) setDrawer(false); });
}

/* aktuális oldal jelölése */
var p=location.pathname.replace(/\.html$/,'').replace(/\/+$/,'')||'/', sec=null;
if(/^\/(talalatok|szakorvos|orvos)(\/|$)/.test(p)||/^\/[a-z-]+\/dr-/.test(p)) sec='orvos';
else if(/^\/(klinikak|klinika)(\/|$)/.test(p)) sec='rendelo';
else if(/^\/vizsgalat/.test(p)) sec='vizsg';
else if(/^\/tudastar/.test(p)) sec='tudas';
else if(/^\/(register|demo-orvos|demo-klinika|login|kapcsolat|admin-orvos|admin-klinika)$/.test(p)) sec='partner';
if(sec){ [].forEach.call(nav.querySelectorAll('[data-sec="'+sec+'"]'),function(x){ x.classList.add('cur'); if(x.classList.contains('nv-acc')){ x.classList.add('open'); var h=x.querySelector('.nv-acc-h'); if(h) h.setAttribute('aria-expanded','true'); } }); }
var here=location.pathname+location.search;
[].forEach.call(nav.querySelectorAll('.nv-pan a,.nv-acc-b a'),function(a){ var u=a.getAttribute('href')||''; if(u.indexOf('#')<0&&(u===here||u.replace(/\.html$/,'')===p)) a.setAttribute('aria-current','page'); });

/* „Rendelők a térképen”: a főoldalon modál (index kezeli), a klinikalistán a térkép megnyitása */
function openMapHere(){ var t=document.getElementById('mtog'); if(t&&t.offsetParent){ t.click(); return true; } var m=document.getElementById('mapCol')||document.getElementById('gmap'); if(m){ m.scrollIntoView({behavior:'smooth',block:'start'}); return true; } return false; }
if(location.hash==='#terkep'&&/^\/klinikak/.test(p)) setTimeout(openMapHere,600);
[].forEach.call(nav.querySelectorAll('a[href="/klinikak#terkep"]'),function(a){ a.addEventListener('click',function(e){ if(/^\/klinikak/.test(p)&&openMapHere()) e.preventDefault(); }); });
})();
