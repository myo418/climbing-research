// 動きの可視化（move-visualizer）の動画一覧。
// 実体は scripts/move-visualizer.mjs が書き出した move-visualizer.json。
// 動画そのものは Cloudflare R2 にあり、ここに載る src / poster は絶対URL。
import fs from 'node:fs';
import path from 'node:path';

export type MoveVideoKind = 'pointlight' | 'silhouette' | 'grid';

export interface MoveVideo {
  kind: MoveVideoKind;
  /** 元動画のクリップ番号（C0598 など）。grid は動画名 */
  id: string;
  label: string;
  src: string;
  poster: string;
  width: number;
  height: number;
  /** 秒 */
  duration: number;
  bytes: number;
}

/** 同じクリップのポイントライトとシルエットを組にしたもの */
export interface MoveClip {
  id: string;
  pointlight?: MoveVideo;
  silhouette?: MoveVideo;
  duration: number;
}

const FILE = path.resolve('src/data/move-visualizer.json');

function load(): MoveVideo[] {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, 'utf8')) as MoveVideo[];
}

export const moveVideos = load();

export const moveGrids = moveVideos.filter((v) => v.kind === 'grid');

/** クリップ番号で組にする。片方しか無くても出す */
export const moveClips: MoveClip[] = (() => {
  const byId = new Map<string, MoveClip>();
  for (const v of moveVideos) {
    if (v.kind === 'grid') continue;
    const clip = byId.get(v.id) ?? { id: v.id, duration: 0 };
    clip[v.kind as 'pointlight' | 'silhouette'] = v;
    clip.duration = Math.max(clip.duration, v.duration);
    byId.set(v.id, clip);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
})();

export const totalBytes = moveVideos.reduce((n, v) => n + v.bytes, 0);
