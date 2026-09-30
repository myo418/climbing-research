# site-research-astro 運用メモ

関連: [../CLAUDE.md](../CLAUDE.md) / [../DESIGN.md](../DESIGN.md)

このファイルはサイトには出ない（[src/lib/pages.ts](src/lib/pages.ts) の `isExcluded` で `CLAUDE.md` を除外）。

## データの持ち方の使い分け

サイト内のコンテンツは**2系統**ある。新規に何かを追加するときはまずどっちかを決める。

### A. TSデータ配列 — `src/data/<topic>.ts`

**こういう時に使う**:
- 短く構造化されたエントリが**多数**（目安: 数十〜数百件以上）
- 説明は1〜数段落で収まる
- 一覧・検索・タグ絞込が主な入口
- 型で縛りたい（必須フィールド、タグのenum など）

**例**: [src/data/glossary.ts](src/data/glossary.ts) — 500語規模を見据えた用語集

**ページ化**:
- 一覧: `src/pages/<path>/index.astro` でデータ配列を描画
- 個別: `src/pages/<path>/[slug].astro` で `getStaticPaths` 自動生成
- サイドバーに出したい場合は、対応する `contents/<path>/index.md` を置き場として残す（本体はAstroページで描画、catchall の `customRoutes` に追加して衝突回避）

### B. md + frontmatter — `contents/<path>/<slug>/index.md`

**こういう時に使う**:
- 長文の記述、引用、画像を**自由に組み合わせた**ページ
- 件数は限定的（数件〜数十件）
- frontmatter の構造は緩くてよい（ページごとに項目がブレてもOK）

**例**: [contents/climbers/famous/](contents/climbers/famous/) — クライマーごとのプロフィール＋エッセイ的記述

**ページ化**:
- `src/pages/[...slug].astro` のcatchallが自動的に全 md を拾う
- frontmatter に共通スキーマがあるなら、専用 `.astro` を作って catchall から `customRoutes` で差し替える（例: `src/components/ClimberProfile.astro`）

### 判断に迷ったら

- **「このエントリをタグで絞り込みたい／検索したい／500件に増えても扱いたい」→ A（TS配列）**
- **「このページに独自の挿絵や動画やインタビュー引用を自由に置きたい」→ B（md）**
- 途中で気が変わっても移行は可能。ただし移行の手間より、最初に性質を見極める方が安い。

## frontmatter フラグ

- `draft: true` — 中身がまだ無いページ。サイドバーではリンクではなく `<span>` で表示される（[src/components/TreeNode.astro](src/components/TreeNode.astro)）。ページ自体は通常通り生成される。中身を書いたら外す。
- `private: true` — サイトから完全に除外（[src/lib/pages.ts](src/lib/pages.ts) の `isExcluded`）。
- `section: meta` — トップレベルのときだけ意味があり、サイドバーで仕切り線の下に置かれる。
- `reverseSort: true` — そのディレクトリの `index.md` に付けると、サイドバーで子の並び順を名前の降順にする（[src/components/tree.ts](src/components/tree.ts) の `sortChildren`）。日付名の週次レポートなど、新しいものを上に出したいときに使う。

## md 内のリンク

`astro.config.mjs` で `base: '/climbing-research'` を設定しているが、md 内のリンクには Astro が自動でプレフィックスを付けない。そのままだと `[れな](/climbers/people/rena/)` のような絶対パスが切れる。

これを解消するため、自前の remark プラグイン（[astro.config.mjs](astro.config.mjs) の `remarkBasePath`）が、md と mdx の `link` / `image` ノードのうち `/` で始まるパスに自動で `BASE` を前置する。

執筆時のルール:

- **同一サイト内のリンクは絶対パスで書く**: `[れな](/climbers/people/rena/)`
- 相対パス（`./foo/`, `../bar/`）も使えるが、ファイル移動に弱いので推奨しない
- 外部URL（`https://...`）や `//` で始まる scheme-relative URL は触らない
- 画像も同じ扱い（`/foo.png` は `BASE/foo.png` に変換される。同フォルダ内画像は `./foo.png` で書く）

## 写真（構図の勉強用）

登っている写真に構図の軸でタグを付けて、絞り込みながら見比べる仕組み。

### 置き場と流れ

```
public/photos/            ← 原本を放り込む場所。gitignore（1枚20〜70MBあるため）
public/photos/web/        ← 長辺1600pxに縮小したもの。admin が sips で自動生成。これをコミットする
src/data/photo-axes.mjs   ← 軸の定義。ここが唯一の定義元
src/data/photos.json      ← 値。admin が読み書きする
src/data/photos.ts        ← 上2つをまとめてサイトに渡す型付きラッパ
scripts/admin.mjs         ← 編集画面のサーバー
src/pages/design/photos/index.astro ← 一覧（/design/photos/）
```

1. `public/photos/` に写真を置く
2. `npm run admin` → <http://127.0.0.1:4701>。起動時に新しい写真を自動で取り込み、`web/` を生成する
3. 画面でタグを付ける（変更は即 `photos.json` に保存される。← → で移動、数字キーで未入力の軸を埋める）
4. `npm run build` でサイトに反映

### 付け間違いを直す

値の変更はいつでもできる。選択中のボタンをもう一度押すと外れ、別のボタンを押すと切り替わる。

間違いを**見つける**には、ヘッダの「見直す」の絞り込みを使う。軸の値を1つ選ぶとその値の写真だけが並ぶので、
まとめて見比べれば浮いているものが分かる。直すとその写真は絞り込みから外れて消え、次の写真に進む。
「未入力」を選べば、その軸だけ空のものを拾える。

履歴は git が持っている。まとめて戻したいときは `git diff src/data/photos.json` / `git checkout` で戻す。

`public/photos/` から原本を消しても `photos.json` の行は残り、`missing: true` が付くだけ。勝手には消さない。

### クライミングしていない写真を外す

集合写真・書影など、構図の勉強の対象にならない写真は admin の右パネルいちばん上のボタンで
**除外**にできる。`photos.json` に `excluded: true` が付き、こうなる:

- サイト（`/design/photos/`）に出なくなる（[src/data/photos.ts](src/data/photos.ts) の `photos` が除外済みの配列）
- admin の一覧からも消える。ヘッダの「除外も表示」で灰色にして呼び戻せる
- 入力済みの進捗の母数から外れる

タグを消すのではなく除外にする。あとで判断を変えられるし、拾ってきた画像の出典メモも残る。

### 軸を増やす

`src/data/photo-axes.mjs` の `AXES` に足すだけ。admin のボタンもサイトの絞り込みも自動で増える。
自由記述の項目を増やすときは同ファイルの `FIELDS`。

**ポート 4701** はこのプロジェクトの admin 用。
`astro dev` は 4700 を使う設定にしてある。
検証などで2つ目を立てたいときは `ADMIN_PORT=4702 npm run admin`。

**admin は書き換えると自動で再起動する**（`node --watch`）。`scripts/admin.mjs` と、そこから
import しているファイル（`lineart-gen.mjs` / `photo-axes.mjs` / `lineart-style.mjs`）が対象。
開いているブラウザも `/api/ping` の起動IDを見て自分で読み込み直すので、手で更新しなくてよい。
画像を生成している最中に保存すると、その生成は中断される。

**画面の状態は URL に入る。** リロードしても同じ場所に戻り、リンクとして渡せる。

| クエリ | 意味 |
|---|---|
| `?tab=photo` / `?tab=lineart` | どちらの画面か |
| `&id=<写真ID>` | 写真タブで開いている写真 |
| `&slug=<線画slug>` | 線画タブで開いている絵 |
| `&c=<案の日時>` | その絵のどの案を見ているか |

## 動きの可視化（動画）

別リポジトリ `~/git/move-visualizer` が書き出した動画を、サイトに載せられる形に変換して
Cloudflare R2 に置く。**動画はこのリポジトリに入れない**（写真と違って容量が大きく、
一度コミットすると履歴から消えないため）。

### 置き場と流れ

```
~/git/move-visualizer/output/            ← 元動画。このリポジトリには入れない
.move-visualizer-cache/                  ← H.264に変換したもの。手元の控え（gitに入れない）
  pointlight/<clip>.mp4 + .jpg           ← 等倍・60fpsのまま（1本 0.2〜0.4MB）
  silhouette/<clip>.mp4 + .jpg           ← 幅720に縮小（1本 0.4〜1.6MB）
  grid/<name>.mp4 + .jpg
src/data/move-visualizer.json            ← 一覧。R2のURL・寸法・長さ・容量。これをコミットする
scripts/move-visualizer.mjs              ← 変換してR2に上げる
src/data/move-visualizer.ts              ← 一覧を読む型付きラッパ
src/pages/design/move-visualizer/index.astro ← 一覧（/design/move-visualizer/）
```

配信元は R2 バケット `climbing-research` の `move-visualizer/` 配下。
公開URLは `https://pub-461fd1bfecdb44ea8e0f3d71c8e0bcc1.r2.dev/move-visualizer/<kind>/<id>.mp4`。

```bash
npm run move-visualizer                  # 変換して、作り直した分だけR2に上げる
npm run move-visualizer -- --force       # 変換をやり直す
npm run move-visualizer -- --upload-all  # 変換済みのものも含めて全部上げ直す
npm run move-visualizer -- --no-upload   # 変換だけして上げない
```

元動画の場所を変えたいときは `MOVE_VISUALIZER_DIR=<path>`。

### R2への接続

`~/.zshrc` の `CLOUDFLARE_API_TOKEN`（Stream と R2 Edit の両方の権限つき）と
`CLOUDFLARE_ACCOUNT_ID` を使う。CloudflareのREST APIを直接叩くので wrangler は要らない。
バケットと公開URLを変えるなら `R2_BUCKET` / `R2_PUBLIC_BASE`。

バケットは r2.dev の公開サブドメインを有効にしてある。**このバケットに置いたものは
URLを知っていれば誰でも落とせる**ので、顔が写る素材はここに入れない（下記）。
r2.dev はCloudflare自身が本番用途には勧めていない経路でもある。独自ドメインを
Cloudflareに載せたら、そちらへ切り替えて `R2_PUBLIC_BASE` を差し替える。

### 変換が要る理由

**ポイントライト映像は mpeg4（MPEG-4 Part 2）で書き出されていて、ブラウザが再生できない。**
H.264への変換は画質や容量の都合ではなく、再生できるようにするために必須。

ついでに容量も激減する。黒背景＋白点という中身のおかげで H.264 の圧縮が極端に効き、
**7.2MB → 0.4MB（18分の1）**。画質を落とす必要がないので等倍・60fpsのまま載せている。
シルエットは実写が残るぶん圧縮が効かないので、幅720に落として容量を抑えている。
全体では 147MB → 25MB。

### 出さないもの

`grid_original_*`（元映像を並べたもの）は変換対象から外している（スクリプトの `EXCLUDE`）。
可視化を通していない生の映像で、**ジムに居合わせた人の顔が写るコマがある**。
R2は公開バケットなので、これらを置く先としては使えない。出すなら署名URLとドメイン制限が
かけられる Cloudflare Stream の方（[videos.md](../videos.md) を見る）。
載せるなら本人の許諾を取ってから。

### ページの作り

クリップ番号（`C0598` など）でポイントライトとシルエットを組にして、上部のボタンで表示を切り替える。
両方の `<video>` を最初から置いて `hidden` で切り替えるだけなので、
`preload="none"` のまま——つまり再生するまで1本も読み込まずに——両方を持てる。

縦位置と横位置のクリップが混在している（縦12・横4）。`width` / `height` を出しているので
並べても比率は崩れない。
