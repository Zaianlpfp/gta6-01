/* Solmar Bay v4 — player: jalan kaki + combat + curi mobil (B2) */
(function(){
var T=SB.THREE,U=SB.util,clamp=U.clamp,P=SB.player;
var WPN=[
 {n:'FISTS',dmg:10,rng:2.4,rate:.45,mag:1/0,res:1/0,auto:0},
 {n:'PISTOL',dmg:25,rng:42,rate:.32,mag:12,res:48,auto:0},
 {n:'SMG',dmg:12,rng:36,rate:.09,mag:32,res:128,auto:1},
 {n:'SHOTGUN',dmg:9,rng:20,rate:.85,mag:6,res:18,auto:0,pel:6},
 {n:'RIFLE',dmg:40,rng:70,rate:.14,mag:30,res:90,auto:1,locked:1}];
P.health=P.health||100;P.armor=P.armor||0;P.cash=(P.cash==null?500:P.cash);
P.weapons=WPN.map(function(w){return{n:w.n,mag:w.mag,res:w.res,locked:!!w.locked};});
P.sel=1;P.aim=P.heading;P.cool=0;P.reloadT=0;P.mouseDown=false;P.dead=false;
P.keys={};P.aimPt=new T.Vector3(0,0,10);P._bustCd=0;
var ray=new T.Raycaster(),ndc=new T.Vector2(0,0),hasMouse=false;
var tracers=[],ti=0;
function mkTracer(){var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,0,0],3));
 var l=new T.Line(g,new T.LineBasicMaterial({color:0xffe08a,transparent:true,opacity:0}));
 SB.scene.add(l);return l;}
function tracer(o,d,rng){if(!SB.scene)return;if(!tracers.length)for(var i=0;i<8;i++)tracers.push(mkTracer());
 var l=tracers[ti++%8],a=l.geometry.attributes.position.array;
 a[0]=o.x;a[1]=o.y;a[2]=o.z;a[3]=o.x+d.x*rng;a[4]=o.y+d.y*rng;a[5]=o.z+d.z*rng;
 l.geometry.attributes.position.needsUpdate=true;l.material.opacity=.9;l.userData.life=.12;}
function ensureMesh(){if(P.mesh||!SB.scene||!SB.city.makePed)return;
 P.mesh=SB.city.makePed('#ffb347');P.onFoot=P.mesh;SB.scene.add(P.mesh);}
function gunTip(){var o=new T.Vector3(P.pos.x,P.pos.y+1.35,P.pos.z);
 if(P.inCar&&P.car){o.set(P.car.position.x,P.car.position.y+1.2,P.car.position.z);}return o;}
function aimDir(o){var d=new T.Vector3(P.aimPt.x-o.x,0,P.aimPt.z-o.z);
 if(d.lengthSq()<.01||!hasMouse)d.set(Math.sin(P.aim),0,Math.cos(P.aim));
 d.normalize();return d;}
function cands(){var a=[],i,m,u,c;
 for(i=0;i<SB.city.peds.length;i++){m=SB.city.peds[i];
  if(!m.userData.dead){if(m.userData.hp==null)m.userData.hp=30;a.push({p:m.position,o:m.userData,k:'ped',m:m});}}
 if(SB.police)for(i=0;i<SB.police.units.length;i++){u=SB.police.units[i];
  if(u.kind!=='heli'&&u.hp>0)a.push({p:u.mesh.position,o:u,k:'cop',m:u.mesh});}
 for(i=0;i<SB.city.traffic.length;i++){c=SB.city.traffic[i];
  if(c.userData.hp==null)c.userData.hp=60;
  if(c.userData.hp>0&&c!==P.car)a.push({p:c.position,o:c.userData,k:'car',m:c});}
 return a;}
function kill(t){if(t.k==='ped'){t.o.dead=true;t.m.rotation.x=-Math.PI/2;
  if(t.o.boss||t.o.name==='Saltjack'||t.o.id==='saltjack'){
   if(SB.missions&&typeof SB.missions.standoffDown==='function')SB.missions.standoffDown();}
  SB.fx.puff(t.p.x,1,t.p.z,0xaa2222);}
 else if(t.k==='cop'){t.m.rotation.x=-Math.PI/2;SB.fx.puff(t.p.x,1,t.p.z,0xaa2222);}
 else if(t.k==='car'){t.o.cond=0;t.o.status='WRECKED';t.o.speed=0;SB.fx.puff(t.p.x,1.5,t.p.z,0x333333);}}
function hit(o,d,w){var best=null,ba=.32,i,c,v,dist,ang;
 var cs=cands();
 for(i=0;i<cs.length;i++){c=cs[i];
  v=new T.Vector3(c.p.x-o.x,(c.p.y+1.1)-o.y,c.p.z-o.z);dist=v.length();
  if(dist>w.rng||dist<.01)continue;v.divideScalar(dist);
  ang=Math.acos(clamp(v.x*d.x+v.y*d.y+v.z*d.z,-1,1));
  if(ang<ba||dist<3){if(!best||ang<best.a)best={c:c,a:ang,dist:dist};}}
 if(!best)return;
 best.c.o.hp-=w.dmg;
 if(best.c.k==='car'){best.c.o.cond=Math.max(0,best.c.o.cond-w.dmg);
  if(best.c.o.cond<70){best.c.o.dented=true;best.c.o.status='DENTED';}}
 if(best.c.o.hp<=0)kill(best.c);}
P.shoot=function(){var w=WPN[P.sel];
 if(P.cool>0||P.reloadT>0||P.dead)return;
 if(w.mag!==1/0&&P.weapons[P.sel].mag<=0){P.reload();return;}
 P.cool=w.rate;
 if(w.mag!==1/0)P.weapons[P.sel].mag--;
 var o=gunTip(),d=aimDir(o),n=w.pel||1,i;
 for(i=0;i<n;i++)hit(o,d,w);
 SB.fx.flash(o.x,o.y,o.z,0xffc860);
 if(SB._mz)SB._mz.position.set(o.x+d.x*2,o.y+1.2,o.z+d.z*2);
 tracer(o,d,w.rng);};
P.reload=function(){var w=WPN[P.sel],s=P.weapons[P.sel];
 if(w.mag===1/0||P.reloadT>0||s.mag>=w.mag||s.res<=0)return;
 P.reloadT=w.n==='SHOTGUN'?1.2:.9;};
P.setWeapon=function(i){if(i<0||i>4)return;
 if(P.weapons[i].locked)return;P.sel=i;};
P.setAim=function(x,z){P.aimPt.set(x,0,z);hasMouse=true;
 P.aim=Math.atan2(x-P.pos.x,z-P.pos.z);};
P.damage=function(a){if(P.dead)return;
 var ab=Math.min(P.armor,a*.6);P.armor-=ab;P.health-=(a-ab);
 if(P.health<=0){P.health=0;P.dead=true;
  if(SB.police)SB.police.wasted();}};
P.enterCar=function(car){if(!car||P.inCar)return;
 if(SB.vehicles)SB.vehicles.steal(car);
 P.car=car;P.inCar=true;SB.cam.mode='chase';
 if(P.mesh)P.mesh.visible=false;};
P.exitCar=function(){if(!P.inCar||!P.car)return;
 var c=P.car,r={x:-Math.cos(P.heading),z:Math.sin(P.heading)};
 P.pos.set(c.position.x+r.x*2.6,0,c.position.z+r.z*2.6);
 P.car=null;P.inCar=false;SB.cam.mode='foot';
 if(P.mesh)P.mesh.visible=true;};
function tryEnter(){if(P.inCar){P.exitCar();return;}
 if(!SB.vehicles)return;var c=SB.vehicles.nearby(P.pos,5);
 if(c)P.enterCar(c);}
function move(dt){var k=P.keys;
 var fx=P.pos.x-SB.camera.position.x,fz=P.pos.z-SB.camera.position.z;
 var L=Math.sqrt(fx*fx+fz*fz)||1;fx/=L;fz/=L;
 var rx=-fz,rz=fx;
 var fw=(k.KeyW||k.ArrowUp?1:0)-(k.KeyS||k.ArrowDown?1:0);
 var rt=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0);
 var mx=fx*fw+rx*rt,mz=fz*fw+rz*rt,ml=Math.sqrt(mx*mx+mz*mz);
 if(ml>.01){mx/=ml;mz/=ml;
  var sp=(k.ShiftLeft||k.ShiftRight)?7.5:4.2;
  P.pos.x+=mx*sp*dt;P.pos.z+=mz*sp*dt;
  var H=SB.world.half-4;P.pos.x=clamp(P.pos.x,-H,H);P.pos.z=clamp(P.pos.z,-H,H);
  P.heading=Math.atan2(mx,mz);P.speed=sp;}
 else P.speed=0;
 if(hasMouse){ray.setFromCamera(ndc,SB.camera);
  var ro=ray.ray.origin,rd=ray.ray.direction;
  if(rd.y<-.01){var t=-ro.y/rd.y;
   P.aimPt.set(ro.x+rd.x*t,0,ro.z+rd.z*t);
   P.aim=Math.atan2(P.aimPt.x-P.pos.x,P.aimPt.z-P.pos.z);}}}
P.update=function(dt){if(SB.state.paused)return;
 if(P._bustCd>0)P._bustCd-=dt;
 P.cool-=dt;
 if(P.reloadT>0){P.reloadT-=dt;
  if(P.reloadT<=0){var w=WPN[P.sel],s=P.weapons[P.sel];
   var need=w.mag-s.mag,take=Math.min(need,s.res);s.mag+=take;s.res-=take;}}
 for(var i=0;i<tracers.length;i++){var l=tracers[i];
  if(l.userData.life>0){l.userData.life-=dt;l.material.opacity=Math.max(0,l.userData.life/.12)*.9;}}
 if(P.dead)return;
 if(P.inCar){if(P.mouseDown&&P.cool<=0)P.shoot();
  if(P.mesh)P.mesh.visible=false;return;}
 ensureMesh();move(dt);
 if(P.mesh){P.mesh.position.copy(P.pos);P.mesh.rotation.y=P.aim;}
 if(P.mouseDown){var w=WPN[P.sel];if(w.auto&&P.cool<=0)P.shoot();}};
function stage(n){ensureMesh();
 if(P.mesh){P.mesh.position.copy(P.pos);P.mesh.visible=!P.inCar;}
 if(n==='onfoot')SB.cam.mode='foot';
 else if(n==='cover'||n==='mission')SB.cam.mode='chase';}
var prev=SB.engine.setPreset;
SB.engine.setPreset=function(n,o){prev.call(SB.engine,n,o);stage(n);};
addEventListener('keydown',function(e){P.keys[e.code]=true;
 if(e.repeat)return;
 if(e.code==='KeyE')tryEnter();
 else if(e.code==='KeyR')P.reload();
 else if(e.code==='Digit1')P.setWeapon(0);
 else if(e.code==='Digit2')P.setWeapon(1);
 else if(e.code==='Digit3')P.setWeapon(2);
 else if(e.code==='Digit4')P.setWeapon(3);});
addEventListener('keyup',function(e){P.keys[e.code]=false;});
addEventListener('mousemove',function(e){ndc.x=(e.clientX/innerWidth)*2-1;
 ndc.y=-(e.clientY/innerHeight)*2+1;hasMouse=true;});
addEventListener('mousedown',function(e){if(e.button!==0)return;
 P.mouseDown=true;P.shoot();});
addEventListener('mouseup',function(e){if(e.button===0)P.mouseDown=false;});
if(!SB._b2step){SB._b2step=1;var _s=SB.engine.step;
 SB.engine.step=function(dt){_s.call(SB.engine,dt);
  if(!SB.state.paused){
   if(SB.player.update)SB.player.update(dt);
   if(SB.vehicles&&SB.vehicles.update)SB.vehicles.update(dt);
   if(SB.police&&SB.police.update)SB.police.update(dt);}};}
})();
