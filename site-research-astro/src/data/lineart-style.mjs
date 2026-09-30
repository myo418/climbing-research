import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 線画のスタイル定義。**ここが唯一の定義元**。
//
// - プロンプト（`node scripts/lineart.mjs prompt`）はここから組み立てる
// - 検査（`node scripts/lineart.mjs lint`）はここを基準に判定する
// - 一覧ページ（/lineart/）もここを読む
//
// 値を変えたら `npm run lineart lint` で既存の図を検査し直す。

/** キャンバス。図ごとにこの3つから選ぶ。中間サイズは作らない（並べたとき揃わなくなる） */
export const CANVAS = {
  square: { w: 240, h: 240, label: '正方形｜手・ホールド・道具など単体のもの' },
  portrait: { w: 200, h: 340, label: '縦｜立ち姿・壁に取り付いた全身' },
  wide: { w: 340, h: 200, label: '横｜壁の断面・複数人・動きの連なり' },
};

/** 図形を収める余白。この内側に描く */
export const PAD = 16;

/** 色。DESIGN.md のトークンと同じ値を持つ（SVGはCSS変数を読めないので実値を焼き込む） */
export const COLORS = {
  ink: '#1a1a1a', //     --color-ink   主線
  accent: '#6b1a14', //  --color-injury 注目させたい1箇所だけ
  muted: '#999999', //   補助線・寸法・軌跡
};

/** 線幅。3段階しかない */
export const WIDTHS = {
  main: 1.6, // 外形
  sub: 1, //    内部の構造線・関節・しわ
  hair: 0.6, // 細部・奥にあるもの・補助線
};

/** 破線。意味が決まっている */
export const DASH = {
  hidden: '4 3', //  手前のものに隠れて見えない線
  motion: '1 4', //  動きの軌跡・補助線・寸法線
};

/** 図の意味づけの約束。プロンプトにもドキュメントにもこの文言をそのまま使う */
export const RULES = [
  'ルート要素は `<svg xmlns viewBox role="img" fill="none" stroke-linecap="round" stroke-linejoin="round">`。width/height 属性は付けない（表示側で伸縮させる）。',
  '`<title>` に図の名前、`<desc>` に一行の説明を必ず入れる。読み上げと一覧ページのラベルがこれを使う。',
  '解説する用語が用語集にあるなら、ルート要素に `data-term="<用語のslug>"` を付ける。',
  '面は塗らない。`fill` は `none` のみ。マット・バッグ・靴・服なども黒ベタにしない。濃淡・グラデーション・影・テクスチャ・ハッチングは使わない。例外は点（しべ・ボルト・穴）で、半径2以下の `<circle>` に限り塗ってよい。',
  '**人体は、形は正確に・線は少なく**。比率と関節の位置は実物どおりにしつつ、引く線は輪郭と「形が変わる場所」（関節・段差・接地点）だけ。しわ・筋・布のたるみ・岩肌の質感は引かない。',
  '**岩は岩に見せる**。平らな面（ファセット）が硬い稜線で折れ合う不規則な塊として描き、長い割れ目を何本か通し、輪郭に欠けの段差を作る。なめらかな塊＋波線、製材のようなきれいな直方体、縦の波線だけの壁はどれも岩に見えない。面の境目と割れ目だけで作り、点描やハッチングで質感を出さない。背景の壁も同じで、角度のついた稜線を数本と割れ目1〜2本だけ引き、あとは空けておく。',
  '**道具・人工物は逆に、構造を省かない**。カラビナ・ボルト・ビレイ器・カム・ハーネス・シューズ・マシンは、部品・稜線・材料の厚み・縫い目・リベット・可動部を正しい位置に全部引く。直線は直線、円は円で、線の太さを揃えて部品図のように描く。',
  'いちばん太い線は外形だけに使う。内部の構造線は細い線で本数を出す。太さで陰影を作らない。',
  `色は3つだけ: 主線 ${COLORS.ink} / 注目 ${COLORS.accent} / 補助 ${COLORS.muted}。`,
  `注目色（${COLORS.accent}）は1つの図に1箇所だけ。「この図で見てほしいのはここ」という部分に使う。全体を赤くしない。`,
  `線幅は3段階だけ: 輪郭 ${WIDTHS.main} / 内側の線 ${WIDTHS.sub} / 奥のもの・補助線 ${WIDTHS.hair}。中間の値を作らない。`,
  `破線は意味が決まっている: 手前に隠れて見えない線は "${DASH.hidden}"、動きの軌跡や補助線は "${DASH.motion}"。装飾として破線を使わない。`,
  'SVGの中に文字を入れない（`<text>` 禁止）。ラベル・説明はページ側のキャプションで書く。フォントの有無に左右させないため。',
  '`<style>` `<script>` `<image>` `<filter>` は使わない。素の図形要素（path / circle / line / polyline / ellipse / rect / g）だけで描く。',
  '座標は小数第1位まで。整数で済むなら整数で書く。',
  'パスのコマンドは絶対座標の M / L / C / Q / Z だけを使う（手書き化のときに解釈できなくなるため）。円は `<circle>` でよい。',
  '陰影・ハッチング・輪郭の二重描きはしない。形は輪郭線と、面の変わり目を示す最小限の線だけで表す。',
  '線の数は「少なく」ではなく「必要なだけ」。ただし1本ごとに意味があること（その線が何の形の変わり目なのか言えること）。',
  '正面図・真横図を基本にする。奥行きのある斜めの構図は破綻しやすいので避ける。',
  '人体は輪郭線だけで描く。ただし**形は簡略化しない**: 頭身（立ち姿でおよそ7.5頭身）・肩幅・腰幅・関節の位置・筋肉のふくらみを実物に合わせる。**顔の造作は描かない**（目・眉・鼻・口を入れない。頭・髪・耳の輪郭までにとどめる）。',
  '手は比率を取ってから引く（手全体の長さ ≒ 顔の長さ、指の関節は 3:2:1.5 くらいの配分、中指がいちばん長く小指がいちばん短い）。同じ太さの棒を並べない。',
  '線の揺れは出力時に機械的に乗る。**素の線は丁寧に引く**。わざと下手に描かない、わざと歪ませない。',
  'その図で説明したい部分を画面の中心に大きく置く。全身が要らないなら体の一部だけを描く。',
];

/**
 * 画像生成に渡す共通のスタイル文。**本体は src/lineart/image-style.txt**。
 * admin（線画タブ）からも編集できるようにするため、コードではなくテキストで持つ。
 * 1行1文で書き、読み込むときに空白で繋ぐ。
 */
export const IMAGE_STYLE_FILE = 'src/lineart/image-style.txt';

export const IMAGE_STYLE = readImageStyle();

function readImageStyle() {
  // ビルド後は import.meta.url が dist/ の中を指すので、まずプロジェクト直下から探す
  const candidates = [
    path.resolve(process.cwd(), IMAGE_STYLE_FILE),
    fileURLToPath(new URL('../lineart/image-style.txt', import.meta.url)),
  ];
  const hit = candidates.find((f) => fs.existsSync(f));
  if (!hit) throw new Error(`${IMAGE_STYLE_FILE} が見つからない`);
  return fs.readFileSync(hit, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
}

/** 画像モデル。1枚あたりの概算費用つき（2026-09 時点） */
export const IMAGE_MODELS = {
  // label は画面に出す名前。provider を必ず付ける（flash（Google）と flare（OpenAI）が紛らわしいため）
  // cost は1枚あたり（1K・正方形）。estimated: true は公式の1枚単価が未公表で、他モデルから推した値
  'gemini-2.5-flash': {
    api: 'gemini', id: 'gemini-2.5-flash-image', provider: 'Google', label: 'Gemini 2.5 Flash',
    cost: 0.039, note: '既定。安くて安定。岩の面はやや細かめ',
  },
  'gemini-3.1-flash': {
    api: 'gemini', id: 'gemini-3.1-flash-image', provider: 'Google', label: 'Gemini 3.1 Flash',
    cost: 0.067, note: '岩の割れ方が自然で線も締まる。2.5 の約1.7倍',
  },
  'gemini-3-pro': {
    api: 'gemini', id: 'gemini-3-pro-image', provider: 'Google', label: 'Gemini 3 Pro',
    cost: 0.134, note: '岩の構造がいちばん彫刻的。最も高い',
  },
  'gemini-3.1-flash-lite': {
    api: 'gemini', id: 'gemini-3.1-flash-lite-image', provider: 'Google', label: 'Gemini 3.1 Flash Lite',
    cost: 0.034, note: 'いちばん安い。下書き向き',
  },
  'openai-2.5-sunburst': {
    api: 'openai', id: 'gpt-image-2.5-sunburst', provider: 'OpenAI', label: 'GPT Image 2.5 sunburst',
    cost: 0.053, estimated: true, note: '線が細い。gpt-image-2 と同じトークン単価',
  },
  'openai-2.5-flare': {
    api: 'openai', id: 'gpt-image-2.5-flare', provider: 'OpenAI', label: 'GPT Image 2.5 flare',
    cost: 0.053, estimated: true, note: 'sunburst と同帯',
  },
  'openai-2': {
    api: 'openai', id: 'gpt-image-2', provider: 'OpenAI', label: 'GPT Image 2',
    cost: 0.053, note: 'medium・正方形で $0.053',
  },
  'openai-1.5': {
    api: 'openai', id: 'gpt-image-1.5', provider: 'OpenAI', label: 'GPT Image 1.5',
    cost: 0.042, estimated: true, note: '1枚単価は未公表。gpt-image-1 と同程度と仮置き',
  },
  'openai': {
    api: 'openai', id: 'gpt-image-1', provider: 'OpenAI', label: 'GPT Image 1',
    cost: 0.042, note: '背景透過が直接出る。medium基準',
  },
  'openai-mini': {
    api: 'openai', id: 'gpt-image-1-mini', provider: 'OpenAI', label: 'GPT Image 1 mini',
    cost: 0.011, estimated: true, note: '1枚単価は未公表。low 相当と仮置き',
  },
};

/**
 * 料金の目安（1枚・正方形、2026-09 時点で公開情報から拾った値）。
 * gpt-image-1: low $0.011 / medium $0.042 / high $0.167
 * 実際の請求は各社のダッシュボードで確認する。
 */
export const OPENAI_QUALITY_COST = { low: 0.011, medium: 0.042, high: 0.167 };

/** プロンプトに手本として埋め込む既存の図（public/lineart/<slug>.svg） */
export const REFERENCE_SLUGS = ['crimp', 'sloper'];

/** 素の線（手で編集する方）。ここが編集対象 */
export const SRC_DIR = 'src/lineart';

/** 手書き化したもの（サイトが読む方）。`npm run lineart -- build` の生成物。直接編集しない */
export const OUT_DIR = 'public/lineart';

/**
 * 手書き感。素の線をそのまま出すと製図に見えるので、出力時に手のブレを乗せる。
 * 乱数の種は slug から作るので、同じ素の線からは毎回同じ結果が出る（差分が暴れない）。
 */
export const SKETCH = {
  /** ブレの大きさ（座標単位）。大きいほど震える */
  amplitude: 0.55,
  /** ブレの波長（座標単位）。小さいほど細かく震える */
  wavelength: 70,
  /** 線の描き始め・描き終わりの行き過ぎ（座標単位）。0 で無効 */
  overshoot: 0.6,
  /** 描き終わりを行き過ぎさせる確率。1 にすると全部の線端が飛び出して製図の見当線に見える */
  overshootChance: 0.2,
  /** 何度なぞるか。2 にすると同じ線を2回なぞったラフスケッチになる */
  passes: 1,
  /** 曲線を折れ線に分解するときの間隔。小さいほど忠実だがファイルが重くなる */
  step: 10,
};

/** 図の中で使ってよい値かどうかの判定（lint と共有） */
export const allowedColors = () => Object.values(COLORS);
export const allowedWidths = () => Object.values(WIDTHS).map(String);
export const allowedDashes = () => Object.values(DASH);
export const canvasList = () => Object.entries(CANVAS).map(([k, v]) => ({ key: k, ...v }));
