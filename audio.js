// Tiny synthesized sound effects (WebAudio) — no audio files needed.
let ac = null;
let enabled = true;
export function setSound(on) { enabled = on; }
export function unlockAudio() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { ac = null; }
}
function tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
  if (!enabled || !ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.12) {
  if (!enabled || !ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ac.createBufferSource(), g = ac.createGain();
  g.gain.value = vol;
  s.buffer = buf; s.connect(g).connect(ac.destination); s.start();
}
export const sfx = {
  click: () => tone(660, 0.05, 'square', 0.04),
  snap: () => { tone(180, 0.08, 'square', 0.07); noise(0.05, 0.06); },
  whistle: () => tone(2100, 0.22, 'sine', 0.04, -150),
  throw: () => tone(300, 0.18, 'triangle', 0.06, 500),
  catch: () => { tone(520, 0.06, 'square', 0.05); tone(780, 0.08, 'square', 0.05, 0, 0.06); },
  tackle: () => noise(0.14, 0.18),
  juke: () => tone(900, 0.07, 'triangle', 0.05, -400),
  bad: () => { tone(330, 0.15, 'square', 0.05); tone(220, 0.25, 'square', 0.05, 0, 0.15); },
  first: () => { tone(660, 0.07); tone(880, 0.1, 'square', 0.06, 0, 0.08); },
  kick: () => { noise(0.06, 0.15); tone(140, 0.1, 'sine', 0.1, -60); },
  td: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.06, 0, i * 0.12)),
};
