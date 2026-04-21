# デザインシステム

関連: [CLAUDE.md](CLAUDE.md) / [site-requirements.md](site-requirements.md)

## 目的

サイトは**静的**（スクロールで読むもの、インタラクションは最小限）だが、
ページ間の**視覚トーンと構造を完全に統一**するため、再利用可能なコンポーネントと
デザイントークンをここで定義する。

- ここは「決まり事」を書く場所
- 実装コードではなく、**何を作るか／どう使うかの仕様**
- Figmaで作ったデザインとコード実装の**間を繋ぐ合意書**
- **`site-research/`（内部）と `site-public/`（公開）の両サイトで共有**する
  - トークン・プリミティブ・コンテンツコンポーネントは完全共有
  - 表現コンポーネントも共有するが、使うかどうかはサイトごとに判断
  - サイトごとにトーン強度は変わる（公開サイトは厳密適用、内部サイトは機能優先）

---

## 1. トーン・思想

- **展示物のように読ませる** — 余白を多く、1画面に1つの主題
- **タイポグラフィ中心** — 写真は効果的に抑制して使う
- **モノトーン＋アクセント1色** — 怪我＝暗赤、または主題に応じて切替
- **静けさ** — アニメーション・装飾は最小。動きは"意味がある時だけ"
- **美大の成果物**としての強度 — 凡庸なブログに見えないこと

---

## 2. デザイントークン

### 2-1. 色（仮）
| トークン | 値 | 用途 |
|---|---|---|
| `--color-bg` | `#f7f5f1` | 背景（オフホワイト） |
| `--color-ink` | `#1a1a1a` | 本文テキスト |
| `--color-ink-muted` | `#666` | 補助・キャプション |
| `--color-line` | `#ddd8d0` | 罫線・区切り |
| `--color-injury` | `#6b1a14` | 怪我系アクセント（暗赤） |
| `--color-accent` | `#c8a96b` | 一般アクセント |
| `--color-bg-inverse` | `#1a1a1a` | ダーク反転セクション |

→ 最終的にはFigmaで決める。ここは初期値。

### 2-2. タイポグラフィ
| トークン | 値 | 用途 |
|---|---|---|
| `--font-serif` | `"Noto Serif JP", serif` | 見出し・引用 |
| `--font-sans` | `"Inter", "Noto Sans JP", sans-serif` | 本文・UI |
| `--font-mono` | `"JetBrains Mono", monospace` | コード・データ |

スケール（clampで可変）:
| トークン | 値 |
|---|---|
| `--fs-caption` | `12px` |
| `--fs-body` | `16px` |
| `--fs-lead` | `18px` |
| `--fs-h3` | `clamp(1.125rem, 2vw, 1.5rem)` |
| `--fs-h2` | `clamp(1.5rem, 3vw, 2.25rem)` |
| `--fs-h1` | `clamp(2rem, 5vw, 3.5rem)` |
| `--fs-display` | `clamp(2.5rem, 8vw, 6rem)` |

行間:
| トークン | 値 |
|---|---|
| `--lh-tight` | `1.2` |
| `--lh-body` | `1.7` |
| `--lh-prose` | `1.9` |

### 2-3. 余白・スペーシング
8pxグリッド基準:
| トークン | 値 |
|---|---|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `16px` |
| `--space-4` | `24px` |
| `--space-5` | `40px` |
| `--space-6` | `64px` |
| `--space-7` | `104px` |
| `--space-8` | `168px` |

ページ余白:
| トークン | 値 |
|---|---|
| `--page-margin` | `clamp(16px, 6vw, 96px)` |
| `--max-prose-width` | `66ch` |
| `--max-content-width` | `1200px` |

### 2-4. ボーダー・角丸・影
| トークン | 値 |
|---|---|
| `--radius-0` | `0` |
| `--radius-sm` | `2px` |
| `--radius-md` | `6px` |
| `--border-thin` | `1px solid var(--color-line)` |

基本**角丸なし・影なし**。使う時は意味がある時だけ。

### 2-5. ブレークポイント
| 名前 | 値 | 想定 |
|---|---|---|
| `sm` | `640px` | スマホ横〜小タブ |
| `md` | `960px` | タブレット |
| `lg` | `1280px` | PC |

モバイルファースト。

---

## 3. レイアウトプリミティブ（構造の原子）

全ページこれの組み合わせで組む。

### `<PageLayout>`
ヘッダー・フッター・メインの外枠。全ページ必ずこれを通す。

```
<PageLayout title="..." section="injury">
  {children}
</PageLayout>
```

### `<Container>`
横方向の最大幅制御。`width="prose" | "content" | "full"`。

### `<Stack gap="4">`
縦並び。子要素間の余白をトークンで指定。

### `<Grid cols="2" gap="4">`
2列以上のグリッド。レスポンシブで自動的に1列に折る。

### `<Prose>`
本文の見た目を適用する領域。MDX本文は基本これで包む。
見出し・段落・リスト・引用・リンクのスタイルが一括で決まる。

---

## 4. コンテンツコンポーネント

MDX本文から呼び出す再利用パーツ。

### `<Heading level={1|2|3} kicker="...">`
見出し。`kicker`で小さい冠見出しを出せる。

### `<Lead>`
各ページの冒頭のリード文（やや大きく・行間広く）。

### `<Quote author="..." source="...">`
インタビューや文献の引用。装飾は罫線のみ。

### `<Figure src="..." caption="..." credit="...">`
画像+キャプション+クレジット。クレジットは極小グレー。

### `<VideoEmbed host="vimeo|yt|local|link" id="..." caption="..." credit="..." />`
動画埋め込み。`host`で出し分け:
- `vimeo` → Vimeoプレーヤーiframe（関連動画・タイトル非表示）
- `yt` → YouTube埋め込み（`rel=0` で関連を抑制、モディスト設定）
- `local` → `<video autoPlay loop muted playsInline>`（短尺ループ想定）
- `link` → 静止画サムネ + 外部リンク（サイト内再生しない）

動画の元情報は `videos.md` に一元管理。MDX上ではID/パスのみ記載。
`caption` / `credit` は `<Figure>` と同じルール。

### `<Callout type="note|warning">`
メモや注意書き。トーンに応じて左罫線の色を変える。

### `<Footnote id="...">...</Footnote>` / `<FootnoteRef id="..." />`
注釈の相互リンク。ページ末に集約表示。

### `<TagList tags={["指", "A2プーリー"]} />`
タグ・分類表示。薄い背景のピル。

### `<SourceLink href="..." title="..." type="book|article|video">`
参考文献リンク。タイプに応じてアイコンを変える。

---

## 5. 表現コンポーネント（静的図解）

**動かない**。SVGか画像ベース。インタラクションは将来の差し替え用に抽象化のみ。

### `<BodyDiagram highlights={["shoulder", "finger-a2"]} />`
人体図に部位をハイライト。SVGを静的に出力。ホバー反応は入れない（初期版）。

### `<Timeline events={[...]} orientation="horizontal" />`
年表。横長で置く。スクロールで追う。動きなし。

### `<GradeTable />`
グレード換算表。純粋な表。

### `<ConceptMap image="..." legend={...} />`
概念マップ。Figmaで作った図を画像で読み込み、凡例だけHTMLで重ねる。

### `<QuoteCloud quotes={[...]} />`
複数引用を浮遊レイアウトで配置。SVG or 絶対位置CSSで静的に描画。

### `<FishboneDiagram data={...} />`
要因分析の魚骨図。

**原則**: これらはすべて**静的レンダリング**。状態を持たず、propsだけで見た目が決まる。

---

## 6. メディア方針

### 画像
- 原則webp。`<Figure>`経由で挿入
- alt必須、credit必須
- FigmaからSVG書き出し → `diagrams/`配下に置く → `<Figure>`で読む

### 動画
- **全て`<VideoEmbed>`経由で埋め込む**（生の`<iframe>`や`<video>`をMDXに直接書かない）
- ホスティング先と選び分けは[videos.md](videos.md)に準拠:
  - 中核コンテンツ・インタビュー → Vimeo（`host="vimeo"`）
  - 記録・参考資料 → YouTube限定公開（`host="yt"`）
  - 5〜10秒のループ → Vercel直置き（`host="local"`、自動再生ループ）
  - 外部作品の引用 → リンクのみ（`host="link"`）
- `local`以外は**自動再生しない**（クリックで再生）
- キャプション・クレジット必須（`<Figure>`と同ルール）

### GIF
- アニメーションGIFは原則使わない。mp4 or webmに置換して`<VideoEmbed host="local">`で扱う

### アイコン
- 必要最小限。自作SVGを`components/icons/`に置く

---

## 7. アクセシビリティ（最低限）

- 文字色と背景のコントラスト比 ≥ 4.5:1
- フォーカス可視（`:focus-visible`で統一スタイル）
- 画像alt必須
- 見出しの階層を飛ばさない（h1→h2→h3）
- 色だけで情報を伝えない（アイコンやラベルを添える）

---

## 8. Figma ⇄ 実装の対応

### トークン対応
Figma Variablesで同名のトークンを作り、値を一致させる:

| Figma Variable | CSS Variable |
|---|---|
| `color/bg` | `--color-bg` |
| `color/ink` | `--color-ink` |
| `text/size/body` | `--fs-body` |
| `space/4` | `--space-4` |

同期は当面**手動**。値を変えるときは両方を更新。

### デザイン→実装のフロー
1. Figmaでページや図解をデザイン
2. このDESIGN.mdに該当コンポーネントが**あるか確認**
3. なければコンポーネントを新規追加（設計をこのmdに追記）
4. 既存コンポーネントで組めるなら、MDX内に配置するだけ

### 図解ファイルの書き出しルール
- SVGで書き出し（文字含む）
- ファイル名: `diagrams/<subject>-<name>.svg`
- ビューポート: 親コンテナに合わせてscalable（width/height指定なし）

---

## 9. 命名規則

- コンポーネントファイル: `PascalCase.tsx` / `PascalCase.astro`
- CSS変数: `--kebab-case`
- クラス名（CSS Modules使用時）: `camelCase`
- MDXファイル: `kebab-case.mdx`

---

## 10. 変更運用

- 色・タイポ・余白のトークン変更は**このDESIGN.md → tokens.cssの順**で更新
- 新しい再利用コンポーネントを追加したら、Section 3〜5のどれかに追記
- 試作的な一回限りの表現は`experiments/`に置き、DESIGN.mdには書かない
- 不要になったコンポーネントは即削除（ゴミを残さない）

---

## 11. 現時点の未決事項

- [ ] 基調色の最終決定（`--color-bg` と `--color-ink`、暗赤の色味）
- [ ] 和文フォントの決定（Noto Serif JP / 源ノ明朝 / その他）
- [ ] ダークモードを持たせるか
- [ ] ページ間遷移のトーン（フェード／なし）
- [ ] 図版のアスペクト比統一ルール
