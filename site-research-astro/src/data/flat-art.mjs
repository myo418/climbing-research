// カードに載せる平面イラストの共通スタイル。色・図形・照明・画角の定義元はここ1か所。
//
// 「気まずい瞬間」（awkward-art.mjs）と「よくある行動」（common-action-art.mjs）が
// これを共有する。2つは同じページ群の中で隣り合って出るので、地色や差し色が
// 少しでもずれると別のサイトの絵に見える。だから片方だけ直せる形にはしていない。
//
// 線画（src/lineart/）とは別系統。線画は顔を描かない規則なので、表情や場面の
// 空気が要るものはこちらで描く。

/** 塗りと形の決まり */
export const FLAT_FILL =
  'Flat vector editorial illustration. Solid colour fills and clean simple shapes, no outlines except where a thin darker line is needed to separate two shapes of the same tone.';

/** 人物の描きぶり。小さく出しても顔が読める比率にする */
export const FLAT_FIGURES =
  'Stylised human figures with simple proportions and slightly large heads, so the faces read clearly at small size.';

/** 地色と差し色。ここを絵ごとに変えない */
export const FLAT_PALETTE =
  'Warm off-white background (#FAFAF8). Muted restrained palette: warm greys, near-black (#1A1A1A) for hair, a single warm skin tone, and small amounts of dusty blue (#5B7C99) and terracotta (#B5654A) used only for clothing, climbing shoes, chalk bags, crash pads and the bolt-on holds.';

/** 照明。影を落とさない */
export const FLAT_LIGHTING =
  'Even flat lighting. No gradients, no blur, no drop shadows, no texture, no 3D shading.';

/** 画角。正方形で、外周に余白を残す（webp を作るときに削るので余白が要る） */
export const FLAT_COMPOSITION =
  'Square composition seen from the side or three-quarters, the whole scene inside the frame with a generous empty margin around it.';

/** 文字を描かせない。見出しは md 側が持つので絵の中に文字は要らない */
export const FLAT_NOTEXT =
  'No text, no speech bubbles, no labels, no numbers, no logos, no watermark, no frame, no border.';

/** 屋内ジムの場面に足す指示。これが無いと、壁が自然の岩になったり床が地面になる */
export const GYM =
  'The setting is an indoor climbing gym: flat plywood wall panels with a scatter of bolt-on plastic holds screwed on, and thick floor mats below.';

/**
 * 表情の指示だけを差し替えて、スタイル文の全文を組む。
 * 気まずさを見せる絵と、淡々とした所作の絵で、要る表情が違うのはここだけ。
 */
export function flatStyle(facesLine) {
  return [
    FLAT_FILL,
    FLAT_FIGURES,
    facesLine,
    FLAT_PALETTE,
    FLAT_LIGHTING,
    FLAT_COMPOSITION,
    FLAT_NOTEXT,
  ].join(' ');
}

/** サイトが読む軽い方の長辺。原本の png から作る */
export const WEB_MAX = 900;
