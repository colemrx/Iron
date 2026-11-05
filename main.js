// Boot: canvas sizing, main loop, input routing, service worker.
import { Match } from './engine.js';
import { createUI } from './ui.js';
import { unlockAudio, setSound } from './audio.js';
import { loadSettings, storeSettings, requestPersist } from './storage.js';
import { getFieldCanvas, SX, SY, FW } from './sprites.js';
import { TEAMS } from './data.js';

const VERSION = '1.0.0';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const hud = document.getElementById('hud');
const uiRoot = document.getElementById('ui');
const view = { w: 480, h: 270, scale: 1 };

const app = {
  version: VERSION,
  settings: loadSettings(),
  match: null,
  swUpdate: null,
  offlineReady: false,
  swSupported: 'serviceWorker' in navigator && window.isSecureContext,
  saveSettings() { storeSettings(this.settings); setSound(this.settings.sound); },
  startMatch(o) {
    uiRoot.classList.add('hidden');
    hud.classList.remove('hidden');
    this.match = new Match({
      ...o, settings: this.settings, layer: hud, saveSettings: () => this.saveSettings(),
      onEnd: (res) => {
        const m = this.match;
        this.match = null;
        m.destroy();
        hud.classList.add('hidden');
        uiRoot.classList.remove('hidden');
        o.onEnd(res);
      },
    });
  },
  applyUpdate() {
    if (this.swUpdate) this.swUpdate.postMessage('SKIP_WAITING');
    else location.reload();
  },
};
setSound(app.settings.sound);
const ui = createUI(uiRoot, app);

// ---------- sizing ----------
function resize() {
  const cw = window.innerWidth, ch = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  view.scale = canvas.height / view.h;
  view.w = canvas.width / view.scale;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- input ----------
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * view.w, y: ((e.clientY - r.top) / r.height) * view.h };
}
const ptr = (type) => (e) => {
  if (!app.match) return;
  e.preventDefault();
  if (type === 'down') { try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
  const p = toLogical(e);
  app.match.pointer(type, p.x, p.y, e.pointerId);
};
canvas.addEventListener('pointerdown', ptr('down'));
canvas.addEventListener('pointermove', ptr('move'));
canvas.addEventListener('pointerup', ptr('up'));
canvas.addEventListener('pointercancel', ptr('cancel'));
// iOS: block pinch-zoom / double-tap zoom / context menus
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
const unlock = () => unlockAudio();
window.addEventListener('touchend', unlock, { passive: true });
window.addEventListener('pointerdown', unlock, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && app.match) app.match.pause(); });

// ---------- menu background ----------
const bgField = getFieldCanvas(TEAMS[0], TEAMS[5]);
let bgX = 30, bgDir = 1, bgSkip = 0;
function renderMenuBg(dt) {
  if (bgSkip++ % 2) return; // 30fps is plenty behind menus
  bgX += bgDir * dt * 6 * 2;
  const vw = view.w / SX;
  if (bgX > 120 - vw + 4 || bgX < -4) bgDir *= -1;
  ctx.fillStyle = '#2a5d27';
  ctx.fillRect(0, 0, view.w, view.h);
  const top = Math.round((view.h - FW * SY) / 2);
  ctx.drawImage(bgField, Math.round(-bgX * SX), top);
  ctx.fillStyle = 'rgba(6,10,20,0.62)';
  ctx.fillRect(0, 0, view.w, view.h);
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const portrait = window.innerHeight > window.innerWidth;
  if (app.match) {
    if (portrait && !app.match.paused) app.match.pause();
    app.match.update(dt);
    if (app.match) app.match.render(ctx, view);
  } else renderMenuBg(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- service worker ----------
if (app.swSupported) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const found = (w) => { if (w && navigator.serviceWorker.controller) { app.swUpdate = w; ui.refresh(); } };
      if (reg.waiting) found(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') found(w); });
      });
      // check for a new version whenever the app comes back to the foreground
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
    navigator.serviceWorker.ready.then(() => { app.offlineReady = true; ui.refresh(); });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !app.swUpdate) return;
    reloading = true;
    location.reload();
  });
}
window.pocketGridiron = app; // handy for debugging from the console
requestPersist();
ui.title();
