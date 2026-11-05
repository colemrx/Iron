// Menus and franchise screens (DOM). The canvas renders the game itself.
import { esc, stars, grade, money } from './util.js';
import * as F from './franchise.js';
import * as S from './storage.js';
import { sfx } from './audio.js';

const chip = (t, extra = '') => `<span class="chip ${extra}" style="background:${t.colors.p};color:${t.colors.s}">${esc(t.abbr)}</span>`;
const pname = (p) => `${esc(p.first)} ${esc(p.last)}`;

function statLine(p, s) {
  const g = (k) => s[k] || 0;
  switch (p.pos) {
    case 'QB': return `${g('pc')}/${g('pa')} · ${g('py')} YDS · ${g('ptd')} TD · ${g('pint')} INT · ${g('ry')} RUSH YDS`;
    case 'RB': return `${g('ra')} CAR · ${g('ry')} YDS · ${g('rtd')} TD · ${g('rec')} REC · ${g('recy')} YDS`;
    case 'WR': case 'TE': return `${g('rec')} REC · ${g('recy')} YDS · ${g('rectd')} TD`;
    case 'DL': case 'LB': case 'DB': return `${g('sck')} SACKS · ${g('dint')} TAKEAWAYS`;
    default: return `${g('g')} GAMES`;
  }
}

export function createUI(root, app) {
  let handlers = {}, modalHandlers = {};
  let L = null, slot = null, quickLeague = null;
  let rosterFilter = 'ALL', draftFilter = 'ALL', faFilter = 'ALL';

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-a]');
    if (!el || !root.contains(el)) return;
    ev.preventDefault();
    sfx.click();
    const inModal = !!el.closest('.modal');
    const h = (inModal ? modalHandlers : handlers)[el.dataset.a];
    if (h) h(el.dataset, el);
  });

  function screen(html, h = {}) {
    root.innerHTML = `<div class="screen">${html}</div><div class="modal-wrap hidden"></div><div class="toast hidden"></div>`;
    handlers = h; modalHandlers = {};
  }
  function modal(html, h = {}) {
    const w = root.querySelector('.modal-wrap');
    w.innerHTML = `<div class="modal">${html}</div>`;
    w.classList.remove('hidden');
    modalHandlers = { close: closeModal, ...h };
  }
  function closeModal() {
    const w = root.querySelector('.modal-wrap');
    if (w) { w.classList.add('hidden'); w.innerHTML = ''; }
    modalHandlers = {};
  }
  let toastT = 0;
  function toast(msg) {
    const t = root.querySelector('.toast');
    if (!t) return;
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2200);
  }
  function confirmBox(msg, yesLabel, onYes) {
    modal(`<h3>${esc(msg)}</h3><div class="row"><button class="btn danger" data-a="yes">${esc(yesLabel)}</button><button class="btn ghost" data-a="close">CANCEL</button></div>`,
      { yes: () => { closeModal(); onYes(); } });
  }
  async function persist() {
    if (!L || slot == null) return;
    try {
      await S.saveLeague(slot, L, F.leagueSummary(L));
      app.settings.lastSlot = slot; app.saveSettings();
    } catch (e) { toast('Save failed: ' + e.message); }
  }
  const header = (title, back = 'hub', extra = '') => `<div class="topbar"><button class="btn sm ghost" data-a="${back}">◀ BACK</button><h2>${title}</h2><div class="tb-right">${extra}</div></div>`;
  const ccBadge = () => `<span class="cc" title="Coaching credits">${L.credits} CC</span>`;

  // ---------------- title ----------------
  async function title() {
    L = null; slot = null;
    let saves = [];
    try { saves = await S.listSaves(); } catch (e) { /* private mode etc. */ }
    saves.sort((a, b) => b.updatedAt - a.updatedAt);
    const last = saves.find((s) => s.slot === app.settings.lastSlot) || saves[0];
    screen(`<div class="title-wrap">
      <div class="logo"><span class="l1">POCKET</span><span class="l2">GRIDIRON</span><span class="l3">RETRO FOOTBALL · FRANCHISE</span></div>
      <div class="menu">
        ${last ? `<button class="btn big" data-a="cont" data-slot="${last.slot}">CONTINUE<small>${esc(last.summary.team)} · ${last.summary.year} · ${esc(last.summary.record)}</small></button>` : ''}
        <button class="btn big ${last ? 'alt' : ''}" data-a="franchise">FRANCHISE</button>
        <button class="btn big alt" data-a="quick">QUICK PLAY</button>
        <div class="row"><button class="btn sm ghost" data-a="how">HOW TO PLAY</button><button class="btn sm ghost" data-a="settings">SETTINGS</button></div>
      </div></div>
      <div class="foot"><span class="status">${app.offlineReady ? 'OFFLINE READY ✓' : app.swSupported ? 'PREPARING OFFLINE MODE…' : 'OFFLINE MODE NEEDS HTTPS'}</span>
      ${app.swUpdate ? '<button class="btn sm" data-a="update">UPDATE AVAILABLE — TAP TO RELOAD</button>' : ''}<span class="ver">v${app.version}</span></div>`, {
      cont: (d) => openSlot(+d.slot),
      franchise: slots,
      quick: quickPlay,
      how: howTo,
      settings,
      update: () => app.applyUpdate(),
    });
  }

  // ---------------- save slots ----------------
  async function slots() {
    let saves = [];
    try { saves = await S.listSaves(); } catch (e) { toast('Storage unavailable: ' + e.message); }
    const by = {};
    for (const s of saves) by[s.slot] = s;
    const card = (n) => {
      const s = by[n];
      if (!s) return `<div class="slot empty"><h3>SLOT ${n}</h3><p class="dim">EMPTY</p><button class="btn" data-a="new" data-slot="${n}">NEW FRANCHISE</button></div>`;
      const m = s.summary;
      return `<div class="slot"><h3>SLOT ${n}</h3>${chip(m)} <b>${esc(m.team)}</b>
        <p class="dim">${m.year} · SEASON ${m.season} · ${esc(m.record)} · ${m.titles} TITLE${m.titles === 1 ? '' : 'S'}</p>
        <p class="dim">${new Date(s.updatedAt).toLocaleString()}</p>
        <div class="row"><button class="btn" data-a="load" data-slot="${n}">PLAY</button>
        <button class="btn sm alt" data-a="export" data-slot="${n}">EXPORT</button>
        <button class="btn sm danger" data-a="del" data-slot="${n}">DELETE</button></div></div>`;
    };
    screen(`${header('FRANCHISE SAVES', 'back')}<div class="slots">${card(1)}${card(2)}${card(3)}</div>
      <div class="row center"><button class="btn alt" data-a="import">IMPORT SAVE FILE</button></div>`, {
      back: title,
      new: (d) => newFranchise(+d.slot),
      load: (d) => openSlot(+d.slot),
      export: (d) => exportFlow(+d.slot),
      del: (d) => confirmBox(`Delete slot ${d.slot}? This cannot be undone.`, 'DELETE', async () => { await S.deleteSave(+d.slot); if (app.settings.lastSlot === +d.slot) { app.settings.lastSlot = null; app.saveSettings(); } slots(); }),
      import: importFlow,
    });
  }
  async function exportFlow(n) {
    let json;
    try { json = await S.exportSave(n); } catch (e) { return toast(e.message); }
    const name = `pocket-gridiron-slot${n}-${new Date().toISOString().slice(0, 10)}.json`;
    modal(`<h3>EXPORT SLOT ${n}</h3><p class="dim">Keep a backup in Files, iCloud Drive or email it to yourself. (${Math.round(json.length / 1024)} KB)</p>
      <div class="row"><button class="btn" data-a="file">SAVE / SHARE FILE</button><button class="btn alt" data-a="copy">COPY AS TEXT</button></div>
      <div class="row"><button class="btn ghost" data-a="close">DONE</button></div>`, {
      file: async () => {
        const file = new File([json], name, { type: 'application/json' });
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Pocket Gridiron save' }); return; }
        } catch (e) { if (e.name === 'AbortError') return; }
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      },
      copy: async () => {
        try { await navigator.clipboard.writeText(json); toast('Save copied to clipboard'); }
        catch (e) { modal(`<h3>COPY THIS TEXT</h3><textarea readonly class="ta">${esc(json)}</textarea><div class="row"><button class="btn" data-a="close">DONE</button></div>`); }
      },
    });
  }
  function importFlow() {
    modal(`<h3>IMPORT SAVE</h3><p class="dim">Choose an exported .json file, or paste the save text.</p>
      <div class="row"><button class="btn" data-a="pickfile">CHOOSE FILE</button><button class="btn alt" data-a="paste">PASTE TEXT</button></div>
      <div class="row"><button class="btn ghost" data-a="close">CANCEL</button></div>`, {
      pickfile: () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.json,application/json,text/plain';
        inp.onchange = async () => { const f = inp.files[0]; if (f) importText(await f.text()); };
        inp.click();
      },
      paste: () => modal(`<h3>PASTE SAVE TEXT</h3><textarea class="ta" id="paste-ta" placeholder="Paste here"></textarea>
        <div class="row"><button class="btn" data-a="go">IMPORT</button><button class="btn ghost" data-a="close">CANCEL</button></div>`,
        { go: () => importText(root.querySelector('#paste-ta').value) }),
    });
  }
  function importText(text) {
    let league;
    try { league = S.parseImport(text); } catch (e) { return modal(`<h3>IMPORT FAILED</h3><p>${esc(e.message)}</p><div class="row"><button class="btn" data-a="close">OK</button></div>`); }
    const t = league.teams[league.userTeamId];
    modal(`<h3>IMPORT ${esc(t.city)} ${esc(t.name)} (${league.year})</h3><p class="dim">Choose a slot. Anything already in it will be replaced.</p>
      <div class="row">${[1, 2, 3].map((n) => `<button class="btn" data-a="to" data-slot="${n}">SLOT ${n}</button>`).join('')}</div>
      <div class="row"><button class="btn ghost" data-a="close">CANCEL</button></div>`, {
      to: async (d) => { await S.saveLeague(+d.slot, league, F.leagueSummary(league)); closeModal(); toast('Save imported'); slots(); },
    });
  }
  async function openSlot(n) {
    try {
      const data = await S.loadLeague(n);
      if (!data) return slots();
      L = data; slot = n;
      app.settings.lastSlot = n; app.saveSettings();
      hub();
    } catch (e) { toast('Could not load: ' + e.message); }
  }

  // ---------------- team picker ----------------
  function teamPicker(league, heading, onPick, back, exclude = null) {
    const cards = league.teams.map((t) => {
      const r = F.ratings(league, t);
      return `<button class="tcard ${t.id === exclude ? 'disabled' : ''}" data-a="pick" data-id="${t.id}" style="--tp:${t.colors.p};--ts:${t.colors.s}">
        <span class="tabbr">${esc(t.abbr)}</span><span class="tname">${esc(t.city)}<br><b>${esc(t.name)}</b></span>
        <span class="trate">OFF ${r.off} · DEF ${r.def}<br>${stars(r.ovr)}</span></button>`;
    }).join('');
    screen(`${header(heading, 'back')}<div class="tgrid">${cards}</div>`, {
      back,
      pick: (d) => { if (+d.id !== exclude) onPick(+d.id); },
    });
  }

  function newFranchise(n) {
    const league = F.newLeague(0);
    teamPicker(league, 'CHOOSE YOUR TEAM', (id) => {
      const t = league.teams[id];
      modal(`<h3>COACH THE ${esc(t.city)} ${esc(t.name)}?</h3><p class="dim">Slot ${n} · ${league.year} season · 15 games + 8-team playoffs.</p>
        <div class="row"><button class="btn" data-a="go">START FRANCHISE</button><button class="btn ghost" data-a="close">BACK</button></div>`, {
        go: async () => {
          league.userTeamId = id;
          league.news.unshift(`${t.city} ${t.name} hire a new head coach.`);
          L = league; slot = n;
          await persist();
          closeModal(); hub();
        },
      });
    }, slots);
  }

  function quickPlay() {
    quickLeague = quickLeague || F.newLeague(0);
    const Q = quickLeague;
    teamPicker(Q, 'QUICK PLAY: YOUR TEAM', (uid) => {
      teamPicker(Q, 'QUICK PLAY: OPPONENT', (oid) => {
        app.startMatch({
          user: F.buildMatchTeam(Q, uid), opp: F.buildMatchTeam(Q, oid), playoff: false, allowQuit: true, label: 'EXHIBITION',
          onEnd: () => title(),
        });
      }, quickPlay, uid);
    }, title);
  }

  // ---------------- hub ----------------
  function hub() {
    if (!L) return title();
    if (L.phase === 'recap') return recap();
    if (L.phase === 'resign') return resignScreen();
    if (L.phase === 'draft') return draftScreen();
    if (L.phase === 'freeagency') return faScreen();
    const t = L.teams[L.userTeamId];
    const r = F.ratings(L, t);
    const g = F.userGame(L);
    let main = '';
    if (g) {
      const home = g.h === L.userTeamId, o = L.teams[home ? g.a : g.h], ro = F.ratings(L, o);
      const lbl = L.phase === 'regular' ? `WEEK ${L.week + 1} OF ${L.schedule.length}` : F.ROUND_NAMES[L.playoffs.round];
      main = `<div class="panel next"><div class="lbl">${lbl}</div>
        <div class="matchup">${chip(t, 'big')}<span class="at">${home ? 'VS' : '@'}</span>${chip(o, 'big')}</div>
        <p><b>${esc(o.city)} ${esc(o.name)}</b> (${F.record(o)})</p>
        <table class="cmp"><tr><td></td><td>${esc(t.abbr)}</td><td>${esc(o.abbr)}</td></tr>
        <tr><td>OFFENSE</td><td>${r.off}</td><td>${ro.off}</td></tr><tr><td>DEFENSE</td><td>${r.def}</td><td>${ro.def}</td></tr></table>
        <div class="row"><button class="btn big" data-a="play">PLAY GAME</button><button class="btn alt" data-a="sim">SIM GAME</button></div></div>`;
    } else if (L.phase === 'playoffs') {
      main = `<div class="panel next"><div class="lbl">${F.ROUND_NAMES[L.playoffs.round]}</div>
        <p>${L.playoffs.seeds.includes(L.userTeamId) ? 'Your season is over.' : 'You missed the playoffs.'} Watch the rest of the bracket.</p>
        <div class="row"><button class="btn big" data-a="simround">SIM ${F.ROUND_NAMES[L.playoffs.round]}</button></div></div>`;
    }
    const lastGames = L.phase === 'regular' && L.week > 0 ? L.schedule[L.week - 1].find((x) => x.h === L.userTeamId || x.a === L.userTeamId) : null;
    const lastTxt = lastGames ? (() => { const home = lastGames.h === L.userTeamId, us = home ? lastGames.hs : lastGames.as, them = home ? lastGames.as : lastGames.hs, o = L.teams[home ? lastGames.a : lastGames.h]; return `LAST: ${us > them ? 'W' : us < them ? 'L' : 'T'} ${us}-${them} ${home ? 'VS' : '@'} ${esc(o.abbr)}`; })() : '';
    screen(`<div class="hub">
      <div class="hub-left">
        <div class="teamhead">${chip(t, 'big')}<div><h2>${esc(t.city)} ${esc(t.name)}</h2>
          <p>${L.year} · SEASON ${L.season} · <b>${F.record(t)}</b>${t.titles ? ` · ${'🏆'.repeat(Math.min(t.titles, 5))}` : ''}</p>
          <p class="dim">OVR ${r.ovr} ${stars(r.ovr)} · ${ccBadge()} ${lastTxt ? '· ' + lastTxt : ''}</p></div></div>
        ${main}
      </div>
      <div class="hub-nav">
        <button class="btn" data-a="roster">ROSTER</button>
        <button class="btn" data-a="standings">STANDINGS</button>
        <button class="btn" data-a="${L.phase === 'playoffs' ? 'bracket' : 'schedule'}">${L.phase === 'playoffs' ? 'BRACKET' : 'SCHEDULE'}</button>
        <button class="btn" data-a="history">HISTORY</button>
        <button class="btn ghost" data-a="menu">SAVE & EXIT</button>
      </div></div>`, {
      play: playGame, sim: simGameNow,
      simround: async () => { F.advancePlayoffs(L); await persist(); hub(); },
      roster, standingsScreen: null, standings: standingsScreen, schedule: scheduleScreen, bracket: bracketScreen, history: historyScreen,
      menu: async () => { await persist(); title(); },
    });
  }

  function playGame() {
    const g = F.userGame(L);
    if (!g) return;
    const home = g.h === L.userTeamId, oid = home ? g.a : g.h;
    const label = L.phase === 'regular' ? `${L.year} · WEEK ${L.week + 1}` : F.ROUND_NAMES[L.playoffs.round];
    app.startMatch({
      user: F.buildMatchTeam(L, L.userTeamId), opp: F.buildMatchTeam(L, oid), playoff: L.phase === 'playoffs', label, allowQuit: false,
      onEnd: (res) => postGame(res),
    });
  }
  function simGameNow() {
    confirmBox('Simulate this game? You will not play it.', 'SIMULATE', () => postGame(F.simUserGame(L)));
  }
  async function postGame(res) {
    const wasPlayoff = L.phase === 'playoffs';
    const r = F.recordUserGame(L, res);
    await persist();
    hub();
    const word = r.won ? 'WIN' : r.tie ? 'TIE' : 'LOSS';
    const cc = wasPlayoff ? (r.won ? '+3 CC' : '') : r.won ? '+2 CC' : '+1 CC';
    let extra = '';
    if (L.phase === 'playoffs' && !wasPlayoff) extra = F.userInPlayoffs(L) ? '<p class="good">YOU MADE THE PLAYOFFS!</p>' : '<p class="bad">You missed the playoffs.</p>';
    if (L.phase === 'recap') extra = L.playoffs.champion === L.userTeamId ? '<p class="good">🏆 POCKET BOWL CHAMPIONS! 🏆</p>' : '';
    modal(`<h3>${word} ${res.user}-${res.opp}${res.ot ? ' (OT)' : ''}</h3>${cc ? `<p>${cc} earned · ${L.credits} CC total</p>` : ''}${extra}
      <p class="dim">Spend coaching credits (CC) on the roster screen to train players.</p><div class="row"><button class="btn" data-a="close">OK</button></div>`);
  }

  // ---------------- roster & player ----------------
  function roster() {
    const t = L.teams[L.userTeamId];
    const st = F.starters(L, t);
    const startIds = new Set(Object.values(st).flat().map((p) => p.id));
    const groups = { ALL: F.POS, OFF: ['QB', 'RB', 'WR', 'TE', 'OL', 'K'], DEF: ['DL', 'LB', 'DB'] };
    const ps = F.teamPlayers(L, t).filter((p) => groups[rosterFilter].includes(p.pos))
      .sort((a, b) => F.POS.indexOf(a.pos) - F.POS.indexOf(b.pos) || b.ovr - a.ovr);
    const pay = F.payroll(L, t);
    const missing = F.POS.filter((pos) => st[pos].some((p) => p.temp));
    screen(`${header(`ROSTER ${t.roster.length}/${F.ROSTER_MAX}`, 'hub', `<span class="${pay > F.CAP ? 'bad' : ''}">${money(pay)} / ${money(F.CAP)}</span> ${ccBadge()}`)}
      <div class="tabs">${['ALL', 'OFF', 'DEF'].map((k) => `<button class="tab ${k === rosterFilter ? 'on' : ''}" data-a="filter" data-k="${k}">${k}</button>`).join('')}
      <span class="dim small">TAP A PLAYER TO TRAIN OR RELEASE · ★ = STARTER</span></div>
      ${missing.length ? `<p class="bad small pad">No player at: ${missing.join(', ')} — a practice-squad fill-in (40 OVR) will start.</p>` : ''}
      <div class="list">${ps.map((p) => `<button class="prow" data-a="player" data-id="${p.id}">
        <span class="pos">${p.pos}</span><span class="num">#${p.num}</span><span class="nm">${pname(p)}${startIds.has(p.id) ? ' <i>★</i>' : ''}</span>
        <span class="age">${p.age}Y</span><span class="ovr">${p.ovr}</span><span class="st">${stars(p.ovr)}</span><span class="pot">POT ${grade(p.pot)}</span>
        <span class="sal">${money(p.contract.sal)} · ${p.contract.yrs}Y</span></button>`).join('')}</div>`, {
      hub, filter: (d) => { rosterFilter = d.k; roster(); }, player: (d) => playerCard(L.players[d.id]),
    });
  }
  function playerCard(p) {
    const rel = F.WEIGHTS[p.pos];
    const attrs = F.ATTRS.filter((k) => rel[k]).concat(F.ATTRS.filter((k) => !rel[k] && ['spd', 'agi', 'str'].includes(k)));
    const rows = attrs.map((k) => {
      const v = p.attrs[k], key = !!rel[k], cost = F.trainCost(p, k);
      return `<div class="attr ${key ? 'key' : ''}"><span>${F.ATTR_NAMES[k]}</span><span class="bar"><i style="width:${v}%"></i></span><b>${v}</b>
        ${key ? `<button class="btn xs" data-a="train" data-k="${k}" ${L.credits < cost || v >= 99 ? 'disabled' : ''}>+ ${cost}CC</button>` : '<span></span>'}</div>`;
    }).join('');
    modal(`<div class="pcard-h"><span class="pos big">${p.pos}</span><div><h3>#${p.num} ${pname(p)}</h3>
      <p class="dim">AGE ${p.age} · ${money(p.contract.sal)} × ${p.contract.yrs} YR${p.contract.yrs === 1 ? '' : 'S'} · ${p.seasons} SEASON${p.seasons === 1 ? '' : 'S'}</p></div>
      <div class="ovrbox"><b>${p.ovr}</b><small>OVR</small></div><div class="ovrbox"><b>${grade(p.pot)}</b><small>POT</small></div></div>
      <div class="attrs">${rows}</div>
      <p class="small"><b>THIS SEASON:</b> ${statLine(p, p.stats)}</p><p class="small dim"><b>CAREER:</b> ${statLine(p, p.career)}</p>
      <p class="small dim">You have ${L.credits} coaching credits. Young players gain more per session; players at their potential gain +1.</p>
      <div class="row"><button class="btn danger sm" data-a="release">RELEASE</button><button class="btn" data-a="close">CLOSE</button></div>`, {
      train: async (d) => {
        const g = F.train(L, p, d.k);
        if (g) { toast(`${F.ATTR_NAMES[d.k]} +${g}`); await persist(); }
        roster(); playerCard(p);
      },
      release: () => confirmBox(`Release ${p.first} ${p.last}? His salary comes off your cap.`, 'RELEASE', async () => { F.release(L, p); await persist(); roster(); }),
    });
  }

  // ---------------- league screens ----------------
  function standingsScreen() {
    const rows = F.standings(L).map((t, i) => `<tr class="${t.id === L.userTeamId ? 'me' : ''} ${i < 8 ? 'po' : ''}"><td>${i + 1}</td><td>${chip(t)} ${esc(t.city)} ${esc(t.name)}</td>
      <td>${F.record(t)}</td><td>${t.pf}</td><td>${t.pa}</td><td>${t.pf - t.pa > 0 ? '+' : ''}${t.pf - t.pa}</td></tr>`).join('');
    screen(`${header(`STANDINGS ${L.year}`)}<div class="list"><table class="tbl"><tr><th>#</th><th>TEAM</th><th>W-L</th><th>PF</th><th>PA</th><th>DIFF</th></tr>${rows}</table>
      <p class="dim small pad">Top 8 make the playoffs (highlighted).</p></div>`, { hub });
  }
  function scheduleScreen() {
    const rows = L.schedule.map((wk, i) => {
      const g = wk.find((x) => x.h === L.userTeamId || x.a === L.userTeamId);
      const home = g.h === L.userTeamId, o = L.teams[home ? g.a : g.h];
      let res = i === L.week ? '<b>NEXT</b>' : '';
      if (g.hs != null) { const us = home ? g.hs : g.as, them = home ? g.as : g.hs; res = `<b class="${us > them ? 'good' : us < them ? 'bad' : ''}">${us > them ? 'W' : us < them ? 'L' : 'T'}</b> ${us}-${them}${g.ot ? ' OT' : ''}`; }
      return `<tr class="${i === L.week ? 'me' : ''}"><td>WK ${i + 1}</td><td>${home ? 'VS' : '@'}</td><td>${chip(o)} ${esc(o.city)} ${esc(o.name)}</td><td>${F.record(o)}</td><td>${res}</td></tr>`;
    }).join('');
    screen(`${header(`SCHEDULE ${L.year}`)}<div class="list"><table class="tbl">${rows}</table></div>`, { hub });
  }
  function bracketScreen() {
    const P = L.playoffs;
    const cols = P.rounds.map((r, i) => `<div class="bcol"><h4>${F.ROUND_NAMES[i]}</h4>${r.map((g) => {
      const line = (id, s, other) => `<div class="bteam ${id === L.userTeamId ? 'me' : ''} ${s != null && s > other ? 'win' : ''}">#${P.seeds.indexOf(id) + 1} ${chip(L.teams[id])} ${esc(L.teams[id].name)} <b>${s ?? ''}</b></div>`;
      return `<div class="bgame">${line(g.h, g.hs, g.as)}${line(g.a, g.as, g.hs)}</div>`;
    }).join('')}</div>`).join('');
    screen(`${header('PLAYOFF BRACKET')}<div class="bracket">${cols}</div>`, { hub });
  }
  function historyScreen() {
    const t = L.teams[L.userTeamId];
    const rows = L.history.slice().reverse().map((h) => `<tr><td>${h.year}</td><td>${esc(h.record)}</td><td class="${h.result === 'CHAMPIONS' ? 'good' : ''}">${esc(h.result)}</td><td>${chip(L.teams[h.champion])} ${esc(L.teams[h.champion].name)}</td></tr>`).join('');
    screen(`${header('FRANCHISE HISTORY')}<div class="list"><p class="pad">${esc(t.city)} ${esc(t.name)} · ${t.titles} championship${t.titles === 1 ? '' : 's'}</p>
      ${rows ? `<table class="tbl"><tr><th>YEAR</th><th>RECORD</th><th>RESULT</th><th>CHAMPION</th></tr>${rows}</table>` : '<p class="dim pad">Finish a season to start your history.</p>'}
      <h4 class="pad">LEAGUE NEWS</h4>${L.news.map((n) => `<p class="small dim pad">${esc(n)}</p>`).join('')}</div>`, { hub });
  }

  // ---------------- offseason ----------------
  function recap() {
    const P = L.playoffs, champ = L.teams[P.champion], t = L.teams[L.userTeamId];
    const h = L.history[L.history.length - 1];
    const ps = F.teamPlayers(L, t);
    const lead = (k, label) => { const p = ps.slice().sort((a, b) => (b.stats[k] || 0) - (a.stats[k] || 0))[0]; return p && p.stats[k] ? `<p class="small">${label}: <b>${pname(p)}</b> ${p.stats[k]}</p>` : ''; };
    screen(`<div class="center-col"><h2 class="${P.champion === L.userTeamId ? 'good' : ''}">${P.champion === L.userTeamId ? '🏆 YOU WON THE POCKET BOWL! 🏆' : `${esc(champ.city)} ${esc(champ.name)} WIN THE POCKET BOWL`}</h2>
      <div class="panel"><p>${L.year} ${esc(t.name)}: <b>${esc(h.record)}</b> — ${esc(h.result)}</p>
      ${lead('py', 'PASSING YDS')}${lead('ry', 'RUSHING YDS')}${lead('recy', 'RECEIVING YDS')}${lead('sck', 'SACKS')}</div>
      <p class="dim small">Next: player development & retirements → re-sign contracts → draft → free agency.</p>
      <button class="btn big" data-a="go">BEGIN OFFSEASON</button></div>`, {
      go: async () => {
        const notes = F.beginOffseason(L);
        await persist();
        resignScreen();
        modal(`<h3>OFFSEASON REPORT</h3><div class="scroll">${notes.length ? notes.map((n) => `<p class="small">${esc(n)}</p>`).join('') : '<p class="dim">No major changes on your roster.</p>'}</div><div class="row"><button class="btn" data-a="close">OK</button></div>`);
      },
    });
  }
  function resignScreen() {
    const t = L.teams[L.userTeamId], exp = F.expiring(L), pay = F.payroll(L, t);
    screen(`<div class="topbar"><h2>RE-SIGN PLAYERS</h2><div class="tb-right">${money(pay)} / ${money(F.CAP)} · ${t.roster.length} PLAYERS</div></div>
      <p class="small pad">These contracts expired. Re-sign who you want to keep — anyone left unsigned enters free agency.</p>
      <div class="list">${exp.length ? exp.map((p) => `<div class="prow static"><span class="pos">${p.pos}</span><span class="nm">${pname(p)}</span><span class="age">${p.age}Y</span><span class="ovr">${p.ovr}</span>
        <span class="pot">POT ${grade(p.pot)}</span><span class="sal">ASKS ${money(p.ask)}</span>
        <button class="btn xs" data-a="re" data-id="${p.id}">RE-SIGN</button><button class="btn xs danger" data-a="rel" data-id="${p.id}">LET GO</button></div>`).join('') : '<p class="dim pad">No expiring contracts.</p>'}</div>
      <div class="row center"><button class="btn big" data-a="go">CONTINUE TO DRAFT</button></div>`, {
      re: async (d) => { if (!F.resign(L, L.players[d.id])) toast('Not enough cap space'); await persist(); resignScreen(); },
      rel: async (d) => { F.release(L, L.players[d.id]); await persist(); resignScreen(); },
      go: async () => { F.startDraft(L); await persist(); draftScreen(); },
    });
  }
  function draftScreen() {
    const D = L.draft, n = L.teams.length;
    const done = D.pick >= D.order.length;
    const clock = F.onTheClock(L), mine = clock === L.userTeamId;
    const rnd = Math.floor(D.pick / n) + 1, pk = (D.pick % n) + 1;
    const t = L.teams[L.userTeamId];
    const ps = D.prospects.map((id) => L.players[id]).filter((p) => draftFilter === 'ALL' || p.pos === draftFilter)
      .sort((a, b) => (b.scouted ? b.ovr : (b.est[0] + b.est[1]) / 2) - (a.scouted ? a.ovr : (a.est[0] + a.est[1]) / 2));
    const log = D.log.slice(-6).reverse().map((x) => { const p = L.players[x.pid]; return `<span class="small ${x.teamId === L.userTeamId ? 'good' : 'dim'}">${Math.floor(x.pick / n) + 1}.${(x.pick % n) + 1} ${esc(L.teams[x.teamId].abbr)}: ${p ? `${p.pos} ${esc(p.last)}` : '—'}</span>`; }).join(' · ');
    const myPicks = D.order.map((id, i) => (id === L.userTeamId && i >= D.pick ? `${Math.floor(i / n) + 1}.${(i % n) + 1}` : null)).filter(Boolean).join(', ');
    screen(`<div class="topbar"><h2>${L.year + 1} DRAFT</h2><div class="tb-right">${done ? 'DRAFT COMPLETE' : `ROUND ${rnd} · PICK ${pk} · ON THE CLOCK: ${chip(L.teams[clock])}`} ${ccBadge()}</div></div>
      <div class="pad small">${mine ? '<b class="good">YOU ARE ON THE CLOCK!</b> ' : ''}Your picks: ${myPicks || 'none left'} · Roster ${t.roster.length}/${F.ROSTER_MAX} · Scouting reveals true OVR & potential (1 CC).</div>
      <div class="pad">${log}</div>
      <div class="tabs">${['ALL', ...F.POS].map((k) => `<button class="tab ${k === draftFilter ? 'on' : ''}" data-a="filter" data-k="${k}">${k}</button>`).join('')}</div>
      <div class="list">${ps.map((p) => `<div class="prow static"><span class="pos">${p.pos}</span><span class="nm">${pname(p)}</span><span class="age">${p.age}Y</span>
        <span class="ovr">${p.scouted ? p.ovr : `${p.est[0]}-${p.est[1]}`}</span><span class="pot">POT ${grade(p.scouted ? p.pot : p.potEst)}${p.scouted ? '' : '?'}</span>
        <span class="act">${p.scouted ? '<span class="good">SCOUTED</span>' : `<button class="btn xs alt" data-a="scout" data-id="${p.id}" ${L.credits < 1 ? 'disabled' : ''}>SCOUT 1CC</button>`}</span>
        <button class="btn xs" data-a="draft" data-id="${p.id}" ${mine ? '' : 'disabled'}>DRAFT</button></div>`).join('')}</div>
      <div class="row center">${done ? '<button class="btn big" data-a="finish">CONTINUE TO FREE AGENCY</button>'
        : mine ? '<button class="btn alt" data-a="auto">AUTO-PICK FOR ME</button><button class="btn ghost" data-a="skip">PASS THIS PICK</button>'
        : '<button class="btn big" data-a="simto">SIM TO MY PICK</button>'}
        ${done ? '' : '<button class="btn ghost" data-a="finish">AUTO-FINISH DRAFT</button>'}</div>`, {
      filter: (d) => { draftFilter = d.k; draftScreen(); },
      scout: async (d) => { F.scout(L, L.players[d.id]); await persist(); draftScreen(); },
      draft: async (d) => {
        const p = L.players[d.id];
        if (!F.userDraft(L, +d.id)) return toast('Roster is full — release someone or pass.');
        toast(`Drafted ${p.pos} ${p.first} ${p.last}`);
        F.simToUserPick(L); await persist(); draftScreen();
      },
      auto: async () => { if (t.roster.length >= F.ROSTER_MAX) F.skipUserPick(L); else F.aiPick(L); F.simToUserPick(L); await persist(); draftScreen(); },
      skip: async () => { F.skipUserPick(L); F.simToUserPick(L); await persist(); draftScreen(); },
      simto: async () => { F.simToUserPick(L); await persist(); draftScreen(); },
      finish: async () => { F.finishDraft(L); await persist(); faScreen(); },
    });
  }
  function faScreen() {
    const t = L.teams[L.userTeamId], pay = F.payroll(L, t);
    const st = F.starters(L, t);
    const missing = F.POS.filter((pos) => st[pos].some((p) => p.temp));
    const ps = L.fa.map((id) => L.players[id]).filter((p) => p && (faFilter === 'ALL' || p.pos === faFilter)).sort((a, b) => b.ovr - a.ovr);
    screen(`<div class="topbar"><h2>FREE AGENCY</h2><div class="tb-right">CAP SPACE ${money(F.CAP - pay)} · ${t.roster.length}/${F.ROSTER_MAX}</div></div>
      ${missing.length ? `<p class="bad small pad">Empty starting spots: ${missing.join(', ')} — sign someone or a cheap replacement will be added.</p>` : ''}
      <div class="tabs">${['ALL', ...F.POS].map((k) => `<button class="tab ${k === faFilter ? 'on' : ''}" data-a="filter" data-k="${k}">${k}</button>`).join('')}
      <button class="tab" data-a="roster">MY ROSTER</button></div>
      <div class="list">${ps.map((p) => `<div class="prow static"><span class="pos">${p.pos}</span><span class="nm">${pname(p)}</span><span class="age">${p.age}Y</span><span class="ovr">${p.ovr}</span>
        <span class="pot">POT ${grade(p.pot)}</span><span class="sal">${money(p.ask)}</span><button class="btn xs" data-a="sign" data-id="${p.id}">SIGN</button></div>`).join('') || '<p class="dim pad">No free agents at this position.</p>'}</div>
      <div class="row center"><button class="btn big" data-a="go">START ${L.year + 1} SEASON</button></div>`, {
      filter: (d) => { faFilter = d.k; faScreen(); },
      roster: () => { roster(); handlers.hub = faScreen; },
      sign: async (d) => { const err = F.signFA(L, L.players[d.id]); if (err) return toast(err); await persist(); faScreen(); },
      go: async () => {
        const notes = F.startNewSeason(L);
        await persist(); hub();
        modal(`<h3>WELCOME TO ${L.year}</h3><p>+2 CC for the new season.</p>${notes.map((n) => `<p class="small">${esc(n)}</p>`).join('')}<div class="row"><button class="btn" data-a="close">LET'S GO</button></div>`);
      },
    });
  }

  // ---------------- settings & help ----------------
  function settings() {
    const s = app.settings;
    const opt = (key, val, label) => `<button class="tab ${s[key] === val ? 'on' : ''}" data-a="set" data-k="${key}" data-v="${val}">${label}</button>`;
    screen(`${header('SETTINGS', 'back')}<div class="list settings">
      <div class="srow"><span>SOUND</span>${opt('sound', true, 'ON')}${opt('sound', false, 'OFF')}</div>
      <div class="srow"><span>THROW AIMING</span>${opt('aim', 'pull', 'PULL BACK')}${opt('aim', 'direct', 'TOUCH TARGET')}</div>
      <div class="srow"><span>QUARTER LENGTH</span>${[2, 3, 4, 5].map((m) => opt('quarterMin', m, m + ' MIN')).join('')}</div>
      <div class="srow"><span>DIFFICULTY</span>${opt('difficulty', 'easy', 'ROOKIE')}${opt('difficulty', 'normal', 'PRO')}${opt('difficulty', 'hard', 'LEGEND')}</div>
      <p class="dim small pad">Saves are stored on this device (IndexedDB). Export them from FRANCHISE → EXPORT to back up.</p>
      <div class="row"><button class="btn danger sm" data-a="wipe">DELETE ALL SAVES</button></div></div>`, {
      back: title,
      set: (d) => {
        let v = d.v;
        if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
        s[d.k] = v; app.saveSettings(); settings();
      },
      wipe: () => confirmBox('Delete ALL franchise saves on this device?', 'DELETE ALL', async () => {
        for (const n of [1, 2, 3]) await S.deleteSave(n).catch(() => {});
        s.lastSlot = null; app.saveSettings(); toast('All saves deleted');
      }),
    });
  }
  function howTo() {
    screen(`${header('HOW TO PLAY', 'back')}<div class="list help">
      <h4>OFFENSE</h4>
      <p>Pick one of four plays each down (3 passes + 1 run). On 4th down you can also punt or kick a field goal.</p>
      <p><b>PASSING:</b> after the snap, touch anywhere and <b>drag backwards</b> (like a slingshot). A dotted arc shows the throw; release to throw. The dot above each receiver shows how open he is: <span class="good">green</span> open, <span class="warn">yellow</span> tight, <span class="bad">red</span> covered. Hold the ball too long and you'll get sacked. Tap <b>QB RUN</b> to scramble.</p>
      <p>Prefer tapping your target directly? Switch <b>THROW AIMING</b> to TOUCH TARGET in Settings.</p>
      <p><b>RUNNING:</b> your runner sprints forward automatically. <b>Hold above or below</b> him to steer. <b>Quick swipe</b> up/down to juke, right to dive forward, left to spin.</p>
      <h4>DEFENSE</h4><p>Opponent drives are simulated from your defense vs their offense ratings. Improve your DL, LB and DB to stop them.</p>
      <h4>FRANCHISE</h4>
      <p>15-game season, top 8 make the playoffs, win three rounds to lift the <b>Pocket Bowl</b>. Earn coaching credits (CC) by winning and spend them to train key attributes. Each offseason players age and develop, contracts expire, and you draft rookies (scout them first!) and sign free agents under a ${money(F.CAP)} cap.</p>
      <h4>SAVES</h4><p>Franchises auto-save after every game and decision. Use EXPORT to back up a save file and IMPORT to restore it on any device.</p></div>`, { back: title });
  }

  return { title, refresh: () => { if (!L && root.querySelector('.title-wrap')) title(); } };
}
