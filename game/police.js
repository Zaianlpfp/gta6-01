// police.js — Solmar Bay r8 (B2): ground police + heli AIR-1/GULL-1 + wanted. Fresh write.
// Heat is stars 0-5; SB.police.stars() is authoritative (SB.state.heat mirrors it).
var SB=(typeof window!=='undefined'&&window.SB)?window.SB:globalThis.SB;
var THREE=(typeof window!=='undefined'&&window.THREE)?window.THREE:globalThis.THREE;
var UNITS=['MARLIN-11','SNAPPER-25','TARPON-18','IBIS-43','HERON-17','KESTREL-31'];
function _clamp(v,a,b){return v<a?a:v>b?b:v;}
function _rot(lx,lz,h){return{x:lx*Math.cos(h)+lz*Math.sin(h),z:-lx*Math.sin(h)+lz*Math.cos(h)};}
function _box(w,h,d,c,x,y,z){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
new THREE.MeshStandardMaterial({color:c,roughness:.8}));m.position.set(x,y,z);return m;}
function _heroPos(){if(SB.engine&&typeof SB.engine.heroPos==='function'){
var p=SB.engine.heroPos();if(p)return p;}
if(SB.player&&typeof SB.player.pos==='function')return SB.player.pos();return[0,0];}
function _heroHeading(){if(SB.player&&typeof SB.player.heading==='function')return SB.player.heading();
return 0;}
function mkCruiser(){var g=SB.vehicles.makeCarMesh('sedan',0xf2f2f2);
g.add(_box(2.04,.16,4,0x111827,0,.85,0));
g.add(_box(1,.12,.4,0x222222,0,1.6,.15));
var barR=_box(.45,.14,.42,0xff2222,-.26,1.68,.15);
var barB=_box(.45,.14,.42,0x2244ff,.26,1.68,.15);
g.add(barR);g.add(barB);g.userData.barR=barR;g.userData.barB=barB;return g;}
function mkHeli(){var g=new THREE.Group();
g.add(_box(2.6,1.5,5.2,0xf5f5f0,0,0,0));
g.add(_box(2.2,.9,1.4,0x0f2a4a,0,.1,-2.2));
g.add(_box(2.62,.35,5.24,0x1e40af,0,-.2,0));
g.add(_box(.6,.6,4.6,0xf5f5f0,0,.2,4.4));
g.add(_box(.12,1.4,1,0x1e40af,0,.7,6.4));
var mast=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.5,8),
new THREE.MeshStandardMaterial({color:0x333333}));mast.position.set(0,1,0);g.add(mast);
var rotor=new THREE.Group();rotor.position.set(0,1.3,0);
rotor.add(_box(.4,.06,8,0x222222,0,0,0));rotor.add(_box(8,.06,.4,0x222222,0,0,0));
g.add(rotor);
var tail=new THREE.Group();tail.position.set(.45,.3,6.4);
tail.add(_box(.08,1.3,.08,0x222222,0,0,0));tail.add(_box(.08,.08,1.3,0x222222,0,0,0));
g.add(tail);
g.add(_box(.12,.12,3.6,0x333333,-1,-1.05,0));g.add(_box(.12,.12,3.6,0x333333,1,-1.05,0));
g.add(_box(.1,.5,.1,0x333333,-1,-.75,.8));g.add(_box(.1,.5,.1,0x333333,1,-.75,.8));
g.add(_box(.1,.5,.1,0x333333,-1,-.75,-.8));g.add(_box(.1,.5,.1,0x333333,1,-.75,-.8));
var bc=new THREE.Mesh(new THREE.SphereGeometry(.18,8,8),
new THREE.MeshBasicMaterial({color:0xff2222}));bc.position.set(0,1,-1.5);g.add(bc);
var sl=new THREE.Mesh(new THREE.CylinderGeometry(.25,.35,.4,10),
new THREE.MeshStandardMaterial({color:0xdddddd}));sl.position.set(0,-.9,-1.8);g.add(sl);
var cone=null;
if(SB.engine&&typeof SB.engine.spotCone==='function'){try{cone=SB.engine.spotCone();}catch(e){cone=null;}}
if(!cone){cone=new THREE.Mesh(new THREE.ConeGeometry(6,40,24,1,true),
new THREE.MeshBasicMaterial({color:0xfff2a0,transparent:true,opacity:.25,
side:THREE.DoubleSide,depthWrite:false}));}
else{var pr=cone.geometry&&cone.geometry.parameters;
if(pr){if(pr.height)cone.scale.y=40/pr.height;if(pr.radius){cone.scale.x=6/pr.radius;cone.scale.z=6/pr.radius;}}}
cone.position.y=-20;g.add(cone);
var disc=new THREE.Mesh(new THREE.CircleGeometry(6,24),
new THREE.MeshBasicMaterial({color:0xfff6b0,transparent:true,opacity:.18,depthWrite:false}));
disc.rotation.x=-Math.PI/2;disc.position.y=.15;
if(SB.engine&&SB.engine.scene)SB.engine.scene.add(disc);
g.userData.rotor=rotor;g.userData.tail=tail;g.userData.disc=disc;
return g;}
SB.police=SB.police||{};
var PL=SB.police;
PL.response=[];PL.cops=[];PL.heli=null;PL.roadblock=null;
PL._cruisers=[];PL._updated=false;PL._bustT=0;
PL.stars=function(){return _clamp(SB.state.heat|0,0,5);};
PL.setStars=function(n){SB.state.heat=_clamp(n|0,0,5);PL._syncResponse(true);};
PL.responseList=function(){return PL.response;};
PL._desired=function(){var preset=SB.state.preset||'free',heat=PL.stars();
var d={cruisers:0,heli:false,roadblock:false,foot:0};
if(preset==='cover'){d.cruisers=3;d.heli=true;d.roadblock=true;}
else if(preset==='mission'){d.cruisers=3;d.heli=true;d.roadblock=heat>=4;}
else{d.cruisers=heat;d.heli=heat>=5;d.roadblock=heat>=4;d.foot=heat>=3?(heat>=5?2:1):0;}
return d;};
PL._names=function(){var d=PL._desired(),n=[];
if(d.heli)n.push('GULL-1');
for(var i=0;i<d.cruisers;i++)n.push(UNITS[i]);
if(d.roadblock){n.push('BLOCK-1');n.push('BLOCK-2');}
for(var j=0;j<d.foot;j++)n.push('FOOT-'+(j+1));return n;};
PL._syncResponse=function(force){var names=PL._names(),same=!force&&PL.response.length===names.length;
if(same)for(var i=0;i<names.length;i++)if(PL.response[i].name!==names[i]){same=false;break;}
if(!same){PL.response=names.map(function(nm){
var st=nm==='GULL-1'?'SPOTLIGHT':(nm.indexOf('BLOCK')===0?'ROADBLOCK':'PURSUIT');
return{name:nm,dist:999,status:st};});return;}
var hp=_heroPos();
function dist(px,pz){var dx=px-hp[0],dz=pz-hp[1];return Math.round(Math.sqrt(dx*dx+dz*dz));}
for(var k=0;k<PL.response.length;k++){var e=PL.response[k];
if(e.name==='GULL-1'){e.dist=PL.heli?dist(PL.heli.pos.x,PL.heli.pos.z):999;e.status='SPOTLIGHT';}
else if(e.name.indexOf('BLOCK')===0){var rb=PL.roadblock;
e.dist=rb?dist(rb.cx,rb.cz):999;e.status='ROADBLOCK';}
else if(e.name.indexOf('FOOT')===0){var ci=+e.name.slice(5)-1,c=PL.cops[ci];
e.dist=c?dist(c.pos.x,c.pos.z):999;e.status='PURSUIT';}
else{var idx=UNITS.indexOf(e.name),u=PL._cruisers[idx];
if(!u){e.dist=999;e.status='PURSUIT';}
else{e.dist=u._placed?dist(u.pos.x,u.pos.z):999;e.status=u.status;}}}};
// REQUIRED FLAGS: boss + enforcer in userData — without them a ped CANNOT be
// killed via combat (r5 bug, do not repeat). spawnBoss is the same function.
PL.spawnCop=function(o){o=o||{};
var x=o.x||0,z=o.z||0;
var mesh=null;
if(SB.player&&SB.player.makePedMesh)mesh=SB.player.makePedMesh(o.shirt||0x1e3a5f,o.skin||0x8d5524);
else{mesh=new THREE.Group();mesh.add(_box(.6,.6,.3,o.shirt||0x1e3a5f,0,1.1,0));
mesh.add(_box(.4,.4,.4,o.skin||0x8d5524,0,1.6,0));}
mesh.position.set(x,0,z);mesh.rotation.y=o.heading||0;
mesh.userData={cop:true,boss:!!o.boss,enforcer:!!o.enforcer,hp:o.hp||100,name:o.name||'COP'};
if(SB.engine&&SB.engine.scene)SB.engine.scene.add(mesh);
var e={group:mesh,name:o.name||('FOOT-'+(PL.cops.length+1)),pos:mesh.position,
speed:0,status:'PURSUIT',hp:o.hp||100,userData:mesh.userData};
PL.cops.push(e);return e;};
PL.spawnBoss=PL.spawnCop;
PL.spawnHeli=function(){if(PL.heli)return PL.heli;
var g=mkHeli(),hp=_heroPos();
g.position.set(hp[0]+8,38,hp[1]+10);
if(SB.engine&&SB.engine.scene)SB.engine.scene.add(g);
PL.heli={group:g,unit:'GULL-1',pos:g.position,rotor:g.userData.rotor,
tail:g.userData.tail,disc:g.userData.disc,status:'SPOTLIGHT'};
return PL.heli;};
PL.updateHeli=function(dt){if(!PL.heli)return;var hp=_heroPos(),hh=_heroHeading();
var off=_rot(8,10,hh),tx=hp[0]+off.x,tz=hp[1]+off.z,ty=38;
var p=PL.heli.pos,k=Math.min(1,dt*1.5);
p.x+=(tx-p.x)*k;p.y+=(ty-p.y)*k;p.z+=(tz-p.z)*k;
PL.heli.group.rotation.y=hh;
if(PL.heli.rotor)PL.heli.rotor.rotation.y+=dt*14;
if(PL.heli.tail)PL.heli.tail.rotation.x+=dt*20;
if(PL.heli.disc)PL.heli.disc.position.set(p.x,.15,p.z);};
PL._syncRoadblock=function(on,hx,hz,hh){if(!on){
if(PL.roadblock){if(SB.engine&&SB.engine.scene)SB.engine.scene.remove(PL.roadblock.group);
PL.roadblock=null;}return;}
if(!PL.roadblock){var g=new THREE.Group();
var c1=mkCruiser(),c2=mkCruiser();
c1.position.set(-4.5,0,0);c2.position.set(4.5,0,0);g.add(c1);g.add(c2);
g.add(_box(3.4,.9,.3,0xff7a00,-2.3,.45,.6));g.add(_box(3.4,.9,.3,0xff7a00,2.3,.45,.6));
g.add(_box(3.4,.2,.32,0xffffff,-2.3,.7,.6));g.add(_box(3.4,.2,.32,0xffffff,2.3,.7,.6));
if(SB.engine&&SB.engine.scene)SB.engine.scene.add(g);
PL.roadblock={group:g,cx:hx,cz:hz};}
var f={x:-Math.sin(hh),z:-Math.cos(hh)};
PL.roadblock.group.position.set(hx+f.x*30,0,hz+f.z*30);
PL.roadblock.group.rotation.y=hh+Math.PI;
PL.roadblock.cx=hx+f.x*30;PL.roadblock.cz=hz+f.z*30;};
PL.update=function(dt){dt=_clamp(dt||0,0,.05);
if(!SB.player||!SB.player.hero){PL._syncResponse();return;}
var hp=_heroPos(),hh=_heroHeading(),hx=hp[0],hz=hp[1];
var d=PL._desired(),preset=SB.state.preset||'free';
var heroSp=(SB.state.speedKmh||0)/3.6;
while(PL._cruisers.length<d.cruisers){var i=PL._cruisers.length;
var g=mkCruiser(),off=_rot(i%2?-4:4,10+i*8,hh);
g.position.set(hx+off.x,0,hz+off.z);g.rotation.y=hh;
if(SB.engine&&SB.engine.scene)SB.engine.scene.add(g);
PL._cruisers.push({group:g,unit:UNITS[i],pos:g.position,speed:0,heading:hh,
status:'PURSUIT',_placed:false,_ramAt:-9});}
while(PL._cruisers.length>d.cruisers){var rm=PL._cruisers.pop();
if(SB.engine&&SB.engine.scene)SB.engine.scene.remove(rm.group);}
var esc=SB.city&&SB.city.staging&&SB.city.staging.coverCruisers?SB.city.staging.coverCruisers:[[-5,4],[5.5,6]];
for(var ci=0;ci<PL._cruisers.length;ci++){var u=PL._cruisers[ci];
var ph=Math.floor(SB.state.simTime*3)%2;
if(u.group.userData.barR)u.group.userData.barR.visible=ph===0;
if(u.group.userData.barB)u.group.userData.barB.visible=ph===1;
if(preset==='cover'){var o=ci<2?esc[ci]:[0,-20],rp=_rot(o[0],o[1],hh);
u.pos.x=hx+rp.x;u.pos.z=hz+rp.z;u.heading=hh;u.speed=heroSp;
u.group.rotation.y=hh;u.status=ci===2?'RAMMING':'PURSUIT';u._placed=true;continue;}
var dx=hx-u.pos.x,dz=hz-u.pos.z,dist=Math.sqrt(dx*dx+dz*dz);
if(dist>160){var bo=_rot(ci%2?-6:6,14+ci*6,hh);
u.pos.x=hx+bo.x;u.pos.z=hz+bo.z;dx=hx-u.pos.x;dz=hz-u.pos.z;dist=Math.sqrt(dx*dx+dz*dz);}
var wantH=Math.atan2(-dx,-dz),dh=wantH-u.heading;
while(dh>Math.PI)dh-=Math.PI*2;while(dh<-Math.PI)dh+=Math.PI*2;
u.heading+=_clamp(dh,-2.2*dt,2.2*dt);
var target=dist<7?26:20+PL.stars()*1.5;
u.speed+=_clamp(target-u.speed,-12*dt,12*dt);
u.pos.x+=-Math.sin(u.heading)*u.speed*dt;u.pos.z+=-Math.cos(u.heading)*u.speed*dt;
u.group.rotation.y=u.heading;
u.status=dist<12?'RAMMING':'PURSUIT';u._placed=true;
if(dist<3.4&&SB.state.simTime-u._ramAt>1){u._ramAt=SB.state.simTime;
var onFoot=SB.player.onFoot();
if(onFoot){if(SB.player.damage)SB.player.damage(8);}
else if(SB.vehicles&&SB.vehicles.active){var av=SB.vehicles.active;
av.cond=Math.max(0,av.cond-4);
if(SB.player.damage&&Math.abs(u.speed-heroSp)>10)SB.player.damage(2);}}}
if(d.heli){PL.spawnHeli();PL.updateHeli(dt);}
else if(PL.heli){if(SB.engine&&SB.engine.scene){SB.engine.scene.remove(PL.heli.group);
if(PL.heli.disc)SB.engine.scene.remove(PL.heli.disc);}PL.heli=null;}
PL._syncRoadblock(d.roadblock,hx,hz,hh);
var wantFoot=d.foot;
for(var fi=0;fi<wantFoot;fi++){if(!PL.cops[fi]){var a=1.2+fi*2.4;
PL.spawnCop({x:hx+Math.cos(a)*14,z:hz+Math.sin(a)*14,hp:100,name:'FOOT-'+(fi+1)});}}
for(var cj=0;cj<PL.cops.length;cj++){var cp=PL.cops[cj];
if(!cp.userData||cp.userData.hp<=0)continue;
var cdx=hx-cp.pos.x,cdz=hz-cp.pos.z,cd=Math.sqrt(cdx*cdx+cdz*cdz);
if(cd>2.5){cp.pos.x+=cdx/cd*5.5*dt;cp.pos.z+=cdz/cd*5.5*dt;
cp.group.rotation.y=Math.atan2(-cdx,-cdz);}
if(cd<1.8){cp._hitAt=cp._hitAt||-9;
if(SB.state.simTime-cp._hitAt>1){cp._hitAt=SB.state.simTime;
if(SB.player.damage)SB.player.damage(5);}}
if(!cp.userData.boss&&SB.player.onFoot()&&cd<2.2){PL._bustT+=dt;
if(PL._bustT>2.5){PL._bustT=0;PL.busted();}}else PL._bustT=Math.max(0,PL._bustT-dt);}
var near=PL.heli?true:false;
for(var ni=0;ni<PL._cruisers.length;ni++){var nu=PL._cruisers[ni];
var ndx=nu.pos.x-hx,ndz=nu.pos.z-hz;
if(ndx*ndx+ndz*ndz<625){near=true;break;}}
SB.state.inSight=near;
PL._syncResponse();PL._updated=true;};
PL._reset=function(){var hosp=(SB.city&&SB.city.spawnPoints&&SB.city.spawnPoints.hospital)||[-150,250];
if(SB.player&&SB.player.respawn)SB.player.respawn(hosp[0],hosp[1]);
if(SB.player)SB.player.cash=Math.max(0,Math.floor((SB.player.cash||0)*0.9));
SB.state.cash=Math.max(0,Math.floor((SB.state.cash||0)*0.9));
PL.setStars(0);
while(PL._cruisers.length){var rm=PL._cruisers.pop();
if(SB.engine&&SB.engine.scene)SB.engine.scene.remove(rm.group);}
if(PL.heli){if(SB.engine&&SB.engine.scene){SB.engine.scene.remove(PL.heli.group);
if(PL.heli.disc)SB.engine.scene.remove(PL.heli.disc);}PL.heli=null;}
PL._syncRoadblock(false,0,0,0);
for(var i=0;i<PL.cops.length;i++)if(SB.engine&&SB.engine.scene)SB.engine.scene.remove(PL.cops[i].group);
PL.cops=[];PL._bustT=0;};
PL.busted=function(){PL._reset();};
PL.wasted=function(){PL._reset();};
// Wrap engine.step ONCE (guard SB._b2polStep) so police ticks inside the single
// engine step. main.js must never call PL.update separately (double-step).
PL._installWrap=function(){if(!SB.engine||typeof SB.engine.step!=='function'||SB._b2polStep)return;
SB._b2polStep=true;var orig=SB.engine.step;
SB.engine.step=function(dt){PL.update(dt);return orig.call(SB.engine,dt);};};
PL._installWrap();
PL._syncResponse(true);
