// IndexedDB save slots + JSON export/import. Settings live in localStorage.
const DB_NAME = 'pocket-gridiron';
const DB_VER = 1;
let dbp = null;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves', { keyPath: 'slot' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}
function tx(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('saves', mode);
    const p = Promise.resolve(fn(t.objectStore('saves')));
    t.oncomplete = () => p.then(resolve, reject);
    t.onerror = t.onabort = () => reject(t.error);
  }));
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export function saveLeague(slot, league, summary) {
  league.updatedAt = Date.now();
  return tx('readwrite', (s) => reqP(s.put({ slot, summary, updatedAt: league.updatedAt, data: league })));
}
export function loadLeague(slot) { return tx('readonly', (s) => reqP(s.get(slot))).then((r) => r?.data || null); }
export function listSaves() { return tx('readonly', (s) => reqP(s.getAll())).then((rows) => rows.map(({ slot, summary, updatedAt }) => ({ slot, summary, updatedAt }))); }
export function deleteSave(slot) { return tx('readwrite', (s) => reqP(s.delete(slot))); }

export async function exportSave(slot) {
  const data = await loadLeague(slot);
  if (!data) throw new Error('Empty slot');
  return JSON.stringify({ app: 'pocket-gridiron', format: 1, exportedAt: new Date().toISOString(), league: data });
}
export function parseImport(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
  const L = obj && obj.league ? obj.league : obj;
  if (!L || L.app !== 'pocket-gridiron' || !Array.isArray(L.teams) || !L.players || L.userTeamId == null) throw new Error('This is not a Pocket Gridiron save file.');
  return L;
}

// Ask the browser not to evict our data (Home Screen apps are generally exempt anyway)
export function requestPersist() { try { navigator.storage?.persist?.(); } catch (e) { /* ignore */ } }

const SKEY = 'pg-settings';
export const DEFAULT_SETTINGS = { sound: true, aim: 'pull', quarterMin: 3, difficulty: 'normal', lastSlot: null };
export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function storeSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
