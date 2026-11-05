// Original league data: fictional teams, names, routes and playbook.

export const TEAMS = [
  { city: 'Harbor City', name: 'Gulls', abbr: 'HCG', colors: { p: '#1d3f8f', s: '#f2f2f2', a: '#f7c948' } },
  { city: 'Ironvale', name: 'Forge', abbr: 'IRV', colors: { p: '#4a5059', s: '#ff7a1a', a: '#ffd2a8' } },
  { city: 'Sunmesa', name: 'Scorpions', abbr: 'SUN', colors: { p: '#e0a020', s: '#5b2a0e', a: '#fff1c4' } },
  { city: 'Northpine', name: 'Lumberjacks', abbr: 'NPL', colors: { p: '#2e6b34', s: '#e8d9a8', a: '#a32b2b' } },
  { city: 'Cobalt Bay', name: 'Mantas', abbr: 'CBM', colors: { p: '#1f8fbf', s: '#0d2233', a: '#c8f1ff' } },
  { city: 'Redrock', name: 'Rattlers', abbr: 'RRR', colors: { p: '#a8321e', s: '#f0c070', a: '#2b1a10' } },
  { city: 'Port Ember', name: 'Comets', abbr: 'PEC', colors: { p: '#ff5a36', s: '#2b1b4a', a: '#ffe08a' } },
  { city: 'Glacier Falls', name: 'Frost', abbr: 'GLF', colors: { p: '#9fd8ff', s: '#24508a', a: '#ffffff' } },
  { city: 'Thunder Prairie', name: 'Bison', abbr: 'TPB', colors: { p: '#6b3f22', s: '#f4e3c1', a: '#d9a441' } },
  { city: 'Neon Heights', name: 'Vipers', abbr: 'NHV', colors: { p: '#2fbf4a', s: '#151515', a: '#e8ff5a' } },
  { city: 'Copper Canyon', name: 'Coyotes', abbr: 'CPC', colors: { p: '#c06a2b', s: '#2f2f2f', a: '#f3d3a3' } },
  { city: 'Marsh City', name: 'Gators', abbr: 'MCG', colors: { p: '#3e7d3a', s: '#d4c04a', a: '#123012' } },
  { city: 'Steelport', name: 'Anvils', abbr: 'STP', colors: { p: '#2c323c', s: '#d8b23a', a: '#9aa3ad' } },
  { city: 'Silver Lake', name: 'Phantoms', abbr: 'SLP', colors: { p: '#5a1e6e', s: '#c0c6cc', a: '#e7c6ff' } },
  { city: 'Capital Hill', name: 'Monarchs', abbr: 'CHM', colors: { p: '#7a1f2b', s: '#f2c230', a: '#ffffff' } },
  { city: 'Rivermouth', name: 'Otters', abbr: 'RVO', colors: { p: '#2a6f6a', s: '#f29e4c', a: '#e9fff8' } },
];

export const FIRST = ['Aaron','Andre','Ben','Blake','Bo','Brandon','Caleb','Cam','Carlos','Chris','Cole','Dante','Darius','Dev','Dom','Drew','Eli','Emeka','Evan','Felix','Gabe','Grant','Hank','Hugo','Isaiah','Jalen','Jamal','Jace','Jonah','Jordan','Josh','Kai','Keon','Kofi','Lance','Leo','Luis','Malik','Marco','Mason','Mateo','Miles','Nate','Nico','Omar','Owen','Quinn','Rashad','Reggie','Rico','Rory','Sam','Silas','Theo','Trey','Ty','Victor','Wes','Xavier','Zeke'];
export const LAST = ['Adams','Alvarez','Baker','Banks','Bell','Brooks','Burke','Cain','Carter','Castillo','Cole','Cruz','Dalton','Diaz','Dixon','Drake','Ellis','Flores','Ford','Fox','Garza','Grant','Graves','Hale','Hayes','Hill','Holt','Hughes','Irving','Jensen','Kane','Keller','Knox','Lane','Lopez','Lowe','Mack','Marsh','Mendez','Moss','Nash','Nolan','Okafor','Ortiz','Park','Pierce','Price','Quinn','Reed','Reyes','Rhodes','Rivers','Ross','Ruiz','Santos','Shaw','Silva','Stone','Tate','Torres','Vance','Vega','Wade','Walsh','Ward','Webb','West','Wolfe','Young','Zamora'];

// Route waypoints: [forward yards, outside yards] relative to the player's start.
// "outside" flips toward whichever sideline the player lines up nearer.
export const ROUTES = {
  go:       { pts: [[30, 0]], end: 'cont' },
  seam:     { pts: [[30, -1]], end: 'cont' },
  slant:    { pts: [[2, 0], [12, -7]], end: 'cont' },
  out:      { pts: [[7, 0], [7.5, 10]], end: 'stop' },
  dig:      { pts: [[11, 0], [11.5, -14]], end: 'cont' },
  curl:     { pts: [[10, 0], [8, -1.5]], end: 'stop' },
  hitch:    { pts: [[5.5, 0], [4.5, 0]], end: 'stop' },
  post:     { pts: [[11, 0], [30, -10]], end: 'cont' },
  corner:   { pts: [[11, 0], [24, 9]], end: 'cont' },
  comeback: { pts: [[14, 0], [12, 2.5]], end: 'stop' },
  drag:     { pts: [[2, 0], [3, -22]], end: 'cont' },
  flat:     { pts: [[1.5, 4], [3, 12]], end: 'stop' },
  wheel:    { pts: [[1, 5], [4, 10], [28, 12]], end: 'cont' },
};

export const PLAYS = [
  { id: 'verts', name: 'FOUR VERTS', type: 'pass', routes: { WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam', RB: 'flat' } },
  { id: 'slants', name: 'SLANT FLOOD', type: 'pass', routes: { WR1: 'slant', WR2: 'slant', WR3: 'out', TE: 'drag', RB: 'flat' } },
  { id: 'curls', name: 'CURL FLAT', type: 'pass', routes: { WR1: 'curl', WR2: 'curl', WR3: 'hitch', TE: 'out', RB: 'wheel' } },
  { id: 'mesh', name: 'MESH', type: 'pass', routes: { WR1: 'dig', WR2: 'post', WR3: 'drag', TE: 'drag', RB: 'flat' } },
  { id: 'pa', name: 'PA DEEP SHOT', type: 'pass', pa: true, routes: { WR1: 'post', WR2: 'corner', WR3: 'dig', TE: 'block', RB: 'block' } },
  { id: 'comeback', name: 'COMEBACKS', type: 'pass', routes: { WR1: 'comeback', WR2: 'comeback', WR3: 'seam', TE: 'hitch', RB: 'flat' } },
  { id: 'smash', name: 'SMASH', type: 'pass', routes: { WR1: 'hitch', WR2: 'hitch', WR3: 'corner', TE: 'corner', RB: 'block' } },
  { id: 'dive', name: 'HB DIVE', type: 'run', dir: 'mid' },
  { id: 'sweep', name: 'HB SWEEP', type: 'run', dir: 'out' },
  { id: 'stretch', name: 'HB STRETCH', type: 'run', dir: 'wide' },
];
