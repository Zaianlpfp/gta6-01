/* Solmar Bay v4 radio (B4) — 3 stations, Q cycles, WebAudio via SB.audio. */
(function(){'use strict';var SB=window.SB=window.SB||{},D=document;
var ST=[
 {n:'WAVE 88.1',t:'Neon Drive',a:'Pink Horizon',bpm:112,root:55,w:'sawtooth',min:1},
 {n:'SOL 101.9',t:'Solstice Run',a:'Marina Lights',bpm:96,root:49,w:'triangle',min:0},
 {n:'BAY 96.5',t:'Low Tide',a:'The Palmettos',bpm:128,root:65.41,w:'square',min:1}];
var R={i:0,stations:ST,
 cur:function(){return ST[R.i]},
 info:function(){var s=ST[R.i];return s.n+' · '+s.t+' — '+s.a},
 set:function(i){R.i=((i%3)+3)%3;
  if(SB.audio&&SB.audio.setStation)SB.audio.setStation(ST[R.i]);
  if(SB.hud&&SB.hud.update)SB.hud.update();return ST[R.i]},
 next:function(){return R.set(R.i+1)},prev:function(){return R.set(R.i-1)},
 init:function(){if(R._in)return;R._in=1;
  D.addEventListener('keydown',function(e){if(e.repeat)return;
   if(e.code==='KeyQ')R.next()});
  if(SB.audio&&SB.audio.setStation)SB.audio.setStation(ST[0])}};
SB.radio=R;
if(D.readyState!=='loading')R.init();else D.addEventListener('DOMContentLoaded',function(){R.init()});
})();
