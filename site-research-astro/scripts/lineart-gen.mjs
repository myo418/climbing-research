// 画像生成で線画を作る。
//
// スタイル文（IMAGE_STYLE）とモデル一覧は src/data/lineart-style.mjs が持つ。ここには書かない。
// 生成したものは public/lineart/<slug>.png、投げたプロンプトは src/lineart/<slug>.prompt.txt に残す
// （同じ指示で描き直せるように）。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { IMAGE_STYLE, IMAGE_MODELS } from '../src/data/lineart-style.mjs';

export const SUBJECT_MARK = '--- 描くもの（ここを書き換えて描き直す）---';
export const STYLE_MARK = '--- スタイル（lineart-style.mjs の IMAGE_STYLE。手で直さない）---';

/** 控えファイルから被写体文を取り出す。無ければ null */
export function subjectOf(memoText) {
  const m = memoText.split(SUBJECT_MARK)[1];
  return m ? m.split(STYLE_MARK)[0].trim() : null;
}

const endpoints = {
  openai: 'https://api.openai.com/v1/images/generations',
  openaiEdit: 'https://api.openai.com/v1/images/edits',
  gemini: (id, key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent?key=${key}`,
};

function buildPrompt(subject) {
  return `${subject}\n\n${IMAGE_STYLE}`;
}

async function openai(prompt, { model = 'gpt-image-1', quality = 'medium', size = '1024x1024', refs = [] }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY がない');
  if (refs.length) {
    // 既に通った図を手本として渡す（スタイルを揃えるため）
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('quality', quality);
    form.append('background', 'transparent');
    for (const f of refs) {
      form.append('image[]', new Blob([fs.readFileSync(f)], { type: 'image/png' }), path.basename(f));
    }
    const r = await fetch(endpoints.openaiEdit, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    const j = await r.json();
    if (!j.data) throw new Error(JSON.stringify(j).slice(0, 400));
    return Buffer.from(j.data[0].b64_json, 'base64');
  }
  const r = await fetch(endpoints.openai, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, prompt, size, quality, background: 'transparent', n: 1,
    }),
  });
  const j = await r.json();
  if (!j.data) throw new Error(JSON.stringify(j).slice(0, 400));
  return Buffer.from(j.data[0].b64_json, 'base64');
}

// Gemini には品質の段階が無い（1枚あたり固定料金）。縦横比だけ imageConfig で指定できる
const ASPECT = { '1024x1024': '1:1', '1024x1536': '2:3', '1536x1024': '3:2' };

async function gemini(prompt, { model = 'gemini-2.5-flash-image', refs = [], size = '1024x1024' } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY がない');
  // 手本や元写真は inlineData で一緒に送る
  const mime = (f) => (/\.jpe?g$/i.test(f) ? 'image/jpeg' : /\.webp$/i.test(f) ? 'image/webp' : 'image/png');
  const parts = [
    { text: prompt },
    ...refs.map((f) => ({ inlineData: { mimeType: mime(f), data: fs.readFileSync(f).toString('base64') } })),
  ];
  const r = await fetch(endpoints.gemini(model, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { imageConfig: { aspectRatio: ASPECT[size] ?? '1:1' } },
    }),
  });
  const j = await r.json();
  const part = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(JSON.stringify(j).slice(0, 400));
  return Buffer.from(part.inlineData.data, 'base64');
}

/**
 * 黒ベタ（面を塗りつぶした箇所）を輪郭に変える。
 *
 * 線は細く、塗りは太いという性質を使う:
 *   1. 描かれている部分を4px削る → 線は消え、塗りつぶしの内側だけが残る
 *   2. それを1px戻す → 塗りの内側（輪郭の1〜3px内側まで）が求まる
 *   3. その内側を消す → 塗りが輪郭だけになり、線画は無傷で残る
 *
 * 指示で禁止しても時々出るので、出力の側で機械的に直す。
 * 戻り値は直したかどうか。
 */
export function deblob(file) {
  const solidRatio = (f) =>
    Number(execFileSync('magick', [
      f, '-alpha', 'extract', '-threshold', '50%', '-morphology', 'Erode', 'Disk:3',
      '-format', '%[fx:mean*100]', 'info:',
    ], { encoding: 'utf8' }));

  try {
    if (solidRatio(file) < 0.5) return false;   // 線だけ。触らない
    const mask = path.join(os.tmpdir(), `deblob-${Date.now()}.png`);
    // 描かれている部分から「塗りの内側」を引いた透明度を作る
    execFileSync('magick', [
      file, '-alpha', 'extract', '-threshold', '50%',
      '(', '+clone', '-morphology', 'Erode', 'Disk:4', '-morphology', 'Dilate', 'Disk:1', '-negate', ')',
      '-compose', 'Darken', '-composite', mask,
    ]);
    execFileSync('magick', [file, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', file]);
    fs.unlinkSync(mask);
    return true;
  } catch {
    return false;
  }
}

/**
 * 出力を揃える。
 * 1. 白（と白に近い塗り）を透明にする — サイトの生成り色の背景に白い板が乗るのを防ぐ
 * 2. 余白を落として一定の余白を付け直す
 * 3. 長辺1200pxに揃える
 */
export function normalize(file) {
  try {
    // まれに白黒が反転した絵（黒地に白線）が返る。そのままだと白を透明化する処理が壊れるので直す
    const brightness = Number(execFileSync('magick', [
      file, '-background', 'white', '-flatten', '-colorspace', 'gray', '-format', '%[fx:mean]', 'info:',
    ], { encoding: 'utf8' }));
    if (brightness < 0.45) {
      console.log('  （白黒が反転していたので戻した）');
      execFileSync('magick', [file, '-background', 'white', '-flatten', '-negate', file]);
    }
    execFileSync('magick', [
      file, '-fuzz', '12%', '-transparent', 'white',
      '-trim', '+repage',
      '-bordercolor', 'none', '-border', '24',
      '-resize', '1200x1200>', file,
    ]);
    if (deblob(file)) console.log('  （黒ベタを見つけたので輪郭に直した）');
  } catch (e) {
    console.log('  (magick が無いので整形は省略)');
  }
}

export async function generate({ slug, subject, model = 'gemini-2.5-flash', quality = 'medium', size = '1024x1024', refs = [], srcDir, outDir }) {
  const m = IMAGE_MODELS[model];
  if (!m) throw new Error(`model は ${Object.keys(IMAGE_MODELS).join(' / ')}`);
  const prompt = buildPrompt(subject);
  const png = m.api === 'gemini'
    ? await gemini(prompt, { model: m.id, refs, size })
    : await openai(prompt, { model: m.id, quality, size, refs });
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${slug}.png`);
  fs.writeFileSync(out, png);
  normalize(out);
  // 控え。被写体文とスタイル文を別の節に分けて書く。
  // 一続きにすると、描き直すときにどこからどこまでが被写体か機械的に取り出せない。
  const head = [
    `# ${slug}`,
    `model: ${m.id}${m.api === 'openai' ? ` (quality=${quality} size=${size})` : ` (${ASPECT[size] ?? '1:1'})`}`,
    refs.length && model === 'gemini' ? `※ 参照画像つき` : null,
    `date: ${new Date().toISOString().slice(0, 10)}`,
    refs.length ? `refs: ${refs.map((f) => path.basename(f)).join(', ')}` : null,
  ].filter(Boolean);
  fs.writeFileSync(
    path.join(srcDir, `${slug}.prompt.txt`),
    `${head.join('\n')}\n\n${SUBJECT_MARK}\n${subject}\n\n${STYLE_MARK}\n${IMAGE_STYLE}\n`,
  );
  // prompt は「このとき実際に送った全文」。共通スタイルは後から書き換わるので、呼び出し側で残せるようにする
  return { out, cost: m.cost, prompt, subject, style: IMAGE_STYLE };
}
