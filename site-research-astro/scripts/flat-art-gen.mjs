// カードに載せる平面イラストを作る処理。入口は awkward-art.mjs / common-action-art.mjs。
//
// 絵の組（被写体・スタイル・出力先）だけが違って、生成と webp 作りの手順は同じなので
// ここ1か所に置いている。入口はどの組を渡すかだけを決める。

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { IMAGE_MODELS } from '../src/data/lineart-style.mjs';

const MODEL = IMAGE_MODELS['gemini-2.5-flash'];
const CONCURRENCY = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 原本の png から、サイトが読む webp を作る。生成のたびに最後に走る。
 *
 * 外周の無地を落としてから縮める。モデルが描く地色（#FCF4E3 前後）は
 * サイトのカードの地色（#F2F1EC）と微妙に違うので、そのまま載せると
 * 絵の周りに色違いの縁が出る。絵の内側にも余白が入るので、削ると絵が大きくなる。
 */
function buildWeb({ outDir, webMax, force }) {
  if (!fs.existsSync(outDir)) return;
  let made = 0;
  for (const f of fs.readdirSync(outDir).filter((f) => f.endsWith('.png'))) {
    const src = path.join(outDir, f);
    const out = src.replace(/\.png$/, '.webp');
    if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    execFileSync('magick', [
      src,
      '-fuzz', '4%', '-trim', '+repage',
      '-resize', `${webMax}x${webMax}>`,
      '-quality', '86',
      out,
    ]);
    made += 1;
  }
  console.log(`webp を ${made} 枚作った`);
  buildMono({ outDir, webMax, force });
}

/**
 * 白黒版。原本の png から作る。色は捨てるが、青とテラコッタが同じ明度で
 * 潰れるので、少しだけコントラストを立ててから落とす。
 */
function buildMono({ outDir, webMax, force }) {
  if (!fs.existsSync(outDir)) return;
  const dir = path.join(outDir, 'mono');
  fs.mkdirSync(dir, { recursive: true });
  let made = 0;
  for (const f of fs.readdirSync(outDir).filter((f) => f.endsWith('.png'))) {
    const src = path.join(outDir, f);
    const out = path.join(dir, f.replace(/\.png$/, '.webp'));
    if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    execFileSync('magick', [
      src,
      '-fuzz', '4%', '-trim', '+repage',
      '-colorspace', 'Gray',
      '-sigmoidal-contrast', '3,50%',
      '-resize', `${webMax}x${webMax}>`,
      '-quality', '86',
      out,
    ]);
    made += 1;
  }
  console.log(`白黒の webp を ${made} 枚作った`);
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

/**
 * 絵の組をひとつ作る。
 *
 * 既にあるファイルは飛ばすので、途中で止めてもう一度回しても二重に課金されない。
 * 引数の意味は各入口スクリプトの冒頭に書いてある。
 */
export async function run({ subjects, style, gym, outDir, webMax, argv }) {
  const args = argv.filter((a) => a !== '--');
  const force = args.includes('--force');
  const webOnly = args.includes('--web');
  const monoOnly = args.includes('--mono');
  const wantSlugs = args.filter((a) => !a.startsWith('--'));

  if (monoOnly) {
    buildMono({ outDir, webMax, force });
    return;
  }
  if (webOnly) {
    buildWeb({ outDir, webMax, force });
    return;
  }

  const jobs = [];
  for (const s of subjects) {
    if (wantSlugs.length && !wantSlugs.includes(s.slug)) continue;
    const out = path.join(outDir, `${s.slug}.png`);
    if (!force && fs.existsSync(out)) continue;
    jobs.push({ slug: s.slug, jp: s.jp, out, prompt: `${s.subject} ${gym}\n\n${style}` });
  }

  if (!jobs.length) {
    console.log('作るものがない（既に全部ある。描き直すなら --force）');
    return;
  }

  const total = (jobs.length * MODEL.cost).toFixed(2);
  console.log(`${jobs.length} 枚を ${MODEL.label} で作る（$${MODEL.cost}/枚 × ${jobs.length} = 約 $${total}）\n`);

  fs.mkdirSync(outDir, { recursive: true });

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

  buildWeb({ outDir, webMax, force });
}
