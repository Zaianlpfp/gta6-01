/* Solmar Bay v4 — police: wanted + cruiser + foot cop + heli AIR-1 (B2) */
(function(){
var U=SB.util,clamp=U.clamp,P=SB.player;
var NAMES=['MARLIN-11','TARPON-18','SNAPPER-25','HERON-17','IBIS-43','KESTREL-31'];
var PL=SB.police={units:[],heli:null,response:[],hiddenT:0,respT:0,
 lastEvent:'',lastSeen:{x:0,z:0},_cd:0};
PL.pts=0;PL._ls=-1;
function sync(){var h=SB.state.heat;
 if(PL._ls<0||h!==PL._ls){PL.pts=h<=5?h*20:h;PL._ls=clamp(Math.ceil(PL.pts/20),0,5);}}
PL.stars=function(){sync();return PL._ls;};
function wr(){SB.state.heat=clamp(Math.ceil(PL.pts/20),0,5);PL._ls=SB.state.heat;}
PL.addHeat=function(n){sync();PL.pts=clamp(PL.pts+n,0,100);wr();};
PL.setStars=function(s){PL.pts=clamp(s,0,5)*20;wr();};
function turnTo(cur,tgt,ms){var d=((tgt-cur+Math.PI*3)%(Math.PI*2))-Math.PI;
 return cur+clamp(d,-ms,ms);}
function clearUnits(){var i;
 for(i=0;i<PL.units.length;i++)SB.scene.remove(PL.units[i].mesh);
 PL.units=[];if(PL.heli){SB.scene.remove(PL.heli.mesh);PL.heli=null;}
 PL.response=[];}
function spawnCruiser(name,x,z,parked){var c=SB.city.makeCar(0xe8ecf2,'police');
 var u=c.userData;u.kind='police';u.type='police';u.hp=100;u.speed=0;
 u.heading=SB.rand(0,Math.PI*2);u.cond=100;u.status='OK';u.dented=false;
 c.position.set(x,0,z);c.rotation.y=u.heading;SB.scene.add(c);
 var un={kind:'cruiser',name:name,mesh:c,hp:100,speed:0,heading:u.heading,
  status:parked?'ROADBLOCK':'PURSUIT',parked:!!parked,cool:0};
 PL.units.push(un);return un;}
function spawnFoot(x,z){var m=SB.city.makePed('#1c2f6e');
 m.position.set(x,0,z);SB.scene.add(m);
 var un={kind:'foot',name:'PD-'+SB.ri(10,99),mesh:m,hp:40,speed:0,
  heading:0,status:'PURSUIT',cool:0};
 PL.units.push(un);return un;}
function hoverY(){return SB.state.scene==='cover'?14:20;}
function spawnHeli(){var g=SB.city.makeHeli();
 g.position.set(P.pos.x+Math.sin(P.heading)*24,hoverY(),P.pos.z+Math.cos(P.heading)*24);
 SB.scene.add(g);
 PL.heli={kind:'heli',name:'GULL-1',mesh:g,hp:200,speed:0,heading:0,status:'SPOTLIGHT'};
 return PL.heli;}
PL.stage=function(){clearUnits();
 var st=PL.stars(),sc=SB.state.scene,i,a,d;
 var nc=sc==='cover'?3:st>=4?3:st>=2?2:st>=1?1:0;
 for(i=0;i<nc;i++){a=SB.rand(0,Math.PI*2);d=SB.ri(18,30);
  spawnCruiser(NAMES[i%NAMES.length],
   clamp(P.pos.x+Math.sin(a)*d,-260,260),clamp(P.pos.z+Math.cos(a)*d,-260,260),false);}
 var nf=sc==='onfoot'?2:st>=3?2:st>=1?1:0;
 for(i=0;i<nf;i++){a=SB.rand(0,Math.PI*2);d=SB.ri(8,14);
  spawnFoot(clamp(P.pos.x+Math.sin(a)*d,-260,260),clamp(P.pos.z+Math.cos(a)*d,-260,260));}
 if(st>=3||sc==='cover')spawnHeli();
 if(st>=4||sc==='cover'){var fx=Math.sin(P.heading),fz=Math.cos(P.heading);
  var px=P.pos.x+fx*35,pz=P.pos.z+fz*35;
  spawnCruiser(NAMES[3],px-fz*3.5,pz+fx*3.5,true);
  spawnCruiser(NAMES[4],px+fz*3.5,pz-fx*3.5,true);}};
function respawn(n,msg){PL.lastEvent=msg;
 P.cash=Math.floor(P.cash*.9);PL.pts=0;SB.state.heat=0;PL._ls=0;
 if(P.inCar){P.inCar=false;P.car=null;if(P.mesh)P.mesh.visible=true;}
 var lm=SB.city.lm.hospital;if(lm)P.pos.set(lm.x,0,lm.z);
 P.health=100;P.armor=0;P.speed=0;P.dead=false;clearUnits();}
PL.bust=function(){if(PL._cd>0)return;PL._cd=3;respawn(0,'BUSTED');};
PL.wasted=function(){if(PL._cd>0)return;PL._cd=3;respawn(0,'WASTED');};
function shootCop(u,dt){u.cool-=dt;
 if(u.cool<=0&&!P.dead){u.cool=.55;P.damage(7);
  SB.fx.flash(u.mesh.position.x,1.4,u.mesh.position.z,0xffc860);}}
function updCruiser(u,dt){var m=u.mesh,dx=P.pos.x-m.position.x,dz=P.pos.z-m.position.z;
 var dist=Math.sqrt(dx*dx+dz*dz),st=PL.stars();
 if(u.cool>0)u.cool-=dt;
 if(u.parked){u.status='ROADBLOCK';
  if(dist<10)u.parked=false;return;}
 var want=Math.atan2(dx,dz);
 u.heading=turnTo(u.heading,want,2.4*dt);
 var top=Math.min(14+st*3,20);
 if(dist<7){u.status='RAMMING';u.speed=Math.min(u.speed+6*dt,top+4);}
 else{u.status='PURSUIT';u.speed=Math.min(u.speed+10*dt,top);}
 if(dist<3.5&&u.cool<=0){u.cool=.8;u.speed*=.5;
  if(P.inCar&&P.car){SB.vehicles.damage(P.car,6);P.car.userData.speed*=.7;}
  else if(!P.dead)P.damage(12);
  SB.fx.puff(m.position.x,1,m.position.z,0x888888);}
 m.position.x+=Math.sin(u.heading)*u.speed*dt;
 m.position.z+=Math.cos(u.heading)*u.speed*dt;
 var H=SB.world.half-6;
 m.position.x=clamp(m.position.x,-H,H);m.position.z=clamp(m.position.z,-H,H);
 m.rotation.y=u.heading;u.mesh.userData.speed=u.speed;}
function updFoot(u,dt){var m=u.mesh,dx=P.pos.x-m.position.x,dz=P.pos.z-m.position.z;
 var dist=Math.sqrt(dx*dx+dz*dz),st=PL.stars();
 if(dist>1){u.heading=Math.atan2(dx,dz);
  var sp=dist<14?5.2:3.5;
  m.position.x+=Math.sin(u.heading)*sp*dt;
  m.position.z+=Math.cos(u.heading)*sp*dt;}
 m.rotation.y=u.heading;u.status='PURSUIT';
 if(dist<1.6){if(st<=2&&!P.inCar)PL.bust();else if(st>=3)shootCop(u,dt);}
 else if(dist<14&&st>=3)shootCop(u,dt);}
function updHeli(dt){var h=PL.heli;if(!h)return;var m=h.mesh;
 var tx,tz;
 if(PL.hiddenT>2){var a=SB.state.t*.5;
  tx=PL.lastSeen.x+Math.sin(a)*25;tz=PL.lastSeen.z+Math.cos(a)*25;
  h.status='SEARCH';}
 else{tx=P.pos.x+Math.sin(P.heading)*24;tz=P.pos.z+Math.cos(P.heading)*24;
  var dx=P.pos.x-m.position.x,dz=P.pos.z-m.position.z;
  h.status=Math.sqrt(dx*dx+dz*dz)<32?'SPOTLIGHT':'SEARCH';}
 var dx=tx-m.position.x,dz=tz-m.position.z,dy=hoverY()-m.position.y;
 var d=Math.sqrt(dx*dx+dz*dz+dy*dy);
 if(d>.1){var sp=Math.min(12+d*2,90),s=Math.min(sp*dt,d);
  m.position.x+=dx/d*s;m.position.y+=dy/d*s;m.position.z+=dz/d*s;}
 m.rotation.y+=dt*.8;}
PL.update=function(dt){if(SB.state.paused)return;
 if(PL._cd>0)PL._cd-=dt;
 var st=PL.stars();
 if(st>0&&!PL.units.length&&!PL.heli)PL.stage();
 if(st===0&&PL.units.length){clearUnits();return;}
 var i,u,dmin=1e9;
 for(i=0;i<PL.units.length;i++){u=PL.units[i];
  if(u.hp<=0)continue;
  var dx=P.pos.x-u.mesh.position.x,dz=P.pos.z-u.mesh.position.z;
  var d=Math.sqrt(dx*dx+dz*dz);if(d<dmin)dmin=d;
  if(u.kind==='cruiser')updCruiser(u,dt);else updFoot(u,dt);}
 if(PL.heli){updHeli(dt);
  var dx=P.pos.x-PL.heli.mesh.position.x,dz=P.pos.z-PL.heli.mesh.position.z;
  dmin=Math.min(dmin,Math.sqrt(dx*dx+dz*dz));}
 if(dmin>45){PL.hiddenT+=dt;
  if(PL.hiddenT>4){PL.pts=Math.max(0,PL.pts-5*dt);wr();}}
 else{PL.hiddenT=0;PL.lastSeen.x=P.pos.x;PL.lastSeen.z=P.pos.z;}
 PL.respT+=dt;
 if(PL.respT>.25){PL.respT=0;var r=[];
  if(PL.heli)r.push({name:'GULL-1',dist:Math.round(
   Math.sqrt(Math.pow(P.pos.x-PL.heli.mesh.position.x,2)+
   Math.pow(P.pos.z-PL.heli.mesh.position.z,2))),status:PL.heli.status});
  var tmp=PL.units.slice().sort(function(a,b){
   var da=Math.hypot(P.pos.x-a.mesh.position.x,P.pos.z-a.mesh.position.z);
   var db=Math.hypot(P.pos.x-b.mesh.position.x,P.pos.z-b.mesh.position.z);
   return da-db;});
  for(i=0;i<tmp.length;i++){u=tmp[i];
   r.push({name:u.name,dist:Math.round(
    Math.hypot(P.pos.x-u.mesh.position.x,P.pos.z-u.mesh.position.z)),
    status:u.status});}
  PL.response=r;}};
var prev=SB.engine.setPreset;
SB.engine.setPreset=function(n,o){prev.call(SB.engine,n,o);PL.stage();};
})();
