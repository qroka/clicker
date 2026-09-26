// Звук (синтез WebAudio — без файлов), тактильный отклик и частицы.

let soundOn = true;
let hapticsOn = true;
export const setFxSettings = (sound: boolean, haptics: boolean) => {
  soundOn = sound;
  hapticsOn = haptics;
};

// ─── Звук ────────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, slideTo?: number, delay = 0) {
  if (!soundOn || !ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

export const sfx = {
  tap() {
    const f = 260 + Math.random() * 120;
    tone(f, 0.12, 'sine', 0.35, f * 2.2);
  },
  crit() {
    tone(880, 0.1, 'triangle', 0.3);
    tone(1318, 0.18, 'triangle', 0.25, undefined, 0.05);
  },
  buy() {
    tone(988, 0.07, 'square', 0.12);
    tone(1319, 0.14, 'square', 0.12, undefined, 0.06);
  },
  boil() {
    for (let i = 0; i < 6; i++) tone(200 + i * 60, 0.15, 'sine', 0.3, 400 + i * 90, i * 0.05);
  },
  wisp() {
    [0, 2, 4, 7].forEach((n, i) => tone(PENTA[n % PENTA.length], 0.35, 'triangle', 0.22, undefined, i * 0.07));
  },
  fanfare() {
    [0, 2, 4, 5, 7].forEach((n, i) => tone(PENTA[n], 0.45, 'triangle', 0.25, undefined, i * 0.09));
  },
  discover() {
    [4, 2, 5, 7].forEach((n, i) => tone(PENTA[n] / 2, 0.5, 'sine', 0.3, PENTA[n], i * 0.12));
  },
  error() {
    tone(140, 0.18, 'sawtooth', 0.12, 110);
  },
  soft() {
    tone(660, 0.06, 'sine', 0.15);
  },
};

// ─── Тактильный отклик ───────────────────────────────────────────────────────
// На iOS 18+ Safari клик по <label> со <input switch> вызывает системную «тапку» Taptic Engine.

let hapticLabel: HTMLLabelElement | null = null;
let lastHaptic = 0;

function ensureHaptic() {
  if (hapticLabel) return;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.body.appendChild(label);
  hapticLabel = label;
}

export function haptic(kind: 'light' | 'medium' | 'heavy' = 'light') {
  if (!hapticsOn) return;
  const now = performance.now();
  if (now - lastHaptic < 55) return;
  lastHaptic = now;
  if (navigator.vibrate) {
    navigator.vibrate(kind === 'heavy' ? 30 : kind === 'medium' ? 15 : 8);
    return;
  }
  ensureHaptic();
  hapticLabel!.click();
  if (kind === 'heavy') setTimeout(() => hapticLabel?.click(), 90);
}

// ─── Частицы ─────────────────────────────────────────────────────────────────

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'dot' | 'star' | 'bubble' | 'coin';
  rot: number;
  vr: number;
}

let canvas: HTMLCanvasElement | null = null;
let c2d: CanvasRenderingContext2D | null = null;
const parts: P[] = [];
let running = false;
let dpr = 1;

export function attachCanvas(el: HTMLCanvasElement) {
  canvas = el;
  c2d = el.getContext('2d');
  const resize = () => {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    el.width = (el.clientWidth || window.innerWidth) * dpr;
    el.height = (el.clientHeight || window.innerHeight) * dpr;
  };
  resize();
  window.addEventListener('resize', resize);
}

export function burst(x: number, y: number, opts: { n?: number; colors?: string[]; kind?: P['kind']; speed?: number; up?: number; size?: number } = {}) {
  const n = opts.n ?? 10;
  const colors = opts.colors ?? ['#ffd36b', '#ffb347', '#fff1b8'];
  const speed = opts.speed ?? 4;
  for (let i = 0; i < n; i++) {
    if (parts.length > 400) parts.shift();
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - (opts.up ?? 3),
      life: 0,
      max: opts.kind === 'bubble' ? 25 + Math.random() * 15 : 40 + Math.random() * 30,
      size: (opts.size ?? 4) * (0.6 + Math.random() * 0.8),
      color: colors[Math.floor(Math.random() * colors.length)],
      kind: opts.kind ?? 'dot',
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.3,
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

function drawStar(g: CanvasRenderingContext2D, r: number) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.4 : r;
    const a = (i * Math.PI) / 4;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function loop() {
  if (!canvas || !c2d) return;
  const g = c2d;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life++;
    if (p.life > p.max) {
      parts.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    if (p.kind === 'bubble') {
      p.vy -= 0.02;
      p.vx *= 0.97;
    } else {
      p.vy += 0.22;
      p.vx *= 0.98;
    }
    const a = 1 - p.life / p.max;
    g.globalAlpha = a;
    g.fillStyle = p.color;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    if (p.kind === 'star') drawStar(g, p.size * 1.6);
    else if (p.kind === 'bubble') {
      g.strokeStyle = p.color;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, p.size * 1.4, 0, Math.PI * 2);
      g.stroke();
    } else if (p.kind === 'coin') {
      g.beginPath();
      g.ellipse(0, 0, p.size * 1.3, p.size * 1.3 * Math.abs(Math.cos(p.rot * 2)), 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.arc(0, 0, p.size, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  g.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(loop);
  else {
    running = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ─── Всплывающие числа ───────────────────────────────────────────────────────

let floatLayer: HTMLElement | null = null;
export const attachFloatLayer = (el: HTMLElement) => (floatLayer = el);

export function floatText(x: number, y: number, text: string, cls = '') {
  if (!floatLayer) return;
  if (floatLayer.childElementCount > 40) floatLayer.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = `float-num ${cls}`;
  el.textContent = text;
  el.style.left = `${x + (Math.random() - 0.5) * 40}px`;
  el.style.top = `${y}px`;
  floatLayer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
