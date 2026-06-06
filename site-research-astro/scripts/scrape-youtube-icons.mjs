/**
 * YouTube チャンネルアイコン・バナーを一括取得するスクリプト
 * 使い方: node scripts/scrape-youtube-icons.mjs
 * 出力: scripts/youtube-icons.json
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/myo/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const channels = [
  { slug: 'takemovie',         url: 'https://www.youtube.com/@TAKEMOVIE' },
  { slug: 'tamy',              url: 'https://www.youtube.com/@tamyclimbingchannel800' },
  { slug: 'kai-harada',        url: 'https://www.youtube.com/channel/UCkAPNeraPW-KGvJemx0TjGQ' },
  { slug: 'miho-nonaka',       url: 'https://www.youtube.com/@Miho_Nonaka' },
  { slug: 'saya-climbing',     url: 'https://www.youtube.com/channel/UCbqxTXwhOx4Yk9RIPBYT8OA' },
  { slug: 'dai-koyamada',      url: 'https://www.youtube.com/@daikoyamadachannel' },
  { slug: 'ikedai-olioli',     url: 'https://www.youtube.com/@IKEDAI_in_OLIOLI' },
  { slug: 'hghomoru',          url: 'https://www.youtube.com/@HGhomoru' },
  { slug: 'climbing2025',      url: 'https://www.youtube.com/@climbing2025' },
  { slug: 'pump2',             url: 'https://www.youtube.com/@PUMP2%E3%82%AF%E3%83%A9%E3%82%A4%E3%83%9F%E3%83%B3%E3%82%B0ch' },
  { slug: 'd-bouldering',      url: 'https://www.youtube.com/@D.Bouldering' },
  { slug: 'climbing-gym-oz',   url: 'https://www.youtube.com/@クライミングジムオズ' },
  { slug: 'bouldering-gym-share', url: 'https://www.youtube.com/@boulderinggymshare' },
  { slug: 'arcteryx-japan',    url: 'https://www.youtube.com/@arcteryxjapan' },
  { slug: 'patagonia-jp',      url: 'https://www.youtube.com/@PatagoniaJP' },
  { slug: 'climbing-channel-jp', url: 'https://www.youtube.com/channel/UCzQPmLmu9WkW4DDlrF-TQMA' },
  { slug: 'jmsca',             url: 'https://www.youtube.com/c/JMACompetitionTV' },
  { slug: 'adam-ondra',        url: 'https://www.youtube.com/channel/UC8eNyF9eYwgr_K-Nl4gSHWw' },
  { slug: 'magnus-midtbo',     url: 'https://www.youtube.com/channel/UC_gSotrFVZ_PiAxo3fTQVuQ' },
  { slug: 'emil-abrahamsson',  url: 'https://www.youtube.com/emilabrahamsson' },
  { slug: 'alex-honnold',      url: 'https://www.youtube.com/channel/UCwqnNQOiZzpPNazMN0cBAzw' },
  { slug: 'chris-sharma',      url: 'https://www.youtube.com/c/chrissharma' },
  { slug: 'geek-climber',      url: 'https://www.youtube.com/channel/UCdjL64S-IS84HjDhSc6XZ2A' },
  { slug: 'wide-boyz',         url: 'https://www.youtube.com/@WideBoyz' },
  { slug: 'eric-karlsson',     url: 'https://www.youtube.com/channel/UCgtOMaHBiYvsRYZ77utf8FQ' },
  { slug: 'lattice-training',  url: 'https://www.youtube.com/channel/UCMQzIsi7kwz1_xZjqNhz9kw' },
  { slug: 'the-north-face',    url: 'https://www.youtube.com/channel/UCNfWDbERpf34FsSWIpqGD0Q' },
  { slug: 'reel-rock',         url: 'https://www.youtube.com/channel/UCMuDqExNJkCJpOHsX4VKY9g' },
  { slug: 'mellow',            url: 'https://www.youtube.com/@mellowclimbing' },
  { slug: 'hard-is-easy',      url: 'https://www.youtube.com/@HardIsEasy' },
  { slug: 'epictv',            url: 'https://www.youtube.com/channel/UCIRIbjrEHserQZ6O1Jd9wrg' },
  { slug: 'ifsc',              url: 'https://www.youtube.com/@worldclimbing' },
];

async function extractChannelImages(page) {
  return page.evaluate(() => {
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null;
    const avatarImg =
      document.querySelector('#channel-header-container #avatar img')?.src ||
      document.querySelector('yt-avatar-shape img')?.src ||
      document.querySelector('#channel-header img')?.src ||
      null;
    const banner =
      document.querySelector('#channel-header-container yt-image-banner-view-model img')?.src ||
      document.querySelector('yt-image-banner-view-model img')?.src ||
      document.querySelector('#channel-banner img')?.src ||
      null;
    return { ogImage, avatarImg, banner };
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/myo/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ja-JP',
  });
  const page = await context.newPage();

  const results = {};

  for (const ch of channels) {
    process.stdout.write(`${ch.slug} ... `);
    try {
      await page.goto(ch.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // YouTube は JS レンダリングが必要なので少し待つ
      await page.waitForTimeout(2000);
      const imgs = await extractChannelImages(page);

      // ogImage が最も安定したアイコン
      const iconUrl = imgs.ogImage ?? imgs.avatarImg ?? null;
      const bannerUrl = imgs.banner ?? null;

      results[ch.slug] = { iconUrl, bannerUrl };
      console.log(`icon=${iconUrl ? 'ok' : 'NONE'} banner=${bannerUrl ? 'ok' : 'NONE'}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results[ch.slug] = { iconUrl: null, bannerUrl: null };
    }
    // YouTube のレート制限対策で少し間隔を置く
    await page.waitForTimeout(1000);
  }

  await browser.close();

  const outPath = join(__dirname, 'youtube-icons.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n完了 → ${outPath}`);
}

main().catch(console.error);
