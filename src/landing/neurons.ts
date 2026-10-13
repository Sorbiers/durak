// The museum's nervous system, drawn on canvas: a slow field of neurons behind the whole
// page, and one exhibit for each hall, whose symbol is held together by neurons firing.

const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A small repeatable random source, so an exhibit looks the same on every visit. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sizes a canvas to its box in device pixels; returns the pixel ratio used. */
function fit(canvas: HTMLCanvasElement): number {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(box.width * ratio));
  canvas.height = Math.max(1, Math.round(box.height * ratio));
  return ratio;
}

/** Runs `frame` while the canvas is on screen; draws once and stops if motion is unwanted. */
function animate(canvas: HTMLCanvasElement, frame: (seconds: number, dt: number) => void): void {
  let visible = false;
  let last = 0;
  const tick = (now: number): void => {
    if (!visible) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    frame(now / 1000, dt);
    requestAnimationFrame(tick);
  };
  frame(0, 0);
  if (STILL) return;
  new IntersectionObserver((entries) => {
    const now = entries.some((e) => e.isIntersecting);
    if (now && !visible) {
      visible = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
    visible = now;
  }).observe(canvas);
}

// ------------------------------------------------------------------- exhibits

/** A symbol as SVG paths in a 100 by 100 box. Nodes of the `gaze` paths follow the pointer. */
export interface Emblem {
  paths: string[];
  gaze?: number[];
}

interface Neuron {
  x: number;
  y: number;
  core: boolean; // on the symbol's outline, as opposed to drifting around it
  gaze: boolean;
  phase: number;
  links: number[]; // edges that touch it
}
interface Synapse {
  a: number;
  b: number;
  core: boolean;
}
interface Pulse {
  edge: number;
  from: number; // the neuron it left
  at: number; // 0..1 along the edge
  speed: number;
}

/** Points along an SVG path, a fixed distance apart. */
function along(d: string, step: number): { x: number; y: number }[] {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  const length = path.getTotalLength();
  const count = Math.max(2, Math.round(length / step));
  const points = [];
  for (let i = 0; i < count; i++) {
    const p = path.getPointAtLength((i / count) * length);
    points.push({ x: p.x, y: p.y });
  }
  return points;
}

/**
 * Draws an exhibit. `rgb` is the hall's colour as "r, g, b". Returns the number of neurons,
 * which the caption under the exhibit quotes.
 */
export function startEmblem(canvas: HTMLCanvasElement, emblem: Emblem, rgb: string, seed: number): number {
  const ctx = canvas.getContext('2d')!;
  const random = seeded(seed);
  const neurons: Neuron[] = [];

  emblem.paths.forEach((d, index) => {
    for (const p of along(d, 3.3)) {
      neurons.push({ ...p, core: true, gaze: !!emblem.gaze?.includes(index), phase: random() * 6.28, links: [] });
    }
  });
  // Loose neurons around the symbol, never crowding it or each other.
  for (let tries = 0; tries < 900 && neurons.length < 230; tries++) {
    const x = 3 + random() * 94;
    const y = 3 + random() * 94;
    if (neurons.every((n) => Math.hypot(n.x - x, n.y - y) > (n.core ? 5 : 8.5))) {
      neurons.push({ x, y, core: false, gaze: false, phase: random() * 6.28, links: [] });
    }
  }

  const synapses: Synapse[] = [];
  const joined = new Set<number>();
  neurons.forEach((n, i) => {
    const near = neurons
      .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y), both: m.core && n.core }))
      .filter((o) => o.j !== i && o.d < (o.both ? 5.6 : 15))
      .sort((p, q) => p.d - q.d)
      .slice(0, n.core ? 3 : 2);
    for (const o of near) {
      const key = Math.min(i, o.j) * 1000 + Math.max(i, o.j);
      if (joined.has(key)) continue;
      joined.add(key);
      n.links.push(synapses.length);
      neurons[o.j].links.push(synapses.length);
      synapses.push({ a: i, b: o.j, core: o.both });
    }
  });

  const pulses: Pulse[] = [];
  const spawn = (): Pulse => {
    const edge = (random() * synapses.length) | 0;
    return { edge, from: synapses[edge].a, at: 0, speed: 0.9 + random() * 1.3 };
  };
  for (let i = 0; i < 16; i++) pulses.push({ ...spawn(), at: random() });

  // Where the pointer is, in the symbol's own coordinates, eased so the gaze glides.
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  if (emblem.gaze) {
    addEventListener('pointermove', (e) => {
      const box = canvas.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      const far = Math.hypot(dx, dy) || 1;
      const reach = Math.min(far / (box.width * 0.6), 1) * 7;
      look.tx = (dx / far) * reach;
      look.ty = (dy / far) * reach * 0.6;
    });
  }

  let ratio = fit(canvas);
  new ResizeObserver(() => {
    ratio = fit(canvas);
  }).observe(canvas);

  const px = new Float32Array(neurons.length);
  const py = new Float32Array(neurons.length);

  animate(canvas, (t, dt) => {
    const scale = canvas.width / 100;
    look.x += (look.tx - look.x) * Math.min(dt * 5, 1);
    look.y += (look.ty - look.y) * Math.min(dt * 5, 1);
    neurons.forEach((n, i) => {
      const sway = n.core ? 0.32 : 1.1;
      px[i] = (n.x + Math.sin(t * 0.7 + n.phase) * sway + (n.gaze ? look.x : 0)) * scale;
      py[i] = (n.y + Math.cos(t * 0.6 + n.phase * 1.7) * sway + (n.gaze ? look.y : 0)) * scale;
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const core of [false, true]) {
      ctx.beginPath();
      for (const s of synapses) {
        if (s.core !== core) continue;
        ctx.moveTo(px[s.a], py[s.a]);
        ctx.lineTo(px[s.b], py[s.b]);
      }
      ctx.lineWidth = (core ? 1.15 : 0.7) * ratio;
      ctx.strokeStyle = `rgba(${rgb}, ${core ? 0.62 : 0.15})`;
      ctx.stroke();
    }
    neurons.forEach((n, i) => {
      const glow = 0.5 + 0.5 * Math.sin(t * 1.6 + n.phase * 3);
      ctx.beginPath();
      ctx.arc(px[i], py[i], (n.core ? 0.42 : 0.3) * scale + (n.core ? glow * 0.12 * scale : 0), 0, 6.283);
      ctx.fillStyle = `rgba(${rgb}, ${n.core ? 0.75 + glow * 0.25 : 0.34})`;
      ctx.fill();
    });

    ctx.shadowColor = `rgba(${rgb}, 1)`;
    ctx.shadowBlur = 14 * ratio;
    ctx.fillStyle = '#fff';
    for (const p of pulses) {
      const s = synapses[p.edge];
      p.at += dt * p.speed * (s.core ? 3.2 : 1.1);
      if (p.at >= 1) {
        // Arrived: carry on down another synapse, preferring to stay on the symbol.
        const here = s.a === p.from ? s.b : s.a;
        const ways = neurons[here].links.filter((e) => e !== p.edge);
        const onSymbol = ways.filter((e) => synapses[e].core);
        const pick = onSymbol.length && random() < 0.8 ? onSymbol : ways;
        if (pick.length === 0) Object.assign(p, spawn());
        else Object.assign(p, { edge: pick[(random() * pick.length) | 0], from: here, at: 0 });
        continue;
      }
      const to = s.a === p.from ? s.b : s.a;
      const x = px[p.from] + (px[to] - px[p.from]) * p.at;
      const y = py[p.from] + (py[to] - py[p.from]) * p.at;
      ctx.beginPath();
      ctx.arc(x, y, 0.55 * scale, 0, 6.283);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  });

  return neurons.length;
}

// ---------------------------------------------------------------------- field

/** The slow field of neurons behind the page, in the halls' colours. */
export function startField(canvas: HTMLCanvasElement, tones: string[]): void {
  const ctx = canvas.getContext('2d')!;
  const random = seeded(7);
  interface Drifter {
    x: number;
    y: number;
    vx: number;
    vy: number;
    tone: string;
    phase: number;
  }
  let ratio = fit(canvas);
  let drifters: Drifter[] = [];
  const populate = (): void => {
    ratio = fit(canvas);
    const count = Math.max(24, Math.min(90, Math.round((canvas.width * canvas.height) / (ratio * ratio * 26000))));
    drifters = Array.from({ length: count }, () => ({
      x: random() * canvas.width,
      y: random() * canvas.height,
      vx: (random() - 0.5) * 9 * ratio,
      vy: (random() - 0.5) * 9 * ratio,
      tone: tones[(random() * tones.length) | 0],
      phase: random() * 6.28,
    }));
  };
  populate();
  addEventListener('resize', populate);

  animate(canvas, (t, dt) => {
    const reach = 165 * ratio;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const d of drifters) {
      d.x = (d.x + d.vx * dt + canvas.width) % canvas.width;
      d.y = (d.y + d.vy * dt + canvas.height) % canvas.height;
    }
    ctx.lineWidth = 0.7 * ratio;
    for (let i = 0; i < drifters.length; i++) {
      const a = drifters[i];
      for (let j = i + 1; j < drifters.length; j++) {
        const b = drifters[j];
        const far = Math.hypot(a.x - b.x, a.y - b.y);
        if (far > reach) continue;
        // Dendrites sag a little rather than run straight.
        const bend = Math.sin(a.phase + b.phase) * far * 0.14;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2 + bend, (a.y + b.y) / 2 - bend, b.x, b.y);
        ctx.strokeStyle = `rgba(${a.tone}, ${(1 - far / reach) * 0.2})`;
        ctx.stroke();
      }
    }
    for (const d of drifters) {
      const glow = 0.5 + 0.5 * Math.sin(t * 0.9 + d.phase);
      ctx.beginPath();
      ctx.arc(d.x, d.y, (1 + glow * 1.1) * ratio, 0, 6.283);
      ctx.fillStyle = `rgba(${d.tone}, ${0.25 + glow * 0.4})`;
      ctx.fill();
    }
  });
}
