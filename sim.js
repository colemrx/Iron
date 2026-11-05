// Drive / game simulation used for opponent possessions and league games.
import { clamp, randi } from './util.js';

// yl = yards from the offense's own goal line where the drive starts.
// Returns { res, pts, next } — next = field position (yl) for the other team.
export function simDrive(off, def, yl) {
  const edge = (off - def) / 100;
  const fp = (yl - 25) / 100;
  const pTD = clamp(0.25 + edge * 1.1 + fp * 0.5, 0.05, 0.78);
  const pFG = clamp(0.16 + fp * 0.2, 0.05, 0.35);
  const pTO = clamp(0.11 - edge * 0.25, 0.03, 0.25);
  const r = Math.random();
  if (r < pTD) {
    const pts = Math.random() < 0.95 ? 7 : 6;
    return { res: 'TD', pts, next: 25, yds: 100 - yl, text: pts === 7 ? 'TOUCHDOWN' : 'TOUCHDOWN (XP MISSED)' };
  }
  if (r < pTD + pFG) {
    const reach = clamp(yl + randi(15, 45), yl, 92);
    const dist = 100 - reach + 17;
    const good = Math.random() < clamp(1.05 - Math.max(0, dist - 25) * 0.018, 0.25, 0.97);
    return good
      ? { res: 'FG', pts: 3, next: 25, yds: reach - yl, text: `FIELD GOAL GOOD (${dist} YDS)` }
      : { res: 'FGX', pts: 0, next: clamp(100 - reach + 7, 20, 80), yds: reach - yl, text: `FIELD GOAL MISSED (${dist} YDS)` };
  }
  if (r < pTD + pFG + pTO) {
    const g = randi(0, 35);
    const spot = clamp(yl + g, 5, 95);
    return { res: 'TO', pts: 0, next: clamp(100 - spot + randi(0, 10), 5, 90), yds: g, text: Math.random() < 0.6 ? 'INTERCEPTED BY YOUR DEFENSE' : 'FUMBLE RECOVERED BY YOUR DEFENSE' };
  }
  const g = randi(0, 30);
  return { res: 'PUNT', pts: 0, next: randi(8, 32), yds: g, text: 'STOPPED - PUNT' };
}

// Simulate a full game between two rated teams. Returns { hs, as, ot }
export function simGame(hOff, hDef, aOff, aDef, allowTie = true) {
  let hs = 0, as = 0;
  let yl = 25;
  let homeBall = Math.random() < 0.5;
  const drives = randi(10, 12) * 2;
  for (let i = 0; i < drives; i++) {
    const r = homeBall ? simDrive(hOff + 1.5, aDef, yl) : simDrive(aOff, hDef + 1.5, yl);
    if (homeBall) hs += r.pts; else as += r.pts;
    yl = r.next;
    homeBall = !homeBall;
  }
  let ot = false;
  let rounds = 0;
  while (hs === as && (rounds < 1 || !allowTie)) {
    ot = true; rounds++;
    hs += simDrive(hOff, aDef, 25).pts;
    as += simDrive(aOff, hDef, 25).pts;
    if (rounds > 8 && hs === as) { if (Math.random() < 0.5) hs += 3; else as += 3; }
  }
  return { hs, as, ot };
}
