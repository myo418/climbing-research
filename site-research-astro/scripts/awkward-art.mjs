// 「気まずい瞬間」の絵を作る。
//
//   node scripts/awkward-art.mjs                    全部（既にあるものは飛ばす）
//   node scripts/awkward-art.mjs sitting-on-pad     slug を指定して1枚だけ
//   node scripts/awkward-art.mjs --force <slug>     既にあるものも描き直す（課金される）
//   node scripts/awkward-art.mjs --web              生成はせず webp だけ作り直す
//
// 既にあるファイルは飛ばすので、途中で止めてもう一度回しても二重に課金されない。
// スタイル文と被写体文は src/data/awkward-art.mjs が持つ。ここには書かない。

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SUBJECTS, AWKWARD_STYLE, GYM, OUT_DIR, WEB_MAX } from '../src/data/awkward-art.mjs';
import { IMAGE_MODELS } from '../src/data/lineart-style.mjs';

const MODEL = IMAGE_MODELS['gemini-2.5-flash'];
const CONCURRENCY = 4;

const args = process.argv.slice(2).filter((a) => a !== '--');
const force = args.includes('--force');
const webOnly = args.includes('--web');
const wantSlugs = args.filter((a) => !a.startsWith('--'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 原本の png から、サイトが読む webp を作る。生成のたびに最後に走る */
function buildWeb() {
  if (!fs.existsSync(OUT_DIR)) return;
  let made = 0;
  for (const f of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'))) {
    const src = path.join(OUT_DIR, f);
    const out = src.replace(/\.png$/, '.webp');
    if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    execFileSync('magick', [src, '-resize', `${WEB_MAX}x${WEB_MAX}>`, '-quality', '86', out]);
    made += 1;
  }
  console.log(`webp を ${made} 枚作った`);
}

if (webOnly) {
  buildWeb();
  process.exit(0);
}

async function once(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY がない');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL.id}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: '1:1' } },
    }),
  });
  const j = await r.json();
  const part = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) {
    const why = j?.candidates?.[0]?.finishReason ?? JSON.stringify(j).slice(0, 200);
    throw new Error(`画像が返らなかった（${why}）`);
  }
  return Buffer.from(part.inlineData.data, 'base64');
}

/** 通信は時々こける。3回まで待って試す */
async function generate(prompt) {
  let last;
  for (let i = 0; i < 3; i += 1) {
    try {
      return await once(prompt);
    } catch (e) {
      last = e.cause?.code ? new Error(`${e.message} (${e.cause.code})`) : e;
      await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

const jobs = [];
for (const s of SUBJECTS) {
  if (wantSlugs.length && !wantSlugs.includes(s.slug)) continue;
  const out = path.join(OUT_DIR, `${s.slug}.png`);
  if (!force && fs.existsSync(out)) continue;
  jobs.push({ slug: s.slug, jp: s.jp, out, prompt: `${s.subject} ${GYM}\n\n${AWKWARD_STYLE}` });
}

if (!jobs.length) {
  console.log('作るものがない（既に全部ある。描き直すなら --force）');
  process.exit(0);
}

const total = (jobs.length * MODEL.cost).toFixed(2);
console.log(`${jobs.length} 枚を ${MODEL.label} で作る（$${MODEL.cost}/枚 × ${jobs.length} = 約 $${total}）\n`);

fs.mkdirSync(OUT_DIR, { recursive: true });

let done = 0;
let failed = 0;
const queue = [...jobs];

async function worker() {
  while (queue.length) {
    const job = queue.shift();
    try {
      const buf = await generate(job.prompt);
      fs.writeFileSync(job.out, buf);
      done += 1;
      console.log(`  [${done + failed}/${jobs.length}] ${job.jp} → ${job.out}`);
    } catch (e) {
      failed += 1;
      console.log(`  [${done + failed}/${jobs.length}] ✗ ${job.jp}: ${String(e.message).slice(0, 160)}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\n${done} 枚できた${failed ? ` / ${failed} 枚失敗（もう一度回せば失敗分だけ作り直す）` : ''}`);
console.log(`実費の目安: 約 $${(done * MODEL.cost).toFixed(2)}`);

buildWeb();
