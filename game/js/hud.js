// HUD, minimap and menus for Solmar Bay — all drawn on the same canvas
// so the screenshots show exactly what the player sees.
// Top-left: health, armor, cash. Top-right: wanted stars. Bottom-left:
// a live minimap. Bottom-right: speed. Top-centre: the mission objective.
// Menus are clickable canvas buttons (start, pause, how-to-play, busted).
import { clamp, money } from './util.js';
import { AVENUES, STREETS, WORLD_W, WORLD_H } from './city.js';

export class Hud {
  constructor() {
    this.toasts = [];      // {text, until}
    this.buttons = [];     // rebuilt each menu frame: {x,y,w,h,action}
  }
  toast(text, seconds) { this.toasts.push({ text, until: seconds || 4 }); }
  update(dt) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].until -= dt;
      if (this.toasts[i].until <= 0) this.toasts.splice(i, 1);
    }
  }
  // A clickable button. Returns true on the frame it is clicked.
  button(ctx, input, x, y, w, h, label, style) {
    const hover = input.mouseX >= x && input.mouseX <= x + w && input.mouseY >= y && input.mouseY <= y + h;
    ctx.fillStyle = hover ? (style && style.hover) || '#ffb020' : (style && style.bg) || '#1f8a70';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    return hover && input.clicked;
  }
  panel(ctx, x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(8,12,20,' + (alpha || 0.78) + ')';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  drawGame(ctx, game, cam) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const p = game.player, pol = game.police;
    // ---- top-left: health / armor / cash ----
    this.panel(ctx, 12, 12, 250, 100, 0.62);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(money(p.cash), 24, 38);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#c9d4e8';
    ctx.fillText('SOLMAR BAY', 24, 56);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(24, 64, 160, 8);
    ctx.fillStyle = p.health > 30 ? '#37c978' : '#e84c4c';
    ctx.fillRect(24, 64, 160 * clamp(p.health / 100, 0, 1), 8);
    if (p.armor > 0) {
      ctx.fillStyle = '#20242e';
      ctx.fillRect(24, 76, 160, 6);
      ctx.fillStyle = '#4d9de0';
      ctx.fillRect(24, 76, 160 * clamp(p.armor / 100, 0, 1), 6);
    }
    ctx.fillStyle = '#c9d4e8';
    ctx.font = '12px Arial';
    ctx.fillText('Missions: ' + game.missions.index + '/5   Coins: ' + game.missions.coinsCollected + '/20', 24, 100);
    // Ammo (on foot only).
    if (!p.driving) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('AMMO ' + p.ammo, 196, 38);
    }
    // ---- top-right: wanted stars ----
    if (pol.wanted > 0) {
      this.panel(ctx, W - 232, 12, 220, 46, 0.62);
      ctx.fillStyle = '#ffd23e';
      ctx.font = '26px Arial';
      ctx.textAlign = 'left';
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < pol.wanted ? '★' : '☆';
      ctx.fillText(stars, W - 220, 44);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '13px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(game.clockText(), W - 16, 30);
    }
    // ---- top-centre: mission objective ----
    const obj = game.missions.currentObjective();
    if (obj) {
      ctx.font = 'bold 15px Arial';
      const tw = ctx.measureText(obj).width + 28;
      this.panel(ctx, (W - tw) / 2, 12, tw, 34, 0.62);
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.fillText('◆ ' + obj, W / 2, 34);
    }
    // ---- bottom-left: minimap ----
    this.drawMinimap(ctx, game, 12, H - 158, 200, 146);
    // ---- bottom-right: speed / vehicle ----
    if (p.driving && p.inCar) {
      this.panel(ctx, W - 212, H - 62, 200, 50, 0.62);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(Math.abs(Math.round(p.inCar.speed * 0.36)) + ' km/h', W - 24, H - 26);
      ctx.font = '12px Arial';
      ctx.fillStyle = '#c9d4e8';
      ctx.fillText(p.inCar.kind === 'sport' ? 'Comet GT' : p.inCar.kind === 'taxi' ? 'Taxi Cab' : p.inCar.kind === 'truck' ? 'Box Truck' : p.inCar.kind === 'police' ? 'Police Cruiser' : 'Sedan', W - 24, H - 48);
    }
    // ---- phone message card (top-centre, under the objective) ----
    const msg = game.missions.message;
    if (msg) {
      const mw = 420, mh = 96;
      const my = 54;
      this.panel(ctx, (W - mw) / 2, my, mw, mh, 0.88);
      ctx.fillStyle = '#1f8a70';
      ctx.fillRect((W - mw) / 2, my, 6, mh);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('📱 ' + msg.title, (W - mw) / 2 + 18, my + 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px Arial';
      this.wrapText(ctx, msg.body, (W - mw) / 2 + 18, my + 44, mw - 30, 17);
    }
    // ---- toasts ----
    ctx.textAlign = 'center';
    let ty = H - 190;
    for (const t of this.toasts) {
      ctx.font = 'bold 15px Arial';
      const tw = ctx.measureText(t.text).width + 24;
      this.panel(ctx, (W - tw) / 2, ty, tw, 30, 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.text, W / 2, ty + 20);
      ty -= 36;
    }
    // ---- hold-to-crack progress ----
    const s = game.missions.currentStep();
    if (s && s.kind === 'hold' && game.missions.holdProgress > 0) {
      const bw = 260;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect((W - bw) / 2, H / 2 + 60, bw, 20);
      ctx.fillStyle = '#ffb020';
      ctx.fillRect((W - bw) / 2, H / 2 + 60, bw * (game.missions.holdProgress / s.seconds), 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Arial';
      ctx.fillText('CRACKING THE VAULT…', W / 2, H / 2 + 52);
    }
    // ---- crosshair on foot ----
    if (!p.driving && !p.dead) {
      const mx = game.input.mouseX, my = game.input.mouseY;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my);
      ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
      ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5);
      ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13);
      ctx.stroke();
    }
    // ---- hurt vignette ----
    if (p.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(220,30,30,' + (p.hurtFlash * 0.45) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (p.health <= 30 && !p.dead) {
      ctx.fillStyle = 'rgba(220,30,30,' + (0.08 + Math.sin(performance.now() / 300) * 0.05) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }
  wrapText(ctx, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
      else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }
  drawMinimap(ctx, game, x, y, w, h) {
    const sx = w / WORLD_W, sy = h / WORLD_H;
    ctx.save();
    this.panel(ctx, x - 4, y - 4, w + 8, h + 8, 0.7);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // Sea + sand.
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#7fae62';
    ctx.fillRect(x, y, w, h - 8);
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(x, y + h - 10, w, 4);
    // Roads.
    ctx.strokeStyle = '#3c3f45';
    ctx.lineWidth = 3;
    for (const ax of AVENUES) { ctx.beginPath(); ctx.moveTo(x + ax * sx, y); ctx.lineTo(x + ax * sx, y + h); ctx.stroke(); }
    for (const sy of STREETS) { ctx.beginPath(); ctx.moveTo(x, y + sy * sy); ctx.lineTo(x + w, y + sy * sy); ctx.stroke(); }
    // Landmarks.
    for (const lm of Object.values(game.city.landmarks)) {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(x + lm.x * sx - 2, y + lm.y * sy - 2, 4, 4);
    }
    // Objective marker.
    const mk = game.missions.currentMarker();
    if (mk) {
      ctx.fillStyle = '#ff2e2e';
      const pulse = 3 + Math.sin(performance.now() / 200) * 1.5;
      ctx.beginPath(); ctx.arc(x + mk.x * sx, y + mk.y * sy, pulse + 3, 0, Math.PI * 2); ctx.fill();
    }
    // Police.
    for (const c of game.police.cars) {
      ctx.fillStyle = '#2e6bff';
      ctx.beginPath(); ctx.arc(x + c.x * sx, y + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const p = game.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#c9d4e8';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', x, y - 8);
  }

  // ---- menus ----
  drawStart(ctx, game, input, hasSave) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    // Sunset gradient sky over the city silhouette.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ff9a3d');
    g.addColorStop(0.45, '#ff6b6b');
    g.addColorStop(0.75, '#7a4a8a');
    g.addColorStop(1, '#1c2f57');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(W * 0.78, H * 0.3, 46, 0, Math.PI * 2); ctx.fill();
    // Skyline.
    ctx.fillStyle = '#241a33';
    const rngHeights = [120, 200, 150, 260, 180, 300, 140, 220, 170, 240, 130, 190];
    let bx = 0;
    for (let i = 0; i < 12; i++) {
      const bw = W / 12;
      const bh = rngHeights[i % rngHeights.length];
      ctx.fillRect(bx, H - bh - 90, bw - 6, bh + 90);
      bx += bw;
    }
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, H - 90, W, 90);
    // Title.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Arial';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
    ctx.fillText('SOLMAR BAY', W / 2, 150);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('A SUN COAST STORY', W / 2, 188);
    ctx.font = '15px Arial';
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText('One driver. One city. Five jobs between you and the big score.', W / 2, 224);
    // Buttons.
    const bw = 300, bh = 48, bx0 = (W - bw) / 2;
    let by = 270;
    if (hasSave && this.button(ctx, input, bx0, by, bw, bh, 'CONTINUE')) return 'continue';
    by += 62;
    if (this.button(ctx, input, bx0, by, bw, bh, hasSave ? 'NEW GAME' : 'START ENGINE')) return 'new';
    by += 62;
    if (this.button(ctx, input, bx0, by, bw, bh, 'HOW TO PLAY', { bg: '#33415e', hover: '#4d6a9e' })) return 'howto';
    ctx.font = '13px Arial';
    ctx.fillStyle = '#c9d4e8';
    ctx.fillText('WASD move / drive · E enter & steal cars · Mouse aim, Click shoot · Space handbrake · Esc pause', W / 2, H - 56);
    ctx.fillText('An original open-world crime game. No real places, people or cars — all Solmar Bay is invented.', W / 2, H - 34);
    return null;
  }
  drawHowTo(ctx, input) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = 'rgba(8,12,20,0.92)';
    ctx.fillRect(0, 0, W, H);
    const pw = 640, ph = 480, px = (W - pw) / 2, py = (H - ph) / 2;
    this.panel(ctx, px, py, pw, ph, 0.95);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('HOW TO PLAY', px + 28, py + 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px Arial';
    const lines = [
      'You are Jax Marlowe, a driver-for-hire in Solmar Bay, a sun-soaked',
      'coastal city. Mara Solis has five jobs for you — finish them all',
      'and the bay is yours.',
      '',
      'WASD / Arrows — walk or drive (Shift to run)',
      'Mouse — aim your pistol · Click — shoot',
      'E — get in a car, steal one, pick up a fare, crack the vault',
      'Space — handbrake (great for sharp turns)',
      'Esc — pause · M — mute · F5 in pause — quick save',
      '',
      'WANTED: stealing cars, shooting and hitting people raises your',
      'stars. Cops chase you in cruisers and on foot. Stay out of sight',
      'and the heat cools off. Get busted or wasted and you wake up at',
      'St. Maria Hospital, lighter by some cash.',
      '',
      'SIDE WORK: pick up $ fares in any car, and find all 20 sun coins',
      'hidden around the city ($50 each). Your game saves automatically.',
    ];
    let yy = py + 76;
    for (const l of lines) { ctx.fillText(l, px + 28, yy); yy += 21; }
    if (this.button(ctx, input, px + pw / 2 - 100, py + ph - 58, 200, 42, 'BACK')) return 'back';
    return null;
  }
  drawPause(ctx, game, input) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = 'rgba(8,12,20,0.6)';
    ctx.fillRect(0, 0, W, H);
    const pw = 420, ph = 380, px = (W - pw) / 2, py = (H - ph) / 2;
    this.panel(ctx, px, py, pw, ph, 0.95);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('PAUSED', W / 2, py + 44);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#c9d4e8';
    ctx.fillText('Cash ' + money(game.player.cash) + ' · Mission ' + (game.missions.index + 1) + '/5 · Coins ' + game.missions.coinsCollected + '/20', W / 2, py + 72);
    const bw = 260, bh = 44, bx0 = (W - bw) / 2;
    let by = py + 96;
    if (this.button(ctx, input, bx0, by, bw, bh, 'RESUME')) return 'resume';
    by += 56;
    if (this.button(ctx, input, bx0, by, bw, bh, 'SAVE GAME', { bg: '#33415e', hover: '#4d6a9e' })) return 'save';
    by += 56;
    if (this.button(ctx, input, bx0, by, bw, bh, 'RESTART MISSION', { bg: '#33415e', hover: '#4d6a9e' })) return 'restart-mission';
    by += 56;
    if (this.button(ctx, input, bx0, by, bw, bh, 'QUIT TO TITLE', { bg: '#7a2e2e', hover: '#a03e3e' })) return 'quit';
    return null;
  }
  drawBusted(ctx, input, kind) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = kind === 'busted' ? 'rgba(20,40,90,0.85)' : 'rgba(90,10,10,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px Arial';
    ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H / 2 - 10);
    ctx.font = '17px Arial';
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText(kind === 'busted' ? 'The Solmar PD hauled you in. You wake up at St. Maria Hospital.' : 'You wake up at St. Maria Hospital, patched up and poorer.', W / 2, H / 2 + 30);
    if (this.button(ctx, input, W / 2 - 130, H / 2 + 60, 260, 48, 'GET BACK OUT THERE')) return 'respawn';
    return null;
  }
  drawStoryComplete(ctx, input) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = 'rgba(8,12,20,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 44px Arial';
    ctx.fillText('THE BAY IS YOURS', W / 2, H / 2 - 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px Arial';
    ctx.fillText('All five jobs done. Mara is proud, the cops are tired, and Solmar Bay', W / 2, H / 2 + 4);
    ctx.fillText('never sleeps. Keep driving — fares and sun coins are still out there.', W / 2, H / 2 + 30);
    if (this.button(ctx, input, W / 2 - 130, H / 2 + 60, 260, 48, 'FREE ROAM')) return 'roam';
    return null;
  }
}
