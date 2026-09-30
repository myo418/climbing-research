// 「気まずい瞬間」の絵。スタイル文と被写体文の定義元はここ1か所。
//
// 線画（src/lineart/）とは別系統。線画は顔を描かない規則なので、
// 気まずさ——ばつの悪い笑い、目をそらす、言い出せない——が伝わらない。
// ここでは表情を読ませるために、塗りで見せる平面イラストにしている。
//
// 出力は public/awkward/<slug>.png と .webp（サイトが読むのは webp）
// 生成は `node scripts/awkward-art.mjs`

/** 全図共通のスタイル。絵ごとに書かない */
export const AWKWARD_STYLE = [
  'Flat vector editorial illustration. Solid colour fills and clean simple shapes, no outlines except where a thin darker line is needed to separate two shapes of the same tone.',
  'Stylised human figures with simple proportions and slightly large heads, so the faces read clearly at small size.',
  'Faces are simple but expressive: dot eyes, visible eyebrows and a single curved line for the mouth, drawn so the feeling is unmistakable — an awkward forced smile, eyes sliding away, a hesitant open mouth, a worried frown. No realism, no detailed features.',
  'Warm off-white background (#FAFAF8). Muted restrained palette: warm greys, near-black (#1A1A1A) for hair, a single warm skin tone, and small amounts of dusty blue (#5B7C99) and terracotta (#B5654A) used only for clothing, climbing shoes, chalk bags, crash pads and the bolt-on holds.',
  'Even flat lighting. No gradients, no blur, no drop shadows, no texture, no 3D shading.',
  'Square composition seen from the side or three-quarters, the whole scene inside the frame with a generous empty margin around it.',
  'No text, no speech bubbles, no labels, no numbers, no logos, no watermark, no frame, no border.',
].join(' ');

/** 屋内ジムの場面に足す指示。これが無いと、壁が自然の岩になったり床が地面になる */
export const GYM = [
  'The setting is an indoor climbing gym: flat plywood wall panels with a scatter of bolt-on plastic holds screwed on, and thick floor mats below.',
].join(' ');

/**
 * 被写体。英語で、誰が何をしているか・どこから見た絵か・画面に何人入るかまで書く。
 * 曖昧だと頼んでいない人物が増えたり、表情が消える（CLAUDE.md の「効いた言い回し」参照）。
 * 見出し（jp）は contents/communication/consideration/index.md の H3 と対応させる。
 */
export const SUBJECTS = [
  {
    slug: 'flash-someone-project',
    jp: '誰かが打ち込んでいる課題を一撃してしまう',
    subject:
      'Two people in an indoor climbing gym, seen from the side. One climber has just topped out a boulder problem and sits on the wall looking down with an awkward apologetic half-smile, one hand rubbing the back of their neck. Below on the mat, a second person stands looking up with folded arms and a flat, deflated expression, chalk still on their hands. Only two people appear.',
  },
  {
    slug: 'easy-for-me',
    jp: '自分の得意なムーブで一気に進んでしまう',
    subject:
      'Two people at an indoor climbing wall, seen from the side. A tall climber on the wall reaches a distant hold easily with one long arm, body relaxed, looking slightly embarrassed. Below, a shorter person stands on the mat with one arm stretched up into empty air, measuring the same distance, eyebrows raised in disbelief. Only two people appear.',
  },
  {
    slug: 'overlapping-line',
    jp: 'ラインが被っているか微妙なとき',
    subject:
      'Two people crouched on the floor mats of an indoor climbing gym, facing the same wall from either side of it, each with one hand on a low starting hold. Both have turned their heads to glance sideways at the other with hesitant, questioning faces, neither moving. Only two people appear.',
  },
  {
    slug: 'stepping-into-line',
    jp: '誰かがトライしようとしている壁に入ってしまう',
    subject:
      'Two people in an indoor climbing gym, seen from the side. One person stands in the middle of the mat directly in front of a wall, stretching their arms overhead with eyes closed, unaware. Behind them a second person is already crouched in a starting position at that wall, mouth half open about to speak, eyebrows raised. Only two people appear.',
  },
  {
    slug: 'sitting-on-pad',
    jp: 'マットの上に座っている人がいる',
    subject:
      'Two people in an indoor climbing gym, seen from the side. One person sits cross-legged in the middle of a thick crash pad on the floor, looking at a phone, relaxed. A second person stands a few steps away at the edge of the frame, looking at them with a worried, hesitant face, one hand half raised as if deciding whether to say something. Only two people appear.',
  },
  {
    slug: 'unsafe-behavior',
    jp: '危険につながりそうな行動を見かける',
    subject:
      'Two people in an indoor climbing gym, seen from the side. High on the wall a climber hangs from a hold directly above the landing zone. Standing right underneath, inside the fall line, a second person looks away at their phone, oblivious. A third person is not in the picture. The climber looks down with a tense, alarmed face. Only two people appear.',
  },
  {
    slug: 'cheering-warmup',
    jp: '大声で応援したら、アップの課題だったとき',
    subject:
      'Two people in an indoor climbing gym, seen from the side. One person stands on the mat with both hands cupped around their mouth, mid-shout, body leaning forward with enthusiasm. On the wall just above the ground, a second climber hangs casually from two large easy holds, turning their head back with a polite, slightly embarrassed smile. Only two people appear.',
  },
  {
    slug: 'cheering-worked-section',
    jp: 'ガンバと応援したのに、バラしだったとき',
    subject:
      'Two people in an indoor climbing gym, seen from the side. A climber has stopped mid-route, hanging from one hold and stepping back down toward the mat, turning to explain with an apologetic open-mouthed expression. On the mat, a second person stands with one fist still raised from cheering, face frozen in an awkward smile. Only two people appear.',
  },
  {
    slug: 'bumped-tripod',
    jp: '録画している三脚やスマホを触ってしまったとき',
    subject:
      'Two people in an indoor climbing gym, seen from the side. A small camera tripod with a phone mounted on it tilts over sideways on the floor mat. One person stands next to it, frozen, both hands raised, mouth open in a startled apologetic face. A second person a few steps away turns toward the tripod with wide eyes and raised eyebrows. Only two people appear.',
  },
  {
    slug: 'too-much-advice',
    jp: 'アドバイスを過剰にしている人を見たとき',
    subject:
      'Three people in an indoor climbing gym, seen from the side. A climber clings to the wall mid-problem with a tired, strained face. Right below, a second person points up at several holds with both hands, talking energetically. Further back, a third person watches the pair with a flat, uncomfortable expression, saying nothing. Only three people appear.',
  },
  {
    slug: 'always-yielding',
    jp: 'トライしたそうなのに、ずっと譲り続けている人がいるとき',
    subject:
      'Three people in an indoor climbing gym, seen from the side. One person stands at the back holding their climbing shoes against their chest, watching the wall with a longing face, one hand gesturing a small "after you". Two others walk past toward the wall without noticing. Only three people appear.',
  },
  {
    slug: 'used-wrong-hold-self',
    jp: '課題に含まれていないホールドを踏んだり掴んだとき',
    subject:
      'One person on an indoor climbing wall, seen from the side, mid-problem. One of their feet rests on a hold of a clearly different colour from the rest of their route. The climber looks down at that foot with a guilty, caught-out expression, eyes wide, mouth pressed flat. Only one person appears.',
  },
  {
    slug: 'wrong-hold-other',
    jp: '課題のホールドを間違えているとき',
    subject:
      'Two people in an indoor climbing gym, seen from the side. A climber high on the wall grips a hold of a different colour from the rest of their route, concentrating hard. Below on the mat, a second person watches with a pained, hesitant face, one hand half raised, clearly deciding whether to say something. Only two people appear.',
  },
  {
    slug: 'repeating-wrong-move',
    jp: '明らかに違うムーブで繰り返しているのを見たとき',
    subject:
      'Two people in an indoor climbing gym, seen from the side. A climber on the wall stretches toward a hold that is plainly out of reach, fingers short of it, face set in frustration. Below on the mat, a second person sits watching with a tight, patient, slightly pained expression, chin resting on one hand. Only two people appear.',
  },
  {
    slug: 'unasked-beta',
    jp: '聞かれていないのに教えたくなる',
    subject:
      'Two people in an indoor climbing gym, seen from the side. A climber stands at the foot of the wall staring up at it, arms at their sides, stuck. A step behind, a second person stands with one finger half raised and mouth slightly open, holding back the words, eyebrows knitted. Only two people appear.',
  },
  {
    slug: 'too-much-beta',
    jp: '教えたら正解を教えすぎてしまうとき',
    subject:
      'Two people standing together at the foot of an indoor climbing wall, seen from three-quarters. One points directly at a specific hold high on the wall, mouth open explaining, while their own face has already begun to fall into regret. The other looks up at the pointed hold with a blank, slightly disappointed expression. Only two people appear.',
  },
];

export const OUT_DIR = 'public/awkward';

/** サイトが読む軽い方。原本の png から作る（`node scripts/awkward-art.mjs --web`） */
export const WEB_MAX = 900;
