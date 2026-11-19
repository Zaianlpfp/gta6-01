// missions.js — Solmar Bay v4 (B3): 8 misi cerita + side job MERCADO STANDOFF.
(function(){
var SB=window.SB=window.SB||{};
if(SB.cash==null)SB.cash=0;
if(SB.rep==null)SB.rep=0;
function LM(k){var c=SB.city;return(c&&c.lm&&c.lm[k])?c.lm[k]:{x:0,z:0};}
function DS(n){var d=(SB.city&&SB.city.districts)||[];for(var i=0;i<d.length;i++)if(d[i].name===n)return{x:d[i].x,z:d[i].z};return{x:0,z:0};}
function AT(a){return typeof a==='string'?((SB.city&&SB.city.lm&&SB.city.lm[a])?LM(a):DS(a)):a;}
var M=[
{n:'First Fare',g:'mara',pay:500,
 intro:["Kid, you drive? Good. Hotel pickup, marina drop. Don't scratch the paint.","First fare is on me. Do it clean and there's more where that came from."],
 out:"Clean run. The fare paid, and word travels fast in Solmar.",
 st:[{t:'Pick up the fare at the hotel',at:'hotel',r:10},{t:'Drop the fare at the marina',at:'marina',r:10}]},
{n:'The Package',g:'mara',pay:1200,
 intro:["A package is waiting at the garage. No peeking, no questions.","Deco Row drop. The buyer pays in cash and forgets your face."],
 out:"Delivered. Mara always pays what she promises.",
 st:[{t:'Pick up the package at the garage',at:'garage',r:10},{t:'Deliver the package in Deco Row',at:'Deco Row',r:12}]},
{n:'Hot Wheels',g:'jax',pay:1800,time:150,
 intro:["There's a Comet GT parked in Downtown with your name on it. Almost.","Bring it to my garage in one piece and the clock stops ticking."],
 out:"She's a beauty. Jax will have her repainted by sunrise.",
 st:[{t:'Steal the Comet GT in Downtown',at:'Downtown',r:14},{t:'Deliver the Comet to the garage',at:'garage',r:10}]},
{n:'Night Run',g:'lucia',pay:2500,time:180,
 intro:["Night run, three checkpoints, no cops invited. You in?","Neon Mile, then the docks, then Palmetto. Beat my time and I'll be impressed."],
 out:"That was poetry at 140. Lucia owes you a rematch.",
 st:[{t:'Hit the Neon Mile checkpoint',at:'Neon Mile',r:12},{t:'Hit the Bayline Docks checkpoint',at:'Bayline Docks',r:12},{t:'Finish at Palmetto Heights',at:'Palmetto Heights',r:12}]},
{n:'Chop Shop',g:'jax',pay:3200,
 intro:["A client needs a car gone. Not stolen - gone.","Garage first, then the field out past Keystone. Quietly."],
 out:"Stripped, sold, forgotten. Jax splits it fifty-fifty. His fifty, your fifty.",
 st:[{t:'Bring the car to the garage',at:'garage',r:10},{t:'Dump the shell at Keystone Field',at:'Keystone Field',r:14}]},
{n:'Harbor Lights',g:'lucia',pay:3200,
 intro:["A boat is coming in at the marina and it is not on any manifest.","Pelican Marina, then Downtown. Keep the lights off and the engine on."],
 out:"Cargo moved, nobody saw a thing. Lucia calls that a perfect night.",
 st:[{t:'Meet the boat at the marina',at:'marina',r:12},{t:'Move the cargo to Pelican Marina',at:'Pelican Marina',r:12},{t:'Drop the cargo in Downtown',at:'Downtown',r:12}]},
{n:'Heat',g:'mara',pay:4200,time:120,
 intro:["The bank job is on. Solmar National, in and out before the sirens find us.","Grab the cash, lose the heat, meet me at the garage. Go."],
 out:"Four grand and change, and the cops are still looking the wrong way.",
 st:[{t:'Hit Solmar National Bank',at:'bank',r:12},{t:'Lose the heat at the garage',at:'garage',r:10}]},
{n:'The Big Score',g:'mara',pay:5000,time:240,
 intro:["This is the one we retire on. Bank, hotel, marina - three stops, one night.","Do it right and you never drive a fare again. Do it wrong and I never knew you."],
 out:"The Big Score. Solmar Bay is yours now, kid.",
 st:[{t:'Hit Solmar National Bank',at:'bank',r:12},{t:'Pick up the crew at the hotel',at:'hotel',r:10},{t:'Escape by boat at the marina',at:'marina',r:10}]}
];
var cur=-1,stage=0,timeLeft=0,done=[false,false,false,false,false,false,false,false];
var marker={x:0,z:0,on:false,label:''},beacon=null;
function next(){for(var i=0;i<8;i++)if(!done[i])return i;return -1;}
function status(i){return done[i]?'DONE':(cur===i||(cur<0&&i===next()))?'ACTIVE':'LOCKED';}
function jobs(){return M.map(function(m,i){return{i:i,name:m.n,pay:m.pay,giver:m.g,st:status(i)};});}
function say(g,lines){if(SB.dialog)SB.dialog.show(g,lines);}
function setMark(){var s=M[cur].st[stage],p=AT(s.at);marker.x=p.x;marker.z=p.z;marker.on=true;marker.label=s.t;placeBeacon();}
function ensureBeacon(){if(beacon||!SB.THREE||!SB.scene)return;var T=SB.THREE;
 var beam=new T.Mesh(new T.CylinderGeometry(1.4,2.2,70,10,1,true),new T.MeshBasicMaterial({color:0xffd34d,transparent:true,opacity:.28,side:T.DoubleSide,depthWrite:false}));
 beam.position.y=35;
 var ring=new T.Mesh(new T.RingGeometry(4,6,32),new T.MeshBasicMaterial({color:0xffd34d,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.4;
 beacon=new T.Group();beacon.add(beam);beacon.add(ring);beacon.visible=false;SB.scene.add(beacon);}
function placeBeacon(){ensureBeacon();if(!beacon)return;beacon.position.set(marker.x,0,marker.z);beacon.visible=marker.on;}
function start(i,quiet){if(cur>=0)return false;if(i==null)i=next();if(i<0||done[i]||i!==next())return false;
 cur=i;stage=0;timeLeft=M[i].time||0;if(M[i].n==='Heat'&&SB.state)SB.state.heat=3;
 setMark();if(!quiet)say(M[i].g,M[i].intro);return true;}
function complete(){var m=M[cur];SB.cash+=m.pay;SB.rep+=120+((m.pay/50)|0);
 done[cur]=true;say(m.g,[m.out]);cur=-1;stage=0;timeLeft=0;marker.on=false;placeBeacon();}
function fail(msg){var m=M[cur];say(m.g,[msg||'Blown. The job is dead - come back when you are ready.']);
 cur=-1;stage=0;timeLeft=0;marker.on=false;placeBeacon();}
function update(dt){if(cur<0||(SB.state&&SB.state.paused))return;
 if(timeLeft>0){timeLeft-=dt;if(timeLeft<=0){timeLeft=0;fail('Too slow. The window closed.');return;}}
 var p=SB.player&&SB.player.pos;if(!p)return;
 var s=M[cur].st[stage],dx=p.x-marker.x,dz=p.z-marker.z;
 if(dx*dx+dz*dz<s.r*s.r){stage++;if(stage>=M[cur].st.length)complete();else setMark();}
 if(beacon&&beacon.visible){var k=1+.12*Math.sin((SB.state?SB.state.t:0)*4);beacon.scale.set(k,1,k);}}
var SO={name:'MERCADO STANDOFF',total:4,left:4,active:false,pay:800,
 start:function(){if(this.active)return false;this.active=true;this.left=this.total;
  var ps=(SB.city&&SB.city.peds)||[],pp=SB.player&&SB.player.pos,tag=[];
  ps.forEach(function(m){var u=m.userData;if(u&&!u.dead)tag.push(m);});
  tag.sort(function(a,b){var da=pp?((a.position.x-pp.x)*(a.position.x-pp.x)+(a.position.z-pp.z)*(a.position.z-pp.z)):0;
   var db=pp?((b.position.x-pp.x)*(b.position.x-pp.x)+(b.position.z-pp.z)*(b.position.z-pp.z)):0;return da-db;});
  tag.slice(0,4).forEach(function(m){var u=m.userData;u.boss=true;u.name='Saltjack';
   if(SB.THREE){var mk=new SB.THREE.Mesh(new SB.THREE.OctahedronGeometry(.35),
    new SB.THREE.MeshBasicMaterial({color:0xff2222}));mk.position.y=2.1;m.add(mk);}});
  say('mara',["The Saltjacks are shaking down my market stalls in Old Mercado.","Run them out. All four. The vendors pay us, not them."]);return true;},
 down:function(){if(!this.active)return;if(this.left>0)this.left--;
  if(this.left<=0){this.active=false;SB.cash+=this.pay;SB.rep+=80;
   say('mara',["Market is ours again. The vendors are already celebrating."]);}}};
function demo(){done[0]=true;start(1,true);SO.active=true;SO.left=2;}
SB.missions={list:M,marker:marker,standoff:SO,
 get cur(){return cur;},get stage(){return stage;},get timeLeft(){return timeLeft;},
 get done(){return done;},next:next,status:status,jobs:jobs,start:start,update:update,
 complete:complete,fail:fail,demo:demo,
 standoffDown:function(){SO.down();},
 get cash(){return SB.cash;},get rep(){return SB.rep;}};
})();
