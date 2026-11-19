/* Solmar Bay v4 save (B4) — localStorage, autosave on mission completion. */
(function(){'use strict';var SB=window.SB=window.SB||{};
var K='solmarbay-v4-save';
function jobsDone(){try{if(SB.missions&&typeof SB.missions.jobs==='function'){
 var j=SB.missions.jobs(),n=0;j.forEach(function(x){if(x.status==='DONE'||x.done)n++});return n}}catch(e){}return 0}
var S={key:K,_done:-1,
 data:function(){var p=SB.player||{};
  return{v:1,cash:(typeof SB.cash==='number'?SB.cash:(p.cash||0)),
   rep:SB.rep!=null?SB.rep:(p.rep||0),day:(SB.state&&SB.state.day)||1,
   clock:(SB.state&&SB.state.clock)||1044,done:jobsDone(),
   hp:p.health!=null?p.health:100,ar:p.armor!=null?p.armor:(p.armour||0),
   col:SB.collectibles||0,x:p.pos?p.pos.x:0,z:p.pos?p.pos.z:0}},
 save:function(){try{localStorage.setItem(K,JSON.stringify(S.data()));S._done=jobsDone();return true}catch(e){return false}},
 load:function(){try{var d=JSON.parse(localStorage.getItem(K)||'null');if(!d)return false;
  if(typeof d.cash==='number'){if(SB.player)SB.player.cash=d.cash;SB.cash=d.cash}
  if(d.rep!=null){SB.rep=d.rep;if(SB.player)SB.player.rep=d.rep}
  if(SB.state){if(d.day)SB.state.day=d.day;if(d.clock!=null)SB.state.clock=d.clock}
  if(SB.player){if(d.hp!=null)SB.player.health=d.hp;
   if(d.ar!=null){if('armor' in SB.player)SB.player.armor=d.ar;else SB.player.armour=d.ar}
   if(SB.player.pos&&typeof d.x==='number')SB.player.pos.set(d.x,0,d.z)}
  if(d.col!=null)SB.collectibles=d.col;S._done=d.done||0;return true}catch(e){return false}},
 autosave:function(){var n=jobsDone();if(S._done>=0&&n>S._done){S.save();return true}
  if(S._done<0)S._done=n;return false},
 onMissionDone:function(){return S.save()},
 clear:function(){try{localStorage.removeItem(K)}catch(e){}},
 init:function(){if(S._in)return;S._in=1;S._done=jobsDone();
  setInterval(function(){S.autosave()},2000)}};
SB.save=S;
if(document.readyState!=='loading')S.init();
else document.addEventListener('DOMContentLoaded',function(){S.init()});
})();
