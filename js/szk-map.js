/* ==========================================================================
   szakorvos.hu – közös Google-térkép segéd (2026.10)
   - A Google Maps automatikusan betöltődik (a korábbi kattintós kapu kikapcsolva)
   - Találati térkép: értékelés-címkés jelölők, kártya ↔ jelölő kiemelés
   ========================================================================== */
(function(){
  if(window.szkMap) return;
  var KEY='AIzaSyA7_ptIph0HibAawgDxRGK0f9visixFo_4', P=null, gate=null, go=null;
  var STYLE=[{elementType:'geometry',stylers:[{color:'#e9eef5'}]},{elementType:'labels.text.fill',stylers:[{color:'#44506A'}]},{elementType:'labels.text.stroke',stylers:[{color:'#ffffff'}]},{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'road.highway',elementType:'geometry',stylers:[{color:'#d5deec'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#bcd6f5'}]}];
  function allowed(){ return true; } /* térkép automatikusan töltődik (2026.10) */
  function raw(){
    if(window.google&&google.maps&&typeof google.maps.Map==='function') return Promise.resolve(google.maps);
    if(P) return P;
    P=new Promise(function(res,rej){
      window._szkMapReady=function(){ res(google.maps); };
      var s=document.createElement('script');
      s.src='https://maps.googleapis.com/maps/api/js?key='+KEY+'&callback=_szkMapReady&language=hu&region=HU';
      s.async=true; s.onerror=function(){ P=null; rej(new Error('maps')); };
      document.head.appendChild(s);
    });
    return P;
  }
  function start(){
    try{ localStorage.setItem('szk_maps_ok','1'); }catch(e){}
    window.__szkMapsOk=true;
    document.querySelectorAll('.szk-map-consent').forEach(function(o){ o.remove(); });
    if(go) go();
  }
  window._szkMapsStart=start;
  function consent(el){
    if(!el||el.querySelector('.szk-map-consent')) return;
    var o=document.createElement('div'); o.className='szk-map-consent';
    o.style.cssText='position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#EBF0F8;padding:16px;text-align:center;border-radius:inherit';
    o.innerHTML='<div style="font-size:12.5px;color:#44506A;max-width:30ch;line-height:1.5">A térképet a Google Maps szolgáltatja – betöltésekor az IP-címe a Google-hoz kerül. <a href="/adatvedelem" style="color:#1D4992;text-decoration:underline">Részletek</a></div><button type="button" style="font:700 13px Manrope,sans-serif;color:#fff;background:#1D4992;border:0;border-radius:10px;padding:9px 16px;cursor:pointer">Térkép betöltése</button>';
    o.querySelector('button').addEventListener('click',start);
    el.appendChild(o);
  }
  function load(el){
    if(allowed()) return raw();
    if(!gate) gate=new Promise(function(r){ go=r; });
    consent(el);
    return gate.then(raw);
  }
  function pill(maps,text,on){
    text=String(text||'');
    var w=Math.max(30,Math.round(text.length*7.4+20)),h=34;
    var c=on?'#467A28':'#1D4992';
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><rect x="1" y="1" width="'+(w-2)+'" height="24" rx="10" fill="'+c+'" stroke="#fff" stroke-width="1.5"/><path d="M'+(w/2-6)+' 24 L'+(w/2)+' 32 L'+(w/2+6)+' 24 Z" fill="'+c+'"/><text x="'+(w/2)+'" y="17" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="12" font-weight="800" fill="#fff">'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</text></svg>';
    return {url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg),scaledSize:new maps.Size(w,h),anchor:new maps.Point(w/2,h)};
  }
  function clusterIcon(maps,count,position){
    var size=count<10?36:count<50?44:52;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+(size/2-1)+'" fill="rgba(29,73,146,.18)"/><circle cx="'+size/2+'" cy="'+size/2+'" r="'+(size/2-5)+'" fill="#1D4992" stroke="#fff" stroke-width="2"/><text x="'+size/2+'" y="'+size/2+'" text-anchor="middle" dominant-baseline="central" fill="#fff" font-family="Manrope,Arial,sans-serif" font-size="'+Math.round(size*.32)+'" font-weight="800">'+count+'</text></svg>';
    return new maps.Marker({position:position,zIndex:1000+count,icon:{url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg),scaledSize:new maps.Size(size,size),anchor:new maps.Point(size/2,size/2)}});
  }
  /* Találati térkép. items: [{id,lat,lng,label,title}] ; opts: {onHover(id,on), onClick(id)} */
  function results(el,opts){
    opts=opts||{};
    var map=null,maps=null,mk={},cluster=null,pending=null,ready=null;
    var focus=null;
    function nz(t){ return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
    var last=[];
    function draw(items){
      if(!map) return; last=items||[];
      Object.keys(mk).forEach(function(k){ mk[k].setMap(null); }); mk={};
      if(cluster&&cluster.clearMarkers) cluster.clearMarkers();
      var b=new maps.LatLngBounds(),list=[],n=0,fb=0;
      items.forEach(function(it){
        if(!it||!isFinite(it.lat)||!isFinite(it.lng)||mk[it.id]) return;
        var m=new maps.Marker({position:{lat:+it.lat,lng:+it.lng},title:it.title||'',icon:pill(maps,it.label,false),zIndex:10});
        m._lb=it.label;
        m.addListener('mouseover',function(){ hl(it.id,true); if(opts.onHover) opts.onHover(it.id,true); });
        m.addListener('mouseout',function(){ hl(it.id,false); if(opts.onHover) opts.onHover(it.id,false); });
        m.addListener('click',function(){ if(opts.onClick) opts.onClick(it.id); });
        mk[it.id]=m; list.push(m); n++;
        if(!focus||!focus.city||nz(it.city)===nz(focus.city)){ b.extend(m.getPosition()); fb++; }
      });
      var mc=window.markerClusterer&&window.markerClusterer.MarkerClusterer;
      if(mc&&list.length>40){ cluster=new mc({map:map,markers:list,renderer:{render:function(o){ return clusterIcon(maps,o.count,o.position); }}}); }
      else list.forEach(function(m){ m.setMap(map); });
      if(focus&&focus.city&&!fb&&!focus.center){ list.forEach(function(m){ b.extend(m.getPosition()); }); fb=list.length; }
      if(fb===1){ map.setCenter(b.getCenter()); map.setZoom(14); }
      else if(fb>1){ map.fitBounds(b,40); maps.event.addListenerOnce(map,'idle',function(){ if(map.getZoom()>16) map.setZoom(16); }); }
      else if(focus&&focus.center){ map.setCenter(focus.center); map.setZoom(12); }
      return n;
    }
    function hl(id,on){
      var m=mk[id]; if(!m||!maps) return;
      m.setIcon(pill(maps,m._lb,on)); m.setZIndex(on?999:10);
    }
    function init(){
      if(ready) return ready;
      ready=load(el).then(function(g){
        maps=g;
        var box=el.querySelector('#gmap')||el;
        map=new maps.Map(box,{center:(focus&&focus.center)||{lat:47.4979,lng:19.0402},zoom:(focus&&focus.center)?12:11,styles:STYLE,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,clickableIcons:false,gestureHandling:'greedy',zoomControl:true,scrollwheel:true});
        if(pending){ draw(pending); pending=null; }
        return map;
      });
      ready.catch(function(){ var m=el.querySelector('.mmsg'); if(m){ m.textContent='A térkép most nem tölthető be.'; m.hidden=false; } });
      return ready;
    }
    return {
      set:function(items,f){ focus=f||null; if(map) draw(items); else { pending=items; init(); } },
      hl:hl,
      resize:function(){ if(map&&maps){ maps.event.trigger(map,'resize'); draw(last); } }
    };
  }
  /* Egyetlen hely (adatlapok) */
  function single(el,lat,lng,label){
    return load(el).then(function(maps){
      var box=el.querySelector('.gm')||el;
      var map=new maps.Map(box,{center:{lat:+lat,lng:+lng},zoom:15,styles:STYLE,disableDefaultUI:true,zoomControl:true,clickableIcons:false,gestureHandling:'greedy',zoomControl:true,scrollwheel:true});
        maps.event.addListener(map,'zoom_changed',function(){});
      new maps.Marker({position:{lat:+lat,lng:+lng},map:map,icon:pill(maps,label||'●',false)});
      return map;
    });
  }
  window.szkMap={load:load,results:results,single:single,allowed:allowed};
})();
