/* Solmar Bay v4 audio (B4) — procedural WebAudio: hum, siren, shots, radio bassline. */
(function(){'use strict';var SB=window.SB=window.SB||{},D=document;
var MIN=[0,0,3,5,7,5,3,0],MAJ=[0,2,4,5,7,5,4,2];
var A={ctx:null,mg:null,st:null,step:0,next:0,humO:null,humG:null,sirO:null,sirG:null,playing:false,
 ensure:function(){if(A.ctx)return A.ctx;try{var C=window.AudioContext||window.webkitAudioContext;
  if(!C)return null;A.ctx=new C();A.mg=A.ctx.createGain();A.mg.gain.value=.5;A.mg.connect(A.ctx.destination);
  A.humO=A.ctx.createOscillator();A.humO.type='sawtooth';A.humO.frequency.value=55;
  var f=A.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=380;
  A.humG=A.ctx.createGain();A.humG.gain.value=0;A.humO.connect(f);f.connect(A.humG);A.humG.connect(A.mg);A.humO.start();
  A.sirO=A.ctx.createOscillator();A.sirO.type='triangle';A.sirO.frequency.value=800;
  var lfo=A.ctx.createOscillator();lfo.type='square';lfo.frequency.value=.6;
  var lg=A.ctx.createGain();lg.gain.value=160;lfo.connect(lg);lg.connect(A.sirO.frequency);
  A.sirG=A.ctx.createGain();A.sirG.gain.value=0;A.sirO.connect(A.sirG);A.sirG.connect(A.mg);
  A.sirO.start();lfo.start()}catch(e){A.ctx=null}return A.ctx},
 setStation:function(s){A.st=s;if(A.playing&&A.ctx){A.step=0;A.next=A.ctx.currentTime+.05}},
 startRadio:function(){if(!A.ensure())return;if(A.ctx.state==='suspended')A.ctx.resume();
  if(A.playing)return;A.playing=true;A.step=0;A.next=A.ctx.currentTime+.1;
  setInterval(function(){if(!A.playing||!A.ctx)return;var spb=60/(A.st?A.st.bpm:112)/2;
   while(A.next<A.ctx.currentTime+.18){A.note(A.step,spb);A.step=(A.step+1)%16;A.next+=spb}},90)},
 note:function(i,spb){var s=A.st||{bpm:112,root:55,w:'sawtooth',min:1},t=A.next;
  var sc=s.min?MIN:MAJ,deg=sc[i%8],fr=s.root*Math.pow(2,deg/12)*(i>=8?2:1);
  var o=A.ctx.createOscillator(),g=A.ctx.createGain();o.type=s.w;o.frequency.value=fr;
  g.gain.setValueAtTime(.14,t);g.gain.exponentialRampToValueAtTime(.001,t+spb*.95);
  o.connect(g);g.connect(A.mg);o.start(t);o.stop(t+spb);
  if(i%4===0){var k=A.ctx.createOscillator(),kg=A.ctx.createGain();k.type='sine';
   k.frequency.setValueAtTime(120,t);k.frequency.exponentialRampToValueAtTime(40,t+.12);
   kg.gain.setValueAtTime(.25,t);kg.gain.exponentialRampToValueAtTime(.001,t+.14);
   k.connect(kg);kg.connect(A.mg);k.start(t);k.stop(t+.15)}},
 hum:function(kmh){if(!A.ctx||!A.humG)return;var g=kmh>1?.02+Math.min(.06,kmh/151*.06):0;
  A.humG.gain.setTargetAtTime(g,A.ctx.currentTime,.1);
  A.humO.frequency.setTargetAtTime(50+kmh*.35,A.ctx.currentTime,.1)},
 siren:function(on){if(!A.ctx||!A.sirG)return;A.sirG.gain.setTargetAtTime(on?.045:0,A.ctx.currentTime,.2)},
 shot:function(){if(!A.ensure())return;try{var t=A.ctx.currentTime,len=A.ctx.sampleRate*.09,
  b=A.ctx.createBuffer(1,len,A.ctx.sampleRate),d=b.getChannelData(0);
  var sd=1234567;for(var i=0;i<len;i++){sd=(sd*1103515245+12345)&0x7fffffff;d[i]=(sd/0x40000000-1)*(1-i/len);}
  var s=A.ctx.createBufferSource();s.buffer=b;var f=A.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1200;
  var g=A.ctx.createGain();g.gain.value=.4;s.connect(f);f.connect(g);g.connect(A.mg);s.start(t)}catch(e){}},
 pickup:function(){if(!A.ensure())return;try{var t=A.ctx.currentTime;
  [660,880].forEach(function(fr,i){var o=A.ctx.createOscillator(),g=A.ctx.createGain();o.type='sine';o.frequency.value=fr;
   g.gain.setValueAtTime(.2,t+i*.08);g.gain.exponentialRampToValueAtTime(.001,t+i*.08+.12);
   o.connect(g);g.connect(A.mg);o.start(t+i*.08);o.stop(t+i*.08+.13)})}catch(e){}},
 init:function(){if(A._in)return;A._in=1;
  var go=function(){A.ensure();A.startRadio()};
  D.addEventListener('pointerdown',go,{once:true});D.addEventListener('keydown',go,{once:true})}};
SB.audio=A;
if(D.readyState!=='loading')A.init();else D.addEventListener('DOMContentLoaded',function(){A.init()});
})();
