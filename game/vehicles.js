// vehicles.js — Solmar Bay r11 (B2). Hero magenta + white roof; traffic never pink, 12m+ from hero.
// Driving substeps full wall dt. Speeds m/s (HUD km/h).
var SB=(typeof window!=='undefined'&&window.SB)?window.SB:globalThis.SB;
var THREE=(typeof window!=='undefined'&&window.THREE)?window.THREE:globalThis.THREE;
var KINDS={sport:{name:'VENTO STRADA',color:0x38bdf8,top:55,acc:16},
muscle:{name:'SOLMAR GT',color:0xff6b35,top:48,acc:14},
sedan:{name:'PALMERA LX',color:0x3fa7d6,top:42,acc:12},
taxi:{name:'SOLMAR CAB',color:0xffc300,top:42,acc:12},
truck:{name:'BAYLINE HAULER',color:0x8a8f98,top:32,acc:9},
van:{name:'MERCADO VAN',color:0x7fb069,top:36,acc:10}};
function _clamp(v,a,b){return v<a?a:v>b?b:v;}
function _box(w,h,d,c,x,y,z){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
new THREE.MeshStandardMaterial({color:c,roughness:.8}));m.position.set(x,y,z);return m;}
function mkCar(kind,color){var g=new THREE.Group();
var c=color!==undefined?color:(KINDS[kind]||KINDS.sedan).color;
g.add(_box(2,.65,4.2,c,0,.68,0));
g.add(_box(1.7,.55,2,0x1a202c,0,1.28,.15));
var wg=new THREE.CylinderGeometry(.36,.36,.3,10);
var wm=new THREE.MeshStandardMaterial({color:0x111111,roughness:.95});
[[-.95,1.35],[.95,1.35],[-.95,-1.35],[.95,-1.35]].forEach(function(p){
var w=new THREE.Mesh(wg,wm);w.rotation.z=Math.PI/2;w.position.set(p[0],.36,p[1]);g.add(w);});
g.add(_box(.35,.15,.1,0xfff2b0,-.6,.7,-2.12));g.add(_box(.35,.15,.1,0xfff2b0,.6,.7,-2.12));
g.add(_box(.35,.15,.1,0xff2222,-.6,.7,2.12));g.add(_box(.35,.15,.1,0xff2222,.6,.7,2.12));
g.userData.kind=kind;return g;}
function _rp(rd,s,lane,len){var dx=rd.x1-rd.x0,dz=rd.z1-rd.z0,L=len||1;
var ux=dx/L,uz=dz/L;return{x:rd.x0+ux*s*L-uz*lane,z:rd.z0+uz*s*L+ux*lane};}
SB.vehicles=SB.vehicles||{};
var V=SB.vehicles;
V.list=V.list||[];V.traffic=V.traffic||[];V.active=null;V.pinkCar=null;
V._owned={};V._vid=0;
V.makeCarMesh=mkCar;
V.create=function(kind,x,z,heading,opts){opts=opts||{};
var k=KINDS[kind]||KINDS.sedan;
var mesh=mkCar(kind,opts.color!==undefined?opts.color:k.color);
mesh.position.set(x,0,z);mesh.rotation.y=heading||0;
if(SB.engine&&SB.engine.scene)SB.engine.scene.add(mesh);
var v={id:'v'+(++V._vid),mesh:mesh,group:mesh,name:opts.name||k.name,kind:kind,
color:opts.color!==undefined?opts.color:k.color,cond:100,parked:!!opts.parked,
pos:mesh.position,heading:heading||0,speed:0,top:k.top,acc:k.acc};
V.list.push(v);return v;};
// Spots[0] = pink hero car (magenta + white roof, owned from spawn; entering it is never theft).
V.spawnParked=function(){if(SB._b2parked)return;SB._b2parked=true;
var spots=[['sport',8,60,0],['sedan',-8,-40,Math.PI],['taxi',108,150,Math.PI/2],
['muscle',-92,-150,0],['van',250,60,-Math.PI/2],['truck',350,450,Math.PI],
['sport',-450,100,Math.PI/2],['sedan',50,-350,Math.PI],['muscle',-250,-250,0],
['taxi',150,250,-Math.PI/2]];
for(var i=0;i<spots.length;i++){var s=spots[i];
var v=V.create(s[0],s[1],s[2],s[3],i===0?{parked:true,color:0xff2e88}:{parked:true});
if(i===0){V.pinkCar=v;V._owned[v.id]=1;
var rp=new THREE.Mesh(new THREE.BoxGeometry(1.1,.07,1.9),
new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5}));
rp.position.set(0,1.59,.15);v.mesh.add(rp);}}
if(!V.pinkCar&&V.list.length)V.pinkCar=V.list[0];};
V.spawnTraffic=function(n){n=n||24;if(V.traffic.length>=n)return;
var roads=SB.city&&SB.city.roads;
var colors=[0x3fa7d6,0xffc300,0x7fb069,0xe8e8e8,0x222831,0xff6b35];
var kinds=['sedan','sedan','taxi','muscle','van','sport','truck'];
while(V.traffic.length<n){var rd=null;
if(roads&&roads.length)rd=SB.randPick?SB.randPick(roads):roads[V.traffic.length%roads.length];
if(!rd)rd={x0:-400,z0:0,x1:400,z1:0};
var len=Math.sqrt((rd.x1-rd.x0)*(rd.x1-rd.x0)+(rd.z1-rd.z0)*(rd.z1-rd.z0))||1;
var s=SB.rand?SB.rand():0.5;
var lane=V.traffic.length%2?2.5:-2.5;
var hp=SB.player&&SB.player.pos?SB.player.pos():null;
if(hp){var pp=_rp(rd,s,lane,len),ddx=pp.x-hp[0],ddz=pp.z-hp[1];
if(ddx*ddx+ddz*ddz<144)s=(s+.5)%1;}
var kind=SB.randPick?SB.randPick(kinds):kinds[V.traffic.length%kinds.length];
var col=SB.randPick?SB.randPick(colors):colors[V.traffic.length%colors.length];
var mesh=mkCar(kind,col);if(SB.engine&&SB.engine.scene)SB.engine.scene.add(mesh);
var dir=SB.rand?SB.rand()<0.5?1:-1:1;
V.traffic.push({mesh:mesh,road:rd,s:s,dir:dir,len:len,
speed:8+(SB.rand?SB.rand()*6:3),lane:lane});}};
V._trafficTick=function(dt){dt=dt||0;if(dt>1)dt=1;if(dt<0)dt=0;
for(var i=0;i<V.traffic.length;i++){var t=V.traffic[i];
t.s+=t.dir*t.speed*dt/t.len;if(t.s>1){t.s=1;t.dir=-1;}if(t.s<0){t.s=0;t.dir=1;}
var p=_rp(t.road,t.s,t.lane,t.len);
t.mesh.position.set(p.x,0,p.z);
var r=t.road,dx=r.x1-r.x0,dz=r.z1-r.z0,L=t.len||1;
var hx=dx/L*t.dir,hz=dz/L*t.dir;t.mesh.rotation.y=Math.atan2(-hx,-hz);}};
function _gear(kmh,sp){if(sp<-0.5)return'R';if(kmh<1)return'N';
if(kmh<40)return'G1';if(kmh<80)return'G2';if(kmh<120)return'G3';if(kmh<160)return'G4';return'G5';}
V.update=function(dt){var v=V.active;if(!v)return;
var D=dt||0;if(D>1)D=1;if(D<0)D=0;
var ax={x:0,y:0};if(SB.input&&typeof SB.input.axis==='function')ax=SB.input.axis();
else{var k=SB.input?SB.input.keys:{};if(k.KeyD||k.ArrowRight)ax.x+=1;
if(k.KeyA||k.ArrowLeft)ax.x-=1;if(k.KeyW||k.ArrowUp)ax.y+=1;if(k.KeyS||k.ArrowDown)ax.y-=1;}
var hand=!!(SB.input&&SB.input.keys&&(SB.input.keys.Space));
var nitro=!!(SB.input&&SB.input.keys&&(SB.input.keys.ShiftLeft||SB.input.keys.ShiftRight));
var rem=D;
while(rem>1e-9){var h=rem>1/60?1/60:rem;rem-=h;
var sp0=v.speed,top=v.top*(nitro?1.15:1);
if(v.cond<=0){v.speed*=Math.max(0,1-2*h);}
else if(ax.y>0)v.speed+=v.acc*(nitro?1.6:1)*ax.y*h;
else if(ax.y<0){if(v.speed>0.5)v.speed-=22*h;else v.speed+=v.acc*0.6*ax.y*h;}
else{v.speed-=v.speed*0.25*h;if(Math.abs(v.speed)<0.4)v.speed=0;}
if(hand)v.speed*=Math.max(0,1-3*h);
if(v.speed>top)v.speed=top;if(v.speed<-10)v.speed=-10;
var sf=_clamp(Math.abs(v.speed)/10,0,1)*(v.speed<0?-1:1);
v.heading-=ax.x*2*(hand?1.5:1)*sf*h;
var fx=-Math.sin(v.heading),fz=-Math.cos(v.heading);
var nx=v.pos.x+fx*v.speed*h,nz=v.pos.z+fz*v.speed*h;
if(SB._blocked&&SB._blocked(nx,nz)){
var hard=Math.abs(sp0)>14;
v.speed*=-0.3;v.cond=Math.max(0,v.cond-3);
if(hard&&SB.player&&SB.player.damage)SB.player.damage(6);}
else{v.pos.x=nx;v.pos.z=nz;
var c=SB._clampPos?SB._clampPos(v.pos.x,v.pos.z):{x:v.pos.x,z:v.pos.z};
v.pos.x=c.x;v.pos.z=c.z;}
for(var i=0;i<V.traffic.length;i++){var t=V.traffic[i],p=t.mesh.position;
var ddx=p.x-v.pos.x,ddz=p.z-v.pos.z,d2=ddx*ddx+ddz*ddz;
if(d2<9&&d2>0.01){var d=Math.sqrt(d2);p.x+=ddx/d*1.5;p.z+=ddz/d*1.5;
v.speed*=0.85;v.cond=Math.max(0,v.cond-1);}}
v.mesh.position.set(v.pos.x,0,v.pos.z);v.mesh.rotation.y=v.heading;}
var kmh=Math.abs(v.speed)*3.6;
SB.state.speedKmh=Math.round(kmh*10)/10;SB.state.gear=_gear(kmh,v.speed);
SB.state.vehicleName=v.name;SB.state.vehicleCond=Math.round(v.cond);
SB.state.vehicleStatus=v.cond<70?'DENTED':'OK';};
V.setSpeedKmh=function(kmh){kmh=+kmh||0;SB.state.speedKmh=kmh;
var v=V.active;if(v){v.speed=kmh/3.6;SB.state.gear=_gear(kmh,v.speed);
SB.state.vehicleName=v.name;SB.state.vehicleCond=Math.round(v.cond);
SB.state.vehicleStatus=v.cond<70?'DENTED':'OK';}
else SB.state.gear=_gear(kmh,kmh/3.6);
return kmh;};
V.steal=function(v){if(!v)return false;
if(SB.police&&SB.police.setStars)SB.police.setStars(Math.min(5,SB.police.stars()+1));
else SB.state.heat=Math.min(5,(SB.state.heat|0)+1);return true;};
V.nearest=function(x,z,maxD){var best=null,bd=maxD||4.5;
for(var i=0;i<V.list.length;i++){var v=V.list[i];
var dx=v.pos.x-x,dz=v.pos.z-z,d=Math.sqrt(dx*dx+dz*dz);
if(d<bd){bd=d;best=v;}}return best;};
