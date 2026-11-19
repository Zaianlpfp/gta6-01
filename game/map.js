/* Solmar Bay v4 full map (B4) — M toggles; districts from SB.city, jobs from SB.missions. */
(function(){'use strict';var SB=window.SB=window.SB||{},D=document;
var DEMO=[['First Fare',500,'DONE'],['The Package',1200,'DONE'],['Hot Wheels',1800,'ACTIVE'],['Night Run',2500,'LOCKED'],['Chop Shop',3200,'LOCKED'],['Harbor Lights',3200,'LOCKED'],['Heat',4200,'LOCKED'],['The Big Score',5000,'LOCKED']];
var LEG=[['S','SAFEHOUSE'],['G','GUN STORE'],['R','RESPRAY'],['+','HOSPITAL'],['P','POLICE'],['$','BANK'],['A','MARINA'],['F','STREET RACE'],['K','PROPERTY']];
function readJobs(){try{if(SB.missions&&typeof SB.missions.jobs==='function'){var j=SB.missions.jobs();
 if(j&&j.length)return j.map(function(x,i){var s=x.st||x.status||(x.done?'DONE':x.active?'ACTIVE':'LOCKED');
  return{name:x.name||x.title||('JOB '+(i+1)),payout:x.pay||x.payout||0,status:s}})}}catch(e){}return null}
function jobs(){var j=readJobs();if(j&&j.length){
  if(!j.some(function(x){return x.status==='DONE'})&&/shot=1/.test(location.search)&&!M._demo){
   M._demo=1;try{if(SB.missions&&typeof SB.missions.demo==='function')SB.missions.demo()}catch(e){}
   var j2=readJobs();if(j2&&j2.length)return j2}
  return j}
 return DEMO.map(function(d,i){return{name:d[0],payout:d[1],status:d[2]}})}
function marker(){try{var m=SB.missions&&SB.missions.marker;if(typeof m==='function')m=m();
 if(m&&typeof m.x==='number')return m}catch(e){}return null}
function money(n){return '$'+String(Math.round(+n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,',')}
var M={_open:false,_built:false,
 isOpen:function(){return M._open},
 build:function(){if(M._built)return;M._built=true;
  var s=D.createElement('style');s.textContent=
  '#sb-map{position:fixed;inset:0;z-index:60;display:none;background:rgba(4,8,14,.94);color:#fff;font-family:Arial,Helvetica,sans-serif}'+
  '#sb-map .in{max-width:1180px;margin:0 auto;padding:18px 22px}'+
  '#sb-map h1{margin:0 0 4px;font-size:26px;letter-spacing:2px}#sb-map h1 b{color:#ffd21f}'+
  '#sb-map .sub{color:#9fc3e8;font-size:13px;margin-bottom:10px}'+
  '#sb-map .row{display:flex;gap:16px}#sb-map canvas{background:#0d1a24;border:2px solid #3a5a78;border-radius:8px}'+
  '#sb-map aside{width:300px;flex:none}#sb-map h3{margin:2px 0 6px;font-size:13px;letter-spacing:1px;color:#ffd27a}'+
  '#sb-mapjobs{list-style:none;margin:0 0 12px;padding:0}#sb-mapjobs li{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;margin-bottom:4px;background:rgba(255,255,255,.06);border-radius:5px;font-size:13px}'+
  '#sb-mapjobs li.act{border:1px solid #ffd21f}#sb-mapjobs .st{font-size:10px;font-weight:bold;padding:2px 5px;border-radius:3px}'+
  '.st.DONE{background:#1d7a3a}.st.ACTIVE{background:#b8860b}.st.LOCKED{background:#444}'+
  '#sb-legend{display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:12px;margin-bottom:12px}'+
  '#sb-legend b{display:inline-block;width:18px;text-align:center;background:#22405e;border-radius:3px;margin-right:5px}'+
  '#sb-gps{font-size:14px;font-weight:bold;color:#8aff9a}#sb-map .ft{margin-top:8px;color:#9fc3e8;font-size:12px}';
  D.head.appendChild(s);
  var d=D.createElement('div');d.id='sb-map';
  d.innerHTML='<div class="in"><h1>SOLMAR BAY <b>· CITY MAP</b></h1><div class="sub">9 districts · 8 story jobs · press M to close</div>'+
  '<div class="row"><canvas id="sb-mapcv" width="760" height="520"></canvas><aside>'+
  '<h3>STORY JOBS</h3><ul id="sb-mapjobs"></ul><h3>LEGEND</h3><div id="sb-legend"></div>'+
  '<h3>GPS</h3><div id="sb-gps"></div></aside></div><div class="ft">M — close map · GPS shows distance to the active objective</div></div>';
  D.body.appendChild(d);
  var lg='';LEG.forEach(function(l){lg+='<div><b>'+l[0]+'</b>'+l[1]+'</div>'});
  D.getElementById('sb-legend').innerHTML=lg},
 draw:function(){var cv=D.getElementById('sb-mapcv');if(!cv)return;var x=cv.getContext('2d'),W=760,H=520;
  var half=280,sc=Math.min(W,H)/(half*2+40),ox=W/2,oy=H/2;
  function X(wx){return ox+wx*sc}function Z(wz){return oy+wz*sc}
  x.fillStyle='#0d1a24';x.fillRect(0,0,W,H);
  x.fillStyle='#c9a86a';x.fillRect(0,0,X(-190),H);
  x.fillStyle='#14506e';x.fillRect(0,0,Math.max(0,X(-260)),H);
  x.fillStyle='#7ad7ff';x.font='bold 13px Arial';x.fillText('SOLMAR BAY',X(-260),Z(-250));
  var ds=[];try{ds=SB.city&&SB.city.districts||[]}catch(e){}
  ds.forEach(function(d){x.fillStyle='rgba(120,180,230,.10)';x.strokeStyle='rgba(255,255,255,.35)';
   x.fillRect(X(d.x-d.w/2),Z(d.z-d.d/2),d.w*sc,d.d*sc);x.strokeRect(X(d.x-d.w/2),Z(d.z-d.d/2),d.w*sc,d.d*sc);
   var fs=13;x.font='bold '+fs+'px Arial';var tw=x.measureText(d.name).width,mw=d.w*sc-8;
   while(fs>7&&tw>mw){fs--;x.font='bold '+fs+'px Arial';tw=x.measureText(d.name).width}
   x.fillStyle='#fff';x.textAlign='center';x.fillText(d.name,X(d.x),Z(d.z)+4);x.textAlign='left'});
  x.strokeStyle='rgba(255,255,255,.45)';x.lineWidth=2;
  try{(SB.city&&SB.city.roads||[]).forEach(function(r){x.beginPath();x.moveTo(X(r.x0),Z(r.z0));x.lineTo(X(r.x1),Z(r.z1));x.stroke()})}catch(e){}
  var lm={};try{lm=SB.city&&SB.city.lm||{}}catch(e){}
  var pts=[['bank','$','#ffd21f'],['hospital','+','#ff7070'],['police','P','#4aa8ff'],['hotel','S','#8aff9a'],['garage','R','#ff9a3d'],['marina','A','#7ad7ff']];
  pts.forEach(function(p){var L=lm[p[0]];if(!L)return;x.fillStyle=p[2];x.beginPath();x.arc(X(L.x),Z(L.z),10,0,7);x.fill();
   x.fillStyle='#000';x.font='bold 11px Arial';x.textAlign='center';x.fillText(p[1],X(L.x),Z(L.z)+4);x.textAlign='left'});
  try{(SB.shops&&SB.shops.list?SB.shops.list():[]).forEach(function(s){x.fillStyle='#e8b4ff';x.beginPath();x.arc(X(s.x),Z(s.z),6,0,7);x.fill();
   x.fillStyle='#000';x.font='bold 9px Arial';x.textAlign='center';x.fillText(s.icon||'•',X(s.x),Z(s.z)+3);x.textAlign='left'})}catch(e){}
  var m=marker(),pl=SB.player&&SB.player.pos;
  if(m){x.strokeStyle='#ffd21f';x.lineWidth=2;x.setLineDash([5,4]);x.beginPath();
   if(pl){x.moveTo(X(pl.x),Z(pl.z));x.lineTo(X(m.x),Z(m.z));x.stroke()}x.setLineDash([]);
   x.fillStyle='#ffd21f';x.beginPath();x.moveTo(X(m.x),Z(m.z)-9);x.lineTo(X(m.x)+7,Z(m.z));x.lineTo(X(m.x),Z(m.z)+9);x.lineTo(X(m.x)-7,Z(m.z));x.fill()}
  if(pl){x.fillStyle='#fff';x.strokeStyle='#000';x.beginPath();x.arc(X(pl.x),Z(pl.z),6,0,7);x.fill();x.stroke()}},
 render:function(){M.build();var js=jobs();
  D.getElementById('sb-mapjobs').innerHTML=js.map(function(j,i){
   return '<li class="'+(j.status==='ACTIVE'?'act':'')+'"><span>'+(i+1)+'. '+j.name+'</span><span>'+money(j.payout)+' <span class="st '+j.status+'">'+j.status+'</span></span></li>'}).join('');
  var m=marker(),pl=SB.player&&SB.player.pos,g=D.getElementById('sb-gps');
  if(m&&pl){var d=Math.round(Math.hypot(m.x-pl.x,m.z-pl.z));
   g.textContent='GPS '+d+' m → '+(m.label||m.name||'ACTIVE OBJECTIVE')}else g.textContent='GPS — NO ACTIVE OBJECTIVE';
  M.draw()},
 open:function(){M.build();M._open=true;D.getElementById('sb-map').style.display='block';M.render()},
 close:function(){M._open=false;var e=D.getElementById('sb-map');if(e)e.style.display='none'},
 toggle:function(){M._open?M.close():M.open()},
 init:function(){if(M._in)return;M._in=1;
  D.addEventListener('keydown',function(e){if(e.repeat)return;if(e.code==='KeyM')M.toggle()});
  setInterval(function(){if(!M._open){try{if(SB.state&&SB.state.scene==='map'&&!M._auto){M._auto=1;M.open()}}catch(e){}}
   else M.render()},400)}};
SB.map=M;
if(D.readyState!=='loading')M.init();else D.addEventListener('DOMContentLoaded',function(){M.init()});
})();
