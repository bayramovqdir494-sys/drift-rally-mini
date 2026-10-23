// Drift Rally Mini — platform layer: save data (CrazyGames data module, mirrored to localStorage) and a CrazyGames SDK v3 wrapper.
const SAVE_KEY = 'driftrally_save_v1';
const QS = new URLSearchParams(location.search);
function isTouchDev() { return QS.get('touch') === '1' || ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
const Save = {
  data: null,
  defaults() {
    return { coins: 0, stars: {}, best: {}, ghosts: {}, music: 0.6, sfx: 0.9, autogas: 1, fx: 1, tutorial: 0, car: 'mini', cars: ['mini'], up: {},
      stats: { races: 0, wins: 0, drift: 0, bestCombo: 0 }, plays: 0, lastAd: 0 };
  },
  store() { return (CG.ready && CG.sdk.data) ? CG.sdk.data : window.localStorage; },
  load() {
    let d = null; try { d = JSON.parse(this.store().getItem(SAVE_KEY)); } catch (e) { d = null; }
    if (!d) { try { d = JSON.parse(window.localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; } }
    const def = this.defaults(); this.data = Object.assign(def, d || {});
    ['stars', 'best', 'ghosts', 'up', 'stats'].forEach(k => { this.data[k] = Object.assign(def[k], (d && d[k]) || {}); });
    if (QS.get('fresh') === '1') this.data = this.defaults();
    if (QS.get('rich') === '1') { this.data.coins = 99999; this.data.tutorial = 1; }
    if (QS.get('done') === '1') this.data.tutorial = 1;
    if (QS.get('demo') === '1') { Object.assign(this.data, { tutorial: 1, coins: 1240 }); Object.assign(this.data.stars, { '0_0': 3, '0_1': 3, '0_2': 2, '0_3': 3, '1_0': 2, '1_1': 1, tt_desert: 2, tt_snow: 1 }); this.data.best.desert = 18.94; this.data.best.snow = 20.41; }   // marketing screenshots only
    return this.data;
  },
  save() { const s = JSON.stringify(this.data); try { this.store().setItem(SAVE_KEY, s); } catch (e) {} try { if (this.store() !== window.localStorage) window.localStorage.setItem(SAVE_KEY, s); } catch (e) {} }
};
const CG = {
  sdk: null, ready: false, env: 'none', playing: false, adActive: false, muted: false, adBusy: false,
  async init() {
    try {
      const S = window.CrazyGames && window.CrazyGames.SDK; if (!S) return;
      await Promise.race([S.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('sdk timeout')), 4000))]);
      this.env = S.environment; if (this.env === 'disabled') return;
      this.sdk = S; this.ready = true;
      try { this.muted = !!(S.game.settings && S.game.settings.muteAudio); S.game.addSettingsChangeListener(st => { this.muted = !!st.muteAudio; Sound.apply(); }); } catch (e) {}
    } catch (e) { this.sdk = null; this.ready = false; }
  },
  call(fn) { if (!this.ready) return; try { fn(this.sdk); } catch (e) {} },
  loadingStart() { this.call(s => s.game.loadingStart()); },
  loadingStop() { this.call(s => s.game.loadingStop()); },
  gameplayStart() { if (this.playing || this.adActive) return; this.playing = true; this.call(s => s.game.gameplayStart()); },
  gameplayStop() { if (!this.playing) return; this.playing = false; this.call(s => s.game.gameplayStop()); },
  happytime() { this.call(s => s.game.happytime()); },
  // type 'midgame' | 'rewarded'. done(ok) runs exactly once. Rewarded: ok only on adFinished (never on adError).
  // Without any SDK (self-hosted build) rewarded buttons grant the reward so they're never dead.
  ad(type, done) {
    if (this.adBusy) return; let fin = false, wasPlaying = false; this.adBusy = true;
    const resume = () => { if (!this.adActive) return; this.adActive = false; window.gameResume(); if (wasPlaying) this.gameplayStart(); };
    const end = ok => { resume(); if (fin) return; fin = true; this.adBusy = false; done(ok); };
    if (!this.ready) return end(type === 'rewarded');
    try {
      this.sdk.ad.requestAd(type, {
        adStarted: () => { if (this.adActive) return; wasPlaying = this.playing; this.gameplayStop(); this.adActive = true; window.gamePause(); },
        adFinished: () => end(true), adError: () => end(false)
      });
    } catch (e) { end(false); }
  }
};
window.gamePause = function () {
  Sound.sdkPaused = true; if (Sound.ctx) { try { Sound.master.gain.value = 0; Sound.ctx.suspend(); } catch (e) {} }
  if (window.__game) window.__game.loop.sleep();
};
window.gameResume = function () {
  Sound.sdkPaused = false; if (Sound.ctx) { try { Sound.ctx.resume(); Sound.apply(); } catch (e) {} }
  if (window.__game) window.__game.loop.wake();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && window.__race && window.__race.autoPause) window.__race.autoPause();
  if (!Sound.ctx) return;
  try { if (document.hidden) { Sound.master.gain.value = 0; Sound.ctx.suspend(); } else if (!Sound.sdkPaused) { Sound.ctx.resume(); Sound.apply(); } } catch (e) {}
});
// pause key handled at the DOM level (not through Phaser's per-frame key queue, which could drop a press while paused / on slow frames)
window.addEventListener('keydown', e => {
  if (e.repeat || (e.code !== 'KeyP' && e.key !== 'p' && e.key !== 'P' && e.key !== 'Escape')) return;
  const R = window.__race; if (!R || !R.scene || !R.scene.isActive() || CG.adActive || !R.togglePause) return;
  if (e.key === 'Escape' && R.paused) return;
  R.togglePause(e.key === 'Escape' ? true : undefined);
});
// iOS: resume a suspended/interrupted AudioContext on the next user gesture.
['touchend', 'pointerup', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (Sound.ctx && Sound.ctx.state !== 'running' && !Sound.sdkPaused && !document.hidden) { try { Sound.ctx.resume(); } catch (e) {} } }, true));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
