// Drift Rally Mini — bootstrap.
(async function () {
  await CG.init(); Save.load();
  const cfg = { type: Phaser.AUTO, parent: 'game', backgroundColor: '#1a120a', width: GW, height: GH,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    fps: { target: 60, forceSetTimeOut: false }, input: { activePointers: 5 }, scene: [Boot, Race, HUD, Title, Cups, Trial, Garage] };
  const g = window.__game = new Phaser.Game(cfg);
  const unlock = () => { Sound.init(); }; ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, unlock, { once: false, passive: true }));
})();
