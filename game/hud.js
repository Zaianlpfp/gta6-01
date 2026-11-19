/* Solmar Bay v4 HUD (B4) — reads SB.player/police/missions/radio/city. */
(function(){'use strict';var SB=window.SB=window.SB||{},D=document;
function $(id){return D.getElementById(id)}
function gv(o,p,d){try{var v=o,k=p.split('.');for(var i=0;i<k.length;i++){if(v==null)return d;v=v[k[i]]}return v==null?d:v}catch(e){return d}}
function pk(ps,d){for(var i=0;i<ps.length;i++){var v=gv(SB,ps[i],undefined);if(v!==undefined&&v!==null)return v}return d}
function money(n){n=Math.round(+n||0);return '$'+String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',')}
var WD=['FRI','SAT','SUN','MON','TUE','WED','THU'];
var RANKS=[[0,'STREET KID'],[400,'SMALL-TIME'],[900,'HUSTLER'],[1500,'BAY HUSTLER'],[2400,'KING OF THE BAY'],[4000,'LEGEND OF SOLMAR']];
var DEMO=[['First Fare',500,'DONE'],['The Package',1200,'DONE'],['Hot Wheels',1800,'ACTIVE'],['Night Run',2500,'LOCKED'],['Chop Shop',3200,'LOCKED'],['Harbor Lights',3200,'LOCKED'],['Heat',4200,'LOCKED'],['The Big Score',5000,'LOCKED']];
function jobs(){var j=null;try{if(SB.missions&&typeof SB.missions.jobs==='function')j=SB.missions.jobs()}catch(e){}
 if(!j||!j.length)return DEMO.map(function(d,i){return{name:d[0],payout:d[1],status:d[2],giver:'mara',n:i+1}});
 return j.map(function(x,i){var s=x.st||x.status||(x.done?'DONE':x.active?'ACTIVE':'LOCKED');
  return{name:x.name||x.title||('JOB '+(i+1)),payout:x.pay||x.payout||0,status:s,giver:x.giver||x.g||'mara',n:i+1}})}
function curJob(){var js=jobs(),cur=pk(['missions.cur'],-1);
 if(cur>=0&&js[cur])return{job:js[cur],idx:cur};
 for(var i=0;i<js.length;i++)if(js[i].status==='ACTIVE')return{job:js[i],idx:i};
 return{job:js[0],idx:0}}
function stageInfo(idx){try{var L=SB.missions&&SB.missions.list;if(L&&L[idx]&&L[idx].st){
 var ss=L[idx].st,si=pk(['missions.stage'],0);si=Math.max(0,Math.min(ss.length-1,si));
 return{txt:ss[si].t||'',next:ss[si+1]?ss[si+1].t:'',label:'STAGE '+(si+1)+'/'+ss.length}}}catch(e){}return{txt:'',next:'',label:'STAGE 1/3'}}
function timeLeft(){try{var t=SB.missions&&SB.missions.timeLeft;if(typeof t==='function')t=t();
 if(typeof t==='number'){if(t<=0)return '';return Math.floor(t/60)+':'+('0'+Math.floor(t%60)).slice(-2)}if(typeof t==='string')return t}catch(e){}return''}
function marker(){try{var m=SB.missions&&SB.missions.marker;if(typeof m==='function')m=m();
 if(m&&typeof m.x==='number')return m}catch(e){}return null}
function stars(){try{if(SB.police&&typeof SB.police.stars==='function')return SB.police.stars()}catch(e){}
 var h=pk(['state.heat'],0);return Math.max(0,Math.min(5,h<=5?Math.round(h):Math.round(h/20)))}
function resp(){try{var r=SB.police&&SB.police.response;if(Array.isArray(r)&&r.length)return r}catch(e){}
 var st=stars();if(!st)return[];var u=[{name:'GULL-1',status:'SPOTLIGHT',dist:35}];
 var ns=['MARLIN-11','TARPON-18','SNAPPER-25','IBIS-43'];
 for(var i=0;i<Math.min(st+1,4);i++)u.push({name:ns[i],status:i===0?'RAMMING':'PURSUIT',dist:9+i*8});return u}
function sight(){var st=stars();if(!st)return'CLEAR';var r=resp();
 if(r.length&&/SPOTLIGHT|IN SIGHT/.test(r[0].status||''))return'IN SIGHT · GULL-1';
 return st>=3?'IN SIGHT':'BREAK LINE OF SIGHT'}
function weapons(){var w=pk(['player.weapons'],null);
 if(Array.isArray(w)&&w.length)return w;
 return[{n:'FISTS'},{n:'PISTOL',mag:12,res:48},{n:'SMG',mag:32,res:128},{n:'SHOTGUN',mag:6,res:18},{n:'RIFLE',mag:0,res:0,locked:true}]}
function car(){return pk(['player.car'],null)}
function rep(){var r=Math.max(pk(['rep'],0)||0,pk(['player.rep'],0)||0,pk(['missions.rep'],0)||0);
 var t=RANKS[0],nx=RANKS[1][0];
 for(var i=0;i<RANKS.length;i++)if(r>=RANKS[i][0]){t=RANKS[i];nx=i+1<RANKS.length?RANKS[i+1][0]:r+1000}
 return{xp:r,title:t[1],base:t[0],next:nx}}
function district(){try{var p=SB.player&&SB.player.pos,ds=SB.city&&SB.city.districts;
 if(p&&ds)for(var i=0;i<ds.length;i++){var d=ds[i];
  if(Math.abs(p.x-d.x)<=d.w/2&&Math.abs(p.z-d.z)<=d.d/2)return d.name}}catch(e){}return'NEON MILE'}
function portrait(k,def){try{var c=SB.chars&&SB.chars[k];if(typeof c==='string')return c;
 if(c&&(c.img||c.src))return c.img||c.src}catch(e){}return def}
var CREW=[['lucia','LUCIA ORTEGA','DRIVER','assets/lucia.jpg'],['jax','JAX','MECHANIC','assets/jax.jpg'],['mara','MARA SOLIS','LOOKOUT','assets/mara.jpg']];
function build(){if($('sb-hud'))return;
 var s=D.createElement('style');s.textContent=
 '#sb-hud{position:fixed;inset:0;z-index:50;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#fff;text-shadow:0 1px 2px #000}'+
 '.sb-p{position:absolute;background:rgba(8,12,18,.62);border:1px solid rgba(255,255,255,.22);border-radius:6px;padding:7px 10px}'+
 '.sb-t{font-size:11px;letter-spacing:1px;color:#ffd27a;font-weight:bold}'+
 '.sb-big{font-size:20px;font-weight:bold}'+
 '.sb-bar{height:8px;background:#222;border-radius:4px;overflow:hidden;margin-top:3px}.sb-bar>i{display:block;height:100%}'+
 '.sb-star{color:#3a3a3a;font-size:22px}.sb-star.on{color:#ffd21f}'+
 '#sb-tl{top:12px;left:12px;min-width:250px}#sb-mis{top:158px;left:12px;width:296px}'+
 '#sb-crew{top:296px;left:12px;width:296px}#sb-tr{top:12px;right:12px;text-align:right;min-width:210px}'+
 '#sb-mini{position:absolute;top:104px;right:12px;width:168px;height:168px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.5);box-shadow:0 0 0 2px rgba(0,0,0,.5)}'+
 '#sb-resp{top:284px;right:12px;width:238px}#sb-radio{bottom:12px;left:56%;transform:translateX(-50%);white-space:nowrap}'+
 '#sb-speed{bottom:158px;right:12px;text-align:right;min-width:200px}'+
 '#sb-wheel{position:absolute;bottom:12px;right:12px;display:flex;gap:6px}#sb-wheel .w{width:56px;padding:6px 2px;text-align:center;background:rgba(8,12,18,.62);border:1px solid rgba(255,255,255,.25);border-radius:6px;font-size:10px}'+
 '#sb-wheel .w.sel{border-color:#ffd21f;background:rgba(60,45,5,.8)}#sb-wheel .w.lk{opacity:.45}'+
 '#sb-prompt{position:absolute;bottom:58px;left:50%;transform:translateX(-50%);font-weight:bold;color:#ffe9a8}'+
 '.sb-crow{display:flex;align-items:center;gap:8px;margin-top:5px}.sb-crow img{width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid #ffd27a}';
 D.head.appendChild(s);
 var h=D.createElement('div');h.id='sb-hud';
 h.innerHTML='<div class="sb-p" id="sb-tl"><div id="sb-stars"></div><div class="sb-big" id="sb-cash"></div>'+
 '<div style="margin-top:4px"><span class="sb-t">HEALTH</span><div class="sb-bar"><i id="sb-hp" style="background:#37d67a"></i></div></div>'+
 '<div style="margin-top:3px"><span class="sb-t">ARMOR</span><div class="sb-bar"><i id="sb-ar" style="background:#4aa8ff"></i></div></div>'+
 '<div style="margin-top:5px"><span class="sb-t" id="sb-rep"></span><div class="sb-bar"><i id="sb-xp" style="background:#ffd21f"></i></div></div></div>'+
 '<div class="sb-p" id="sb-mis"><div class="sb-t" id="sb-mname"></div><div id="sb-mstage" style="font-size:12px;margin-top:2px"></div><div id="sb-mnext" style="font-size:12px;color:#cfe3ff"></div><div id="sb-mtime" style="font-size:15px;font-weight:bold;margin-top:2px"></div></div>'+
 '<div class="sb-p" id="sb-crew"><div class="sb-t">CREW</div><div id="sb-crewlist"></div></div>'+
 '<div class="sb-p" id="sb-tr"><div class="sb-big" id="sb-clock"></div><div id="sb-season" style="font-size:12px;color:#ffd27a"></div><div id="sb-loc" style="font-size:12px"></div><div id="sb-sight" style="font-size:12px;font-weight:bold"></div></div>'+
 '<canvas id="sb-mini" width="168" height="168"></canvas>'+
 '<div class="sb-p" id="sb-resp"><div class="sb-t">SBPD RESPONSE</div><div id="sb-resplist" style="font-size:12px"></div></div>'+
 '<div class="sb-p" id="sb-radio"></div>'+
 '<div class="sb-p" id="sb-speed"><div class="sb-big"><span id="sb-kmh"></span> <span style="font-size:12px">KM/H</span></div><div id="sb-car" style="font-size:12px"></div><div id="sb-gear" style="font-size:12px;color:#ffd27a"></div></div>'+
 '<div id="sb-wheel"></div><div id="sb-prompt"></div>';
 D.body.appendChild(h);
 var cl='';CREW.forEach(function(c){cl+='<div class="sb-crow"><img src="'+portrait(c[0],c[3])+'" onerror="this.style.display=\'none\'"><div><b style="font-size:12px">'+c[1]+'</b><br><span style="font-size:11px;color:#ffd27a">'+c[2]+'</span></div></div>'});
 $('sb-crewlist').innerHTML=cl;
 var wl='';weapons().forEach(function(w,i){wl+='<div class="w'+(w.locked?' lk':'')+'" data-i="'+i+'"><b>'+w.n+'</b><br><span class="am"></span></div>'});
 $('sb-wheel').innerHTML=wl;
}
function drawMini(){var c=$('sb-mini');if(!c)return;var x=c.getContext('2d'),S=168,R=130,sc=S/(R*2);
 var p=SB.player&&SB.player.pos,px=p?p.x:0,pz=p?p.z:0;
 function X(wx){return (wx-px)*sc+S/2}function Z(wz){return (wz-pz)*sc+S/2}
 x.save();x.beginPath();x.arc(S/2,S/2,S/2,0,7);x.clip();
 x.fillStyle='#0d1a24';x.fillRect(0,0,S,S);
 x.fillStyle='#c9a86a';x.fillRect(0,0,X(-190),S);
 x.fillStyle='#14506e';x.fillRect(0,0,Math.max(0,X(-260)),S);
 try{var ds=SB.city&&SB.city.districts||[];ds.forEach(function(d){x.fillStyle='rgba(255,255,255,.07)';x.fillRect(X(d.x-d.w/2),Z(d.z-d.d/2),d.w*sc,d.d*sc)})}catch(e){}
 x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=1.5;
 try{(SB.city&&SB.city.roads||[]).forEach(function(r){x.beginPath();x.moveTo(X(r.x0),Z(r.z0));x.lineTo(X(r.x1),Z(r.z1));x.stroke()})}catch(e){}
 var st=stars();if(st>=3){x.strokeStyle='rgba(255,60,60,.9)';x.setLineDash([4,3]);x.beginPath();x.arc(S/2,S/2,44,0,7);x.stroke();x.setLineDash([])}
 var m=marker();if(m){x.fillStyle='#ffd21f';x.beginPath();var mx=X(m.x),mz=Z(m.z);x.moveTo(mx,mz-6);x.lineTo(mx+5,mz);x.lineTo(mx,mz+6);x.lineTo(mx-5,mz);x.fill()}
 try{(SB.police&&SB.police.units||[]).forEach(function(u){if(!u.mesh)return;x.fillStyle='#ff4040';x.beginPath();x.arc(X(u.mesh.position.x),Z(u.mesh.position.z),3,0,7);x.fill()})}catch(e){}
 x.fillStyle='#fff';x.beginPath();x.moveTo(S/2, S/2-7);x.lineTo(S/2+5,S/2+5);x.lineTo(S/2-5,S/2+5);x.fill();
 x.restore()}
function stageDlg(){if(H._dlg)return;var q=location.search;
 if(!/shot=1/.test(q))return;
 var m=/[?&]scene=([^&]+)/.exec(q),sc=m?m[1]:pk(['state.scene'],'cover');
 if(sc!=='cover'&&sc!=='mission'&&sc!=='onfoot')return;
 if(!SB.dialog||typeof SB.dialog.show!=='function'||SB.dialog.active||$('dlg'))return;
 try{var L=SB.missions&&SB.missions.list,cj=curJob(),LJ=L&&L[cj.idx];
  if(LJ&&LJ.intro&&LJ.intro[0]){
   if(SB.dialog.say)SB.dialog.say(LJ.g||'mara',LJ.intro[0]);
   else SB.dialog.show(LJ.g||'mara',LJ.intro[0]);H._dlg=1}}catch(e){}}
function upd(){var root=$('sb-hud');if(!root)return;
 var scene=pk(['state.scene'],'cover');
 var mapOpen=SB.map&&SB.map.isOpen&&SB.map.isOpen();
 root.style.display=(scene==='title'||mapOpen)?'none':'block';if(root.style.display==='none')return;
 stageDlg();
 var st=stars(),sh='';for(var i=0;i<5;i++)sh+='<span class="sb-star'+(i<st?' on':'')+'">★</span>';
 $('sb-stars').innerHTML=sh;
 $('sb-cash').textContent=money(Math.max(pk(['cash'],0)||0,pk(['player.cash'],0)||0,pk(['missions.cash'],0)||0));
 var hp=Math.max(0,Math.min(100,pk(['player.health','health','state.health'],82)));
 var ar=Math.max(0,Math.min(100,pk(['player.armor','player.armour','armor','state.armor'],64)));
 $('sb-hp').style.width=hp+'%';$('sb-ar').style.width=ar+'%';
 var rp=rep();$('sb-rep').textContent='REP '+rp.xp+' · '+rp.title;
 $('sb-xp').style.width=Math.round(100*(rp.xp-rp.base)/Math.max(1,rp.next-rp.base))+'%';
 var js=jobs(),done=js.filter(function(j){return j.status==='DONE'}).length,cj=curJob(),a=cj.job,si=stageInfo(cj.idx);
 $('sb-mname').textContent='STORY '+done+'/'+js.length+' · '+a.name.toUpperCase()+' · '+money(a.payout);
 $('sb-mstage').textContent=si.label+(si.txt?' · '+si.txt:'')+(a.status==='DONE'?' · DONE':'');
 var nx=si.next;if(!nx){var nj=js[cj.idx+1];nx=nj?('Next job: '+nj.name):''}
 var so='';try{var sf=SB.missions&&SB.missions.standoff;if(sf&&sf.active)so='MERCADO STANDOFF — '+sf.left+' LEFT · $'+sf.pay}catch(e){}
 $('sb-mnext').textContent=(nx?('NEXT: '+nx):'')+(so?(nx?' · ':'')+so:'');
 var tl=timeLeft();$('sb-mtime').textContent=tl?('⏱ '+tl):'';
 var clk=pk(['state.clock'],17*60+24),day=pk(['state.day'],1),tod=(pk(['state.tod'],'sunset')||'sunset').toUpperCase();
 $('sb-clock').textContent=WD[(day-1)%7]+' '+('0'+Math.floor(clk/60)).slice(-2)+':'+('0'+(clk%60)).slice(-2)+' · DAY '+day;
 $('sb-season').textContent='SUMMER · '+tod;
 $('sb-loc').textContent='📍 '+district();
 var sg=sight();$('sb-sight').textContent=sg;$('sb-sight').style.color=st>=3?'#ff7070':'#8aff9a';
 var rs=resp();$('sb-resplist').innerHTML=rs.length?rs.map(function(u){return '<div>'+u.name+' · '+(u.dist!=null?u.dist+' m · ':'')+u.status+'</div>'}).join(''):'<div>NO UNITS NEARBY</div>';
 $('sb-resp').style.display=st?'block':'none';
 $('sb-radio').textContent=SB.radio&&SB.radio.info?('♪ '+SB.radio.info()+'  [Q]'):'♪ WAVE 88.1 · Neon Drive — Pink Horizon  [Q]';
 var c=car(),inCar=pk(['player.inCar'],false),spd=pk(['state.speed'],0);
 if(!inCar&&c)spd=Math.abs((c.userData&&c.userData.speed)||0)*3.6;
 $('sb-kmh').textContent=Math.round(spd);
 var nm=inCar?(c&&c.userData&&c.userData.name)||'VENTO STRADA':'ON FOOT';
 var cond=inCar?((c&&c.userData&&typeof c.userData.cond==='number')?c.userData.cond:100):null;
 var cst=inCar?((c&&c.userData&&c.userData.status)||(cond<70?'DENTED':'OK')):'—';
 $('sb-car').textContent=inCar?(nm+' · COND '+Math.round(cond)+'% · '+cst):nm;
 var gr=inCar?((c&&c.userData&&c.userData.gear)||Math.max(1,Math.min(5,Math.ceil(spd/35)))):0;
 $('sb-gear').textContent=inCar?('GEAR G'+gr):'';
 var ws=weapons(),sel=pk(['player.sel'],0),slots=root.querySelectorAll('#sb-wheel .w');
 slots.forEach(function(el,i){var w=ws[i]||{n:'—'};el.classList.toggle('sel',i===sel);
  var am=el.querySelector('.am');if(am)am.textContent=w.locked?'LOCKED':((w.mag!=null&&isFinite(w.mag))?w.mag+(w.res!=null&&isFinite(w.res)?'/'+w.res:''):'—')});
 drawMini();
 if(SB.audio&&SB.audio.hum)SB.audio.hum(spd);
 if(SB.audio&&SB.audio.siren)SB.audio.siren(st>=3)}
var H={init:function(){if(H._in)return;H._in=1;
 if(!D.body){D.addEventListener('DOMContentLoaded',function(){build();stageDlg();H._t=setInterval(upd,150);upd()});return}
 build();stageDlg();H._t=setInterval(upd,150);upd();
 D.addEventListener('keydown',function(e){if(e.repeat)return;
  if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3'||e.code==='Digit4'){
   if(SB.map&&SB.map.isOpen&&SB.map.isOpen())return;
   if(SB.shops&&SB.shops.isOpen&&SB.shops.isOpen())return;
   var i=+e.code.slice(-1)-1;if(SB.player&&SB.player.setWeapon)SB.player.setWeapon(i);upd()}})},
 update:upd,prompt:function(t){var p=$('sb-prompt');if(p)p.textContent=t||''},jobs:jobs,actJob:function(){return curJob().job}};
SB.hud=H;
if(D.readyState!=='loading')H.init();else D.addEventListener('DOMContentLoaded',function(){H.init()});
})();
