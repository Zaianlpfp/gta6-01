/* Solmar Bay v4 — vehicles: handling + kondisi + curi mobil (B2) */
(function(){
var U=SB.util,clamp=U.clamp,P=SB.player;
var SPECS={
 sport:{acc:16,top:62,name:'VENTO STRADA',col:0xd8282e},
 sedan:{acc:11,top:46,name:'SOLMAR SEDAN',col:0x2f6fd0},
 taxi:{acc:11,top:47,name:'BAY TAXI',col:0xf2b705},
 van:{acc:8,top:35,name:'CARGO VAN',col:0x8a8f96},
 truck:{acc:7,top:31,name:'HAULER 900',col:0x4a5a3a},
 police:{acc:13,top:54,name:'PD CRUISER',col:0xe8ecf2}};
var V=SB.vehicles={cars:[],cruiseKmh:151};
V.spec=function(t){return SPECS[t]||SPECS.sedan;};
function fix(u,t){u.type=t;u.name=SPECS[t].name;
 if(u.cond==null)u.cond=100;if(u.speed==null)u.speed=0;
 if(u.heading==null)u.heading=0;if(u.hp==null)u.hp=100;
 if(u.dented==null)u.dented=false;if(u.status==null)u.status='OK';
 if(u.stolen==null)u.stolen=false;}
V.spawn=function(type,x,z){var s=SPECS[type]||SPECS.sedan;
 var c=SB.city.makeCar(s.col,type);fix(c.userData,type);
 c.userData.kind='player';
 c.position.set(x==null?P.pos.x+Math.sin(P.heading)*3:x,0,
  z==null?P.pos.z+Math.cos(P.heading)*3:z);
 c.rotation.y=P.heading;SB.scene.add(c);V.cars.push(c);return c;};
V.nearby=function(pos,r){var best=null,bd=r*r,i,c,dx,dz,d;
 function chk(a){for(i=0;i<a.length;i++){c=a[i];
  if(c.userData.status==='WRECKED')continue;
  dx=c.position.x-pos.x;dz=c.position.z-pos.z;d=dx*dx+dz*dz;
  if(d<bd){bd=d;best=c;}}}
 chk(SB.city.traffic);chk(V.cars);return best;};
V.steal=function(car){if(!car)return car;fix(car.userData,car.userData.type||'sedan');
 if(!car.userData.stolen){car.userData.stolen=true;
  if(SB.police)SB.police.addHeat(25);
  else SB.state.heat=Math.min(100,SB.state.heat+25);}
 car.userData.kind='player';return car;};
V.damage=function(car,amt){if(!car)return;var u=car.userData;fix(u,u.type||'sedan');
 if(u.status==='WRECKED')return;
 u.cond=Math.max(0,u.cond-amt);u.hp=Math.max(0,u.hp-amt);
 if(u.cond<70){u.dented=true;u.status='DENTED';}
 if(u.cond<=0){u.status='WRECKED';u.speed=0;}};
V.setSpeedKmh=function(kmh){V.cruiseKmh=kmh;
 if(P.car){P.car.userData.speed=kmh/3.6;SB.state.speed=kmh;}};
function drive(dt){var c=P.car;if(!c)return;var u=c.userData,s=V.spec(u.type);
 var k=P.keys,th=0;
 if(k.KeyW||k.ArrowUp)th=1;else if(k.KeyS||k.ArrowDown)th=-1;
 if(!th){var tgt=(SB.state.scene==='cover'?V.cruiseKmh:
   SB.state.scene==='mission'?62:0)/3.6;
  if(u.speed<tgt-.5)th=1;else if(u.speed>tgt+.5)th=-.4;}
 if(th>0)u.speed=Math.min(u.speed+s.acc*th*dt,s.top);
 else if(th<0){if(u.speed>.5)u.speed=Math.max(u.speed+s.acc*th*dt*1.4,0);
  else u.speed=Math.max(u.speed-6*dt,-8);}
 else if(!((SB.state.scene==='cover'||SB.state.scene==='mission')
  &&Math.abs(u.speed-tgt)<=.5))u.speed*=Math.max(0,1-.6*dt);
 if(u.hitCd>0)u.hitCd-=dt;
 var st=((k.KeyA||k.ArrowLeft)?1:0)-((k.KeyD||k.ArrowRight)?1:0);
 var sf=clamp(Math.abs(u.speed)/8,0,1);
 u.heading+=st*1.9*sf*dt*(u.speed<0?-1:1);
 var nx=c.position.x+Math.sin(u.heading)*u.speed*dt,
     nz=c.position.z+Math.cos(u.heading)*u.speed*dt,i,t,dx,dz;
 function bump(m){dx=nx-m.position.x;dz=nz-m.position.z;
  if(dx*dx+dz*dz<16){var od=Math.sqrt(dx*dx+dz*dz)||.01,ps=4-od;
   m.position.x+=Math.sin(u.heading)*ps;m.position.z+=Math.cos(u.heading)*ps;
   if(u.hitCd<=0){u.speed*=.8;V.damage(c,6);u.hitCd=.6;
    SB.fx.puff(nx,1,nz,0x888888);}}}
 for(i=0;i<SB.city.traffic.length;i++){t=SB.city.traffic[i];if(t!==c)bump(t);}
 if(SB.police)for(i=0;i<SB.police.units.length;i++){
  var pu=SB.police.units[i];
  if(pu.kind==='cruiser'&&pu.hp>0)bump(pu.mesh);}
 var H=SB.world.half-6;
 if(nx<-H||nx>H||nz<-H||nz>H){u.speed*=.4;V.damage(c,4);
  nx=clamp(nx,-H,H);nz=clamp(nz,-H,H);}
 c.position.x=nx;c.position.z=nz;c.rotation.y=u.heading;
 P.pos.set(nx,0,nz);P.heading=u.heading;P.speed=Math.abs(u.speed);
 SB.state.speed=Math.abs(u.speed)*3.6;
 u.gear=1+Math.min(4,Math.floor(Math.abs(u.speed)/s.top*5));
 if(Math.abs(u.speed)>20&&SB.rand(0,1)<.12)
  SB.fx.puff(nx-Math.sin(u.heading)*2.2,.4,nz-Math.cos(u.heading)*2.2,0x888888);}
V.update=function(dt){if(SB.state.paused)return;
 if(P.inCar&&P.car)drive(dt);
 else SB.state.speed=P.speed*3.6;};
function stage(n){if(n==='cover'||n==='mission'){
  if(P.car)fix(P.car.userData,P.car.userData.type||'sport');
  else{P.car=V.spawn('sport');P.inCar=true;}
  SB.cam.mode='chase';
  if(n==='cover')V.setSpeedKmh(151);else V.setSpeedKmh(40);}
 else if(n==='onfoot'){P.inCar=false;}}
var prev=SB.engine.setPreset;
SB.engine.setPreset=function(n,o){prev.call(SB.engine,n,o);stage(n);};
})();
