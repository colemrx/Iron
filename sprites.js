// Procedural pixel art: bitmap font, player sprites, field, goal posts.
// Everything is generated at runtime, so there are no image assets to download.

// ---------- 3x5 bitmap font ----------
const G = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',
  F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',
  K:'101101110101101',L:'100100100100111',M:'101111101101101',N:'101111111111101',O:'010101101101010',
  P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',
  U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',
  Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
  '4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111',
  '9':'111101111001110',' ':'000000000000000','-':'000000111000000',':':'000010000010000','.':'000000000000010',
  '!':'010010010000010','&':'010101010101011','/':'001001010100100','+':'000010111010000','?':'110001010000010',
  "'":'010010000000000','#':'101111101111101',',':'000000000010100','(':'010100100100010',')':'010001001001010',
  '%':'101001010100101','·':'000000010000000','=':'000111000111000','>':'100010001010100','<':'001010100010001','@':'010101111100011',
};
export function textWidth(str, s = 1) { return str.length * 4 * s - s; }
export function drawText(ctx, str, x, y, s = 1, color = '#fff', shadow = '#000') {
  str = String(str).toUpperCase();
  if (shadow) drawRaw(ctx, str, x + s, y + s, s, shadow);
  drawRaw(ctx, str, x, y, s, color);
}
function drawRaw(ctx, str, x, y, s, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < str.length; i++) {
    const g = G[str[i]] || G['?'];
    const ox = x + i * 4 * s;
    for (let b = 0; b < 15; b++) if (g.charCodeAt(b) === 49) ctx.fillRect(ox + (b % 3) * s, y + ((b / 3) | 0) * s, s, s);
  }
}
export function drawTextC(ctx, str, cx, y, s, color, shadow) {
  drawText(ctx, str, Math.round(cx - textWidth(String(str), s) / 2), y, s, color, shadow);
}

// ---------- colors ----------
function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
export function colorDist(a, b) { const x = hex(a), y = hex(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
export function shade(c, f) {
  const [r, g, b] = hex(c);
  const m = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return '#' + [m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function clash(c1, c2) { return colorDist(c1.p, c2.p) < 120; }
export function teamKit(c, away) {
  if (away) return { id: c.p + 'w', H: c.p, J: '#f4f4f4', N: c.p, P: '#dcdcdc', K: c.p };
  return { id: c.p + c.s, H: c.p, J: c.p, N: c.s, P: c.s, K: c.p };
}
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'];

// ---------- player sprites (9x13, facing right) ----------
const TOP = [
  '...HHH...',
  '..HHHHH..',
  '..HHHSM..',
  '..HHSSM..',
  '...SSS...',
  '.JJJJJJJ.',
];
const FR = {
  stand: [...TOP, 'SJJNNJJJS', 'SJJJJJJJS', '..JJJJJ..', '..PPPPP..', '..PP.PP..', '..KK.KK..', '..BB.BB..'],
  run1:  [...TOP, '.JJNNJJJS', 'SJJJJJJS.', '..JJJJJ..', '..PPPPP..', '.PP...PP.', '.KK....KK', 'BB.....BB'],
  run2:  [...TOP, 'SJJNNJJJ.', '.SJJJJJJS', '..JJJJJ..', '..PPPPP..', '...PPP...', '...KKK...', '...BBB...'],
  down:  ['.............', '.............', '.............', '..........HH.', 'BKPPJJJJJJHHM', 'BKPPJJNJJSHHM', '.....SS......'],
};
const cache = new Map();
function buildSprite(kit, skin, frame, flip) {
  const rows = FR[frame];
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w + 2; c.height = h + 2;
  const x = c.getContext('2d');
  const col = { H: kit.H, J: kit.J, N: kit.N, P: kit.P, K: kit.K, S: SKIN[skin % SKIN.length], M: '#c9c9c9', B: '#151515' };
  const on = (i, j) => j >= 0 && j < h && i >= 0 && i < w && rows[j][flip ? w - 1 - i : i] !== '.';
  // outline
  x.fillStyle = 'rgba(8,10,16,0.85)';
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
    if (on(i, j)) continue;
    if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) x.fillRect(i + 1, j + 1, 1, 1);
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][flip ? w - 1 - i : i];
    if (ch === '.') continue;
    x.fillStyle = col[ch]; x.fillRect(i + 1, j + 1, 1, 1);
  }
  // helmet highlight
  x.fillStyle = 'rgba(255,255,255,0.35)';
  if (frame !== 'down') x.fillRect(flip ? 6 : 4, 1, 2, 1);
  return c;
}
export function drawPlayer(ctx, kit, skin, frame, face, sx, sy) {
  const key = kit.id + kit.J + '|' + skin + frame + (face < 0 ? 'L' : 'R');
  let spr = cache.get(key);
  if (!spr) { spr = buildSprite(kit, skin, frame, face < 0); cache.set(key, spr); }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(sx - 4, sy - 1, 9, 2);
  if (frame === 'down') ctx.drawImage(spr, sx - 7, sy - 7);
  else ctx.drawImage(spr, sx - 5, sy - 14);
}

export function drawBall(ctx, sx, sy) {
  ctx.fillStyle = '#10141c'; ctx.fillRect(sx - 2, sy - 2, 5, 4);
  ctx.fillStyle = '#8a5221'; ctx.fillRect(sx - 1, sy - 1, 3, 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy - 1, 1, 1);
}

// ---------- field ----------
export const SX = 10, SY = 4.2, FW = 53.333;
const fieldCache = new Map();
export function getFieldCanvas(left, right) {
  const key = left.abbr + right.abbr;
  if (fieldCache.has(key)) return fieldCache.get(key);
  const W = 120 * SX, H = Math.round(FW * SY);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  for (let yd = 10; yd < 110; yd += 5) {
    x.fillStyle = (yd / 5) % 2 ? '#3f8f3a' : '#3a8636';
    x.fillRect(yd * SX, 0, 5 * SX, H);
  }
  // subtle mow texture
  x.fillStyle = 'rgba(0,0,0,0.05)';
  for (let j = 0; j < H; j += 4) x.fillRect(10 * SX, j, 100 * SX, 1);
  // end zones
  const ez = (from, team) => {
    x.fillStyle = shade(team.colors.p, -0.25); x.fillRect(from * SX, 0, 10 * SX, H);
    x.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 10 * SX; i += 6) x.fillRect(from * SX + i, 0, 3, H);
    // vertical team letters
    const letters = team.abbr.split('');
    const s = 4, total = letters.length * 6 * s;
    letters.forEach((ch, i) => drawText(x, ch, from * SX + 50 - 6, Math.round(H / 2 - total / 2 + i * 6 * s), s, team.colors.s, 'rgba(0,0,0,0.35)'));
  };
  ez(0, left); ez(110, right);
  // lines
  x.fillStyle = 'rgba(255,255,255,0.85)';
  for (let yd = 10; yd <= 110; yd += 5) x.fillRect(yd * SX, 0, yd === 10 || yd === 110 ? 2 : 1, H);
  x.fillStyle = 'rgba(255,255,255,0.6)';
  for (let yd = 11; yd < 110; yd++) {
    if (yd % 5 === 0) continue;
    for (const hy of [0.6, 23.58, 29.75, FW - 1.2]) x.fillRect(yd * SX, Math.round(hy * SY), 1, 3);
  }
  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, 2); x.fillRect(0, H - 2, W, 2); x.fillRect(0, 0, 2, H); x.fillRect(W - 2, 0, 2, H);
  // numbers
  for (let yd = 20; yd <= 100; yd += 10) {
    const n = String(yd <= 60 ? yd - 10 : 110 - yd);
    for (const ny of [9, FW - 13]) drawText(x, n, yd * SX - textWidth(n, 2) / 2, Math.round(ny * SY), 2, 'rgba(255,255,255,0.8)', null);
  }
  fieldCache.set(key, c);
  return c;
}

export function drawGoalPost(ctx, sx, groundY, halfW) {
  ctx.fillStyle = '#10141c';
  ctx.fillRect(sx - 1, groundY - 12, 3, 12);
  ctx.fillStyle = '#f2d230';
  ctx.fillRect(sx, groundY - 12, 1, 12);
  ctx.fillRect(sx, groundY - 12 - halfW, 2, halfW * 2);
  ctx.fillRect(sx, groundY - 12 - halfW - 22, 2, 22);
  ctx.fillRect(sx, groundY - 12 + halfW - 22, 2, 22);
}
