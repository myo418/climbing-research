# 動画インベントリ

関連: [CLAUDE.md](CLAUDE.md) / [DESIGN.md](DESIGN.md)

## 目的

Google Photosにある元動画を棚卸しし、公開用ホスティング先とIDを一元管理する。
サイトのMDXから参照する**ソース・オブ・トゥルース**。

## ホスティング方針

YouTube / Vimeo / ローカルの**3方式すべてに対応**。動画ごとに最適な場所を選ぶ。

| ホスト | 向いている用途 | 料金 | UI・見た目 |
|---|---|---|---|
| **Cloudflare R2** | 顔が写らない素材。ムーブ実演、可視化、アンビエント | 10GBまで無料 | UIなし。素の `<video>` で読める |
| **Cloudflare Stream** | **顔が写るもの**。署名URLとドメイン制限がかけられる | Starter 1,000分枠（契約済） | iframeかhls.jsが要る |
| **Vimeo** | 中核コンテンツ、インタビュー、ポートフォリオ的な見せ所 | Free 2GB / Starter $12/月 60GB | 広告なし・関連動画なし・ロゴ最小、静か |
| **YouTube（限定公開）** | 長尺の記録、参考資料、本数が多い補助コンテンツ | 無料・無制限 | 標準UIあり（関連動画やボタン） |

### 選び分けの原則

- **顔が写らない素材** → R2。素の `<video>` で読めるのでページの作りを縛らない
- **顔が写るもの** → Stream。署名URLとドメイン制限で見られる範囲を絞る。
  ただしこれは露出を狭めるだけで、**許諾やぼかしの代わりにはならない**
- **「このページの顔」になる動画** → Vimeo
- **記録として置いておくだけ** → YouTube 限定公開
- **既存の参考作品（Free Solo等）** → リンクのみ（再アップせず出典として紹介）

### R2とStreamの使い分けが「顔」で決まる理由

R2は公開バケット（r2.dev）なので、**URLを知っていれば誰でも落とせる**。
Streamは `requireSignedURLs` と `allowedOrigins` で埋め込み先を絞れる。
一方でStreamはHLS配信なので、ChromeやFirefoxでは素の `<video>` では再生できず、
iframe埋め込みかhls.jsが要る。**保護が要らないものにStreamを使うと構造だけ重くなる。**

### プライバシー設定の推奨
- **Vimeo**: Hide from Vimeo.com / 埋め込みドメイン制限（Standard以上）
- **YouTube**: 限定公開（unlisted）をデフォルト。広く見せたい物だけ公開

### ホストコード（表で使う略号）
- `r2` — Cloudflare R2（バケット `climbing-research`）
- `stream` — Cloudflare Stream
- `vimeo` — Vimeo
- `yt` — YouTube
- `link` — 外部動画へのリンクのみ

---

## インタビュー

| # | 元ID (GPhotos) | 被写体・タイトル | 長さ | ホスト | 公開ID / パス | 公開設定 | 状態 | 使用ページ |
|---|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  | 未処理 |  |

## ムーブ実演・ループ

| # | 元ID (GPhotos) | ムーブ名 | 長さ | ホスト | 公開ID / パス | 状態 | 使用ページ |
|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  | 未処理 |  |

## 風景・アンビエント（ジム・外岩・日常）

| # | 元ID (GPhotos) | 内容 | 長さ | ホスト | 公開ID / パス | 公開設定 | 状態 | 使用ページ |
|---|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  | 未処理 |  |

## 動きの可視化（move-visualizer）

登っている映像から関節座標を取り出し、点や影として描き直したもの。
制作は別リポジトリ `~/git/move-visualizer`、掲載先は [/design/move-visualizer/](site-research-astro/src/pages/design/move-visualizer/index.astro)。

| 種別 | 本数 | ホスト | 公開ID / パス | 状態 |
|---|---|---|---|---|
| ポイントライト（黒地に白点） | 16 | `r2` | `move-visualizer/pointlight/C05xx.mp4` | 埋め込み済 |
| シルエット | 16 | `r2` | `move-visualizer/silhouette/C05xx.mp4` | 埋め込み済 |
| 16本並べた一覧（点・影 各1） | 2 | `r2` | `move-visualizer/grid/grid_4x4*.mp4` | 埋め込み済 |
| 元映像（幅1280・60fps） | 16 | `r2` | `move-visualizer/original/C05xx.mp4` | 埋め込み済 |
| 元映像を並べたもの（`grid_original_*`） | 4 | — | — | 保留 |

元動画（計147MB）も、H.264に変換した25MBぶんも**リポジトリに入れない**。
変換したものはR2に上げ、コミットするのは一覧（`src/data/move-visualizer.json`）だけ。
変換とアップロードは `cd site-research-astro && npm run move-visualizer`。

公開URLの先頭は `https://pub-461fd1bfecdb44ea8e0f3d71c8e0bcc1.r2.dev/`。

**`grid_original_*` は保留**。可視化を通していない元映像で、ジムに居合わせた人の顔が写るコマがある。
載せるなら本人の許諾を取ってから。変換スクリプトの `EXCLUDE` で弾いている。
**R2は公開バケットなので、出すことになってもR2ではなくStreamに置く。**

### 元映像の置き場

`~/git/move-visualizer/original/` に84本（22GB）。2026-10-01にGoogle Photosから77本を落とし、
足りない7本（C0604・C0606・C0609〜C0613）をGoogle Driveから降ろして揃えた。
控えは Drive の `マイドライブ/武蔵野美術大学/卒業制作/move-visualizer/original/` にあり、
そちらは131本（C0598〜C0738、39.2GB）。**手元のものは作業用で、実体はDriveにある。**

可視化に使った16本（C0598〜C0613）は全部そろっている。

切り出しはしていない。元映像とポイントライトの長さが完全に一致する（差0.00秒）ので、
**クリップ版＝元映像そのもの**。唯一の例外が `clipped/C0612.mp4` で、これは224MBの元映像から
19.1秒を切り出したもの。その元映像は未取得。

## 参考動画（外部作品 / 引用）

| # | タイトル | 出典・制作 | URL | 用途 | 使用ページ |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |

---

## 状態の値

- `未処理` — 元動画は把握したがまだホストに上げていない
- `編集中` — トリミング・書き出し待ち
- `アップ済` — ホストにあげ、ID/パスを記載済
- `埋め込み済` — 該当ページのMDXに配置済み
- `保留` — 使うか未確定

## 公開設定の値

| 値 | Vimeo | YouTube |
|---|---|---|
| `hidden` | Hide from Vimeo.com | 限定公開 (unlisted) ※**デフォルト** |
| `domain` | 埋め込みドメイン制限 (Standard+) | — |
| `public` | 一般公開 | 公開 |

---

## 処理フロー

1. Google Photosで候補動画を選ぶ
2. 元ID・タイトル・長さ・ホスト予定をこの表に追加（`状態: 未処理`）
3. ダウンロード → 必要なら編集（トリミング・画質調整）
4. ホストにアップロード:
   - 顔が写る → Stream（署名URL・ドメイン制限つき）
   - 顔が写らない短尺・ループ → R2
   - 中核的・見せたい → Vimeo
   - 記録・参考 → YouTube 限定公開
5. 公開ID / パスをこの表に追記、状態を`アップ済`に
6. MDXから `<VideoEmbed host="r2|stream|vimeo|yt" id="..." caption="..." />` で呼び出す
7. 使用ページを記入、状態を`埋め込み済`に

---

## 運用メモ

- 元ID列は**Google Photosの共有リンクURL末尾**でも、**短いメモ**でも可
- 元データの保管も忘れずに（外付け or Drive別フォルダに`originals/`）
- 使わなくなった動画は各ホスト上で削除 or 非公開化
- 動画タイトルは内部管理用でOK、埋め込み時はサイト側の `caption` で指定

---

## 公開ID・パスの記法例

| ホスト | 記法例 | 取得場所 |
|---|---|---|
| `vimeo` | `987654321` | Vimeo URL末尾の数字（`vimeo.com/987654321`） |
| `yt` | `dQw4w9WgXcQ` | URLの `v=` 以降 11文字 |
| `r2` | `move-visualizer/pointlight/C0598.mp4` | バケット内のキー。頭に公開URLを付けて使う |
| `stream` | `6d3ec384390a057eee30be5bddb56a16` | Streamの動画UID |
| `link` | URLそのまま | 外部動画のフルURL |
