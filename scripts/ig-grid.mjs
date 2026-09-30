#!/usr/bin/env node
// Instagram のプロフィールをスクロールして、全投稿の一覧（URL・種別・サムネイル）を集める。
// 使い方: node scripts/ig-grid.mjs <ユーザー名> [出力ディレクトリ]
// ログイン状態は climbing-research プロファイルのものを使う（ig-login.mjs で作る）。

import { chromium } from '/Users/myo/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const user = process.argv[2];
if (!user) { console.error('使い方: node scripts/ig-grid.mjs <ユーザー名> [出力先]'); process.exit(1); }
const outDir = process.argv[3] || join(process.env.HOME, 'Downloads', user + '-grid');
const PROFILE = join(process.env.HOME, '.claude/playwright-profiles/climbing-research');
mkdirSync(outDir, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, channel: 'chrome', viewport: null, args: ['--window-size=1280,900'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const collect = () => page.evaluate(() => {
  const out = [];
  for (const a of document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')) {
    const href = a.getAttribute('href');
    const img = a.querySelector('img');
    out.push({ href, type: href.includes('/reel/') ? 'reel' : 'post',
               alt: img ? (img.alt || '') : '', thumb: img ? img.src : '' });
  }
  return out;
});

const seen = new Map();
let stagnant = 0;
for (let i = 0; i < 80 && stagnant < 4; i++) {
  for (const it of await collect()) if (it.href && !seen.has(it.href)) seen.set(it.href, it);
  const before = seen.size;
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
  await page.waitForTimeout(2500 + Math.random() * 1500);
  for (const it of await collect()) if (it.href && !seen.has(it.href)) seen.set(it.href, it);
  stagnant = seen.size === before ? stagnant + 1 : 0;
  process.stdout.write(`\r収集: ${seen.size} 件`);
}
console.log();

const items = [...seen.values()];
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ user, fetchedAt: new Date().toISOString(), items }, null, 2));
console.log(`一覧を保存: ${join(outDir, 'index.json')}`);
console.log(`  写真投稿: ${items.filter(i => i.type === 'post').length} / リール: ${items.filter(i => i.type === 'reel').length}`);

// サムネイルを落とす（ページ内 fetch なので Cookie 付き）
mkdirSync(join(outDir, 'thumbs'), { recursive: true });
let n = 0;
for (const it of items) {
  if (!it.thumb) continue;
  const id = it.href.split('/').filter(Boolean).pop();
  const b64 = await page.evaluate(async (u) => {
    try {
      const r = await fetch(u);
      const buf = await r.arrayBuffer();
      let s = ''; const b = new Uint8Array(buf);
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return btoa(s);
    } catch { return null; }
  }, it.thumb);
  if (!b64) continue;
  writeFileSync(join(outDir, 'thumbs', `${it.type}-${id}.jpg`), Buffer.from(b64, 'base64'));
  n++;
  process.stdout.write(`\rサムネイル: ${n}/${items.length}`);
}
console.log(`\nサムネイルを保存: ${join(outDir, 'thumbs')} (${n}件)`);
await ctx.close();
