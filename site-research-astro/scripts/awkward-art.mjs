// 「気まずい瞬間」の絵を作る。
//
//   node scripts/awkward-art.mjs                    全部（既にあるものは飛ばす）
//   node scripts/awkward-art.mjs sitting-on-pad     slug を指定して1枚だけ
//   node scripts/awkward-art.mjs --force <slug>     既にあるものも描き直す（課金される）
//   node scripts/awkward-art.mjs --web              生成はせず webp だけ作り直す
//   node scripts/awkward-art.mjs --mono             白黒版（mono/）だけ作り直す
//
// 既にあるファイルは飛ばすので、途中で止めてもう一度回しても二重に課金されない。
// スタイル文と被写体文は src/data/awkward-art.mjs が持つ。ここには書かない。
// 生成と webp 作りの処理は flat-art-gen.mjs が持つ（「よくある行動」と共有）。

import { SUBJECTS, AWKWARD_STYLE, GYM, OUT_DIR, WEB_MAX } from '../src/data/awkward-art.mjs';
import { run } from './flat-art-gen.mjs';

await run({
  subjects: SUBJECTS,
  style: AWKWARD_STYLE,
  gym: GYM,
  outDir: OUT_DIR,
  webMax: WEB_MAX,
  argv: process.argv.slice(2),
});
