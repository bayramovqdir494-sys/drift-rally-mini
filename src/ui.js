// Drift Rally Mini — UI helpers (glossy code-drawn panels/buttons + Blender-rendered icons from the 'ui' atlas).
const FONT = '"Lilita One", "Trebuchet MS", sans-serif';
function txt(s, x, y, str, size, color = '#ffffff', o = {}) {
  const t = s.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color, stroke: o.stroke || '#140c06', strokeThickness: o.st != null ? o.st : Math.max(4, size / 7), align: o.align || 'center' });
  t.setOrigin(o.ox != null ? o.ox : .5, o.oy != null ? o.oy : .5); if (o.shadow !== false) t.setShadow(0, Math.max(2, size / 14), 'rgba(0,0,0,.45)', 0, true, true);
  if (o.wrap) t.setWordWrapWidth(o.wrap); return t;
}
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function shade(c, f) { const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f)), g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f)), b = Math.min(255, Math.max(0, (c & 255) * f)); return (r << 16) | (g << 8) | b; }
function panel(s, x, y, w, h, o = {}) {
  const g = s.add.graphics(); const r = o.r != null ? o.r : 22, a = o.a != null ? o.a : .78;
  g.fillStyle(0x000000, .28 * a / .78); g.fillRoundedRect(x + 4, y + 8, w, h, r);
  g.fillStyle(o.col || 0x1a1714, a); g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(0xffffff, .06); g.fillRoundedRect(x + 4, y + 4, w - 8, h * .45, { tl: r - 4, tr: r - 4, bl: 6, br: 6 });
  g.lineStyle(o.lw || 3, o.line != null ? o.line : 0xffffff, o.la != null ? o.la : .14); g.strokeRoundedRect(x, y, w, h, r);
  return g;
}
function button(s, x, y, w, h, label, col, cb, o = {}) {
  const c = s.add.container(x, y); const g = s.add.graphics(); const r = Math.min(h / 2, o.r || 26);
  const draw = (hl) => { g.clear(); g.fillStyle(0x000000, .35); g.fillRoundedRect(-w / 2 + 2, -h / 2 + 9, w, h, r);
    g.fillStyle(shade(col, .62), 1); g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
    g.fillStyle(hl ? shade(col, 1.12) : col, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h - 4, r);
    g.fillStyle(0xffffff, .22); g.fillRoundedRect(-w / 2 + 8, -h / 2 + 5, w - 16, (h - 4) * .42, { tl: r - 6, tr: r - 6, bl: 8, br: 8 });
    g.lineStyle(3, 0x000000, .35); g.strokeRoundedRect(-w / 2, -h / 2, w, h, r); };
  draw(false); c.add(g);
  let ix = 0;
  if (o.icon) { const ic = s.add.image(label ? -w / 2 + h * .55 : 0, -2, 'ui', o.icon).setDisplaySize(h * .62, h * .62); c.add(ic); ix = label ? h * .3 : 0; c.icon = ic; }
  const t = label ? txt(s, ix, -3, label, o.size || Math.round(h * .42), o.tcol || '#ffffff') : null; if (t) c.add(t); c.label = t;
  c.setSize(w, h); c.setInteractive({ useHandCursor: true }); c.enabled = true;
  c.on('pointerover', () => { if (c.enabled) draw(true); }); c.on('pointerout', () => { draw(false); s.tweens.add({ targets: c, scale: 1, duration: 90 }); });
  c.on('pointerdown', () => { if (!c.enabled) return; s.tweens.add({ targets: c, scale: .94, duration: 60 }); });
  c.on('pointerup', () => { if (!c.enabled) { Sound.play('deny'); return; } s.tweens.add({ targets: c, scale: 1, duration: 90 }); Sound.init(); Sound.play(o.sfx || 'click'); cb && cb(); });
  c.setEnabled = (e) => { c.enabled = e; c.setAlpha(e ? 1 : .55); return c; };
  c.redraw = (nc) => { col = nc; draw(false); };
  return c;
}
function iconToggle(s, x, y, icon, getOn, setOn) {
  const b = button(s, x, y, 92, 92, '', 0x3a4250, () => { setOn(!getOn()); upd(); }, { icon, r: 24 });
  const slash = s.add.graphics(); b.add(slash);
  const upd = () => { slash.clear(); if (!getOn()) { slash.lineStyle(9, 0xff3b30, 1); slash.lineBetween(-26, 26, 26, -26); } };
  upd(); return b;
}
function stars(s, x, y, n, size = 56, gap = 62, of = 3) {
  const arr = []; for (let i = 0; i < of; i++) { const im = s.add.image(x + (i - (of - 1) / 2) * gap, y, 'ui', i < n ? 'star' : 'star_off').setDisplaySize(size, size); arr.push(im); }
  return arr;
}
function coinLabel(s, x, y, size = 40) {
  const c = s.add.container(x, y); const ic = s.add.image(0, 0, 'ui', 'coin').setDisplaySize(size * 1.25, size * 1.25); const t = txt(s, size * .9, 0, '' + Save.data.coins, size, '#ffe066', { ox: 0 });
  c.add([ic, t]); c.upd = () => t.setText('' + Save.data.coins); return c;
}
function fade(s, key, data) { s.cameras.main.fadeOut(180, 0, 0, 0); s.time.delayedCall(190, () => s.scene.start(key, data)); }

function toast(s, msg) { const t = txt(s, GW / 2, GH - 120, msg, 40, '#ffffff').setDepth(1000); t.setStroke('#000000', 8); t.setAlpha(0); s.tweens.add({ targets: t, alpha: 1, y: GH - 150, duration: 200, yoyo: true, hold: 1800, onComplete: () => t.destroy() }); return t; }
