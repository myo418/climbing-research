// move-visualizer の書き出し動画を、サイトに載せられる形に変換して Cloudflare R2 に置く。
//
// 元動画（~/git/move-visualizer/output/）はこのリポジトリには入れない。
// 変換した mp4 と静止画も R2 に上げるので、リポジトリには入らない。
// コミットするのは一覧（src/data/move-visualizer.json）だけで、そこにR2のURLが載る。
//
// 変換が要る理由は2つある:
//  1. ポイントライト映像は mpeg4（MPEG-4 Part 2）で書き出されていて、ブラウザが再生できない。
//     H.264 への変換が必須。
//  2. 黒背景＋白点という中身のおかげで H.264 だと極端に軽くなる（実測 7.2MB → 0.4MB）。
//     等倍・60fps のまま載せられる。
//
// 使い方:
//   node scripts/move-visualizer.mjs             変換して、作り直した分だけR2に上げる
//   node scripts/move-visualizer.mjs --force     変換をやり直す
//   node scripts/move-visualizer.mjs --upload-all 変換済みのものも含めて全部上げ直す
//   node scripts/move-visualizer.mjs --no-upload  変換だけして上げない
//   MOVE_VISUALIZER_DIR=<path> を渡せば元動画の場所を変えられる
//
// R2には CLOUDFLARE_API_TOKEN（R2 Edit権限つき）と CLOUDFLARE_ACCOUNT_ID で繋ぐ。
// どちらも ~/.zshrc に置いてある。バケットと公開URLは R2_BUCKET / R2_PUBLIC_BASE で変えられる。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SRC = process.env.MOVE_VISUALIZER_DIR ?? path.join(os.homedir(), 'git/move-visualizer/output');
// 変換したものの置き場。R2に上げたあとも変換をやり直さずに済むよう手元に残す。
// public/ ではなくここに置く。もう配信しないので dist にコピーされる必要がない
const OUT = path.resolve('.move-visualizer-cache');
// サイトが読む一覧。中身はR2のURLなので、これだけコミットする
const MANIFEST = path.resolve('src/data/move-visualizer.json');
const FORCE = process.argv.includes('--force');
const UPLOAD_ALL = process.argv.includes('--upload-all');
const NO_UPLOAD = process.argv.includes('--no-upload');

const BUCKET = process.env.R2_BUCKET ?? 'climbing-research';
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? 'https://pub-461fd1bfecdb44ea8e0f3d71c8e0bcc1.r2.dev').replace(/\/$/, '');
const PREFIX = 'move-visualizer';

// grid_original_* は元映像そのもので、ジムに居合わせた人の顔が写るコマがある。
// 可視化を通していない素材なのでサイトには出さない。載せるなら本人の許諾が要る。
const EXCLUDE = /^grid_original_/;

/**
 * 種別ごとの変換設定。ポイントライトは中身が軽いので等倍のまま。
 * `scale` は幅を指定する。縦位置のクリップが混ざる種別では `box` を使う——
 * 幅で指定すると 1080x1920 が 1280x2276 に引き伸ばされてしまうため。
 */
const PROFILES = {
  pointlight: { crf: 26, preset: 'slow' },
  silhouette: { crf: 28, preset: 'medium', scale: 720 },
  grid: { crf: 26, preset: 'slow' },
  // 元映像はカメラ出しのまま（実測 51.6Mbps）なので落とし幅が大きい。
  // 点の動きと見比べるものなので 60fps は保つ
  original: { crf: 24, preset: 'slow', box: 1280 },
};

const LABELS = {
  pointlight: 'ポイントライト',
  silhouette: 'シルエット',
  grid: '一覧',
  original: '元映像',
};

function ffprobe(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]).toString().trim().split('\n');
  return { width: Number(out[0]), height: Number(out[1]), duration: Number(out[2]) };
}

function encode(src, dest, profile) {
  // box は縦横どちらが長くてもその中に収める。decrease なので元より大きくならない
  const filter = profile.box
    ? `scale=w=${profile.box}:h=${profile.box}:force_original_aspect_ratio=decrease:force_divisible_by=2`
    : profile.scale
      ? `scale=${profile.scale}:-2`
      : null;
  const vf = filter ? ['-vf', filter] : [];
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', src,
    ...vf,
    '-c:v', 'libx264',
    '-preset', profile.preset,
    '-crf', String(profile.crf),
    '-pix_fmt', 'yuv420p',   // 古い端末でも再生できる形式に揃える
    '-an',                   // 音声は無い（元から無音、あっても使わない）
    '-movflags', '+faststart', // 先頭にメタデータを置き、落とし切る前に再生を始められるようにする
    dest,
  ]);
}

/** 静止画のポスター。再生前に真っ黒のままだと何の動画か分からないので、中盤のコマを使う */
function poster(src, dest, duration) {
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-ss', String(Math.max(0, duration * 0.45)),
    '-i', src,
    '-frames:v', '1',
    '-vf', 'scale=480:-2',
    '-q:v', '5',
    dest,
  ]);
}

/** R2に1ファイル置く。CloudflareのREST APIを直接叩くので wrangler は要らない */
async function put(file, key, contentType) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_API_TOKEN が要る（~/.zshrc）');
  }
  // APIはキー全体をURLの1区切りとして受け取るので、中の / は %2F に直す。
  // そうして置いたものが、公開URLでは move-visualizer/pointlight/C0598.mp4 として出る
  const encoded = key.split('/').map(encodeURIComponent).join('%2F');
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${account}` +
    `/r2/buckets/${BUCKET}/objects/${encoded}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: fs.readFileSync(file),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(`R2への書き込みに失敗: ${key}  ${JSON.stringify(body?.errors ?? res.status)}`);
  }
}

/** 変換対象を集める。返り値は { kind, id, src } の配列 */
function collect() {
  const jobs = [];
  const at = (...p) => path.join(SRC, ...p);

  for (const f of fs.readdirSync(SRC).sort()) {
    if (EXCLUDE.test(f)) continue;
    let m;
    if ((m = f.match(/^(C\d+)_pointlight\.mp4$/))) jobs.push({ kind: 'pointlight', id: m[1], src: at(f) });
    else if ((m = f.match(/^(grid_.+)\.mp4$/))) jobs.push({ kind: 'grid', id: m[1], src: at(f) });
  }
  const silDir = at('silhouette');
  if (fs.existsSync(silDir)) {
    for (const f of fs.readdirSync(silDir).sort()) {
      const m = f.match(/^(C\d+)_silhouette\.mp4$/);
      if (m) jobs.push({ kind: 'silhouette', id: m[1], src: path.join(silDir, f) });
    }
  }

  // 元映像は output/ の隣の original/ にある。手元には可視化していないものも多数あるので、
  // ポイントライトが出来ているクリップだけを載せる
  const origDir = path.join(SRC, '..', 'original');
  if (fs.existsSync(origDir)) {
    const visualized = new Set(jobs.filter((j) => j.kind === 'pointlight').map((j) => j.id));
    for (const f of fs.readdirSync(origDir).sort()) {
      const m = f.match(/^(C\d+)\.MP4$/i);
      if (m && visualized.has(m[1])) {
        jobs.push({ kind: 'original', id: m[1], src: path.join(origDir, f) });
      }
    }
  }
  return jobs;
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`元動画が見つからない: ${SRC}`);
    console.error('MOVE_VISUALIZER_DIR で場所を指定できる。');
    process.exit(1);
  }
  const jobs = collect();
  if (!jobs.length) {
    console.error(`変換対象が無い: ${SRC}`);
    process.exit(1);
  }

  const entries = [];
  let made = 0, skipped = 0, sent = 0, bytesIn = 0, bytesOut = 0;

  for (const job of jobs) {
    const dir = path.join(OUT, job.kind);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `${job.id}.mp4`);
    const pos = path.join(dir, `${job.id}.jpg`);

    const srcStat = fs.statSync(job.src);
    const fresh =
      !FORCE &&
      fs.existsSync(dest) &&
      fs.existsSync(pos) &&
      fs.statSync(dest).mtimeMs > srcStat.mtimeMs;

    if (fresh) {
      skipped++;
    } else {
      encode(job.src, dest, PROFILES[job.kind]);
      poster(dest, pos, ffprobe(dest).duration);
      made++;
      const a = srcStat.size, b = fs.statSync(dest).size;
      console.log(
        `  ${job.kind}/${job.id}  ${(a / 1048576).toFixed(2)}MB → ${(b / 1048576).toFixed(2)}MB`,
      );
    }
    // 変換し直したものだけ上げる。R2にまだ無いものを入れ直したいときは --upload-all
    const key = `${PREFIX}/${job.kind}/${job.id}`;
    if (!NO_UPLOAD && (!fresh || UPLOAD_ALL)) {
      await put(dest, `${key}.mp4`, 'video/mp4');
      await put(pos, `${key}.jpg`, 'image/jpeg');
      sent++;
    }

    const info = ffprobe(dest);
    bytesIn += srcStat.size;
    bytesOut += fs.statSync(dest).size;
    entries.push({
      kind: job.kind,
      id: job.id,
      label: LABELS[job.kind],
      src: `${PUBLIC_BASE}/${key}.mp4`,
      poster: `${PUBLIC_BASE}/${key}.jpg`,
      width: info.width,
      height: info.height,
      duration: Number(info.duration.toFixed(1)),
      bytes: fs.statSync(dest).size,
    });
  }

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + '\n');
  console.log(
    `\n${entries.length} 本（変換 ${made} / 据え置き ${skipped}）  ` +
      `${(bytesIn / 1048576).toFixed(1)}MB → ${(bytesOut / 1048576).toFixed(1)}MB`,
  );
  console.log(
    NO_UPLOAD
      ? 'R2には上げていない（--no-upload）'
      : `R2に ${sent} 本（mp4と静止画で ${sent * 2} ファイル）を置いた  ${PUBLIC_BASE}/${PREFIX}/`,
  );
}

await main();
