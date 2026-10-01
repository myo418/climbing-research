/**
 * カードをジャンルごとの塊（クラスター）に散らす配置を、ビルド時に計算する。
 *
 * 行に流して折り返すと、札の大きさがまちまちでも結局は格子に見える。
 * ここでは1枚ずつの座標を出して、塊の中心付近は詰まり、外側はまばらになるようにする。
 *
 * 乱数は種から作る固定の式（card-paper.ts の rand）なので、
 * ビルドし直しても同じ配置が出る（差分が暴れない）。
 */
import { rand } from './card-paper';

/** 黄金角。同じ角度に揃わないので、回しながら置くと自然にばらける */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export type Sized = { w: number; h: number };
export type Placed<T> = T & { x: number; y: number };

export type Cluster<T extends Sized> = {
  key: string;
  items: T[];
  /** 塊の中心に空けておく場所。ジャンルの見出しを置くために使う */
  hole?: Sized;
};

export type ClusterLayout<T extends Sized> = {
  key: string;
  /** 塊の中心（面の左上からの座標） */
  cx: number;
  cy: number;
  /** 塊の半径。ジャンルの札をこの上に置く */
  r: number;
  cards: Placed<T>[];
};

export type Board<T extends Sized> = {
  width: number;
  height: number;
  clusters: ClusterLayout<T>[];
};

type Box = { w: number; h: number; x: number; y: number; gap: number; fixed?: boolean };

/** 中心から外へ、回しながら置く。半径のばらつきで粗密が出る */
function scatter(boxes: Box[], seed: number, spread: number) {
  boxes.forEach((b, i) => {
    const a = i * GOLDEN + rand(seed + i * 7) * 0.8;
    const r = spread * Math.sqrt(i + 0.55) * (0.70 + rand(seed + i * 13) * 0.66);
    // 塊は少し縦長にする。列に積むので、横に広いと面が横長になりすぎる
    b.x = Math.cos(a) * r * 0.82;
    b.y = Math.sin(a) * r * 1.18;
  });
}

/**
 * 重なりをほどく。浅く重なっている方向へ押し出すのを繰り返す。
 * 間隔は1組ずつ変えてあるので、くっついて見える札と離れて浮く札が混ざる。
 */
function relax(boxes: Box[], iterations: number) {
  for (let it = 0; it < iterations; it += 1) {
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const gap = Math.min(a.gap, b.gap);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 + gap - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + gap - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        // 動かさない箱が相手のときは、もう片方だけを押し出す
        const wa = a.fixed ? 0 : b.fixed ? 1 : 0.5;
        const wb = b.fixed ? 0 : a.fixed ? 1 : 0.5;
        if (ox < oy) {
          const push = ox * (dx < 0 ? -1 : 1);
          a.x -= push * wa;
          b.x += push * wb;
        } else {
          const push = oy * (dy < 0 ? -1 : 1);
          a.y -= push * wa;
          b.y += push * wb;
        }
      }
    }
  }
}

/**
 * 塊を詰める。中心へ少し引き寄せては重なりをほどく、を繰り返す。
 * 散らしただけだと隙間だらけになり、押し出すだけでは戻ってこない。
 * 引き寄せる量を距離に比例させているので、外側ほど大きく動いて塊になる。
 */
function pack(boxes: Box[]) {
  for (let it = 0; it < 48; it += 1) {
    for (const b of boxes) {
      if (b.fixed) continue;
      const d = Math.hypot(b.x, b.y) || 1;
      const pull = Math.min(16, d * 0.14);
      b.x -= (b.x / d) * pull;
      b.y -= (b.y / d) * pull;
    }
    relax(boxes, 3);
  }
  relax(boxes, 10);
}

/** 塊の外接矩形。中心からの広がりを縦横それぞれで測る */
function extentOf(boxes: Box[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const b of boxes) {
    w = Math.max(w, (Math.abs(b.x) + b.w / 2) * 2);
    h = Math.max(h, (Math.abs(b.y) + b.h / 2) * 2);
  }
  return { w, h };
}

/** 塊の外側の半径。中心からいちばん遠い札の角までの距離 */
function radiusOf(boxes: Box[]): number {
  return boxes.reduce(
    (max, b) => Math.max(max, Math.hypot(Math.abs(b.x) + b.w / 2, Math.abs(b.y) + b.h / 2)),
    0,
  );
}

export function layoutClusters<T extends Sized>(
  groups: Cluster<T>[],
  opts: { spread?: number; pad?: number; between?: number; headroom?: number; columns?: number } = {},
): Board<T> {
  const spread = opts.spread ?? 100;
  const pad = opts.pad ?? 60;
  // 塊どうしの隙間。ジャンルの境目が見えるだけ空ける
  const between = opts.between ?? 70;
  // ジャンルの札を置くぶん、塊の上に空けておく高さ
  const headroom = opts.headroom ?? 54;

  // 各ジャンルの中で散らす
  const laid = groups.map((g, gi) => {
    const seed = gi * 911 + 17;
    const boxes: Box[] = g.items.map((it, i) => ({
      w: it.w,
      h: it.h,
      x: 0,
      y: 0,
      // 1枚ずつ間隔を変える。詰まるところと空くところを作る
      gap: -6 + rand(seed + i * 29) * 34,
    }));
    scatter(boxes, seed, spread);
    // 中心にジャンルの見出しぶんの場所を取る。動かさない箱として混ぜておくと、
    // 詰めるときにカードがその周りへ回り込む
    const hole: Box | null = g.hole
      ? { w: g.hole.w, h: g.hole.h, x: 0, y: 0, gap: 18, fixed: true }
      : null;
    pack(hole ? [...boxes, hole] : boxes);
    const all = hole ? [...boxes, hole] : boxes;
    return { key: g.key, items: g.items, boxes, r: radiusOf(all), ext: extentOf(all) };
  });

  // 列に積んで並べる。いちばん大きい塊を真ん中の列に1つだけ置き、
  // 残りを左右の列へ、列の高さが揃うように振り分ける（左から 2・2・1・2・2 のような形）。
  // 渦に置くと塊の間が空きすぎて、全体を出したときに字が小さくなりすぎた。
  const columns = Math.max(1, opts.columns ?? 5);
  const mid = Math.floor(columns / 2);
  const bySize = [...laid].sort((a, b) => b.ext.w * b.ext.h - a.ext.w * a.ext.h);

  const cols: (typeof laid)[] = Array.from({ length: columns }, () => []);
  cols[mid].push(bySize[0]);
  const others = Array.from({ length: columns }, (_, i) => i).filter((i) => i !== mid);
  for (const g of bySize.slice(1)) {
    // いま合計の高さがいちばん低い列に足す
    const target = others.reduce((best, i) => {
      const hi = cols[i].reduce((sum, c) => sum + c.ext.h + between, 0);
      const hb = cols[best].reduce((sum, c) => sum + c.ext.h + between, 0);
      return hi < hb ? i : best;
    }, others[0]);
    cols[target].push(g);
  }

  const centers = new Map<string, { cx: number; cy: number }>();
  let x = 0;
  for (const col of cols) {
    if (col.length === 0) continue;
    const colW = Math.max(...col.map((g) => g.ext.w));
    const colH = col.reduce((sum, g, i) => sum + g.ext.h + (i ? between : 0), 0);
    let y = -colH / 2;
    for (const g of col) {
      centers.set(g.key, { cx: x + colW / 2, cy: y + g.ext.h / 2 });
      y += g.ext.h + between;
    }
    x += colW + between;
  }

  // 面の左上が (0, 0) になるように全体をずらす
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of laid) {
    const c = centers.get(g.key)!;
    for (const b of g.boxes) {
      minX = Math.min(minX, c.cx + b.x - b.w / 2);
      maxX = Math.max(maxX, c.cx + b.x + b.w / 2);
      minY = Math.min(minY, c.cy + b.y - b.h / 2);
      maxY = Math.max(maxY, c.cy + b.y + b.h / 2);
    }
    // ジャンルの札は塊の上に出る
    minY = Math.min(minY, c.cy - g.r - headroom);
  }

  const ox = pad - minX;
  const oy = pad - minY;

  const clusters: ClusterLayout<T>[] = laid.map((g) => {
    const c = centers.get(g.key)!;
    return {
      key: g.key,
      cx: c.cx + ox,
      cy: c.cy + oy,
      r: g.r,
      cards: g.items.map((it, i) => ({
        ...it,
        x: c.cx + ox + g.boxes[i].x - g.boxes[i].w / 2,
        y: c.cy + oy + g.boxes[i].y - g.boxes[i].h / 2,
      })),
    };
  });

  return {
    width: Math.round(maxX - minX + pad * 2),
    height: Math.round(maxY - minY + pad * 2),
    clusters,
  };
}
