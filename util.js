// Small shared helpers
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function randn() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function fmtClock(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
export const DOWNS = ['', '1ST', '2ND', '3RD', '4TH'];
export function stars(ovr) {
  const n = ovr >= 80 ? 5 : ovr >= 70 ? 4 : ovr >= 60 ? 3 : ovr >= 50 ? 2 : 1;
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}
export function grade(v) {
  return v >= 88 ? 'A+' : v >= 82 ? 'A' : v >= 76 ? 'B' : v >= 68 ? 'C' : v >= 58 ? 'D' : 'F';
}
export const money = (m) => '$' + m.toFixed(1) + 'M';
