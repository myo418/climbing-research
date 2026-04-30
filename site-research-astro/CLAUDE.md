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
