// Drift Rally Mini — race scene: arcade drift physics (fixed 1/120 s step), AI racing lines, laps, drift combos, boost, ghost, FX.
const DT = 1 / 120;
const AI_POOL = ['blue', 'yellow', 'muscle', 'bug', 'truck', 'gt', 'police', 'mini'];
class Race extends Phaser.Scene {
  constructor() { super('Race'); }
  init(cfg) { this.cfg = Object.assign({ mode: 'champ', cup: 0, ev: 0 }, cfg || {}); }
  create() {
    const C = this.cfg; window.__race = this;
    if (C.mode === 'champ' || C.mode === 'tutorial') { const ev = CUPS[C.cup].events[C.ev]; this.ev = ev; this.theme = CUPS[C.cup].theme; this.type = ev.type; this.laps = ev.laps; this.rev = !!ev.rev; this.aiSkill = ev.ai || .85; }
    else if (C.mode === 'trial') { this.theme = C.theme; this.type = 'trial'; this.laps = 3; this.rev = false; this.ev = null; }
    else { this.theme = C.theme || 'desert'; this.type = 'race'; this.laps = 99; this.rev = false; this.aiSkill = .95; }
    if (C.mode === 'tutorial') this.aiSkill = .72;
    this.tutorial = C.mode === 'tutorial'; this.attract = C.mode === 'attract';
    const TH = THEMES[this.theme]; this.TH = TH; const meta = TRACK_META[this.theme]; this.meta = meta; this.OY = meta.oy;
    this.tr = buildTrack(this.theme, this.rev);
    this.ghostKey = this.theme + (this.rev ? '_r' : '');
    // ---- world layers
    // free the other tracks' big background textures (GPU memory on phones), then lay out this track's tiles
    Object.keys(TRACK_META).forEach(th => { if (th !== this.theme) bgKeys(th).concat(ovKeys(th)).forEach(k => { if (this.textures.exists(k)) this.textures.remove(k); }); });
    { const T = meta.tiles; if (!T) this.add.image(meta.ix || 0, meta.iy || 0, 'bg_' + this.theme).setOrigin(0).setScale(meta.scale).setDepth(-10);
      else for (let i = 0; i < T[0] * T[1]; i++) this.add.image((meta.ix || 0) + (i % T[0]) * T[2] * meta.scale, (meta.iy || 0) + Math.floor(i / T[0]) * T[3] * meta.scale, 'bg_' + this.theme + '_' + i).setOrigin(0).setScale(meta.scale).setDepth(-10); }
    this.worldW = meta.w; this.worldH = meta.h;
    this.marks = this.add.renderTexture(0, 0, Math.ceil((meta.mw || meta.w) / 2), Math.ceil((meta.mh || meta.h) / 2)).setOrigin(0).setScale(2).setDepth(-5);
    const om = this.cache.json.get('ovm_' + this.theme);
    if (om) om.forEach(o => this.add.image(o.x, o.y, 'ov_' + this.theme + (o.a ? '_' + o.a : ''), o.f).setOrigin(0).setScale(meta.scale).setDepth(o.d));
    // ---- FX emitters
    this.smoke = this.add.particles(0, 0, 'fx', { frame: 'puff', lifespan: { min: 800, max: 1600 }, speed: { min: 10, max: 55 }, scale: { start: .36, end: 1.45 }, alpha: { start: .62, end: 0 }, rotate: { min: 0, max: 360 }, tint: TH.smoke, emitting: false }).setDepth(2);   // under the cars: smoke trails behind, never hides the player
    this.dust = this.add.particles(0, 0, 'fx', { frame: 'puff', lifespan: { min: 500, max: 900 }, speed: { min: 20, max: 70 }, scale: { start: .25, end: .8 }, alpha: { start: .5, end: 0 }, rotate: { min: 0, max: 360 }, tint: TH.dust, emitting: false }).setDepth(8999);
    this.sparks = this.add.particles(0, 0, 'fx', { frame: 'spark', lifespan: { min: 180, max: 420 }, speed: { min: 180, max: 520 }, scale: { start: .55, end: .1 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', gravityY: 600, rotate: { onEmit: () => 0 }, emitting: false }).setDepth(9100);
    this.flames = this.add.particles(0, 0, 'fx', { frame: 'flame', lifespan: { min: 120, max: 220 }, speed: { min: 20, max: 60 }, scale: { start: .55, end: .15 }, alpha: { start: .95, end: 0 }, blendMode: 'ADD', emitting: false }).setDepth(9050);
    this.confetti = null;
    // ---- cars
    this.cars = []; const me = Save.data.car;
    const nAI = (this.type === 'race' || this.attract) ? 3 : 0;
    const pool = AI_POOL.filter(k => k !== me); const ai = this.tutorial ? ['blue', 'yellow', 'bug'] : [pool[0], pool[1], pool[2 + (C.cup + C.ev) % 4]];
    const grid = []; for (let g = 0; g < 4; g++) grid.push(g);
    const order = this.attract ? ['blue', 'yellow', 'mini', 'muscle'] : (nAI ? [ai[0], ai[1], me, ai[2]] : [me]); // player starts 3rd: room to overtake
    order.forEach((id, g) => {
      const i = (this.tr.n - 5 - g * 5) % this.tr.n, side = g % 2 ? 1 : -1, P = this.tr.pts[i];
      const car = this.makeCar(id, P[0] + this.tr.nx[i] * side * 2.1 * U, P[1] + this.tr.ny[i] * side * 2.1 * U, Math.atan2(this.tr.ty[i], this.tr.tx[i]), this.attract || id !== me || (g !== 2 && nAI));
      car.idx = i; this.cars.push(car);
    });
    if (!nAI && !this.attract) { this.cars[0].ai = null; }
    this.player = this.attract ? this.cars[0] : this.cars.find(c => !c.ai);
    // ghost
    this.ghost = null; const gd = Save.data.ghosts[this.ghostKey];
    if (!this.attract && (this.type === 'trial' || this.type === 'drift') && gd) {
      this.ghost = { d: gd, spr: this.add.image(0, 0, 'car_' + gd.car, gd.car + '_00').setAlpha(.42).setTint(0x8fe8ff).setBlendMode(Phaser.BlendModes.SCREEN).setScale(U / (256 / CARS[gd.car].o) * CAR_K) };
    }
    this.rec = []; this.recT = 0;
    // ---- camera + post FX
    const cam = this.cameras.main; cam.setBounds(meta.ix || 0, meta.iy || 0, meta.w, meta.h); cam.setBackgroundColor(0x000000); this.camZoom = CAM_Z0; this.lookX = 0; this.lookY = 0; this.camA = undefined;
    cam.centerOn(this.player.x, this.sy(this.player.y)); this.shakeT = 0;
    if (Save.data.fx && QS.get('fx') !== '0' && this.game.renderer.type === Phaser.WEBGL && cam.postFX) {
      try {
        this.cm = cam.postFX.addColorMatrix(); this.cm.saturate(TH.night ? .12 : .16); this.cm.contrast(.06, true); if (TH.night) this.cm.brightness(1.02, true);
        cam.postFX.addVignette(.5, .5, .92, .3);
        if (TH.night || !isTouchDev()) this.bloom = cam.postFX.addBloom(0xffffff, 1, 1, .9, TH.night ? 1.25 : .55, 4);
      } catch (e) {}
    }
    // ---- state
    this.state = 'count'; this.countT = this.attract ? 0 : 3.4; this.t = 0; this.acc = 0; this.paused = false; this.results = null; this.slowmo = 1;
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,SHIFT,X,P,R,ENTER,Z,C');
    this.input.keyboard.on('keydown-R', () => { if (this.state === 'race') this.respawn(this.player); });
    this.touch = { steer: 0, drift: false, boost: false, brake: false };
    this.msgs = []; this.events.once('shutdown', () => { Sound.car(false, 0, 0, 0, 0); if (window.__race === this) window.__race = null; CG.gameplayStop(); });
    Sound.setTrack(this.attract ? 'menu' : 'race', TH.music);
    if (!this.attract) { this.scene.launch('HUD', { race: this }); this.scene.bringToTop('HUD'); }
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.bot = QS.get('bot') === '1'; this.showoff = QS.get('showoff') === '1';
    this.tut = this.tutorial ? { step: 0, t: 0, drifted: 0, boosted: 0 } : null;
  }
  sy(y, z = 0) { return this.OY + y * KY - z * KZ * U; }
  makeCar(id, x, y, a, isAI) {
    const st = isAI ? Object.assign({}, CARS[id]) : carStats(id); if (isAI) { st.boost = 1; st.boostLen = 1; if (!this.attract) { const k = this.aiSkill; st.s = 1150 * k; st.a = 1000 * k; st.g = 9.6; st.t = 3.25; } }
    const spr = this.add.image(x, this.sy(y), 'car_' + id, id + '_00').setScale(U / (256 / CARS[id].o) * CAR_K);
    if (this.TH.night) spr.setTint(this.TH.tint);
    const glow = this.TH.night ? this.add.image(0, 0, 'fx', 'beam').setBlendMode(Phaser.BlendModes.ADD).setAlpha(.55).setScale(1.1) : null;
    return { id, x, y, a, vx: 0, vy: 0, steer: 0, drift: false, driftT: 0, driftPts: 0, mult: 1, comboT: 0, graceT: 0, meter: this.tutorial ? .35 : 0, boostT: 0, turboT: 0,
      lap: 0, cp: true, idx: 0, prog: 0, finished: false, finishT: 0, lapStart: 0, lastLap: 0, bestLap: Infinity, lapTimes: [], st, spr, glow, ai: isAI ? { skill: this.aiSkill * (0.97 + Math.random() * .06), hbT: 0, laneO: (Math.random() - .5) * .5 * U, wobble: Math.random() * 6 } : null,
      score: 0, off: 0, offT: 0, wrongT: 0, stuckT: 0, rpm: 0, gear: 1, slip: 0, spd: 0, onCurb: 0, sand: 0, lastHit: 0, hits: 0, finishPos: 0, inp: { steer: 0, gas: 0, brake: 0, hb: false, boost: false } };
  }
  // ---------------------------------------------------------------- input
  readPlayer() {
    const k = this.keys, T = this.touch, ag = Save.data.autogas;
    let steer = (k.LEFT.isDown || k.A.isDown ? -1 : 0) + (k.RIGHT.isDown || k.D.isDown ? 1 : 0); if (T.steer) steer = T.steer;
    const brake = k.DOWN.isDown || k.S.isDown || T.brake; const up = k.UP.isDown || k.W.isDown;
    const gas = brake ? 0 : (ag || up || isTouchDev() ? 1 : 0);
    return { steer, gas, brake: brake ? 1 : 0, hb: k.SPACE.isDown || k.Z.isDown || T.drift, boost: k.SHIFT.isDown || k.X.isDown || k.C.isDown || T.boost };
  }
  aiInput(c) {
    const tr = this.tr, A = c.ai, n = tr.n, spd = c.spd;
    const look = Math.round(5 + spd / 95), j = (c.idx + look) % n, L = tr.line[j];
    const tx = L[0] + tr.nx[j] * A.laneO, ty = L[1] + tr.ny[j] * A.laneO;
    let da = Math.atan2(ty - c.y, tx - c.x) - c.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const steer = Math.max(-1, Math.min(1, da * 2.6));
    // speed planning: lateral acceleration budget
    let vt = 1e9; for (let k = 2; k < 30; k += 2) { const q = (c.idx + Math.round(spd / U * .55) + k) % n; vt = Math.min(vt, tr.vsafe[q] * Math.sqrt(1900 * A.skill)); }
    let skill = A.skill; const P = this.player;
    if (P && P !== c && !this.attract) { const gap = (c.prog - P.prog) / U; skill *= gap < -12 ? 1.07 : gap > 25 ? .94 : 1; }
    vt = Math.min(vt, c.st.s * (skill / A.skill));
    let brake = spd > vt * 1.08 ? 1 : 0; let gas = spd < vt ? 1 : (brake ? 0 : .3);
    if (A.sloppy) { // test-only "average human": wobbly steering, late/over braking, random throttle lifts, wide lines
      A.nz += ((Math.random() - .5) * 2 - A.nz) * .04; A.laneO = Math.sin(this.t * .7 + c.idx * .01) * 45;
      if (A.liftT > 0) { A.liftT -= DT; gas = 0; } else if (Math.random() < .006) A.liftT = .25 + Math.random() * .5;
      if (spd > vt * .9 && Math.random() < .6) { brake = 1; gas = 0; }
      return { steer: Math.max(-1, Math.min(1, steer + A.nz * .8)), gas, brake, hb: false, boost: c.meter > .99 && cAhead < .01 && Math.random() < .01 };
    }
    // stylish drift into tight corners
    let hb = false; const cAhead = Math.abs(tr.curv[(c.idx + 8) % n]) * U;
    if (A.hbT > 0) { A.hbT -= DT; hb = true; } else if (cAhead > .045 && spd > 560 && Math.random() < (c === this.player && this.showoff ? .25 : .03)) A.hbT = .22 + Math.random() * .25;
    const boost = c.meter > .45 && cAhead < .012 && Math.random() < .02;
    return { steer, gas, brake, hb, boost: boost || (c.boostT > 0) };
  }
  // ---------------------------------------------------------------- physics
  stepCar(c, inp, dt) {
    const st = c.st, tr = this.tr; c.inp = inp;
    let fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;
    let vf = c.vx * fx + c.vy * fy, vr = c.vx * rx + c.vy * ry; const spd = Math.hypot(c.vx, c.vy);
    const loc = locate(tr, c.x, c.y, c.idx); c.idx = loc.i; c.loc = loc; const ao = Math.abs(loc.off);
    c.onCurb = ao > tr.hw - 6 && ao < tr.curb ? 1 : 0; c.sand = ao >= tr.curb ? Math.min(1, (ao - tr.curb) / 30) : 0;
    // boost
    let boosting = false;
    if (c.turboT > 0) { c.turboT -= dt; boosting = true; }
    if (inp.boost && c.meter > .02 && this.state === 'race') { c.meter = Math.max(0, c.meter - dt * .3 / st.boostLen); boosting = true; if (!c.boostOn) { c.boostOn = true; if (c === this.player) { Sound.play('boost'); this.cameras.main.shake(160, .002); } } }
    else c.boostOn = false;
    c.boosting = boosting;
    const vmax = st.s * (boosting ? 1.32 * st.boost : 1) * (1 - c.sand * .42) * (this.state === 'race' || this.attract ? 1 : 0);
    const acc = st.a * (boosting ? 2.0 : 1);
    // throttle / brake / reverse
    if (inp.brake) { if (vf > 30) vf -= 1500 * dt; else vf = Math.max(-320, vf - 700 * dt); }
    else if (inp.gas && vmax > 0) { vf += acc * inp.gas * Math.max(0, 1 - vf / vmax) * dt; if (vf > vmax) vf += (vmax - vf) * 2 * dt; }
    vf -= vf * (.18 + c.sand * 1.6) * dt;                    // rolling + sand drag
    if (!inp.gas && !inp.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 140 * dt);
    // drift state
    const slip = Math.atan2(vr, Math.max(60, Math.abs(vf)));
    if (inp.hb && !c.hbPrev && spd > 300 && this.state === 'race') { c.drift = true; c.a += (inp.steer || Math.sign(c.steer) || 0) * .09; }
    if (inp.hb && spd > 260) { if (Math.abs(inp.steer) > .2 && spd > 300) c.drift = true; }
    if (c.drift && ((!inp.hb && Math.abs(slip) < .14) || spd < 220)) c.drift = false;
    c.hbPrev = inp.hb;
    // steering
    c.steer += (inp.steer - c.steer) * Math.min(1, dt * (c.drift ? 14 : 9));
    const sf = Math.min(1, spd / 260) * (1 - .3 * Math.min(1, spd / 1500));
    let yaw = c.steer * st.t * sf * (vf >= -10 ? 1 : -1);
    if (c.drift) yaw *= 1.32 * st.d; if (c.sand) yaw *= .8;
    c.a += yaw * dt;
    { const wx = fx * vf + rx * vr, wy = fy * vf + ry * vr; fx = Math.cos(c.a); fy = Math.sin(c.a); rx = -fy; ry = fx; vf = wx * fx + wy * fy; vr = wx * rx + wy * ry; }   // velocity lags the new heading -> slip
    // lateral grip (low while drifting), drift keeps momentum
    const g = c.drift ? 1.7 + .4 * (st.d - 1) : st.g * (1 - c.sand * .35) * (inp.hb ? .5 : 1);
    const keep = Math.exp(-g * dt), lost = Math.abs(vr) * (1 - keep);
    vr *= keep; if (vf > 0) vf += lost * (c.drift ? .7 : .35);
    if (c.drift) vf -= vf * .1 * dt;
    if (inp.hb && !c.drift && vf > 0) vf -= vf * .9 * dt;
    fx = Math.cos(c.a); fy = Math.sin(c.a); rx = -fy; ry = fx;
    c.vx = fx * vf + rx * vr; c.vy = fy * vf + ry * vr;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.spd = Math.hypot(c.vx, c.vy); c.slip = Math.atan2(vr, Math.max(60, Math.abs(vf))); c.vf = vf;
    // barriers: distance to centre line (the tyre walls)
    const l2 = locate(tr, c.x, c.y, c.idx), lim = tr.bar - .95 * U;
    if (Math.abs(l2.off) > lim) {
      const s = Math.sign(l2.off), wx = l2.nx * s, wy = l2.ny * s, pen = Math.abs(l2.off) - lim;
      c.x -= wx * pen; c.y -= wy * pen; const vn = c.vx * wx + c.vy * wy;
      if (vn > 0) {
        c.vx -= wx * vn * 1.35; c.vy -= wy * vn * 1.35; c.vx *= .965; c.vy *= .965;
        const ang = Math.atan2(wy, wx); let d = c.a - ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        c.a -= Math.sign(d) * Math.min(.5, vn / 2500) * (Math.abs(d) < Math.PI / 2 ? -1 : 1) * .5;
        this.hit(c, vn, c.x + wx * .9 * U, c.y + wy * .9 * U, 'wall');
      }
    }
    // progress + laps
    const i = l2.i, n = tr.n, prev = c.lastI == null ? i : c.lastI;
    if (i > n * .4 && i < n * .6) c.cp = true;
    if (prev > n - 25 && i < 25 && c.cp) { this.crossLine(c); c.cp = false; }
    if (prev < 25 && i > n - 25 && c.lap > 0) { c.lap--; c.cp = true; }      // backwards over the line
    c.lastI = i; c.prog = c.lap * n * U + (i + l2.t) * U - (c.lap === 0 && i > n / 2 ? n * U : 0);
    // wrong way / stuck
    const dot = fx * tr.tx[i] + fy * tr.ty[i];
    c.wrongT = (dot < -.4 && c.spd > 120) ? c.wrongT + dt : 0;
    c.stuckT = (this.state === 'race' && c.spd < 50 && (inp.gas || inp.brake)) ? c.stuckT + dt : 0;
    if (c.ai && (c.stuckT > 2 || c.wrongT > 1.8)) this.respawn(c);
    // drift scoring
    this.driftScore(c, dt);
    // boost meter from drifting
    if (Math.abs(c.slip) > .18 && c.spd > 320 && this.state === 'race') c.meter = Math.min(1, c.meter + dt * .2 * Math.min(1.6, Math.abs(c.slip) * 2.4));
    // rpm / gears (for engine audio)
    const vn = Math.max(0, Math.abs(vf)) / st.s; const gears = [0, .28, .5, .72, .9, 1.2]; let gi = 1; while (gi < 5 && vn > gears[gi]) gi++;
    const lo = gears[gi - 1], hi = gears[gi]; const target = .25 + .75 * Math.min(1, (vn - lo) / (hi - lo)) * (gi === 1 ? 1 : .9) + (c.drift ? .12 : 0) + (inp.gas && this.state === 'count' ? .4 : 0);
    if (gi !== c.gear) { c.gear = gi; }
    c.rpm += (Math.min(1.1, target) - c.rpm) * Math.min(1, dt * 10);
  }
  driftScore(c, dt) {
    if (this.state !== 'race' || c.finished) return;
    const sliding = Math.abs(c.slip) > .18 && c.spd > 320 && !c.sand;
    if (sliding) {
      c.driftT += dt; c.graceT = .35; c.comboT += dt; c.driftPts += c.spd * Math.abs(c.slip) * dt * .38 * (c.onCurb ? 1.25 : 1);
      if (c.comboT > .95 && c.mult < 6) { c.mult++; c.comboT = 0; if (c === this.player) { Sound.play('combo', c.mult); this.events.emit('combo', c.mult); } }
    } else if (c.driftT > 0) {
      c.graceT -= dt;
      if (c.graceT <= 0) this.bankDrift(c);
    }
  }
  bankDrift(c, crashed) {
    const pts = Math.round(c.driftPts * c.mult / 10) * 10;
    if (!crashed && pts >= 50) {
      c.score += pts; if (c.driftT > .9) c.turboT = Math.min(.9, c.driftT * .22) * c.st.boostLen;
      if (c === this.player) { Sound.play('bank'); Sound.play('drift'); this.events.emit('bank', pts, c.mult); Save.data.stats.drift += pts; if (c.mult > Save.data.stats.bestCombo) Save.data.stats.bestCombo = c.mult; if (this.tut) this.tut.drifted++; }
    } else if (crashed && pts >= 50 && c === this.player) this.events.emit('bust', pts);
    c.driftT = 0; c.driftPts = 0; c.mult = 1; c.comboT = 0;
  }
  hit(c, imp, x, y, kind) {
    const now = this.t;
    if (imp > 120) { const n = Math.min(14, Math.round(imp / 60)); this.sparks.emitParticleAt(x, this.sy(y, .4), n); }
    if (now - c.lastHit < .18) return; c.lastHit = now;
    if (c === this.player || (this.player && Math.hypot(c.x - this.player.x, c.y - this.player.y) < 900)) {
      const v = Math.min(1.3, imp / 700) * (c === this.player ? 1 : .5);
      if (imp > 520) Sound.play(kind === 'car' ? 'crash' : 'tyre', v); else if (imp > 160) Sound.play(kind === 'car' ? 'bump' : 'tyre', v * .8); else if (imp > 60) Sound.play('scrape', v);
    }
    if (c === this.player && imp > 200) { this.cameras.main.shake(120 + imp / 6, Math.min(.012, imp / 90000)); c.hits++; if (c.driftT > 0 && imp > 300) this.bankDrift(c, true); }
    if (kind === 'wall' && imp > 150) this.dust.emitParticleAt(x, this.sy(y), 3);
  }
  carCollide() {
    const cs = this.cars, R = .9 * U;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j]; if (Math.abs(a.x - b.x) > 4 * U || Math.abs(a.y - b.y) > 4 * U) continue;
      for (const sa of [-.85, .85]) for (const sb of [-.85, .85]) {
        const ax = a.x + Math.cos(a.a) * sa * U, ay = a.y + Math.sin(a.a) * sa * U, bx = b.x + Math.cos(b.a) * sb * U, by = b.y + Math.sin(b.a) * sb * U;
        let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
        if (d < 2 * R && d > .01) {
          dx /= d; dy /= d; const pen = (2 * R - d) / 2; a.x -= dx * pen; a.y -= dy * pen; b.x += dx * pen; b.y += dy * pen;
          const rv = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
          if (rv < 0) { const jimp = -rv * .62; a.vx -= dx * jimp; a.vy -= dy * jimp; b.vx += dx * jimp; b.vy += dy * jimp;
            const imp = -rv; this.hit(a, imp, (ax + bx) / 2, (ay + by) / 2, 'car'); this.hit(b, imp, (ax + bx) / 2, (ay + by) / 2, 'car'); }
        }
      }
    }
  }
  crossLine(c) {
    const t = this.t;
    if (c.lap >= 1) { const lt = t - c.lapStart; c.lastLap = lt; c.lapTimes.push(lt); if (lt < c.bestLap) c.bestLap = lt;
      if (c === this.player) this.onPlayerLap(lt); }
    c.lap++; c.lapStart = t;
    if (c === this.player && c.lap === this.laps && this.laps > 1) { this.events.emit('msg', 'FINAL LAP!', 0xffd23a); Sound.play('lap'); }
    else if (c === this.player && c.lap > 1 && c.lap <= this.laps) Sound.play('lap');
    if (c.lap > this.laps && !c.finished && !this.attract) {
      c.finished = true; c.finishT = t; this.finishOrder = (this.finishOrder || 0) + 1; c.finishPos = this.finishOrder;
      if (c === this.player) this.finish();
    }
    if (c === this.player) { this.rec = []; this.recT = 0; }
  }
  onPlayerLap(lt) {
    const key = this.ghostKey, best = Save.data.best[key];
    if (this.rec.length > 10 && (!best || lt < best)) {
      Save.data.best[key] = lt; Save.data.ghosts[key] = { car: this.player.id, t: lt, p: this.rec.slice() }; Save.save();
      if (best) this.events.emit('msg', 'NEW BEST LAP!', 0x7dff8a);
    }
  }
  respawn(c) {
    const tr = this.tr, i = (c.idx + 2) % tr.n, P = tr.line[i]; c.x = P[0]; c.y = P[1]; c.a = Math.atan2(tr.ty[i], tr.tx[i]); c.vx = c.vy = 0; c.stuckT = 0; c.wrongT = 0; c.drift = false;
    if (c.driftT) this.bankDrift(c, true); c.spr.setAlpha(.3); this.tweens.add({ targets: c.spr, alpha: 1, duration: 600, repeat: 0 });
  }
  // ---------------------------------------------------------------- main loop
  update(time, delta) {
    if (this.paused) return;
    let dt = Math.min(.25, delta / 1000) * this.slowmo; this.acc += dt;
    while (this.acc >= DT) { this.acc -= DT; this.fixed(DT); }
    this.render(Math.min(.1, delta / 1000));
  }
  fixed(dt) {
    if (this.state === 'count') {
      this.countT -= dt; const n = Math.ceil(this.countT);
      if (n !== this.lastCount && n <= 3 && n >= 1 && !this.attract) { this.lastCount = n; Sound.play('beep'); this.events.emit('count', n); }
      if (this.countT <= 0) { this.state = 'race'; this.t = 0; if (!this.attract) { Sound.play('go'); this.events.emit('count', 0); CG.gameplayStart(); } this.cars.forEach(c => { c.lapStart = 0; }); }
    } else if (this.state === 'race' || this.state === 'done') this.t += dt;
    for (const c of this.cars) {
      let inp;
      if (c.ai || (c === this.player && (this.state === 'done' || this.bot))) { if (!c.ai) c.ai = { skill: +(QS.get('botskill') || .9), sloppy: QS.get('sloppy') === '1', hbT: 0, laneO: 0, wobble: 0, nz: 0, liftT: 0 }; inp = this.aiInput(c); }
      else inp = this.readPlayer();
      if (this.state === 'count') { inp = Object.assign({}, inp, { hb: false, boost: false }); }
      this.stepCar(c, inp, dt);
    }
    this.carCollide();
    // ghost recording (player, every 1/20 s of lap time)
    const P = this.player;
    if (this.state === 'race' && P && P.lap >= 1 && !P.finished) { this.recT -= dt; if (this.recT <= 0) { this.recT += .05; this.rec.push(Math.round(P.x), Math.round(P.y), Math.round(P.a * 100) / 100); } }
    if (this.tut) this.tutorialStep(dt);
  }
  tutorialStep(dt) {
    const T = this.tut, P = this.player; T.t += dt; if (this.state !== 'race') return;
    if (T.step === 0 && T.t > .3) { T.step = 1; this.events.emit('tip', isTouchDev() ? 'Hold the arrow buttons to steer — the car accelerates by itself' : 'Steer with the ARROW keys (or A / D) — the car accelerates by itself'); }
    if (T.step === 1 && P.idx > 30 && P.idx < this.tr.n / 2) { T.step = 2; this.events.emit('tip', isTouchDev() ? 'Hold DRIFT while steering into a corner to slide!' : 'Hold SPACE while steering into a corner to DRIFT!'); }
    if (T.step === 2 && T.drifted >= 1) { T.step = 3; this.events.emit('tip', isTouchDev() ? 'Drifting fills your boost — tap BOOST on a straight!' : 'Drifting fills your BOOST — press SHIFT on a straight!'); }
    if (T.step === 3 && P.boostOn) { T.step = 4; this.events.emit('tip', 'Great! Chain long drifts for big combos. Beat them all!'); this.time.delayedCall(4500, () => this.events.emit('tip', null)); }
  }
  render(dt) {
    const cam = this.cameras.main, TH = this.TH;
    // tyre marks + smoke
    this.marks.beginDraw();
    for (const c of this.cars) {
      const fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;
      const sliding = (Math.abs(c.slip) > .16 && c.spd > 220) || (c.inp.brake && c.spd > 300) || (c.inp.hb && c.spd > 200) || (c.boosting && c.spd < 500);
      const wheels = [[-1.05, -.82], [-1.05, .82]]; if (c.drift) wheels.push([1.05, -.82], [1.05, .82]);
      wheels.forEach((w, k) => {
        const wx = c.x + fx * w[0] * U + rx * w[1] * U, wy = c.y + fy * w[0] * U + ry * w[1] * U;
        const key = 'w' + k, last = c[key];
        if (sliding && last) {
          const sx0 = last[0], sy0 = this.sy(last[1]), sx1 = wx, sy1 = this.sy(wy), d = Math.hypot(sx1 - sx0, sy1 - sy0), steps = Math.min(30, Math.ceil(d / 5));
          const a = TH.markA * (k > 1 ? .5 : 1) * Math.min(1, Math.abs(c.slip) * 3 + .3);
          for (let s = 1; s <= steps; s++) { const tt = s / steps; this.marks.batchDrawFrame('fx', 'dot', (sx0 + (sx1 - sx0) * tt) / 2 - 4, (sy0 + (sy1 - sy0) * tt) / 2 - 4, a, TH.mark); }
        }
        c[key] = [wx, wy];
      });
      const fk = Math.min(2, dt * 60), near = c === this.player || Math.abs(c.x - cam.midPoint.x) < 1400;
      if (sliding && near) for (let wi = 0; wi < 2; wi++) { if (Math.random() < (c.drift ? .7 : .4) * fk * Math.min(1, c.spd / 600)) { const w = wheels[wi]; this.smoke.emitParticleAt(c.x + fx * w[0] * U + rx * w[1] * U, this.sy(c.y + fy * w[0] * U + ry * w[1] * U, .3), 1); } }
      if (c.drift && near && c.spd > 520 && TH.sparks !== false && Math.random() < .22 * fk) { const w = wheels[Math.random() < .5 ? 0 : 1]; this.sparks.emitParticleAt(c.x + fx * (w[0] - .2) * U + rx * w[1] * U, this.sy(c.y + fy * (w[0] - .2) * U + ry * w[1] * U, .15), 2); }
      if (c.sand && c.spd > 200 && Math.random() < .5) this.dust.emitParticleAt(c.x - fx * U, this.sy(c.y - fy * U), 1);
      if (c.boosting) this.flames.emitParticleAt(c.x - fx * 1.85 * U + rx * .35 * U, this.sy(c.y - fy * 1.85 * U + ry * .35 * U, .55), 2);
      // sprite
      let fr = Math.round(((c.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * 64) % 64;
      c.spr.setFrame(c.id + '_' + String(fr).padStart(2, '0')); const sy = this.sy(c.y);
      const bob = c.onCurb && c.spd > 200 ? Math.sin(this.t * 70) * 1.2 : 0;
      c.spr.setPosition(c.x, sy + bob).setDepth(sy);
      if (c.glow) c.glow.setPosition(c.x + fx * 4.2 * U, this.sy(c.y + fy * 4.2 * U)).setRotation(Math.atan2(fy * KY, fx)).setDepth(sy + 1);
    }
    this.marks.endDraw();
    // ghost playback
    if (this.ghost) {
      const G = this.ghost, P = this.player, t = P.lap >= 1 && !P.finished ? this.t - P.lapStart : -1, k = Math.floor(t / .05);
      if (t >= 0 && (k + 1) * 3 + 2 < G.d.p.length) {
        const f = t / .05 - k, p = G.d.p, x = p[k * 3] + (p[k * 3 + 3] - p[k * 3]) * f, y = p[k * 3 + 1] + (p[k * 3 + 4] - p[k * 3 + 1]) * f; let a0 = p[k * 3 + 2], a1 = p[k * 3 + 5]; while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
        const a = a0 + (a1 - a0) * f, fr = Math.round(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * 64) % 64;
        G.spr.setVisible(true).setFrame(G.d.car + '_' + String(fr).padStart(2, '0')).setPosition(x, this.sy(y)).setDepth(this.sy(y) - 1);
      } else G.spr.setVisible(false);
    }
    // camera: chase-style. North-up (the baked 3/4 art can't rotate), but the view is pushed ahead along the car's
    // travel heading so the car sits behind centre (lower-middle when driving up) and more road ahead is visible.
    // Heading is smoothed as an angle (slow turn rate) and blended toward the velocity so drifts don't whip the view.
    const P = this.attract ? this.leader() : this.player;
    const vw = cam.width / this.camZoom, vh = cam.height / this.camZoom;
    const sp = Math.hypot(P.vx, P.vy), fa = sp > 80 ? Math.atan2(P.vy, P.vx) : P.a;
    let ha = fa; { let d = P.a - fa; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; ha = fa + d * .35; }
    if (this.camA === undefined) this.camA = ha;
    { let d = ha - this.camA; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.camA += d * (1 - Math.exp(-dt * 2.6)); }
    const sf = Math.min(1, sp / 500), ux = Math.cos(this.camA), uy = Math.sin(this.camA) * KY, ul = Math.hypot(ux, uy) || 1;
    const tlx = ux / ul * vw * .40 * sf, tly = uy / ul * vh * .42 * sf; const k = 1 - Math.exp(-dt * 2.4);
    this.lookX += (tlx - this.lookX) * k; this.lookY += (tly - this.lookY) * k;
    // close chase camera (v1.4: ~2.7x); eases out subtly with speed and on boost so upcoming turns stay readable
    const z = CAM_Z0 - Math.min(.22, sp / 6000) - (P.boosting ? .07 : 0); this.camZoom += (z - this.camZoom) * (1 - Math.exp(-dt * 1.8));
    cam.setZoom(this.camZoom);
    const tx = P.x + this.lookX, ty = this.sy(P.y) + this.lookY, k2 = 1 - Math.exp(-dt * 9);
    const cx = cam.midPoint.x + (tx - cam.midPoint.x) * k2, cy = cam.midPoint.y + (ty - cam.midPoint.y) * k2; cam.centerOn(cx, cy);
    // audio
    if (!this.attract && P) {
      let riv = null, bd = 1e9; for (const c of this.cars) if (c !== P) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd) { bd = d; riv = c; } }
      const slip = (Math.abs(P.slip) > .14 && P.spd > 200) || (P.inp.brake && P.spd > 300) ? Math.min(1, Math.abs(P.slip) * 1.6 + .25) * Math.min(1, P.spd / 700) : 0;
      Sound.car(true, P.rpm, P.inp.gas ? 1 : .3, slip * (P.sand ? .3 : 1), Math.max(P.onCurb * .5, P.sand * .8) * Math.min(1, P.spd / 400), riv ? { rpm: riv.rpm, vol: Math.max(0, 1 - bd / 1200) } : null);
    }
  }
  // test hook: advance the simulation n seconds without rendering
  simulate(sec) { const n = Math.round(sec / DT); for (let k = 0; k < n; k++) { this.fixed(DT); if (this.state === 'done') break; } this.render(1 / 60); }
  leader() { let b = this.cars[0]; for (const c of this.cars) if (c.prog > b.prog) b = c; return b; }
  positions() {
    return this.cars.slice().sort((a, b) => (a.finished && b.finished) ? a.finishT - b.finishT : (a.finished ? -1 : b.finished ? 1 : b.prog - a.prog));
  }
  finish() {
    const P = this.player; this.state = 'done'; if (P.driftT) this.bankDrift(P); CG.gameplayStop();
    const pos = this.positions().indexOf(P) + 1; this.slowmo = 1;
    const ev = this.ev, type = this.type; let stars = 0;
    if (type === 'race') stars = pos === 1 ? 3 : pos === 2 ? 2 : pos === 3 ? 1 : 0;
    else if (type === 'drift') stars = P.score >= ev.goal[2] ? 3 : P.score >= ev.goal[1] ? 2 : P.score >= ev.goal[0] ? 1 : 0;
    else { const g = ev ? ev.goal : TRIAL_GOALS[this.theme]; stars = P.bestLap <= g[2] ? 3 : P.bestLap <= g[1] ? 2 : P.bestLap <= g[0] ? 1 : 0; }
    let coins = type === 'race' ? [0, 220, 140, 90, 50][pos] : type === 'drift' ? Math.round(P.score / 14) : 60 + stars * 45;
    coins += Math.round(P.score / 25) * (type === 'race' ? 1 : 0);
    const S = Save.data; S.stats.races++; if (pos === 1 && type === 'race') S.stats.wins++;
    let key = null, prevStars = 0;
    if (this.cfg.mode === 'champ' || this.tutorial) { key = evKey(this.cfg.cup, this.cfg.ev); prevStars = S.stars[key] || 0; if (stars > prevStars) S.stars[key] = stars; }
    else if (this.cfg.mode === 'trial') { key = 'tt_' + this.theme; prevStars = S.stars[key] || 0; if (stars > prevStars) S.stars[key] = stars; }
    if (this.tutorial) S.tutorial = 1;
    S.coins += coins; S.plays++; Save.save();
    if (stars === 3 || (type === 'race' && pos === 1)) { CG.happytime(); Sound.play('win'); } else if (stars === 0) Sound.play('lose'); else Sound.play('lap');
    this.results = { pos, stars, prevStars, coins, score: P.score, time: P.finishT, best: P.bestLap, type, laps: P.lapTimes.slice(), order: this.positions().map(c => ({ id: c.id, me: c === P, t: c.finished ? c.finishT : (this.t > 1 && c.prog > 0 ? this.t + Math.max(.35, (P.prog - c.prog) / Math.max(60, c.prog / this.t)) : null) })) };
    this.time.delayedCall(1100, () => { this.events.emit('results', this.results); });
  }
  togglePause(force) {
    if (this.state === 'done' || this.attract) return; const p = force !== undefined ? force : !this.paused; if (p === this.paused) return;
    this.paused = p; if (p) { CG.gameplayStop(); Sound.car(false, 0, 0, 0, 0); this.tweens.pauseAll(); } else { if (this.state === 'race') CG.gameplayStart(); this.tweens.resumeAll(); }
    this.events.emit('pause', p);
  }
  autoPause() { if (!this.paused && this.state !== 'done') this.togglePause(true); }
}
const TRIAL_GOALS = { desert: [21.5, 19.5, 18.2], snow: [21, 19, 17.8], neon: [22, 20, 18.6] };
