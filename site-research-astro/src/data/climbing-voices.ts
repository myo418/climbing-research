export const MOMENTS = ['気合い', 'ミス・落下', '完登'] as const;

export type Moment = (typeof MOMENTS)[number];

export const MOMENT_LABELS: Record<Moment, string> = {
  '気合い': '気合い',
  'ミス・落下': 'ミス・落下',
  '完登': '完登',
};

export type ClimbingVoice = {
  phrase: string;
  moment: Moment;
  description: string;
};

export const voices: ClimbingVoice[] = [
  // 気合い
  {
    phrase: 'よし、いけ、あと一手',
    moment: '気合い',
    description: '核心部に差し掛かったとき、自分を奮い立たせるように出る。声に出すことで集中が高まる感覚があると言うクライマーは多い。',
  },
  {
    phrase: 'ぬっ、はっ、っし',
    moment: '気合い',
    description: '言葉というより音に近い。強いムーブで息を吐くタイミングで自然に出る。本人は意識していないことも多い。',
  },
  {
    phrase: 'そこ',
    moment: '気合い',
    description: '次に取るホールドや踏む場所を自分に言い聞かせる一言。「そこ、そこ」と繰り返しながら体を動かすことで動作を確認する。',
  },
  // ミス・落下
  {
    phrase: 'あっ、うわっ',
    moment: 'ミス・落下',
    description: '足が切れた瞬間、ホールドから手が滑った瞬間に出る。声が出る前に落ちていることも多い。',
  },
  {
    phrase: 'くそ、だめだ',
    moment: 'ミス・落下',
    description: '落ちた直後に出る。本人は周囲に聞こえているとは思っていないことも多い。',
  },
  {
    phrase: '惜しい、あーもう',
    moment: 'ミス・落下',
    description: '核心を越えた直後や、完登まであと一手のところで落ちたときに出る。悔しさと手応えが混ざった声。',
  },
  // 完登
  {
    phrase: 'よし！',
    moment: '完登',
    description: '完登した瞬間に出る。声の大きさはその課題への執着の強さに比例する傾向がある。',
  },
  {
    phrase: 'やった、できた',
    moment: '完登',
    description: '「よし！」より少し遅れて出る。達成感が言葉になる前に体の力が抜けていることが多い。',
  },
];
