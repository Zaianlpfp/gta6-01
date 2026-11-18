(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var D = SB.dialog = SB.dialog || {};

  D.CHARACTERS = {
    MARA: { name: 'MARA SOLIS', role: 'FIXER \u2014 SOLMAR BAY', portrait: 'assets/mara.jpg' },
    JAX: { name: 'JAX', role: 'GARAGE \u2014 CHOP SHOP', portrait: 'assets/jax.jpg' },
    LUCIA: { name: 'LUC\u00cdA ORTEGA', role: 'GETAWAY DRIVER', portrait: 'assets/lucia.jpg' }
  };

  D.SCRIPTS = {
    'first-fare': { speaker: 'MARA', lines: [
      'New in town, huh? Everyone starts somewhere. Take the cab, pick up my fare at Hotel Palmera.',
      'Drop them at the Marina, no drama. Do it clean and there is more where that came from.' ] },
    'the-package': { speaker: 'MARA', lines: [
      'A package needs legs, and yours are the cheapest in Solmar. Mercado to the Marina docks.',
      'Do not open it. Do not stop for anyone. The safehouse is yours after.' ] },
    'hot-wheels': { speaker: 'JAX', lines: [
      'Mara says you got hands. Prove it \u2014 there is a pink VENTO STRADA parked on Solmar Ave.',
      'Lift it quiet, bring it to my garage. No scratches, or you pay for the paint.' ] },
    'night-run': { speaker: 'LUCIA', lines: [
      'You ever raced the Neon Mile at night? Three checkpoints, no brakes, no cops invited.',
      'Keep up with me and the purse is yours. Fall behind and you walk home.' ] },
    'chop-shop': { speaker: 'JAX', lines: [
      'I need a SOLMAR GT, muscle, Deco Row. The owner will not miss it till morning.',
      'Bring it in one piece and I will make it worth your while. Chop price, cash, tonight.' ] },
    'harbor-lights': { speaker: 'LUCIA', lines: [
      'The crew is waiting at Pelican Marina. We move together, we get paid together.',
      'Escort us to Bayline Docks. If the cops show, you drive. I shoot. Clear?' ] },
    'heat': { speaker: 'MARA', lines: [
      'The PD thinks they own these streets. Time to remind them who really runs Solmar.',
      'Get to four stars, then vanish. Lose them all and meet me at the safehouse.' ] },
    'big-score': { speaker: 'LUCIA', lines: [
      'Solmar National Bank. One vault, one shot, and we walk out rich or not at all.',
      'Grab the cash, lose the cops, bring it home to me. Do not get cute out there.' ] }
  };

  var box = null, imgEl = null, nameEl = null, roleEl = null, textEl = null, hintEl = null;
  var lines = [], li = 0, isActive = false, useHud = false;
  var curName = '', curRole = '', curPortrait = '';
  function hudReady() {
    return !!(SB.hud && SB.hud.showDialog && SB.hud.hideDialog && document.getElementById('sb-hud'));
  }
  function renderHudLine() {
    SB.hud.showDialog({ name: curName, role: curRole, portrait: curPortrait, lines: [lines[li]] });
  }

  function buildBox() {
    if (box) return;
    box = document.createElement('div');
    box.id = 'sb-dialog-fallback';
    box.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
      'width:min(640px,92vw);display:none;z-index:40;' +
      'background:rgba(12,10,20,0.92);border:2px solid #ffb347;border-radius:12px;' +
      'padding:14px 16px;color:#fff;font-family:Arial,sans-serif;cursor:pointer;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.6);';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:14px;align-items:flex-start;';
    imgEl = document.createElement('img');
    imgEl.alt = '';
    imgEl.style.cssText = 'width:96px;height:96px;object-fit:cover;border-radius:8px;' +
      'border:2px solid #ffb347;flex:0 0 auto;background:#333;';
    var col = document.createElement('div');
    col.style.cssText = 'flex:1;min-width:0;';
    nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:bold;font-size:17px;color:#ffb347;letter-spacing:1px;';
    roleEl = document.createElement('div');
    roleEl.style.cssText = 'font-size:11px;color:#9fb4d8;letter-spacing:2px;margin:2px 0 8px;';
    textEl = document.createElement('div');
    textEl.style.cssText = 'font-size:15px;line-height:1.45;';
    hintEl = document.createElement('div');
    hintEl.style.cssText = 'text-align:right;font-size:11px;color:#9fb4d8;margin-top:8px;';
    hintEl.textContent = 'E / CLICK \u25b8';
    col.appendChild(nameEl); col.appendChild(roleEl); col.appendChild(textEl); col.appendChild(hintEl);
    wrap.appendChild(imgEl); wrap.appendChild(col);
    box.appendChild(wrap);
    document.body.appendChild(box);
    box.addEventListener('click', function () { D.next(); });
  }

  D.show = function (opts) {
    opts = opts || {};
    lines = opts.lines || [];
    li = 0;
    if (!lines.length) return false;
    curName = opts.name || '';
    curRole = opts.role || '';
    curPortrait = opts.portrait || '';
    if (hudReady()) {
      useHud = true;
      renderHudLine();
    } else {
      useHud = false;
      buildBox();
      nameEl.textContent = curName;
      roleEl.textContent = curRole;
      imgEl.src = curPortrait;
      textEl.textContent = lines[0];
      box.style.display = 'block';
    }
    isActive = true;
    SB.setPaused(true);
    return true;
  };

  D.next = function () {
    if (!isActive) return;
    li++;
    if (li >= lines.length) { D.hide(); return; }
    if (useHud) renderHudLine();
    else textEl.textContent = lines[li];
  };

  D.hide = function () {
    if (!isActive) return;
    isActive = false;
    if (useHud && SB.hud) SB.hud.hideDialog();
    else if (box) box.style.display = 'none';
    useHud = false;
    if (!SB.map || !SB.map.isOpen()) SB.setPaused(false);
  };

  D.active = function () { return isActive; };

  D.showJob = function (job) {
    var script = D.SCRIPTS[job.id];
    if (!script) return false;
    var ch = D.CHARACTERS[script.speaker] || D.CHARACTERS.MARA;
    return D.show({ name: ch.name, role: ch.role, portrait: ch.portrait, lines: script.lines });
  };

  window.addEventListener('keydown', function (e) {
    if (!isActive) return;
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      D.next();
    }
  }, true);

  SB.on('scene', function (d) {
    if (d.name === 'mission' && SB.missions && SB.missions.JOBS) {
      var job = SB.missions.jobById ? SB.missions.jobById('big-score') : null;
      if (job) D.showJob(job);
    }
  });
})();
