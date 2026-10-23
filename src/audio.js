// Drift Rally Mini — audio. Music: procedural WebAudio (driving groove per theme). SFX: recorded CC0 samples
// (engine loop + tyre squeal from OpenGameArt, impacts/UI from Kenney), engine pitch follows a simulated RPM/gearbox.
const SFX_FILES = ['crash0', 'crash1', 'crash2', 'bump0', 'bump1', 'tyre0', 'tyre1', 'scrape0', 'coin0', 'whoosh0', 'whoosh1', 'click0', 'click1', 'confirm0', 'back0', 'deny0', 'tick0', 'drift0', 'unlock0', 'start'];
const SFX_MAP = { crash: ['crash', .9], bump: ['bump', .8], tyre: ['tyre', .8], scrape: ['scrape', .35], coin: ['coin', .5], whoosh: ['whoosh', .7], click: ['click0', .6], select: ['click1', .5], confirm: ['confirm', .6], back: ['back', .55], deny: ['deny', .6], tick: ['tick', .5], drift: ['drift', .55], unlock: ['unlock', .6], start: ['start', .55] };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const Sound = {
  ctx: null, sdkPaused: false, step: 0, nextT: 0, track: 'menu', theme: 0, buf: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.sdkPaused && !document.hidden) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    let c; try { c = this.ctx = new AC(); } catch (e) { return; }
    this.master = c.createGain(); this.master.connect(c.destination);
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -10; this.comp.ratio.value = 4; this.comp.connect(this.master);
    this.music = c.createGain(); this.sfxG = c.createGain(); this.music.connect(this.comp); this.sfxG.connect(this.comp);
    this.rev = c.createConvolver(); this.rev.buffer = this.impulse(1.6); const ro = c.createGain(); ro.gain.value = .22; this.rev.connect(ro); ro.connect(this.comp);
    const len = c.sampleRate; this.noiseBuf = c.createBuffer(1, len, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const load = (n, ext) => fetch('assets/sfx/' + n + ext).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(a => new Promise((res, rej) => c.decodeAudioData(a, res, rej))).then(b => { this.buf[n] = b; if (n === 'engine' || n === 'skid') this.loops(); }).catch(() => {});
    SFX_FILES.forEach(n => load(n, '.mp3')); load('engine', '.wav'); load('skid', '.wav');
    this.apply(); this.nextT = c.currentTime + .1; this.timer = setInterval(() => this.schedule(), 40);
    if (this.sdkPaused || document.hidden) c.suspend();
  },
  loops() {
    const c = this.ctx;
    if (this.buf.engine && !this.eng) {
      const mk = (rate0, g0) => { const s = c.createBufferSource(); s.buffer = this.buf.engine; s.loop = true; s.playbackRate.value = rate0; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(); return { s, f, g, g0 }; };
      this.eng = mk(1, .5); this.eng2 = mk(1, .16);   // player + nearest rival
    }
    if (this.buf.skid && !this.skid) { const s = c.createBufferSource(); s.buffer = this.buf.skid; s.loop = true; const g = c.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.sfxG); s.start(); this.skid = { s, g }; }
    if (!this.rumble) { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(); this.rumble = { s, f, g }; }
  },
  // per frame from the race: rpm 0..1, load 0..1, slip 0..1, off 0..1 (offroad/curb rumble), rival {rpm, vol}
  car(on, rpm, load, slip, off, rival) {
    if (!this.ctx || !this.eng) return; const t = this.ctx.currentTime;
    const E = this.eng; E.s.playbackRate.setTargetAtTime(.55 + rpm * 1.25, t, .04); E.f.frequency.setTargetAtTime(900 + load * 2600 + rpm * 1200, t, .05); E.g.gain.setTargetAtTime(on ? E.g0 * (.55 + .45 * load) : 0, t, .08);
    if (this.eng2) { const R = this.eng2; R.s.playbackRate.setTargetAtTime(.6 + (rival ? rival.rpm : 0) * 1.2, t, .05); R.g.gain.setTargetAtTime(on && rival ? R.g0 * rival.vol : 0, t, .1); }
    if (this.skid) { this.skid.g.gain.setTargetAtTime(on ? Math.min(.55, slip * .6) : 0, t, .05); this.skid.s.playbackRate.setTargetAtTime(.9 + slip * .2, t, .1); }
    if (this.rumble) this.rumble.g.gain.setTargetAtTime(on ? off * .5 : 0, t, .05);
  },
  apply() {
    if (!this.ctx) return; const s = Save.data, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(CG.muted || this.sdkPaused ? 0 : 1, t, .03);
    this.music.gain.setTargetAtTime(s.music * .34, t, .08); this.sfxG.gain.setTargetAtTime(s.sfx * .9, t, .05);
  },
  impulse(sec) { const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); } return b; },
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); },
  osc(type, f, t, dur, peak, dest, rev = .1, a = .004) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    this.env(g, t, a, peak, dur); o.connect(g); g.connect(dest); if (rev) { const s = c.createGain(); s.gain.value = rev; g.connect(s); s.connect(this.rev); }
    o.start(t); o.stop(t + a + dur + .05); return o;
  },
  noise(t, dur, peak, type, freq, q, dest, rev = .03) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    const g = c.createGain(); this.env(g, t, .003, peak, dur); s.connect(f); f.connect(g); g.connect(dest); if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(this.rev); }
    s.start(t, Math.random() * .5); s.stop(t + dur + .05); return f;
  },
  synth(f, t, dur, peak, dest, cut = 2400, type = 'sawtooth', rev = .15) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = o2.type = type; o.frequency.value = f; o2.frequency.value = f * 1.006;
    fl.type = 'lowpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, cut * .25), t + dur);
    this.env(g, t, .005, peak, dur); o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(dest); if (rev) { const s = c.createGain(); s.gain.value = rev; g.connect(s); s.connect(this.rev); }
    o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
  },
  setTrack(name, theme) { if (this.track === name && this.theme === (theme || 0)) return; this.track = name; this.theme = theme || 0; this.step = 0; },
  schedule() {
    if (!this.ctx || this.sdkPaused || this.ctx.state !== 'running') { if (this.ctx) this.nextT = Math.max(this.nextT, this.ctx.currentTime + .05); return; }
    const bpm = this.track === 'menu' ? 104 : [128, 122, 132][this.theme], spb = 60 / bpm / 4;
    while (this.nextT < this.ctx.currentTime + .15) { if (this.track !== 'off') this.playStep(this.step, this.nextT); this.step++; this.nextT += spb; }
  },
  // Upbeat arcade-racing groove: four-on-the-floor kick, clap, offbeat hats, octave bass, arpeggio + hook lead. Key per theme.
  playStep(st, t) {
    const M = this.music, s16 = st % 16, bar = Math.floor(st / 16) % 8, race = this.track === 'race', th = this.theme;
    const root = [45, 50, 43][th] + (this.track === 'menu' ? 2 : 0);
    const prog = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2], [0, 3, 7], [-4, 0, 3], [5, 8, 12], [7, 10, 14]];
    const ch = prog[bar].map(n => n + root);
    if (s16 % 4 === 0) { const o = this.osc('sine', 120, t, .22, race ? .8 : .45, M, 0, .002); o.frequency.exponentialRampToValueAtTime(42, t + .18); }
    if (race && (s16 === 4 || s16 === 12)) { this.noise(t, .16, .22, 'bandpass', 1500, .9, M, .2); this.noise(t + .012, .1, .12, 'highpass', 3000, 1, M, .1); }
    if (s16 % 4 === 2) this.noise(t, .05, race ? .09 : .05, 'highpass', 7000, 1, M, 0);
    if (race && s16 % 2 === 1) this.noise(t, .02, .025, 'highpass', 9000, 1, M, 0);
    // bass: octave pumping eighths
    if (s16 % 2 === 0) this.synth(mtof(ch[0] - 12 + (s16 % 4 === 2 ? 12 : 0)), t, .16, race ? .16 : .1, M, 900, 'sawtooth', 0);
    // arp
    const arp = [0, 1, 2, 1, 2, 0, 2, 1];
    if (s16 % 2 === 1 || !race) { if (s16 % 2 === 1) this.synth(mtof(ch[arp[(s16 >> 1) % 8]] + 12), t, .12, .045, M, 3200, 'square', .25); }
    if (s16 === 0) this.synth(mtof(ch[1] + 12), t, 1.6, .03, M, 1600, 'sawtooth', .5);
    if (race) {
      const hook = [[12, 0, 15, 14, 12, 0, 10, 7], [8, 0, 12, 10, 8, 7, 0, 3], [10, 0, 14, 12, 10, 0, 7, 5], [7, 8, 10, 0, 14, 0, 12, 10]][bar % 4];
      if (s16 % 2 === 0 && bar >= 4) { const n = hook[s16 >> 1]; if (n) this.synth(mtof(root + 12 + n), t, .2, .05, M, 4200, 'square', .35); }
    }
  },
  sample(name, gain, rate) {
    const vs = Object.keys(this.buf).filter(k => k === name || k.replace(/\d+$/, '') === name); if (!vs.length) return false;
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain(); src.buffer = this.buf[vs[Math.floor(Math.random() * vs.length)]];
    src.playbackRate.value = (rate || 1) * (.94 + Math.random() * .12); g.gain.value = gain; src.connect(g); g.connect(this.sfxG); src.start(); return true;
  },
  play(name, v = 1) {
    if (!this.ctx || this.sdkPaused || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + .005, S = this.sfxG; const m = SFX_MAP[name];
    if (m) this.sample(m[0], m[1] * Math.min(1.5, v));
    switch (name) {
      case 'beep': this.osc('square', 660, t, .18, .12, S, .1); break;
      case 'go': this.osc('square', 1320, t, .45, .14, S, .2); this.osc('square', 990, t, .45, .08, S, .2); break;
      case 'boost': { const f = this.noise(t, .7, .28, 'bandpass', 500, 1.5, S, .1); f.frequency.exponentialRampToValueAtTime(3200, t + .5); const o = this.osc('sawtooth', 90, t, .6, .12, S, .1); o.frequency.exponentialRampToValueAtTime(240, t + .5); break; }
      case 'combo': [0, 4, 7].forEach((n, i) => this.osc('triangle', mtof(76 + n + Math.min(12, v * 2)), t + i * .045, .2, .09, S, .3)); break;
      case 'bank': [0, 4, 7, 12].forEach((n, i) => this.osc('sine', mtof(72 + n), t + i * .05, .25, .1, S, .4)); break;
      case 'lap': [0, 7, 12].forEach((n, i) => this.osc('triangle', mtof(79 + n), t + i * .08, .3, .12, S, .4)); break;
      case 'win': [0, 4, 7, 12, 16].forEach((n, i) => this.osc('triangle', mtof(72 + n), t + i * .1, .5, .12, S, .5)); break;
      case 'lose': [7, 3, 0].forEach((n, i) => this.osc('triangle', mtof(64 + n), t + i * .15, .4, .1, S, .4)); break;
      case 'star': this.osc('sine', mtof(84 + v * 3), t, .4, .13, S, .5); this.osc('triangle', mtof(91 + v * 3), t + .04, .3, .05, S, .5); break;
    }
  }
};
