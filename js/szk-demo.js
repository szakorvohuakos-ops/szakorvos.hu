/* szakorvos.hu – kezelőfelület DEMÓ: memóriabeli Supabase-utánzat, semmi nem kerül mentésre (2026.10) */
(function(){
'use strict';
var KIND=window.SZK_DEMO==='clinic'?'clinic':'doctor';
var OH={hetfo:'8:00–20:00',kedd:'8:00–20:00',szerda:'8:00–12:00, 14:00–20:00',csutortok:'8:00–20:00',pentek:'8:00–18:00',szombat:'9:00–13:00',vasarnap:'Zárva'};
var CL={id:'demo-c1',name:'Minta Egészségközpont',slug:'minta-egeszsegkozpont',admin_user_id:KIND==='clinic'?'demo-u':null,status:'partner',postal_code:'1111',street:'Minta utca 1.',district:'XI',address:'1111 Budapest, Minta utca 1.',phone:'+36 1 000 0000',email:'info@minta-rendelo.hu',website:'https://minta-rendelo.hu',tax_number:null,
  description:'Többszakmás magánrendelő a város szívében: bőrgyógyászat, kardiológia, nőgyógyászat és ultrahang-diagnosztika egy helyen, rövid várakozással.',
  google_rating:4.8,google_review_count:212,opening_hours:OH,photo_url:null,cover_url:null,gallery:[],public_transport:'Villamos és busz a közelben (2 perc séta)',parking_info:'Fizetős utcai parkolás, mélygarázs 100 m-re',accessibility:'Akadálymentes bejárat, lift',lat:47.47,lng:19.04,cities:{name:'Budapest'}};
var SP=['Allergológia','Belgyógyászat','Bőrgyógyászat','Endokrinológia','Fül-orr-gégészet','Gasztroenterológia','Kardiológia','Neurológia','Ortopédia','Pszichiátria','Reumatológia','Szemészet','Szülészet-nőgyógyászat','Urológia'].map(function(n,i){
  var dn={'Allergológia':'Allergológus','Belgyógyászat':'Belgyógyász','Bőrgyógyászat':'Bőrgyógyász','Endokrinológia':'Endokrinológus','Fül-orr-gégészet':'Fül-orr-gégész','Gasztroenterológia':'Gasztroenterológus','Kardiológia':'Kardiológus','Neurológia':'Neurológus','Ortopédia':'Ortopéd orvos','Pszichiátria':'Pszichiáter','Reumatológia':'Reumatológus','Szemészet':'Szemész','Szülészet-nőgyógyászat':'Nőgyógyász','Urológia':'Urológus'}[n];
  return {id:'s'+(i+1),name:n,doctor_name:dn,doctor_slug:dn.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]+/g,'-'),is_active:true}; });
function sp(n){ for(var i=0;i<SP.length;i++) if(SP[i].name===n) return SP[i]; return SP[0]; }
var DOC={id:'demo-d1',name:'Minta Anna',title:'Dr.',slug:'dr-minta-anna',admin_user_id:KIND==='doctor'?'demo-u':null,email:'dr.minta@minta-rendelo.hu',phone:'+36 30 000 0000',
  short_intro:'Bőrgyógyász, kozmetológus – anyajegyszűrés, akne, ekcéma',bio:'Több mint 15 éve foglalkozom bőrgyógyászattal. Rendelésemen a felnőtt és gyermek bőrbetegségek mellett anyajegyszűrést és esztétikai kezeléseket is végzek. Fontosnak tartom, hogy pácienseim érthető magyarázatot és személyre szabott kezelési tervet kapjanak.',
  languages:['magyar','angol','német'],experience_years:15,gender:'female',university:'Minta Orvostudományi Egyetem',graduation_year:2009,teaching_activity:null,
  board_certifications:['Bőrgyógyászat és venerológia szakvizsga (2014)'],continuing_education:['Dermatoszkópia tanfolyam (2019)'],memberships:['Bőrgyógyász szakmai társaság'],awards:[],research_areas:[],publications:[],conferences:[],media_appearances:[],
  has_online_consultation:true,has_eprescription:true,has_online_results:false,has_telemedicine:false,is_active:true,is_partner:true,verified_at:'2026-05-01T00:00:00Z',photo_url:null,
  profile_views:1240,profile_clicks:312,contact_clicks:86,rating:null,review_count:0,
  doctor_specialties:[{is_primary:true,specialty_id:sp('Bőrgyógyászat').id,specialties:sp('Bőrgyógyászat')}],
  doctor_clinics:[{consultation_fee:24000,clinic_id:CL.id,clinics:CL}]};
function dr(id,name,title,spec,act,fee){ return {clinic_id:CL.id,doctor_id:id,consultation_fee:fee,doctors:{id:id,name:name,title:title,slug:'#',photo_url:null,is_active:act,doctor_specialties:spec?[{is_primary:true,specialties:sp(spec)}]:[]}}; }
var DB={
  user_profiles:[{id:'demo-u',role:KIND==='clinic'?'clinic_admin':'doctor_admin',full_name:KIND==='clinic'?'Minta Egészségközpont':'Dr. Minta Anna',email:KIND==='clinic'?'info@minta-rendelo.hu':'dr.minta@minta-rendelo.hu'}],
  doctors:[DOC], clinics:[CL], specialties:SP,
  doctor_specialties:[{doctor_id:DOC.id,specialty_id:sp('Bőrgyógyászat').id,is_primary:true,specialties:sp('Bőrgyógyászat')}],
  doctor_clinics:KIND==='clinic'?[dr('demo-d1','Minta Anna','Dr.','Bőrgyógyászat',true,24000),dr('demo-d2','Példa Péter','Dr.','Kardiológia',true,28000),dr('demo-d3','Teszt Tímea','Dr., PhD','Szülészet-nőgyógyászat',true,30000),dr('demo-d4','Próba Pál','Dr.',null,false,null)]
    :[{doctor_id:DOC.id,clinic_id:CL.id,consultation_fee:24000,clinics:CL}],
  admin_requests:[{id:'demo-r1',kind:KIND==='clinic'?'clinic_add_doctor':'doctor_add_clinic',payload:KIND==='clinic'?{name:'Dr. Új Orvos',specialty:'Neurológia'}:{name:'Minta Rendelő Buda',address:'1122 Budapest, Példa tér 2.'},message:'Keddenként rendel.',status:'pending',admin_note:null,created_at:new Date(Date.now()-864e5).toISOString()}]
};
var clone=function(x){ return JSON.parse(JSON.stringify(x)); }, seq=0;
function norm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function Q(t){ this.t=t; this.f=[]; this.op='select'; this.p=null; this.o={}; this.lim=0; }
['neq','is','or','like','not','range','gte','lte','gt','lt','match','contains','filter','textSearch'].forEach(function(m){ Q.prototype[m]=function(){ return this; }; });
Q.prototype.select=function(c,o){ if(this.op==='select') this.o=o||{}; return this; };
Q.prototype.eq=function(k,v){ this.f.push(function(r){ return r[k]===undefined||r[k]==v; }); return this; };
Q.prototype.in=function(k,a){ this.f.push(function(r){ return r[k]===undefined||a.indexOf(r[k])>=0; }); return this; };
Q.prototype.ilike=function(k,p){ var re=new RegExp('^'+norm(p).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/%/g,'.*').replace(/_/g,'.')+'$'); this.f.push(function(r){ return re.test(norm(r[k])); }); return this; };
Q.prototype.order=function(k,o){ this.ord=[k,!(o&&o.ascending===false)]; return this; };
Q.prototype.limit=function(n){ this.lim=n; return this; };
Q.prototype.update=function(p){ this.op='update'; this.p=p; return this; };
Q.prototype.insert=function(p){ this.op='insert'; this.p=p; return this; };
Q.prototype.upsert=function(p){ this.op='insert'; this.p=p; return this; };
Q.prototype.delete=function(){ this.op='delete'; return this; };
Q.prototype._m=function(r){ return this.f.every(function(fn){ return fn(r); }); };
Q.prototype._run=function(single){
  var T=DB[this.t]=DB[this.t]||[], self=this, out;
  if(this.op==='update'){ T.forEach(function(r){ if(self._m(r)) Object.assign(r,clone(self.p)); }); out=T.filter(function(r){ return self._m(r); }); demoNote(); }
  else if(this.op==='insert'){ out=(Array.isArray(this.p)?this.p:[this.p]).map(function(x){ var r=Object.assign({id:'demo-n'+(++seq),created_at:new Date().toISOString(),status:self.t==='admin_requests'?'pending':undefined},clone(x));
      if(self.t==='doctor_specialties'&&!r.specialties){ r.specialties=SP.filter(function(s){ return s.id===r.specialty_id; })[0]; }
      T.unshift(r); return r; }); demoNote(); }
  else if(this.op==='delete'){ DB[this.t]=T.filter(function(r){ return !self._m(r); }); out=null; demoNote(); }
  else { out=T.filter(function(r){ return self._m(r); });
    if(this.ord){ var k=this.ord[0],a=this.ord[1]; out.sort(function(x,y){ var X=x[k],Y=y[k]; return (X>Y?1:X<Y?-1:0)*(a?1:-1); }); }
    if(this.lim) out=out.slice(0,this.lim);
    if(this.o.head) return Promise.resolve({data:null,count:out.length,error:null}); }
  out=out==null?null:clone(out);
  return new Promise(function(res){ setTimeout(function(){ res({data:single?(out&&out[0]||null):out,count:out?out.length:0,error:null}); },120); });
};
Q.prototype.single=function(){ return this._run(true); };
Q.prototype.maybeSingle=function(){ return this._run(true); };
Q.prototype.then=function(a,b){ return this._run(false).then(a,b); };
var BLOB={};
var storage={from:function(bk){ return {
  upload:function(p,f){ try{ BLOB[bk+'/'+p]=URL.createObjectURL(f); }catch(e){} demoNote(); return new Promise(function(r){ setTimeout(function(){ r({data:{path:p},error:null}); },400); }); },
  remove:function(){ return Promise.resolve({data:null,error:null}); },
  getPublicUrl:function(p){ return {data:{publicUrl:BLOB[bk+'/'+p]||''}}; } }; }};
var USER={id:'demo-u',email:DB.user_profiles[0].email};
window.supabase={createClient:function(){ return {
  auth:{getSession:async function(){ return {data:{session:{user:USER}}}; },getUser:async function(){ return {data:{user:USER}}; },
    signOut:async function(){ return {}; },onAuthStateChange:function(){ return {data:{subscription:{unsubscribe:function(){}}}}; },
    updateUser:async function(){ demoNote(); return {data:{},error:null}; }},
  from:function(t){ return new Q(t); },
  rpc:function(){ return Promise.resolve({data:null,error:null}); },
  functions:{invoke:function(){ return Promise.resolve({data:{lat:47.47,lng:19.04},error:null}); }},
  storage:storage }; }};
var shown=0;
function demoNote(){ var b=document.getElementById('demoBar'); if(!b) return; b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); if(!shown++){ var s=b.querySelector('.dm-s'); if(s) s.textContent='Kipróbálta – a demóban semmi nem kerül mentésre, frissítéskor minden visszaáll.'; } }
document.addEventListener('DOMContentLoaded',function(){
  var css=document.createElement('style');
  css.textContent='#demoBar{position:sticky;top:0;z-index:60;display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;padding:10px 16px;background:linear-gradient(90deg,#FFF6DD,#FFEFC2);border-bottom:1px solid #F1D88A;color:#5A4300;font-size:14px;line-height:1.4;text-align:center}#demoBar b{color:#3B2C00}#demoBar a{display:inline-flex;align-items:center;height:34px;padding:0 14px;border-radius:10px;background:#1D4992;color:#fff;font-weight:800;text-decoration:none;font-size:13.5px;white-space:nowrap}#demoBar a.s{background:#fff;color:#1D4992;border:1px solid #C9D6EE}#demoBar.pulse{animation:dmp .9s}@keyframes dmp{0%{background:#FFE08A}100%{}}@media(max-width:640px){#demoBar{position:relative;font-size:13px;gap:8px;padding:8px 12px}#demoBar a{height:32px;padding:0 11px}}';
  document.head.appendChild(css);
  var b=document.createElement('div'); b.id='demoBar'; b.setAttribute('role','note');
  b.innerHTML='<span><b>Bemutató</b> · <span class="dm-s">Ez a '+(KIND==='clinic'?'rendelők':'szakorvosok')+' kezelőfelülete mintaadatokkal – nyugodtan kattintgasson, semmi nem mentődik.</span></span><a href="/register#finder">Saját adatlapot kérek</a><a class="s" href="/'+(KIND==='clinic'?'demo-orvos':'demo-klinika')+'.html">'+(KIND==='clinic'?'Orvos':'Rendelő')+'-demó</a>';
  document.body.insertBefore(b,document.body.firstChild);
  document.addEventListener('click',function(e){ var l=e.target.closest&&e.target.closest('a[href*="/orvos/"],a[href*="/klinikak/"],a[href*="/klinika.html"],a[href*="/orvos.html"]'); if(!l) return; e.preventDefault(); demoNote(); var s=b.querySelector('.dm-s'); if(s) s.textContent='A bemutatóban a nyilvános adatlap nem nyitható meg – a sajátját az igénylés után látja itt.'; },true);
});
})();
