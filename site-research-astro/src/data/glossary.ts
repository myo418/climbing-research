export const GLOSSARY_TAGS = [
  'ジャンル',
  'ホールド',
  'ムーブ',
  'スタイル',
  'ギア',
  'トレーニング',
  '怪我',
] as const;

export type GlossaryTag = (typeof GLOSSARY_TAGS)[number];

export type GlossaryTerm = {
  slug: string;
  term: string;
  /** 英語表記。表示と検索の両方で使う */
  english: string;
  reading: string;
  aliases?: string[];
  tags: GlossaryTag[];
  description: string;
  /** 画像パス。`public/glossary/<slug>.jpg` を置いて `/glossary/<slug>.jpg` で参照する */
  image?: string;
  /** 画像の出典・クレジット */
  imageCredit?: string;
};

export const terms: GlossaryTerm[] = [
  {
    slug: 'bouldering',
    term: 'ボルダリング',
    english: 'Bouldering',
    reading: 'ぼるだりんぐ bouldering',
    tags: ['ジャンル'],
    description:
      'ロープを使わず、4〜5m以下の低い壁（ボルダー）を登るクライミングの一形態。着地はクラッシュパッドで受ける。',
  },
  {
    slug: 'lead',
    term: 'リード',
    english: 'Lead climbing',
    reading: 'りーど lead climbing',
    tags: ['ジャンル'],
    description:
      'ロープを引きながら登り、ルート上のプロテクションに順次クリップしていくスタイル。落下距離は最後にクリップした位置に依存する。',
  },
  {
    slug: 'trad-climbing',
    term: 'トラッドクライミング',
    english: 'Traditional climbing (Trad)',
    reading: 'とらっどくらいみんぐ trad traditional climbing',
    aliases: ['トラッド'],
    tags: ['ジャンル'],
    description:
      '岩の割れ目にカムやナッツなどのプロテクションを自分で仕掛けながら登るスタイル。登り終えた後に撤収するため岩に痕跡を残さない。',
  },
  {
    slug: 'sport-climbing',
    term: 'スポートクライミング',
    english: 'Sport climbing',
    reading: 'すぽーとくらいみんぐ sport climbing',
    aliases: ['スポート'],
    tags: ['ジャンル'],
    description:
      '岩壁に事前設置されたボルトにクリップしながら登るスタイル。オリンピックの種目名としても用いられる。',
  },
  {
    slug: 'free-climbing',
    term: 'フリークライミング',
    english: 'Free climbing',
    reading: 'ふりーくらいみんぐ free climbing',
    tags: ['ジャンル'],
    description:
      '手足と自然の岩のみで登り、ロープや器具は落下時の安全確保にだけ使うスタイル。人工物で登る「エイドクライミング」の対義語。',
  },

  {
    slug: 'crimp',
    term: 'クリンプ',
    english: 'Crimp',
    reading: 'くりんぷ crimp kachi',
    aliases: ['カチ'],
    tags: ['ホールド'],
    description:
      '指先だけが掛かる浅いホールド、あるいは第一関節を立てて親指を添えて保持する持ち方。指への負荷が非常に大きく、A2プーリー損傷の主要な原因。',
  },
  {
    slug: 'sloper',
    term: 'スローパー',
    english: 'Sloper',
    reading: 'すろーぱー sloper',
    tags: ['ホールド'],
    description:
      '傾斜のついた丸みのあるホールド。指を掛けるエッジが無いため、手のひら全体の摩擦と体勢で保持する。',
  },
  {
    slug: 'pinch',
    term: 'ピンチ',
    english: 'Pinch',
    reading: 'ぴんち pinch',
    tags: ['ホールド'],
    description: '親指と他の指で挟んで保持するタイプのホールド。親指側の筋力と安定性が問われる。',
  },
  {
    slug: 'pocket',
    term: 'ポケット',
    english: 'Pocket',
    reading: 'ぽけっと pocket',
    tags: ['ホールド'],
    description:
      '穴状のホールド。指が入る本数（1本指・2本指・3本指）で負荷と持ちやすさが大きく変わる。1本指ポケットはプーリー損傷の典型的な発生場面。',
  },
  {
    slug: 'jug',
    term: 'ジャグ',
    english: 'Jug',
    reading: 'じゃぐ jug gaba',
    aliases: ['ガバ'],
    tags: ['ホールド'],
    description: '手全体でしっかり握れる大きなホールド。レスト（休憩）できるほど持ちやすい。日本語では「ガバ」。',
  },

  {
    slug: 'dyno',
    term: 'ダイノ',
    english: 'Dyno (Dynamic move)',
    reading: 'だいの dyno dynamic',
    tags: ['ムーブ'],
    description:
      '両足が壁から離れる、飛びつくようなダイナミックムーブ。着地の衝撃や方向制御のミスで怪我につながることがある。',
  },
  {
    slug: 'heel-hook',
    term: 'ヒールフック',
    english: 'Heel hook',
    reading: 'ひーるふっく heel hook',
    tags: ['ムーブ'],
    description:
      'かかとをホールドに掛けて体を引き寄せるムーブ。ハムストリングスや膝関節への負荷が大きい。',
  },
  {
    slug: 'toe-hook',
    term: 'トゥフック',
    english: 'Toe hook',
    reading: 'とうふっく toe hook',
    tags: ['ムーブ'],
    description:
      'つま先側でホールドを引っ掛けて体を壁から離さないようにするムーブ。ルーフや強傾斜で多用される。',
  },
  {
    slug: 'mantle',
    term: 'マントル',
    english: 'Mantle (Mantling)',
    reading: 'まんとる mantle mantling',
    tags: ['ムーブ'],
    description: 'ホールドの上に乗り上がる動き。腕で体を押し上げる動作が中心となる。',
  },
  {
    slug: 'lunge',
    term: 'ランジ',
    english: 'Lunge',
    reading: 'らんじ lunge',
    tags: ['ムーブ'],
    description:
      '片足を残しつつ、遠くのホールドに勢いをつけて手を飛ばすムーブ。両足が離れるダイノより制動しやすい。',
  },

  {
    slug: 'onsight',
    term: 'オンサイト',
    english: 'Onsight',
    reading: 'おんさいと onsight',
    tags: ['スタイル'],
    description: '事前情報なしで初見・一撃で登り切ること。最も純度の高い登攀評価とされる。',
  },
  {
    slug: 'flash',
    term: 'フラッシュ',
    english: 'Flash',
    reading: 'ふらっしゅ flash',
    tags: ['スタイル'],
    description: '他者の登攀やベータ（攻略情報）を事前に得た上で、一撃で登り切ること。',
  },
  {
    slug: 'redpoint',
    term: 'レッドポイント',
    english: 'Redpoint',
    reading: 'れっどぽいんと redpoint',
    tags: ['スタイル'],
    description:
      'ルートをトライで練習した上で、最終的に落ちずに一本通しで完登すること。ハイグレードの完登はほぼこの形式。',
  },
  {
    slug: 'project',
    term: 'プロジェクト',
    english: 'Project',
    reading: 'ぷろじぇくと project',
    tags: ['スタイル'],
    description:
      '現在取り組んでいる未完登のルート／課題。完登までに数週間〜数年を要することも珍しくない。',
  },

  {
    slug: 'belay',
    term: 'ビレイ',
    english: 'Belay',
    reading: 'びれい belay',
    tags: ['ギア'],
    description: 'ロープを確保する行為、または確保する役割の人。リードではクライマーの命を預ける相手になる。',
  },
  {
    slug: 'harness',
    term: 'ハーネス',
    english: 'Harness',
    reading: 'はーねす harness',
    tags: ['ギア'],
    description: '腰に装着する安全帯。ロープはビレイループに結び、確保器具もここに接続する。',
  },
  {
    slug: 'quickdraw',
    term: 'クイックドロー',
    english: 'Quickdraw',
    reading: 'くいっくどろー quickdraw nunchaku',
    aliases: ['ヌンチャク'],
    tags: ['ギア'],
    description: 'ボルトとロープをつなぐ、二つのカラビナをスリングで連結したギア。日本語通称「ヌンチャク」。',
  },
  {
    slug: 'cam',
    term: 'カム',
    english: 'Cam (SLCD / Spring-loaded camming device)',
    reading: 'かむ cam camming device',
    tags: ['ギア'],
    description:
      'トラッドで使うプロテクション。岩のクラックに挿入しバネで開く「カムローブ」によって固定される。',
    image: '/glossary/cam.jpg',
    imageCredit: 'User:Aamb, CC BY-SA 3.0 / Wikimedia Commons',
  },
  {
    slug: 'chalk',
    term: 'チョーク',
    english: 'Chalk',
    reading: 'ちょーく chalk magnesium',
    tags: ['ギア'],
    description: '手の汗を吸い摩擦を上げるための炭酸マグネシウム。粉末・液体・ボール状の形状がある。',
  },
  {
    slug: 'climbing-shoes',
    term: 'クライミングシューズ',
    english: 'Climbing shoes',
    reading: 'くらいみんぐしゅーず climbing shoes',
    tags: ['ギア'],
    description:
      '硬いソールと鋭いトゥを持つ専用シューズ。きつめに履き、爪先の一点に荷重して乗り込む設計。長時間履くと足指の変形や爪の損傷を招く。',
  },

  {
    slug: 'hangboard',
    term: 'ハングボード',
    english: 'Hangboard (Fingerboard)',
    reading: 'はんぐぼーど hangboard fingerboard',
    aliases: ['フィンガーボード'],
    tags: ['トレーニング'],
    description: '指のぶら下がりトレーニング用器具。エッジやポケットが刻まれ、指の筋力と腱の強さを鍛える。',
  },
  {
    slug: 'campus-board',
    term: 'キャンパスボード',
    english: 'Campus board',
    reading: 'きゃんぱすぼーど campus board',
    tags: ['トレーニング'],
    description:
      '足を使わず腕だけで登るトレーニング器具。爆発的なパワーを養うが、指と肘への負荷が極めて大きく怪我のリスクが高い。',
  },

  {
    slug: 'a2-pulley',
    term: 'A2プーリー損傷',
    english: 'A2 pulley injury',
    reading: 'A2ぷーりーそんしょう a2 pulley injury',
    aliases: ['プーリー損傷', 'プーリー断裂'],
    tags: ['怪我'],
    description:
      '指の屈筋腱を骨に密着させる輪状の靭帯（プーリー）が部分断裂または完全断裂する障害。カチ持ちでの急な荷重や、足抜けによる過負荷が主因。クライマー特有の怪我として最も代表的。',
  },
  {
    slug: 'tennis-elbow',
    term: 'テニス肘',
    english: 'Tennis elbow (Lateral epicondylitis)',
    reading: 'てにすひじ tennis elbow lateral epicondylitis',
    aliases: ['外側上顆炎'],
    tags: ['怪我'],
    description:
      '肘の外側の腱付着部に生じる慢性的な炎症。クライマーではオーバーユースで頻発し、引きつけ系のムーブで悪化しやすい。',
  },
  {
    slug: 'shoulder-impingement',
    term: '肩インピンジメント',
    english: 'Shoulder impingement',
    reading: 'かたいんぴんじめんと shoulder impingement',
    tags: ['怪我'],
    description:
      '肩関節内で腱が骨や靭帯に挟まれ炎症を起こす症状。ガストンやマンテルなど肩の限界角度を使うムーブの反復で発生しやすい。',
  },
];
