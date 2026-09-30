// クライマーMBTIの絵。スタイル文と被写体文の定義元はここ1か所。
//
// 2パターン出して見比べる:
//   lineart — サイトの他の線画と同じ規則（src/lineart/image-style.txt）。顔は描かない
//   poly    — MBTI風のローポリ。目の点だけある。塗りで見せるので線画の規則は使わない
//
// 出力は public/climber-mbti/<pattern>/<slug>.png
// 生成は `node scripts/climber-mbti-art.mjs`

import { IMAGE_STYLE } from './lineart-style.mjs';

/** 線画パターン。既存の線画とまったく同じスタイル文を使う */
export const LINEART_STYLE = IMAGE_STYLE;

/** ローポリパターン。{ACCENT} は生成時にグループのテープ色へ置き換わる */
export const POLY_STYLE = [
  'Flat vector illustration in a low-polygon style.',
  'The figures, the rock and the wall are built from flat triangular and quadrilateral facets of solid colour, each facet a slightly different tone of the same hue, so the form reads through faceted shading alone.',
  'No outlines, no strokes, no gradients, no blur, no texture, no drop shadows.',
  'Strictly limited palette: a warm off-white background (#F7F5F1), warm greys and a near-black (#1A1A1A) for clothing and hair, a muted skin tone, and exactly one accent colour {ACCENT} used only for the gear that belongs in the scene (crash pads, shoes, chalk bags, bags) and, in an indoor gym only, the bolt-on holds.',
  'Stylised human figures with simple proportions and small heads. Each face has two small dark dots for eyes and nothing else: no mouth, no nose, no eyebrows, no expression.',
  'Square composition, the whole subject inside the frame with a generous empty margin around it, seen from the side or three-quarters.',
  'Modern flat editorial illustration, like a card from a personality test.',
  'No text, no labels, no numbers, no logos, no frame, no border, no watermark.',
].join(' ');

/**
 * 外岩の絵に足す指示。これが無いと、自然の岩に
 * ジムのプラスチックホールドが生えた絵になる（実際そうなった）。
 */
export const NATURAL_ROCK = [
  'This is real rock outdoors, not a climbing gym.',
  'The stone has NO artificial climbing holds, NO bolt-on plastic holds, NO bolts, hangers, screws or coloured route tape on it.',
  'Every hold the climber uses is a natural feature of the stone itself: an edge where two facets meet, a crack, a flake, a pocket or a rounded bulge, the same colour as the rest of the rock.',
].join(' ');

/**
 * 被写体。英語で、構図（どこから見た絵か・何が画面に入るか）まで書く。
 * 曖昧だと岩がただの塊になったり、頼んでいない人物が増える（CLAUDE.md の「効いた言い回し」参照）。
 * outdoor: true を付けると NATURAL_ROCK が足され、岩にホールドが生えなくなる。
 */
export const SUBJECTS = [
  // ---- 16タイプ ----
  {
    slug: 'lone-feral', outdoor: true, kind: 'type', jp: '単独野生種', accent: '#b23b2e',
    subject: 'A single climber outdoors, seen from the side, in mid-air just after letting go of a boulder, both hands off the rock, knees drawn up, falling toward one crash pad lying on the ground below. The boulder is an angular mass of flat facets with a hard overhanging lip. Only one person appears in the picture.',
  },
  {
    slug: 'sunday-feral', outdoor: true, kind: 'type', jp: '日曜の野生児', accent: '#b08615',
    subject: 'A single climber seen from behind, walking toward a boulder with one large crash pad strapped to their back like a rucksack, head tilted up to look at the rock. The boulder ahead is an angular mass of flat facets. Only one person appears.',
  },
  {
    slug: 'dyno-addict', kind: 'type', jp: 'ランジ中毒', accent: '#2f5d86',
    subject: 'A single climber on a steep indoor overhanging wall panel, seen from the side, fully extended in mid-air between two bolt-on holds, both feet off the wall, one hand stretched toward a hold above. The wall is a plain flat panel with a few bolt-on holds. Only one person appears.',
  },
  {
    slug: 'monthly-burst', kind: 'type', jp: '月イチの爆発', accent: '#4c7a51',
    subject: 'A single climber sitting on the floor mat of an indoor gym, legs stretched out in front, leaning back on both hands, head tilted up toward the wall above. A chalk bag and one climbing shoe lie beside them. Only one person appears.',
  },
  {
    slug: 'finger-gambler', outdoor: true, kind: 'type', jp: '指を賭ける人', accent: '#b23b2e',
    subject: "Close view of a climber's right hand crimping a small sharp edge on natural rock, seen from the side so the back of the hand faces the viewer and the fingertips disappear over the far side of the edge. Two fingers are wrapped in tape. The forearm runs off the lower left edge of the frame and is cut by the frame. The rock is a block with a flat top face, a front face and a hard broken edge between them. Only the hand and the forearm appear: no head, no torso. No line crosses over the hand.",
  },
  {
    slug: 'rock-caller', outdoor: true, kind: 'type', jp: '岩を訪ねる人', accent: '#b08615',
    subject: 'A single climber standing on the ground in front of a boulder, seen from the side, reaching up with a brush in one hand to clean a hold, feet flat on the ground, not climbing. The boulder is an angular mass of flat facets with one long crack. Only one person appears.',
  },
  {
    slug: 'grade-machine', kind: 'type', jp: '昇段マシーン', accent: '#2f5d86',
    subject: 'A single climber hanging completely still from one small bolt-on hold on an indoor wall, seen from the side, body straight and close to the wall, the free hand dipped into a chalk bag at the waist. Only one person appears.',
  },
  {
    slug: 'steady-craftsman', kind: 'type', jp: '省エネ職人', accent: '#4c7a51',
    subject: 'A single climber topping out an indoor boulder wall, seen from the side, both hands pressing down on the flat top of the wall, one knee raised onto the edge, the movement calm and controlled. Only one person appears.',
  },
  {
    slug: 'charge-leader', outdoor: true, kind: 'type', jp: '岩場の突撃隊長', accent: '#b23b2e',
    subject: 'Three climbers at an outdoor boulder, seen from the side. The front climber is in mid-air just after jumping off the rock; two others stand on the ground below with both arms raised as spotters. Crash pads cover the ground. The boulder is an angular mass of flat facets. Exactly three people appear.',
  },
  {
    slug: 'road-trip', outdoor: true, kind: 'type', jp: '遠征隊', accent: '#b08615',
    subject: 'Four climbers standing beside a small boxy van parked at the edge of a boulder field, seen from the side. Crash pads lean against the van, bags and shoes sit on the ground, one person is closing the rear door. A boulder of flat angular facets sits in the background. Exactly four people appear.',
  },
  {
    slug: 'set-day-spark', kind: 'type', jp: '新セットの火付け役', accent: '#2f5d86',
    subject: 'Three climbers at an indoor wall, seen from the side. One is in mid-air on a brand new problem, both feet off the wall; the two others stand on the mat below, one pointing up at a hold. Fresh bolt-on holds of several shapes cover the panel. Exactly three people appear.',
  },
  {
    slug: 'party-climber', kind: 'type', jp: '宴会クライマー', accent: '#4c7a51',
    subject: 'Four climbers on the floor mat of an indoor gym, seen from the side. Three sit in a loose group; one stands with a raised fist, facing the wall and cheering. Chalk bags, shoes and water bottles lie around them. Exactly four people appear.',
  },
  {
    slug: 'project-captain', outdoor: true, kind: 'type', jp: 'プロジェクト班長', accent: '#b23b2e',
    subject: 'Two climbers at the foot of a rock face, seen from the side. One stands pointing up at a hold high on the wall; the other sits on a crash pad holding an open notebook, looking where the first is pointing. The rock is built from long flat facets meeting at hard edges with one crack. Exactly two people appear.',
  },
  {
    slug: 'weekend-pilgrim', outdoor: true, kind: 'type', jp: '休日の巡礼者', accent: '#b08615',
    subject: 'Three climbers sitting quietly on crash pads at the base of a boulder, seen from the side. One is dipping a hand into a chalk bag, the others rest with arms around their knees. Nobody is climbing. The boulder is an angular mass of flat facets. Exactly three people appear.',
  },
  {
    slug: 'gym-fixture', kind: 'type', jp: 'ジムの主', accent: '#2f5d86',
    subject: 'Two people beside a plain reception counter inside a climbing gym, seen from the side. One leans on the counter with arms folded, clearly settled in; the other stands with a bag still on the shoulder, just arrived. An indoor wall with bolt-on holds fills the background. Exactly two people appear.',
  },
  {
    slug: 'friday-regular', kind: 'type', jp: '金曜の常連', accent: '#4c7a51',
    subject: 'Two climbers standing side by side on the mat, seen from behind, both looking up at an indoor wall covered in bolt-on holds. One has a towel over the shoulder, the other holds a water bottle. Relaxed posture, nobody climbing. Exactly two people appear.',
  },

  // ---- 5軸 × 2極 ----
  {
    slug: 'axis-inward', kind: 'pole', jp: '孤 Inward', accent: '#1a1a1a',
    subject: 'A single climber standing alone on the mat in front of a large indoor wall, seen from behind, both hands clasped together behind the back, head tilted up reading the holds. Wide empty space around the figure. Only one person appears.',
  },
  {
    slug: 'axis-ensemble', kind: 'pole', jp: '群 Ensemble', accent: '#1a1a1a',
    subject: 'Four climbers standing in a loose half circle in front of an indoor wall, seen from the side. One in the middle is miming a climbing move in the air with both arms, the others watch. Exactly four people appear.',
  },
  {
    slug: 'axis-dynamic', kind: 'pole', jp: '動 Dynamic', accent: '#1a1a1a',
    subject: 'A single climber in mid-air on an indoor wall, seen from the side, at full stretch between two bolt-on holds, both hands and both feet off the wall, body arched upward. Only one person appears.',
  },
  {
    slug: 'axis-static', kind: 'pole', jp: '静 Static', accent: '#1a1a1a',
    subject: 'A single climber locked off on one bent arm on an indoor wall, seen from the side, body pressed close to the panel, both feet weighted on small footholds, the free hand reaching slowly toward the next hold. Only one person appears.',
  },
  {
    slug: 'axis-rock', outdoor: true, kind: 'pole', jp: '岩 Rock', accent: '#1a1a1a',
    subject: 'A single natural boulder standing in an open field, seen from the side, with one folded crash pad leaning against its base and no person in the picture. The boulder is an irregular angular mass of flat facets meeting along hard broken edges, with two long cracks running through it and chipped notches in its silhouette.',
  },
  {
    slug: 'axis-gym', kind: 'pole', jp: '壁 Gym', accent: '#1a1a1a',
    subject: 'A section of an indoor climbing wall seen straight from the front: a flat plywood panel with a grid of bolt holes and eight bolt-on holds of different shapes screwed onto it, plus a small strip of route tape beside the lowest hold. No person in the picture.',
  },
  {
    slug: 'axis-hooked', kind: 'pole', jp: '住 Hooked', accent: '#1a1a1a',
    subject: 'A single climber hanging by the fingertips from a wooden fingerboard mounted above a doorframe at home, seen from the side, feet off the floor, body still. A gym bag with shoes and a chalk bag sits on the floor below. Only one person appears.',
  },
  {
    slug: 'axis-visiting', kind: 'pole', jp: '通 Visiting', accent: '#1a1a1a',
    subject: 'A single climber walking out through a doorway, seen from the side, a small bag over one shoulder and a pair of climbing shoes hanging from one hand. Behind them, through the door, a corner of an indoor wall with a few holds. Only one person appears.',
  },
  {
    slug: 'axis-feel', kind: 'pole', jp: '感 Feel', accent: '#1a1a1a',
    subject: 'A single climber standing on the mat away from the wall, seen from the side, tracing a climbing move in empty air with the whole body: one arm reaching across, hips turned, one heel lifted, holding nothing. Only one person appears.',
  },
  {
    slug: 'axis-logic', kind: 'pole', jp: '理 Logic', accent: '#1a1a1a',
    subject: 'A single climber standing at an indoor wall, seen from the side, one open palm flat against a bolt-on hold while the other hand points up at the next hold, explaining. Only one person appears.',
  },
];

export const PATTERNS = {
  lineart: { dir: 'lineart', style: LINEART_STYLE, label: '線画' },
  poly: { dir: 'poly', style: POLY_STYLE, label: 'ローポリ' },
};

export const OUT_ROOT = 'public/climber-mbti';

/** サイトが読む軽い方。原本の png から作る（`node scripts/climber-mbti-art.mjs --web`） */
export const WEB_MAX = 900;
