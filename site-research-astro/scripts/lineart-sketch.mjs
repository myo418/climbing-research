// 素の線に手のブレを乗せる。
//
// やっていること:
//   1. path / circle / line / polyline を折れ線に分解する
//   2. 各点を、なめらかな雑音で少しずらす（＝手が震える）
//   3. 描き始めと描き終わりを少し行き過ぎさせる（＝止め切れない）
//   4. 折れ線をなめらかな曲線に戻す
//
// 乱数の種は slug と要素の順番から作る。同じ入力からは毎回同じ出力が出る。

import { SKETCH } from '../src/data/lineart-style.mjs';

// ---- 乱数と雑音 ----------------------------------------------------------

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** なめらかな1次元の雑音。整数の格子で乱数を作り、その間を補間する */
function noise(seed) {
  const r = rng(seed);
  const t = Array.from({ length: 256 }, () => r() * 2 - 1);
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = t[((i % 256) + 256) % 256];
    const b = t[(((i + 1) % 256) + 256) % 256];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}

// ---- パスを折れ線にする --------------------------------------------------

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

function cubic(p0, p1, p2, p3, step) {
  const rough = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);
  const n = Math.max(2, Math.ceil(rough / step));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

function quad(p0, p1, p2, step) {
  return cubic(
    p0,
    { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) },
    { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) },
    p2,
    step,
  );
}

function line(p0, p1, step) {
  const n = Math.max(1, Math.ceil(dist(p0, p1) / step));
  return Array.from({ length: n }, (_, i) => ({
    x: p0.x + ((p1.x - p0.x) * (i + 1)) / n,
    y: p0.y + ((p1.y - p0.y) * (i + 1)) / n,
  }));
}

/** d 属性 → 折れ線の配列（サブパスごと）。絶対座標の M/L/C/Q/Z のみ */
export function flatten(d, step) {
  const tokens = d.match(/[MLCQZmlcqz]|-?\d*\.?\d+/g) ?? [];
  const subs = [];
  let pts = null;
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let cmd = null;
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLCQZmlcqz]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'm') {
      cur = { x: num(), y: num() };
      start = cur;
      pts = [cur];
      subs.push({ pts, closed: false });
      cmd = 'L';
    } else if (cmd === 'L') {
      const p = { x: num(), y: num() };
      pts.push(...line(cur, p, step));
      cur = p;
    } else if (cmd === 'C') {
      const c1 = { x: num(), y: num() }, c2 = { x: num(), y: num() }, p = { x: num(), y: num() };
      pts.push(...cubic(cur, c1, c2, p, step));
      cur = p;
    } else if (cmd === 'Q') {
      const c = { x: num(), y: num() }, p = { x: num(), y: num() };
      pts.push(...quad(cur, c, p, step));
      cur = p;
    } else if (cmd === 'Z' || cmd === 'z') {
      pts.push(...line(cur, start, step));
      subs[subs.length - 1].closed = true;
      cur = start;
    } else {
      throw new Error(`使えないコマンド "${cmd}"（絶対座標の M/L/C/Q/Z だけ）`);
    }
  }
  return subs;
}

export function ellipseToPoints(cx, cy, rx, ry, step) {
  const n = Math.max(12, Math.ceil((Math.PI * (rx + ry)) / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
  });
}

export const circleToPoints = (cx, cy, r, step) => ellipseToPoints(cx, cy, r, r, step);

// ---- ブレを乗せる --------------------------------------------------------

function jitter(pts, seed, closed, opt) {
  const nx = noise(seed);
  const ny = noise(seed ^ 0x9e3779b9);
  const wave = opt.wavelength;

  // 短い線ほどブレを抑える。指1本のような小さい線が同じ幅で震えると潰れるため
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  const scale = Math.min(1, Math.max(0.3, total / 70));
  const amp = opt.amplitude * scale;
  const over = Math.min(opt.overshoot, total * 0.05);

  // 累積距離で雑音を引く（点の密度でブレの細かさが変わらないように）
  let acc = 0;
  const out = pts.map((p, i) => {
    if (i > 0) acc += dist(pts[i - 1], p);
    const u = acc / wave;
    // 閉じた線は始点と終点でブレを揃える（つなぎ目が段差にならない）
    const fade = closed ? Math.sin((i / (pts.length - 1)) * Math.PI) * 0.6 + 0.4 : 1;
    return { x: p.x + nx(u) * amp * fade, y: p.y + ny(u) * amp * fade };
  });
  if (closed) out[out.length - 1] = { ...out[0] };

  // 描き始め・描き終わりの行き過ぎ
  if (!closed && over > 0 && out.length > 2) {
    const r = rng(seed ^ 0x5bf03635);
    const ext = (a, b, k) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: b.x + ((b.x - a.x) / d) * k, y: b.y + ((b.y - a.y) / d) * k };
    };
    // 毎回行き過ぎると製図の見当線のように見えるので、ときどきだけ
    if (r() < opt.overshootChance) out[0] = ext(out[1], out[0], over * (0.3 + r() * 0.7));
    if (r() < opt.overshootChance) {
      out[out.length - 1] = ext(out[out.length - 2], out[out.length - 1], over * (0.3 + r() * 0.7));
    }
  }
  return out;
}

// ---- 折れ線をなめらかな曲線に戻す ----------------------------------------

const r1 = (n) => (Math.round(n * 10) / 10).toString();

function toPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return d;
}

// ---- SVG まるごと変換 ----------------------------------------------------

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const keep = (a) => Object.entries(a)
  .filter(([k]) => !['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points'].includes(k))
  .map(([k, v]) => `${k}="${v}"`).join(' ');

/**
 * 素の SVG を手書き化した SVG にする。
 * ルート要素・<title>・<desc>・コメントはそのまま残す。
 */
export function sketchSvg(svg, slug, opt = SKETCH) {
  let n = 0;
  const shape = /<(path|circle|ellipse|line|polyline)\b([^>]*)\/>/g;
  return svg.replace(shape, (_, name, rest) => {
    const a = attrs(`<${name}${rest}>`);
    const idx = n++;
    const subs = [];
    if (name === 'path') {
      for (const s of flatten(a.d, opt.step)) subs.push(s);
    } else if (name === 'circle') {
      subs.push({ pts: circleToPoints(+a.cx, +a.cy, +a.r, opt.step), closed: true });
    } else if (name === 'ellipse') {
      subs.push({ pts: ellipseToPoints(+a.cx, +a.cy, +a.rx, +a.ry, opt.step), closed: true });
    } else if (name === 'line') {
      subs.push({ pts: [{ x: +a.x1, y: +a.y1 }, ...line({ x: +a.x1, y: +a.y1 }, { x: +a.x2, y: +a.y2 }, opt.step)], closed: false });
    } else if (name === 'polyline') {
      const nums = (a.points.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      const pts = [];
      for (let i = 0; i < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
      subs.push({ pts, closed: false });
    }
    const out = [];
    for (let pass = 0; pass < opt.passes; pass++) {
      for (const [si, sub] of subs.entries()) {
        const seed = hash(`${slug}/${idx}/${si}/${pass}`);
        const d = toPath(jitter(sub.pts, seed, sub.closed, opt));
        if (d) out.push(`<path ${keep(a)} d="${d}"/>`);
      }
    }
    return out.join('\n  ');
  });
}
