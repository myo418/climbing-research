# 岩場ページ 運用メモ

関連: [../../../CLAUDE.md](../../../CLAUDE.md)

`/places/crag/` は [src/pages/places/crag/index.astro](../../../src/pages/places/crag/index.astro) が描くカード一覧。
各岩場の frontmatter を読んでカードを作るので、**一覧に名前や説明を二重に書かない**。

## 岩場ページの frontmatter

```yaml
---
title: 鳩ノ巣          # 必須。カードの見出し
reading: はとのす       # 読み（海外は Hatonosu ではなく現地表記を入れる: Fontainebleau など）
area: 東京都奥多摩町（多摩川）
region: 国内           # 国内 / 海外。カードのグループ分けに使う（既定は国内）
rock: チャート          # タグ（岩質）
disciplines:           # タグ（登り方）。ボルダー / リード / クラック / マルチピッチ / ビッグウォール
  - ボルダー
scale: 100課題以上      # タグ（規模）
summary: 1〜2文。カードに出る短い説明
card: hatonosu.jpg     # そのフォルダ内の画像ファイル名。カードのサムネイル
order: 3               # 一覧の並び順（国内 1〜、海外 101〜）
---
```

- `card` を書かなければカードは「写真なし」になる（三峰がその状態）。
- サムネイルは `astro:assets` が幅560pxのwebpを作る。原本を縮小しておく必要はない。
- 本文の1行目に `# <岩場名>` を置く。カード一覧にはこの見出しは出ない。

## 一覧ページ側の持ちもの

[index.md](index.md) の frontmatter の `lead` がカードの上に出る導入文。本文（河原の共通条件・出典）はカードの下に出る。

## 新しい岩場を足す手順

1. `<slug>/index.md` を作り、上の frontmatter を書く
2. 写真を同じフォルダに置いて `card:` にファイル名を書く
3. 拾ってきた写真は Wikimedia Commons など再利用できるものだけにして、
   画像の直後に `<p class="figcaption">説明 — 撮影者 / <a href="...">Wikimedia Commons</a> / ライセンス</p>` を付ける

`order` が重複すると名前順になるだけなので、詰め直さなくてよい。

## 3階層目はサイドバーに出ない

サイドバーは2階層まで（[Sidebar.astro](../../../src/components/Sidebar.astro) の `MAX_DEPTH`）。
個別の岩場ページはカード一覧から入る設計。
