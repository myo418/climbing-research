この `index.md` はサイドバーに用語集のリンクを出すための placeholder。frontmatter（`title` / `order`）だけ持ち、本文は空。

実際のページは `src/pages/basics/glossary/index.astro` と `[slug].astro` で描画され、データは `src/data/glossary.ts`。catchall（`src/pages/[...slug].astro`）の `customRoutes` で `basics/glossary` を除外して衝突を防いでいる。
