# 後藤ゼミ リサーチ｜インデックス

武蔵野美術大学 4年 / 後藤ゼミ / 開始: 2026-04-21

## テーマ
**「クライミングをする人々」／「クライミングと怪我」**
怪我のリスクがあるにもかかわらず、なぜ人はクライミングに打ち込むのか。
動機・身体観・リスクとの向き合い方を掘り下げる。

## リサーチクエスチョン（仮）
- なぜ怪我のリスクを引き受けてまで続けるのか
- クライマーにとって「怪我」はどういう意味を持つのか（挫折／通過儀礼／身体の対話？）
- 継続する人／やめる人の境界はどこにあるのか

---

## ファイル構成の規則

テーマごとに**フォルダ + 同名mdファイル**で管理する:

```
research/
├── CLAUDE.md                           ← このファイル（全体ハブ / インデックス）
├── site-requirements.md                ← 2サイト構成の要件定義
├── DESIGN.md                           ← デザインシステム（両サイトで共有）
├── videos.md                           ← 動画インベントリ（Vimeo/YouTube/ローカル）
├── <テーマ名>/
│   ├── <テーマ名>.md                   ← そのテーマの本体（素材）
│   └── (画像やサブメモもここに同居可)
├── shared/                             ← 両サイト共通のコンポーネント・トークン・コンテンツ
│   ├── top/top.md                      ← トップページ共通コンテンツ
│   └── weekly-report/weekly-report.md  ← 週次進捗
├── site-research/                      ← 内部サイト（ゼミ関係者向け、未精査含む、未構築）
└── site-public/                        ← 外部公開サイト（精査済みのみ、未構築）
```

**運用**:
- 新しいテーマに着手するときは `<テーマ名>/<テーマ名>.md` を作る
- そのテーマ固有の画像・Figma書き出し等も同じフォルダに置く
- 作ったら下の一覧表を更新する

---

## テーマ一覧

### 作成済み

| テーマ | ファイル | 状態 | 概要 |
|---|---|---|---|
| climbing-and-injury | [climbing-and-injury/climbing-and-injury.md](climbing-and-injury/climbing-and-injury.md) | 骨組み | 怪我の種類と発生経緯の事実整理（動機・心理は扱わない） |
| climbing-spot | [climbing-spot/climbing-spot.md](climbing-spot/climbing-spot.md) | 未作成 | (テーマ説明を書く) |

### これから作る候補

クライミング全般:
- `climbing-genres/` — ボルダー／リード／外岩／トラッド／アルパイン…
- `climbing-grades/` — V系／段級／Font／YDS（グレード体系）
- `climbing-moves/` — ムーブ・保持・身体の使い方
- `climbing-gear/` — シューズ・ロープ・プロテクション
- `climbing-history/` — ヨセミテ／日本／五輪
- `climbing-community/` — ジム／SNS／プロ

怪我:
- `injury-types/` — 指・肘・肩・腰など部位別
- `injury-taxonomy/` — 慢性／急性、オーバーユース／事故
- `injury-recovery/` — リハビリ・予防
- `injury-statistics/` — 事故統計

なぜ続けるのか（核心）:
- `why-hypotheses/` — フロー／身体対話／コミュ／リスクの美学…
- `why-voices/` — 当事者の声（インタビュー／SNS／ブログ）

参照・素材:
- `references/` — 映画・本・マンガ・写真の一覧
- `interviews/` — インタビュー記録
- `diagrams/` — Figma書き出しSVG/PNG

---

## 成果物

- **リサーチサイト（内部）**: ゼミ関係者向け、未精査含む全素材を公開 → [site-requirements.md](site-requirements.md) Part 1
- **公開サイト（外部）**: インタビュー対象者・一般向け、精査済みのみ → [site-requirements.md](site-requirements.md) Part 2
- **デザインシステム**: [DESIGN.md](DESIGN.md) — 両サイトで共有
- **ゼミ発表形式**: 未定

---

## 運用ルール

- メモは各テーマのmdか、このCLAUDE.mdに書く（memoryファイルは使わない）
- 新しいテーマフォルダを作ったら、この表の「作成済み」セクションに追加
- 各mdの冒頭に `関連: [隣接テーマのリンク]` を書いて横断しやすくする
- 情報が肥大化したらテーマを分割。CLAUDE.mdのインデックスも追従
