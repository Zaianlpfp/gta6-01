/* main.js — Solmar Bay v4 entry point (B5).
   HUD first, then engine boot. The game loop lives here: every frame it
   steps the sim (unless a dialog has paused it) and renders. Missions are
   ticked inside the step wrapper so they run on the same fixed beat as the
   engine, the player, the vehicles and the police. */
(function(){
'use strict';
var SB=window.SB;
var SHOT=/[?&]shot=1/.test(location.search);

/* Chain onto the engine step: pause gate + mission tick. The player module
   already chains its own updates onto this same step, so nothing else is
   called by hand here. In shot mode the pause gate is off: the fixed 90
   steps must run exactly as staged, dialog or not. */
var _step=SB.engine.step;
SB.engine.step=function(dt){
 if(!SHOT&&SB.state.paused)return;
 _step.call(SB.engine,dt);
 if(SB.missions&&SB.missions.update)SB.missions.update(dt);
};

/* HUD before boot: it builds the DOM the presets stage against. */
SB.hud.init();

if(SHOT){
 /* A staged dialog pauses the sim; the shot's fixed steps still have to
    run, so clear the flag (the dialog box itself stays visible). */
 SB.state.paused=false;
 SB.engine.bootFromQuery();
 return;
}

/* Live play: bootFromQuery starts its own animation loop, but that loop
   returns without rescheduling once paused, so a dialog would freeze the
   game forever. Drop exactly one of its frame requests so it runs a single
   frame, then this file owns the loop: step (skipped while paused) +
   render, rescheduled every frame so unpausing resumes the sim. */
var _raf=window.requestAnimationFrame.bind(window),swallowed=false;
window.requestAnimationFrame=function(cb){
 if(!swallowed){swallowed=true;return 0;}
 return _raf(cb);};
SB.engine.bootFromQuery();
window.requestAnimationFrame=_raf;

var last=0;
(function loop(ts){
 _raf(loop);
 var dt=Math.min(((ts-last)/1000)||0,1/30);last=ts;
 if(!SB.state.paused)SB.engine.step(dt);
 SB.engine.render();
})(0);
})();
