// 「よくある行動」の絵を作る。
//
//   node scripts/common-action-art.mjs                 全部（既にあるものは飛ばす）
//   node scripts/common-action-art.mjs fist-bump       slug を指定して1枚だけ
//   node scripts/common-action-art.mjs --force <slug>  既にあるものも描き直す（課金される）
//   node scripts/common-action-art.mjs --web           生成はせず webp だけ作り直す
//   node scripts/common-action-art.mjs --mono          白黒版（mono/）だけ作り直す
//
// 既にあるファイルは飛ばすので、途中で止めてもう一度回しても二重に課金されない。
// スタイル文と被写体文は src/data/common-action-art.mjs が持つ。ここには書かない。
// 生成と webp 作りの処理は flat-art-gen.mjs が持つ（「気まずい瞬間」と共有）。

import { SUBJECTS, ACTION_STYLE, GYM, OUT_DIR, WEB_MAX } from '../src/data/common-action-art.mjs';
import { run } from './flat-art-gen.mjs';

await run({
  subjects: SUBJECTS,
  style: ACTION_STYLE,
  gym: GYM,
  outDir: OUT_DIR,
  webMax: WEB_MAX,
  argv: process.argv.slice(2),
});
