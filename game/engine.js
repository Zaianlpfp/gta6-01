/* engine.js — Solmar Bay v4 engine: renderer, sky, light, camera, presets (B1) */
(function(){'use strict';
var T=window.THREE;
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
var SB=window.SB={};window.SB=SB;
SB.THREE=T;
SB.util={clamp:function(v,a,b){return v<a?a:(v>b?b:v);},lerp:function(a,b,k){return a+(b-a)*k;},mulberry32:mb};
SB.rng=mb(1337);
SB.rand=function(a,b){return a+SB.rng()*(b-a);};
SB.ri=function(a,b){return Math.floor(SB.rand(a,b+1));};
SB.pick=function(q){return q[Math.floor(SB.rng()*q.length)];};
SB.state={scene:'cover',heat:0,tod:'sunset',t:0,day:1,clock:1044,paused:false,speed:0};
SB.world={size:560,half:280,beachX:-190,seaX:-255};
SB.city={group:null,districts:[],roads:[],buildings:[],traffic:[],peds:[],palms:null,neons:[],signs:{},lm:{},heli:null};
SB.player={pos:new T.Vector3(0,0,40),heading:Math.PI,speed:0,inCar:true,car:null,mesh:null,onFoot:null};
SB.cam={mode:'fixed',pos:new T.Vector3(),tgt:new T.Vector3(),update:function(){}};
SB.sky={set:function(){},sun:new T.Vector3(-1,.2,0),clouds:[],stars:null};
SB.fx={pool:[],li:0,update:function(){},flash:function(){},puff:function(){}};
SB.engine={init:function(){},bootFromQuery:function(){},setPreset:function(){},step:function(){},render:function(){},resize:function(){}};

/* ---- canvas textures ---- */
function cv(w,h,fn){var c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);return new T.CanvasTexture(c);}
function glowTex(a,b){return cv(128,128,function(g){var r=g.createRadialGradient(64,64,2,64,64,64);r.addColorStop(0,a);r.addColorStop(1,b);g.fillStyle=r;g.fillRect(0,0,128,128);});}
function cloudTex(){return cv(256,128,function(g){g.clearRect(0,0,256,128);for(var i=0;i<9;i++){var x=30+SB.rng()*196,y=45+SB.rng()*38,r=22+SB.rng()*26;var gr=g.createRadialGradient(x,y,2,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.85)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}});}
function smokeTex(){return cv(64,64,function(g){var r=g.createRadialGradient(32,32,2,32,32,30);r.addColorStop(0,'rgba(200,200,200,.8)');r.addColorStop(1,'rgba(200,200,200,0)');g.fillStyle=r;g.fillRect(0,0,64,64);});}

/* ---- sky ---- */
var skyMat,skyMesh,sunCore,sunGlow,moonSpr,cloudSprs=[];
var PAL={
 sunset:{top:0x35205e,mid:0xff7a4d,bot:0xffd27a,fog:0xdd8256,hemiS:0x9a76c0,hemiG:0x4a2f28,hemi:.95,sunC:0xffb36b,sunI:1.7,sunD:[-.55,.15,-.45],amb:0x403060,ambI:.35,stars:0,sunS:1},
 night:{top:0x05081a,mid:0x0e1e42,bot:0x27395e,fog:0x0d1526,hemiS:0x2a3c66,hemiG:0x0a0f1e,hemi:.5,sunC:0x8fb0e8,sunI:.5,sunD:[.4,.55,-.5],amb:0x1a2440,ambI:.5,stars:.9,sunS:.6},
 day:{top:0x2f7fd0,mid:0x7ec3ee,bot:0xffe9b0,fog:0xbcd8ee,hemiS:0xbcd8ff,hemiG:0x6a7a5a,hemi:1,sunC:0xfff2cc,sunI:1.9,sunD:[.35,.75,.3],amb:0x8090a0,ambI:.25,stars:0,sunS:.7}};
SB.sky.set=function(tod){
 var p=PAL[tod]||PAL.sunset;SB.state.tod=tod;
 skyMat.uniforms.cTop.value.setHex(p.top);skyMat.uniforms.cMid.value.setHex(p.mid);skyMat.uniforms.cBot.value.setHex(p.bot);
 SB.scene.fog.color.setHex(p.fog);
 SB._hemi.color.setHex(p.hemiS);SB._hemi.groundColor.setHex(p.hemiG);SB._hemi.intensity=p.hemi;
 SB._sun.color.setHex(p.sunC);SB._sun.intensity=p.sunI;
 SB._sun.position.set(p.sunD[0]*260,p.sunD[1]*260,p.sunD[2]*260);
 SB._amb.color.setHex(p.amb);SB._amb.intensity=p.ambI;
 var d=new T.Vector3(p.sunD[0],p.sunD[1],p.sunD[2]).normalize();SB.sky.sun.copy(d);
 sunCore.position.copy(d).multiplyScalar(780);sunGlow.position.copy(sunCore.position);
 sunCore.scale.set(52*p.sunS,52*p.sunS,1);sunGlow.scale.set(190*p.sunS,190*p.sunS,1);
 sunCore.visible=sunGlow.visible=(tod!=='night');
 moonSpr.visible=(tod==='night');moonSpr.position.set(320,430,-390);
 if(SB.sky.stars)SB.sky.stars.material.opacity=p.stars;
 for(var i=0;i<cloudSprs.length;i++){var m=cloudSprs[i].material;m.color.setHex(tod==='night'?0x8a94b8:(tod==='day'?0xffffff:0xffd9c0));m.opacity=tod==='night'?.5:.85;}
};
function buildSky(){
 skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,
  uniforms:{cTop:{value:new T.Color(0x35205e)},cMid:{value:new T.Color(0xff7a4d)},cBot:{value:new T.Color(0xffd27a)}},
  vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 vP;uniform vec3 cTop,cMid,cBot;void main(){float h=normalize(vP).y;vec3 c=h>.12?mix(cMid,cTop,smoothstep(.12,.65,h)):mix(cBot,cMid,smoothstep(-.08,.12,h));gl_FragColor=vec4(c,1.);}'});
 skyMesh=new T.Mesh(new T.SphereGeometry(900,24,16),skyMat);SB.scene.add(skyMesh);
 var gt=glowTex('rgba(255,244,214,1)','rgba(255,150,50,0)');
 sunGlow=new T.Sprite(new T.SpriteMaterial({map:gt,transparent:true,depthWrite:false,fog:false}));SB.scene.add(sunGlow);
 sunCore=new T.Sprite(new T.SpriteMaterial({map:glowTex('rgba(255,252,240,1)','rgba(255,220,140,0)'),transparent:true,depthWrite:false,fog:false}));SB.scene.add(sunCore);
 moonSpr=new T.Sprite(new T.SpriteMaterial({map:glowTex('rgba(230,238,255,1)','rgba(180,200,255,0)'),transparent:true,depthWrite:false,fog:false}));
 moonSpr.scale.set(70,70,1);SB.scene.add(moonSpr);
 var ct=cloudTex(),i;
 for(i=0;i<14;i++){var s=new T.Sprite(new T.SpriteMaterial({map:ct,transparent:true,opacity:.85,depthWrite:false}));
  s.position.set(SB.rand(-520,520),SB.rand(95,180),SB.rand(-520,320));
  s.scale.set(SB.rand(70,160),SB.rand(26,48),1);SB.scene.add(s);cloudSprs.push(s);}
 SB.sky.clouds=cloudSprs;
 var n=320,pos=new Float32Array(n*3);
 for(i=0;i<n;i++){var a=SB.rand(0,Math.PI*2),e=SB.rand(.15,1.4),r=850;pos[i*3]=Math.cos(a)*Math.cos(e)*r;pos[i*3+1]=Math.sin(e)*r;pos[i*3+2]=Math.sin(a)*Math.cos(e)*r;}
 var g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));
 SB.sky.stars=new T.Points(g,new T.PointsMaterial({color:0xffffff,size:1.8,sizeAttenuation:false,transparent:true,opacity:0,fog:false}));
 SB.scene.add(SB.sky.stars);
}

/* ---- fx pool ---- */
var fxLight;
function buildFx(){
 var gt=glowTex('rgba(255,220,140,1)','rgba(255,140,40,0)'),st=smokeTex();
 for(var i=0;i<24;i++){var s=new T.Sprite(new T.SpriteMaterial({map:gt,transparent:true,depthWrite:false,opacity:0}));
  s.visible=false;SB.scene.add(s);SB.fx.pool.push({spr:s,life:0,max:1,grow:0,rise:0});}
 fxLight=new T.PointLight(0xffc860,0,26,2);SB.scene.add(fxLight);
 SB.fx._gt=gt;SB.fx._st=st;
 SB._mz=new T.Sprite(new T.SpriteMaterial({map:gt,transparent:true,depthWrite:false,opacity:0}));
 SB._mz.visible=false;SB.scene.add(SB._mz);
}
SB.fx.flash=function(x,y,z,c){
 var e=SB.fx.pool[SB.fx.li++%24];e.spr.visible=true;e.spr.position.set(x,y,z);
 e.spr.material.map=SB.fx._gt;e.spr.material.color.setHex(c||0xffc860);
 e.spr.scale.set(4,4,1);e.spr.material.opacity=1;e.life=e.max=.12;e.grow=30;e.rise=0;
 fxLight.position.set(x,y,z);fxLight.intensity=5;
};
SB.fx.puff=function(x,y,z){
 var e=SB.fx.pool[SB.fx.li++%24];e.spr.visible=true;e.spr.position.set(x,y,z);
 e.spr.material.map=SB.fx._st;e.spr.material.color.setHex(0x888888);
 e.spr.scale.set(1.5,1.5,1);e.spr.material.opacity=.55;e.life=e.max=.9;e.grow=4;e.rise=2.2;
};
SB.fx.update=function(dt){
 for(var i=0;i<SB.fx.pool.length;i++){var e=SB.fx.pool[i];if(e.life<=0)continue;
  e.life-=dt;var k=Math.max(e.life/e.max,0);e.spr.material.opacity=k*(e.max===.12?1:.55);
  var s=e.spr.scale.x+e.grow*dt;e.spr.scale.set(s,s,1);e.spr.position.y+=e.rise*dt;
  if(e.life<=0)e.spr.visible=false;}
 if(fxLight.intensity>0)fxLight.intensity=Math.max(0,fxLight.intensity-dt*42);
};

/* ---- camera ---- */
SB.cam.update=function(dt){
 var c=SB.camera,p=SB.player,m=SB.cam.mode;
 if(m==='chase'&&p.car){var f=new T.Vector3(Math.sin(p.heading),0,Math.cos(p.heading));
  var want=new T.Vector3().copy(p.car.position).addScaledVector(f,-11);want.y=5;
  c.position.lerp(want,Math.min(1,dt*5));
  c.lookAt(p.car.position.x+f.x*14,2.2,p.car.position.z+f.z*14);}
 else if(m==='foot'){var f2=new T.Vector3(Math.sin(p.heading),0,Math.cos(p.heading));
  var w2=new T.Vector3().copy(p.pos).addScaledVector(f2,-6.5);w2.y=3.4;
  c.position.lerp(w2,Math.min(1,dt*6));
  c.lookAt(p.pos.x+f2.x*9,1.7,p.pos.z+f2.z*9);}
};
function placeCam(a,t){SB.camera.position.set(a[0],a[1],a[2]);SB.camera.lookAt(t[0],t[1],t[2]);SB.cam.pos.copy(SB.camera.position);SB.cam.tgt.set(t[0],t[1],t[2]);}

/* ---- presets ---- */
var PRE={
 cover:{tod:'sunset',heat:4,mode:'fixed',cam:[11,7.5,66],tgt:[-8,4,-14],car:[0,0,40,Math.PI],heli:[-8,36,2],traffic:26,peds:24,cops:3,speed:38,area:[0,10,130]},
 onfoot:{tod:'night',heat:3,mode:'foot',cam:[-2,4.5,129],tgt:[0,2,105],foot:[0,0,120,Math.PI],traffic:10,peds:28,cops:0,speed:0,flash:1,area:[-10,130,50]},
 mission:{tod:'sunset',heat:3,mode:'fixed',cam:[66,9,-18],tgt:[110,8,-52],car:[58,0,-40,Math.PI/2],heli:[80,42,-75],traffic:18,peds:16,cops:1,speed:24,area:[70,-50,90]},
 map:{tod:'sunset',heat:0,mode:'aerial',cam:[0,520,2],tgt:[0,0,0],traffic:14,peds:10,cops:0,speed:0},
 night:{tod:'night',heat:2,mode:'fixed',cam:[80,7,34],tgt:[98,5,-85],car:[84,0,-12,Math.PI],traffic:20,peds:18,cops:1,speed:18,area:[90,-40,90]},
 title:{tod:'sunset',heat:0,mode:'fixed',cam:[188,30,72],tgt:[-260,16,-12],traffic:12,peds:8,cops:0,speed:0}};
SB.engine.setPreset=function(n,o){
 o=o||{};var P=PRE[n]||PRE.cover;
 SB.state.scene=n;SB.state.heat=(o.heat!=null?o.heat:P.heat);
 SB.sky.set(o.tod||P.tod);
 SB.scene.fog.near=P.mode==='aerial'?500:180;SB.scene.fog.far=P.mode==='aerial'?1200:520;
 SB.sky.clouds.forEach(function(c){c.visible=P.mode!=='aerial';});
 SB.city.clearCrowd();
 SB.city.spawnTraffic(P.traffic,P.area);SB.city.spawnPeds(P.peds,P.area);
 var C=SB.city;
 if(P.car){if(!SB.player.car){SB.player.car=C.makeCar(0xd21f3c,'sport');SB.scene.add(SB.player.car);}
  var cp=P.car;SB.player.car.position.set(cp[0],0,cp[2]);SB.player.car.rotation.y=cp[3];
  SB.player.car.userData.speed=P.speed;SB.player.car.userData.heading=cp[3];
  SB.player.inCar=true;SB.player.heading=cp[3];SB.player.pos.set(cp[0],0,cp[2]);SB.state.speed=P.speed;
  SB.player.car.visible=true;}
 else if(SB.player.car)SB.player.car.visible=false;
 if(P.foot){var f=P.foot;SB.player.inCar=false;SB.player.heading=f[3];SB.player.pos.set(f[0],0,f[2]);
  if(!SB.player.mesh){SB.player.mesh=C.makePed(0x2fae7d);SB.scene.add(SB.player.mesh);}
  SB.player.mesh.position.copy(SB.player.pos);SB.player.mesh.rotation.y=f[3];SB.player.mesh.visible=true;SB.state.speed=0;}
 else if(SB.player.mesh)SB.player.mesh.visible=false;
 if(P.heli){if(!C.heli){C.heli=C.makeHeli();SB.scene.add(C.heli);}
  C.heli.position.set(P.heli[0],P.heli[1],P.heli[2]);C.heli.visible=true;}
 else if(C.heli)C.heli.visible=false;
 var offs=[-12,-22,16];
 for(var i=0;i<(P.cops||0);i++){var cop=C.makeCar(0x1c2f6e,'police');
  var lane=i%2?6:-6,back=offs[i]||-14;
  var base=P.car?P.car:[0,0,0,Math.PI];
  cop.position.set(base[0]+Math.cos(base[3])*lane-Math.sin(base[3])*back,0,base[2]-Math.sin(base[3])*lane-Math.cos(base[3])*back);
  cop.rotation.y=base[3];cop.userData.still=true;cop.userData.speed=0;
  SB.scene.add(cop);C.traffic.push(cop);}
 SB.cam.mode=P.mode;
 SB.camera.up.set(0,1,0);
 if(P.mode==='aerial')SB.camera.up.set(0,0,-1);
 placeCam(P.cam,P.tgt);
 SB._fph=-1;
};
SB.engine.init=function(o){
 o=o||{};
 var r=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 r.setSize(innerWidth,innerHeight);r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 r.outputEncoding=T.sRGBEncoding;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
 r.domElement.id='c';r.domElement.style.cssText='position:fixed;inset:0;display:block';
 document.body.appendChild(r.domElement);SB.renderer=r;
 var s=new T.Scene();SB.scene=s;s.fog=new T.Fog(0xdd8256,180,520);
 SB.camera=new T.PerspectiveCamera(62,innerWidth/innerHeight,.5,2200);
 SB._hemi=new T.HemisphereLight(0x9a76c0,0x4a2f28,.95);s.add(SB._hemi);
 SB._sun=new T.DirectionalLight(0xffb36b,1.7);SB._sun.castShadow=true;
 SB._sun.shadow.mapSize.set(1024,1024);
 var sc=SB._sun.shadow.camera;sc.left=-170;sc.right=170;sc.top=170;sc.bottom=-170;sc.far=700;
 SB._sun.shadow.bias=-.0006;s.add(SB._sun);s.add(SB._sun.target);
 SB._amb=new T.AmbientLight(0x403060,.35);s.add(SB._amb);
 buildSky();buildFx();
 SB.city.build();
 this.setPreset(o.scene||'cover',{heat:o.heat,tod:o.tod});
 addEventListener('resize',function(){SB.engine.resize();});
};
SB.engine.step=function(dt){
 SB.state.t+=dt;SB.state.stepN=(SB.state.stepN||0)+1;
 SB.state.clock=(1044+Math.floor(SB.state.t/4))%1440;
 for(var i=0;i<cloudSprs.length;i++){var c=cloudSprs[i];c.position.x+=dt*1.6;if(c.position.x>560)c.position.x=-560;}
 if(SB.state.scene==='onfoot'&&SB._mz){var mn=SB.state.stepN%45;
  var fx2=Math.sin(SB.player.heading),fz=Math.cos(SB.player.heading);
  SB._mz.position.set(SB.player.pos.x+fx2*8,1.7,SB.player.pos.z+fz*8);
  SB._mz.visible=mn<6;SB._mz.material.opacity=mn<6?1-mn/6:0;
  var ms=3+mn*.8;SB._mz.scale.set(ms,ms,1);}
 SB.city.update(dt);SB.fx.update(dt);SB.cam.update(dt);
};
SB.engine.render=function(){SB.renderer.render(SB.scene,SB.camera);};
SB.engine.resize=function(){SB.camera.aspect=innerWidth/innerHeight;SB.camera.updateProjectionMatrix();SB.renderer.setSize(innerWidth,innerHeight);};
SB.engine.bootFromQuery=function(){
 var q=new URLSearchParams(location.search);
 var seed=parseInt(q.get('seed')||'1337',10);SB.rng=mb(seed);
 var sc=q.get('scene')||'cover',shot=q.get('shot')==='1';
 var heat=q.get('heat'),tod=q.get('tod');
 this.init({scene:sc,heat:heat==null?null:parseInt(heat,10),tod:tod});
 if(shot){for(var i=0;i<90;i++)this.step(1/60);this.render();window.__ready=1;return;}
 var last=0;
 (function loop(ts){if(SB.state.paused)return;var dt=Math.min(((ts-last)/1000)||0,1/30);last=ts;
  SB.engine.step(dt);SB.engine.render();requestAnimationFrame(loop);})(0);
};
})();
