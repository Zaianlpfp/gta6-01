// player.js — Solmar Bay r10 (B2). r10: retype r9; B2 OWNS SB.input (r8: none existed, speed stuck 0);
// movement substeps full wall dt. Pistol 34 -> boss dies 7th shot; shotgun 120 -> 2 shots.
var SB=(typeof window!=='undefined'&&window.SB)?window.SB:globalThis.SB;
var THREE=(typeof window!=='undefined'&&window.THREE)?window.THREE:globalThis.THREE;
var WEAPONS={
1:{n:'fists',dmg:12,rate:.35,range:2.5,max:Infinity},
2:{n:'pistol',dmg:34,rate:.22,range:40,max:12,res:48},
3:{n:'smg',dmg:22,rate:.09,range:30,max:32,res:128},
4:{n:'shotgun',dmg:120,rate:.8,range:24,max:6,res:18},
5:{n:'rifle',dmg:60,rate:.15,range:48,max:30,res:90,locked:true}};
var WALK=4,RUN=7;
function _clamp(v,a,b){return v<a?a:v>b?b:v;}
function _angDiff(a,b){var d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;}
function _fwd(h){return{x:-Math.sin(h),z:-Math.cos(h)};}
// Input (B2 owns it); a harness-provided SB.input is kept as-is.
SB.input=SB.input||{};
var IN=SB.input;
IN.keys=IN.keys||{};IN.mouse=IN.mouse||{down:false};
if(typeof IN.axis!=='function')IN.axis=function(){var k=IN.keys,x=0,y=0;
if(k.KeyD||k.ArrowRight)x+=1;if(k.KeyA||k.ArrowLeft)x-=1;
if(k.KeyW||k.ArrowUp)y+=1;if(k.KeyS||k.ArrowDown)y-=1;return{x:x,y:y};};
if(typeof IN.isDown!=='function')IN.isDown=function(c){return!!IN.keys[c];};
if(typeof document!=='undefined'&&document.addEventListener&&!SB._b2input){
SB._b2input=true;
function _kd(e){IN.keys[e.code]=e.type==='keydown';}
function _md(e){IN.mouse.down=e.type==='mousedown';}
document.addEventListener('keydown',_kd);
document.addEventListener('keyup',_kd);
document.addEventListener('mousedown',_md);
document.addEventListener('mouseup',_md);
if(typeof window!=='undefined'&&window.addEventListener)
window.addEventListener('blur',function(){for(var k in IN.keys)IN.keys[k]=false;});}
SB._blocked=SB._blocked||function(x,z){
if(typeof SB.isBlocked==='function'){try{return SB.isBlocked(x,z,1.2);}catch(e){}}
var c=SB.city&&(SB.city.colliders||SB.city.buildings);
if(c)for(var i=0;i<c.length;i++){var b=c[i],x0,x1,z0,z1;
if(b.x0!==undefined){x0=b.x0;x1=b.x1;z0=b.z0;z1=b.z1;}
else{var cx=b.cx!==undefined?b.cx:b.x,cz=b.cz!==undefined?b.cz:b.z,w=b.w||10,d=b.d||10;
x0=cx-w/2;x1=cx+w/2;z0=cz-d/2;z1=cz+d/2;}
if(x>x0-0.6&&x<x1+0.6&&z>z0-0.6&&z<z1+0.6)return true;}
return false;};
SB._clampPos=SB._clampPos||function(x,z){
var b=(SB.city&&SB.city.bounds)||{minX:-560,maxX:470,minZ:-470,maxZ:530};
return{x:_clamp(x,b.minX,b.maxX),z:_clamp(z,b.minZ,b.maxZ)};};
function _box(w,h,d,c,x,y,z){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
new THREE.MeshStandardMaterial({color:c,roughness:.85}));m.position.set(x,y,z);return m;}
function mkPed(shirt,skin){var g=new THREE.Group();
var legL=_box(.22,.8,.24,0x222831,-.14,.4,0),legR=_box(.22,.8,.24,0x222831,.14,.4,0);
var torso=_box(.62,.6,.34,shirt,0,1.1,0);
var armL=_box(.16,.62,.2,shirt,-.4,1.1,0),armR=_box(.16,.62,.2,shirt,.4,1.1,0);
var head=_box(.42,.42,.4,skin,0,1.62,0);
var cap=_box(.46,.12,.44,0x111827,0,1.86,0);
g.add(legL);g.add(legR);g.add(torso);g.add(armL);g.add(armR);g.add(head);g.add(cap);
g.userData.limbs={legL:legL,legR:legR,armL:armL,armR:armR};return g;}
SB.player=SB.player||{};
var P=SB.player;
P.cash=500;P.health=100;P.armor=0;P.weapon=1;
P.ammo={1:{mag:Infinity,res:Infinity},2:{mag:12,res:48},3:{mag:32,res:128},
4:{mag:6,res:18},5:{mag:0,res:0,locked:true}};
P.hero=null;P._px=0;P._pz=60;P._heading=0;P._cool=0;P._prev={};P._wasted=false;
P.makePedMesh=mkPed;
P._sync=function(){SB.state.health=P.health;SB.state.armor=P.armor;
var w={};for(var k in WEAPONS){var a=P.ammo[k];w[WEAPONS[k].n]={ammo:a.mag,reserve:a.res};}
SB.state.weapons=w;};
P.pos=function(){var v=SB.vehicles&&SB.vehicles.active;
if(v&&v.pos)return[v.pos.x,v.pos.z];return[P._px,P._pz];};
P.heading=function(){var v=SB.vehicles&&SB.vehicles.active;
if(v)return v.heading;return P._heading;};
P.onFoot=function(){return!(SB.vehicles&&SB.vehicles.active);};
P.setPosition=function(x,z,h){var c=SB._clampPos(x,z);x=c.x;z=c.z;
if(h===undefined)h=P._heading;
var v=SB.vehicles&&SB.vehicles.active;
if(v){v.pos.x=x;v.pos.z=z;v.heading=h;v.mesh.position.set(x,0,z);v.mesh.rotation.y=h;}
P._px=x;P._pz=z;P._heading=h;
if(P.hero){P.hero.position.set(x,0,z);P.hero.rotation.y=h;}};
P.create=function(spawn){var preset=SB.state.preset||'free';
var sp=(SB.city&&SB.city.spawnPoints&&SB.city.spawnPoints[preset])||null;
var x=0,z=60;if(sp){x=sp[0];z=sp[1];}else if(spawn){x=spawn.x||0;z=spawn.z||60;}
if(!P.hero){P.hero=mkPed(0xff6b5e,0xc68642);
if(SB.engine&&SB.engine.scene)SB.engine.scene.add(P.hero);}
P._px=x;P._pz=z;P._heading=0;P._wasted=false;P.health=100;P.armor=0;
P.hero.position.set(x,0,z);P.hero.rotation.y=0;P.hero.visible=true;
if(SB.vehicles&&SB.vehicles.spawnParked)SB.vehicles.spawnParked();
if((preset==='cover'||preset==='mission')&&SB.vehicles&&SB.vehicles.pinkCar){
var pc=SB.vehicles.pinkCar;pc.pos.x=x;pc.pos.z=z;pc.heading=0;
pc.mesh.position.set(x,0,z);pc.mesh.rotation.y=0;P.enterVehicle(pc);}
P._sync();P._installWrap();return P.hero;};
P.enterVehicle=function(v){if(!v||!P.hero)return false;
if(v.parked&&SB.vehicles&&!SB.vehicles._owned[v.id]){
SB.vehicles._owned[v.id]=1;
if(SB.police&&SB.police.setStars)SB.police.setStars(Math.min(5,SB.police.stars()+1));
else SB.state.heat=Math.min(5,(SB.state.heat|0)+1);}
SB.vehicles.active=v;P.hero.visible=false;return true;};
P.exitVehicle=function(){var v=SB.vehicles&&SB.vehicles.active;if(!v||!P.hero)return false;
var r={x:Math.cos(v.heading),z:-Math.sin(v.heading)};
var nx=v.pos.x+r.x*2.4,nz=v.pos.z+r.z*2.4;
if(SB._blocked(nx,nz)){nx=v.pos.x-r.x*2.4;nz=v.pos.z-r.z*2.4;}
if(SB._blocked(nx,nz)){nx=v.pos.x;nz=v.pos.z;}
var c=SB._clampPos(nx,nz);P._px=c.x;P._pz=c.z;P._heading=v.heading;
P.hero.position.set(c.x,0,c.z);P.hero.rotation.y=v.heading;P.hero.visible=true;
SB.vehicles.active=null;SB.state.speedKmh=0;SB.state.vehicleName='—';
SB.state.vehicleCond=100;SB.state.vehicleStatus='OK';return true;};
P.damage=function(n){if(n<=0||P._wasted)return;
var a=Math.min(P.armor,n);P.armor-=a;n-=a;P.health-=n;P._sync();
if(P.health<=0){P.health=0;P._sync();P._wasted=true;
if(SB.police&&SB.police.wasted)SB.police.wasted();}};
P.respawn=function(x,z){P._wasted=false;P.health=100;P.armor=0;
if(SB.vehicles)SB.vehicles.active=null;
P.setPosition(x,z,0);if(P.hero)P.hero.visible=true;P._sync();};
P.selectWeapon=function(n){n=+n;if(!WEAPONS[n]||WEAPONS[n].locked)return false;
P.weapon=n;P._sync();return true;};
P.weaponName=function(){return WEAPONS[P.weapon].n;};
P.reload=function(){var w=WEAPONS[P.weapon];if(!w||w.max===Infinity)return false;
var a=P.ammo[P.weapon],need=w.max-a.mag,take=Math.min(need,a.res);
if(take<=0)return false;a.mag+=take;a.res-=take;P._sync();return true;};
function _collectTargets(){var out=[];
function seen(o){for(var i=0;i<out.length;i++)if(out[i].obj===o)return true;return false;}
function add(o,needFlag){if(!o||seen(o))return;var g=o.group||o.mesh||o;
var u=g.userData||o.userData||{};
var hp=typeof u.hp==='number'?u.hp:(typeof o.hp==='number'?o.hp:NaN);
if(!(hp>0))return;
if(needFlag&&!(u.boss||u.enforcer||u.hostile||u.cop))return;
out.push({obj:o,grp:g,ud:u,hp:hp});}
function scan(a,needFlag){if(a)for(var i=0;i<a.length;i++)add(a[i],needFlag);}
scan(SB.police&&SB.police.cops,false);
scan(SB.missions&&SB.missions.standoffPeds,false);
scan(SB.missions&&SB.missions.standoff,false);
scan(SB.world&&SB.world.hostiles,false);
scan(SB.world&&SB.world.peds,true);
if(SB.engine&&SB.engine.scene&&SB.engine.scene.traverse)
SB.engine.scene.traverse(function(o){
if(o&&o.userData&&typeof o.userData.hp==='number')add(o,true);});
return out;}
P.fire=function(target){var w=WEAPONS[P.weapon];if(!w)return{hit:false};
var v=SB.vehicles&&SB.vehicles.active;
var ox,oz,h;if(v&&v.pos){ox=v.pos.x;oz=v.pos.z;h=v.heading;}
else{ox=P._px;oz=P._pz;h=P._heading;}
var f=_fwd(h),mx=ox+f.x*(v?2.2:.9),my=v?1.2:1.35,mz=oz+f.z*(v?2.2:.9);
if(SB.engine&&SB.engine.muzzlePos&&SB.engine.muzzlePos.set)SB.engine.muzzlePos.set(mx,my,mz);
if(SB.engine&&typeof SB.engine.burst==='function')SB.engine.burst(mx,my,mz,3);
if(w.max!==Infinity){var a=P.ammo[P.weapon];
if(a.mag<=0){P.reload();if(a.mag<=0)return{hit:false,dry:true};}a.mag--;P._sync();}
var t=null;
if(target){var g=target.group||target.mesh||target;var u=g.userData||target.userData||{};
var hp=typeof u.hp==='number'?u.hp:target.hp;
if(typeof hp==='number'&&hp>0)t={obj:target,grp:g,ud:u,hp:hp};}
if(!t){var list=_collectTargets(),best=null,bestD=1e9,inCone=null,inConeD=1e9;
for(var i=0;i<list.length;i++){var c=list[i],p=c.grp.position||c.obj.pos||{x:0,z:0};
var dx=(p.x!==undefined?p.x:0)-ox,dz=(p.z!==undefined?p.z:0)-oz;
var d=Math.sqrt(dx*dx+dz*dz);if(d>w.range)continue;
var dot=d>0?(dx*f.x+dz*f.z)/d:1;
if(dot>0.4&&d<inConeD){inCone=c;inConeD=d;}
if(d<bestD){best=c;bestD=d;}}
t=inCone||best;}
if(!t)return{hit:false};
var dmg=w.dmg,hp2;
if(typeof t.ud.hp==='number'){t.ud.hp-=dmg;hp2=t.ud.hp;}
else{t.obj.hp-=dmg;hp2=t.obj.hp;}
if(typeof t.obj.hp==='number'&&t.obj!==t.grp)t.obj.hp=hp2;
var killed=hp2<=0;
if(killed){t.grp.visible=false;
if(t.ud.boss&&SB.missions&&typeof SB.missions.standoffDown==='function')
SB.missions.standoffDown();}
return{hit:true,killed:killed,dmg:dmg,boss:!!t.ud.boss,enforcer:!!t.ud.enforcer};}
P._pressed=function(c){var d=IN.isDown(c),was=P._prev[c];P._prev[c]=d;return d&&!was;};
// Substep full wall dt in 1/60 slices (r8 clamped dt to 0.05: at 1fps sim ran 20x slow).
// Discrete input once per call; at dt=1/60 identical to r8.
P._tick=function(dt){if(!P.hero)return;
var D=dt||0;if(D>1)D=1;if(D<0)D=0;P._cool-=D;
if(IN.isDown('Digit1'))P.selectWeapon(1);if(IN.isDown('Digit2'))P.selectWeapon(2);
if(IN.isDown('Digit3'))P.selectWeapon(3);if(IN.isDown('Digit4'))P.selectWeapon(4);
if(P._pressed('KeyR'))P.reload();
if(P._pressed('KeyE')){if(P.onFoot()){
var nv=SB.vehicles?SB.vehicles.nearest(P._px,P._pz,4.5):null;
if(nv)P.enterVehicle(nv);}else P.exitVehicle();}
var ax=IN.axis(),rem=D;
while(rem>1e-9){var h=rem>1/60?1/60:rem;rem-=h;
if(P.onFoot()){var run=IN.isDown('ShiftLeft')||IN.isDown('ShiftRight'),sp=run?RUN:WALK;
var f=_fwd(P._heading),r={x:Math.cos(P._heading),z:-Math.sin(P._heading)};
var dx=f.x*ax.y+r.x*ax.x,dz=f.z*ax.y+r.z*ax.x;
var len=Math.sqrt(dx*dx+dz*dz),moving=len>0.05;
if(moving){dx/=len;dz/=len;
var nh=Math.atan2(-dx,-dz);
P._heading+=_angDiff(P._heading,nh)*Math.min(1,h*12);
var nx=P._px+dx*sp*h,nz=P._pz+dz*sp*h;
if(!SB._blocked(nx,P._pz))P._px=nx;if(!SB._blocked(P._px,nz))P._pz=nz;
var c=SB._clampPos(P._px,P._pz);P._px=c.x;P._pz=c.z;
var sw=Math.sin(SB.state.simTime*9)*0.55,l=P.hero.userData.limbs;
if(l){l.legL.rotation.x=sw;l.legR.rotation.x=-sw;l.armL.rotation.x=-sw;l.armR.rotation.x=sw;}}
else{var l2=P.hero.userData.limbs;
if(l2){l2.legL.rotation.x=0;l2.legR.rotation.x=0;l2.armL.rotation.x=0;l2.armR.rotation.x=0;}}
P.hero.position.set(P._px,0,P._pz);P.hero.rotation.y=P._heading;}
else if(SB.vehicles&&SB.vehicles.update)SB.vehicles.update(h);}
if(SB.input&&SB.input.mouse&&SB.input.mouse.down&&P._cool<=0){
P.fire();P._cool=WEAPONS[P.weapon].rate;}
if(SB.vehicles&&SB.vehicles._trafficTick)SB.vehicles._trafficTick(D);
if((SB.state.preset==='cover'||SB.state.preset==='onfoot'||SB.state.preset==='mission')&&!SB._b2traf&&SB.vehicles&&SB.vehicles.spawnTraffic){
// r10 integrator: traffic hanya spawn di cover (r9) -> jalan onfoot/mission
// kosong, pixel-diff ~0. Sekarang spawn juga di onfoot/mission.
SB._b2traf=true;SB.vehicles.spawnTraffic(24);}
if(P.health<=0&&!P._wasted){P._wasted=true;
if(SB.police&&SB.police.wasted)SB.police.wasted();}};
P.update=P._tick;
// Wrap engine.step ONCE (SB._b2step guard).
P._installWrap=function(){if(!SB.engine||typeof SB.engine.step!=='function'||SB._b2step)return;
SB._b2step=true;var orig=SB.engine.step;
SB.engine.step=function(dt){P._tick(dt);return orig.call(SB.engine,dt);};};
P._installWrap();
P._sync();
