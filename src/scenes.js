// Drift Rally Mini — boot/loading, title, championship, time trial and garage scenes.
function bgKeys(th) { const t = TRACK_META[th].tiles; if (!t) return ['bg_' + th]; const k = []; for (let i = 0; i < t[0] * t[1]; i++) k.push('bg_' + th + '_' + i); return k; }
function loadBg(L, th) { bgKeys(th).forEach(k => L.image(k, 'assets/' + k + '.webp')); }
function ovKeys(th) { const k = ['ov_' + th]; for (let p = 1; p < (TRACK_META[th].ovp || 1); p++) k.push('ov_' + th + '_' + p); return k; }   // overlay atlas pages (hi-res props need >1 4096 page)
function loadOv(L, th) { ovKeys(th).forEach(k => L.atlas(k, 'assets/' + k + '.webp', 'assets/' + k + '.json')); L.json('ovm_' + th, 'assets/ovm_' + th + '.json'); }
function ensureTheme(s, theme, cb) {
  if (s.textures.exists(bgKeys(theme)[0])) return cb();
  const L = s.load; loadBg(L, theme); loadOv(L, theme);
  const bar = s.add.graphics().setDepth(1e6); const t = txt(s, 960, 540, 'LOADING ' + THEMES[theme].name.toUpperCase() + '…', 56).setDepth(1e6);
  L.on('progress', p => { bar.clear(); bar.fillStyle(0x000000, .6); bar.fillRoundedRect(560, 600, 800, 30, 15); bar.fillStyle(0xffd23a, 1); bar.fillRoundedRect(564, 604, 792 * p, 22, 11); });
  L.once('complete', () => { bar.destroy(); t.destroy(); cb(); }); L.start();
}
function goRace(s, cfg) {
  const theme = cfg.mode === 'champ' || cfg.mode === 'tutorial' ? CUPS[cfg.cup].theme : cfg.theme;
  ensureTheme(s, theme, () => { ['Title', 'Cups', 'Garage', 'Trial', 'HUD'].forEach(k => { if (k !== s.scene.key) s.scene.stop(k); }); s.scene.start('Race', cfg); });
}
class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    CG.loadingStart(); const L = this.load;
    const g = this.add.graphics(); this.load.on('progress', p => { g.clear(); g.fillStyle(0x000000, .5); g.fillRoundedRect(560, 760, 800, 34, 17); g.fillStyle(0xffd23a, 1); g.fillRoundedRect(564, 764, 792 * p, 26, 13); });
    L.image('logo', 'assets/logo.webp'); L.atlas('ui', 'assets/ui.webp', 'assets/ui.json'); L.atlas('fx', 'assets/fx.webp', 'assets/fx.json');
    CAR_ORDER.forEach(id => L.atlas('car_' + id, 'assets/car_' + id + '.webp', 'assets/car_' + id + '.json'));
    const th = QS.get('theme') || 'desert';
    loadBg(L, th); loadOv(L, th);
  }
  create() {
    CG.loadingStop(); document.getElementById('ld') && document.getElementById('ld').remove();
    const sc = QS.get('scene'), S = Save.data;
    if (sc === 'Garage' || sc === 'Cups' || sc === 'Trial' || sc === 'Title') { this.scene.start('Race', { mode: 'attract', theme: QS.get('theme') || 'desert' }); this.scene.launch(sc === 'Title' ? 'Title' : sc); return; }
    if (QS.get('race')) { const [c, e] = QS.get('race').split(',').map(Number); goRace(this, { mode: 'champ', cup: c, ev: e }); return; }
    if (QS.get('trial')) { goRace(this, { mode: 'trial', theme: QS.get('trial') }); return; }
    if (!S.tutorial) this.scene.start('Race', { mode: 'tutorial', cup: 0, ev: 0 });   // first launch: straight into the tutorial race, 0 clicks
    else { this.scene.start('Race', { mode: 'attract', theme: 'desert' }); this.scene.launch('Title'); }
  }
}
class Title extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    const s = this; Sound.setTrack('menu', 0);
    const shade = s.add.graphics(); shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, .55, .55, 0, 0); shade.fillRect(0, 0, GW, 420); shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, .6, .6); shade.fillRect(0, 640, GW, 440);
    const logo = s.add.image(960, 250, 'logo').setScale(.9); logo.setScale(Math.min(1, 1100 / logo.width)); const ls = logo.scale;
    logo.setScale(ls * .6).setAlpha(0); this.tweens.add({ targets: logo, scale: ls, alpha: 1, duration: 600, ease: 'Back.Out' }); this.tweens.add({ targets: logo, y: 262, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 600 });
    const play = button(s, 960, 640, 520, 140, 'PLAY', 0x3cc84a, () => this.go('Cups'), { icon: 'flag', size: 74 });
    this.tweens.add({ targets: play, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    button(s, 700, 820, 420, 112, 'TIME TRIAL', 0x2a8af0, () => this.go('Trial'), { icon: 'clock', size: 46 });
    button(s, 1220, 820, 420, 112, 'GARAGE', 0xf0a020, () => this.go('Garage'), { icon: 'wrench', size: 46 });
    const cl = coinLabel(s, 60, 60, 44); panel(s, 26, 22, 280, 80, { r: 40 }).setDepth(-1); cl.setDepth(1);
    s.add.image(360, 62, 'ui', 'star').setDisplaySize(56, 56); txt(s, 400, 62, '' + totalStars() + '/' + (CUPS.length * 4 * 3 + 9), 40, '#ffe066', { ox: 0 });
    iconToggle(s, GW - 180, 70, 'music', () => Save.data.music > 0, v => { Save.data.music = v ? .6 : 0; Save.save(); Sound.apply(); });
    iconToggle(s, GW - 70, 70, 'sfx', () => Save.data.sfx > 0, v => { Save.data.sfx = v ? .9 : 0; Save.save(); Sound.apply(); });
    txt(s, 960, GH - 40, isTouchDev() ? 'Hold the side arrows to steer  •  hold DRIFT  •  tap BOOST' : 'Steer with ARROWS or A / D  •  hold SPACE to drift  •  SHIFT boost  •  P pause', 30, '#e8e0d0');
    this.input.keyboard.once('keydown-ENTER', () => this.go('Cups')); this.cameras.main.fadeIn(250);
  }
  go(k) { this.scene.stop(); this.scene.launch(k); }
}
class Cups extends Phaser.Scene {
  constructor() { super('Cups'); }
  create() {
    const s = this; s.add.rectangle(960, 540, GW, GH, 0x000000, .5).setInteractive();
    txt(s, 960, 80, 'CHAMPIONSHIP', 84, '#ffd23a', { st: 12 });
    button(s, 110, 80, 150, 92, '', 0x4a6ad8, () => { this.scene.stop(); this.scene.launch('Title'); }, { icon: 'back', sfx: 'back' });
    const sc = coinLabel(s, GW - 330, 80, 44); s.add.image(GW - 130, 80, 'ui', 'star').setDisplaySize(56, 56); txt(s, GW - 95, 80, '' + totalStars(), 44, '#ffe066', { ox: 0 });
    CUPS.forEach((cup, ci) => {
      const x = 330 + ci * 630, y = 580, w = 580, h = 820, lock = totalStars() < cup.need; const c = s.add.container(x, y);
      c.add(panel(s, -w / 2, -h / 2, w, h, { r: 34, a: .9 }));
      const th = s.add.image(0, -h / 2 + 150, 'ui', 'thumb_' + cup.theme); th.setDisplaySize(w - 40, 250); c.add(th);
      const mk = s.add.graphics(); mk.fillStyle(0xffffff); mk.fillRoundedRect(x - w / 2 + 20, y - h / 2 + 25, w - 40, 250, 22); th.setMask(mk.createGeometryMask()); mk.setVisible(false);
      c.add(txt(s, 0, -h / 2 + 310, cup.name.toUpperCase(), 50, '#ffffff'));
      let cs = 0; cup.events.forEach((e, ei) => cs += Save.data.stars[evKey(ci, ei)] || 0); c.add(s.add.image(-40, -h / 2 + 360, 'ui', 'star').setDisplaySize(42, 42)); c.add(txt(s, -10, -h / 2 + 360, cs + '/12', 34, '#ffe066', { ox: 0 }));
      cup.events.forEach((e, ei) => {
        const prev = ei === 0 || (Save.data.stars[evKey(ci, ei - 1)] || 0) > 0, open = !lock && prev, sv = Save.data.stars[evKey(ci, ei)] || 0;
        const ey = -h / 2 + 450 + ei * 100;
        const b = button(s, 0, ey, w - 60, 86, '', open ? [0x3cc84a, 0xe0582a, 0x2a8af0, 0x8a3ad8][['race', 'drift', 'race', 'trial'].indexOf(e.type) >= 0 ? (e.type === 'race' ? (e.rev ? 2 : 0) : e.type === 'drift' ? 1 : 3) : 0] : 0x555a66, () => { if (!open) return; this.scene.stop(); goRace(this.scene.get('Race') || this, { mode: 'champ', cup: ci, ev: ei }); }, { r: 22 });
        b.add(s.add.image(-w / 2 + 70, -2, 'ui', open ? (e.type === 'drift' ? 'drift' : e.type === 'trial' ? 'clock' : 'flag') : 'lock').setDisplaySize(54, 54));
        b.add(txt(s, -w / 2 + 110, -14, e.name, 32, '#ffffff', { ox: 0 })); b.add(txt(s, -w / 2 + 110, 18, (e.type === 'race' ? e.laps + ' laps vs 3 rivals' : e.type === 'drift' ? 'Score ' + e.goal[0] + '+' : 'Lap under ' + e.goal[0] + 's') + (e.rev ? ' • reversed' : ''), 22, '#f0f0f0', { ox: 0, st: 4 }));
        stars(s, w / 2 - 105, -2, sv, 34, 38).forEach(im => b.add(im));
        b.setEnabled(open); c.add(b);
      });
      if (lock) { const lk = s.add.container(0, 0); const g = s.add.graphics(); g.fillStyle(0x000000, .55); g.fillRoundedRect(-w / 2, -h / 2, w, h, 34); lk.add(g); lk.add(s.add.image(0, -40, 'ui', 'lock').setDisplaySize(140, 140)); lk.add(txt(s, 0, 70, 'Collect ' + cup.need + ' stars', 44, '#ffffff')); c.add(lk); }
      c.setAlpha(0); c.y += 40; this.tweens.add({ targets: c, alpha: 1, y, duration: 300, delay: ci * 90, ease: 'Cubic.Out' });
    });
    this.input.keyboard.once('keydown-ENTER', () => { this.scene.stop(); goRace(this.scene.get('Race'), { mode: 'champ', cup: 0, ev: 0 }); });
  }
}
class Trial extends Phaser.Scene {
  constructor() { super('Trial'); }
  create() {
    const s = this; s.add.rectangle(960, 540, GW, GH, 0x000000, .5).setInteractive();
    txt(s, 960, 80, 'TIME TRIAL', 84, '#8fe8ff', { st: 12 }); txt(s, 960, 160, 'Race your own ghost — best lap on each track', 36, '#ffffff');
    button(s, 110, 80, 150, 92, '', 0x4a6ad8, () => { this.scene.stop(); this.scene.launch('Title'); }, { icon: 'back', sfx: 'back' });
    ['desert', 'snow', 'neon'].forEach((th, i) => {
      const x = 330 + i * 630, y = 600, w = 580, h = 700, c = s.add.container(x, y); c.add(panel(s, -w / 2, -h / 2, w, h, { r: 34, a: .9 }));
      const im = s.add.image(0, -h / 2 + 170, 'ui', 'thumb_' + th).setDisplaySize(w - 40, 290); c.add(im);
      c.add(txt(s, 0, -h / 2 + 360, THEMES[th].name.toUpperCase(), 50));
      const best = Save.data.best[th]; c.add(txt(s, 0, -h / 2 + 430, 'BEST LAP  ' + (best ? fmtTime(best) : '--:--.--'), 40, '#ffe066'));
      const g = TRIAL_GOALS[th]; c.add(txt(s, 0, -h / 2 + 485, '★ ' + g[0] + 's   ★★ ' + g[1] + 's   ★★★ ' + g[2] + 's', 30, '#c8d2e0'));
      stars(s, 0, -h / 2 + 545, Save.data.stars['tt_' + th] || 0, 52, 60).forEach(o => c.add(o));
      c.add(button(s, 0, h / 2 - 70, 320, 96, 'RACE', 0x3cc84a, () => { this.scene.stop(); goRace(this.scene.get('Race'), { mode: 'trial', theme: th }); }, { icon: 'clock' }));
      c.setAlpha(0); c.y += 40; this.tweens.add({ targets: c, alpha: 1, y, duration: 300, delay: i * 90, ease: 'Cubic.Out' });
    });
  }
}
class Garage extends Phaser.Scene {
  constructor() { super('Garage'); }
  create() {
    const s = this; s.add.rectangle(960, 540, GW, GH, 0x0a0806, .72).setInteractive();
    txt(s, 960, 80, 'GARAGE', 84, '#ffd23a', { st: 12 });
    button(s, 110, 80, 150, 92, '', 0x4a6ad8, () => { this.scene.stop(); this.scene.launch('Title'); }, { icon: 'back', sfx: 'back' });
    this.coins = coinLabel(s, GW - 330, 80, 44);
    this.sel = Save.data.car; this.idx = CAR_ORDER.indexOf(this.sel);
    // turntable
    const ped = s.add.image(560, 640, 'ui', 'pedestal').setScale(1.15); this.spin = s.add.image(560, 560, 'car_' + this.sel, this.sel + '_00').setScale(2.0 * CAR_K); this.fr = 0;
    this.nameT = txt(s, 560, 250, '', 70); this.numT = txt(s, 560, 320, '', 36, '#c8d2e0');
    button(s, 190, 560, 110, 130, '', 0x3a4250, () => this.pick(-1), { icon: 'left', r: 26 }); button(s, 930, 560, 110, 130, '', 0x3a4250, () => this.pick(1), { icon: 'right', r: 26 });
    this.dotsG = s.add.graphics();
    // stats + upgrades panel
    panel(s, 1080, 190, 790, 820, { r: 34, a: .9 }); this.statC = s.add.container(0, 0);
    this.action = button(s, 560, 900, 460, 116, 'SELECT', 0x3cc84a, () => this.act(), { size: 54 });
    const fc = this.fc = button(s, 560, 1020, 420, 70, 'FREE +150', 0x8a3ad8, () => { if (this.freeWait() > 0) return; fc.setEnabled(false); CG.ad('rewarded', ok => { if (ok) { Save.data.coins += 150; Save.data.lastFree = Date.now(); Save.save(); Sound.play('coin'); this.refresh(); this.cameras.main.flash(200, 255, 230, 120); } else { this.nameT && toast(s, 'No video available - try again later'); } fc.setEnabled(true); }); }, { icon: 'video', size: 30 });
    this.input.keyboard.on('keydown-LEFT', () => this.pick(-1)); this.input.keyboard.on('keydown-RIGHT', () => this.pick(1));
    this.refresh();
  }
  pick(d) { this.idx = (this.idx + d + CAR_ORDER.length) % CAR_ORDER.length; this.sel = CAR_ORDER[this.idx]; Sound.play('select'); this.spin.setTexture('car_' + this.sel, this.sel + '_00'); this.spin.x = 560 + d * 60; this.tweens.add({ targets: this.spin, x: 560, duration: 200, ease: 'Cubic.Out' }); this.refresh(); }
  act() {
    const id = this.sel, S = Save.data;
    if (S.cars.includes(id)) { S.car = id; Save.save(); Sound.play('confirm'); }
    else if (S.coins >= CARS[id].price) { S.coins -= CARS[id].price; S.cars.push(id); S.car = id; Save.save(); Sound.play('unlock'); Sound.play('coin'); this.cameras.main.flash(200, 255, 230, 120); }
    else { Sound.play('deny'); this.tweens.add({ targets: this.coins, x: this.coins.x + 10, duration: 50, yoyo: true, repeat: 3 }); }
    this.refresh();
  }
  refresh() {
    const s = this, id = this.sel, C = CARS[id], S = Save.data, own = S.cars.includes(id); this.coins.upd();
    this.nameT.setText(C.name.toUpperCase()); this.numT.setText('#' + C.num + (own ? (S.car === id ? '  •  EQUIPPED' : '  •  OWNED') : ''));
    this.action.label.setText(own ? (S.car === id ? 'EQUIPPED' : 'SELECT') : C.price + ''); this.action.redraw(own ? (S.car === id ? 0x2a8a3a : 0x3cc84a) : (S.coins >= C.price ? 0xf0a020 : 0x777a84));
    if (this.action.icon) this.action.icon.destroy(); this.action.icon = null; if (!own) { const ic = s.add.image(-150, -2, 'ui', 'coin').setDisplaySize(64, 64); this.action.add(ic); this.action.icon = ic; }
    this.dotsG.clear(); CAR_ORDER.forEach((k, i) => { this.dotsG.fillStyle(k === id ? 0xffd23a : (S.cars.includes(k) ? 0xffffff : 0x666a74), 1); this.dotsG.fillCircle(560 + (i - (CAR_ORDER.length - 1) / 2) * 34, 790, k === id ? 11 : 8); });
    const c = this.statC; c.removeAll(true); const st = carStats(id);
    const bars = [['SPEED', (st.s - 1000) / 450], ['ACCEL', (st.a - 850) / 550], ['GRIP', (st.g - 8.5) / 3], ['DRIFT', (C.d * st.t - 2.9) / 1.6]];
    bars.forEach((b, i) => { const y = 260 + i * 78; c.add(txt(s, 1130, y, b[0], 38, '#ffffff', { ox: 0 })); const g = s.add.graphics(); g.fillStyle(0x000000, .5); g.fillRoundedRect(1330, y - 16, 480, 32, 16); g.fillStyle([0xff5a3a, 0xffc21a, 0x3cc84a, 0x2ab0ff][i], 1); g.fillRoundedRect(1330, y - 16, Math.max(36, 480 * Math.min(1, Math.max(.06, b[1]))), 32, 16); g.fillStyle(0xffffff, .25); g.fillRoundedRect(1336, y - 12, Math.max(24, 468 * Math.min(1, Math.max(.06, b[1]))), 10, 5); c.add(g); });
    c.add(txt(s, 1475, 600, own ? 'UPGRADES' : 'BUY TO UPGRADE', 44, '#ffd23a'));
    UPGRADES.forEach((u, i) => {
      const y = 690 + i * 105, lv = (S.up[id] || {})[u.k] || 0; c.add(txt(s, 1130, y - 14, u.name, 40, '#ffffff', { ox: 0 })); c.add(txt(s, 1130, y + 24, u.desc, 24, '#c8d2e0', { ox: 0, st: 4 }));
      for (let k = 0; k < 3; k++) { const g = s.add.graphics(); g.fillStyle(k < lv ? 0x7dff3a : 0x3a3e48, 1); g.fillRoundedRect(1460 + k * 50, y - 14, 40, 26, 8); c.add(g); }
      const max = lv >= 3, cost = max ? 0 : u.cost[lv];
      const b = button(s, 1730, y, 220, 78, max ? 'MAX' : '' + cost, max ? 0x2a8a3a : (S.coins >= cost && own ? 0xf0a020 : 0x777a84), () => {
        if (!own || max) return Sound.play('deny'); if (S.coins < cost) { Sound.play('deny'); return; }
        S.coins -= cost; S.up[id] = Object.assign({}, S.up[id] || {}); S.up[id][u.k] = lv + 1; Save.save(); Sound.play('unlock'); this.refresh(); }, { icon: max ? null : 'coin', size: 34 });
      if (!own) b.setEnabled(false); c.add(b);
    });
  }
  freeWait() { return Math.max(0, 180 - (Date.now() - (Save.data.lastFree || 0)) / 1000); }
  update(t, d) { const w = this.freeWait(); if (this.fc) { const lab = w > 0 ? 'FREE IN ' + Math.floor(w / 60) + ':' + String(Math.ceil(w % 60) % 60).padStart(2, '0') : 'FREE +150'; if (this.fc.label.text !== lab) { this.fc.label.setText(lab); this.fc.setAlpha(w > 0 ? .6 : 1); } }
    this.fr = (this.fr + d / 1000 * 18) % 64; this.spin.setFrame(this.sel + '_' + String(Math.floor(this.fr)).padStart(2, '0')); }
}
