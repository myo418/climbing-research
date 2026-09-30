#!/usr/bin/env node
// Instagram に手動ログインするための、目に見えるブラウザを開く。
// ログインを検知したら cookies.txt (Netscape 形式) を書き出して終了する。
// プロファイルは climbing-research 専用（他プロジェクトのログイン状態に触らない）。

import { chromium } from '/Users/myo/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROFILE = join(process.env.HOME, '.claude/playwright-profiles/climbing-research');
const COOKIE_OUT = process.argv[2] || join(process.env.HOME, '.claude/playwright-profiles/climbing-research.cookies.txt');

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  channel: 'chrome',
  viewport: null,
  args: ['--window-size=1280,900'],
});

const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://www.instagram.com/accounts/login/');
console.log('ブラウザを開きました。Instagram にログインしてください。');

// sessionid が生えるまで待つ（最大10分）
const deadline = Date.now() + 10 * 60 * 1000;
let ok = false;
while (Date.now() < deadline) {
  const cookies = await ctx.cookies();
  if (cookies.some(c => c.name === 'sessionid' && c.domain.includes('instagram.com') && c.value)) {
    ok = true;
    break;
  }
  await new Promise(r => setTimeout(r, 2000));
}

if (!ok) {
  console.error('タイムアウト: ログインを検知できませんでした。');
  await ctx.close();
  process.exit(1);
}

const cookies = await ctx.cookies();
const lines = ['# Netscape HTTP Cookie File'];
for (const c of cookies) {
  if (!/instagram\.com$/.test(c.domain.replace(/^\./, ''))) continue;
  lines.push([
    c.domain,
    c.domain.startsWith('.') ? 'TRUE' : 'FALSE',
    c.path,
    c.secure ? 'TRUE' : 'FALSE',
    Math.floor(c.expires && c.expires > 0 ? c.expires : Date.now() / 1000 + 31536000),
    c.name,
    c.value,
  ].join('\t'));
}
writeFileSync(COOKIE_OUT, lines.join('\n') + '\n', { mode: 0o600 });
console.log(`ログインを検知しました。Cookie を書き出しました: ${COOKIE_OUT}`);
console.log('ブラウザは開いたままにします。終わったら閉じてください。');
