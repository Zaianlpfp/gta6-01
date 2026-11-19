// Solmar Bay - dialog system (B3, v4-rebuild r4).
// Mission dialog: portrait + typewriter lines in a box at the lower left.
// Portraits live in game/assets/ and the page is served from game/, so the
// relative base 'assets/' resolves to game/assets/<who>.jpg. A harness may
// override SB.dialog.base with an absolute file URL for isolated pages.
// show() pauses the game; say() is instant staging and never pauses.
// No dice, no clock reads: typing advances only via update(dt).
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};

  var NAMES = { jax: 'JAX', lucia: 'LUCIA', mara: 'MARA' };
  var CPS = 90; // typewriter characters per second

  // Scripted mission scenes. Lines are short on purpose: the box is small.
  var SCENES = {
    'm1-start': [
      { who: 'jax', text: 'Solmar Bay, baby. One pickup, one drop, five hundred in your pocket.' },
      { who: 'jax', text: 'Package is waiting at the Faro Market corner. Grab it, and do not keep Lucia waiting.' },
      { who: 'jax', text: 'Cops are thick tonight. Keep it smooth and the Saltjack Row drop is yours.' }
    ],
    'm1-mid': [
      { who: 'lucia', text: 'I see you. Package is at the stall, second row. Grab it and go.' },
      { who: 'lucia', text: 'Two seconds, that is all. Then Saltjack Row, straight shot.' }
    ],
    'm1-end': [
      { who: 'mara', text: 'Clean run. The buyer is happy, and happy buyers pay.' },
      { who: 'mara', text: 'Five hundred, as promised. You are building a name out here.' },
      { who: 'mara', text: 'Stick with me and the next job pays double. Maybe.' }
    ],
    'm2-start': [
      { who: 'mara', text: 'Saltjack thinks this bay belongs to him. Four of his crew, counting the big man himself.' },
      { who: 'mara', text: 'Put them down, all four, and eight hundred is yours. No witnesses, no mercy.' }
    ],
    'm2-end': [
      { who: 'mara', text: 'Saltjack is done. The whole bay just heard your name.' },
      { who: 'mara', text: 'Eight hundred, clean. Next time, we take the whole Row.' }
    ],
    'm3-start': [
      { who: 'lucia', text: 'Neon Mile, midnight run. Lose the tail, keep the stash, get paid.' }
    ],
    'm4-start': [
      { who: 'jax', text: 'Bank steps, broad daylight. In, out, nobody gets hurt.' }
    ],
    'm5-start': [
      { who: 'mara', text: 'Coral Strand drop. Quiet hands, quick feet.' }
    ],
    'm6-start': [
      { who: 'lucia', text: 'Marina meet at Ocean Drive. Do not be late, do not be followed.' }
    ],
    'm7-start': [
      { who: 'jax', text: 'Palmetto Heights vault. Big doors, bigger payout.' }
    ],
    'm8-start': [
      { who: 'mara', text: 'The Big Score. Downtown tower. Everything we built leads here.' }
    ]
  };

  function normLines(lines, defWho) {
    var out = [];
    var arr = (typeof lines === 'string') ? [lines] : (lines || []);
    for (var i = 0; i < arr.length; i++) {
      var l = arr[i];
      if (typeof l === 'string') out.push({ who: defWho || 'jax', text: l });
      else if (l && typeof l.text === 'string') out.push({ who: l.who || defWho || 'jax', text: l.text });
    }
    return out;
  }

  var D = {
    version: '4.0.0-r4',
    base: 'assets/',
    SCENES: SCENES,
    lines: [],
    idx: 0,
    scene: null,
    visible: false,
    _typed: 0,
    _onDone: null,
    _pausedByShow: false,
    _el: null,
    _img: null,
    _nameEl: null,
    _textEl: null,

    _ensureEl: function () {
      if (this._el) return true;
      if (typeof document === 'undefined') return false;
      var box = document.getElementById('dlg');
      if (!box) {
        box = document.createElement('div');
        box.id = 'dlg';
        box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:60;' +
          'display:none;flex-direction:row;gap:10px;width:540px;max-width:calc(100vw - 32px);' +
          'background:rgba(8,10,18,0.92);border:1px solid rgba(245,197,66,0.55);border-radius:10px;' +
          'padding:10px;color:#f2ede1;font:15px/1.45 system-ui,sans-serif;' +
          'box-shadow:0 6px 24px rgba(0,0,0,0.55);';
        var img = document.createElement('img');
        img.alt = '';
        img.style.cssText = 'width:76px;height:104px;object-fit:cover;object-position:center 20%;' +
          'border-radius:6px;border:1px solid rgba(255,255,255,0.25);flex:0 0 auto;background:#222;';
        var body = document.createElement('div');
        body.style.cssText = 'flex:1 1 auto;min-width:0;';
        var name = document.createElement('div');
        name.style.cssText = 'color:#f5c542;font-weight:700;font-size:13px;letter-spacing:1px;margin-bottom:4px;';
        var text = document.createElement('div');
        var hint = document.createElement('div');
        hint.textContent = 'CLICK TO CONTINUE';
        hint.style.cssText = 'font-size:11px;opacity:0.55;text-align:right;margin-top:6px;letter-spacing:1px;';
        body.appendChild(name);
        body.appendChild(text);
        body.appendChild(hint);
        box.appendChild(img);
        box.appendChild(body);
        document.body.appendChild(box);
        this._img = img;
        this._nameEl = name;
        this._textEl = text;
        var self = this;
        box.addEventListener('click', function () { self.advance(); });
      } else {
        var im = box.querySelector('img');
        this._img = im || null;
        this._nameEl = box.querySelector('.dlg-name') || null;
        this._textEl = box.querySelector('.dlg-text') || null;
        if (!this._textEl) {
          var divs = box.querySelectorAll('div');
          if (divs.length > 0) this._textEl = divs[divs.length - 1];
        }
      }
      this._el = box;
      return true;
    },

    _render: function () {
      if (typeof document === 'undefined') return;
      if (!this._ensureEl()) return;
      var line = this.lines[this.idx];
      if (!line) return;
      if (this._img) {
        var src = this.base + line.who + '.jpg';
        if (this._img.getAttribute('src') !== src) this._img.setAttribute('src', src);
      }
      if (this._nameEl) this._nameEl.textContent = NAMES[line.who] || String(line.who).toUpperCase();
      if (this._textEl) this._textEl.textContent = line.text.slice(0, this._typed);
    },

    _open: function (lines, opts, instant, pause) {
      var norm = normLines(lines, (opts && opts.who) || 'jax');
      if (norm.length === 0) return false;
      if (this.visible) this.hide(true);
      this.lines = norm;
      this.idx = 0;
      this.scene = (opts && opts.scene) || null;
      this._onDone = (opts && typeof opts.onDone === 'function') ? opts.onDone : null;
      this._typed = instant ? norm[0].text.length : 0;
      this._pausedByShow = !!pause;
      this.visible = true;
      if (pause && SB.state) SB.state.paused = true;
      if (this._ensureEl()) this._el.style.display = 'flex';
      this._render();
      return true;
    },

    // Full dialog with typewriter; pauses the game until it closes.
    show: function (lines, opts) {
      return this._open(lines, opts, false, true);
    },

    // Scripted scene by id; returns false (no throw) for an unknown id.
    showScene: function (id, onDone) {
      var lines = SCENES[id];
      if (!lines) return false;
      return this.show(lines, { scene: id, onDone: onDone });
    },

    // Instant staging dialog: full first line at once, game keeps running.
    say: function (lines, opts) {
      return this._open(lines, opts, true, false);
    },

    sayScene: function (id) {
      var lines = SCENES[id];
      if (!lines) return false;
      return this.say(lines, { scene: id });
    },

    // Typewriter tick. Safe to call with a big dt (staging): it clamps.
    update: function (dt) {
      if (!this.visible) return;
      var line = this.lines[this.idx];
      if (!line) return;
      if (this._typed < line.text.length) {
        this._typed += dt * CPS;
        if (this._typed > line.text.length) this._typed = line.text.length;
        this._render();
      }
    },

    // Finish the current line, or move to the next one. Closes after last.
    advance: function () {
      if (!this.visible) return false;
      var line = this.lines[this.idx];
      if (!line) { this.hide(); return false; }
      if (this._typed < line.text.length) {
        this._typed = line.text.length;
        this._render();
        return true;
      }
      this.idx += 1;
      if (this.idx >= this.lines.length) { this.hide(); return false; }
      this._typed = 0;
      this._render();
      return true;
    },

    hide: function (silent) {
      if (!this.visible) return;
      this.visible = false;
      if (this._el) this._el.style.display = 'none';
      if (this._pausedByShow && SB.state) SB.state.paused = false;
      this._pausedByShow = false;
      var cb = this._onDone;
      this._onDone = null;
      this.scene = null;
      if (cb && !silent) {
        try { cb(); } catch (e) {}
      }
    },

    currentSpeaker: function () {
      var line = this.lines[this.idx];
      return line ? line.who : null;
    },

    currentLine: function () {
      var line = this.lines[this.idx];
      return line ? line.text : '';
    }
  };

  SB.dialog = D;
})();
