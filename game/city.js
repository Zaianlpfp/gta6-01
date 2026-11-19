/* city.js — Solmar Bay v4: dense low-poly city, traffic, peds, props (B1) */
(function(){'use strict';
var T=window.THREE,SB=window.SB;
var G=new T.Group();SB.city.group=G;
SB._vmat=new T.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:.12});
function cv(w,h,fn){var c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);var t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t;}
function merge(parts){var P=[],N=[],C=[];
 for(var i=0;i<parts.length;i++){var g=parts[i][0].toNonIndexed(),c=new T.Color(parts[i][1]);
  var p=g.attributes.position,n=g.attributes.normal;
  for(var j=0;j<p.count;j++){P.push(p.getX(j),p.getY(j),p.getZ(j));N.push(n.getX(j),n.getY(j),n.getZ(j));C.push(c.r,c.g,c.b);}}
 var r=new T.BufferGeometry();
 r.setAttribute('position',new T.Float32BufferAttribute(P,3));
 r.setAttribute('normal',new T.Float32BufferAttribute(N,3));
 r.setAttribute('color',new T.Float32BufferAttribute(C,3));return r;}
function box(w,h,d,x,y,z,c,parts){var m=new T.BoxGeometry(w,h,d);m.translate(x,y,z);parts.push([m,c]);return m;}
function txtTex(txt,fg,bg,font){return cv(512,128,function(g){g.fillStyle=bg;g.fillRect(0,0,512,128);
 var fs=Math.min(font||64,Math.floor(500/(txt.length*.62)));
 g.font='bold '+fs+'px Arial';g.textAlign='center';g.textBaseline='middle';
 g.shadowColor=fg;g.shadowBlur=18;g.fillStyle=fg;g.fillText(txt,256,66);g.shadowBlur=0;g.fillText(txt,256,66);});}
function flat(w,d,x,z,y,c){var m=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshStandardMaterial({color:c,roughness:1}));
 m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;G.add(m);return m;}
var roadV,roadH;
function roadTex(horiz){return cv(64,256,function(g){g.fillStyle='#2e2e33';g.fillRect(0,0,64,256);
 for(var i=0;i<300;i++){g.fillStyle='rgba(255,255,255,'+(SB.rng()*.05)+')';g.fillRect(SB.rng()*64,SB.rng()*256,2,2);}
 g.fillStyle='#c8b060';if(horiz){for(var x=8;x<256;x+=32)g.fillRect(x,29,18,6);}else{for(var y=8;y<256;y+=32)g.fillRect(29,y,6,18);}
 g.fillStyle='#d8d8d8';if(horiz){g.fillRect(0,4,256,2);g.fillRect(0,58,256,2);}else{g.fillRect(4,0,2,256);g.fillRect(58,0,2,256);}});}
var DIST=[
 ['Coral Strand',-280,-120,-190,140,0xd9b380],
 ['Deco Row',-190,-160,-80,-40,0x8a7a68],
 ['Neon Mile',-80,-80,80,80,0x6a5a52],
 ['Downtown',80,-160,190,-20,0x5a5a60],
 ['Bayline Docks',190,-160,280,-20,0x4a4a4a],
 ['Palmetto Heights',80,20,190,160,0x6f8a5a],
 ['Old Mercado',-80,80,60,200,0x9a7a55],
 ['Keystone Field',80,160,190,240,0x4f8a4a],
 ['Pelican Marina',190,20,280,160,0x2a6f8f]];
SB.city.districts=DIST.map(function(d){return{name:d[0],x:d[1],z:d[2],w:d[3]-d[1],d:d[4]-d[2]};});
var LM={bank:{x:110,z:-60},hospital:{x:130,z:90},police:{x:100,z:-120},hotel:{x:-212,z:0},garage:{x:-20,z:150},marina:{x:232,z:90}};
SB.city.lm=LM;
var ROADS=[];
[-160,-120,-80,-40,0,40,80,120,160].forEach(function(x){ROADS.push({x0:x,z0:-280,x1:x,z1:280,axis:'z'});});
[-160,-120,-80,-40,0,40,80,120,160].forEach(function(z){ROADS.push({x0:-190,z0:z,x1:280,z1:z,axis:'x'});});
SB.city.roads=ROADS;
SB.city.build=function(){
 SB.scene.add(G);
 flat(1200,1200,0,0,0,0x6a5a52);
 flat(340,1200,-450,0,.05,0x1e6f92);
 flat(5,560,-281,0,.06,0xe8f4f4);
 DIST.forEach(function(d){flat(d[3]-d[1],d[4]-d[2],(d[1]+d[3])/2,(d[2]+d[4])/2,.008,d[5]);});
 roadV=roadTex(false);roadV.wrapS=roadV.wrapT=T.RepeatWrapping;
 roadH=roadTex(true);roadH.wrapS=roadH.wrapT=T.RepeatWrapping;
 ROADS.forEach(function(r){
  var len=r.axis==='z'?560:470,m;
  if(r.axis==='z'){var t=roadV.clone();t.needsUpdate=true;t.repeat.set(1,20);
   m=new T.Mesh(new T.PlaneGeometry(10,560),new T.MeshStandardMaterial({map:t,roughness:.95}));
   m.rotation.x=-Math.PI/2;m.position.set(r.x0,.015,0);}
  else{var t2=roadH.clone();t2.needsUpdate=true;t2.repeat.set(17,1);
   m=new T.Mesh(new T.PlaneGeometry(470,10),new T.MeshStandardMaterial({map:t2,roughness:.95}));
   m.rotation.x=-Math.PI/2;m.position.set(45,.02,r.z0);}
  m.receiveShadow=true;G.add(m);});
 [-40,0,40].forEach(function(x){flat(3,560,x-6.5,0,.012,0x8f8880);flat(3,560,x+6.5,0,.012,0x8f8880);});
 [-40,0,40].forEach(function(z){flat(470,3,45,z-6.5,.012,0x8f8880);flat(470,3,45,z+6.5,.012,0x8f8880);});
 buildLandmarks();buildBlocks();buildProps();
};

/* ---- textures ---- */
SB._wt=[0,1,2].map(function(){return cv(128,256,function(g){g.fillStyle='#3a3348';g.fillRect(0,0,128,256);
 for(var y=10;y<246;y+=22)for(var x=8;x<120;x+=18){g.fillStyle=SB.rng()<.55?'#ffd27a':'#20242e';g.fillRect(x,y,12,14);}});});
function bmat(h){var t=SB._wt[SB.ri(0,2)].clone();t.needsUpdate=true;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1,Math.max(1,Math.round(h/14)));
 return new T.MeshStandardMaterial({map:t,roughness:.85});}
function roofMat(){return new T.MeshStandardMaterial({color:SB.pick([0x3a3a3a,0x5a4a3a,0x6a5a4a,0x2f4a5a]),roughness:.9});}
function sign(txt,fg,bg,w){var m=new T.Mesh(new T.PlaneGeometry(w||16,w? (w/4):4),new T.MeshBasicMaterial({map:txtTex(txt,fg,bg)}));
 return m;}
function bld(x,z,w,d,h,kind){
 var sm=bmat(h),rm=roofMat();
 var m=new T.Mesh(new T.BoxGeometry(w,h,d),[sm,sm,rm,rm,sm,sm]);
 m.position.set(x,h/2,z);m.castShadow=true;m.receiveShadow=true;G.add(m);
 SB.city.buildings.push({m:m,x:x,z:z,w:w,d:d,h:h,kind:kind});
 if(kind==='tower'){
  var s=new T.Mesh(new T.BoxGeometry(w*.55,h*.16,d*.55),rm);s.position.set(x,h+h*.08,z);s.castShadow=true;G.add(s);
  var a=new T.Mesh(new T.CylinderGeometry(.18,.18,h*.22,5),new T.MeshStandardMaterial({color:0x888888}));
  a.position.set(x,h+h*.16+h*.11,z);G.add(a);
  var tip=new T.Mesh(new T.SphereGeometry(.5,6,5),new T.MeshBasicMaterial({color:0xff2222}));
  tip.position.set(x,h+h*.16+h*.22,z);G.add(tip);
  var ne=new T.Mesh(new T.BoxGeometry(w*.8,.5,.3),new T.MeshBasicMaterial({color:SB.pick([0xff2e88,0x22e6ff,0xffb347])}));
  ne.position.set(x,h-.4,z+d/2+.2);G.add(ne);
 }else if(kind==='mid'||kind==='shop'){
  var aw=new T.Mesh(new T.BoxGeometry(w*.9,.18,d*.3),new T.MeshStandardMaterial({color:SB.pick([0xd21f3c,0x2fae7d,0xffb347,0x22a6d2])}));
  aw.position.set(x,3.1,z+d/2+.4);G.add(aw);
 }
 return m;
}
function nearLM(x,z){for(var k in LM){var dx=x-LM[k].x,dz=z-LM[k].z;if(dx*dx+dz*dz<30*30)return true;}return false;}
function buildBlocks(){
 var kinds={Downtown:'tower','Neon Mile':'mid','Deco Row':'mid','Palmetto Heights':'house','Old Mercado':'shop','Bayline Docks':'ware'};
 DIST.forEach(function(d){
  var kind=kinds[d[0]];if(!kind)return;
  for(var rx=Math.ceil(d[1]/40)*40;rx+40<=d[3];rx+=40)
   for(var rz=Math.ceil(d[2]/40)*40;rz+40<=d[4];rz+=40){
    var cx=rx+20,cz=rz+20;if(nearLM(cx,cz))continue;
    if(kind==='tower'){bld(cx+SB.rand(-3,3),cz+SB.rand(-3,3),SB.rand(20,26),SB.rand(20,26),SB.rand(34,68),'tower');
     if(SB.rng()<.5)bld(cx+SB.rand(-8,8),cz+SB.rand(-8,8),SB.rand(12,16),SB.rand(12,16),SB.rand(18,30),'tower');}
    else if(kind==='house'){bld(cx,cz,SB.rand(12,16),SB.rand(12,16),SB.rand(4,7),'house');
     if(SB.rng()<.6)bld(cx+SB.rand(-14,14),cz+SB.rand(-14,14),SB.rand(10,13),SB.rand(10,13),SB.rand(4,6),'house');}
    else if(kind==='ware'){bld(cx,cz,SB.rand(22,28),SB.rand(16,22),SB.rand(6,9),'ware');}
    else{bld(cx,cz,SB.rand(18,24),SB.rand(18,24),SB.rand(8,20),'mid');
     if(SB.rng()<.5)bld(cx+SB.rand(-10,10),cz+SB.rand(-10,10),SB.rand(12,16),SB.rand(12,16),SB.rand(6,12),'mid');}
   }
 });
}
/* ---- landmarks ---- */
function buildLandmarks(){
 var b=new T.Mesh(new T.BoxGeometry(28,15,22),new T.MeshStandardMaterial({color:0xd8cdb8,roughness:.8}));
 b.position.set(LM.bank.x,7.5,LM.bank.z);b.castShadow=true;G.add(b);
 for(var i=-1;i<2;i++){var c=new T.Mesh(new T.CylinderGeometry(1,1.2,9,8),new T.MeshStandardMaterial({color:0xf0e8d8}));
  c.position.set(LM.bank.x+i*8,4.5,LM.bank.z-12);G.add(c);}
 var bs=sign('SOLMAR NATIONAL BANK','#ffd27a','#2a2118',24);bs.position.set(LM.bank.x,13.5,LM.bank.z-11.2);bs.rotation.y=Math.PI;G.add(bs);SB.city.signs.bank=bs;
 var bs2=sign('SOLMAR NATIONAL BANK','#ffd27a','#2a2118',24);bs2.position.set(LM.bank.x,13.5,LM.bank.z+11.2);G.add(bs2);
 var st=new T.Mesh(new T.BoxGeometry(30,1,14),new T.MeshStandardMaterial({color:0xb8b0a0}));st.position.set(LM.bank.x,.5,LM.bank.z-14);G.add(st);
 var h=new T.Mesh(new T.BoxGeometry(24,12,18),new T.MeshStandardMaterial({color:0xe8e8e8,roughness:.8}));
 h.position.set(LM.hospital.x,6,LM.hospital.z);h.castShadow=true;G.add(h);
 var hx=sign('HOSPITAL','#ff2a22','#f8f8f8',14);hx.position.set(LM.hospital.x,10.5,LM.hospital.z-9.2);hx.rotation.y=Math.PI;G.add(hx);SB.city.signs.hospital=hx;
 var p=new T.Mesh(new T.BoxGeometry(22,12,18),new T.MeshStandardMaterial({color:0x4a5a7a,roughness:.8}));
 p.position.set(LM.police.x,6,LM.police.z);p.castShadow=true;G.add(p);
 var ps=sign('SOLMAR PD HQ','#9fd0ff','#1a2438',14);ps.position.set(LM.police.x,10.5,LM.police.z-9.2);ps.rotation.y=Math.PI;G.add(ps);SB.city.signs.police=ps;
 [-60,0,60].forEach(function(dz,idx){var ht=new T.Mesh(new T.BoxGeometry(18,SB.pick([18,22,26]),14),
  new T.MeshStandardMaterial({color:SB.pick([0xf0e8d8,0xe8d8b8,0xd8e8e0]),roughness:.8}));
  ht.position.set(-212,ht.geometry.parameters.height/2,dz);ht.castShadow=true;G.add(ht);});
 var hs=sign('HOTEL CORAL','#ff9ecf','#3a2a4a',14);hs.position.set(-212,20,-7.2);hs.rotation.y=Math.PI;G.add(hs);SB.city.signs.hotel=hs;
 var gr=new T.Mesh(new T.BoxGeometry(16,6,12),new T.MeshStandardMaterial({color:0x7a6a52,roughness:.9}));
 gr.position.set(LM.garage.x,3,LM.garage.z);gr.castShadow=true;G.add(gr);
 var gs=sign('JAX AUTO','#ffb347','#222222',12);gs.position.set(LM.garage.x,5.2,LM.garage.z-6.2);gs.rotation.y=Math.PI;G.add(gs);SB.city.signs.garage=gs;
 var ms=sign('PELICAN MARINA','#9fd0ff','#12303f',14);ms.position.set(LM.marina.x,4,LM.marina.z-6);ms.rotation.y=Math.PI;G.add(ms);SB.city.signs.marina=ms;
}

/* ---- props: palms, trees, lamps, neon, billboards, stalls, park, beach, docks ---- */
var lampGlow=[];
function palmGeo(){
 var parts=[];var tr=new T.CylinderGeometry(.16,.3,4.7,5);tr.translate(0,2.35,0);parts.push([tr,0x7a5230]);
 var co=new T.SphereGeometry(.32,6,5);co.translate(0,4.8,0);parts.push([co,0x6b4a1f]);
 for(var i=0;i<6;i++){var f=new T.BoxGeometry(.12,.06,2.9);f.translate(0,0,1.3);f.rotateX(-.5);f.translate(0,4.7,0);f.rotateY(i*1.047);parts.push([f,0x2fae5f]);}
 return merge(parts);
}
function buildProps(){
 var dummy=new T.Object3D(),i;
 var pg=palmGeo(),palms=[];
 for(i=0;i<46;i++)palms.push([-SB.rand(195,272),SB.rand(-120,140)]);
 for(i=0;i<34;i++)palms.push([SB.pick([-46,-6,34,86,126]),SB.rand(-160,200)]);
 for(i=0;i<22;i++)palms.push([SB.rand(90,180),SB.rand(30,150)]);
 for(i=0;i<18;i++)palms.push([SB.rand(200,270),SB.rand(30,150)]);
 for(i=0;i<10;i++)palms.push([SB.rand(-170,50),SB.rand(90,190)]);
 var pm=new T.InstancedMesh(pg,SB._vmat,palms.length);
 palms.forEach(function(p,idx){dummy.position.set(p[0],0,p[1]);dummy.rotation.set(0,SB.rand(0,6.28),0);
  var s=SB.rand(.85,1.35);dummy.scale.set(s,s,s);dummy.updateMatrix();pm.setMatrixAt(idx,dummy.matrix);});
 pm.castShadow=true;G.add(pm);SB.city.palms=pm;
 var tp=[];for(i=0;i<6;i++){var t=new T.CylinderGeometry(.14,.2,2.2,5);t.translate(0,1.1,0);tp.push([t,0x5a3a22]);}
 var f1=new T.SphereGeometry(1.5,7,6);f1.translate(0,3,0);tp.push([f1,0x3f8a3f]);
 var f2=new T.SphereGeometry(1,7,6);f2.translate(.7,3.8,0);tp.push([f2,0x4fae4f]);
 var tg=merge(tp),trees=[];
 for(i=0;i<18;i++)trees.push([SB.rand(90,180),SB.rand(170,230)]);
 for(i=0;i<8;i++)trees.push([SB.rand(-70,70),SB.rand(90,190)]);
 var tm=new T.InstancedMesh(tg,SB._vmat,trees.length);
 trees.forEach(function(p,idx){dummy.position.set(p[0],0,p[1]);dummy.rotation.set(0,SB.rand(0,6.28),0);
  var s=SB.rand(.9,1.4);dummy.scale.set(s,s,s);dummy.updateMatrix();tm.setMatrixAt(idx,dummy.matrix);});
 tm.castShadow=true;G.add(tm);
 var lp=[];var pole=new T.CylinderGeometry(.09,.12,5.2,5);pole.translate(0,2.6,0);lp.push([pole,0x222222]);
 var arm=new T.BoxGeometry(1.6,.12,.12);arm.translate(.7,5.1,0);lp.push([arm,0x222222]);
 var lg=merge(lp),lm2=[];
 for(i=0;i<60;i++){var ax=SB.pick([-160,-120,-80,-40,0,40,80,120,160]),az=SB.rand(-160,200);
  if(i%2)lm2.push([ax+6.5,az,0]);else lm2.push([ax-6.5,az,Math.PI]);}
 var lmesh=new T.InstancedMesh(lg,SB._vmat,lm2.length);
 var hg=new T.BoxGeometry(.5,.18,.3),hm=new T.MeshBasicMaterial({color:0xffd9a0});
 var hmesh=new T.InstancedMesh(hg,hm,lm2.length);
 lm2.forEach(function(p,idx){dummy.position.set(p[0],0,p[1]);dummy.rotation.set(0,p[2],0);dummy.scale.set(1,1,1);
  dummy.updateMatrix();lmesh.setMatrixAt(idx,dummy.matrix);
  dummy.position.set(p[0]+Math.sin(p[2])*1.4,5.05,p[1]+Math.cos(p[2])*1.4);dummy.updateMatrix();hmesh.setMatrixAt(idx,dummy.matrix);});
 G.add(lmesh);G.add(hmesh);
 var gt=glowTex0();
 for(i=0;i<16;i++){var sp=new T.Sprite(new T.SpriteMaterial({map:gt,transparent:true,opacity:.5,depthWrite:false}));
  var q=lm2[i*3];sp.position.set(q[0]+Math.sin(q[2])*1.4,5,q[1]+Math.cos(q[2])*1.4);sp.scale.set(4,4,1);G.add(sp);lampGlow.push(sp);}
 var neons=['NEON','CLUB VOLTAGE','TACOS','PALM','BAR','24H','CASINO','PIZZA','MOTEL','DISCO','SOLMAR','RAMEN'];
 var cols=['#ff2e88','#22e6ff','#ffb347','#b26bff','#39ff88','#ff5a5a'];
 SB.city.buildings.forEach(function(b){
  if(!/tower|mid|shop/.test(b.kind))return;
  if(Math.abs(b.x)>90&&b.kind!=='tower')return;
  if(SB.rng()>.42)return;
  var txt=SB.pick(neons),col=SB.pick(cols);
  var nm=new T.Mesh(new T.BoxGeometry(Math.min(b.w*.72,10),1.7,.25),
   new T.MeshBasicMaterial({map:txtTex(txt,col,'#101018')}));
  nm.position.set(b.x,b.h*.58,b.z+b.d/2+.25);G.add(nm);SB.city.neons.push(nm);
  var gs=new T.Sprite(new T.SpriteMaterial({map:gt,transparent:true,opacity:.4,depthWrite:false,color:new T.Color(col)}));
  gs.position.copy(nm.position);gs.scale.set(9,4,1);G.add(gs);SB.city.neons.push(gs);
 });
 var ads=[['SOLMAR BAY','#ff7a4d','#2a1a4a'],['VICE COLA','#ff2e88','#101018'],['PALM BEER','#ffd27a','#1a4a2a'],
  ['NEON DRIVE','#22e6ff','#101030'],['CASINO SOL','#ffb347','#3a0a2a'],['BAY 96.5','#ffffff','#c22a2a'],
  ['GULL AIR','#9fd0ff','#0a2a4a'],['TACO KING','#ff5a5a','#2a1a10'],['HOTEL CORAL','#ff9ecf','#3a2a4a'],['SUNSET FM','#ff9a5a','#241a3a']];
 var bpos=[[-46,-120],[46,-120],[-46,120],[46,120],[-166,-40],[166,-40],[-6,-166],[86,166],[-126,40],[166,120]];
 ads.forEach(function(a,idx){
  var p=bpos[idx],grp=new T.Group();
  var post=new T.Mesh(new T.BoxGeometry(.5,7,.5),new T.MeshStandardMaterial({color:0x333333}));
  post.position.y=3.5;grp.add(post);
  var bd=new T.Mesh(new T.PlaneGeometry(14,7),new T.MeshBasicMaterial({map:txtTex(a[0],a[1],a[2])}));
  bd.position.y=10;grp.add(bd);
  var fr=new T.Mesh(new T.BoxGeometry(14.4,7.4,.3),new T.MeshStandardMaterial({color:0x222222}));
  fr.position.set(0,10,-.2);grp.add(fr);
  grp.position.set(p[0],0,p[1]);grp.rotation.y=SB.rng()<.5?0:Math.PI/2;G.add(grp);
 });
 var stallGeos=['#d21f3c','#ffb347','#2fae7d'].map(function(c){
  var parts=[];box(3,.9,2,0,.9,0,0x8a6a4a,parts);box(3.4,.16,2.4,0,2.3,0,c,parts);
  box(.5,.4,.5,-.9,1.55,0,0xffd27a,parts);box(.5,.4,.5,0,1.55,0,0x39ff88,parts);box(.5,.4,.5,.9,1.55,0,0xff5a5a,parts);
  return merge(parts);});
 for(i=0;i<10;i++){var st=new T.Mesh(stallGeos[i%3],SB._vmat);
  st.position.set(SB.rand(-50,10),0,SB.rand(110,185));st.rotation.y=SB.rand(0,6.28);st.castShadow=true;G.add(st);}
 var fn=new T.Mesh(new T.CylinderGeometry(5,5.4,1,12),new T.MeshStandardMaterial({color:0xb8b0a0}));
 fn.position.set(135,0.5,200);G.add(fn);
 var fw=new T.Mesh(new T.CylinderGeometry(4.4,4.4,.3,12),new T.MeshStandardMaterial({color:0x3a7ab0}));
 fw.position.set(135,1.05,200);G.add(fw);
 var fc=new T.Mesh(new T.CylinderGeometry(.5,.7,2.4,8),new T.MeshStandardMaterial({color:0xd8d0c0}));
 fc.position.set(135,2,200);G.add(fc);
 for(i=0;i<6;i++){var bn=new T.Mesh(new T.BoxGeometry(2,.5,.6),new T.MeshStandardMaterial({color:0x7a5230}));
  bn.position.set(100+i*14,.3,175+(i%2)*20);G.add(bn);}
 var umGeos=['#ff5a5a','#22a6d2'].map(function(c){
  var parts=[];var pl=new T.CylinderGeometry(.07,.07,2.6,5);pl.translate(0,1.3,0);parts.push([pl,0xf0e8d8]);
  var cn=new T.ConeGeometry(2.2,1,8);cn.translate(0,2.9,0);parts.push([cn,c]);return merge(parts);});
 for(i=0;i<12;i++){var um=new T.Mesh(umGeos[i%2],SB._vmat);
  um.position.set(SB.rand(-240,-198),0,SB.rand(-110,130));um.rotation.y=SB.rand(0,6.28);G.add(um);}
 var lg2=new T.Mesh(new T.BoxGeometry(2,3,2),new T.MeshStandardMaterial({color:0xf0f0f0}));
 lg2.position.set(-226,2.2,40);G.add(lg2);
 var lg3=new T.Mesh(new T.BoxGeometry(2.4,.3,2.4),new T.MeshStandardMaterial({color:0xd21f3c}));
 lg3.position.set(-226,3.9,40);G.add(lg3);
 for(i=0;i<14;i++){var cn2=new T.Mesh(new T.BoxGeometry(6,2.6,2.6),
   new T.MeshStandardMaterial({color:SB.pick([0xd21f3c,0x2fae7d,0x22a6d2,0xffb347])}));
  cn2.position.set(SB.rand(193,204),1.3,-150+i*9+SB.rand(-2,2));cn2.rotation.y=SB.rand(-.15,.15);cn2.castShadow=true;G.add(cn2);}
 for(i=0;i<2;i++){var cr=new T.Group();
  var mast=new T.Mesh(new T.BoxGeometry(2,26,2),new T.MeshStandardMaterial({color:0xd2a020}));mast.position.y=13;cr.add(mast);
  var arm2=new T.Mesh(new T.BoxGeometry(20,1.6,1.6),new T.MeshStandardMaterial({color:0xd2a020}));arm2.position.set(6,24,0);cr.add(arm2);
  cr.position.set(i?276:195,0,-100);G.add(cr);}
 for(i=0;i<6;i++){var dk=new T.Mesh(new T.BoxGeometry(3,0.4,16),new T.MeshStandardMaterial({color:0x7a5a3a}));
  dk.position.set(205+i*12,.4,60);G.add(dk);}
 for(i=0;i<6;i++){var bt=new T.Group();
  var hull=new T.Mesh(new T.BoxGeometry(2.6,1,6.4),new T.MeshStandardMaterial({color:SB.pick([0xf0f0f0,0x22a6d2,0xd21f3c])}));
  hull.position.y=.8;bt.add(hull);
  var cab=new T.Mesh(new T.BoxGeometry(1.8,.9,2.4),new T.MeshStandardMaterial({color:0x1a2432}));cab.position.set(0,1.7,-.6);bt.add(cab);
  var mast2=new T.Mesh(new T.CylinderGeometry(.06,.06,4,5),new T.MeshStandardMaterial({color:0x888888}));mast2.position.set(0,3,1);bt.add(mast2);
  bt.position.set(210+i*11,0,40+i*14);bt.rotation.y=SB.rand(-.2,.2);G.add(bt);}
 [[-40,-40],[40,40],[-120,120],[120,-120]].forEach(function(p){
  var pole2=new T.Mesh(new T.CylinderGeometry(.12,.12,6,5),new T.MeshStandardMaterial({color:0x222222}));
  pole2.position.set(p[0],3,p[1]);G.add(pole2);
  var hs2=new T.Mesh(new T.BoxGeometry(1,.9,2.6),new T.MeshStandardMaterial({color:0x111111}));
  hs2.position.set(p[0],6.2,p[1]);G.add(hs2);
  [[0xff2a22,0],[0xffb347,.5],[0x39ff88,1]].forEach(function(l,idx){
   var dot=new T.Mesh(new T.CircleGeometry(.22,8),new T.MeshBasicMaterial({color:l[0]}));
   dot.position.set(p[0],6.48-idx*.28,p[1]+1.31);G.add(dot);});
 });
}
function glowTex0(){var c=document.createElement('canvas');c.width=c.height=64;var g=c.getContext('2d');
 var r=g.createRadialGradient(32,32,2,32,32,30);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');
 g.fillStyle=r;g.fillRect(0,0,64,64);return new T.CanvasTexture(c);}

/* ---- vehicles & people ---- */
var wheelGeo=new T.CylinderGeometry(.36,.36,.3,8);wheelGeo.rotateZ(Math.PI/2);
var wheelMat=new T.MeshStandardMaterial({color:0x111111,roughness:.95});
var CARCOL=[0xd21f3c,0x22a6d2,0xffb347,0x2fae7d,0xe8e8e8,0x222222,0x7a3ad2,0xd2d2d2];
SB.city.makeCar=function(color,type){
 type=type||'sedan';var g=new T.Group(),parts=[];
 var body=color!=null?color:SB.pick(CARCOL);
 if(type==='truck'){box(2,1.6,2.2,0,1.1,1.4,body,parts);box(2.4,2,2.6,0,1.5,-.9,0xd8d8d8,parts);
  box(1.8,.7,.2,0,1.2,2.52,0x1a2432,parts);}
 else if(type==='van'){box(2,1.5,4.6,0,.95,0,body,parts);box(1.8,.7,.2,0,1.1,2.32,0x1a2432,parts);}
 else{box(2,.7,4.4,0,.55,0,body,parts);box(1.7,.62,2.2,0,1.18,-.2,0x1a2432,parts);}
 if(type==='police'){box(.6,.2,.5,-.35,1.56,-.2,0xff2222,parts);box(.6,.2,.5,.35,1.56,-.2,0x2266ff,parts);
  box(2.02,.3,1.2,0,.75,.6,0xf0f0f0,parts);}
 if(type==='taxi'){box(1,.16,.5,0,1.56,-.2,0x111111,parts);}
 box(.35,.18,.1,-.6,.62,2.21,0xfff6c0,parts);box(.35,.18,.1,.6,.62,2.21,0xfff6c0,parts);
 box(.35,.15,.1,-.6,.62,-2.21,0xff2a22,parts);box(.35,.15,.1,.6,.62,-2.21,0xff2a22,parts);
 var mesh=new T.Mesh(merge(parts),SB._vmat);mesh.castShadow=true;g.add(mesh);
 var wheels=[];
 [[-.95,1.45],[.95,1.45],[-.95,-1.45],[.95,-1.45]].forEach(function(p){
  var w=new T.Mesh(wheelGeo,wheelMat);w.position.set(p[0],.36,p[1]);g.add(w);wheels.push(w);});
 var glow=new T.Sprite(new T.SpriteMaterial({map:glowTex0(),transparent:true,opacity:.7,depthWrite:false,color:0xffe9a0}));
 glow.position.set(0,.7,2.6);glow.scale.set(3.4,1.6,1);g.add(glow);
 var barL=null,barR=null;
 if(type==='police'){barL=new T.Mesh(new T.BoxGeometry(.62,.22,.52),new T.MeshBasicMaterial({color:0xff2222}));
  barL.position.set(-.35,1.56,-.2);g.add(barL);
  barR=new T.Mesh(new T.BoxGeometry(.62,.22,.52),new T.MeshBasicMaterial({color:0x2266ff}));
  barR.position.set(.35,1.56,-.2);g.add(barR);}
 g.userData={type:type,speed:0,heading:0,kind:type==='police'?'police':'traffic',still:false,wheels:wheels,glow:glow,barL:barL,barR:barR};
 return g;
};
var SKIN=[0xd8a070,0xb07850,0xe8b088,0x8a5a38],SHIRT=[0xd21f3c,0x22a6d2,0xffb347,0x2fae7d,0xe8e8e8,0x7a3ad2,0xff5a8a,0x39ff88];
SB.city.makePed=function(shirt){
 var parts=[];var sk=SB.pick(SKIN),sh=shirt!=null?shirt:SB.pick(SHIRT);
 box(.55,.75,.32,0,.95,0,sh,parts);box(.5,.55,.3,0,.3,0,0x22242e,parts);
 var hd=new T.SphereGeometry(.22,8,6);hd.translate(0,1.55,0);parts.push([hd,sk]);
 if(SB.rng()<.3){var ht=new T.CylinderGeometry(.26,.3,.12,8);ht.translate(0,1.72,0);parts.push([ht,SB.pick([0xffd27a,0xd21f3c,0x2fae7d])]);}
 var m=new T.Mesh(merge(parts),SB._vmat);m.castShadow=true;
 var g=new T.Group();g.add(m);g.userData={kind:'ped'};
 return g;
};
SB.city.makeHeli=function(){
 var g=new T.Group(),parts=[];
 box(2.2,1.4,4.6,0,0,0,0x1c2f6e,parts);box(1.6,.9,2.6,0,1,-.4,0x9fd0ff,parts);
 box(.5,.5,5,0,.3,-4,0x1c2f6e,parts);box(.3,1.6,.3,0,.8,-6,0x1c2f6e,parts);
 box(2.4,.18,.5,0,-.9,1.6,0x888888,parts);box(2.4,.18,.5,0,-.9,-1.6,0x888888,parts);
 var mesh=new T.Mesh(merge(parts),SB._vmat);mesh.castShadow=true;g.add(mesh);
 var rotor=new T.Mesh(new T.BoxGeometry(8,.08,.5),new T.MeshStandardMaterial({color:0x222222}));
 rotor.position.y=1;g.add(rotor);
 var tail=new T.Mesh(new T.BoxGeometry(.5,1.4,.08),new T.MeshStandardMaterial({color:0xff2222}));
 tail.position.set(0,.8,-6.2);g.add(tail);
 var cone=new T.Mesh(new T.ConeGeometry(5.5,1,16,1,true),
  new T.MeshBasicMaterial({color:0xfff6c8,transparent:true,opacity:.07,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
 cone.scale.y=20;cone.position.y=-10;g.add(cone);
 var spot=new T.Mesh(new T.CircleGeometry(6.5,20),
  new T.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:.22,blending:T.AdditiveBlending,depthWrite:false}));
 spot.rotation.x=-Math.PI/2;spot.position.y=-g.position.y+0.3;g.add(spot);
 g.userData={kind:'heli',rotor:rotor,cone:cone,spot:spot};
 return g;
};
SB.city.clearCrowd=function(){
 var C=SB.city;
 C.traffic.forEach(function(c){SB.scene.remove(c);});
 C.peds.forEach(function(p){SB.scene.remove(p);});
 C.traffic=[];C.peds=[];
};
function loopFor(cx,cz,r){
 var bx=SB.pick([-160,-120,-80,-40,0,40,80,120]),bz=SB.pick([-160,-120,-80,-40,0,40,80,120]);
 if(cx!=null){bx=Math.max(-160,Math.min(120,Math.round((cx+SB.rand(-r,r))/40)*40));bz=Math.max(-160,Math.min(120,Math.round((cz+SB.rand(-r,r))/40)*40));}
 var o=2.4;return[{x:bx+o,z:bz+o},{x:bx+40-o,z:bz+o},{x:bx+40-o,z:bz+40-o},{x:bx+o,z:bz+40-o}];
}
SB.city.spawnTraffic=function(n,area){
 var C=SB.city;
 for(var i=0;i<n;i++){
  var type=SB.pick(['sedan','sedan','sport','taxi','van','truck']);
  var car=SB.city.makeCar(type==='sport'?0xd21f3c:null,type);
  var loop=loopFor(area?area[0]:null,area?area[1]:null,area?area[2]:120),seg=SB.ri(0,3),k=SB.rand(0,1);
  var a=loop[seg],b=loop[(seg+1)%4];
  car.position.set(a.x+(b.x-a.x)*k,0,a.z+(b.z-a.z)*k);
  car.userData.loop=loop;car.userData.seg=seg;car.userData.segK=k;
  car.userData.speed=SB.rand(6,11);car.userData.kind='traffic';
  SB.scene.add(car);C.traffic.push(car);
 }
};
SB.city.spawnPeds=function(n,area){
 var C=SB.city;
 for(var i=0;i<n;i++){
  var p=SB.city.makePed();
  var ax=SB.rand(-160,200),az=SB.rand(-160,200);
  var horiz=SB.rng()<.5,L=SB.rand(20,60);
  var x0=ax,z0=az,x1=ax,z1=az;
  if(horiz)x1=ax+(SB.rng()<.5?-L:L);else z1=az+(SB.rng()<.5?-L:L);
  if(area){x0=area[0]+SB.rand(-area[2],area[2]);z0=area[1]+SB.rand(-area[2],area[2]);x1=x0+(SB.rng()<.5?-L:L);z1=z0;}
  p.position.set(x0,0,z0);
  p.userData={kind:'ped',x0:x0,z0:z0,x1:x1,z1:z1,k:SB.rand(0,1),dir:SB.rng()<.5?1:-1,speed:SB.rand(1,2.2),run:false};
  SB.scene.add(p);C.peds.push(p);
 }
};
SB.city.update=function(dt){
 var C=SB.city,st=SB.state;
 C.traffic.forEach(function(car){
  var u=car.userData;if(u.still){if(u.barL){var on=Math.floor(st.t*4)%2===0;
   u.barL.material.color.setHex(on?0xff2222:0x441111);u.barR.material.color.setHex(on?0x111144:0x2266ff);}return;}
  var loop=u.loop,a=loop[u.seg],b=loop[(u.seg+1)%4];
  var dx=b.x-a.x,dz=b.z-a.z,len=Math.sqrt(dx*dx+dz*dz),mv=u.speed*dt/len;
  u.segK+=mv;
  if(u.segK>=1){u.segK=0;u.seg=(u.seg+1)%4;a=loop[u.seg];b=loop[(u.seg+1)%4];dx=b.x-a.x;dz=b.z-a.z;}
  car.position.set(a.x+dx*u.segK,0,a.z+dz*u.segK);
  car.rotation.y=Math.atan2(dx,dz);
  u.wheels.forEach(function(w){w.rotation.x+=u.speed*dt/.36;});
  u.glow.visible=(st.tod!=='day');
  if(u.barL){var on2=Math.floor(st.t*4)%2===0;
   u.barL.material.color.setHex(on2?0xff2222:0x441111);u.barR.material.color.setHex(on2?0x111144:0x2266ff);}
 });
 C.peds.forEach(function(p){
  var u=p.userData;u.run=st.heat>=3;
  var sp=u.speed*(u.run?3.2:1);
  u.k+=u.dir*sp*dt/Math.max(1,Math.abs(u.x1-u.x0)+Math.abs(u.z1-u.z0));
  if(u.k>=1){u.k=1;u.dir=-1;}if(u.k<=0){u.k=0;u.dir=1;}
  var x=u.x0+(u.x1-u.x0)*u.k,z=u.z0+(u.z1-u.z0)*u.k;
  p.position.set(x,Math.abs(Math.sin(st.t*(u.run?11:6)+u.k*20))*.06,z);
  p.rotation.y=Math.atan2((u.x1-u.x0)*u.dir,(u.z1-u.z0)*u.dir);
 });
 lampGlow.forEach(function(s){s.material.opacity=st.tod==='night'?.55:(st.tod==='sunset'?.3:.06);});
 if(C.heli&&C.heli.visible){C.heli.userData.rotor.rotation.y+=dt*22;
  var H=C.heli.position.y-1;C.heli.userData.cone.scale.y=H;C.heli.userData.cone.position.y=-H/2;
  C.heli.userData.spot.position.y=-C.heli.position.y+.3;}
 if(SB.player.car)SB.player.car.userData.glow.visible=true;
};
})();
