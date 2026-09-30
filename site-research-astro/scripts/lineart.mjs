#!/usr/bin/env node
// 線画（public/lineart/*.svg）の道具。
//
//   node scripts/lineart.mjs prompt <slug> "<描くもの>" [--canvas square|portrait|wide] [--term <用語slug>]
//   node scripts/lineart.mjs gen <slug> "<日本語タイトル>" "<英語の被写体説明>"   画像生成で線画を作る（課金）
//     既定は gemini-2.5-flash（$0.039・品質の段階なし）。比率は --portrait / --landscape
//     --model openai にしたときだけ --quality low|medium|high が効く（$0.011/$0.042/$0.167）
//   node scripts/lineart.mjs regen <slug...>     控えの被写体文そのままで描き直す（課金）
//   node scripts/lineart.mjs lint [slug...]      スタイル定義に沿っているか検査する
//   node scripts/lineart.mjs build [slug...]     手のブレを乗せて public/lineart に出す
//   node scripts/lineart.mjs deblob [slug...]    黒ベタ（塗りつぶし）を見つけて輪郭に直す（無料・何度でも可）
//   node scripts/lineart.mjs models             使えるモデルの候補と、アカウントで実際に使えるものを出す
//   node scripts/lineart.mjs list                いま何があるか
//   node scripts/lineart.mjs preview [slug...]   目視確認用に PNG を書き出す（macOS の qlmanage）
//
// スタイルの値は src/data/lineart-style.mjs が持つ。この中に数値を直接書かない。

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CANVAS, PAD, COLORS, WIDTHS, DASH, RULES, REFERENCE_SLUGS, SRC_DIR, OUT_DIR, SKETCH, IMAGE_MODELS,
  OPENAI_QUALITY_COST,
  allowedColors, allowedWidths, allowedDashes, canvasList,
} from '../src/data/lineart-style.mjs';
import { sketchSvg } from './lineart-sketch.mjs';
import { generate, subjectOf, deblob } from './lineart-gen.mjs';
import { ensureCandidate, addCandidate } from './lineart-candidates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, SRC_DIR); // 素の線（編集する方）
const DIR = path.join(ROOT, OUT_DIR); // 手書き化したもの（生成物）
const GLOSSARY = path.join(ROOT, 'src/data/glossary.ts');

const BANNED_TAGS = ['text', 'tspan', 'style', 'script', 'image', 'filter', 'foreignObject', 'use', 'mask'];

const read = (slug) => fs.readFileSync(path.join(SRC, `${slug}.svg`), 'utf8');
const slugs = () =>
  fs.existsSync(SRC)
    ? fs.readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort()
    : [];

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const tagOf = (svg, name) => svg.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim();
const rootTag = (svg) => svg.match(/<svg[\s\S]*?>/)?.[0] ?? '';

function glossarySlugs() {
  if (!fs.existsSync(GLOSSARY)) return null;
  const src = fs.readFileSync(GLOSSARY, 'utf8');
  return new Set([...src.matchAll(/^\s*slug: '([^']+)'/gm)].map((m) => m[1]));
}

// ---------------------------------------------------------------- lint

function lintOne(slug) {
  const errors = [];
  const warns = [];
  const svg = read(slug);
  const root = rootTag(svg);
  const err = (m) => errors.push(m);
  const warn = (m) => warns.push(m);

  if (!/^[a-z0-9-]+$/.test(slug)) err(`ファイル名は英小文字・数字・ハイフンだけにする`);

  // ルート要素
  const vb = attr(root, 'viewBox');
  const canvas = canvasList().find((c) => vb === `0 0 ${c.w} ${c.h}`);
  if (!canvas) {
    err(`viewBox="${vb ?? '(なし)'}" は定義外。次のどれかにする: ` +
      canvasList().map((c) => `${c.key}="0 0 ${c.w} ${c.h}"`).join(' / '));
  }
  if (attr(root, 'width') || attr(root, 'height')) err('ルートに width/height を付けない（表示側で伸縮させる）');
  if (!attr(root, 'xmlns')) err('xmlns がない');
  if (attr(root, 'role') !== 'img') err('ルートに role="img" を付ける');
  if (attr(root, 'fill') !== 'none') err('ルートに fill="none" を付ける');
  if (attr(root, 'stroke-linecap') !== 'round') err('ルートに stroke-linecap="round" を付ける');
  if (attr(root, 'stroke-linejoin') !== 'round') err('ルートに stroke-linejoin="round" を付ける');

  // 説明
  if (!tagOf(svg, 'title')) err('<title> がない（図の名前）');
  if (!tagOf(svg, 'desc')) err('<desc> がない（一行の説明）');

  // 用語との紐づけ
  const term = attr(root, 'data-term');
  const known = glossarySlugs();
  if (term && known && !known.has(term)) warn(`data-term="${term}" は用語集(glossary.ts)に無い`);

  // 使ってよい値か
  for (const m of svg.matchAll(/stroke="([^"]*)"/g)) {
    if (!allowedColors().includes(m[1])) err(`stroke="${m[1]}" は定義外の色。使えるのは ${allowedColors().join(' / ')}`);
  }
  for (const m of svg.matchAll(/stroke-width="([^"]*)"/g)) {
    if (!allowedWidths().includes(m[1])) err(`stroke-width="${m[1]}" は定義外。使えるのは ${allowedWidths().join(' / ')}`);
  }
  for (const m of svg.matchAll(/stroke-dasharray="([^"]*)"/g)) {
    if (!allowedDashes().includes(m[1])) err(`stroke-dasharray="${m[1]}" は定義外。使えるのは ${allowedDashes().map((d) => `"${d}"`).join(' / ')}（隠れ線 / 軌跡）`);
  }
  // 面は塗らない。例外は点（しべ・ボルト・穴）＝ 半径2以下の circle だけ
  const dots = new Set(
    [...svg.matchAll(/<circle[^>]*>/g)]
      .filter((m) => Number(attr(m[0], 'r')) <= 2 && attr(m[0], 'fill') === COLORS.ink)
      .map((m) => m[0]),
  );
  const withoutDots = [...dots].reduce((acc, d) => acc.replace(d, ''), svg);
  for (const m of withoutDots.matchAll(/fill="([^"]*)"/g)) {
    if (m[1] !== 'none') err(`fill="${m[1]}" — 面は塗らない（塗ってよいのは半径2以下の点だけ）`);
  }
  for (const t of BANNED_TAGS) {
    if (new RegExp(`<${t}[\\s>/]`).test(svg)) err(`<${t}> は使わない`);
  }
  if (/\sopacity="|fill-opacity=|stroke-opacity=/.test(svg)) err('透明度は使わない（濃淡を作らない）');
  if (/font-/.test(svg)) err('図の中に文字を入れない');
  if (/transform="[^"]*scale/.test(svg)) err('scale() は線幅まで変えてしまうので使わない');

  // はみ出し（座標の粗いチェック）
  if (canvas) {
    // 半径（r / rx / ry）は座標ではないので、はみ出し判定から外す
    const nums = [...svg.matchAll(/(?:\sd|\scx|\scy|\sx|\sy|\sx1|\sy1|\sx2|\sy2|points)="([^"]*)"/g)]
      .flatMap((m) => [...m[1].matchAll(/-?\d+(?:\.\d+)?/g)].map((n) => Number(n[0])));
    const max = Math.max(canvas.w, canvas.h);
    const outside = nums.filter((n) => n < 0 || n > max);
    if (outside.length) warn(`キャンバスの外に出ている座標がある: ${[...new Set(outside)].slice(0, 6).join(', ')}`);
    const nearEdge = nums.filter((n) => n > 0 && n < PAD - 4);
    if (nearEdge.length) warn(`余白(${PAD})に食い込んでいる座標がある: ${[...new Set(nearEdge)].slice(0, 6).join(', ')}`);
  }

  // 注目色は1箇所だけ
  const accentCount = [...svg.matchAll(new RegExp(`stroke="${COLORS.accent}"`, 'g'))].length;
  if (accentCount > 8) warn(`注目色の線が ${accentCount} 本ある。1つの図で見せたいのは1箇所だけ`);

  const out = path.join(DIR, `${slug}.svg`);
  if (!fs.existsSync(out)) warn('手書き化した図がまだ無い（npm run lineart -- build）');
  else if (fs.statSync(out).mtimeMs < fs.statSync(path.join(SRC, `${slug}.svg`)).mtimeMs) {
    warn('素の線の方が新しい。作り直す（npm run lineart -- build）');
  }

  const lines = [...svg.matchAll(/<(path|line|polyline|circle|ellipse|rect)[\s>]/g)].length;
  if (lines > 40) warn(`図形が ${lines} 個ある。線が多すぎないか見直す`);

  return { slug, canvas: canvas?.key, lines, title: tagOf(svg, 'title'), errors, warns };
}

function lint(targets) {
  const list = targets.length ? targets : slugs();
  if (!list.length) return console.log('public/lineart に .svg がない');
  let bad = 0;
  for (const slug of list) {
    const r = lintOne(slug);
    const mark = r.errors.length ? '✗' : r.warns.length ? '!' : '✓';
    console.log(`${mark} ${slug}  ${r.canvas ?? '?'} / 図形${r.lines} / ${r.title ?? '(title なし)'}`);
    for (const e of r.errors) console.log(`    ✗ ${e}`);
    for (const w of r.warns) console.log(`    ! ${w}`);
    if (r.errors.length) bad++;
  }
  console.log(`\n${list.length} 件中 ${bad} 件に直すところがある`);
  if (bad) process.exitCode = 1;
}

// ---------------------------------------------------------------- prompt

function prompt(slug, subject, opts) {
  const canvasKey = opts.canvas ?? 'square';
  const c = CANVAS[canvasKey];
  if (!c) { console.error(`--canvas は ${Object.keys(CANVAS).join(' / ')} のどれか`); process.exit(1); }
  const refs = REFERENCE_SLUGS.filter((s) => fs.existsSync(path.join(DIR, `${s}.svg`)));

  const out = [];
  out.push('クライミングのリサーチサイトに載せる解説用の線画を1枚、SVGで描いてください。');
  out.push('');
  out.push('## 描くもの');
  out.push('');
  out.push(`- 図の名前: ${subject}`);
  out.push(`- 保存先: ${SRC_DIR}/${slug}.svg`);
  if (opts.term) out.push(`- 対応する用語: ${opts.term}（ルート要素に data-term="${opts.term}" を付ける）`);
  out.push(`- キャンバス: ${canvasKey} = viewBox="0 0 ${c.w} ${c.h}"（${c.label}）`);
  out.push(`- 図形は上下左右 ${PAD} の余白の内側に収める`);
  out.push('');
  out.push('## 守るスタイル');
  out.push('');
  RULES.forEach((r) => out.push(`- ${r}`));
  out.push('');
  out.push('## 値');
  out.push('');
  out.push('| 種類 | 値 |');
  out.push('|---|---|');
  out.push(`| 色 | 主線 \`${COLORS.ink}\` / 注目 \`${COLORS.accent}\` / 補助 \`${COLORS.muted}\` |`);
  out.push(`| 線幅 | 輪郭 \`${WIDTHS.main}\` / 内側の線 \`${WIDTHS.sub}\` / 奥のもの \`${WIDTHS.hair}\` |`);
  out.push(`| 破線 | 隠れ線 \`${DASH.hidden}\` / 軌跡・補助 \`${DASH.motion}\` |`);
  out.push('');
  if (refs.length) {
    out.push('## 手本');
    out.push('');
    out.push('既にあるこの図と、線の数・太さの配分・省略の度合いをそろえてください。');
    out.push('');
    for (const r of refs) {
      out.push(`### ${SRC_DIR}/${r}.svg`);
      out.push('');
      out.push('```svg');
      out.push(read(r).trimEnd());
      out.push('```');
      out.push('');
    }
  }
  out.push('## 描いたあと');
  out.push('');
  out.push(`1. \`${SRC_DIR}/${slug}.svg\` に保存する（素の線。手書き化は自分でやらない）`);
  out.push(`2. \`npm run lineart -- lint ${slug}\` を通す（✗ が出たら直す）`);
  out.push(`3. \`npm run lineart -- build ${slug}\` で手のブレを乗せた \`${OUT_DIR}/${slug}.svg\` を作る`);
  out.push(`4. \`npm run lineart -- preview ${slug}\` で書き出した PNG を実際に見て、何の図か分かるか確かめる。分からなければ線を足すのではなく、構図を変えるか線を減らす`);
  console.log(out.join('\n'));
}

// ---------------------------------------------------------------- gen（画像生成）

async function gen(args, opts) {
  const [slug, title, subject] = args;
  if (!slug || !title || !subject) {
    console.error('使い方: node scripts/lineart.mjs gen <slug> "<日本語のタイトル>" "<英語の被写体説明>" [--desc "説明"] [--term <用語slug>] [--model openai|gemini] [--quality low|medium|high] [--ref <slug>]');
    process.exit(1);
  }
  const model = opts.model ?? 'gemini-2.5-flash'; // 既定。安くて安定
  const m = IMAGE_MODELS[model];
  if (!m) { console.error(`--model は ${Object.keys(IMAGE_MODELS).join(' / ')}`); process.exit(1); }
  // --ref は自前の線画（slug）、--ref-file は任意のファイル（写真・手本の線画など）
  const refs = [
    ...(opts.ref ?? []).map((r) => path.join(DIR, `${r}.png`)),
    ...(opts.refFile ?? []).map((f) => path.resolve(ROOT, f)),
  ].filter((f) => fs.existsSync(f));
  // Gemini に品質の段階は無い（1枚あたり固定料金）。指定されていたら黙って捨てずに一言だけ言う
  if (m.api === 'gemini' && opts.quality) console.log('  （--quality は OpenAI 系のときだけ効く。今回は無視）');
  const est = m.api === 'gemini'
    ? m.cost
    : (m.cost === null ? null
      : OPENAI_QUALITY_COST[opts.quality ?? 'medium'] * ((opts.size ?? '1024x1024') === '1024x1024' ? 1 : 1.5));
  const shape = { '1024x1024': '正方形', '1024x1536': '縦長', '1536x1024': '横長' }[opts.size ?? '1024x1024'];
  const money = est === null ? '料金未確認' : `概算 $${est.toFixed(3)}`;
  console.log(`${m.id} で生成中… ${m.api === 'openai' ? `${opts.quality ?? 'medium'} / ` : ''}${shape} / ${money}`);
  const quality = opts.quality ?? 'medium';
  const size = opts.size ?? '1024x1024';
  // 今ある絵を案として残してから上書きする（CLI で出しても admin の履歴に並ぶ）
  ensureCandidate(ROOT, slug, subjectOf(
    fs.existsSync(path.join(SRC, `${slug}.prompt.txt`))
      ? fs.readFileSync(path.join(SRC, `${slug}.prompt.txt`), 'utf8') : '',
  ) ?? '');
  const { out, cost, prompt: sent, style } = await generate({
    slug, subject, model, quality, size, refs, srcDir: SRC, outDir: DIR,
  });
  addCandidate(ROOT, slug, out, {
    subject,
    meta: {
      prompt: sent, subject, style,
      model, modelId: m.id, modelLabel: `${m.label}（${m.provider}）`,
      quality: m.api === 'openai' ? quality : null,
      size, refs: opts.ref ?? [], cost: est, date: new Date().toISOString(),
    },
  });
  // タイトル・説明・用語はプロンプトのメモに書き足す（サイトはここを読む）
  const memo = path.join(SRC, `${slug}.prompt.txt`);
  const head = [`title: ${title}`, opts.desc ? `desc: ${opts.desc}` : '', opts.term ? `term: ${opts.term}` : '']
    .filter(Boolean).join('\n');
  fs.writeFileSync(memo, fs.readFileSync(memo, 'utf8').replace(/^# (.*)$/m, `# $1\n${head}`));
  console.log(`✓ ${path.relative(ROOT, out)}  ${est === null ? '（料金未確認のモデル）' : `実費 $${est.toFixed(3)}`}`);
  console.log(`  プロンプトの控え: ${path.relative(ROOT, memo)}`);
}

// ---------------------------------------------------------------- regen（同じ指示で描き直す）

async function regen(args, opts) {
  const list = args.length ? args : [];
  if (!list.length) {
    console.error('使い方: node scripts/lineart.mjs regen <slug> [slug...]   控えの被写体文そのままで描き直す');
    process.exit(1);
  }
  for (const slug of list) {
    const memo = path.join(SRC, `${slug}.prompt.txt`);
    if (!fs.existsSync(memo)) { console.log(`✗ ${slug}: 控えが無い`); process.exitCode = 1; continue; }
    const text = fs.readFileSync(memo, 'utf8');
    const subject = subjectOf(text);
    if (!subject) {
      console.log(`✗ ${slug}: 控えに被写体の節が無い（古い形式）。gen で作り直す`);
      process.exitCode = 1;
      continue;
    }
    const get = (k) => text.match(new RegExp(`^${k}: (.+)$`, 'm'))?.[1];
    await gen([slug, get('title') ?? slug, subject], {
      ...opts, desc: opts.desc ?? get('desc'), term: opts.term ?? get('term'),
    });
  }
}

// ---------------------------------------------------------------- deblob（黒ベタを輪郭に直す）

function deblobCmd(targets) {
  const pngs = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)) : [];
  const list = targets.length ? targets : pngs;
  let fixed = 0;
  for (const slug of list) {
    const f = path.join(DIR, `${slug}.png`);
    if (!fs.existsSync(f)) { console.log(`- ${slug}: 画像が無い`); continue; }
    if (deblob(f)) { console.log(`✓ ${slug}: 黒ベタを輪郭に直した`); fixed++; }
  }
  console.log(`\n${list.length} 枚中 ${fixed} 枚を直した（塗りの無いものは触っていない）`);
}

// ---------------------------------------------------------------- models（使えるモデルを実機に聞く）

async function models() {
  console.log('登録してある候補:');
  for (const [key, m] of Object.entries(IMAGE_MODELS)) {
    const price = typeof m.cost === 'number' ? `$${m.cost.toFixed(3)}${m.estimated ? '目安' : '    '}` : '料金不明';
    console.log(`  ${key.padEnd(22)} ${`${m.label}（${m.provider}）`.padEnd(30)} ${price}  ${m.note}`);
  }
  console.log('\nいまアカウントで使えるもの（APIに問い合わせ）:');
  if (process.env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    }).then((r) => r.json()).catch(() => null);
    const ids = (r?.data ?? []).map((m) => m.id).filter((id) => /image|dall/i.test(id)).sort();
    console.log('  OpenAI :', ids.join(', ') || '(取得できず)');
  }
  if (process.env.GEMINI_API_KEY) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=200`)
      .then((r) => r.json()).catch(() => null);
    const ids = (r?.models ?? []).map((m) => m.name.replace('models/', '')).filter((id) => /image|imagen/i.test(id)).sort();
    console.log('  Gemini :', ids.join(', ') || '(取得できず)');
  }
  console.log('\n候補に足すときは src/data/lineart-style.mjs の IMAGE_MODELS に追記する。');
}

// ---------------------------------------------------------------- build

function build(targets) {
  const list = targets.length ? targets : slugs();
  if (!list.length) return console.log(`${SRC_DIR} に .svg がない`);
  fs.mkdirSync(DIR, { recursive: true });
  for (const slug of list) {
    const src = read(slug);
    let out;
    try {
      out = sketchSvg(src, slug, SKETCH);
    } catch (e) {
      console.log(`✗ ${slug}  ${e.message}`);
      process.exitCode = 1;
      continue;
    }
    // XML のコメントに "--" は書けないので、作り直しかたは npm 越しでなく直接の呼び方で書く
    const header = `<!-- 生成物。編集するのは ${SRC_DIR}/${slug}.svg の方。作り直す: node scripts/lineart.mjs build ${slug} -->\n`;
    const svg = header + out;
    // コメントの中に "--" があると XML として壊れる（読み込んでも何も出ない）ので出す前に見る
    const badComment = [...svg.matchAll(/<!--([\s\S]*?)-->/g)].find((m) => m[1].includes('--'));
    if (badComment || !svg.trimEnd().endsWith('</svg>')) {
      console.log(`✗ ${slug}  壊れた SVG を出しかけた${badComment ? `（コメント内の "--": ${badComment[0].slice(0, 40)}…）` : ''}`);
      process.exitCode = 1;
      continue;
    }
    fs.writeFileSync(path.join(DIR, `${slug}.svg`), svg);
    console.log(`✓ ${OUT_DIR}/${slug}.svg`);
  }
}

// ---------------------------------------------------------------- preview / list

function preview(targets) {
  const list = targets.length ? targets : slugs();
  const outDir = path.join(ROOT, '.lineart-preview');
  fs.mkdirSync(outDir, { recursive: true });
  const missing = list.filter((s) => !fs.existsSync(path.join(DIR, `${s}.svg`)));
  if (missing.length) build(missing);
  const files = list.map((s) => path.join(DIR, `${s}.svg`));
  execFileSync('qlmanage', ['-t', '-s', '440', '-o', outDir, ...files], { stdio: 'ignore' });
  for (const s of list) console.log(path.join(outDir, `${s}.svg.png`));
}

function list() {
  const rows = [];
  // 手で描いたもの
  for (const s of slugs()) {
    const svg = read(s);
    rows.push({ slug: s, kind: '手描き', title: tagOf(svg, 'title') ?? '', term: attr(rootTag(svg), 'data-term') });
  }
  // 画像生成で作ったもの
  const pngs = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.png')) : [];
  for (const f of pngs) {
    const slug = f.slice(0, -4);
    const memo = path.join(SRC, `${slug}.prompt.txt`);
    const head = fs.existsSync(memo) ? fs.readFileSync(memo, 'utf8') : '';
    const get = (k) => head.match(new RegExp(`^${k}: (.+)$`, 'm'))?.[1];
    rows.push({ slug, kind: '生成', title: get('title') ?? '', term: get('term') });
  }
  if (!rows.length) return console.log('まだ1枚もない');
  for (const r of rows.sort((a, b) => a.slug.localeCompare(b.slug))) {
    console.log(`${r.slug.padEnd(14)} ${r.kind.padEnd(4)} ${(r.title || '').padEnd(12)}${r.term ? ` → 用語 ${r.term}` : ''}`);
  }
  console.log(`\n${rows.length} 枚`);
}

// ---------------------------------------------------------------- cli

const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--canvas') opts.canvas = rest[++i];
  else if (rest[i] === '--term') opts.term = rest[++i];
  else if (rest[i] === '--desc') opts.desc = rest[++i];
  else if (rest[i] === '--model') opts.model = rest[++i];
  else if (rest[i] === '--quality') opts.quality = rest[++i];
  else if (rest[i] === '--size') opts.size = rest[++i];
  else if (rest[i] === '--portrait') opts.size = '1024x1536';
  else if (rest[i] === '--landscape') opts.size = '1536x1024';
  else if (rest[i] === '--ref') (opts.ref ??= []).push(rest[++i]);
  else if (rest[i] === '--ref-file') (opts.refFile ??= []).push(rest[++i]);
  else args.push(rest[i]);
}

switch (cmd) {
  case 'prompt':
    if (!args[0] || !args[1]) {
      console.error('使い方: node scripts/lineart.mjs prompt <slug> "<描くもの>" [--canvas square|portrait|wide] [--term <用語slug>]');
      process.exit(1);
    }
    prompt(args[0], args[1], opts);
    break;
  case 'gen': await gen(args, opts); break;
  case 'regen': await regen(args, opts); break;
  case 'build': build(args); break;
  case 'models': await models(); break;
  case 'deblob': deblobCmd(args); break;
  case 'lint': lint(args); break;
  case 'preview': preview(args); break;
  case 'list': list(); break;
  default:
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
