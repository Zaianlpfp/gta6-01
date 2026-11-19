/* Solmar Bay v4 shops (B4) — gun store, respray, safehouse, hospital. F interacts. */
(function(){'use strict';var SB=window.SB=window.SB||{},D=document;
function cash(){var v=SB.player&&SB.player.cash;if(typeof v==='number')return v;
 if(typeof SB.cash==='number')return SB.cash;return 0}
function setCash(v){if(SB.player)SB.player.cash=v;if(typeof SB.cash==='number')SB.cash=v}
function armor(){return SB.player?(SB.player.armor!=null?SB.player.armor:SB.player.armour||0):0}
function setArmor(v){if(SB.player){if('armor' in SB.player)SB.player.armor=v;else SB.player.armour=v}}
function stars(){try{if(SB.police&&typeof SB.police.stars==='function')return SB.police.stars()}catch(e){}
 var h=(SB.state&&SB.state.heat)||0;return Math.max(0,Math.min(5,h<=5?Math.round(h):Math.round(h/20)))}
function list(){var lm={};try{lm=SB.city&&SB.city.lm||{}}catch(e){}
 var g=lm.garage||{x:120,z:120},h=lm.hotel||{x:0,z:0},hp=lm.hospital||{x:-60,z:60};
 return[{id:'gun',name:'AMMU-NATION',sub:'GUN STORE',x:g.x+24,z:g.z,icon:'G'},
 {id:'respray',name:'SOLMAR RESPRAY',sub:'RESPRAY · LOSE 1 STAR',x:g.x,z:g.z+10,icon:'R'},
 {id:'safe',name:'PALMETTO SAFEHOUSE',sub:'SAVE POINT',x:h.x,z:h.z,icon:'S'},
 {id:'hosp',name:'SOLMAR GENERAL',sub:'HOSPITAL · HEAL $100',x:hp.x,z:hp.z,icon:'+'}]}
function near(){var p=SB.player&&SB.player.pos;if(!p)return null;var best=null,bd=1e9;
 list().forEach(function(s){var d=Math.hypot(s.x-p.x,s.z-p.z);if(d<bd){bd=d;best=s}});
 return bd<=14?best:null}
var S={_open:false,_shop:null,
 list:list,near:near,isOpen:function(){return S._open},
 open:function(sh){sh=sh||near();if(!sh)return;S._shop=sh;S._open=true;S.panel()},
 close:function(){S._open=false;var e=D.getElementById('sb-shop');if(e)e.style.display='none'},
 panel:function(){var e=D.getElementById('sb-shop');
  if(!e){var s=D.createElement('style');s.textContent=
   '#sb-shop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:70;display:none;width:340px;background:rgba(8,14,22,.95);border:1px solid #ffd21f;border-radius:8px;color:#fff;font-family:Arial,Helvetica,sans-serif;padding:14px}'+
   '#sb-shop h2{margin:0 0 2px;font-size:18px}#sb-shop .sub{color:#ffd27a;font-size:12px;margin-bottom:10px}'+
   '#sb-shop button{display:block;width:100%;margin:5px 0;padding:9px;text-align:left;background:#1c2f45;color:#fff;border:1px solid #3a5a78;border-radius:5px;font-size:13px;cursor:pointer}'+
   '#sb-shop button:hover{border-color:#ffd21f}#sb-shop .msg{font-size:12px;color:#8aff9a;min-height:16px;margin-top:6px}#sb-shop .ft{font-size:11px;color:#9fc3e8;margin-top:6px}';
   D.head.appendChild(s);
   e=D.createElement('div');e.id='sb-shop';D.body.appendChild(e)}
  var sh=S._shop,acts=[];
  if(sh.id==='gun')acts=[['1 · BODY ARMOR — $200',function(){return S.buyArmor()}],['2 · PISTOL AMMO +48 — $50',function(){return S.buyAmmo(1,48,50)}],['3 · SMG AMMO +128 — $120',function(){return S.buyAmmo(2,128,120)}]];
  if(sh.id==='respray')acts=[['1 · RESPRAY + LOSE 1 STAR — $150',function(){return S.respray()}]];
  if(sh.id==='safe')acts=[['1 · SAVE GAME',function(){if(SB.save&&SB.save.save){SB.save.save();return 'GAME SAVED'}return 'SAVE UNAVAILABLE'}],['2 · HEAL — $100',function(){return S.heal()}]];
  if(sh.id==='hosp')acts=[['1 · HEAL TO FULL — $100',function(){return S.heal()}]];
  e.innerHTML='<h2>'+sh.name+'</h2><div class="sub">'+sh.sub+' · CASH '+('$'+cash())+'</div>'+
   acts.map(function(a,i){return '<button data-i="'+i+'">'+a[0]+'</button>'}).join('')+
   '<div class="msg" id="sb-shopmsg"></div><div class="ft">1-3 buy · F / Esc close</div>';
  e.style.display='block';
  e.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){
   var r=acts[+b.getAttribute('data-i')][1]();var m=D.getElementById('sb-shopmsg');if(m)m.textContent=r||'';
   S.panel()})})},
 buyArmor:function(){if(cash()<200)return 'NOT ENOUGH CASH';setCash(cash()-200);
  setArmor(Math.min(100,armor()+50));return 'ARMOR +50'},
 buyAmmo:function(w,n,c){if(cash()<c)return 'NOT ENOUGH CASH';var ws=SB.player&&SB.player.weapons;
  if(!ws||!ws[w])return 'NO WEAPON';setCash(cash()-c);ws[w].res=(ws[w].res||0)+n;return 'AMMO +'+n},
 heal:function(){if(cash()<100)return 'NOT ENOUGH CASH';setCash(cash()-100);
  if(SB.player)SB.player.health=100;return 'HEALTH RESTORED'},
 respray:function(){if(cash()<150)return 'NOT ENOUGH CASH';setCash(cash()-150);
  var st=stars();if(st>0){if(SB.police&&SB.police.setStars)SB.police.setStars(st-1);
   else if(SB.state)SB.state.heat=Math.max(0,SB.state.heat-20)}
  try{var c=SB.player&&SB.player.car;if(c){var cols=['#e33','#ff0','#3af','#f6f','#fff'];
   var col=SB.pick?SB.pick(cols):cols[0];c.traverse(function(o){if(o.isMesh&&o.material&&o.material.color&&o===c.children[0])o.material.color.set(col)})}}catch(e){}
  return 'RESPRAYED · WANTED -1 STAR'},
 init:function(){if(S._in)return;S._in=1;
  setInterval(function(){if(S._open)return;var n=near();
   if(SB.hud&&SB.hud.prompt)SB.hud.prompt(n?('F — '+n.name+' ('+n.sub+')'):'')},300);
  D.addEventListener('keydown',function(e){if(e.repeat)return;
   if(e.code==='KeyF'){S._open?S.close():S.open();return}
   if(e.code==='Escape'&&S._open){S.close();return}
   if(S._open&&(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3')){
    var b=D.querySelector('#sb-shop button[data-i="'+(+e.code.slice(-1)-1)+'"]');if(b)b.click()}})}};
SB.shops=S;
if(D.readyState!=='loading')S.init();else D.addEventListener('DOMContentLoaded',function(){S.init()});
})();
