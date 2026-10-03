/* szakorvos.hu – cikk-tartalom segéd: biztonságos HTML-szűrés + tartalomjegyzék (2026.10) */
(function(){
  if(window.szkContent) return;
  var OK={H2:1,H3:1,H4:1,P:1,UL:1,OL:1,LI:1,STRONG:1,B:1,EM:1,I:1,A:1,BR:1,TABLE:1,THEAD:1,TBODY:1,TR:1,TH:1,TD:1,BLOCKQUOTE:1,HR:1,SPAN:1,DIV:1,SUP:1,SUB:1,SMALL:1,MARK:1,CODE:1,FIGURE:1,FIGCAPTION:1,IMG:1};
  var DROP={SCRIPT:1,STYLE:1,IFRAME:1,OBJECT:1,EMBED:1,FORM:1,INPUT:1,BUTTON:1,TEXTAREA:1,SELECT:1,LINK:1,META:1,NOSCRIPT:1,SVG:1,MATH:1};
  function safeUrl(u){ u=String(u||'').trim(); return /^(https?:\/\/|\/|#|mailto:)/i.test(u)&&!/^javascript:/i.test(u)?u:''; }
  function clean(node){
    Array.prototype.slice.call(node.childNodes).forEach(function(n){
      if(n.nodeType===8){ n.remove(); return; }
      if(n.nodeType!==1) return;
      var t=n.tagName.toUpperCase();
      if(DROP[t]){ n.remove(); return; }
      if(t==='H1'){ var h=document.createElement('h2'); while(n.firstChild) h.appendChild(n.firstChild); n.replaceWith(h); n=h; t='H2'; }
      if(!OK[t]){ clean(n); while(n.firstChild) n.parentNode.insertBefore(n.firstChild,n); n.remove(); return; }
      Array.prototype.slice.call(n.attributes).forEach(function(a){
        var k=a.name.toLowerCase();
        if(t==='A'&&k==='href'){ var u=safeUrl(a.value); if(u) n.setAttribute('href',u); else n.removeAttribute('href'); return; }
        if(t==='IMG'&&(k==='src'||k==='alt')){ if(k==='src'&&!/^https:\/\//i.test(a.value)) n.remove(); return; }
        if((t==='TD'||t==='TH')&&(k==='colspan'||k==='rowspan')) return;
        n.removeAttribute(a.name);
      });
      if(t==='A'&&/^https?:/i.test(n.getAttribute('href')||'')&&!/szakorvos\.hu/i.test(n.getAttribute('href'))){ n.setAttribute('target','_blank'); n.setAttribute('rel','noopener nofollow'); }
      if(n.parentNode) clean(n);
    });
  }
  function sanitize(html){
    html=String(html||'').replace(/^\s*```[a-z]*\s*/i,'').replace(/\s*```\s*$/,'');
    var doc=new DOMParser().parseFromString('<div id="r">'+html+'</div>','text/html'), r=doc.getElementById('r');
    if(!r) return '';
    clean(r);
    /* üres bekezdések */
    r.querySelectorAll('p').forEach(function(p){ if(!p.textContent.trim()&&!p.querySelector('img')) p.remove(); });
    return r.innerHTML;
  }
  function slug(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'resz'; }
  /* tartalomjegyzék a h2-kből; spy: aktív kiemelés görgetéskor */
  function toc(root,box,opts){
    opts=opts||{}; var hs=root.querySelectorAll(opts.sel||'h2'), used={};
    if(hs.length<(opts.min||2)){ if(box) box.hidden=true; return []; }
    var items=[];
    hs.forEach(function(h){ var id=h.id||slug(h.textContent); while(used[id]) id+='-2'; used[id]=1; h.id=id; items.push([id,h.textContent.trim()]); });
    if(box){ box.hidden=false; box.innerHTML='<b>'+(opts.title||'Tartalom')+'</b>'+items.map(function(x){ return '<a href="#'+x[0]+'">'+x[1].replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];})+'</a>'; }).join('');
      var as=box.querySelectorAll('a');
      var spy=function(){ var cur=null; hs.forEach(function(h,i){ if(h.getBoundingClientRect().top<140) cur=i; }); as.forEach(function(a,i){ a.classList.toggle('on',i===cur); }); };
      window.addEventListener('scroll',spy,{passive:true}); spy(); }
    if(opts.mobile){ var d=document.createElement('details'); d.className='mtoc'; d.innerHTML='<summary>'+(opts.title||'Tartalom')+' <i>'+items.length+'</i></summary>'+items.map(function(x){ return '<a href="#'+x[0]+'">'+x[1].replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];})+'</a>'; }).join('');
      d.addEventListener('click',function(e){ if(e.target.closest('a')) d.open=false; }); opts.mobile.parentNode.insertBefore(d,opts.mobile); document.body.classList.add('has-mtoc'); }
    return items;
  }
  function readMin(html){ var w=String(html||'').replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length; return Math.max(1,Math.round(w/200)); }
  window.szkContent={sanitize:sanitize,toc:toc,slug:slug,readMin:readMin};
})();
