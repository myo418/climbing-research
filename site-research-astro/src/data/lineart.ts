// 線画の一覧。public/lineart/ の .svg と .png を拾う。
// - .svg（手で描いたもの）: <title> / <desc> / data-term を SVG 自身が持つ
// - .png（画像生成で作ったもの）: src/lineart/<slug>.prompt.txt の頭に書いた title / desc / term を読む
// どちらも「値の持ち主はファイル自身」にして、一覧表を二重に持たない。
import fs from 'node:fs';
import path from 'node:path';
import { CANVAS } from './lineart-style.mjs';

export interface LineArt {
  slug: string;
  /** 図の名前 */
  title: string;
  /** 一行の説明 */
  desc: string;
  /** 対応する用語集の slug */
  term?: string;
  /** svg = 手で描いた図 / png = 画像生成で作った図 */
  kind: 'svg' | 'png';
  /** 生成に使ったモデル（控えの model 行。手描きは undefined） */
  model?: string;
  /** 生成した日 */
  date?: string;
  canvas: 'square' | 'portrait' | 'wide' | 'unknown';
  width: number;
  height: number;
  /** public/ からの参照パス */
  src: string;
}

const DIR = path.resolve('public/lineart');
const SRC = path.resolve('src/lineart');

const pick = (svg: string, tag: string) =>
  svg.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? '';

/** PNG の IHDR から幅・高さを読む */
function pngSize(file: string): { width: number; height: number } {
  const buf = fs.readFileSync(file).subarray(16, 24);
  return { width: buf.readUInt32BE(0), height: buf.readUInt32BE(4) };
}

/** 生成時のメモ（src/lineart/<slug>.prompt.txt）の頭の `key: value` を読む */
function memo(slug: string): Record<string, string> {
  const file = path.join(SRC, `${slug}.prompt.txt`);
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^(title|desc|term|model|date):\s*(.+)$/);
    if (m) out[m[1]] = m[2].trim();
    if (!line.trim()) break;
  }
  return out;
}

function canvasOf(width: number, height: number): LineArt['canvas'] {
  const hit = Object.entries(CANVAS).find(
    ([, c]) => (c as { w: number; h: number }).w === width && (c as { w: number; h: number }).h === height,
  );
  if (hit) return hit[0] as LineArt['canvas'];
  if (width === height) return 'square';
  return height > width ? 'portrait' : 'wide';
}

function load(): LineArt[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.svg') || f.endsWith('.png'))
    .sort()
    .map((file) => {
      const slug = file.replace(/\.(svg|png)$/, '');
      const full = path.join(DIR, file);
      if (file.endsWith('.png')) {
        const { width, height } = pngSize(full);
        const m = memo(slug);
        return {
          slug, kind: 'png' as const,
          title: m.title || slug,
          desc: m.desc ?? '',
          term: m.term,
          model: m.model,
          date: m.date,
          canvas: canvasOf(width, height),
          width, height,
          src: `/lineart/${file}`,
        };
      }
      const svg = fs.readFileSync(full, 'utf8');
      const root = svg.match(/<svg[\s\S]*?>/)?.[0] ?? '';
      const vb = root.match(/viewBox="0 0 (\d+) (\d+)"/);
      const width = vb ? Number(vb[1]) : 0;
      const height = vb ? Number(vb[2]) : 0;
      return {
        slug, kind: 'svg' as const,
        title: pick(svg, 'title') || slug,
        desc: pick(svg, 'desc'),
        term: root.match(/data-term="([^"]+)"/)?.[1],
        canvas: canvasOf(width, height),
        width, height,
        src: `/lineart/${file}`,
      };
    });
}

export const lineart = load();
