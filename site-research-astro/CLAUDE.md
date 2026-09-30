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
- `narrow: true` — 本文の幅を 960px から 720px に狭める（[src/layouts/Layout.astro](src/layouts/Layout.astro)）。動画の埋め込みや図をその幅いっぱいに置くページ用。例: [contents/references/best-videos/](contents/references/best-videos/)
- `image_height: <px>` — そのページの本文中の画像を、指定した高さに一律で揃える（幅は縦横比なり）。縦横比がまちまちな書影などを並べるページ用。例: [contents/references/books/](contents/references/books/) は 320。
- `image_side: true` — 画像を左に置き、続く説明をその右に回り込ませる（`image_height` と併用する）。画像の幅はまちまちなので置き場の幅の方を固定してあり、説明の左端が全項目でそろう。画面幅700px以下では縦積みに戻る。

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

## admin の「線画」タブ

同じ admin（`npm run admin`）に写真と線画の2画面がある。線画側は**1つの絵に対して複数の案を出し、その中から選んで採用する**作りになっている。

```
src/lineart/candidates/<slug>/<日時>.png   案。何枚でも溜まる（.gitignore 済み）
src/lineart/candidates/<slug>/<日時>.txt   その案を出したときの指示
public/lineart/<slug>.png                  採用した1枚。サイトが読むのはこれ
src/lineart/<slug>.prompt.txt              採用した案の指示＋タイトル・説明・用語slug
```

使い方:

1. 左の一覧から絵を選ぶ。サイトと同じ地色（`#fafaf8`）を敷いて表示する
   （線画は背景が透過なので、VSCode や macOS のプレビューでは地色が黒くなって見づらい）
2. 右の「描くもの」の英文を書き換え、**何案出すか**（1〜4）を選んで生成する。同時に投げるので待ち時間は1枚ぶんに近い
3. 下に案が並ぶ。クリックすると大きく表示され、「この案を採用する」で `public/lineart/` に出る
4. 採用し直すのはいつでもできる。**案は消えないので、前の絵に戻せる**

モデル（openai / gemini）、品質（low / medium / high）、手本にする絵（CLIの `--ref`）も同じ画面で選べる。
タイトル・説明・用語slugは採用時に `src/lineart/<slug>.prompt.txt` へ書かれ、サイトはそこを読む。

CLI の `gen` は `public/lineart/<slug>.png` を同名で上書きするだけで前の版が残らない。
**作り直しを繰り返すときは admin を使う。**

生成は課金される（1枚 $0.04 前後）。ボタンに「この指示で 2 案を出す（$0.084）」のように総額が出て、終わると実費が出る。

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

## 線画（用語・動作の解説図）

持ち方やムーブは文章だけだと伝わらない。スタイルをそろえた線画を1枚ずつ足していく仕組み。

### 2つの作り方

| | 画像生成（`gen`） | 手描きSVG（`prompt` → `build`） |
|---|---|---|
| 向くもの | 手・体・岩など**有機的な形**。写実がいるもの | 壁の断面・力の向き・位置関係など**図解**。正確さがいるもの |
| 出力 | PNG（ラスタ） | SVG（ベクタ・後から1行直せる） |
| 費用 | 1枚 $0.04 前後 | 無料 |
| 揺らぎ | 毎回ちがう絵が出る（プロンプトは控えが残る） | 同じ素の線から毎回同じ結果 |

**手と人体は生成を使う**。座標を書いて人体を組み立てても参考画像の水準には届かない（試した）。
逆に「この角度の壁にこの力がかかる」のような図は生成だと嘘が混ざるので手描きSVGで描く。

参考にする絵は `src/lineart/references/` に置く（権利物なので `public/` に置かない。
[README](src/lineart/references/README.md) に基準を書いてある）。

### 画像生成で作る

```bash
npm run lineart -- gen crimp "クリンプ" "A rock climber's right hand gripping a small edge in a full crimp…" \
  --desc "小さい縁に指先を立てる持ち方。" --term crimp
```

- 被写体の説明は**英語**で、構図（side view / 何がどこから入るか）まで書く。ここが曖昧だと岩がただの塊になる
- スタイル文（`IMAGE_STYLE`）は `lineart-style.mjs` が持つので毎回書かない
- 既定は **Gemini 2.5 Flash（$0.039）**。`--model` で切り替える（`npm run lineart -- models` で候補と実勢価格が出る）
- `--ref <slug>` で既に通った絵を手本として渡せる（スタイルを揃えたいとき）
- 出力は `public/lineart/<slug>.png`、投げた指示は `src/lineart/<slug>.prompt.txt` に残る。
  作り直したいときはこの控えを見て被写体の説明だけ書き換える
- **課金される**。1枚 $0.04 前後。まとめて回すときは総額で考える（30枚なら $1.26。$1 を超えるなら先に確認を取る）

#### プロンプトの組み立て

送っているのは**2つをつないだ1本の文字列だけ**:

```
<被写体文>            ← gen の第3引数。絵ごとに書く。英語
(空行)
<IMAGE_STYLE>        ← lineart-style.mjs の固定文。全図共通。絵ごとに書かない
```

生成パラメータ: `model=gpt-image-1` / `quality`（既定 medium）/ `size`（既定 1024x1024）/ `background=transparent`。
生成後に ImageMagick で「白→透明・トリム・余白24px・長辺1200px」に揃える。

投げた内容は `src/lineart/<slug>.prompt.txt` に2節で残る。描き直しは被写体文を書き換えて `regen`。

| 用途 | 指定 | 1枚あたり |
|---|---|---|
| 既定 | なし（Gemini 2.5 Flash） | $0.039 |
| 下書きを数で回す | `--model gemini-3.1-flash-lite` | $0.034 |
| 岩や線をもう一段上げる | `--model gemini-3.1-flash` | $0.067 |
| いちばん強い | `--model gemini-3-pro` | $0.134 |
| 背景透過が要る／品質段階を使う | `--model openai --quality high` | $0.011〜$0.167 |
| 縦長の被写体（立ち姿・壁） | `--portrait` | Gemini は同額 / OpenAI は×1.5 |
| 横長の被写体（壁の断面・並べる図） | `--landscape` | 同上 |

**品質の段階（`--quality`）は OpenAI 系だけ**。Gemini は段階が無く1枚固定料金で、比率だけ指定できる。

### 何を残しているか

- `src/lineart/<slug>.prompt.txt` — 採用中の絵の見出し（title / desc / term / model / date）と、被写体文・当時の共通スタイル
- `src/lineart/candidates/<slug>/<時刻>.json` — 案ごとに**送った全文**・被写体文・当時のスタイル・モデル・品質・手本・実費・日時
- 共通スタイルは書き換えていくので、**生成時点のものを案ごとに保存**している。採用時もその案のスタイルを控えに書く

**`src/lineart/references/` の参考画像はAPIに送っていない。** 権利物なので送らない。
参考画像は「基準を言葉にするための材料」で、そこから起こした文言が `IMAGE_STYLE` と `RULES` に入っている。
生成時に手本として渡せるのは `--ref` で指定する**自分の既存の絵**だけ。

#### 効いた言い回し・効かなかった言い回し

被写体の説明のしかたで結果がはっきり変わる。実際に試した結果:

| | 書き方 | 結果 |
|---|---|---|
| ✗ | 「壁（wall）」とだけ書く | 壁の線が手前の手を貫通する |
| ✗ | 「大きい岩（big rock hold）」 | 輪郭のぼやけた布袋のような塊になる |
| ✓ | 「上面・前面・角を持つ直方体の岩棚」 | 岩として成立し、指がどこに乗っているか分かる |
| ✗ | 「正面から見た手」 | 手前に指を巻き込む＝壁の裏から見た形になる |
| ✓ | 「手の甲が見える向き。指先は縁の向こうに隠れる」 | 正しい向きになる |
| ✓ | 「no line crosses over the hand」 | 前後関係の破綻が減る |
| ✗ | 寄りの図で「forearm entering from the lower left」だけ書く | 頼んでいない頭部が生えて主題が小さくなる |
| ✓ | 「Only the hand and the forearm appear: no head, no torso」 | 主題だけが残る |

対になる図（フルクリンプ／ハーフクリンプなど）は `--ref` で片方を手本に渡すと、
岩の形・画角・線質が揃う。**揃えたいときは必ず使う。**

ただし **`--ref` は「1か所だけ直す」には使えない**。「顔だけ消して、あとはそのまま」と指示しても
全体が描き直されて画角と線が崩れる。既にある図を直したいときは、控え（`*.prompt.txt`）に残っている
元の被写体文でもう一度生成する方が結果がいい。

### 置き場と流れ

```
src/data/lineart-style.mjs   ← スタイルの定義。ここが唯一の定義元（色・線幅・キャンバス・手ブレ・画像プロンプト）
src/lineart/references/      ← 描きぶりの手本にする既存の線画（サイトには出さない）
src/lineart/<slug>.prompt.txt ← 生成に使った指示の控え（title / desc / term もここ）
public/lineart/<slug>.png    ← 生成した線画。サイトが読む
src/lineart/<slug>.svg       ← 素の線。**編集するのはこっち**。<title> / <desc> / data-term を持つ
public/lineart/<slug>.svg    ← 手書き化した生成物。サイトが読む方。直接編集しない
scripts/lineart.mjs          ← 入口（gen / prompt / lint / build / list / preview）
scripts/lineart-gen.mjs      ← 画像生成を呼ぶ処理
scripts/lineart-sketch.mjs   ← 手ブレを乗せる処理
src/data/lineart.ts          ← 生成物を読んでサイトに渡す型付きラッパ（一覧表を二重に持たない）
```

**線画の一覧ページはサイトに置いていない**（2026-10-01に削除）。全部を並べて見たいときは admin の「線画」タブを使う。
サイトに出るのは、各ページが `![…](/lineart/<slug>.png)` で呼んでいる絵と、用語集のページに自動で出る絵だけ。

**手書き感は絵ごとに手で付けない。** 素の線はきれいなベジエで描いてよく、出力のときに
全部の図へ同じ強さのブレ（震え・描き終わりの行き過ぎ）が機械的に乗る。
乱数の種は slug から作るので、同じ素の線からは毎回まったく同じ生成物が出る（差分が暴れない）。
強さを変えたいときは `lineart-style.mjs` の `SKETCH`（`amplitude` 震え幅 / `wavelength` 震えの細かさ /
`overshoot` 行き過ぎ / `passes` なぞる回数 / `step` 曲線の分解精度）。変えたら `build` で作り直す。

1 枚描くときの手順:

```bash
npm run lineart -- prompt heel-hook "ヒールフック" --canvas square --term heel-hook
```

出てきたプロンプトをそのまま Claude に渡す。スタイル定義と既存の手本 SVG（`REFERENCE_SLUGS`）が
丸ごと埋め込まれているので、指示を書き足す必要はない。描けたら:

```bash
npm run lineart -- lint heel-hook      # スタイル定義から外れていないか
npm run lineart -- build heel-hook     # 手ブレを乗せて public/lineart に出す（引数なしで全部）
npm run lineart -- preview heel-hook   # PNG に書き出して実際に目で見る
npm run lineart -- list                # いま何枚あるか
```

`npm run build` の前に `build` が自動で走る（package.json の `prebuild`）ので、
生成物の作り忘れでサイトが古いままになることはない。

`lint` は色・線幅・破線・キャンバス・`<title>`/`<desc>` の有無・禁止要素をすべて機械的に見る。
✗ が出たら直す。! は警告（はみ出し、線が多すぎる、赤の使いすぎ、用語集に無い `data-term`）。

### 用語集とのつながり

SVG なら ルート要素に `data-term="<用語のslug>"`、生成PNGなら控えの `term:` 行。
どちらもその用語のページ（`/basics/glossary/<slug>/`）に自動で出る。
紐づけの情報は図の側だけが持ち、`glossary.ts` は触らない。

md から使うときは普通の画像として書く: `![クリンプ](/lineart/crimp.svg)`

### スタイルを変えるとき

`src/data/lineart-style.mjs` を直してから `npm run lineart -- build` で全部作り直し、
`npm run lineart -- lint` を全体にかける。
既存の図が新しい定義から外れていれば ✗ で出る。プロンプトも一覧ページも同じファイルを読むので、
文言を直す場所は1か所だけ。

手本（`REFERENCE_SLUGS`）に指定した図がスタイルの実質的な基準になる。
描きぶりを変えたいときは、ルール文を増やすより手本を差し替える方が効く。
