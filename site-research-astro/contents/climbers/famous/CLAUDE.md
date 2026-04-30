# 有名クライマー ディレクトリ運用メモ

このファイルはサイトには出ない（[src/lib/pages.ts](../../../src/lib/pages.ts) の `isExcluded` で `CLAUDE.md` を除外）。

## ファイル構成

各クライマーは `<slug>/index.md` で1ファイル:

```
contents/climbers/famous/
├── index.md               # 一覧ページ用（サイドバーのタイトル / frontmatter のみ用途）
├── tomoa-narasaki/index.md
├── adam-ondra/index.md
└── ...
```

- slug は小文字ハイフン（`adam-ondra` / `yuji-hirayama` / `wolfgang-gullich`）
- slug と画像ファイル名を一致させる（`public/climbers/<slug>.jpg`）

## frontmatter スキーマ

```yaml
---
# --- 必須 ---
title: 楢崎智亜           # 日本語名
nationality: 日本         # 国名のみ（カードのグルーピングに使う）
status: active            # active | legend | deceased

# --- ID / 表示 ---
reading: ならさきともあ   # 日本人のみ：カードのふりがな表示に使う
name_en: Tomoa Narasaki   # 英名 / native Latin 表記：外国人カードの subtitle に使う

# --- 生涯・出身 ---
birthdate: 1996-06-22     # YYYY-MM-DD（YAML の Date として解釈される）
death: 1992-08-31         # 故人のみ
hometown: 栃木県宇都宮市   # 詳細な出身地（都道府県〜市）

# --- クライマーとしての属性 ---
disciplines:              # 専門ジャンル（リスクの質が変わるので分析軸になる）
  - ボルダー
  - リード
career_start: 9歳         # 登り始めた年齢・年（任意）
height: 170 cm            # 任意・プライバシー配慮
weight: 62 kg             # 任意・プライバシー配慮
known_for: 独自のコーディネーションムーブ「トモア・スキップ」  # 1行の識別タグ
quote: "名言の引用文"      # 代表的な発言

# --- 画像 ---
image: /climbers/tomoa-narasaki.jpg
image_source: Wikimedia Commons

# --- 実績 ---
ascents:                  # 完登した代表的な課題
  - 2016 IFSC世界選手権 ボルダリング 優勝
injuries:                 # 怪我・手術歴（テーマの核、優先的に埋めたい）
  - 2019 右膝半月板損傷（要確認）
competitions:             # コンペ成績
  - 2020 東京オリンピック 男子コンバインド 4位

# --- 関連メディア・外部情報 ---
documentary:              # 関連ドキュメンタリー映画
  - Free Solo (2018)
sponsors:                 # スポンサー・所属
  - The North Face
links:                    # 外部リンク（キーは wikipedia / website / instagram / twitter / youtube）
  wikipedia: https://ja.wikipedia.org/wiki/楢崎智亜
  website: https://example.com
  instagram: https://instagram.com/...

# --- リサーチ用メモ ---
research_relevance: このリサーチで取り上げる理由（自分用メモ）
---
```

- 必須以外はすべて**任意**。値が無ければフィールドごと省略する（`（要確認）` は分かってるのに裏取りが甘い時だけ）
- 本文は H1 不要（`ClimberProfile` が frontmatter の `title` から自動で H1 を出す）
- 本文にはプロフィール散文・追加の考察を書く（frontmatter で表現できない部分）

## カードの subtitle 分岐

- `nationality === '日本'` → `reading` を表示（ふりがな）
- それ以外 → `name_en` を表示（native 表記）

## 画像

- 置き場所: [public/climbers/](../../../public/climbers/)
- ソース: Wikipedia / Wikimedia Commons の infobox 画像（250px サムネイル）
- Wikimedia の取得で気を付ける点:
  - User-Agent 制限あり → ブラウザ系 UA（`Mozilla/5.0 ...`）を使う
  - 未キャッシュのサイズ（400px など）を叩くと HTTP 429 になる → Wikipedia で実際に表示されている 250px を使う
  - 複数並列で叩くと 429 になるので 2 秒程度間隔をあける

## レンダリング

| ルート | 実装 |
|---|---|
| `/climbers/famous/` | [src/pages/climbers/famous/index.astro](../../../src/pages/climbers/famous/index.astro)（カスタム）。日本／海外現役／海外レジェンドでグルーピングしてカード表示 |
| `/climbers/famous/<slug>/` | [src/pages/[...slug].astro](../../../src/pages/[...slug].astro) が `id` の prefix `climbers/famous/` を見て [ClimberProfile.astro](../../../src/components/ClimberProfile.astro) を挿入 |

- `[...slug].astro` の `customRoutes` に `'climbers/famous'` を登録してルート衝突を回避
- 一覧のカードは [ClimberCard.astro](../../../src/components/ClimberCard.astro)

## サイドバーには出ない

- サイドバーは2階層まで（[src/components/Sidebar.astro](../../../src/components/Sidebar.astro) の `MAX_DEPTH`）
- 個別クライマーページは3階層目なので、一覧ページ（カード）から遷移する設計

## 新しいクライマーを追加する手順

1. slug を決める（`<firstname>-<lastname>` 形式、ASCII 小文字ハイフン）
2. `contents/climbers/famous/<slug>/index.md` を作成、frontmatter の必須項目を埋める（最低限 `title` / `nationality` / `status`）
3. 画像を取得して `public/climbers/<slug>.jpg` に配置
4. `nationality === '日本'` なら `reading`、そうでないなら `name_en` を確実に入れる
5. 一覧ページの国籍／status 分類は自動なので追加作業は不要
