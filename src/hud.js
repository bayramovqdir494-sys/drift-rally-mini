// Drift Rally Mini — race HUD (lap, position, timer, minimap, drift combo, boost), touch controls, pause + results.
class HUD extends Phaser.Scene {
  constructor() { super('HUD'); }
  init(d) { this.R = d.race; }
  create() {
    this.resUI = null; this.pauseUI = null; this.tbtn = [];
    const R = this.R, s = this; window.__hud = this; this.input.addPointer(4);
    // atmosphere (screen space, under the HUD): snowfall in Snowy Pines, sun-lit dust motes in the canyon, neon motes at night; speed streaks while boosting
    this.fxOn = !!Save.data.fx && QS.get('fx') !== '0';
    if (this.fxOn) {
      const th = R.theme, top = { min: -40, max: -10 };
      const cfg = th === 'snow' ? { tint: 0xffffff, alpha: { start: .95, end: .35 }, scale: { min: .5, max: 1.9 }, speedY: { min: 110, max: 240 }, speedX: { min: -70, max: -10 }, lifespan: 6500, frequency: 13, x: { min: 0, max: GW + 500 }, y: top }
        : th === 'desert' ? { tint: 0xffe6b8, alpha: { start: .45, end: 0 }, scale: { min: .25, max: .7 }, speedX: { min: 50, max: 140 }, speedY: { min: -12, max: 18 }, lifespan: 7000, frequency: 150, x: { min: -200, max: GW }, y: { min: 0, max: GH } }
        : { tint: [0xff4fd8, 0x38e8ff, 0xffe14a], alpha: { start: .55, end: 0 }, scale: { min: .3, max: .75 }, speedX: { min: -12, max: 12 }, speedY: { min: -40, max: -10 }, lifespan: 5000, frequency: 170, blendMode: 'ADD', x: { min: 0, max: GW }, y: { min: 0, max: GH } };
      this.atmo = this.add.particles(0, 0, 'fx', Object.assign({ frame: 'dot', quantity: 1, advance: 6000, rotate: 0 }, cfg)).setDepth(-2);
      this.streaks = this.add.graphics().setDepth(-1).setBlendMode(Phaser.BlendModes.ADD); this.streakA = 0;
    }
    // lap + position (top-left), timer (top-centre), minimap (top-right) — layout follows the key art
    panel(s, 26, 22, 300, 96, { r: 20 }); this.lapL = txt(s, 50, 70, 'LAP', 44, '#ffffff', { ox: 0 }); this.lapT = txt(s, 150, 68, '1/3', 66, '#ffd23a', { ox: 0 });
    panel(s, 26, 130, 240, 122, { r: 20 }); txt(s, 46, 160, 'POSITION', 30, '#ffffff', { ox: 0 }); this.posT = txt(s, 46, 212, '1st', 68, '#ffd23a', { ox: 0 });
    if (R.type !== 'race') { this.posT.setText(R.type === 'drift' ? '0' : '--'); this.posT.setFontSize(R.type === 'drift' ? 56 : 68); this.children.list.slice(-2)[0].setText(R.type === 'drift' ? 'SCORE' : 'BEST LAP'); }
    panel(s, 960 - 170, 22, 340, 86, { r: 22 }); this.timeT = txt(s, 960, 64, '00:00.00', 58, '#ffffff');
    this.lapInfo = txt(s, 960, 132, '', 30, '#c8f0ff').setAlpha(0);
    // minimap
    const mw = 330, mh = 236, mx = GW - mw - 26, my = 22; panel(s, mx, my, mw, mh, { r: 22, a: .7 }); this.mm = { x: mx + 18, y: my + 16, w: mw - 36, h: mh - 32 };
    const tr = R.tr, sc = Math.min(this.mm.w / tr.w, this.mm.h / (tr.h * KY)); this.mm.sc = sc; this.mm.ox = this.mm.x + (this.mm.w - tr.w * sc) / 2; this.mm.oy = this.mm.y + (this.mm.h - tr.h * KY * sc) / 2;
    const g = s.add.graphics(); const path = tr.pts.map(p => [this.mm.ox + p[0] * sc, this.mm.oy + p[1] * KY * sc]);
    g.lineStyle(14, 0x000000, .45); g.strokePoints(path.map(p => ({ x: p[0], y: p[1] + 2 })), true, true);
    g.lineStyle(10, 0xffffff, 1); g.strokePoints(path.map(p => ({ x: p[0], y: p[1] })), true, true);
    const p0 = path[0]; g.fillStyle(0x111111, 1); g.fillRect(p0[0] - 9, p0[1] - 3, 18, 6); g.fillStyle(0xffffff, 1); for (let k = 0; k < 3; k++) g.fillRect(p0[0] - 9 + k * 6, p0[1] - 3 + (k % 2) * 3, 3, 3);
    this.dots = s.add.graphics();
    // pause button
    this.pauseB = button(s, mx - 70, 70, 92, 92, '', 0x3a4250, () => R.togglePause(), { icon: 'pause', r: 24 });
    // drift combo (left)
    this.drift = s.add.container(70, 470).setAlpha(0);
    this.driftL = txt(s, 0, -64, 'DRIFT', 46, '#ffffff', { ox: 0 }); this.multT = txt(s, 0, 0, 'x1', 96, '#7dff3a', { ox: 0, st: 12 });
    const pill = s.add.graphics(); pill.fillStyle(0x000000, .35); pill.fillRoundedRect(-4, 66, 236, 70, 35); pill.fillStyle(0xffc21a, 1); pill.fillRoundedRect(-8, 58, 236, 70, 35); pill.fillStyle(0xffffff, .3); pill.fillRoundedRect(4, 64, 212, 24, 12);
    this.ptsStar = s.add.image(30, 93, 'ui', 'star').setDisplaySize(52, 52); this.ptsT = txt(s, 64, 92, '+0', 50, '#ffffff', { ox: 0 });
    this.drift.add([this.driftL, this.multT, pill, this.ptsStar, this.ptsT]);
    // boost gauge: bottom-left on desktop (like the key art), the BOOST button on touch
    this.touch = isTouchDev();
    this.gauge = s.add.graphics(); this.gx = this.touch ? GW - 190 : 170; this.gy = this.touch ? GH - 330 : GH - 170;
    this.gIcon = s.add.image(this.gx, this.gy - (this.touch ? 0 : 20), 'ui', 'bolt').setDisplaySize(84, 84);
    this.gPct = txt(s, this.gx, this.gy + 48, '0%', 40, '#ffffff'); if (this.touch) this.gPct.setText('BOOST').setFontSize(34);
    if (!this.touch) { this.boostRing = s.add.graphics(); this.drawRing(this.boostRing, GW - 170, GH - 170, 112, 1, .0); s.add.image(GW - 170, GH - 190, 'ui', 'bolt').setDisplaySize(84, 84); txt(s, GW - 170, GH - 122, 'BOOST', 40); txt(s, GW - 170, GH - 40, 'SHIFT', 26, '#c8d2e0'); this.boostKeyG = this.boostRing; }
    // touch controls
    this.tbtn = [];
    if (this.touch) {
      const mk = (x, y, r, icon, label, key) => { const c = s.add.container(x, y); const gg = s.add.graphics(); c.add(gg); if (icon) c.add(s.add.image(0, -4, 'ui', icon).setDisplaySize(r * 1.0, r * 1.0)); if (label) c.add(txt(s, 0, icon ? r * .55 : 0, label, Math.round(r * .36)));
        const b = { c, gg, x, y, r, key, on: false }; this.tbtn.push(b); this.drawTB(b); return b; };
      mk(150, GH - 150, 110, 'left', '', 'L'); mk(400, GH - 150, 110, 'right', '', 'R');
      mk(GW - 470, GH - 150, 118, null, 'DRIFT', 'D'); mk(GW - 190, GH - 330, 0, null, null, 'B').r = 120; mk(GW - 200, GH - 115, 78, null, 'BRAKE', 'K');
    }
    // centre messages
    this.big = txt(s, 960, 470, '', 220, '#ffffff', { st: 18 }).setAlpha(0);
    this.msg = txt(s, 960, 300, '', 72, '#ffd23a', { st: 10 }).setAlpha(0);
    this.tipBox = s.add.container(960, GH - 300).setAlpha(0); const tg = s.add.graphics(); this.tipG = tg; this.tipT = txt(s, 0, 0, '', 42, '#ffffff', { wrap: 1100 }); this.tipBox.add([tg, this.tipT]);
    this.wrong = txt(s, 960, 380, 'WRONG WAY!', 90, '#ff4a3a', { st: 12 }).setVisible(false);
    // events
    const E = R.events;
    E.on('count', n => this.count(n), this); E.on('combo', m => this.combo(m), this); E.on('bank', (p, m) => this.bank(p, m), this); E.on('bust', p => this.bust(p), this);
    E.on('msg', (m, c) => this.flash(m, c), this); E.on('tip', t => this.tip(t), this); E.on('pause', p => this.pause(p), this); E.on('results', r => this.showResults(r), this);
    this.events.once('shutdown', () => { E.off('count', null, this); E.off('combo', null, this); E.off('bank', null, this); E.off('bust', null, this); E.off('msg', null, this); E.off('tip', null, this); E.off('pause', null, this); E.off('results', null, this); });
    this.lastPos = 0; this.shown = 0;
    if (R.type === 'drift') this.flash('DRIFT CHALLENGE  —  ' + R.ev.goal[0] + ' pts for ★', 0xffd23a, 3200);
    if (R.type === 'trial') this.flash(R.ghost ? 'BEAT YOUR GHOST!' : 'TIME ATTACK — set your best lap', 0x8fe8ff, 3000);
  }
  drawRing(g, x, y, r, a, f) { g.clear(); g.fillStyle(0x000000, .32); g.fillCircle(x, y + 6, r + 6); g.fillStyle(0x16181c, .82); g.fillCircle(x, y, r); g.lineStyle(16, 0x2e3440, 1); g.strokeCircle(x, y, r - 16);
    if (f > 0) { g.lineStyle(16, f >= .999 ? 0xb8ff3a : 0xa6f02a, 1); g.beginPath(); g.arc(x, y, r - 16, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2, false); g.strokePath(); }
    g.lineStyle(4, 0xffffff, .12 + a * .0); g.strokeCircle(x, y, r); }
  drawTB(b) { const g = b.gg; g.clear(); if (b.key === 'B') return; g.fillStyle(0x000000, .3); g.fillCircle(0, 6, b.r); g.fillStyle(b.on ? 0x4a5468 : 0x1e2128, b.on ? .9 : .62); g.fillCircle(0, 0, b.r); g.lineStyle(5, b.key === 'D' ? 0x7dd8ff : 0xffffff, b.on ? .9 : .4); g.strokeCircle(0, 0, b.r); }
  pollTouch() {
    const R = this.R; if (!this.touch) return; const st = { L: false, R: false, D: false, B: false, K: false };
    this.input.manager.pointers.forEach(p => { if (!p.isDown) return; const x = p.x / this.scale.displayScale.x || p.x, y = p.y; const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      for (const b of this.tbtn) if (Math.hypot(wp.x - b.x, wp.y - b.y) < b.r * 1.25) st[b.key] = true; });
    for (const b of this.tbtn) if (b.on !== st[b.key]) { b.on = st[b.key]; this.drawTB(b); }
    R.touch.steer = (st.R ? 1 : 0) - (st.L ? 1 : 0); R.touch.drift = st.D; R.touch.boost = st.B; R.touch.brake = st.K;
  }
  update(t, d) {
    const R = this.R, P = R.player; if (!P) return; this.pollTouch();
    if (R.state === 'race' && R.t > 1.6 && this.big.text === 'GO!' && this.big.alpha > 0) { this.tweens.killTweensOf(this.big); this.big.setAlpha(0); }   // never let GO! linger (slow frames / fast-forward)
    if (this.streaks) {   // boost speed streaks around the screen edge
      this.streakA += ((P.boosting && !R.paused ? 1 : 0) - this.streakA) * Math.min(1, d / 120); const g = this.streaks; g.clear();
      if (this.streakA > .03) { const cx = GW / 2, cy = GH / 2, R0 = 640;
        for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, r1 = R0 + Math.random() * 260, r2 = r1 + 140 + Math.random() * 320, ca = Math.cos(a), sa = Math.sin(a) * .62;
          g.lineStyle(2 + Math.random() * 5, 0xffffff, (.10 + Math.random() * .22) * this.streakA); g.lineBetween(cx + ca * r1, cy + sa * r1, cx + ca * r2, cy + sa * r2); } }
    }
    this.lapT.setText(Math.max(1, Math.min(R.laps, P.lap)) + '/' + R.laps);
    if (R.type === 'race') { const pos = R.positions().indexOf(P) + 1; if (pos !== this.lastPos) { if (this.lastPos && pos < this.lastPos && R.state === 'race') { Sound.play('select'); this.tweens.add({ targets: this.posT, scale: 1.3, duration: 120, yoyo: true }); } this.lastPos = pos; this.posT.setText(ordinal(pos)); } }
    else if (R.type === 'drift') this.posT.setText('' + (P.score + (P.driftT ? Math.round(P.driftPts * P.mult / 10) * 10 : 0)));
    else this.posT.setText(isFinite(P.bestLap) ? P.bestLap.toFixed(2) : '--').setFontSize(isFinite(P.bestLap) ? 60 : 68);
    const tt = R.state === 'count' ? 0 : (P.finished ? P.finishT : R.t); this.timeT.setText(fmtTime(tt));
    // minimap dots
    const g = this.dots, M = this.mm; g.clear();
    for (const c of R.cars) { const x = M.ox + c.x * M.sc, y = M.oy + c.y * KY * M.sc; g.fillStyle(0x000000, .5); g.fillCircle(x, y + 2, c === P ? 13 : 11); g.fillStyle(CARS[c.id].col === 0xf4f4f4 ? 0xdddddd : CARS[c.id].col, 1); g.fillCircle(x, y, c === P ? 12 : 10); if (c === P) { g.lineStyle(3, 0xffffff, 1); g.strokeCircle(x, y, 12); } }
    if (R.ghost && R.ghost.spr.visible) { const gx = M.ox + R.ghost.spr.x * M.sc, gy = M.oy + (R.ghost.spr.y - R.OY) * M.sc; g.fillStyle(0x8fe8ff, .8); g.fillCircle(gx, gy, 8); }
    // drift combo
    if (P.driftT > 0 && P.driftPts > 20) { if (this.drift.alpha < 1 && !this.bankTw) this.drift.setAlpha(1); this.multT.setText('x' + P.mult); this.ptsT.setText('+' + Math.round(P.driftPts * P.mult / 10) * 10); }
    else if (!this.bankTw && this.drift.alpha > 0 && P.driftT === 0) this.drift.setAlpha(Math.max(0, this.drift.alpha - d / 400));
    // boost gauge
    const f = P.meter; this.drawRing(this.gauge, this.gx, this.gy, this.touch ? 120 : 112, 1, f); if (!this.touch) this.gPct.setText(Math.round(f * 100) + '%');
    this.gIcon.setAlpha(f > .02 ? 1 : .45); if (P.boosting) this.gIcon.setScale(this.gIcon.scaleX * 0 + (84 / this.gIcon.width) * (1 + .12 * Math.sin(t / 40)));
    this.wrong.setVisible(P.wrongT > 1 && R.state === 'race' && Math.floor(t / 300) % 2 === 0);
  }
  count(n) { const s = this.big; s.setText(n ? '' + n : 'GO!').setColor(n ? '#ffffff' : '#7dff3a').setAlpha(1).setScale(1.6); this.tweens.killTweensOf(s);
    this.tweens.add({ targets: s, scale: 1, duration: 260, ease: 'Back.Out' }); this.tweens.add({ targets: s, alpha: 0, delay: n ? 600 : 700, duration: 260 }); }
  combo(m) { this.tweens.add({ targets: this.multT, scale: 1.35, duration: 90, yoyo: true }); }
  bank(p, m) { this.ptsT.setText('+' + p); this.multT.setText('x' + m); this.drift.setAlpha(1); this.bankTw = true; this.tweens.add({ targets: this.drift, scale: 1.12, duration: 110, yoyo: true });
    this.time.delayedCall(900, () => { this.tweens.add({ targets: this.drift, alpha: 0, duration: 300, onComplete: () => { this.bankTw = false; } }); }); }
  bust(p) { this.ptsT.setText('CRASH!'); this.bankTw = true; this.tweens.add({ targets: this.drift, x: 60, duration: 50, yoyo: true, repeat: 3, onComplete: () => { this.drift.x = 70; this.tweens.add({ targets: this.drift, alpha: 0, duration: 300, delay: 300, onComplete: () => { this.bankTw = false; } }); } }); }
  flash(m, c, dur = 1600) { const t = this.msg; t.setText(m).setColor(hex(c || 0xffd23a)).setAlpha(1).setScale(.6); this.tweens.killTweensOf(t); this.tweens.add({ targets: t, scale: 1, duration: 240, ease: 'Back.Out' }); this.tweens.add({ targets: t, alpha: 0, delay: dur, duration: 300 }); }
  tip(m) { const b = this.tipBox; this.tweens.killTweensOf(b); if (!m) { this.tweens.add({ targets: b, alpha: 0, duration: 300 }); return; }
    this.tipT.setText(m); const w = this.tipT.width + 80, h = this.tipT.height + 40; this.tipG.clear(); this.tipG.fillStyle(0x000000, .6); this.tipG.fillRoundedRect(-w / 2, -h / 2, w, h, 26); this.tipG.lineStyle(4, 0xffd23a, .9); this.tipG.strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
    b.setAlpha(0).setScale(.9); this.tweens.add({ targets: b, alpha: 1, scale: 1, duration: 260, ease: 'Back.Out' }); }
  // ---------------------------------------------------------------- pause
  pause(p) {
    if (!p) { if (this.pauseUI) { this.pauseUI.destroy(); this.pauseUI = null; } return; }
    const R = this.R, s = this, c = s.add.container(0, 0); this.pauseUI = c;
    const dim = s.add.rectangle(960, 540, GW, GH, 0x000000, .55).setInteractive(); c.add(dim);
    c.add(panel(s, 960 - 330, 200, 660, 680, { r: 34, a: .92 })); c.add(txt(s, 960, 280, 'PAUSED', 84, '#ffd23a'));
    c.add(button(s, 960, 410, 440, 104, 'RESUME', 0x3cc84a, () => R.togglePause(false)));
    c.add(button(s, 960, 535, 440, 96, 'RESTART', 0xf0a020, () => { R.togglePause(false); restartRace(R); }));
    c.add(button(s, 960, 650, 440, 96, 'MENU', 0x4a6ad8, () => { R.togglePause(false); toMenu(R); }));
    c.add(iconToggle(s, 830, 790, 'music', () => Save.data.music > 0, v => { Save.data.music = v ? .6 : 0; Save.save(); Sound.apply(); }));
    c.add(iconToggle(s, 960, 790, 'sfx', () => Save.data.sfx > 0, v => { Save.data.sfx = v ? .9 : 0; Save.save(); Sound.apply(); }));
    const ag = button(s, 1090, 790, 92, 92, '', 0x3a4250, () => { Save.data.autogas = Save.data.autogas ? 0 : 1; Save.save(); agl.setText(Save.data.autogas ? 'AUTO\nGAS' : 'GAS\nUP / W'); }, { r: 24 });
    const agl = txt(s, 0, -2, Save.data.autogas ? 'AUTO\nGAS' : 'GAS\nUP / W', 22); ag.add(agl); c.add(ag);
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 160 });
  }
  // ---------------------------------------------------------------- results
  showResults(r) {
    const R = this.R, s = this; if (this.resUI) return; const c = s.add.container(0, 0); this.resUI = c; if (this.tipBox) { this.tweens.killTweensOf(this.tipBox); this.tipBox.setAlpha(0); }
    this.tbtn.forEach(b => b.c.setVisible(false));
    c.add(s.add.rectangle(960, 540, GW, GH, 0x000000, .45).setInteractive());
    const pnl = s.add.container(960, 540); c.add(pnl);
    pnl.add(panel(s, -520, -420, 1040, 840, { r: 40, a: .93 }));
    const title = r.type === 'race' ? (r.pos === 1 ? 'YOU WIN!' : ordinal(r.pos) + ' PLACE') : (r.stars ? 'GREAT RUN!' : 'FINISHED');
    const tt = txt(s, 0, -340, title, 100, r.pos === 1 || r.stars === 3 ? '#ffd23a' : '#ffffff', { st: 12 }); pnl.add(tt);
    if (r.pos === 1 || r.stars === 3) { const rays = s.add.image(0, -340, 'ui', 'rays').setAlpha(.5).setScale(1.6).setBlendMode(Phaser.BlendModes.ADD); pnl.addAt(rays, 1); this.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 }); }
    const st = stars(s, 0, -220, 0, 110, 130); st.forEach(im => pnl.add(im));
    for (let i = 0; i < r.stars; i++) this.time.delayedCall(400 + i * 300, () => { st[i].setFrame('star'); st[i].setScale(st[i].scaleX * 1.6); this.tweens.add({ targets: st[i], scaleX: 110 / st[i].width, scaleY: 110 / st[i].height, duration: 260, ease: 'Back.Out' }); Sound.play('star', i); });
    let y = -120;
    if (r.type === 'race') {
      r.order.forEach((o, i) => { const row = s.add.container(0, y + i * 62); const bg = s.add.graphics(); bg.fillStyle(o.me ? 0xffd23a : 0xffffff, o.me ? .25 : .07); bg.fillRoundedRect(-420, -27, 840, 54, 16); row.add(bg);
        row.add(txt(s, -380, 0, ordinal(i + 1), 40, o.me ? '#ffd23a' : '#ffffff', { ox: 0 })); row.add(s.add.image(-230, 2, 'car_' + o.id, o.id + '_08').setScale(.42 * CAR_K));
        row.add(txt(s, -160, 0, (o.me ? 'YOU — ' : '') + CARS[o.id].name, 36, '#ffffff', { ox: 0 })); row.add(txt(s, 400, 0, o.t != null ? fmtTime(o.t) : '+' + (i ? '…' : ''), 36, '#c8d2e0', { ox: 1 })); pnl.add(row); });
      y += 4 * 62 + 10;
    } else {
      const lines = r.type === 'drift' ? [['DRIFT SCORE', '' + r.score], ['TIME', fmtTime(r.time)], ['GOALS', CUPS[R.cfg.cup] && R.ev ? R.ev.goal.join(' / ') : '']]
        : [['BEST LAP', fmtTime(r.best)], ['TOTAL', fmtTime(r.time)], ['GOLD', R.ev ? fmtTime(R.ev.goal[2]) : fmtTime(TRIAL_GOALS[R.theme][2])]];
      lines.forEach((l, i) => { pnl.add(txt(s, -300, y + i * 66, l[0], 42, '#c8d2e0', { ox: 0 })); pnl.add(txt(s, 300, y + i * 66, l[1], 46, '#ffffff', { ox: 1 })); }); y += 3 * 66 + 20;
    }
    if (r.type === 'race') pnl.add(txt(s, 0, y + 6, 'Best lap ' + fmtTime(r.best) + '   •   Drift ' + r.score, 34, '#c8d2e0'));
    const coinC = s.add.container(-150, y + 76); coinC.add(s.add.image(0, 0, 'ui', 'coin').setDisplaySize(64, 64)); const ct = txt(s, 46, 0, '+' + r.coins, 56, '#ffe066', { ox: 0 }); coinC.add(ct); pnl.add(coinC);
    let doubled = false;
    const x2 = button(s, 230, y + 76, 300, 84, 'x2', 0x8a3ad8, () => { if (doubled) return; x2.setEnabled(false); CG.ad('rewarded', ok => { if (!ok) { x2.setEnabled(true); toast(s, 'No video available - try again later'); return; } doubled = true; Save.data.coins += r.coins; Save.save(); ct.setText('+' + r.coins * 2); Sound.play('coin'); x2.setVisible(false); }); }, { icon: 'video', size: 40 }); pnl.add(x2);
    if (r.coins <= 0) x2.setVisible(false);
    const by = 330; const nxt = nextEvent(R);
    pnl.add(button(s, -330, by, 280, 100, 'MENU', 0x4a6ad8, () => { toMenu(R); }, { icon: 'home' }));
    pnl.add(button(s, 0, by, 300, 100, 'RETRY', 0xf0a020, () => { doubled ? restartRace(R) : betweenAd(() => restartRace(R)); }, { icon: 'retry' }));
    const nb = button(s, 330, by, 300, 100, 'NEXT', 0x3cc84a, () => { if (!nxt) return; doubled ? startEvent(R, nxt) : betweenAd(() => startEvent(R, nxt)); }, { icon: 'next' }); pnl.add(nb); if (!nxt) nb.setEnabled(false);
    pnl.setScale(.7).setAlpha(0); this.tweens.add({ targets: pnl, scale: 1, alpha: 1, duration: 340, ease: 'Back.Out' });
    if (r.pos === 1 || r.stars === 3) this.confetti();
  }
  confetti() { const e = this.add.particles(0, 0, 'fx', { frame: 'conf', x: { min: 0, max: GW }, y: -30, lifespan: 3200, speedY: { min: 250, max: 520 }, speedX: { min: -120, max: 120 }, rotate: { start: 0, end: 720 }, scale: { min: .5, max: 1 }, tint: [0xff3b30, 0xffd23a, 0x3cc84a, 0x2a8af0, 0xff7ad8], quantity: 3, frequency: 40, duration: 1800 }); e.setDepth(-1); }
}
// flow helpers shared with menus
function nextEvent(R) {
  if (R.cfg.mode === 'trial' || R.attract) return null; const c = R.cfg.cup, e = R.cfg.ev; const ok = (R.results && R.results.stars > 0) || (Save.data.stars[evKey(c, e)] || 0) > 0;
  if (!ok) return null; if (e + 1 < CUPS[c].events.length) return { cup: c, ev: e + 1 };
  if (c + 1 < CUPS.length && totalStars() >= CUPS[c + 1].need) return { cup: c + 1, ev: 0 }; return null;
}
function betweenAd(go) { const S = Save.data, now = Date.now(); if (CG.ready && S.plays >= 2 && now - (CG.lastAd || 0) > 150000) { CG.lastAd = now; CG.ad('midgame', () => go()); } else go(); }
function leaveRace(R) { R.scene.stop('HUD'); }
function restartRace(R) { leaveRace(R); R.scene.restart(R.cfg); }
function startEvent(R, n) { leaveRace(R); R.scene.restart({ mode: 'champ', cup: n.cup, ev: n.ev }); }
function toMenu(R) { leaveRace(R); R.scene.start('Race', { mode: 'attract', theme: R.theme }); R.scene.launch('Title'); }
