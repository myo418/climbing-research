# 出会った人々 ディレクトリ運用メモ

このファイルはサイトには出ない（[src/lib/pages.ts](../../../src/lib/pages.ts) の `isExcluded` で `CLAUDE.md` を除外）。

「私とクライミング」シリーズなど、自分の記事の中で**実際に出会った人物**として登場するクライマーを置く場所。
有名クライマー（[../famous/](../famous/)）と違って、出典が自分の体験で、本人の許諾なしに本名・写真を出さないことが多い。

## ファイル構成

```
contents/climbers/people/
├── index.md               # 一覧ページ用（タイトル / 序文 のみ）
├── rena/index.md
└── ...
```

- slug は ASCII 小文字ハイフン（仮名でも OK: `rena`, `boss-yamada` など）
- 画像を載せる場合は `public/people/<slug>.jpg` に置く（プライバシーに注意）

## frontmatter スキーマ

```yaml
---
# --- 必須 ---
title: れな                       # 表示名（仮名でも本名でも）

# --- ID / 関係 ---
role: Isara のオーナー            # この人の立場（カードのsubtitleに使う）
met_at: Isara                     # 出会った場所（ジム名・職場・大学など）
age: 30代（出会った当時）          # 年齢（自由記述、当時／現在を明記）
known_for: 亡くなった旦那さんが立ち上げた Isara を一人で続けている  # 1行の識別タグ

# --- クライマーとしての属性 ---
disciplines:
  - ボルダー
  - リード
home_gym: Isara                   # ホームジム
gyms:                             # よく登るジム（ホーム以外も含めて）
  - Isara
grade: ボルダー V?（未確認）       # 自由記述

# --- 引用・画像 ---
quote: "向こうのほうがハマっちゃってるじゃん"
image: /people/rena.jpg           # プライバシーOKな場合のみ
image_source: 本人提供 / なし

# --- 関連記事（逆引き） ---
appearances:                       # この人物が登場する記事の id
  - climbers/me/first-gym-visit

# --- リサーチ用メモ ---
research_relevance: 自分が初めて訪れたジムのオーナー。「残されたジム」というモチーフの起点
---
```

- 必須以外はすべて任意。値が無いフィールドは省略する
- `appearances` は記事の id（`climbers/me/<slug>` の形式）。レンダラが各記事の `title` を解決して逆リンクを表示する
- 本文は H1 不要（`ClimberProfile` が frontmatter の `title` から H1 を生成）
- 本文には散文を自由に書く（その人について自分が思っていること、印象的だった出来事など）

## レンダリング

| ルート | 実装 |
|---|---|
| `/climbers/people/` | [src/pages/climbers/people/index.astro](../../../src/pages/climbers/people/index.astro)。フラットなカード一覧 |
| `/climbers/people/<slug>/` | [src/pages/[...slug].astro](../../../src/pages/[...slug].astro) が prefix `climbers/people/` を見て [ClimberProfile.astro](../../../src/components/ClimberProfile.astro) を挿入（famous と共通のコンポーネント） |

- `[...slug].astro` の `customRoutes` に `'climbers/people'` を登録してルート衝突を回避
- カードは [ClimberCard.astro](../../../src/components/ClimberCard.astro)（famous と共通）

## サイドバーには出ない

- サイドバーは2階層まで（[src/components/Sidebar.astro](../../../src/components/Sidebar.astro) の `MAX_DEPTH`）
- 個別ページは3階層目なので、一覧ページから遷移する設計

## 記事から人物ページにリンクする

記事本文中で人物に言及するときは、Markdown のリンクで:

```markdown
[れなさん](/climbers/people/rena/)
```

人物ページ側の `appearances` に記事 id を書いておけば、人物ページから記事への逆引きも自動で出る。

## プライバシー

- 本名や顔写真を出すときは本人の同意を確認する
- 同意が取れていない場合は仮名（読み）にして frontmatter に何か注釈を残す
- 怪我や病気のエピソードは特にセンシティブなので扱いを慎重に
