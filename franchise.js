// Franchise mode: league, rosters, season, playoffs, draft, development, contracts.
import { TEAMS, FIRST, LAST } from './data.js';
import { clamp, randi, randn, pick, shuffle } from './util.js';
import { simGame } from './sim.js';

export const POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K'];
export const NEED = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, DB: 4, K: 1 };
export const TEMPLATE = { QB: 2, RB: 2, WR: 4, TE: 2, OL: 6, DL: 5, LB: 4, DB: 5, K: 1 };
export const ROSTER_MAX = 34, CAP = 125, SEASON_START_YEAR = 2027;
export const WEIGHTS = {
  QB: { arm: 0.35, acc: 0.45, spd: 0.1, agi: 0.1 }, RB: { spd: 0.35, agi: 0.3, str: 0.2, hnd: 0.15 },
  WR: { spd: 0.4, hnd: 0.4, agi: 0.2 }, TE: { hnd: 0.35, blk: 0.35, spd: 0.15, str: 0.15 },
  OL: { blk: 0.7, str: 0.3 }, DL: { tkl: 0.5, str: 0.3, spd: 0.2 }, LB: { tkl: 0.45, cov: 0.25, spd: 0.3 },
  DB: { cov: 0.5, spd: 0.35, tkl: 0.15 }, K: { kpw: 0.5, kac: 0.5 },
};
export const ATTRS = ['spd', 'agi', 'str', 'hnd', 'arm', 'acc', 'blk', 'tkl', 'cov', 'kpw', 'kac'];
export const ATTR_NAMES = { spd: 'SPEED', agi: 'AGILITY', str: 'STRENGTH', hnd: 'HANDS', arm: 'ARM', acc: 'ACCURACY', blk: 'BLOCKING', tkl: 'TACKLING', cov: 'COVERAGE', kpw: 'KICK POWER', kac: 'KICK ACC' };
export const ROUND_NAMES = ['QUARTERFINALS', 'SEMIFINALS', 'POCKET BOWL'];
const NUMS = { QB: [1, 19], RB: [20, 49], WR: [10, 19, 80, 89], TE: [80, 89], OL: [60, 79], DL: [90, 99], LB: [40, 59], DB: [20, 39], K: [1, 9] };

export const blankStats = () => ({ g: 0, pa: 0, pc: 0, py: 0, ptd: 0, pint: 0, ra: 0, ry: 0, rtd: 0, rec: 0, recy: 0, rectd: 0, sck: 0, dint: 0 });

export function calcOvr(p) {
  const w = WEIGHTS[p.pos];
  let s = 0;
  for (const k in w) s += p.attrs[k] * w[k];
  return Math.round(s);
}
export function salaryFor(p) {
  let s = 0.6 + Math.pow(Math.max(0, p.ovr - 45) / 54, 2.2) * 18;
  if (p.pos === 'QB') s *= 1.5;
  if (p.pos === 'K') s *= 0.4;
  if (p.pos === 'OL') s *= 0.8;
  if (p.age > 31) s *= 0.8;
  return Math.round(s * 10) / 10;
}

export function genPlayer(L, pos, target, age) {
  const attrs = {};
  for (const k of ATTRS) attrs[k] = randi(25, 50);
  attrs.spd = randi(42, 70); attrs.agi = randi(42, 70); attrs.str = randi(42, 70);
  if (pos === 'OL' || pos === 'DL') { attrs.spd = randi(35, 58); attrs.str = randi(60, 85); }
  if (pos === 'K') attrs.spd = randi(30, 50);
  for (const k in WEIGHTS[pos]) attrs[k] = clamp(Math.round(target + randn() * 5), 25, 99);
  const p = {
    id: L.nextId++, first: pick(FIRST), last: pick(LAST), pos, age: age ?? randi(22, 32), attrs,
    num: 0, skin: randi(0, 4), pot: 0, ovr: 0, contract: null, stats: blankStats(), career: blankStats(), seasons: 0, teamId: null,
  };
  p.seasons = Math.max(0, p.age - 22);
  p.ovr = calcOvr(p);
  p.pot = clamp(Math.round(p.ovr + Math.max(0, 27 - p.age) * randi(1, 4) + randi(0, 5)), p.ovr, 99);
  p.contract = { sal: salaryFor(p), yrs: randi(1, 4) };
  L.players[p.id] = p;
  return p;
}

function assignNumber(L, team, p) {
  const used = new Set(team.roster.map((id) => L.players[id].num));
  const r = NUMS[p.pos];
  for (let tries = 0; tries < 60; tries++) {
    const seg = r.length > 2 && Math.random() < 0.5 ? 2 : 0;
    const n = randi(r[seg], r[seg + 1]);
    if (!used.has(n)) { p.num = n; return; }
  }
  for (let n = 1; n < 100; n++) if (!used.has(n)) { p.num = n; return; }
}
export function addToTeam(L, p, team) {
  p.teamId = team.id;
  team.roster.push(p.id);
  assignNumber(L, team, p);
}
export function removeFromTeam(L, p) {
  const t = L.teams[p.teamId];
  if (t) t.roster = t.roster.filter((id) => id !== p.id);
  p.teamId = null;
}

export function makeSchedule(n) {
  const ids = [...Array(n).keys()];
  const weeks = [];
  for (let r = 0; r < n - 1; r++) {
    const wk = [];
    for (let i = 0; i < n / 2; i++) {
      const x = ids[i], y = ids[n - 1 - i];
      wk.push((r + i) % 2 ? { h: x, a: y, hs: null, as: null } : { h: y, a: x, hs: null, as: null });
    }
    weeks.push(wk);
    ids.splice(1, 0, ids.pop());
  }
  return shuffle(weeks);
}

export function newLeague(userTeamId) {
  const L = {
    app: 'pocket-gridiron', version: 1, season: 1, year: SEASON_START_YEAR, userTeamId, phase: 'regular', week: 0,
    teams: [], players: {}, nextId: 1, credits: 6, history: [], news: [], playoffs: null, draft: null, fa: [], schedule: [],
  };
  TEAMS.forEach((t, i) => {
    const team = { id: i, city: t.city, name: t.name, abbr: t.abbr, colors: { ...t.colors }, roster: [], w: 0, l: 0, t: 0, pf: 0, pa: 0, titles: 0 };
    L.teams.push(team);
    const base = randi(57, 75);
    for (const pos of POS) for (let k = 0; k < TEMPLATE[pos]; k++) {
      const tgt = base + (k < NEED[pos] ? 0 : -9) + randi(-7, 7);
      addToTeam(L, genPlayer(L, pos, tgt), team);
    }
  });
  // keep everyone under the cap
  for (const t of L.teams) {
    let pay = payroll(L, t);
    if (pay > CAP - 8) {
      const f = (CAP - 8) / pay;
      for (const id of t.roster) L.players[id].contract.sal = Math.max(0.5, Math.round(L.players[id].contract.sal * f * 10) / 10);
    }
  }
  L.schedule = makeSchedule(L.teams.length);
  return L;
}

export const teamPlayers = (L, t) => t.roster.map((id) => L.players[id]).filter(Boolean);
export const payroll = (L, t) => Math.round(teamPlayers(L, t).reduce((s, p) => s + p.contract.sal, 0) * 10) / 10;

function tempPlayer(pos, k) {
  const attrs = {};
  for (const a of ATTRS) attrs[a] = 40;
  const p = { id: `tmp-${pos}-${k}`, first: 'Practice', last: 'Squad', pos, age: 24, attrs, num: 0, skin: k % 5, pot: 40, ovr: 40, temp: true };
  return p;
}
export function starters(L, t) {
  const by = {};
  for (const pos of POS) by[pos] = [];
  for (const p of teamPlayers(L, t)) by[p.pos].push(p);
  const out = {};
  for (const pos of POS) {
    const list = by[pos].sort((a, b) => b.ovr - a.ovr).slice(0, NEED[pos]);
    while (list.length < NEED[pos]) list.push(tempPlayer(pos, list.length));
    out[pos] = list;
  }
  return out;
}
const avg = (a) => a.reduce((s, p) => s + p.ovr, 0) / a.length;
export function ratings(L, t) {
  const s = starters(L, t);
  const off = (s.QB[0].ovr * 3 + s.RB[0].ovr + avg(s.WR) * 3 + s.TE[0].ovr + avg(s.OL) * 3) / 11;
  const def = (avg(s.DL) * 3 + avg(s.LB) * 2 + avg(s.DB) * 3) / 8;
  return { off: Math.round(off), def: Math.round(def), ovr: Math.round((off + def) / 2) };
}
export function buildMatchTeam(L, id) {
  const t = L.teams[id], s = starters(L, t), r = ratings(L, t);
  return {
    id, city: t.city, name: t.name, abbr: t.abbr, colors: t.colors,
    off: { QB: s.QB[0], RB: s.RB[0], WR: s.WR, TE: s.TE[0], OL: s.OL, K: s.K[0] },
    def: { DL: s.DL, LB: s.LB, DB: s.DB },
    offRating: r.off, defRating: r.def,
  };
}

// ---------------- season ----------------
export const record = (t) => `${t.w}-${t.l}${t.t ? '-' + t.t : ''}`;
export function standings(L) {
  return L.teams.slice().sort((a, b) => {
    const pa = (a.w + a.t * 0.5) / Math.max(1, a.w + a.l + a.t), pb = (b.w + b.t * 0.5) / Math.max(1, b.w + b.l + b.t);
    return pb - pa || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf;
  });
}
export function userGame(L) {
  if (L.phase === 'regular') return L.schedule[L.week]?.find((g) => g.h === L.userTeamId || g.a === L.userTeamId) || null;
  if (L.phase === 'playoffs') {
    const r = L.playoffs.rounds[L.playoffs.round];
    return r?.find((g) => g.hs == null && (g.h === L.userTeamId || g.a === L.userTeamId)) || null;
  }
  return null;
}
function applyResult(L, g, hs, as, ot, counts = true) {
  g.hs = hs; g.as = as; g.ot = ot;
  if (!counts) return;
  const h = L.teams[g.h], a = L.teams[g.a];
  h.pf += hs; h.pa += as; a.pf += as; a.pa += hs;
  if (hs > as) { h.w++; a.l++; } else if (as > hs) { a.w++; h.l++; } else { h.t++; a.t++; }
}
function simOne(L, g, allowTie) {
  const rh = ratings(L, L.teams[g.h]), ra = ratings(L, L.teams[g.a]);
  const r = simGame(rh.off, rh.def, ra.off, ra.def, allowTie);
  return r;
}
// Merge per-game stats from the engine into season stats
function mergeStats(L, res) {
  if (!res.stats) return;
  for (const id of res.players || []) { const p = L.players[id]; if (p) p.stats.g++; }
  for (const id in res.stats) {
    const p = L.players[id];
    if (!p) continue;
    for (const k in res.stats[id]) p.stats[k] = (p.stats[k] || 0) + res.stats[id][k];
  }
}
// res = { user, opp, ot, stats } from the engine, or a simulated result
export function recordUserGame(L, res) {
  const g = userGame(L);
  if (!g) return;
  const home = g.h === L.userTeamId;
  const hs = home ? res.user : res.opp, as = home ? res.opp : res.user;
  mergeStats(L, res);
  const won = res.user > res.opp, tie = res.user === res.opp;
  if (L.phase === 'regular') {
    applyResult(L, g, hs, as, res.ot);
    L.credits += won ? 2 : 1;
    for (const og of L.schedule[L.week]) if (og !== g) { const r = simOne(L, og, true); applyResult(L, og, r.hs, r.as, r.ot); }
    L.week++;
    if (L.week >= L.schedule.length) startPlayoffs(L);
  } else if (L.phase === 'playoffs') {
    applyResult(L, g, hs, as, res.ot, false);
    if (won) L.credits += 3;
    advancePlayoffs(L);
  }
  return { won, tie };
}
export function simUserGame(L) {
  const g = userGame(L);
  const r = simOne(L, g, L.phase === 'regular');
  const home = g.h === L.userTeamId;
  return { user: home ? r.hs : r.as, opp: home ? r.as : r.hs, ot: r.ot, stats: null };
}

// ---------------- playoffs ----------------
export function startPlayoffs(L) {
  const seeds = standings(L).slice(0, 8).map((t) => t.id);
  L.phase = 'playoffs';
  L.playoffs = { seeds, round: 0, rounds: [[0, 7, 3, 4, 1, 6, 2, 5].reduce((acc, s, i, arr) => (i % 2 ? acc : [...acc, { h: seeds[s], a: seeds[arr[i + 1]], hs: null, as: null }]), [])], champion: null };
  L.news.unshift(`Playoffs set: #1 ${L.teams[seeds[0]].name} lead the field.`);
}
export const userInPlayoffs = (L) => !!L.playoffs && !!userGame(L);
export function advancePlayoffs(L) {
  const P = L.playoffs;
  const round = P.rounds[P.round];
  for (const g of round) if (g.hs == null) { const r = simOne(L, g, false); applyResult(L, g, r.hs, r.as, r.ot, false); }
  const winners = round.map((g) => (g.hs > g.as ? g.h : g.a));
  if (winners.length === 1) {
    P.champion = winners[0];
    L.teams[P.champion].titles++;
    const userWon = P.champion === L.userTeamId;
    if (userWon) L.credits += 5;
    const ut = L.teams[L.userTeamId];
    const reached = P.seeds.includes(L.userTeamId) ? (userWon ? 'CHAMPIONS' : P.rounds.reduce((s, r, i) => (r.some((g) => g.h === L.userTeamId || g.a === L.userTeamId) ? ROUND_NAMES[i] : s), '')) : 'MISSED PLAYOFFS';
    L.history.push({ season: L.season, year: L.year, champion: P.champion, record: record(ut), result: userWon ? 'CHAMPIONS' : reached === 'MISSED PLAYOFFS' ? reached : 'LOST IN ' + reached });
    L.phase = 'recap';
    return;
  }
  P.round++;
  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i], b = winners[i + 1];
    const sa = P.seeds.indexOf(a), sb = P.seeds.indexOf(b);
    next.push(sa < sb ? { h: a, a: b, hs: null, as: null } : { h: b, a: a, hs: null, as: null });
  }
  P.rounds.push(next);
}

// ---------------- development ----------------
export function trainCost(p, k) { const v = p.attrs[k]; return v < 60 ? 1 : v < 75 ? 2 : v < 88 ? 3 : 4; }
export function train(L, p, k) {
  const cost = trainCost(p, k);
  if (L.credits < cost || p.attrs[k] >= 99) return 0;
  let gain = randi(2, 4) + (p.age <= 24 ? 1 : 0);
  if (p.ovr >= p.pot) gain = 1;
  p.attrs[k] = Math.min(99, p.attrs[k] + gain);
  L.credits -= cost;
  p.ovr = calcOvr(p);
  p.pot = Math.max(p.pot, p.ovr);
  return gain;
}
function progress(p) {
  let delta;
  if (p.age <= 24) delta = randi(1, 5) + (p.pot - p.ovr > 10 ? 2 : 0);
  else if (p.age <= 28) delta = randi(-1, 3);
  else if (p.age <= 31) delta = randi(-3, 1);
  else delta = randi(-6, -1);
  if (p.ovr >= p.pot && delta > 0) delta = Math.random() < 0.5 ? 1 : 0;
  const before = p.ovr;
  for (const k in WEIGHTS[p.pos]) p.attrs[k] = clamp(p.attrs[k] + delta + randi(-1, 1), 25, 99);
  if (p.age >= 30) p.attrs.spd = clamp(p.attrs.spd - randi(0, 3), 25, 99);
  p.age++;
  p.ovr = calcOvr(p);
  p.pot = p.age >= 29 ? Math.max(p.ovr, p.pot - 2) : Math.max(p.pot, p.ovr);
  return p.ovr - before;
}

// ---------------- offseason ----------------
export function beginOffseason(L) {
  const user = L.teams[L.userTeamId];
  const notes = [];
  // stats -> career
  for (const id in L.players) {
    const p = L.players[id];
    if (p.teamId == null) continue;
    for (const k in p.stats) p.career[k] = (p.career[k] || 0) + p.stats[k];
    if (p.stats.g) p.seasons++;
    p.stats = blankStats();
  }
  // progression and retirement
  for (const t of L.teams) {
    for (const p of teamPlayers(L, t)) {
      const d = progress(p);
      if (t.id === L.userTeamId && Math.abs(d) >= 3) notes.push(`${p.pos} ${p.first} ${p.last} ${d > 0 ? 'improved' : 'declined'} ${d > 0 ? '+' : ''}${d} OVR (now ${p.ovr}).`);
      const retire = (p.age >= 34 && Math.random() < 0.35 + (p.age - 34) * 0.2) || (p.age >= 31 && p.ovr < 52 && Math.random() < 0.5) || p.age >= 39;
      if (retire && p.pos !== 'K' || (p.pos === 'K' && p.age >= 39)) {
        if (t.id === L.userTeamId) notes.push(`${p.pos} ${p.first} ${p.last} retired at ${p.age}.`);
        removeFromTeam(L, p); delete L.players[p.id];
      }
    }
  }
  // contracts
  L.fa = [];
  for (const t of L.teams) for (const p of teamPlayers(L, t)) {
    p.contract.yrs--;
    if (p.contract.yrs > 0) continue;
    if (t.id === L.userTeamId) { p.ask = Math.round(salaryFor(p) * (1 + Math.random() * 0.25) * 10) / 10; continue; }
    if (p.ovr >= 58 && p.age <= 32 && Math.random() < (p.ovr >= 75 ? 0.92 : 0.75)) p.contract = { sal: salaryFor(p), yrs: randi(1, 4) };
    else { removeFromTeam(L, p); L.fa.push(p.id); }
  }
  L.phase = 'resign';
  L.offseasonNotes = notes;
  return notes;
}
export const expiring = (L) => teamPlayers(L, L.teams[L.userTeamId]).filter((p) => p.contract.yrs <= 0);
export function resign(L, p) {
  const t = L.teams[L.userTeamId];
  if (payroll(L, t) - p.contract.sal + p.ask > CAP) return false;
  p.contract = { sal: p.ask, yrs: randi(2, 4) };
  delete p.ask;
  return true;
}
export function release(L, p) {
  removeFromTeam(L, p);
  delete p.ask;
  if (L.phase === 'freeagency' || L.phase === 'resign' || L.phase === 'draft') { p.contract = { sal: salaryFor(p), yrs: randi(1, 3) }; L.fa.push(p.id); }
  else delete L.players[p.id];
}

export function startDraft(L) {
  for (const p of expiring(L)) { removeFromTeam(L, p); delete p.ask; L.fa.push(p.id); }
  const prospects = [];
  for (let i = 0; i < 64; i++) {
    const pos = pick(['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'DB', 'DB', 'DB', 'K']);
    const p = genPlayer(L, pos, randi(42, 68), randi(21, 23));
    p.pot = clamp(p.ovr + randi(4, 30), p.ovr, 97);
    p.prospect = true; p.scouted = false; p.seasons = 0;
    p.est = [clamp(p.ovr - randi(2, 9), 30, 99), clamp(p.ovr + randi(2, 9), 30, 99)];
    p.potEst = clamp(p.pot + randi(-8, 8), p.ovr, 99);
    prospects.push(p.id);
  }
  // order: worst record first, champion last
  const P = L.playoffs;
  const order0 = standings(L).reverse().map((t) => t.id);
  if (P?.champion != null) {
    const fin = P.rounds[P.rounds.length - 1][0];
    const runner = fin.hs > fin.as ? fin.a : fin.h;
    for (const id of [runner, P.champion]) { order0.splice(order0.indexOf(id), 1); order0.push(id); }
  }
  L.draft = { order: [...order0, ...order0, ...order0], pick: 0, prospects, log: [] };
  L.phase = 'draft';
}
function needScore(L, t, pos) {
  const have = teamPlayers(L, t).filter((p) => p.pos === pos).length;
  if (pos === 'K') return have ? -20 : 15;
  return have < NEED[pos] ? 12 : have < TEMPLATE[pos] ? 4 : -6;
}
function draftPlayer(L, teamId, pid) {
  const D = L.draft, p = L.players[pid], t = L.teams[teamId];
  const rnd = Math.floor(D.pick / L.teams.length);
  D.prospects = D.prospects.filter((x) => x !== pid);
  delete p.prospect; delete p.est; delete p.potEst; p.scouted = true;
  p.contract = { sal: [1.6, 0.9, 0.6][rnd] + (rnd === 0 ? Math.max(0, (16 - (D.pick % 16)) * 0.08) : 0), yrs: rnd === 0 ? 4 : 3 };
  p.contract.sal = Math.round(p.contract.sal * 10) / 10;
  addToTeam(L, p, t);
  D.log.push({ pick: D.pick, teamId, pid });
  D.pick++;
}
export function aiPick(L) {
  const D = L.draft, tid = D.order[D.pick], t = L.teams[tid];
  let best = null, bs = -1e9;
  for (const id of D.prospects) {
    const p = L.players[id];
    const s = p.ovr * 0.55 + p.pot * 0.45 + needScore(L, t, p.pos) + Math.random() * 6;
    if (s > bs) { bs = s; best = id; }
  }
  draftPlayer(L, tid, best);
}
export const onTheClock = (L) => L.draft && L.draft.pick < L.draft.order.length ? L.draft.order[L.draft.pick] : null;
export function simToUserPick(L) {
  while (L.draft.pick < L.draft.order.length && onTheClock(L) !== L.userTeamId) aiPick(L);
}
export function userDraft(L, pid) {
  if (onTheClock(L) !== L.userTeamId) return false;
  if (L.teams[L.userTeamId].roster.length >= ROSTER_MAX) return false;
  draftPlayer(L, L.userTeamId, pid);
  return true;
}
export function skipUserPick(L) { if (onTheClock(L) === L.userTeamId) L.draft.pick++; }
export function scout(L, p) {
  if (L.credits < 1 || p.scouted) return false;
  L.credits--; p.scouted = true; return true;
}
export function finishDraft(L) {
  while (L.draft.pick < L.draft.order.length) { if (onTheClock(L) === L.userTeamId) L.draft.pick++; else aiPick(L); }
  for (const id of L.draft.prospects) {
    const p = L.players[id];
    delete p.prospect; delete p.est; delete p.potEst;
    p.contract = { sal: 0.5, yrs: 2 };
    L.fa.push(id);
  }
  L.draft.prospects = [];
  for (let i = 0; i < 12; i++) L.fa.push(genPlayer(L, pick(POS), randi(48, 68), randi(24, 31)).id);
  for (const id of L.fa) { const p = L.players[id]; if (p) p.ask = Math.max(0.5, salaryFor(p)); }
  L.phase = 'freeagency';
}
export function signFA(L, p) {
  const t = L.teams[L.userTeamId];
  if (t.roster.length >= ROSTER_MAX) return 'Roster full (34 max).';
  if (payroll(L, t) + p.ask > CAP) return 'Not enough cap space.';
  p.contract = { sal: p.ask, yrs: randi(1, 3) };
  delete p.ask;
  L.fa = L.fa.filter((id) => id !== p.id);
  addToTeam(L, p, t);
  return '';
}
export function startNewSeason(L) {
  const notes = [];
  // AI teams fill needs from free agents, trim extras
  for (const t of L.teams) {
    const isUser = t.id === L.userTeamId;
    for (const pos of POS) {
      let have = teamPlayers(L, t).filter((p) => p.pos === pos).length;
      const want = isUser ? NEED[pos] : TEMPLATE[pos];
      while (have < want) {
        let pid = null;
        if (!isUser) {
          const pool = L.fa.map((id) => L.players[id]).filter((p) => p && p.pos === pos).sort((a, b) => b.ovr - a.ovr);
          if (pool.length) pid = pool[0].id;
        }
        let p;
        if (pid != null) { p = L.players[pid]; L.fa = L.fa.filter((x) => x !== pid); }
        else { p = genPlayer(L, pos, isUser ? randi(42, 48) : randi(50, 62), randi(23, 29)); p.contract.sal = isUser ? 0.5 : p.contract.sal; }
        delete p.ask;
        p.contract.yrs = Math.max(1, p.contract.yrs);
        addToTeam(L, p, t);
        if (isUser) notes.push(`Signed replacement ${pos} ${p.first} ${p.last} (${p.ovr} OVR) to fill an empty starting spot.`);
        have++;
      }
    }
    if (!isUser) {
      const list = teamPlayers(L, t).sort((a, b) => a.ovr - b.ovr);
      while (t.roster.length > ROSTER_MAX - 2) { const p = list.shift(); removeFromTeam(L, p); delete L.players[p.id]; }
    }
  }
  // unsigned free agents leave the league
  for (const id of L.fa) { const p = L.players[id]; if (p && p.teamId == null) delete L.players[id]; }
  L.fa = [];
  for (const id in L.players) { const p = L.players[id]; if (p.teamId == null && !p.prospect) delete L.players[id]; }
  for (const t of L.teams) { t.w = t.l = t.t = t.pf = t.pa = 0; }
  L.season++; L.year++; L.week = 0; L.phase = 'regular';
  L.playoffs = null; L.draft = null;
  L.schedule = makeSchedule(L.teams.length);
  L.credits += 2;
  L.news.unshift(`Season ${L.season} (${L.year}) begins!`);
  L.news = L.news.slice(0, 20);
  return notes;
}

export function leagueSummary(L) {
  const t = L.teams[L.userTeamId];
  return { team: `${t.city} ${t.name}`, abbr: t.abbr, colors: t.colors, season: L.season, year: L.year, record: record(t), phase: L.phase, week: L.week, titles: t.titles };
}
