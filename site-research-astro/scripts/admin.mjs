// climbing research admin。http://127.0.0.1:4701
//   npm run admin
// 2つの画面を持つ:
//   写真 … src/data/photos.json を読み書きする（Node標準 + macOS の sips）
//   線画 … public/lineart の画像を一覧し、指示を書き換えて描き直す（scripts/lineart-gen.mjs を呼ぶ）
// 描き直す前の画像は src/lineart/history/ に退避するので、前の版に戻せる。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AXES, FIELDS } from '../src/data/photo-axes.mjs';
import os from 'node:os';
import { generate, subjectOf, SUBJECT_MARK, STYLE_MARK } from './lineart-gen.mjs';
import { IMAGE_MODELS, IMAGE_STYLE_FILE } from '../src/data/lineart-style.mjs';
import {
  candDir as candDirOf, candidatesOf as candidatesOfSlug, ensureCandidate as ensureCandidateOf,
  md5, stampOf, freeStamp,
} from './lineart-candidates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = path.join(ROOT, 'public/photos');
const WEB_DIR = path.join(PHOTO_DIR, 'web');
const DATA = path.join(ROOT, 'src/data/photos.json');
const LINEART_DIR = path.join(ROOT, 'public/lineart');
const LINEART_SRC = path.join(ROOT, 'src/lineart');
const STYLE_PATH = path.join(ROOT, IMAGE_STYLE_FILE);   // 全図に共通で付く指示（1行1文）
const readStyle = () => fs.readFileSync(STYLE_PATH, 'utf8');
/** 保存後は生成にも即反映させたいので、その場で1行に繋いだものを返す */
const styleOneLine = () => readStyle().split('\n').map((l) => l.trim()).filter(Boolean).join(' ');

const LINEART_REF = path.join(LINEART_SRC, 'references');  // 手本にする写真・線画（サイトには出さない）
const LINEART_CAND = path.join(LINEART_SRC, 'candidates');

const GLOSSARY = path.join(ROOT, 'src/data/glossary.ts');

/** 用語集の全エントリ（slug / 見出し / 英語 / 説明 / 重要度） */
function glossaryTerms() {
  if (!fs.existsSync(GLOSSARY)) return [];
  const src = fs.readFileSync(GLOSSARY, 'utf8');
  const out = [];
  // 1エントリ = { slug: '...', ... } のかたまり。順番は glossary.ts のまま
  const re = /\{\s*slug: '([^']+)',([\s\S]*?)\n  \},/g;
  for (const m of src.matchAll(re)) {
    const body = m[2];
    const pick = (k) => body.match(new RegExp(`${k}:\\s*\n?\\s*'([^']*)'`))?.[1] ?? '';
    out.push({
      slug: m[1],
      term: pick('term'),
      english: pick('english'),
      description: pick('description'),
      prominence: pick('prominence'),
    });
  }
  return out;
}

/** まだ線画が無い用語。重要度の高い順、次に用語集の並び順 */
function pendingTerms(items) {
  const done = new Set(items.map((i) => i.term).filter(Boolean));
  const rank = { major: 0, standard: 1, minor: 2, '': 3 };
  return glossaryTerms()
    .filter((t) => !done.has(t.slug))
    .map((t) => {
      // 先に用意してある控えがあれば、その被写体文を下書きとして渡す
      const memo = path.join(LINEART_SRC, `${t.slug}.prompt.txt`);
      const text = fs.existsSync(memo) ? fs.readFileSync(memo, 'utf8') : '';
      return { ...t, subject: text ? subjectFrom(text) : '', ...(text ? memoHead(text) : {}) };
    })
    .sort((a, b) => {
      // 下書きがあるものを先に、その中では重要度順
      const ready = Number(Boolean(b.subject)) - Number(Boolean(a.subject));
      return ready || (rank[a.prominence] ?? 3) - (rank[b.prominence] ?? 3);
    });
}

/** 参照画像の一覧。<ファイル名>.txt があれば1行目を説明として拾う */
function referenceList() {
  if (!fs.existsSync(LINEART_REF)) return [];
  return fs.readdirSync(LINEART_REF)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .map((f) => {
      const note = path.join(LINEART_REF, `${f}.txt`);
      return { file: f, note: fs.existsSync(note) ? fs.readFileSync(note, 'utf8').split('\n')[0] : '' };
    });
}  // 案の置き場。採用したものが public/lineart に出る
const PORT = Number(process.env.ADMIN_PORT) || 4701;
const BOOT = Date.now();  // node --watch で再起動すると変わる。画面はこれを見て自分を読み込み直す  // 検証用に別ポートで立てられる
const WEB_MAX = 1600; // 表示用の長辺

// 軸・項目のキーが写真そのものの情報を上書きしないようにする。
// （'height' を軸のキーにして画像のピクセル高さを壊したことがある）
const RESERVED = ['id', 'file', 'web', 'width', 'height', 'orientation', 'missing', 'excluded'];
// auto の軸（orientation など）は写真そのものの情報を読むので対象外
for (const k of [...AXES.filter((a) => !a.auto).map((a) => a.key), ...FIELDS.map((f) => f.key)]) {
  if (RESERVED.includes(k)) {
    console.error(`photo-axes.mjs: キー '${k}' は写真の情報で使っている名前なので軸には使えない`);
    console.error(`  使えない名前: ${RESERVED.join(', ')}`);
    process.exit(1);
  }
}

const read = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const write = (d) => fs.writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n');

function dimensions(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  return { width: +out.match(/pixelWidth: (\d+)/)[1], height: +out.match(/pixelHeight: (\d+)/)[1] };
}

/** public/photos を走査して、新しい写真を photos.json に足し、表示用画像を作る */
function sync() {
  fs.mkdirSync(WEB_DIR, { recursive: true });
  const data = read();
  const known = new Set(data.photos.map((p) => p.id));
  const files = fs.readdirSync(PHOTO_DIR).filter((f) => /\.jpe?g$/i.test(f)).sort();
  const added = [];
  for (const file of files) {
    const id = file.replace(/\.[^.]+$/, '');
    const web = path.join(WEB_DIR, `${id}.jpg`);
    if (!fs.existsSync(web)) {
      execFileSync('sips', ['-Z', String(WEB_MAX), '-s', 'formatOptions', '72',
        path.join(PHOTO_DIR, file), '--out', web]);
    }
    if (known.has(id)) continue;
    const { width, height } = dimensions(path.join(PHOTO_DIR, file));
    const photo = { id, file, web: `web/${id}.jpg`, width, height,
      orientation: width > height ? 'landscape' : width < height ? 'portrait' : 'square' };
    for (const f of FIELDS) photo[f.key] = '';
    data.photos.push(photo);
    added.push(id);
  }
  // 元ファイルが消えた写真には印を付けるだけ（勝手に消さない）
  const present = new Set(files.map((f) => f.replace(/\.[^.]+$/, '')));
  for (const p of data.photos) p.missing = !present.has(p.id) || undefined;
  data.photos.sort((a, b) => a.id.localeCompare(b.id));
  // 中身が変わっていないなら書かない。書くと node --watch が自分を再起動してしまう
  const next = JSON.stringify(data, null, 2) + '\n';
  const changed = next !== fs.readFileSync(DATA, 'utf8');
  if (changed) fs.writeFileSync(DATA, next);
  return { added, total: data.photos.length, changed };
}


// ---------------------------------------------------------------- 線画

/** 控えファイルの見出し行（title / desc / term）を読む */
function memoHead(text) {
  const head = {};
  for (const line of text.split('\n').slice(0, 10)) {
    const m = line.match(/^(title|desc|term|model|date|checked):\s*(.+)$/);
    if (m) head[m[1]] = m[2].trim();
  }
  return head;
}

/** 控えから被写体文を取り出す。マーカーが無い古い形式にも対応する */
function subjectFrom(text) {
  const marked = subjectOf(text);
  if (marked) return marked;
  if (!text) return '';
  // 見出し行（# slug / title: / date: など）を落とし、スタイル文の手前までを被写体とみなす
  const body = text
    .split('\n')
    .filter((l) => !/^(#|title:|desc:|term:|model:|date:|refs:)/.test(l))
    .join('\n');
  return body.split('Black and white line-art illustration')[0].trim();
}

// 案の置き場の扱いは scripts/lineart-candidates.mjs に集約してある（CLI と同じものを使う）
const candDir = (slug) => candDirOf(ROOT, slug);
const candidatesOf = (slug) => candidatesOfSlug(ROOT, slug);
const ensureCandidate = (slug, subject) => ensureCandidateOf(ROOT, slug, subject);


/** 同じ秒に複数できても潰し合わないように、空いている名前を返す */

function lineartList() {
  const items = [];
  const pngs = fs.existsSync(LINEART_DIR)
    ? fs.readdirSync(LINEART_DIR).filter((f) => f.endsWith('.png')).sort() : [];
  for (const f of pngs) {
    const slug = f.replace(/\.png$/, '');
    const memoFile = path.join(LINEART_SRC, `${slug}.prompt.txt`);
    const text = fs.existsSync(memoFile) ? fs.readFileSync(memoFile, 'utf8') : '';
    const st = fs.statSync(path.join(LINEART_DIR, f));
    items.push({
      slug,
      ...memoHead(text),
      subject: subjectFrom(text),
      hasMemo: Boolean(text),
      mtime: st.mtimeMs,
      candidates: candidatesOf(slug),
    });
  }
  return items;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page());
  }
  if (url.pathname === '/api/ping') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ boot: BOOT }));
  }
  if (url.pathname === '/api/photos') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ...read(), axes: AXES, fields: FIELDS }));
  }
  if (url.pathname === '/api/sync' && req.method === 'POST') {
    const r = sync();
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(r));
  }
  if (url.pathname === '/api/photo' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { id, patch } = JSON.parse(body);
      const data = read();
      const photo = data.photos.find((p) => p.id === id);
      if (!photo) { res.writeHead(404); return res.end('{}'); }
      Object.assign(photo, patch);
      for (const k of Object.keys(patch)) if (patch[k] === null) delete photo[k];
      write(data);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(photo));
    });
    return;
  }
  if (url.pathname === '/api/lineart') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      items: lineartList(), models: IMAGE_MODELS, style: readStyle(), styleFile: IMAGE_STYLE_FILE,
      references: referenceList(), pending: pendingTerms(lineartList()),
    }));
  }
  if (url.pathname === '/api/lineart/gen' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const o = JSON.parse(body);
        const slug = String(o.slug || '').trim();
        const subject = String(o.subject || '').trim();
        if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('slug は英小文字・数字・ハイフンだけ');
        if (!subject) throw new Error('描くものの説明が空');
        const count = Math.min(Math.max(Number(o.count) || 1, 1), 4);
        const model = o.model ?? 'gemini-2.5-flash';
        const mInfo = IMAGE_MODELS[model] ?? {};
        // 参照画像（references/ の写真）。指示の中で「どの写真から何を取るか」を書くと効く
        const refs = (o.refFiles ?? [])
          .map((f) => path.join(LINEART_REF, path.basename(String(f))))
          .filter((f) => fs.existsSync(f));

        ensureCandidate(slug, subject);           // いまの絵も案として残す
        const dir = candDir(slug);
        fs.mkdirSync(dir, { recursive: true });
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lineart-'));

        // 同じ指示で count 枚。同時に投げる
        const made = await Promise.all(
          Array.from({ length: count }, async (_, i) => {
            const one = `c${i}`;
            const { cost, prompt, style } = await generate({
              slug: one, subject, model, quality: o.quality ?? 'medium', refs,
              srcDir: tmp, outDir: tmp,
            });
            const stamp = freeStamp(dir, stampOf() + String(i));
            fs.copyFileSync(path.join(tmp, `${one}.png`), path.join(dir, `${stamp}.png`));
            fs.writeFileSync(path.join(dir, `${stamp}.txt`), subject);
            // どのモデルで出したかを案ごとに残す（採用時に控えへ引き継ぐ）
            fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify({
              // 送った全文をそのまま残す。共通スタイルは後から変わるため、当時のものを保存する
              prompt,
              subject,
              style,
              model,
              modelId: mInfo.id ?? model,
              modelLabel: mInfo.label ? `${mInfo.label}（${mInfo.provider}）` : model,
              quality: mInfo.api === 'openai' ? (o.quality ?? 'medium') : null,
              refs: refs.map((f) => path.basename(f)),
              cost: cost ?? mInfo.cost ?? null,
              date: new Date().toISOString(),
            }, null, 2));
            return { stamp, cost };
          }),
        );
        fs.rmSync(tmp, { recursive: true, force: true });

        // 未生成の用語から作ったときは、最初の案をそのまま採用して一覧に出す
        if (o.adopt && made.length) {
          const dirNow = candDir(slug);
          fs.copyFileSync(path.join(dirNow, `${made[0].stamp}.png`), path.join(LINEART_DIR, `${slug}.png`));
          const metaFile = path.join(dirNow, `${made[0].stamp}.json`);
          const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
          const head = [`# ${slug}`, o.title ? `title: ${o.title}` : '', o.desc ? `desc: ${o.desc}` : '',
            o.term ? `term: ${o.term}` : '', meta.modelId ? `model: ${meta.modelId}` : '',
            `date: ${new Date().toISOString().slice(0, 10)}`].filter(Boolean);
          fs.writeFileSync(
            path.join(LINEART_SRC, `${slug}.prompt.txt`),
            `${head.join('\n')}\n\n${SUBJECT_MARK}\n${subject}\n\n${STYLE_MARK}\n${meta.style || styleOneLine()}\n`,
          );
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          cost: made.reduce((a, b) => a + b.cost, 0),
          made: made.length,
          items: lineartList(),
        }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
      }
    });
    return;
  }
  // 確認済みの印。控え（*.prompt.txt）の見出しに checked: <日付> として持つ
  if (url.pathname === '/api/lineart/check' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { slug, checked } = JSON.parse(body);
        const memo = path.join(LINEART_SRC, `${slug}.prompt.txt`);
        if (!fs.existsSync(memo)) throw new Error('控えが無い');
        let text = fs.readFileSync(memo, 'utf8').replace(/^checked: .*\n/m, '');
        if (checked) {
          const stamp = new Date().toISOString().slice(0, 10);
          text = text.replace(/^(# .*)$/m, `$1\nchecked: ${stamp}`);
        }
        fs.writeFileSync(memo, text);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, items: lineartList() }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
      }
    });
    return;
  }
  if (url.pathname === '/api/lineart/style' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { style } = JSON.parse(body);
        if (!style || !style.trim()) throw new Error('空にはできない');
        fs.writeFileSync(STYLE_PATH, style.trim() + '\n');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, style: readStyle() }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
      }
    });
    return;
  }
  if (url.pathname === '/api/lineart/adopt' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { slug, file, title, desc, term } = JSON.parse(body);
        const from = path.join(candDir(slug), path.basename(file || ''));
        if (!fs.existsSync(from)) throw new Error('その案が無い');
        fs.copyFileSync(from, path.join(LINEART_DIR, `${slug}.png`));
        // 採用した案の指示で控えを書き直す（サイトはこの控えの見出しを読む）
        const txt = from.replace(/\.png$/, '.txt');
        const subject = fs.existsSync(txt) ? fs.readFileSync(txt, 'utf8') : '';
        const metaFile = from.replace(/\.png$/, '.json');
        const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
        const styleUsed = meta.style || styleOneLine();   // 当時のスタイル（無ければ今のもの）
        const modelLine = meta.modelId
          ? `model: ${meta.modelId}${meta.quality ? ` (quality=${meta.quality})` : ''}`
          : '';
        const head = [`# ${slug}`, title ? `title: ${title}` : '', desc ? `desc: ${desc}` : '',
          term ? `term: ${term}` : '', modelLine,
          `date: ${new Date().toISOString().slice(0, 10)}`].filter(Boolean);
        fs.writeFileSync(
          path.join(LINEART_SRC, `${slug}.prompt.txt`),
          `${head.join('\n')}\n\n${SUBJECT_MARK}\n${subject}\n\n${STYLE_MARK}\n${styleUsed}\n`,
        );
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, items: lineartList() }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
      }
    });
    return;
  }
  if (url.pathname.startsWith('/lineart-ref/')) {
    const f = path.join(LINEART_REF, path.basename(decodeURIComponent(url.pathname.slice('/lineart-ref/'.length))));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] ?? 'application/octet-stream' });
    return res.end(fs.readFileSync(f));
  }
  if (url.pathname.startsWith('/lineart-candidate/')) {
    const rel = decodeURIComponent(url.pathname.slice('/lineart-candidate/'.length));
    const file = path.join(LINEART_CAND, rel);
    if (!file.startsWith(LINEART_CAND) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    return fs.createReadStream(file).pipe(res);
  }
  if (url.pathname.startsWith('/lineart/')) {
    const base = LINEART_DIR;
    const rel = decodeURIComponent(url.pathname.slice('/lineart/'.length));
    const file = path.join(base, rel);
    if (!file.startsWith(base) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    return fs.createReadStream(file).pipe(res);
  }
  if (url.pathname.startsWith('/photos/')) {
    const rel = decodeURIComponent(url.pathname.slice('/photos/'.length));
    const file = path.join(PHOTO_DIR, rel);
    if (!file.startsWith(PHOTO_DIR) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404);
  res.end();
});

function page() {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>climbing research admin</title>
<style>
:root{--bg:#0f1012;--panel:#17191d;--line:#2a2e35;--fg:#e8e8ea;--dim:#8b929e;--accent:#7cc4ff}
*{box-sizing:border-box}
/* main は display:flex なので、hidden 属性を効かせるには明示が要る */
[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.6 -apple-system,"Hiragino Sans",sans-serif;height:100vh;display:flex;flex-direction:column}
header{display:flex;flex-direction:column;gap:6px;padding:8px 14px;border-bottom:1px solid var(--line);flex:0 0 auto}
header .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
header h1{font-size:14px;margin:0;font-weight:600}
header .sp{flex:1}
#filters select{background:#20242b;color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font:inherit;font-size:12px;max-width:190px}
#filters select.on{border-color:var(--accent);color:var(--accent)}
#filters .clear{font-size:11px;color:var(--dim);background:none;border:none;text-decoration:underline;cursor:pointer;padding:0}
button{font:inherit;color:var(--fg);background:#20242b;border:1px solid var(--line);border-radius:6px;padding:4px 10px;cursor:pointer}
button:hover{border-color:#4a515c}
button.on{background:var(--accent);border-color:var(--accent);color:#06121c;font-weight:600}
main{flex:1;display:flex;min-height:0}
/* 行の高さを grid-auto-rows で固定する。aspect-ratio だと行が潰れてサムネが重なる */
#grid{width:320px;flex:0 0 auto;overflow-y:auto;border-right:1px solid var(--line);padding:8px;
      display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:94px;gap:8px;align-content:start}
#grid figure{margin:0;position:relative;cursor:pointer;border:2px solid transparent;border-radius:4px;overflow:hidden;background:#000;min-width:0}
#grid figure.sel{border-color:var(--accent)}
#grid figure.ex img{opacity:.25;filter:grayscale(1)}
#grid figure.ex::after{content:'除外';position:absolute;left:2px;bottom:2px;background:#000a;color:#ff8a8a;font-size:10px;padding:0 4px;border-radius:3px}
.exbtn{width:100%;margin-bottom:12px;padding:6px;font-size:12px}
.exbtn.on{background:#5a2020;border-color:#8b3030;color:#ffb0b0}
#grid img{width:100%;height:100%;object-fit:cover;display:block}
#grid .badge{position:absolute;top:2px;right:2px;background:#000a;border-radius:3px;padding:0 4px;font-size:10px;color:var(--dim)}
#grid figure.done .badge{color:#7ee787}
#view{flex:1;display:flex;align-items:center;justify-content:center;background:#000;padding:10px;min-width:0}
#view img{max-width:100%;max-height:100%;object-fit:contain}
#panel{width:340px;flex:0 0 auto;overflow-y:auto;background:var(--panel);border-left:1px solid var(--line);padding:12px}
.axis{margin-bottom:14px}
.axis h3{margin:0 0 4px;font-size:12px;color:var(--dim);font-weight:600}
.axis h3 kbd{background:#2a2e35;border-radius:3px;padding:0 4px;font-size:10px;margin-left:4px}
.axis .opts{display:flex;flex-wrap:wrap;gap:4px}
.axis button{padding:3px 8px;font-size:12px}
label.f{display:block;margin-bottom:10px}
label.f span{display:block;font-size:12px;color:var(--dim);margin-bottom:2px}
input,textarea{width:100%;background:#0f1114;color:var(--fg);border:1px solid var(--line);border-radius:5px;padding:5px 7px;font:inherit}
textarea{resize:vertical;min-height:60px}
#meta{font-size:11px;color:var(--dim);margin-bottom:10px;border-bottom:1px solid var(--line);padding-bottom:8px}
#meta .hint{color:var(--accent);opacity:.75;margin-top:3px}
nav#tabs{display:flex;gap:0;border:1px solid var(--line);border-radius:6px;overflow:hidden}
nav#tabs button{border:0;border-radius:0;padding:4px 14px;background:#20242b}
nav#tabs button.on{background:var(--accent);color:#06121c;font-weight:600}
/* 線画は透過なので、サイトと同じ地色を敷いて見る（VSCodeやプレビューだと黒くなる） */
#la-side{width:300px;flex:0 0 auto;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line)}
#la-filter{display:flex;gap:4px;padding:8px;border-bottom:1px solid var(--line);flex:0 0 auto}
#la-filter button{flex:1;font-size:11px;line-height:1.25;padding:5px 2px;background:#20242b;border:0;border-radius:5px;
                  color:var(--fg);cursor:pointer}
#la-filter button.on{background:var(--accent);color:#06121c;font-weight:600}
#la-list{flex:1 1 auto;overflow-y:auto;padding:8px;
         display:grid;grid-template-columns:repeat(2,1fr);grid-auto-rows:110px;gap:8px;align-content:start}
#la-list figure{margin:0;cursor:pointer;border:2px solid transparent;border-radius:4px;overflow:hidden;
                background:#fafaf8;position:relative;min-width:0}
#la-list figure.sel{border-color:var(--accent)}
#la-list img{width:100%;height:100%;object-fit:contain;display:block;padding:4px}
#la-list .nm{position:absolute;left:0;right:0;bottom:0;background:#000a;color:#e8e8ea;font-size:10px;
             padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#la-view{flex:1;display:flex;align-items:center;justify-content:center;background:#fafaf8;padding:14px;min-width:0}
#la-view img{max-width:100%;max-height:100%;object-fit:contain}
#la-panel{width:400px;flex:0 0 auto;overflow-y:auto;background:var(--panel);border-left:1px solid var(--line);padding:12px}
#la-panel textarea{min-height:190px;font-size:12px;line-height:1.5}
#la-panel .row2{display:flex;gap:6px}
#la-panel .row2>*{flex:1}
#la-list figure.pend{grid-column:1/-1;background:#17191d;border:1px solid var(--line);border-radius:6px;padding:8px;cursor:pointer}
#la-list figure.pend.sel{border-color:var(--accent)}
#la-list .pend-body b{font-size:13px}
#la-list .pend-body .en{color:var(--dim);font-size:10px;margin-left:6px}
#la-list .pend-body .pr{font-size:9px;margin-left:6px;padding:1px 4px;border-radius:3px;background:#2a2e35;color:var(--dim)}
#la-list .pend-body .pr-major{background:#7cc4ff;color:#06121c}
#la-list .pend-body .pr-ready{background:#2f7d4f;color:#fff}
#la-list .pend-body p{margin:4px 0 0;font-size:11px;line-height:1.5;color:var(--dim)}
#la-list .done-tag{position:absolute;top:4px;right:4px;font-size:9px;background:#2f7d4f;color:#fff;border-radius:3px;padding:1px 4px}
/* 確認済みは何度も押すので、幅いっぱいの大きな当たり判定にする */
#la-panel .chk{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;
               margin:4px 0 10px;padding:12px 14px;font-size:14px;cursor:pointer;user-select:none;
               background:#20242b;border:1px solid var(--line);border-radius:8px}
#la-panel .chk:hover{background:#262b33}
#la-panel .chk input{display:none}
#la-panel .chk .box{width:22px;height:22px;flex:0 0 auto;border:2px solid var(--dim);border-radius:5px;
                    display:flex;align-items:center;justify-content:center}
#la-panel .chk .box::after{content:'✓';font-size:15px;line-height:1;color:transparent}
#la-panel .chk:has(input:checked){background:#1d3b2a;border-color:#2f7d4f}
#la-panel .chk:has(input:checked) .box{border-color:#3ea56a;background:#2f7d4f}
#la-panel .chk:has(input:checked) .box::after{color:#fff}
#la-panel .chk .lb{font-weight:600}
#la-panel .chk .when{margin-left:auto;color:var(--dim);font-size:11px}
#la-panel .refs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0}
#la-panel .ref{display:block;cursor:pointer;font-size:10px;color:var(--dim);text-align:center}
#la-panel .ref img{width:100%;height:64px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:4px;display:block}
#la-panel .ref input{display:none}
#la-panel .ref input:checked + img{outline:2px solid var(--accent);outline-offset:-2px}
#la-panel .ref span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#la-panel select{width:100%;background:#0f1114;color:var(--fg);border:1px solid var(--line);border-radius:5px;padding:5px 7px;font:inherit}
.gen{width:100%;padding:8px;margin-top:6px;background:#1d3b2a;border-color:#2f6b47;color:#9ff0c0;font-weight:600}
.gen:disabled{opacity:.5;cursor:default}
/* 候補。1つの目的に対して出した案を並べ、どれかを採用する */
#la-view{flex-direction:column;gap:10px}
#la-big{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;width:100%}
#la-cands{flex:0 0 auto;display:flex;gap:8px;overflow-x:auto;width:100%;padding:4px 2px 2px}
#la-cands figure{margin:0;width:110px;flex:0 0 auto;background:#fff;border:2px solid #d8d8d4;border-radius:4px;
                 overflow:hidden;cursor:pointer;position:relative}
#la-cands figure.on{border-color:#2f6b47}
#la-cands figure.live{border-color:var(--accent)}
#la-cands img{width:100%;height:86px;object-fit:contain;display:block;padding:3px}
#la-cands .t{font-size:10px;color:#666;text-align:center;padding:1px;background:#f0efec}
#la-cands .live-tag{position:absolute;top:2px;left:2px;background:#7cc4ff;color:#06121c;font-size:9px;
                    padding:0 4px;border-radius:3px;font-weight:600}
.adopt{width:100%;padding:7px;margin-top:6px;background:#1d3b2a;border-color:#2f6b47;color:#9ff0c0;font-weight:600}
#la-log{font-size:11px;color:var(--dim);margin-top:8px;white-space:pre-wrap}
#toast{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#7ee787;color:#04220c;padding:4px 12px;border-radius:20px;font-size:12px;opacity:0;transition:opacity .2s}
#toast.show{opacity:1}
</style></head><body>
<header>
  <div class="row">
    <h1>climbing research admin</h1>
    <nav id="tabs"><button data-tab="photo" class="on">写真</button><button data-tab="lineart">線画</button></nav>
    <button id="sync" class="photo-only">public/photos を読み込む</button>
    <label class="photo-only" style="color:var(--dim)"><input type="checkbox" id="only" style="width:auto"> 未入力だけ</label>
    <label class="photo-only" style="color:var(--dim)"><input type="checkbox" id="showex" style="width:auto"> 除外も表示</label>
    <span id="la-count" style="color:var(--dim);display:none"></span><span class="sp"></span>
    <span id="count" class="photo-only" style="color:var(--dim)"></span>
    <span class="photo-only" style="color:var(--dim)">十字キーで移動 / 数字キーで選択</span>
  </div>
  <div class="row photo-only" id="filters"></div>
</header>
<main id="m-photo">
  <div id="grid"></div>
  <div id="view"><img id="big" alt=""></div>
  <div id="panel"></div>
</main>
<main id="m-lineart" hidden>
  <div id="la-side"><div id="la-filter"></div><div id="la-list"></div></div>
  <div id="la-view"><div id="la-big"></div><div id="la-cands"></div></div>
  <div id="la-panel"></div>
</main>
<div id="toast">保存</div>
<script>
let AXES=[],FIELDS=[],PHOTOS=[],cur=0;
const $=(s)=>document.querySelector(s);
const toast=()=>{const t=$('#toast');t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),700)};
const filled=(p)=>AXES.filter(a=>!a.auto).every(a=>p[a.key]);
const FILTER={};   // {軸key: 値}。'__empty__' はその軸が未入力のものだけ
const list=()=>PHOTOS.filter(p=>
  ($('#showex').checked||!p.excluded) &&
  (!$('#only').checked||!filled(p)) &&
  Object.entries(FILTER).every(([k,v])=>v==='__empty__'?!p[k]:p[k]===v));

async function load(){
  const d=await (await fetch('/api/photos')).json();
  AXES=d.axes;FIELDS=d.fields;PHOTOS=d.photos;
  renderFilters();renderGrid();
  const want=URLQ().get('id');
  const at=want?list().findIndex(p=>p.id===want):-1;
  select(at>=0?at:0);
}
// 軸の値で絞り込む。付け間違いは「同じ値のものを並べて見る」と見つかる
function renderFilters(){
  const bar=$('#filters');
  bar.innerHTML='<span style="color:var(--dim)">見直す</span>';
  const EMPTY='\u0000';
  AXES.forEach(a=>{
    const sel=document.createElement('select');
    const n=(v)=>PHOTOS.filter(p=>p[a.key]===v).length;
    sel.innerHTML='<option value="">'+a.label+'（すべて）</option>'
      +a.options.map(o=>'<option value="'+o.value+'">'+a.label+': '+o.label+' — '+n(o.value)+'</option>').join('')
      +'<option value="'+EMPTY+'">'+a.label+': 未入力 — '+PHOTOS.filter(p=>!p[a.key]).length+'</option>';
    sel.value=FILTER[a.key]==='__empty__'?EMPTY:(FILTER[a.key]??'');
    sel.className=FILTER[a.key]?'on':'';
    sel.onchange=()=>{
      const v=sel.value;
      if(!v)delete FILTER[a.key]; else FILTER[a.key]=v===EMPTY?'__empty__':v;
      sel.className=v?'on':'';
      cur=0;renderGrid();select(0);
    };
    bar.appendChild(sel);
  });
  const clr=document.createElement('button');
  clr.className='clear';clr.textContent='解除';
  clr.onclick=()=>{for(const k of Object.keys(FILTER))delete FILTER[k];renderFilters();cur=0;renderGrid();select(0)};
  bar.appendChild(clr);
}
function renderGrid(){
  const g=$('#grid');g.innerHTML='';
  list().forEach((p,i)=>{
    const f=document.createElement('figure');
    f.className=(i===cur?'sel ':'')+(p.excluded?'ex ':'')+(filled(p)?'done':'');
    f.innerHTML='<img loading="lazy" src="/photos/'+p.web+'"><span class="badge">'+(filled(p)?'✓':'–')+'</span>';
    f.onclick=()=>select(i);
    g.appendChild(f);
  });
  const target=PHOTOS.filter(p=>!p.excluded);
  const ex=PHOTOS.length-target.length;
  $('#count').textContent=target.filter(filled).length+' / '+target.length+' 入力済み'
    +(ex?'（除外 '+ex+'）':'');
}
function select(i){
  const L=list();if(!L.length)return;
  cur=Math.max(0,Math.min(i,L.length-1));
  const p=L[cur];
  $('#big').src='/photos/'+p.web;
  [...$('#grid').children].forEach((el,n)=>el.classList.toggle('sel',n===cur));
  $('#grid').children[cur]?.scrollIntoView({block:'nearest'});
  setQ({id:p.id});
  renderPanel(p);
}
function renderPanel(p){
  const el=$('#panel');el.innerHTML='';
  const meta=document.createElement('div');meta.id='meta';
  meta.innerHTML='<div>'+p.file+' · '+p.width+'×'+p.height+' · '+p.orientation+'</div>'
    +'<div class="hint">ボタンを押すと付け替え / 光っているボタンをもう一度押すと外れる</div>';
  el.appendChild(meta);
  const ex=document.createElement('button');
  ex.className='exbtn'+(p.excluded?' on':'');
  ex.textContent=p.excluded?'除外中 — 戻す':'クライミングしていない写真として除外';
  ex.onclick=()=>set(p,'excluded',p.excluded?null:true);
  el.appendChild(ex);
  AXES.filter(a=>!a.auto).forEach((a,ai)=>{
    const d=document.createElement('div');d.className='axis';
    d.innerHTML='<h3>'+a.label+(a.hint?' <span style="font-weight:400">'+a.hint+'</span>':'')+'</h3>';
    const opts=document.createElement('div');opts.className='opts';
    a.options.forEach((o,oi)=>{
      const b=document.createElement('button');
      b.textContent=o.label;b.className=p[a.key]===o.value?'on':'';
      b.onclick=()=>set(p,a.key,p[a.key]===o.value?'':o.value);
      opts.appendChild(b);
    });
    d.appendChild(opts);el.appendChild(d);
  });
  FIELDS.forEach(f=>{
    const l=document.createElement('label');l.className='f';
    l.innerHTML='<span>'+f.label+'</span>';
    const inp=document.createElement(f.multiline?'textarea':'input');
    inp.value=p[f.key]??'';inp.placeholder=f.placeholder??'';
    inp.onchange=()=>set(p,f.key,inp.value,true);
    l.appendChild(inp);el.appendChild(l);
  });
}
async function set(p,key,value,quiet){
  p[key]=value;
  await fetch('/api/photo',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id:p.id,patch:{[key]:value}})});
  toast();
  renderFilters();
  const stillListed=list().includes(p);
  renderGrid();
  if(stillListed){
    if(!quiet)renderPanel(p);
    cur=list().indexOf(p);
    [...$('#grid').children].forEach((el,n)=>el.classList.toggle('sel',n===cur));
  }else{
    select(cur);  // 直した結果、絞り込みから外れた → 次の写真へ送る
  }
}
$('#sync').onclick=async()=>{const r=await (await fetch('/api/sync',{method:'POST'})).json();
  alert(r.added.length?r.added.length+'枚追加: '+r.added.join(', '):'新しい写真はありません');await load()};
$('#only').onchange=$('#showex').onchange=()=>{cur=0;renderGrid();select(0)};
document.addEventListener('keydown',e=>{
  if(!$('#m-lineart').hidden) return;   // 線画タブでは写真の操作をしない
  if(/INPUT|TEXTAREA/.test(e.target.tagName))return;
  // 十字キーでグリッドを移動。上下は1行ぶん（列数はCSSから読む）
  const cols=getComputedStyle($('#grid')).gridTemplateColumns.split(' ').length;
  if(e.key==='ArrowRight'||e.key==='j'){select(cur+1);e.preventDefault()}
  if(e.key==='ArrowLeft'||e.key==='k'){select(cur-1);e.preventDefault()}
  if(e.key==='ArrowDown'){select(cur+cols);e.preventDefault()}
  if(e.key==='ArrowUp'){select(cur-cols);e.preventDefault()}
  const n=+e.key;
  if(n>=1&&n<=9){
    // 数字キーは「まだ入っていない一番上の軸」の n 番目の選択肢を入れる
    const p=list()[cur];const a=AXES.filter(x=>!x.auto).find(x=>!p[x.key]);
    const o=a?.options[n-1];if(o){set(p,a.key,o.value);e.preventDefault()}
  }
});

// ---------------------------------------------------------------- 線画
// 外側が page() のテンプレートリテラルなので、ここではバッククォートを使わず文字列連結で書く
let LA=[], LAMODELS={}, LASTYLE='', LASTYLEFILE='', LAREFS=[], laCur=0, laBusy=false;
let LAPEND=[];        // 線画がまだ無い用語
let laFilter='all';   // all / todo（未確認）/ done（確認済み）/ new（未生成の用語）
let laNew=null;       // 未生成から選んだ用語
const laShown=()=>LA.filter(it=>laFilter==='all'||(laFilter==='done'?it.checked:!it.checked));   // LASTYLE = 全図共通の指示

// 画面の状態は URL に持つ。リロードで戻るし、リンクとして渡せる
//   ?tab=lineart&slug=<線画>&c=<案>   /   ?tab=photo&id=<写真>
const URLQ=()=>new URLSearchParams(location.search);
function setQ(patch){
  const q=URLQ();
  for(const k in patch){ patch[k]==null ? q.delete(k) : q.set(k,patch[k]) }
  history.replaceState(null,'', location.pathname+(q.toString()?'?'+q:''));
}
const esc=(v)=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

function switchTab(name){
  setQ({tab:name});
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
  $('#m-photo').hidden = name!=='photo';
  $('#m-lineart').hidden = name!=='lineart';
  document.querySelectorAll('.photo-only').forEach(el=>{el.style.display = name==='photo'?'':'none'});
  $('#la-count').style.display = name==='lineart'?'':'none';
  if(name==='lineart' && !LA.length) laLoad();
}

async function laLoad(){
  const r=await (await fetch('/api/lineart')).json();
  LA=r.items; LAMODELS=r.models; LASTYLE=r.style||''; LASTYLEFILE=r.styleFile||''; LAREFS=r.references||[]; LAPEND=r.pending||[];
  $('#la-count').textContent = LA.length + ' 枚';
  const f=URLQ().get('f');
  if(['todo','done','new'].includes(f)) laFilter=f;
  const np=URLQ().get('new');
  if(np){ const t=LAPEND.find(x=>x.slug===np); if(t){ laFilter='new'; laNew=t } }
  const want=URLQ().get('slug');
  const i=want?LA.findIndex(x=>x.slug===want):-1;
  if(i>=0) laCur=i;
  laRenderList(); laRenderPanel();
}
function laRenderList(){
  const g=$('#la-list'); g.innerHTML='';
  const done=LA.filter(x=>x.checked).length;
  const bar=$('#la-filter');
  bar.innerHTML=[['all','すべて',LA.length],['todo','未確認',LA.length-done],['done','確認済み',done],
                 ['new','未生成',LAPEND.length]]
    .map(([k,label,n])=>'<button data-f="'+k+'"'+(laFilter===k?' class="on"':'')+'>'+label+'（'+n+'）</button>').join('');
  bar.querySelectorAll('button').forEach(b=>{b.onclick=()=>{laFilter=b.dataset.f;laNew=null;setQ({f:laFilter==='all'?null:laFilter,new:null});laRenderList();laRenderPanel()}});
  if(laFilter==='new'){
    LAPEND.forEach(t=>{
      const f=document.createElement('figure');
      f.className='pend'+(laNew&&laNew.slug===t.slug?' sel':'');
      f.innerHTML='<div class="pend-body"><b>'+esc(t.term||t.slug)+'</b>'
        +'<span class="en">'+esc(t.english)+'</span>'
        +(t.prominence?'<span class="pr pr-'+t.prominence+'">'+t.prominence+'</span>':'')
        +(t.subject?'<span class="pr pr-ready">下書きあり</span>':'')
        +'<p>'+esc((t.description||'').slice(0,60))+'</p></div>';
      f.onclick=()=>{laNew=t;setQ({new:t.slug});laRenderList();laRenderPanel()};
      g.appendChild(f);
    });
    return;
  }
  laShown().forEach((it)=>{
    const i=LA.indexOf(it);
    const f=document.createElement('figure');
    if(i===laCur) f.className='sel';
    f.innerHTML='<img loading="lazy" src="/lineart/'+it.slug+'.png?t='+it.mtime+'" alt="">'
      +(it.checked?'<span class="done-tag">確認済み</span>':'')
      +'<figcaption class="nm">'+esc(it.title||it.slug)+'</figcaption>';
    f.onclick=()=>{laCur=i;laPick=null;setQ({slug:LA[i].slug,c:null});laRenderList();laRenderPanel()};
    g.appendChild(f);
  });
  if(!laShown().length){
    const p=document.createElement('p');
    p.style.cssText='color:var(--dim);font-size:12px;padding:8px';
    p.textContent=laFilter==='todo'?'未確認のものはもう無い':'まだ無い';
    g.appendChild(p);
  }
}
let laPick=null;   // いま大きく見ている案（null なら採用中のもの）
const laCost=k=>{const c=LAMODELS[k]&&LAMODELS[k].cost; return typeof c==='number'?c:0};

function laRenderPanel(){
  if(laFilter==='new'){ return laRenderNewPanel(); }
  const it=LA[laCur]; if(!it){$('#la-panel').innerHTML='';$('#la-big').innerHTML='';$('#la-cands').innerHTML='';return}
  laRenderCands();
  let models=''; for(const k in LAMODELS){
    const m=LAMODELS[k];
    const price=typeof m.cost==='number'?('$'+m.cost.toFixed(3)+(m.estimated?'目安':'')):'料金不明';
    models+='<option value="'+k+'">'+esc((m.label||k)+'（'+(m.provider||'?')+'） '+price+' — '+(m.note||''))+'</option>';
  }
  $('#la-panel').innerHTML=
     '<div id="meta"><b>'+it.slug+'</b> <span style="color:var(--dim)">案 '+it.candidates.length+' 件</span></div>'
    +'<label class="chk"><input type="checkbox" id="la-checked"'+(it.checked?' checked':'')+'>'
    +'<span class="box"></span><span class="lb">確認済み</span>'
    +(it.checked?'<span class="when">'+esc(it.checked)+'</span>':'')+'</label>'
    +'<label class="f"><span>タイトル</span><input id="la-title" value="'+esc(it.title)+'"></label>'
    +'<label class="f"><span>説明（キャプションに使う）</span><input id="la-desc" value="'+esc(it.desc)+'"></label>'
    +'<label class="f"><span>用語集のslug</span><input id="la-term" value="'+esc(it.term)+'"></label>'
    +'<label class="f"><span>描くもの（英語。ここを書き換えて出し直す）</span><textarea id="la-subject">'+esc(it.subject)+'</textarea></label>'
    +'<div class="row2">'
    +'<label class="f"><span>モデル</span><select id="la-model">'+models+'</select></label>'
    +'<label class="f"><span>品質</span><select id="la-quality"><option>medium</option><option>low</option><option>high</option></select></label>'
    +'</div>'
    +'<label class="f"><span>何案出すか</span><select id="la-n"><option selected>1</option><option>2</option><option>3</option><option>4</option></select></label>'
    +(LAREFS.length
      ? '<details id="la-ref-box"><summary>参照画像（任意・'+LAREFS.length+'枚）</summary>'
        +'<div class="refs">'
        +LAREFS.map(r=>'<label class="ref" title="'+esc(r.note||r.file)+'">'
            +'<input type="checkbox" value="'+esc(r.file)+'">'
            +'<img src="/lineart-ref/'+encodeURIComponent(r.file)+'" alt="">'
            +'<span>'+esc(r.file.replace(/\.[^.]+$/,''))+'</span></label>').join('')
        +'</div>'
        +'<p style="color:var(--dim);font-size:11px;line-height:1.5">選んだ写真を一緒に送る。'
        +'指示の中で「1枚目からポーズ、2枚目から道具の構造」のように<b>どの写真から何を取るか</b>を書くと効く。</p>'
        +'</details>'
      : '')
    +'<button class="gen" id="la-gen">この指示で案を出す</button>'
    +'<details id="la-style-box"><summary>共通の指示（全図に自動で付く）</summary>'
    +'<textarea id="la-style" style="min-height:220px">'+esc(LASTYLE)+'</textarea>'
    +'<button id="la-style-save">共通の指示を保存</button>'
    +'<p style="color:var(--dim);font-size:11px;line-height:1.5">1行1文。保存すると次の生成から効く。'
    +'ここは全部の絵に共通なので、1枚だけの都合は上の「描くもの」に書く。<br>'
    +'ファイル: <code>'+esc(LASTYLEFILE)+'</code></p></details>'
    +'<div id="la-log"></div>';
  $('#la-gen').onclick=laGen;
  $('#la-checked').onchange=async(e)=>{
    const on=e.target.checked;
    try{
      const r=await (await fetch('/api/lineart/check',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({slug:it.slug,checked:on})})).json();
      if(!r.ok) throw new Error(r.error);
      LA=r.items; laRenderList(); laRenderPanel();
    }catch(err){ $('#la-log').textContent='✗ '+err.message; e.target.checked=!on; }
  };
  $('#la-style-save').onclick=async()=>{
    const btn=$('#la-style-save'); btn.disabled=true; btn.textContent='保存中…';
    try{
      const r=await fetch('/api/lineart/style',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({style:$('#la-style').value})}).then(r=>r.json());
      if(!r.ok) throw new Error(r.error||'保存できなかった');
      LASTYLE=r.style; btn.textContent='保存した';
    }catch(e){ btn.textContent='保存できなかった: '+e.message; }
    setTimeout(()=>{btn.disabled=false; btn.textContent='共通の指示を保存'},1500);
  };
  const upd=()=>{
    const n=+$('#la-n').value, m=$('#la-model').value;
    $('#la-gen').textContent='この指示で '+n+' 案を出す（$'+(laCost(m)*n).toFixed(3)+'）';
  };
  $('#la-n').onchange=upd; $('#la-model').onchange=upd; upd();
}

/** 未生成の用語から新しく作るためのパネル */
function laRenderNewPanel(){
  $('#la-big').innerHTML=''; $('#la-cands').innerHTML='';
  if(!laNew){ $('#la-panel').innerHTML='<p style="color:var(--dim);font-size:12px">左の一覧から用語を選ぶ</p>'; return; }
  const t=laNew;
  let models=''; for(const k in LAMODELS){ const m=LAMODELS[k];
    const price=typeof m.cost==='number'?('$'+m.cost.toFixed(3)):'?';
    models+='<option value="'+k+'">'+esc((m.label||k)+'（'+(m.provider||'?')+'） '+price)+'</option>'; }
  // 用意してある下書き。無いものは空のまま（雛形を入れると全部同じ指示になってしまう）
  const draft=t.subject||'';
  $('#la-panel').innerHTML=
     '<div id="meta"><b>'+esc(t.term)+'</b> <span style="color:var(--dim)">'+esc(t.english)+' / '+esc(t.slug)+'</span></div>'
    +'<p style="font-size:12px;line-height:1.7;color:var(--dim);margin:6px 0">'+esc(t.description||'')+'</p>'
    +'<label class="f"><span>説明（キャプションに使う）</span><input id="nw-desc" value="'+esc((t.description||'').split('。')[0]+'。')+'"></label>'
    +'<label class="f"><span>描くもの（英語。'+(draft?'下書きあり':'まだ無い。ここに書く')+'）</span>'
    +'<textarea id="nw-subject" placeholder="何をどの角度で描くかを英語で書く">'+esc(draft)+'</textarea></label>'
    +'<label class="f"><span>モデル</span><select id="nw-model">'+models+'</select></label>'
    +(LAREFS.length?'<details id="la-ref-box"><summary>参照画像（任意）</summary><div class="refs">'
      +LAREFS.map(r=>'<label class="ref" title="'+esc(r.note||r.file)+'"><input type="checkbox" value="'+esc(r.file)+'">'
        +'<img src="/lineart-ref/'+encodeURIComponent(r.file)+'" alt=""><span>'+esc(r.file.replace(/\.[^.]+$/,''))+'</span></label>').join('')
      +'</div></details>':'')
    +'<button class="gen" id="nw-gen">この用語の線画を作る</button>'
    +'<div id="la-log"></div>';
  $('#nw-gen').onclick=laGenNew;
}

async function laGenNew(){
  if(laBusy||!laNew) return;
  const t=laNew, model=$('#nw-model').value;
  const refFiles=[...document.querySelectorAll('#la-ref-box input:checked')].map(i=>i.value);
  laBusy=true; $('#nw-gen').disabled=true; $('#nw-gen').textContent='生成中…';
  $('#la-log').textContent=model+' に送信。概算 $'+laCost(model).toFixed(3);
  try{
    const res=await fetch('/api/lineart/gen',{method:'POST',body:JSON.stringify({
      slug:t.slug, subject:$('#nw-subject').value, model, count:1, refFiles,
      adopt:true, title:t.term, desc:$('#nw-desc').value, term:t.slug })});
    const r=await res.json().catch(()=>({ok:false,error:'HTTP '+res.status}));
    if(!r.ok) throw new Error(r.error||'失敗');
    // 作ったものは一覧に入るので、そちらへ切り替えて選択する
    await laLoad();
    laFilter='todo'; laNew=null; setQ({f:'todo',new:null});
    const i=LA.findIndex(x=>x.slug===t.slug); if(i>=0) laCur=i;
    setQ({slug:t.slug,c:null}); laRenderList(); laRenderPanel();
    toast();
  }catch(e){ $('#la-log').textContent='✗ '+e.message; }
  finally{ laBusy=false; const b=$('#nw-gen'); if(b){b.disabled=false;b.textContent='この用語の線画を作る';} }
}

function laRenderCands(){
  const it=LA[laCur];
  if(!laPick){
    const c=URLQ().get('c');
    const hit=c && it.candidates.find(x=>x.stamp===c);
    if(hit) laPick=hit.file;
  }
  const shown = laPick || (it.candidates.find(c=>c.adopted)||{}).file;
  $('#la-big').innerHTML = shown
    ? '<img src="/lineart-candidate/'+it.slug+'/'+shown+'" alt="">'
    : '<img src="/lineart/'+it.slug+'.png?t='+it.mtime+'" alt="">';
  const c=$('#la-cands'); c.innerHTML='';
  it.candidates.forEach(cd=>{
    const f=document.createElement('figure');
    f.className=(cd.file===shown?'on ':'')+(cd.adopted?'live':'');
    f.innerHTML='<img src="/lineart-candidate/'+it.slug+'/'+cd.file+'" alt="">'
      +(cd.adopted?'<span class="live-tag">採用中</span>':'')
      +'<div class="t">'+cd.stamp.slice(8,12)+(cd.modelLabel?' · '+esc(cd.modelLabel.replace(/（.*/,'')):'')+'</div>';
    f.onclick=()=>{laPick=cd.file;setQ({c:cd.stamp});laRenderCands();laShowAdopt(cd)};
    c.appendChild(f);
  });
  if(!it.candidates.length) c.innerHTML='<span style="color:#888;font-size:12px">案はまだ無い。右で指示を書いて出す</span>';
}

function laShowAdopt(cd){
  let b=$('#la-adopt');
  if(cd.adopted){ if(b) b.remove(); return }
  if(!b){ b=document.createElement('button'); b.id='la-adopt'; b.className='adopt'; $('#la-log').before(b) }
  b.textContent='この案を採用する';
  b.onclick=async()=>{
    const it=LA[laCur];
    const r=await (await fetch('/api/lineart/adopt',{method:'POST',body:JSON.stringify({
      slug:it.slug,file:cd.file,title:$('#la-title').value,desc:$('#la-desc').value,term:$('#la-term').value})})).json();
    if(!r.ok){ $('#la-log').textContent='✗ '+r.error; return }
    LA=r.items; laPick=null; setQ({c:null}); laRenderList(); laRenderPanel(); toast();
  };
}

async function laGen(){
  if(laBusy) return;
  const it=LA[laCur];
  const count=+$('#la-n').value, model=$('#la-model').value;
  const refFiles=[...document.querySelectorAll('#la-ref-box input:checked')].map(i=>i.value);
  const body={slug:it.slug,subject:$('#la-subject').value,model,quality:$('#la-quality').value,count,refFiles};
  laBusy=true; $('#la-gen').disabled=true; $('#la-gen').textContent=count+' 案を生成中…';
  $('#la-log').textContent=model+' に '+count+' 件送信'+(refFiles.length?'（参照画像 '+refFiles.length+'枚）':'')
    +'。概算 $'+(laCost(model)*count).toFixed(3);
  try{
    const res=await fetch('/api/lineart/gen',{method:'POST',body:JSON.stringify(body)});
    const r=await res.json().catch(()=>({ok:false,error:'返事を読めなかった（HTTP '+res.status+'）'}));
    if(!r.ok) throw new Error(r.error||('HTTP '+res.status));
    // パネルごと描き直すと、書きかけの指示やモデルの選択が消えて「続けて出せない」状態になる。
    // 案の並びと一覧だけを更新し、入力はそのまま残す
    LA=r.items; laPick=null; setQ({c:null});
    laRenderList(); laRenderCands();
    $('#la-log').textContent='✓ '+r.made+' 案できた。実費 $'+r.cost.toFixed(3)+'。下の並びから選んで採用する';
    toast();
  }catch(e){
    $('#la-log').textContent='✗ '+e.message;
  }finally{
    // 成功でも失敗でも必ず押せる状態に戻す
    laBusy=false;
    const b=$('#la-gen');
    if(b){ b.disabled=false; const n=+$('#la-n').value, m=$('#la-model').value;
      b.textContent='この指示で '+n+' 案を出す（$'+(laCost(m)*n).toFixed(3)+'）'; }
  }
}

document.querySelectorAll('#tabs button').forEach(b=>{b.onclick=()=>switchTab(b.dataset.tab)});

// admin 自身を書き換えたとき、node --watch が再起動する。画面もそれに追従して読み込み直す
(async()=>{
  let boot=null;
  for(;;){
    await new Promise(r=>setTimeout(r,1000));
    try{
      const b=(await (await fetch('/api/ping',{cache:'no-store'})).json()).boot;
      if(boot===null) boot=b;
      else if(b!==boot) location.reload();
    }catch(e){ /* 再起動中。次の周回で繋がる */ }
  }
})();

{const t=URLQ().get('tab'); if(t==='lineart') switchTab('lineart');}
load();
</script></body></html>`;
}

sync();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`climbing research admin  →  http://127.0.0.1:${PORT}`);
});
