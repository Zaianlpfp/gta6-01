// dialog.js — Solmar Bay v4 (B3): dialog + potret, kiri-bawah (wheel di kanan-bawah).
(function(){
var SB=window.SB=window.SB||{};
SB.chars={
 mara:{name:'Mara Solis',role:'FIXER',img:'assets/mara.jpg'},
 jax:{name:'Jax',role:'MECHANIC',img:'assets/jax.jpg'},
 lucia:{name:'Lucia Ortega',role:'GETAWAY DRIVER',img:'assets/lucia.jpg'}};
var el=null,im=null,nm=null,rl=null,tx=null,cur=null,pend=null;
function build(){el=document.createElement('div');el.id='dlg';
 el.style.cssText='position:fixed;left:16px;bottom:16px;z-index:50;display:none;width:460px;max-width:46vw;background:rgba(12,10,24,.88);border:1px solid #ffb347;border-left:5px solid #ffb347;border-radius:10px;padding:10px 12px;color:#fff;font-family:Arial,sans-serif;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,.5)';
 im=document.createElement('img');im.style.cssText='float:left;width:92px;height:92px;object-fit:cover;border-radius:8px;margin-right:12px;border:2px solid #ffb347';
 nm=document.createElement('div');nm.style.cssText='font-weight:800;font-size:17px;letter-spacing:.5px';
 rl=document.createElement('div');rl.style.cssText='font-size:11px;letter-spacing:2px;color:#ffb347;margin:2px 0 6px';
 tx=document.createElement('div');tx.style.cssText='font-size:14px;line-height:1.45;color:#f2ead9';
 var hint=document.createElement('div');hint.textContent='E / klik \u25B8';
 hint.style.cssText='text-align:right;font-size:11px;color:#9d94b8;margin-top:6px';
 el.appendChild(im);el.appendChild(nm);el.appendChild(rl);el.appendChild(tx);el.appendChild(hint);
 el.addEventListener('click',function(){next();});
 document.body.appendChild(el);
 window.addEventListener('keydown',function(e){if(!cur)return;
  if(e.code==='KeyE'||e.code==='Enter'||e.code==='Space'){e.preventDefault();next();}});}
function paint(){im.src=cur.c.img;im.alt=cur.c.name;nm.textContent=cur.c.name;rl.textContent=cur.c.role;tx.textContent=cur.lines[cur.i];}
function show(id,lines,onDone){if(!el)build();if(!lines||!lines.length)return;
 var c=SB.chars[id]||SB.chars.mara;
 if(cur){pend={id:id,lines:lines,onDone:onDone||null};return;}
 cur={c:c,lines:lines,i:0,onDone:onDone||null};paint();el.style.display='block';
 if(SB.state)SB.state.paused=true;}
function next(){if(!cur)return;cur.i++;
 if(cur.i>=cur.lines.length){var cb=cur.onDone;cur=null;el.style.display='none';
  if(SB.state)SB.state.paused=false;if(cb)cb();
  if(pend){var p=pend;pend=null;show(p.id,p.lines,p.onDone);}}else paint();}
function hide(){if(!cur)return;cur=null;el.style.display='none';if(SB.state)SB.state.paused=false;}
SB.dialog={show:show,next:next,hide:hide,say:function(id,t){show(id,[t]);},
 get active(){return!!cur;},get char(){return cur?cur.c:null;},
 get line(){return cur?cur.lines[cur.i]:'';}};
})();
