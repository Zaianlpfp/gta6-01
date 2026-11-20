// dialog.js — character dialog + portraits (B3, r5, fresh from API.md r5).
// #dlg sits BOTTOM-LEFT (weapon wheel is bottom-right — never overlap).
// say() is INSTANT, no pause (staging). show() is typewriter + pauses game.
(function () {
  'use strict';
  var SB = window.SB;
  var WHO = {
    jax: { name: 'JAX', role: 'MECHANIC', img: 'jax.jpg' },
    lucia: { name: 'LUCIA ORTEGA', role: 'GETAWAY DRIVER', img: 'lucia.jpg' },
    mara: { name: 'MARA SOLIS', role: 'FIXER', img: 'mara.jpg' }
  };
  var SCENES = {
    'm1-start': { who: 'jax', lines: [
      'Yo, fresh meat. Mara says you can drive — prove it.',
      'Faro Market, Old Mercado. Pick up the package, no detours.',
      'Cops sniff around the stalls at night. Keep it smooth.' ] },
    'm1-mid': { who: 'lucia', lines: [
      'Package secured. Nice and quiet — I like that.',
      'Saltjack Row next. Drop it, get paid, don\u2019t look back.' ] },
    'm1-end': { who: 'mara', lines: [
      'First fare, clean delivery. You\u2019re on the board now.',
      'Five hundred, and my word travels fast in Solmar.',
      'Stick around. The real jobs pay a lot more than this.' ] },
    'm1-fail': { who: 'mara', lines: [ 'Clock ran out. The client walked. Come back when you\u2019re serious.' ] },
    'm2-start': { who: 'mara', lines: [
      'The Saltjacks moved into Faro Market. My market.',
      'Drive them out. All four. Then we talk about the package.' ] },
    'm2-end': { who: 'mara', lines: [
      'Market\u2019s mine again. That\u2019s how you send a message.',
      'Eight hundred. The package is yours — don\u2019t drop it.' ] },
    'm2-fail': { who: 'mara', lines: [ 'They\u2019re still standing in my market. Fix that.' ] },
    'm3-start': { who: 'jax', lines: [
      'Comet GT, parked on Deco Row. Keys? We don\u2019t need keys.',
      'Bring her to me in one piece and she\u2019s worth eighteen hundred.' ] },
    'm3-end': { who: 'jax', lines: [ 'Sweet ride. She purrs like she was born for this.' ] },
    'm4-start': { who: 'lucia', lines: [
      'Night run, Neon Mile. Fast, dark, no headlights till the last mile.',
      'I\u2019ll be your wheel if it goes loud. It won\u2019t go loud.' ] },
    'm4-end': { who: 'lucia', lines: [ 'Clean drop. You drive like you\u2019ve done this before.' ] },
    'm5-start': { who: 'jax', lines: [ 'Chop shop needs a fresh donor. Quiet streets, quick hands.' ] },
    'm5-end': { who: 'jax', lines: [ 'Stripped and sold before sunrise. Beautiful.' ] },
    'm6-start': { who: 'mara', lines: [ 'Bayline Docks, midnight. The contact hates waiting more than cops.' ] },
    'm6-end': { who: 'mara', lines: [ 'Harbor lights, clean handoff. You\u2019re moving up.' ] },
    'm7-start': { who: 'mara', lines: [ 'Heat\u2019s on you now. Lose them, then vanish at the safehouse.' ] },
    'm7-end': { who: 'mara', lines: [ 'Ghost. That\u2019s the only way to survive this city.' ] },
    'm8-start': { who: 'lucia', lines: [
      'Solmar National Bank. The big score. Everything we built leads here.',
      'In, out, gone. I\u2019ll have the engine running.' ] },
    'm8-end': { who: 'lucia', lines: [ 'Five thousand. We just robbed the whole damn bay.' ] }
  };

  var D = { base: 'assets/', _el: null, _img: null, _name: null, _role: null,
    _text: null, _lines: [], _idx: 0, _timer: null, _typing: false, _who: 'jax' };

  function el(id) { return document.getElementById(id); }
  function ensure() {
    if (D._el) return D._el;
    var d = el('dlg');
    if (!d) {
      d = document.createElement('div');
      d.id = 'dlg';
      document.body.appendChild(d);
    }
    d.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:30;display:flex;' +
      'gap:10px;align-items:flex-start;max-width:520px;background:rgba(10,10,18,.82);' +
      'border-left:3px solid #ff2a5e;color:#fff;padding:10px 12px;border-radius:6px;' +
      'font-family:Arial,sans-serif;';
    var img = d.querySelector('img');
    if (!img) { img = document.createElement('img'); img.alt = ''; d.appendChild(img); }
    img.style.cssText = 'width:64px;height:128px;object-fit:cover;border-radius:4px;flex:none;';
    var box = d.querySelector('.dlg-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'dlg-box';
      box.innerHTML = '<div class="dlg-name" style="font-weight:bold;color:#ffb347;font-size:14px"></div>' +
        '<div class="dlg-role" style="font-size:11px;color:#9fb4d8;letter-spacing:1px"></div>' +
        '<div class="dlg-text" style="font-size:14px;line-height:1.45;margin-top:4px"></div>';
      d.appendChild(box);
    }
    D._el = d; D._img = img;
    D._name = box.querySelector('.dlg-name'); D._role = box.querySelector('.dlg-role');
    D._text = box.querySelector('.dlg-text');
    return d;
  }
  function paint(who, text) {
    var w = WHO[who] || WHO.jax;
    ensure();
    D._who = who;
    D._img.src = D.base + w.img;
    D._name.textContent = w.name;
    D._role.textContent = w.role;
    D._text.textContent = text;
    D._el.style.display = 'flex';
  }
  function setPaused(v) { if (SB.state) SB.state.paused = !!v; }
  function stopType() { if (D._timer) { clearInterval(D._timer); D._timer = null; } D._typing = false; }

  // Instant, no pause — staging path (B5).
  D.say = function (text, who) {
    stopType();
    paint(who || D._who || 'jax', text || '');
    return true;
  };
  // Typewriter + pause — live path.
  D.show = function (who, text) {
    var lines = Array.isArray(text) ? text.slice() : String(text || '').split('\n');
    D._lines = lines; D._idx = 0;
    setPaused(true);
    D._typeLine(who, lines[0] || '');
    return true;
  };
  D._typeLine = function (who, text) {
    stopType();
    paint(who, text);
    D._typing = true;
    var i = 0;
    D._text.textContent = '';
    D._timer = setInterval(function () {
      i += 2;
      D._text.textContent = text.slice(0, i);
      if (i >= text.length) stopType();
    }, 18);
  };
  // Advance one line; completes typing first, then next line, then closes.
  D.advance = function () {
    if (D._typing) { stopType(); D._text.textContent = D._lines[D._idx] || ''; return true; }
    D._idx++;
    if (D._idx < D._lines.length) { D._typeLine(D._who, D._lines[D._idx]); return true; }
    D.finish();
    return false;
  };
  D.finish = function () {
    stopType();
    setPaused(false);
    if (D._el) D._el.style.display = 'none';
  };
  // Instant first line of a scene; advance() walks the rest.
  D.sayScene = function (id) {
    var s = SCENES[id];
    if (!s) return false;
    D._lines = s.lines.slice(); D._idx = 0;
    D.say(s.lines[0], s.who);
    return true;
  };
  D.scene = function (id) { return SCENES[id] || null; };

  SB.dialog = D;
})();
