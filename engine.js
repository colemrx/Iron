// Pocket Gridiron — on-field football engine.
// You play offense; the defense and opponent possessions are AI-driven.
import { clamp, rand, randi, pick, shuffle, fmtClock, DOWNS, esc } from './util.js';
import { PLAYS, ROUTES } from './data.js';
import { SX, SY, FW, drawText, drawTextC, textWidth, drawPlayer, drawBall, drawGoalPost, getFieldCanvas, teamKit, clash } from './sprites.js';
import { sfx } from './audio.js';
import { simDrive } from './sim.js';

const TOP = 28;              // logical y where the field starts
const H = 270;               // logical screen height
const MID = FW / 2;
const HASH_L = 23.58, HASH_R = 29.75;
const ZPX = 4;               // pixels per yard of ball height

const speedOf = (a) => 5.4 + a.spd * 0.036;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function mk(p, side, role, bonus = 0) {
  const a = p.attrs;
  return {
    p, a, side, role, x: 0, y: 0, hx: 0, hy: 0, vx: 0, vy: 0,
    sp: speedOf(a) + bonus * 0.15, cov: a.cov + bonus * 6, tkl: a.tkl + bonus * 6,
    task: null, route: null, ri: 0, dirx: 1, diry: 0, end: 'stop', after: null, pend: null,
    eng: null, engT: 0, stun: 0, immune: 0, cd: 0, react: 0, hawk: 0, man: null, px: 0, py: 0,
    juke: 0, jdir: 0, dive: 0, spin: 0, cur: 0, autoT: 0, autoVy: 0,
    anim: Math.random() * 4, face: side === 'off' ? 1 : -1, down: false, skin: p.skin || 0,
  };
}

function steer(e, tx, ty, sp, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (d < 0.05 || sp <= 0) { e.vx = 0; e.vy = 0; return d < 0.3; }
  const s = Math.min(sp, d / dt);
  e.vx = (dx / d) * s; e.vy = (dy / d) * s;
  e.x += e.vx * dt; e.y += e.vy * dt;
  return d <= sp * dt + 0.25;
}

const chipStyle = (t) => `background:${t.colors.p};color:${t.colors.s}`;
const short = (p) => `${p.first[0]}. ${p.last}`;

// Small route diagram for the play-call cards
export function playSvg(p) {
  const sx = (dx) => (12 + dx * 1.6).toFixed(1), sy = (y) => (2 + y * 0.6).toFixed(1);
  const by = MID;
  const spots = { WR1: [-0.6, by - 17], WR2: [-0.6, by + 17], WR3: [-1.2, by - 8.5], TE: [-1, by + 4.4], RB: [-5, by + 2.2] };
  const poly = (pts, cls) => {
    const last = pts[pts.length - 1];
    return `<polyline points="${pts.map(([x, y]) => sx(x) + ',' + sy(y)).join(' ')}" class="${cls}"/><rect x="${sx(last[0]) - 1}" y="${sy(last[1]) - 1}" width="2.4" height="2.4" class="${cls}e"/>`;
  };
  let s = `<svg viewBox="0 0 64 36" class="pd" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="35" class="los"/>`;
  for (let i = -2; i <= 2; i++) s += `<rect x="${(+sx(-0.6) - 1.2).toFixed(1)}" y="${(+sy(by + i * 1.6) - 1).toFixed(1)}" width="2" height="2" class="ol"/>`;
  if (p.type === 'run') {
    const w = p.dir === 'wide' ? 16 : 11;
    const pts = p.dir === 'mid' ? [[-5, by + 2.2], [-1.5, by + 1], [18, by + 1]] : [[-5, by + 2.2], [-2.5, by + w * 0.6], [16, by + w]];
    s += poly(pts, 'run');
  } else {
    for (const k in spots) {
      const r = p.routes[k];
      const [x0, y0] = spots[k];
      if (!r || r === 'block') { s += `<rect x="${(+sx(x0) - 1).toFixed(1)}" y="${(+sy(y0) - 1).toFixed(1)}" width="2" height="2" class="ol"/>`; continue; }
      const R = ROUTES[r];
      const side = Math.sign(y0 - by) || 1;
      const pts = [[x0, y0], ...R.pts.map(([dx, dy]) => [Math.min(x0 + dx, 30), clamp(y0 + dy * side, 1, FW - 1)])];
      s += poly(pts, k === 'RB' || k === 'TE' ? 'rt2' : 'rt');
    }
  }
  return s + '</svg>';
}

export class Match {
  constructor(o) {
    this.user = o.user; this.opp = o.opp; this.settings = o.settings;
    this.playoff = !!o.playoff; this.onEnd = o.onEnd; this.layer = o.layer;
    this.allowQuit = !!o.allowQuit; this.label = o.label || ''; this.saveSettings = o.saveSettings || (() => {});
    this.Q = (o.settings.quarterMin || 3) * 60;
    this.diff = { easy: -1, normal: 0, hard: 1 }[o.settings.difficulty] ?? 0;
    this.score = { user: 0, opp: 0 };
    this.q = 1; this.clock = this.Q; this.ot = null;
    this.stats = {}; this.userFirst = Math.random() < 0.5;
    this.timers = []; this.banner = null; this.popups = []; this.toastMsg = null;
    this.camX = 20; this.viewW = 480;
    this.off = []; this.def = []; this.all = []; this.recv = [];
    this.state = 'intro'; this.los = 35; this.ballY = MID; this.down = 1; this.fdX = 45; this.conv = false;
    this.input = { id: null, mode: null }; this.paused = false; this.steerY = null; this.aim = null;
    this.ball = { x: 35, y: MID, z: 0, holder: null, air: null };
    this.hints = { aim: 0, run: 0 };
    this.kitU = teamKit(this.user.colors, false);
    this.kitO = teamKit(this.opp.colors, clash(this.user.colors, this.opp.colors));
    this.field = getFieldCanvas(this.user, this.opp);
    this.pmap = {};
    for (const p of this.userPlayers()) this.pmap[p.id] = p;
    this.buildLayer();
    this.setupFormation();
    this.showIntro();
  }

  userPlayers() {
    const o = this.user.off, d = this.user.def;
    return [o.QB, o.RB, ...o.WR, o.TE, ...o.OL, o.K, ...d.DL, ...d.LB, ...d.DB];
  }

  // ---------------- DOM overlay ----------------
  buildLayer() {
    this.layer.innerHTML = `<button class="hud-btn hud-pause" data-act="pause" aria-label="Pause">II</button>
      <button class="hud-btn hud-run hidden" data-act="scramble">QB RUN</button>
      <div class="hud-ov"></div>`;
    this.ov = this.layer.querySelector('.hud-ov');
    this.runBtn = this.layer.querySelector('.hud-run');
    this.handlers = {};
    this.onClick = (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el || !this.layer.contains(el)) return;
      ev.preventDefault();
      sfx.click();
      const act = el.dataset.act;
      if (act === 'pause') return this.pause();
      if (act === 'scramble') return this.scramble();
      const h = this.handlers[act];
      if (h) h(el.dataset);
    };
    this.layer.addEventListener('click', this.onClick);
  }
  destroy() { this.layer.removeEventListener('click', this.onClick); this.layer.innerHTML = ''; }
  panel(html, handlers, cls = '') { this.handlers = handlers || {}; this.ov.className = 'hud-ov show ' + cls; this.ov.innerHTML = html; }
  closePanel() { this.ov.className = 'hud-ov'; this.ov.innerHTML = ''; this.handlers = {}; }
  scoreline() {
    return `<span class="chip" style="${chipStyle(this.user)}">${esc(this.user.abbr)}</span> ${this.score.user}
      <span class="dash">-</span> ${this.score.opp} <span class="chip" style="${chipStyle(this.opp)}">${esc(this.opp.abbr)}</span>`;
  }
  periodLabel() { return this.ot ? 'OVERTIME' : `Q${this.q} ${fmtClock(this.clock)}`; }

  pause() {
    if (this.paused || this.state === 'final') return;
    this.paused = true;
    this.input.id = null; this.input.mode = null; this.aim = null; this.steerY = null;
    this.saved = { html: this.ov.innerHTML, cls: this.ov.className, h: this.handlers };
    this.panel(`<div class="card"><h2>PAUSED</h2><div class="sb">${this.scoreline()}</div><p class="small">${this.periodLabel()}</p>
      <div class="row"><button class="btn" data-act="resume">RESUME</button>
      <button class="btn alt" data-act="sound">SOUND: ${this.settings.sound ? 'ON' : 'OFF'}</button></div>
      <div class="row"><button class="btn danger" data-act="quit">${this.allowQuit ? 'QUIT TO MENU' : 'SIMULATE REST OF GAME'}</button></div></div>`, {
      resume: () => this.resume(),
      sound: () => { this.settings.sound = !this.settings.sound; this.saveSettings(); this.paused = false; this.pause(); },
      quit: () => {
        if (this.allowQuit) { this.state = 'final'; this.onEnd(null); }
        else this.simRest();
      },
    }, 'dim');
  }
  resume() {
    this.paused = false;
    const s = this.saved;
    if (s) { this.ov.className = s.cls; this.ov.innerHTML = s.html; this.handlers = s.h; }
    this.saved = null;
  }

  showIntro() {
    const U = this.user, O = this.opp;
    this.panel(`<div class="card intro"><div class="sb"><span class="chip" style="${chipStyle(U)}">${esc(U.abbr)}</span> <span class="dash">VS</span> <span class="chip" style="${chipStyle(O)}">${esc(O.abbr)}</span></div>
      <p>${esc(U.city)} ${esc(U.name)} vs ${esc(O.city)} ${esc(O.name)}</p>
      ${this.label ? `<p class="tag">${esc(this.label)}</p>` : ''}
      <p class="small">COIN TOSS: ${this.userFirst ? 'YOU RECEIVE THE KICKOFF' : 'THEY RECEIVE THE KICKOFF'}</p>
      <button class="btn big" data-act="go">KICK OFF</button></div>`,
      { go: () => { this.closePanel(); this.givePossession(this.userFirst ? 'user' : 'opp', 25); } }, 'dim');
  }

  // ---------------- game flow ----------------
  after(t, fn) { this.timers.push({ t, fn }); }
  bannerSet(text, color = '#fff', sub = '') { this.banner = { text, color, sub, t: 1.6 }; }
  popup(text, e) { this.popups.push({ text, x: e.x, y: e.y, t: 0.9 }); }
  toast(text) { this.toastMsg = { text, t: 2 }; }

  givePossession(team, yl) {
    if (this.state === 'final') return;
    if (this.ot) return this.otNext();
    if (this.clock <= 0) return this.periodEnd(team, yl);
    if (team === 'user') this.startUserDrive(yl); else this.runOppDrive(yl);
  }
  periodEnd(team, yl) {
    if (this.q === 1 || this.q === 3) {
      this.q++; this.clock = this.Q;
      this.toast(`END OF Q${this.q - 1}`);
      return this.givePossession(team, yl);
    }
    this.state = 'break';
    if (this.q === 2) {
      this.q = 3; this.clock = this.Q;
      this.panel(`<div class="card"><h2>HALFTIME</h2><div class="sb">${this.scoreline()}</div>
        <p class="small">${this.userFirst ? 'THEY RECEIVE TO START THE 2ND HALF' : 'YOU RECEIVE TO START THE 2ND HALF'}</p>
        <button class="btn big" data-act="go">START 2ND HALF</button></div>`,
        { go: () => { this.closePanel(); this.givePossession(this.userFirst ? 'opp' : 'user', 25); } }, 'dim');
      return;
    }
    if (this.score.user !== this.score.opp) return this.finish();
    this.ot = { round: 1, u: false, o: false };
    this.panel(`<div class="card"><h2>OVERTIME</h2><div class="sb">${this.scoreline()}</div>
      <p class="small">EACH TEAM GETS A POSSESSION FROM ITS OWN 25.${this.playoff ? ' PLAYOFFS: PLAY UNTIL THERE IS A WINNER.' : ''}</p>
      <button class="btn big" data-act="go">YOUR BALL</button></div>`,
      { go: () => { this.closePanel(); this.otNext(); } }, 'dim');
  }
  otNext() {
    const ot = this.ot;
    if (!ot.u) { ot.u = true; return this.startUserDrive(25); }
    if (!ot.o) { ot.o = true; return this.runOppDrive(25); }
    if (this.score.user !== this.score.opp) return this.finish();
    if (!this.playoff && ot.round >= 2) return this.finish();
    ot.round++; ot.u = ot.o = false;
    this.toast(`OT ROUND ${ot.round}`);
    this.otNext();
  }
  continueDrive() {
    if (!this.ot && this.clock <= 0) {
      if (this.q === 1 || this.q === 3) { this.q++; this.clock = this.Q; this.toast(`END OF Q${this.q - 1}`); }
      else return this.periodEnd(null, 0);
    }
    this.enterPresnap();
  }
  startUserDrive(yl) {
    this.los = 10 + clamp(Math.round(yl), 1, 99);
    this.ballY = MID; this.down = 1; this.conv = false;
    this.fdX = Math.min(this.los + 10, 110);
    this.enterPresnap();
  }
  enterPresnap() {
    this.state = 'presnap';
    this.setupFormation();
    this.showPlayCall();
  }
  spotText(x) {
    const yl = Math.round(x - 10);
    if (yl === 50) return 'MIDFIELD';
    return yl < 50 ? `OWN ${yl}` : `OPP ${100 - yl}`;
  }
  situation() {
    if (this.conv) return '2-POINT TRY';
    const tg = this.fdX >= 110 ? 'GOAL' : Math.max(1, Math.round(this.fdX - this.los));
    return `${DOWNS[this.down]} & ${tg} · ${this.spotText(this.los)}`;
  }
  fgInfo() {
    const k = this.user.off.K.attrs;
    const d = Math.round(110 - this.los + 17);
    const max = 44 + k.kpw * 0.16;
    const p = clamp((0.55 + k.kac * 0.0045) * (1.06 - Math.max(0, d - 22) * (0.019 - k.kpw * 0.00008)), 0.03, 0.98);
    return { dist: d, ok: d <= max, p };
  }
  xpPct() { return clamp(0.86 + this.user.off.K.attrs.kac * 0.0013, 0.5, 0.99); }

  showPlayCall() {
    const passes = shuffle(PLAYS.filter((p) => p.type === 'pass')).slice(0, 3);
    const cards = [...passes, pick(PLAYS.filter((p) => p.type === 'run'))];
    this.cards = cards;
    let extra = '';
    if (!this.conv) {
      const fg = this.fgInfo();
      const late = !this.ot && (this.q === 2 || this.q === 4) && this.clock <= 40;
      if ((this.down === 4 || late || this.ot) && fg.ok) extra += `<button class="btn kick" data-act="fg">FIELD GOAL<small>${fg.dist} YDS · ${Math.round(fg.p * 100)}%</small></button>`;
      if (this.down === 4 && this.los < 80) extra += `<button class="btn kick alt" data-act="punt">PUNT<small>~${Math.round(38 + this.user.off.K.attrs.kpw * 0.1)} YDS</small></button>`;
    }
    this.panel(`<div class="playcall"><div class="pc-head">${this.situation()}</div><div class="pc-cards">
      ${cards.map((p, i) => `<button class="pcard ${p.type}" data-act="call" data-i="${i}">${playSvg(p)}<span>${p.name}</span></button>`).join('')}
      ${extra ? `<div class="pc-kicks">${extra}</div>` : ''}</div></div>`, {
      call: (d) => { this.closePanel(); this.startPlay(this.cards[+d.i]); },
      fg: () => { this.closePanel(); this.doKick('fg'); },
      punt: () => { this.closePanel(); this.doKick('punt'); },
    }, 'bottom');
  }

  // ---------------- formation & snap ----------------
  setupFormation() {
    const U = this.user.off, D = this.opp.def, los = this.los, by = this.ballY, bonus = this.diff;
    this.off = []; this.def = [];
    const add = (arr, e, x, y) => { e.x = e.hx = x; e.y = e.hy = clamp(y, 1, FW - 1); arr.push(e); return e; };
    this.ol = U.OL.map((p, i) => add(this.off, mk(p, 'off', 'OL'), los - 0.6, by + (i - 2) * 1.6));
    this.qb = add(this.off, mk(U.QB, 'off', 'QB'), los - 4.5, by);
    this.rb = add(this.off, mk(U.RB, 'off', 'RB'), los - 5, by + 2.2);
    this.wr = [
      add(this.off, mk(U.WR[0], 'off', 'WR1'), los - 0.6, clamp(by - 17, 3, 50)),
      add(this.off, mk(U.WR[1], 'off', 'WR2'), los - 0.6, clamp(by + 17, 3, 50)),
      add(this.off, mk(U.WR[2], 'off', 'WR3'), los - 1.2, clamp(by - 8.5, 3, 50)),
    ];
    this.te = add(this.off, mk(U.TE, 'off', 'TE'), los - 1, by + 4.4);
    this.recv = [...this.wr, this.te, this.rb];
    this.dl = D.DL.map((p, i) => add(this.def, mk(p, 'def', 'DL', bonus), los + 0.9, by + [-2.6, -0.9, 0.9, 2.6][i]));
    this.lb = D.LB.map((p, i) => add(this.def, mk(p, 'def', 'LB', bonus), los + 4.5, by + [-5, 0, 5][i]));
    this.db = [
      add(this.def, mk(D.DB[0], 'def', 'CB', bonus), los + 6, this.wr[0].y),
      add(this.def, mk(D.DB[1], 'def', 'CB', bonus), los + 6, this.wr[1].y),
      add(this.def, mk(D.DB[2], 'def', 'NB', bonus), los + 5, this.wr[2].y),
      add(this.def, mk(D.DB[3], 'def', 'S', bonus), los + 13, by),
    ];
    this.all = this.off.concat(this.def);
    this.ball.holder = null; this.ball.air = null;
    this.ball.x = los; this.ball.y = by; this.ball.z = 0.3;
    this.carrier = null;
  }

  startPlay(play) {
    this.play = play; this.t = 0; this.state = 'live';
    this.thrown = false; this.carrier = null; this.caught = false; this.handed = false; this.target = null;
    const b = this.ball; b.holder = this.qb; b.air = null;
    this.input.mode = null; this.steerY = null; this.aim = null;
    sfx.snap();
    const by = this.ballY, run = play.type === 'run';
    // offense assignments
    for (const w of this.recv) {
      if (w === this.rb && run) { w.task = 'handoff'; continue; }
      const r = run ? 'block' : play.routes[w.role];
      if (!r || r === 'block') { w.task = run ? 'block' : 'protect'; continue; }
      const R = ROUTES[r];
      const side = Math.sign(w.y - by) || 1;
      w.route = R.pts.map(([dx, dy]) => ({ x: Math.min(w.x + dx, 119), y: clamp(w.y + dy * side, 1.2, FW - 1.2) }));
      w.end = R.end; w.ri = 0; w.task = 'route';
    }
    this.qb.task = 'qb';
    // line play: OL engage DL
    const map = [0, 1, 3, 4];
    this.ol.forEach((o) => { o.task = 'pass'; o.eng = null; });
    this.dl.forEach((d, i) => {
      const o = this.ol[map[i]];
      d.task = 'rush';
      let bt = clamp(2.3 + (o.a.blk - (d.tkl + d.a.str) / 2) * 0.035 + rand(-0.7, 1.3), 1.0, 5.5);
      if (run) bt *= 0.95;
      this.engage(o, d, bt);
    });
    // coverage
    const [cb1, cb2, nb, s] = this.db;
    const setMan = (d, r) => { d.task = 'man'; d.man = r; d.px = r.x; d.py = r.y; };
    setMan(cb1, this.wr[0]); setMan(cb2, this.wr[1]); setMan(nb, this.wr[2]);
    s.task = 'deep';
    const [lb0, lb1, lb2] = this.lb;
    lb0.task = 'hook';
    if (this.rb.task === 'route') setMan(lb1, this.rb); else lb1.task = 'hook';
    if (this.te.task === 'route') setMan(lb2, this.te); else lb2.task = 'hook';
    if (Math.random() < 0.15 + this.diff * 0.06) {
      const cand = this.lb.filter((l) => l.task === 'hook');
      pick(cand.length ? cand : this.lb).task = 'blitz';
    }
    if (play.pa) for (const l of this.lb) if (l.task !== 'blitz') { l.after = l.task; l.task = 'bite'; }
    if (!run) this.runBtn.classList.remove('hidden');
  }

  engage(o, d, time) { o.eng = d; d.eng = o; d.engT = time; }

  handoff() {
    this.handed = true;
    const rb = this.rb;
    this.ball.holder = rb; this.carrier = rb; rb.task = 'carrier'; rb.cur = rb.sp * 0.6;
    const side = this.play.dir === 'mid' ? 0 : this.ballY < MID ? 1 : -1;
    rb.autoT = this.play.dir === 'mid' ? 0.25 : 0.7;
    rb.autoVy = side * rb.sp * (this.play.dir === 'wide' ? 0.85 : 0.7);
    this.qb.task = 'idle';
    this.stat(rb, 'ra', 1);
    for (const d of this.def) if (d.task !== 'rush') { d.react = 0.4 + (100 - d.tkl) * 0.005 + (d.role === 'CB' || d.role === 'S' ? 0.3 : 0); d.pend = 'pursue'; }
  }

  scramble() {
    if (this.state !== 'live' || this.ball.holder !== this.qb || this.carrier || this.paused) return;
    this.carrier = this.qb; this.qb.task = 'carrier'; this.qb.cur = 3;
    this.runBtn.classList.add('hidden');
    for (const d of this.def) if (d.task !== 'rush' && d.task !== 'blitz') { d.react = 0.25 + (100 - d.tkl) * 0.004; d.pend = 'pursue'; }
    for (const e of this.recv) e.task = 'block';
    this.stat(this.qb, 'ra', 1);
    this.input.mode = null; this.aim = null;
  }

  // ---------------- simulation ----------------
  update(dt) {
    if (this.paused) return;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.toastMsg && (this.toastMsg.t -= dt) <= 0) this.toastMsg = null;
    for (const p of this.popups) p.t -= dt;
    if (this.popups.length) this.popups = this.popups.filter((p) => p.t > 0);
    if (this.state === 'live') this.updLive(dt);
    else if (this.state === 'kick') this.updKick(dt);
    if (this.state !== 'live') for (const e of this.all) { e.vx *= 0.8; e.vy *= 0.8; }
    for (const e of this.all) {
      const s = Math.hypot(e.vx, e.vy);
      e.anim += dt * s * 1.4;
      if (e.vx > 0.3) e.face = 1; else if (e.vx < -0.3) e.face = -1;
    }
    this.updCamera(dt);
  }

  updCamera(dt) {
    const vw = this.viewW / SX, b = this.ball;
    let fx = this.los + 6;
    if (this.state === 'live' || this.state === 'dead') {
      if (b.air) fx = Math.max(b.x, b.air.tx - 6);
      else if (this.carrier) fx = this.carrier.x + 3;
      else fx = this.qb.x + 11;
    } else if (this.state === 'kick') fx = b.x;
    const target = clamp(fx - vw * 0.32, -4, 124 - vw);
    this.camX += (target - this.camX) * Math.min(1, dt * 4);
  }

  updLive(dt) {
    const t = (this.t += dt);
    if (!this.ot) this.clock = Math.max(0, this.clock - dt);
    const play = this.play, qb = this.qb, b = this.ball;
    if (play.type === 'run') {
      if (!this.handed) {
        steer(qb, this.los - 5.2, this.ballY - 0.4, 4, dt);
        steer(this.rb, this.los - 4.6, this.ballY + 0.6, this.rb.sp * 0.7, dt);
        if (t >= 0.5) this.handoff();
      } else if (qb !== this.carrier) steer(qb, qb.x - 1, qb.y, 1.5, dt);
    } else if (b.holder === qb && this.carrier !== qb) {
      if (play.pa && t < 0.6) steer(qb, this.los - 5, this.ballY, 3, dt);
      else steer(qb, this.los - 7.2, this.ballY, 4.2, dt);
    } else if (this.carrier !== qb) { qb.vx *= 0.9; qb.vy *= 0.9; }
    for (const e of this.off) if (e !== this.carrier && e !== qb) this.updOff(e, dt);
    if (this.carrier) this.updCarrier(this.carrier, dt);
    if (this.state !== 'live') return;
    for (const d of this.def) this.updDef(d, dt, t);
    this.updBall(dt);
    if (this.state !== 'live') return;
    this.contacts();
  }

  updOff(e, dt) {
    const b = this.ball;
    if (e.cd > 0) e.cd -= dt;
    switch (e.task) {
      case 'route': {
        if (b.air && this.target === e) { steer(e, b.air.tx, b.air.ty, e.sp, dt); return; }
        const wp = e.route[e.ri];
        if (wp) {
          if (steer(e, wp.x, wp.y, e.sp * 0.96, dt)) {
            const prev = e.ri > 0 ? e.route[e.ri - 1] : { x: e.hx, y: e.hy };
            const dx = wp.x - prev.x, dy = wp.y - prev.y, l = Math.hypot(dx, dy) || 1;
            e.dirx = dx / l; e.diry = dy / l; e.ri++;
          }
        } else if (e.end === 'cont') {
          const nx = clamp(e.x + e.dirx * e.sp * dt, 0, 119), ny = clamp(e.y + e.diry * e.sp * dt, 1, FW - 1);
          e.vx = (nx - e.x) / dt; e.vy = (ny - e.y) / dt; e.x = nx; e.y = ny;
        } else { e.vx = 0; e.vy = 0; }
        return;
      }
      case 'protect': return this.protect(e, dt);
      case 'pass': return this.passBlock(e, dt);
      case 'block': return this.block(e, dt);
      default: e.vx *= 0.85; e.vy *= 0.85;
    }
  }

  freeRusher(near, range) {
    let best = null, bd = range;
    for (const x of this.def) {
      if (x.eng || x.stun > 0 || (x.task !== 'blitz' && x.task !== 'rush')) continue;
      const d = dist(x, near);
      if (d < bd) { bd = d; best = x; }
    }
    return best;
  }
  passBlock(o, dt) {
    const d = o.eng;
    if (d && d.eng === o) { steer(o, d.x - 0.75, d.y, o.sp, dt); return; }
    o.eng = null;
    if (this.carrier) return this.block(o, dt);
    const r = this.freeRusher(o, 4.5);
    if (r) { steer(o, r.x - 0.6, r.y, o.sp * 0.8, dt); if (dist(o, r) < 0.9) this.engage(o, r, 0.6 + o.a.blk / 100); }
    else steer(o, o.hx - 1.2, o.hy, 2, dt);
  }
  protect(e, dt) {
    const d = e.eng;
    if (d && d.eng === e) { steer(e, d.x - 0.7, d.y, e.sp, dt); return; }
    e.eng = null;
    if (this.carrier) return this.block(e, dt);
    const r = this.freeRusher(this.qb, 4);
    if (r) { steer(e, r.x - 0.6, r.y, e.sp, dt); if (dist(e, r) < 0.9) this.engage(e, r, 0.7 + e.a.blk / 100); }
    else steer(e, this.qb.x + 1.3, this.qb.y + (e.hy > this.ballY ? 1.4 : -1.4), 3, dt);
  }
  block(e, dt) {
    const c = this.carrier || (this.play.type === 'run' ? this.rb : this.qb);
    const d = e.eng;
    if (d && d.eng === e) {
      const dx = c.x - d.x, dy = c.y - d.y, l = Math.hypot(dx, dy) || 1;
      steer(e, d.x + (dx / l) * 0.7, d.y + (dy / l) * 0.7, e.sp, dt);
      return;
    }
    e.eng = null;
    if (e.cd > 0) { e.vx *= 0.9; e.vy *= 0.9; e.x += e.vx * dt; e.y += e.vy * dt; return; }
    let best = null, bd = 1e9;
    for (const x of this.def) {
      if (x.eng || x.stun > 0) continue;
      if (dist(x, c) > 11 || x.x < c.x - 4) continue;
      const de = dist(x, e);
      if (de < bd) { bd = de; best = x; }
    }
    if (!best) { steer(e, c.x + 5, e.y, e.sp * 0.7, dt); return; }
    const dx = c.x - best.x, dy = c.y - best.y, l = Math.hypot(dx, dy) || 1;
    steer(e, best.x + (dx / l) * 0.8, best.y + (dy / l) * 0.8, e.sp * 0.95, dt);
    if (bd < 0.95) this.engage(e, best, 0.35 + e.a.blk / 110);
  }

  lead(d, c) {
    const tl = Math.min(1.1, dist(d, c) / d.sp) * 0.7;
    return { gx: c.x + c.vx * tl, gy: c.y + c.vy * tl };
  }
  updDef(d, dt, t) {
    if (d.stun > 0) { d.stun -= dt; d.vx *= 0.8; d.vy *= 0.8; if (d.stun <= 0) d.down = false; return; }
    if (d.pend) { d.react -= dt; if (d.react <= 0) { d.task = d.pend; d.pend = null; } }
    if (d.hawk > 0) { d.hawk -= dt; if (d.hawk <= 0 && this.ball.air) d.task = 'hawk'; }
    const b = this.ball, qb = this.qb, c = this.carrier;
    let gx = d.x, gy = d.y, sp = d.sp;
    switch (d.task) {
      case 'rush': case 'blitz': {
        if (d.task === 'blitz' && t < 0.25) { sp = 0; break; }
        if (b.holder === qb && c !== qb) { gx = qb.x; gy = qb.y; }
        else if (c) ({ gx, gy } = this.lead(d, c));
        else if (b.air) { gx = b.air.tx; gy = b.air.ty; sp *= 0.5; }
        if (d.task === 'rush') sp *= 0.9;
        break;
      }
      case 'man': {
        const r = d.man;
        const k = Math.min(1, dt * (1.6 + d.cov / 40));
        d.px += (r.x - d.px) * k; d.py += (r.y - d.py) * k;
        const cush = Math.max(0.6, (d.role === 'CB' ? 3.5 : 2.2) - t * 1.2);
        gx = d.px + cush; gy = d.py;
        break;
      }
      case 'hook': {
        let tx = d.hx, ty = d.hy, best = null, bd = 7;
        for (const r of this.recv) {
          if (r.task !== 'route') continue;
          const dd = Math.hypot(r.x - d.hx, r.y - d.hy);
          if (dd < bd) { bd = dd; best = r; }
        }
        if (best) { tx = (best.x + d.hx) / 2 + 1; ty = best.y; }
        gx = Math.max(tx, this.los + 3); gy = ty; sp *= 0.85;
        break;
      }
      case 'deep': {
        let mx = this.los + 10, sy = 0, n = 0;
        for (const r of this.recv) if (r.task === 'route' && r.x > this.los + 6) { mx = Math.max(mx, r.x); sy += r.y; n++; }
        gx = Math.max(this.los + 11, mx + 3.5); gy = n ? sy / n : this.ballY;
        break;
      }
      case 'bite': gx = this.los + 1.5; gy = d.hy; if (t > 0.65) { d.task = d.after; if (d.man) { d.px = d.x; d.py = d.y; } } break;
      case 'hawk': if (b.air) { gx = b.air.tx; gy = b.air.ty; } else d.task = 'pursue'; break;
      case 'pursue':
        if (c) ({ gx, gy } = this.lead(d, c));
        else if (b.holder === qb) { gx = qb.x; gy = qb.y; }
        break;
    }
    if (d.eng) {
      d.engT -= dt;
      if (d.engT <= 0 || d.eng.eng !== d) {
        if (d.eng.eng === d) { d.eng.eng = null; d.eng.cd = 0.8; }
        d.eng = null;
      } else sp *= 0.12;
    }
    steer(d, gx, gy, sp, dt);
  }

  updCarrier(c, dt) {
    c.immune = Math.max(0, c.immune - dt); c.cd = Math.max(0, c.cd - dt);
    if (c.spin > 0) c.spin -= dt;
    c.cur = Math.min(c.sp, c.cur + 14 * dt);
    const sp = c.cur * (c.spin > 0 ? 0.8 : 1);
    if (c.dive > 0) {
      c.dive -= dt; c.vx = sp + 1.5; c.vy *= 0.9;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (this.carrierBounds(c)) return;
      if (c.dive <= 0) { c.down = true; this.endPlay({ type: 'tackle', x: c.x, y: c.y }); }
      return;
    }
    let vy;
    if (c.juke > 0) { c.juke -= dt; vy = c.jdir * sp * 1.05; c.vx = sp * 0.6; }
    else {
      if (this.steerY != null) vy = (this.steerY - c.y) * 3.2;
      else if (c.autoT > 0) { c.autoT -= dt; vy = c.autoVy; }
      else vy = c.vy * Math.max(0, 1 - dt * 5);
      vy = clamp(vy, -sp * 0.85, sp * 0.85);
      c.vx = Math.sqrt(Math.max(0, sp * sp - vy * vy));
    }
    c.vy = vy;
    c.x += c.vx * dt; c.y += c.vy * dt;
    this.carrierBounds(c);
  }
  carrierBounds(c) {
    if (c.x >= 110) { this.endPlay({ type: 'td', x: 110.5, y: c.y }); return true; }
    if (c.y < 0 || c.y > FW) { this.endPlay({ type: 'oob', x: c.x, y: clamp(c.y, 0, FW) }); return true; }
    return false;
  }

  updBall(dt) {
    const b = this.ball;
    if (b.air) {
      const a = b.air;
      a.t += dt;
      const f = Math.min(1, a.t / a.T);
      b.x = a.sx + (a.tx - a.sx) * f; b.y = a.sy + (a.ty - a.sy) * f;
      b.z = 4 * a.h * f * (1 - f) + 1.6 * (1 - f);
      if (f >= 1) this.resolveCatch();
    } else if (b.holder) { b.x = b.holder.x + 0.35 * b.holder.face; b.y = b.holder.y; b.z = 1.1; }
  }

  contacts() {
    const c = this.carrier || (this.ball.holder === this.qb ? this.qb : null);
    if (!c || c.immune > 0) return;
    for (const d of this.def) {
      if (d.stun > 0) continue;
      if (Math.abs(d.x - c.x) > 0.9 || Math.abs(d.y - c.y) > 0.9 || dist(d, c) > 0.85) continue;
      const sack = c === this.qb && this.carrier !== this.qb;
      const elus = (c.a.agi + c.a.str) / 2 - (sack ? 20 : 0);
      let p = clamp(0.66 + (d.tkl - elus) * 0.006 + this.diff * 0.05, 0.4, 0.95);
      if (d.eng) p *= 0.4;
      if (c.spin > 0) p *= 0.55;
      if (Math.random() < p) {
        sfx.tackle();
        c.down = true; d.down = true; d.stun = 9;
        return this.endPlay({ type: sack ? 'sack' : 'tackle', x: c.x + (sack ? 0 : 0.4), y: c.y });
      }
      c.immune = 0.45; d.stun = 0.75; d.down = true;
      this.popup('BROKEN TACKLE', c);
      sfx.juke();
      return;
    }
  }

  // ---------------- passing ----------------
  aimTarget() {
    const I = this.input, qb = this.qb;
    let tx, ty;
    if (this.settings.aim === 'direct') { tx = I.x / SX + this.camX; ty = (I.y - TOP) / SY; }
    else { tx = qb.x + ((I.sx - I.x) * 2.6) / SX; ty = qb.y + ((I.sy - I.y) * 2.0) / SY; }
    const maxR = 38 + qb.a.arm * 0.3;
    const dx = tx - qb.x, dy = ty - qb.y, d = Math.hypot(dx, dy);
    if (d > maxR) { tx = qb.x + (dx / d) * maxR; ty = qb.y + (dy / d) * maxR; }
    return { x: clamp(tx, qb.x - 15, 119.5), y: clamp(ty, -1, FW + 1) };
  }
  throwBall(tg) {
    const qb = this.qb, a = qb.a, b = this.ball;
    let { x: tx, y: ty } = tg;
    const d = Math.hypot(tx - qb.x, ty - qb.y);
    const press = this.def.some((x) => !x.eng && x.stun <= 0 && dist(x, qb) < 2.6);
    const err = d * (0.015 + (100 - a.acc) * 0.001) * (press ? 1.7 : 1);
    tx += (Math.random() * 2 - 1) * err; ty += (Math.random() * 2 - 1) * err * 0.8;
    const v = 17 + a.arm * 0.11;
    const T = Math.max(0.3, d / v + 0.1);
    b.air = { sx: qb.x + 0.3, sy: qb.y, tx, ty, T, t: 0, h: Math.min(9, 0.6 + d * 0.17) };
    b.holder = null; this.thrown = true;
    this.runBtn.classList.add('hidden');
    this.stat(qb, 'pa', 1);
    sfx.throw();
    let best = null, bt = 1e9;
    for (const r of this.recv) {
      if (r.task !== 'route' && r.task !== 'protect') continue;
      const dd = Math.hypot(r.x - tx, r.y - ty);
      if (dd < r.sp * T * 1.05 + 2.2 && dd / r.sp < bt) { bt = dd / r.sp; best = r; }
    }
    this.target = best;
    if (best) best.task = 'route';
    if (best && !best.route) { best.route = []; best.end = 'stop'; }
    for (const df of this.def) {
      if (!['man', 'hook', 'deep', 'bite'].includes(df.task)) continue;
      const dd = Math.hypot(df.x - tx, df.y - ty);
      const delay = 0.25 + (100 - df.cov) * 0.006;
      if (dd < df.sp * Math.max(0, T - delay) + 1.0) df.hawk = delay;
    }
  }
  resolveCatch() {
    const b = this.ball, a = b.air;
    b.air = null;
    const tx = a.tx, ty = a.ty;
    if (ty < 0 || ty > FW || tx > 120) return this.incomplete('OUT OF BOUNDS');
    let rec = null, rd = 1e9;
    for (const r of this.recv) {
      const d = Math.hypot(r.x - tx, r.y - ty), R = 1.3 + r.a.hnd * 0.006;
      if (d < R && d < rd) { rec = r; rd = d; }
    }
    let df = null, dd = 1e9;
    for (const d of this.def) {
      if (d.stun > 0) continue;
      const x = Math.hypot(d.x - tx, d.y - ty);
      if (x < 1.25 && x < dd) { df = d; dd = x; }
    }
    const hnd = rec ? rec.a.hnd : 0;
    if (df && rec) {
      const sep = dd - rd;
      const pInt = clamp(0.06 - sep * 0.05 + (df.cov - hnd) * 0.002 + this.diff * 0.03, 0.02, 0.3);
      const pBu = clamp(0.28 - sep * 0.1 + (df.cov - hnd) * 0.003, 0.08, 0.55);
      const r = Math.random();
      if (r < pInt) return this.intercept(df);
      if (r < pInt + pBu) return this.incomplete('BROKEN UP');
      return Math.random() < 0.55 + hnd * 0.004 ? this.catchBy(rec) : this.incomplete('DROPPED');
    }
    if (df) return Math.random() < clamp(0.2 + df.cov * 0.003 - dd * 0.15 + this.diff * 0.05, 0.08, 0.6) ? this.intercept(df) : this.incomplete();
    if (rec) return Math.random() < clamp(0.8 + hnd * 0.002 - rd * 0.05, 0.6, 0.99) ? this.catchBy(rec) : this.incomplete('DROPPED');
    return this.incomplete();
  }
  catchBy(r) {
    this.caught = true; this.carrier = r; r.task = 'carrier'; this.ball.holder = r;
    r.cur = r.sp * 0.55; r.vy = 0;
    this.stat(r, 'rec', 1); this.stat(this.qb, 'pc', 1);
    sfx.catch(); this.popup('CATCH', r);
    for (const e of this.off) if (e !== r && e !== this.qb) e.task = e.role === 'OL' ? 'pass' : 'block';
    for (const d of this.def) { d.pend = 'pursue'; d.react = 0.2 + (100 - d.tkl) * 0.004; }
    if (r.x >= 110) this.endPlay({ type: 'td', x: 110.5, y: r.y });
  }
  incomplete(msg) { this.endPlay({ type: 'incomplete', msg }); }
  intercept(d) { d.down = false; this.endPlay({ type: 'int', x: d.x, y: d.y }); }

  // ---------------- play result ----------------
  stat(e, k, n) {
    const p = e.p || e;
    if (!p || p.id == null) return;
    const s = this.stats[p.id] || (this.stats[p.id] = {});
    s[k] = (s[k] || 0) + n;
  }
  endPlay(r) {
    if (this.state !== 'live') return;
    this.state = 'dead';
    sfx.whistle();
    this.runBtn.classList.add('hidden');
    this.steerY = null; this.aim = null; this.input.mode = null;
    const c = this.carrier;
    const live = r.type === 'tackle' || r.type === 'sack';
    if (!this.ot) this.clock = Math.max(0, this.clock - (live ? 22 : 5));
    const spot = r.type === 'incomplete' || r.type === 'int' ? this.los : Math.round(clamp(r.x, 0.5, 110));
    const gain = spot - this.los;
    if (c && r.type !== 'int' && r.type !== 'sack' && gain !== 0) {
      if (this.caught) { this.stat(c, 'recy', gain); this.stat(this.qb, 'py', gain); }
      else this.stat(c, 'ry', gain);
    }
    if (r.type === 'td') {
      if (this.caught) { this.stat(c, 'rectd', 1); this.stat(this.qb, 'ptd', 1); } else if (c) this.stat(c, 'rtd', 1);
      sfx.td();
      if (this.conv) { this.score.user += 2; this.bannerSet('2-POINT GOOD!', '#f7c948'); return this.after(1.6, () => this.givePossession('opp', 25)); }
      this.score.user += 6; this.bannerSet('TOUCHDOWN!', '#f7c948', `${c ? short(c.p) : ''} ${gain} YDS`);
      return this.after(1.9, () => this.patChoice());
    }
    if (this.conv) { this.bannerSet('NO GOOD', '#ff6b6b'); sfx.bad(); return this.after(1.4, () => this.givePossession('opp', 25)); }
    if (r.type === 'int') {
      this.stat(this.qb, 'pint', 1);
      this.bannerSet('INTERCEPTED!', '#ff6b6b'); sfx.bad();
      const oy = r.x >= 110 ? 20 : clamp(Math.round(110 - r.x + randi(0, 18)), 3, 97);
      return this.after(1.8, () => this.givePossession('opp', oy));
    }
    if (live && spot <= 10) {
      this.score.opp += 2; this.bannerSet('SAFETY', '#ff6b6b'); sfx.bad();
      return this.after(1.8, () => this.givePossession('opp', 35));
    }
    let msg, col = '#fff';
    if (r.type === 'incomplete') { msg = r.msg || 'INCOMPLETE'; col = '#cfd6e0'; }
    else if (r.type === 'sack') { msg = `SACKED ${gain}`; col = '#ff6b6b'; }
    else msg = gain > 0 ? `+${gain} YDS` : gain === 0 ? 'NO GAIN' : `${gain} YDS`;
    if (r.type === 'oob') msg += ' OOB';
    const newLos = Math.max(11, spot);
    if (r.type !== 'incomplete') this.ballY = clamp(r.y, HASH_L, HASH_R);
    this.los = newLos;
    if (newLos >= this.fdX) {
      this.down = 1; this.fdX = Math.min(newLos + 10, 110);
      this.bannerSet(msg, col, 'FIRST DOWN'); sfx.first();
      return this.after(1.5, () => this.continueDrive());
    }
    this.down++;
    if (this.down > 4) {
      this.bannerSet(msg, col, 'TURNOVER ON DOWNS'); sfx.bad();
      return this.after(1.8, () => this.givePossession('opp', clamp(110 - this.los, 1, 99)));
    }
    this.bannerSet(msg, col);
    this.after(1.3, () => this.continueDrive());
  }

  patChoice() {
    this.state = 'pat';
    this.panel(`<div class="card"><h2>TOUCHDOWN!</h2><div class="sb">${this.scoreline()}</div><div class="row">
      <button class="btn" data-act="xp">KICK EXTRA POINT<small>${Math.round(this.xpPct() * 100)}%</small></button>
      <button class="btn alt" data-act="two">GO FOR 2<small>PLAY FROM THE 2</small></button></div></div>`, {
      xp: () => { this.closePanel(); this.los = 108; this.ballY = MID; this.doKick('xp'); },
      two: () => { this.closePanel(); this.conv = true; this.los = 108; this.down = 1; this.fdX = 110; this.ballY = MID; this.enterPresnap(); },
    }, 'dim');
  }

  doKick(kind) {
    this.setupFormation();
    this.state = 'kick';
    const K = this.user.off.K;
    const k = K.attrs;
    const sx = this.los - 7;
    const kicker = mk(K, 'off', 'K');
    kicker.x = sx - 2; kicker.y = this.ballY + 1;
    this.qb.x = sx; this.qb.y = this.ballY - 0.5;
    this.rb.x = sx + 1; this.rb.y = this.ballY + 3;
    this.off.push(kicker); this.all.push(kicker);
    let tx, ty;
    if (kind === 'punt') {
      const d = 38 + k.kpw * 0.1 + rand(-7, 7);
      tx = Math.min(this.los + d, 118); ty = clamp(this.ballY + rand(-12, 12), 4, FW - 4);
      this.kick = { kind, d, land: this.los + d };
      if (!this.ot) this.clock = Math.max(0, this.clock - 10);
    } else {
      const p = kind === 'xp' ? this.xpPct() : this.fgInfo().p;
      const good = Math.random() < p;
      tx = 120; ty = MID + (good ? rand(-2, 2) : (Math.random() < 0.5 ? -1 : 1) * rand(3.8, 7));
      this.kick = { kind, good };
      if (!this.ot && kind === 'fg') this.clock = Math.max(0, this.clock - 5);
    }
    Object.assign(this.kick, { sx, sy: this.ballY, tx, ty, T: kind === 'punt' ? 2.2 : 1.3, t: -0.35, h: kind === 'punt' ? 18 : 10 });
    const b = this.ball; b.holder = null; b.air = null; b.x = sx; b.y = this.ballY; b.z = 0.3;
  }
  updKick(dt) {
    const k = this.kick;
    k.t += dt;
    if (k.t < 0) { const kk = this.off[this.off.length - 1]; steer(kk, k.sx - 0.3, k.sy, 6, dt); return; }
    if (!k.boom) { k.boom = true; sfx.kick(); }
    const f = Math.min(1, k.t / k.T), b = this.ball;
    b.x = k.sx + (k.tx - k.sx) * f; b.y = k.sy + (k.ty - k.sy) * f;
    b.z = 4 * k.h * f * (1 - f) + (k.kind === 'punt' ? 0 : f * 6);
    if (f >= 1 && !k.done) { k.done = true; this.resolveKick(); }
  }
  resolveKick() {
    const k = this.kick;
    this.state = 'dead';
    if (k.kind === 'punt') {
      const oy = k.land >= 110 ? 20 : clamp(Math.round(110 - k.land + randi(0, 12)), 1, 99);
      this.bannerSet(k.land >= 110 ? 'TOUCHBACK' : `PUNT ${Math.round(k.d)} YDS`);
      return this.after(1.5, () => this.givePossession('opp', oy));
    }
    if (k.good) { this.score.user += k.kind === 'xp' ? 1 : 3; this.bannerSet(k.kind === 'xp' ? 'EXTRA POINT GOOD' : 'FIELD GOAL!', '#f7c948'); sfx.first(); }
    else { this.bannerSet('NO GOOD', '#ff6b6b', 'WIDE ' + (k.ty < MID ? 'LEFT' : 'RIGHT')); sfx.bad(); }
    const oy = k.kind === 'fg' && !k.good ? clamp(117 - this.los, 20, 99) : 25;
    this.after(1.6, () => this.givePossession('opp', oy));
  }

  runOppDrive(yl) {
    this.state = 'opp';
    this.runBtn.classList.add('hidden');
    const r = simDrive(this.opp.offRating + this.diff * 4, this.user.defRating, yl);
    let time = Math.round(this.Q * rand(0.22, 0.5));
    if (!this.ot) { time = Math.min(time, this.clock); this.clock -= time; }
    this.score.opp += r.pts;
    const notes = [];
    if (r.res === 'TO') { const p = pick([...this.user.def.DB, ...this.user.def.LB]); this.stat(p, 'dint', 1); notes.push(`TAKEAWAY BY ${short(p)}`); }
    if (Math.random() < 0.4) { const p = pick([...this.user.def.DL, ...this.user.def.LB]); this.stat(p, 'sck', 1); notes.push(`SACK BY ${short(p)}`); }
    const good = r.pts === 0;
    if (r.pts >= 6) sfx.bad(); else if (good) sfx.first();
    const ytext = yl >= 50 ? (yl === 50 ? 'MIDFIELD' : `YOUR ${100 - yl}`) : `THEIR ${yl}`;
    this.panel(`<div class="card opp"><h3>${esc(this.opp.city)} ${esc(this.opp.name)} BALL</h3>
      <p class="small">START: ${ytext} · DRIVE ${r.yds} YDS${this.ot ? '' : ' · ' + fmtClock(time)}</p>
      <div class="result ${good ? 'good' : 'bad'}">${r.text}</div>
      ${notes.length ? `<p class="small">${esc(notes.join(' · '))}</p>` : ''}
      <div class="sb">${this.scoreline()}</div><p class="small">${this.periodLabel()}</p>
      <button class="btn big" data-act="go">CONTINUE</button></div>`,
      { go: () => { this.closePanel(); this.givePossession('user', r.next); } }, 'dim');
  }

  simRest() {
    this.paused = false; this.saved = null; this.timers = []; this.closePanel();
    if (this.state === 'final') return;
    const uOff = this.user.offRating, oOff = this.opp.offRating + this.diff * 4;
    if (!this.ot) {
      const rem = this.clock + (4 - this.q) * this.Q;
      const n = Math.max(1, Math.round(rem / (this.Q * 0.42)));
      let userBall = true;
      for (let i = 0; i < n; i++) {
        if (userBall) this.score.user += simDrive(uOff, this.opp.defRating, 25).pts;
        else this.score.opp += simDrive(oOff, this.user.defRating, 25).pts;
        userBall = !userBall;
      }
      this.q = 4; this.clock = 0;
    }
    let rounds = 0;
    while (this.score.user === this.score.opp && (this.playoff || rounds < 2)) {
      rounds++; this.ot = this.ot || { round: 1 };
      this.score.user += simDrive(uOff, this.opp.defRating, 25).pts;
      this.score.opp += simDrive(oOff, this.user.defRating, 25).pts;
      if (rounds > 8 && this.score.user === this.score.opp) { if (Math.random() < 0.5) this.score.user += 3; else this.score.opp += 3; }
    }
    this.finish();
  }

  finish() {
    if (this.state === 'final') return;
    this.state = 'final';
    this.runBtn.classList.add('hidden');
    const u = this.score.user, o = this.score.opp;
    const res = u > o ? 'VICTORY' : u < o ? 'DEFEAT' : 'TIE';
    const lines = [];
    const qb = this.user.off.QB, s = this.stats[qb.id];
    if (s && s.pa) lines.push(`${short(qb)}: ${s.pc || 0}/${s.pa} · ${s.py || 0} YDS · ${s.ptd || 0} TD · ${s.pint || 0} INT`);
    let rb = null, rbY = -1e9, wr = null, wrY = -1e9;
    for (const id in this.stats) {
      const st = this.stats[id], p = this.pmap[id];
      if (!p) continue;
      if ((st.ra || 0) > 0 && (st.ry || 0) > rbY && p !== qb) { rbY = st.ry || 0; rb = p; }
      if ((st.rec || 0) > 0 && (st.recy || 0) > wrY) { wrY = st.recy || 0; wr = p; }
    }
    if (rb) { const st = this.stats[rb.id]; lines.push(`${short(rb)}: ${st.ra} CAR · ${st.ry || 0} YDS · ${st.rtd || 0} TD`); }
    if (wr) { const st = this.stats[wr.id]; lines.push(`${short(wr)}: ${st.rec} REC · ${st.recy || 0} YDS · ${st.rectd || 0} TD`); }
    this.panel(`<div class="card final"><h2 class="${res === 'VICTORY' ? 'win' : res === 'DEFEAT' ? 'loss' : ''}">${res}</h2>
      <div class="sb">${this.scoreline()}</div><p class="small">FINAL${this.ot ? ' / OT' : ''}</p>
      ${lines.map((l) => `<p class="small">${esc(l)}</p>`).join('')}
      <button class="btn big" data-act="done">CONTINUE</button></div>`,
      { done: () => { this.closePanel(); this.onEnd({ user: u, opp: o, ot: !!this.ot, stats: this.stats, players: this.userPlayers().map((p) => p.id) }); } }, 'dim');
  }

  // ---------------- input ----------------
  pointer(type, x, y, id) {
    if (this.paused) return;
    const I = this.input;
    if (type === 'down') {
      if (I.id != null) return;
      Object.assign(I, { id, sx: x, sy: y, x, y, t: performance.now(), mode: null });
      if (this.state !== 'live') return;
      if (this.ball.holder === this.qb && !this.carrier && !this.thrown) { I.mode = 'aim'; this.aim = true; this.hints.aim++; }
      else if (this.carrier) { I.mode = 'steer'; this.steerY = (y - TOP) / SY; }
      return;
    }
    if (id !== I.id) return;
    if (type === 'move') {
      I.x = x; I.y = y;
      if (this.state !== 'live') return;
      if (I.mode == null && this.carrier) I.mode = 'steer';
      if (I.mode === 'steer') {
        const el = performance.now() - I.t, dx = x - I.sx, dy = y - I.sy;
        if (el < 230 && Math.hypot(dx, dy) > 22) { this.move(dx, dy); I.mode = 'done'; this.steerY = null; }
        else this.steerY = (y - TOP) / SY;
      }
      return;
    }
    // up / cancel
    if (I.mode === 'aim' && type === 'up' && this.state === 'live' && this.ball.holder === this.qb && !this.carrier) {
      const len = Math.hypot(I.x - I.sx, I.y - I.sy);
      if (this.settings.aim === 'direct' || len >= 12) this.throwBall(this.aimTarget());
    }
    I.id = null; I.mode = null; this.aim = null; this.steerY = null;
    if (this.carrier) this.hints.run++;
  }
  move(dx, dy) {
    const c = this.carrier;
    if (!c || c.cd > 0 || c.dive > 0) return;
    if (Math.abs(dy) > Math.abs(dx)) { c.juke = 0.26; c.jdir = Math.sign(dy); c.immune = Math.max(c.immune, 0.3); c.cd = 0.8; this.popup('JUKE', c); }
    else if (dx > 0) { c.dive = 0.32; this.popup('DIVE', c); }
    else { c.spin = 0.45; c.immune = Math.max(c.immune, 0.35); c.cd = 1.1; this.popup('SPIN', c); }
    sfx.juke();
  }

  // ---------------- rendering ----------------
  render(ctx, view) {
    this.viewW = view.w;
    const W = view.w, cam = this.camX;
    const wx = (x) => Math.round((x - cam) * SX), wy = (y) => Math.round(TOP + y * SY);
    const FH = Math.round(FW * SY);
    ctx.fillStyle = '#2a5d27'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#23501f';
    for (let i = -((cam * SX) % 16 + 16) | 0; i < W; i += 16) { ctx.fillRect(i, TOP - 5, 8, 4); ctx.fillRect(i + 8, TOP + FH + 2, 8, 4); }
    ctx.drawImage(this.field, wx(0), TOP);
    const showLines = this.state === 'presnap' || this.state === 'live' || this.state === 'dead';
    if (showLines) {
      ctx.fillStyle = 'rgba(90,170,255,0.95)'; ctx.fillRect(wx(this.los), TOP, 1, FH);
      if (!this.conv && this.fdX < 110) { ctx.fillStyle = '#f7d43a'; ctx.fillRect(wx(this.fdX), TOP, 2, FH); }
    }
    drawGoalPost(ctx, wx(0), wy(MID), Math.round(3.08 * SY));
    // landing marker
    const b = this.ball;
    if (b.air) this.ring(ctx, wx(b.air.tx), wy(b.air.ty), 'rgba(255,255,255,0.55)');
    // players
    const list = this.all.slice().sort((p, q) => p.y - q.y);
    const openness = this.state === 'live' && b.holder === this.qb && !this.carrier && !this.thrown;
    for (const e of list) {
      const moving = Math.hypot(e.vx, e.vy) > 0.4;
      const frame = e.down ? 'down' : moving ? ((e.anim | 0) % 2 ? 'run1' : 'run2') : 'stand';
      const sx = wx(e.x), sy = wy(e.y);
      drawPlayer(ctx, e.side === 'off' ? this.kitU : this.kitO, e.skin, frame, e.face, sx, sy);
      if (openness && e.task === 'route') {
        let nd = 99;
        for (const d of this.def) nd = Math.min(nd, dist(d, e));
        ctx.fillStyle = nd > 3 ? '#3dff6a' : nd > 1.6 ? '#ffd23d' : '#ff4d4d';
        ctx.fillRect(sx - 2, sy - 20, 4, 3);
      }
    }
    drawGoalPost(ctx, wx(120), wy(MID), Math.round(3.08 * SY));
    // carrier marker
    if (this.carrier && this.state === 'live') {
      const sx = wx(this.carrier.x), sy = wy(this.carrier.y) - 20;
      ctx.fillStyle = '#f7d43a';
      ctx.fillRect(sx - 2, sy, 5, 1); ctx.fillRect(sx - 1, sy + 1, 3, 1); ctx.fillRect(sx, sy + 2, 1, 1);
    }
    // ball
    if (this.state === 'live' || this.state === 'dead' || this.state === 'kick' || this.state === 'presnap') {
      const bx = wx(b.x), by = wy(b.y);
      if (!b.holder || b.air) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(bx - 1, by, 3, 1); }
      drawBall(ctx, bx, by - Math.round(b.z * ZPX) - (b.holder ? 6 : 0));
    }
    if (this.aim && this.input.mode === 'aim') this.drawAim(ctx, wx, wy);
    // popups
    for (const p of this.popups) drawTextC(ctx, p.text, wx(p.x), wy(p.y) - 34 + Math.round(p.t * 10), 2, '#fff', '#000');
    // hints (first few plays only)
    if (this.state === 'live') {
      if (this.ball.holder === this.qb && !this.carrier && !this.thrown && this.play.type !== 'run' && this.hints.aim < 3) {
        drawTextC(ctx, this.settings.aim === 'direct' ? 'TOUCH A SPOT TO THROW THERE' : 'DRAG BACK TO AIM, RELEASE TO THROW', W / 2, TOP + 5, 2, '#fff', '#000');
        drawTextC(ctx, 'GREEN = OPEN  ·  QB RUN BUTTON TO SCRAMBLE', W / 2, TOP + 18, 2, '#cfe', '#000');
      } else if (this.carrier && this.hints.run < 3) {
        drawTextC(ctx, 'HOLD ABOVE/BELOW RUNNER TO STEER', W / 2, TOP + 5, 2, '#fff', '#000');
        drawTextC(ctx, 'SWIPE UP/DOWN JUKE - RIGHT DIVE - LEFT SPIN', W / 2, TOP + 18, 2, '#cfe', '#000');
      }
    }
    this.drawHud(ctx, W);
  }
  ring(ctx, x, y, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x - 3, y - 1, 2, 2); ctx.fillRect(x + 2, y - 1, 2, 2);
    ctx.fillRect(x - 1, y - 3, 2, 1); ctx.fillRect(x - 1, y + 2, 2, 1);
  }
  drawAim(ctx, wx, wy) {
    const qb = this.qb, tg = this.aimTarget();
    const d = Math.hypot(tg.x - qb.x, tg.y - qb.y), h = Math.min(9, 0.6 + d * 0.17);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 1; i < 16; i++) {
      const f = i / 16;
      const x = qb.x + (tg.x - qb.x) * f, y = qb.y + (tg.y - qb.y) * f, z = 4 * h * f * (1 - f) + 1.6 * (1 - f);
      ctx.fillRect(wx(x), wy(y) - Math.round(z * ZPX) - 6, 2, 2);
    }
    this.ring(ctx, wx(tg.x), wy(tg.y), '#f7d43a');
    // highlight receiver nearest target
    let best = null, bd = 4;
    for (const r of this.recv) { const dd = Math.hypot(r.x - tg.x, r.y - tg.y); if (dd < bd) { bd = dd; best = r; } }
    if (best) { ctx.fillStyle = '#f7d43a'; ctx.fillRect(wx(best.x) - 5, wy(best.y) + 1, 11, 1); }
  }
  drawHud(ctx, W) {
    ctx.fillStyle = 'rgba(8,12,22,0.94)'; ctx.fillRect(0, 0, W, 24);
    ctx.fillStyle = '#f7c948'; ctx.fillRect(0, 24, W, 1);
    const cx = Math.round(W / 2);
    const chip = (x, t, score, right) => {
      ctx.fillStyle = t.colors.p; ctx.fillRect(x, 3, 36, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, 19, 36, 2);
      drawTextC(ctx, t.abbr, x + 18, 7, 2, t.colors.s, 'rgba(0,0,0,0.4)');
      const s = String(score);
      drawText(ctx, s, right ? x - 6 - textWidth(s, 2) : x + 42, 7, 2, '#fff', '#000');
    };
    chip(cx - 128, this.user, this.score.user, false);
    chip(cx + 92, this.opp, this.score.opp, true);
    drawTextC(ctx, this.ot ? 'OT' : `Q${this.q}  ${fmtClock(this.clock)}`, cx, 7, 2, '#f7c948', '#000');
    // bottom strip
    const by = TOP + Math.round(FW * SY) + 3;
    if (this.state === 'presnap' || this.state === 'live' || this.state === 'dead') drawTextC(ctx, this.situation(), cx, Math.min(by, H - 12), 2, '#fff', '#000');
    if (this.toastMsg) drawTextC(ctx, this.toastMsg.text, cx, 34, 2, '#f7c948', '#000');
    if (this.banner) {
      const bn = this.banner, y = 96;
      ctx.fillStyle = 'rgba(8,12,22,0.75)'; ctx.fillRect(0, y - 8, W, bn.sub ? 52 : 38);
      drawTextC(ctx, bn.text, cx, y, 4, bn.color, '#000');
      if (bn.sub) drawTextC(ctx, bn.sub, cx, y + 28, 2, '#fff', '#000');
    }
  }
}
