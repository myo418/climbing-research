// 線画の「案」の置き場を扱う。admin と CLI の両方から使う。
//
//   src/lineart/candidates/<slug>/<時刻>.png   案の画像
//                                 <時刻>.txt   そのとき指示した被写体文
//                                 <時刻>.json  モデル・費用・送った全文など
//
// public/lineart/<slug>.png と中身が一致する案が「採用中」。
// どちらの経路で作っても履歴が残るように、生成する側は必ずここを通す。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const CAND_REL = 'src/lineart/candidates';
export const OUT_REL = 'public/lineart';

export const candDir = (root, slug) => path.join(root, CAND_REL, slug);
export const livePng = (root, slug) => path.join(root, OUT_REL, `${slug}.png`);

export const md5 = (f) =>
  (fs.existsSync(f) ? crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex') : null);

export function stampOf(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function freeStamp(dir, base) {
  let name = base;
  for (let i = 2; fs.existsSync(path.join(dir, `${name}.png`)); i++) name = `${base}-${i}`;
  return name;
}

/** その slug の案を新しい順に。いま採用中のものには adopted が立つ */
export function candidatesOf(root, slug) {
  const dir = candDir(root, slug);
  if (!fs.existsSync(dir)) return [];
  const live = md5(livePng(root, slug));
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort().reverse()
    .map((f) => {
      const txt = path.join(dir, f.replace(/\.png$/, '.txt'));
      const meta = path.join(dir, f.replace(/\.png$/, '.json'));
      const info = fs.existsSync(meta) ? JSON.parse(fs.readFileSync(meta, 'utf8')) : {};
      return {
        file: f,
        stamp: f.replace(/\.png$/, ''),
        subject: fs.existsSync(txt) ? fs.readFileSync(txt, 'utf8') : '',
        model: info.model ?? '',
        modelId: info.modelId ?? '',
        modelLabel: info.modelLabel ?? '',
        cost: info.cost ?? null,
        adopted: md5(path.join(dir, f)) === live,
      };
    });
}

/** いま出ている絵が案として残っていなければ取り込む（上書きで履歴が消えるのを防ぐ） */
export function ensureCandidate(root, slug, subject) {
  const cur = livePng(root, slug);
  if (!fs.existsSync(cur)) return null;
  if (candidatesOf(root, slug).some((c) => c.adopted)) return null;
  const dir = candDir(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = freeStamp(dir, stampOf(fs.statSync(cur).mtime));
  fs.copyFileSync(cur, path.join(dir, `${stamp}.png`));
  if (subject) fs.writeFileSync(path.join(dir, `${stamp}.txt`), subject);
  return stamp;
}

/** 新しく作った絵を案として保存する */
export function addCandidate(root, slug, pngPath, { subject = '', meta = {} } = {}) {
  const dir = candDir(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = freeStamp(dir, stampOf());
  fs.copyFileSync(pngPath, path.join(dir, `${stamp}.png`));
  fs.writeFileSync(path.join(dir, `${stamp}.txt`), subject);
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(meta, null, 2));
  return stamp;
}
