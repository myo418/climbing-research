/**
 * 手で切った紙のような札の輪郭を作る。
 *
 * 「クライマー100人に聞いた」（/design/voices/）と「よくある会話」（/communication/common-talk/）の
 * カード表示が同じ形を使う。定義元はこのファイル1か所。
 *
 * 乱数は種から作る固定の式なので、ビルドし直しても同じ形・同じ散らばりが出る（差分が暴れない）。
 */

export function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

type Pt = [number, number];

/** V から T の方へ r だけ進んだ点。角を丸めるときの入り口・出口に使う */
function toward(v: Pt, t: Pt, r: number): Pt {
  const dx = t[0] - v[0];
  const dy = t[1] - v[1];
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(r, len / 2) / len;
  return [v[0] + dx * k, v[1] + dy * k];
}

/** 角を丸めた多角形のパス。各頂点を、手前で止めて → 頂点を制御点に曲げて → 次の辺へ、で繋ぐ */
function roundedPolygon(pts: Pt[], radii: number[]): string {
  const n = pts.length;
  const f = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const v = pts[i];
    const prev = pts[(i + n - 1) % n];
    const next = pts[(i + 1) % n];
    const a = toward(v, prev, radii[i]);
    const b = toward(v, next, radii[i]);
    d += `${i === 0 ? 'M' : 'L'}${f(a)}Q${f(v)} ${f(b)}`;
  }
  return `${d}Z`;
}

/**
 * 札1枚ぶんの輪郭。四角い角丸の七角形。
 * 四隅に加えて、四辺のうち三辺の途中に頂点を1つずつ置く（どの辺を飛ばすかは札ごとに違う）。
 * 辺の途中の頂点は大きく丸めるので、角ではなくゆるい膨らみ・へこみとして出る。
 */
export function cardShape(seed: number, w: number, h: number): string {
  const r = (i: number) => rand(seed * 41 + i);
  const ix = w * 0.05;
  const iy = h * 0.04;
  const clamp = (p: Pt): Pt => [
    Math.max(1, Math.min(w - 1, p[0])),
    Math.max(1, Math.min(h - 1, p[1])),
  ];

  const corners: Pt[] = [
    [8 + r(1) * ix, 8 + r(2) * iy],
    [w - 8 - r(3) * ix, 8 + r(4) * iy],
    [w - 8 - r(5) * ix, h - 8 - r(6) * iy],
    [8 + r(7) * ix, h - 8 - r(8) * iy],
  ];

  const skip = Math.floor(r(9) * 4); // 頂点を足さない辺
  const pts: Pt[] = [];
  const isCorner: boolean[] = [];

  for (let e = 0; e < 4; e++) {
    pts.push(corners[e]);
    isCorner.push(true);
    if (e === skip) continue;
    const a = corners[e];
    const b = corners[(e + 1) % 4];
    const t = 0.38 + r(10 + e) * 0.24;
    const push = (r(20 + e) * 2 - 1) * 7;
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    pts.push(
      clamp([
        a[0] + (b[0] - a[0]) * t + (nx / len) * push,
        a[1] + (b[1] - a[1]) * t + (ny / len) * push,
      ]),
    );
    isCorner.push(false);
  }

  const radii = pts.map((_, i) =>
    isCorner[i] ? 10 + rand(seed * 97 + i) * 26 : 34 + rand(seed * 97 + i) * 40,
  );
  return roundedPolygon(pts.map(clamp), radii);
}
