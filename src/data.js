// Drift Rally Mini — static game data: projection, cars, themes, championship events.
const U = 40;                                   // world px per unit (Blender unit)
const ELEV = 55 * Math.PI / 180, KY = Math.sin(ELEV), KZ = Math.cos(ELEV);
const GW = 1920, GH = 1080;
const CAR_RES = 384, CAR_K = 224 / CAR_RES;      // car sprite frame size (Blender render res); CAR_K keeps on-screen size constant
const CAM_Z0 = +(new URLSearchParams(location.search).get('camz') || 2.2);  // chase camera base zoom
// cars: s = top speed px/s, a = acceleration, g = grip, t = turn rate, d = drift control, frames rendered with ortho o (Blender units over 256 px)
const CARS = {
  mini:   { name: 'Rally Mini',   num: '01', col: 0xd8241c, o: 6.5, s: 1080, a: 900, g: 9.0, t: 3.1, d: 1.0, price: 0 },
  bug:    { name: 'Sunny Bug',    num: '09', col: 0xff7a1a, o: 6.5, s: 1110, a: 950, g: 9.4, t: 3.2, d: 1.05, price: 900 },
  blue:   { name: 'Blue Bolt',    num: '02', col: 0x1d55d6, o: 6.5, s: 1140, a: 980, g: 9.6, t: 3.2, d: 1.05, price: 1600 },
  yellow: { name: 'Yellow Jacket',num: '03', col: 0xf2b90f, o: 6.5, s: 1160, a: 1040, g: 9.2, t: 3.35, d: 1.15, price: 2400 },
  truck:  { name: 'Dune Pickup',  num: '12', col: 0x2ab7c9, o: 6.9, s: 1180, a: 1000, g: 10.4, t: 3.0, d: .95, price: 3400 },
  muscle: { name: 'Green Muscle', num: '07', col: 0x14a05a, o: 6.9, s: 1250, a: 1120, g: 9.0, t: 3.1, d: 1.2, price: 4800 },
  gt:     { name: 'Violet GT',    num: '88', col: 0x7a2fd6, o: 6.9, s: 1320, a: 1220, g: 10.2, t: 3.4, d: 1.15, price: 7000 },
  police: { name: 'Patrol 00',    num: '00', col: 0xf4f4f4, o: 6.5, s: 1300, a: 1260, g: 10.6, t: 3.5, d: 1.25, price: 9500 },
  wagon:  { name: 'Rally Wagon',  num: '21', col: 0x2fbf3a, o: 6.9, s: 1200, a: 1060, g: 9.8, t: 3.25, d: 1.1, price: 4000 },
  buggy:  { name: 'Dune Buggy',   num: '44', col: 0xe0287a, o: 6.5, s: 1190, a: 1180, g: 10.0, t: 3.45, d: 1.2, price: 5800 },
  jeep:   { name: 'Trail Boss 4x4', num: '66', col: 0x8a9a40, o: 6.9, s: 1230, a: 1080, g: 11.0, t: 3.1, d: .95, price: 6400 },
  super:  { name: 'Black Venom',  num: '99', col: 0x50505c, o: 6.9, s: 1400, a: 1320, g: 10.8, t: 3.55, d: 1.25, price: 12500 },
};
const CAR_ORDER = ['mini', 'bug', 'blue', 'yellow', 'truck', 'wagon', 'muscle', 'buggy', 'jeep', 'gt', 'police', 'super'];
const UPGRADES = [ // per car, 3 levels each
  { k: 'eng', name: 'Engine', desc: 'Top speed + acceleration', cost: [300, 700, 1400] },
  { k: 'tyre', name: 'Tyres', desc: 'Grip + steering', cost: [250, 600, 1200] },
  { k: 'turbo', name: 'Turbo', desc: 'Stronger, longer boost', cost: [300, 700, 1400] },
];
const THEMES = {
  desert: { name: 'Desert Canyon', mark: 0x2a160a, markA: .34, dust: 0xd99a62, smoke: 0xfff6ea, tint: 0xffffff, night: false, music: 0 },
  snow:   { name: 'Snowy Pines',   mark: 0x51607a, markA: .30, dust: 0xffffff, smoke: 0xffffff, tint: 0xf4f8ff, night: false, music: 1 },
  neon:   { name: 'Neon City',     mark: 0x050508, markA: .45, dust: 0x9aa0c0, smoke: 0xd8dcff, tint: 0xb8c0ff, night: true, music: 2 },
};
// championship: 3 cups x 4 events. type race | drift | trial. rev = reversed direction.
const CUPS = [
  { name: 'Canyon Cup', theme: 'desert', need: 0, events: [
    { type: 'race', laps: 3, ai: .69, name: 'Sunrise Sprint' }, { type: 'drift', laps: 2, goal: [3000, 6500, 10000], name: 'Dust Devil Drift' },
    { type: 'race', laps: 3, ai: .71, rev: 1, name: 'Mesa Reverse' }, { type: 'trial', laps: 3, goal: [21.5, 19.5, 18.2], name: 'Canyon Time Attack' } ] },
  { name: 'Frost Cup', theme: 'snow', need: 7, events: [
    { type: 'race', laps: 3, ai: .795, name: 'Pine Rally' }, { type: 'drift', laps: 2, goal: [3500, 7000, 11000], name: 'Ice Slide Show' },
    { type: 'race', laps: 3, ai: .825, rev: 1, name: 'Backwoods Reverse' }, { type: 'trial', laps: 3, goal: [21, 19, 17.8], name: 'Frost Time Attack' } ] },
  { name: 'Neon Cup', theme: 'neon', need: 16, events: [
    { type: 'race', laps: 3, ai: .835, name: 'Midnight Run' }, { type: 'drift', laps: 2, goal: [4000, 8000, 12000], name: 'Neon Drift King' },
    { type: 'race', laps: 3, ai: .855, rev: 1, name: 'Downtown Reverse' }, { type: 'race', laps: 4, ai: .885, name: 'Grand Final' } ] },
];
function evKey(ci, ei) { return ci + '_' + ei; }
function totalStars() { return Object.values(Save.data.stars).reduce((a, b) => a + b, 0); }
function carStats(id) {
  const c = CARS[id], u = Save.data.up[id] || {}, e = u.eng || 0, t = u.tyre || 0, b = u.turbo || 0;
  return { s: c.s * (1 + .045 * e), a: c.a * (1 + .07 * e), g: c.g * (1 + .05 * t), t: c.t * (1 + .035 * t), d: c.d, boost: 1 + .12 * b, boostLen: 1 + .2 * b };
}
function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || 'th'); }
function fmtTime(t) { if (!isFinite(t)) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); }
