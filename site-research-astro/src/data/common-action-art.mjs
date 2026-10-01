// 「よくある行動」の絵。被写体文の定義元はここ1か所。
// 色・図形・照明・画角は flat-art.mjs が持つ（「気まずい瞬間」と共有している）。
//
// 気まずい瞬間の絵と違って、ここで見せたいのは表情ではなく所作そのもの——
// 手がどこにあるか、体がどう向いているか、何を持っているか。だから表情の指示は
// 「淡々としている」方向に振ってあり、被写体文では手と道具の位置を先に書く。
//
// 出力は public/common-action/<slug>.png と .webp / mono/<slug>.webp（サイトが読むのは mono の webp）
// 生成は `node scripts/common-action-art.mjs`

import { flatStyle, GYM, WEB_MAX } from './flat-art.mjs';

export { GYM, WEB_MAX };

/**
 * 表情の指示。所作の絵なので、感情を立てるとかえって邪魔になる。
 * 集中・観察・説明といった「作業中の顔」に寄せる。
 */
const FACES =
  'Faces are simple and calm: dot eyes, light eyebrows and a single short line for the mouth. The expressions are ordinary and unforced — concentrating, watching, explaining, quietly satisfied — never exaggerated or comical. No realism, no detailed features.';

/** 全図共通のスタイル。色・画角は flat-art.mjs が持つ。絵ごとに書かない */
export const ACTION_STYLE = flatStyle(FACES);

/**
 * 被写体。英語で、誰が何をしているか・どこから見た絵か・画面に何人入るかまで書く。
 * 曖昧だと頼んでいない人物が増えたり、手元が消える（CLAUDE.md の「効いた言い回し」参照）。
 *
 * 手元だけの図では「Only the hands and forearms appear: no head, no torso」を必ず書く。
 * これが無いと頼んでいない頭部が生えて、見せたい手が小さくなる。
 *
 * 見出し（jp）は contents/communication/common-action/index.md の H3 と対応させる。
 */
export const SUBJECTS = [
  {
    slug: 'hands-behind-back',
    jp: '後ろで手を組む',
    subject:
      'One person in an indoor climbing gym, seen from behind and slightly to the side, standing a few steps back from the wall on the floor mat. Both hands are clasped together behind the lower back. The head is tilted up toward the holds high on the wall, the body completely still, weight even on both feet. Their face is not visible. Only one person appears.',
  },
  {
    slug: 'fist-bump',
    jp: 'グータッチ',
    subject:
      'Two people standing on the floor mat of an indoor climbing gym, seen from the side, facing each other at arm\'s length. Each extends one closed fist and the two fists touch knuckle to knuckle at chest height, clearly the centre of the picture. Both are relaxed, one giving a small satisfied smile. Chalk dust on their hands. Only two people appear.',
  },
  {
    slug: 'air-fist-bump',
    jp: 'エアーグータッチ',
    subject:
      'Two people in an indoor climbing gym, far apart, seen from the side. One stands high on the wall holding a hold with one hand; the other stands on the mat far below. Each holds one closed fist out toward the other across the empty space between them, the two fists not touching, a clear gap of air in the middle of the picture. Both look toward the other calmly. Only two people appear.',
  },
  {
    slug: 'brushing',
    jp: 'ブラッシング',
    subject:
      'A close three-quarter view of one hand holding a small stiff-bristled brush against a bolt-on plastic climbing hold on a plywood wall panel. The hold has a clear rounded top face and a lower gripping edge, and the brush bristles press flat against that edge, with a faint puff of pale chalk dust coming away. Only the hand and the forearm appear: no head, no hair, no torso. The hold and the brush fill the middle of the picture, and every corner of the frame is plain empty background.',
  },
  {
    slug: 'spotting',
    jp: 'スポット',
    subject:
      'Two people in an indoor climbing gym, seen from the side. A climber hangs from holds low on the wall, hips out and feet about to slip. Standing on the mat directly behind and below, a second person holds both arms up and slightly bent, hands open at the height of the climber\'s hips, knees soft, feet apart, body leaning in and ready. They watch the climber\'s hips, not their hands. Only two people appear.',
  },
  {
    slug: 'moving-crash-pad',
    jp: 'クラッシュパッド移動',
    subject:
      'Two people in an indoor climbing gym, seen from the side. One crouches and drags a thick folded crash pad across the floor mat by its strap, both hands on the strap, body leaning back with the effort, sliding it toward the foot of the wall. A second person stands at the wall watching where the pad is going, one hand pointing down at the spot. Only two people appear.',
  },
  {
    slug: 'pointing-hold',
    jp: 'ホールドを指で指す',
    subject:
      'Two people in an indoor climbing gym, seen from the side. A climber is on the wall mid-problem, one arm reaching up and searching, head turned away from the hold they need. Standing on the mat below, a second person points one arm straight up with a single extended index finger aimed at one specific bolt-on hold above the climber. Only two people appear.',
  },
  {
    slug: 'touching-wall-explain',
    jp: '手で壁に触れて説明する',
    subject:
      'Two people standing together at the foot of an indoor climbing wall, seen from three-quarters, close to the plywood panel. One has both hands on the wall at chest and shoulder height, one palm flat on a bolt-on hold and the other tracing the panel surface, head turned to speak. The other stands beside them watching the hands, not the face. Only two people appear.',
  },
  {
    slug: 'body-tracing-move',
    jp: '体でムーブをなぞる',
    subject:
      'Two people standing on the floor mat of an indoor climbing gym a few steps back from the wall, seen from the side. One stands in mid-air with no holds at all: hips twisted, one arm reaching high across the body, one knee lifted and turned in, miming a climbing move in empty space. The other watches the body, arms folded. Only two people appear.',
  },
  {
    slug: 'laser-pointer-coach',
    jp: 'レーザーポインタで教える',
    subject:
      'Two people in an indoor climbing gym, seen from the side. A climber is high on the wall. Standing far back on the mat, a second person holds a small pen-shaped laser pointer up in one hand, and a thin straight beam runs from it across the empty space to a single bright dot on one bolt-on hold above the climber. The beam and the dot are the brightest thing in the picture. Only two people appear.',
  },
  {
    slug: 'laser-pointer-setter',
    jp: 'レーザーポインタで課題を説明する',
    subject:
      'Three people in an indoor climbing gym, seen from the side, all standing on the mat well back from an empty wall with nobody climbing. One holds a small pen-shaped laser pointer up and a thin straight beam crosses to a bright dot on a hold high on the wall, mouth open explaining. The other two stand beside them looking up along the beam, one with arms folded. Only three people appear.',
  },
  {
    slug: 'setters-getting-carried-away',
    jp: 'セッターが盛り上がりすぎる',
    subject:
      'Three people in an empty indoor climbing gym with no customers, seen from three-quarters. Loose bolt-on holds and a power drill lie scattered on the floor mat around them. One hangs low on the wall trying a brand-new problem; the other two stand close below, both talking at once with animated hands, one pointing up at a hold and one gesturing a move. All three are absorbed and pleased. Only three people appear.',
  },
  {
    slug: 'stepladder-on-mat',
    jp: 'マットの上で脚立作業',
    subject:
      'One person in an indoor climbing gym, seen from the side, standing near the top of an open A-frame stepladder that is set up on the thick floor mat in front of a plywood wall panel. They reach up with both arms to a bolt-on hold high on the wall, one hand holding a power drill against it. The ladder legs sink slightly into the soft mat. Only one person appears.',
  },
  {
    slug: 'tightening-hold',
    jp: '緩んだホールドをインパクトドライバで閉め直す',
    subject:
      'A close three-quarter view of two hands at a bolt-on plastic hold on a plywood climbing wall panel: one hand steadies the hold, the other presses a cordless impact driver straight into the bolt at its centre. Only the hands and the forearms appear: no head, no torso. The hold, the bolt and the driver fill the middle of the picture.',
  },
  {
    slug: 'bcaa',
    jp: 'クライミング前後にBCAAを決める',
    subject:
      'One person sitting on a bench at the edge of an indoor climbing gym, seen from the side, climbing shoes off beside them. They hold a plain unlabelled plastic shaker bottle of pale liquid up to their mouth with one hand and tip it back, drinking. The other hand rests on an open gym bag with a small unmarked tub of white powder and a scoop sticking out of it. Only one person appears. Every surface in the picture is blank: no writing, no letters, no numbers and no printed marks anywhere, the corners of the frame included.',
  },
  {
    slug: 'filing-fingertips',
    jp: '指皮をヤスリで削る',
    subject:
      'One person sitting on a bench at the edge of an indoor climbing gym, seen from the side, head bent down over their own hands in their lap. One hand has its fingers curled up with the fingertips turned upward; the other draws a small flat nail file across one fingertip pad. Their climbing shoes and an open gym bag sit on the floor beside the bench. Only one person appears.',
  },
  {
    slug: 'fingerprint-fails',
    jp: '指紋認証が反応しない',
    subject:
      'A close three-quarter view of two hands holding a smartphone at chest height, one thumb pressed flat on a small round fingerprint sensor on the phone. The thumb pad is visibly worn and shiny, its ridges rubbed smooth, with chalk dust still on the knuckles. The phone screen is a blank flat panel with nothing on it. Only the hands and the forearms appear: no head, no torso. No writing or icons anywhere on the screen.',
  },
  {
    slug: 'logging-own-problems',
    jp: '自作課題をファイリング',
    subject:
      'One person sitting cross-legged on the floor mat of an indoor climbing gym with their back near a plywood wall panel, seen from the side. An open notebook rests on one knee; they hold a pen to the page with one hand and look up at the holds on the wall behind them, checking. The open page carries only a rough sketch of a wall with small circles for holds and a few short scribbled indistinct marks, no readable letters. Only one person appears.',
  },
  {
    slug: 'signing-logbook',
    jp: '完登記録に自分のサインを書く',
    subject:
      'Two people at the edge of an indoor climbing gym, seen from three-quarters. A large hardcover logbook lies open on a low wooden counter. One person leans over it and signs it with a pen, hand resting on the page. The other stands beside them watching the page. The open pages carry only a few loose looping pen strokes, the way handwriting looks from too far away to read — no letters, no words, no numbers, no ruled lines and no grid of rows. Only two people appear.',
  },
  {
    slug: 'holding-up-phone',
    jp: 'スマホを構える',
    subject:
      'Three people in an indoor climbing gym, seen from the side. A climber is high on the wall near the last hold. On the mat below, two people have each raised a smartphone in both hands, held up at eye level and aimed at the climber, elbows out, watching through the screen. The phone screens are blank flat panels with nothing on them. Only three people appear.',
  },
  {
    slug: 'showing-video',
    jp: '動画を見せる',
    subject:
      'Two people standing close together on the floor mat of an indoor climbing gym, seen from three-quarters, both looking down at one smartphone. One holds the phone out flat in one hand and points at its blank screen with the other, mouth open explaining. The second person, still in climbing shoes with chalk on their hands, leans in to look at the screen. The screen is a blank flat panel with nothing on it. Only two people appear.',
  },
];

export const OUT_DIR = 'public/common-action';
