// クライマーMBTI — 5軸32タイプの分類体系
//
// 1〜4文字目（孤群・動静・岩壁・住通）で16タイプが決まり、
// 5文字目（感 / 理）が各タイプの2つのバージョンになる。
//
// TYPES の並びは company * 8 + motion * 4 + ground * 2 + commitment。
// 画像を足すときは各タイプの slug を使って public/climber-mbti/<style>/<slug>.png に置く。

export interface Pole {
  kanji: string;
  word: string;
  letter: string;
  label: string;
  desc: string;
}

export interface Axis {
  no: number;
  jp: string;
  en: string;
  poles: [Pole, Pole];
  note: string;
}

export const axes: Axis[] = [
  {
    no: 1,
    jp: '他者との距離',
    en: 'Company',
    poles: [
      {
        kanji: '孤',
        word: 'Inward',
        letter: 'I',
        label: 'ソロ',
        desc: '黙って登る。イヤホン。自分のペース。壁の前に一人で立つ時間が長い。',
      },
      {
        kanji: '群',
        word: 'Ensemble',
        letter: 'E',
        label: 'セッション',
        desc: '人といることが登ることの一部。ガンバの声、グータッチ、教えたい。',
      },
    ],
    note: 'MBTI の I / E と同じ位置に置いた。パロディを前面に出すなら Introverted / Extraverted をそのまま借りる手もある。',
  },
  {
    no: 2,
    jp: 'ムーブの好み',
    en: 'Motion',
    poles: [
      {
        kanji: '動',
        word: 'Dynamic',
        letter: 'D',
        label: 'ダイナミック',
        desc: '勢いを使って次を取る。ランジ、コーディネーション、飛ぶ動きが気持ちいい。',
      },
      {
        kanji: '静',
        word: 'Static',
        letter: 'S',
        label: 'スタティック',
        desc: '止まったまま体を寄せて取る。保持して耐える。動きが静かなほど良い。',
      },
    ],
    note: '翻訳ではなくクライミングの英語そのもの（dynamic move / static move、dyno の語源）。設問に「危ない・怖い・痛い」を入れない。入れるとリスクの話と混ざる。この軸が決めるのは怪我の量ではなく種類で、動は急性（足首・膝・肩、語りが「あの日」になる）、静は慢性（指・腱・肘、語りが「いつからか」になる）。',
  },
  {
    no: 3,
    jp: '場所への志向',
    en: 'Ground',
    poles: [
      {
        kanji: '岩',
        word: 'Rock',
        letter: 'R',
        label: '外岩',
        desc: '誰も知らない岩の写真で心拍が上がる。自然の造形に登る線を見つけたい。',
      },
      {
        kanji: '壁',
        word: 'Gym',
        letter: 'G',
        label: 'ジム',
        desc: '今週のセット変更の告知で心拍が上がる。人が作った課題を解きたい。',
      },
    ],
    note: '実績ではなく志向で聞く。「何回行ったか」で聞くと、車と仲間と住んでいる場所を測ってしまう。岩に行ったことがない人も正直に答えられる設問にする。',
  },
  {
    no: 4,
    jp: '熱量',
    en: 'Commitment',
    poles: [
      {
        kanji: '住',
        word: 'Hooked',
        letter: 'H',
        label: '住んでいる',
        desc: '週4以上。登らない日も何かしている（ハングボード、体重、睡眠、動画）。予定はクライミングから先に埋まる。',
      },
      {
        kanji: '通',
        word: 'Visiting',
        letter: 'V',
        label: '通っている',
        desc: '週1〜2。行って登って帰る。生活は生活、クライミングはクライミング。',
      },
    ],
    note: `頻度・トレーニングの有無・食事管理・生活の優先順位を、この1本に束ねている。判定は Yes の数で見る。週3以上か／登る日以外にトレーニングするか／食事や体重を管理しているか／会員カードが2枚以上か／クライミングのために予定を断ったことがあるか。

頻度だけで決めない。週2でも、食事と体重を管理し、カードが何枚もあり、生活の優先順位でクライミングが上にある人は「住」に落ちる（菅野あいとがその例で、週2だが Yes が3つ）。この軸が測っているのは通う回数ではなく、登らない日も生活がクライミングの側を向いているかどうか。`,
  },
  {
    no: 5,
    jp: '頭の使い方',
    en: 'Mind',
    poles: [
      {
        kanji: '感',
        word: 'Feel',
        letter: 'F',
        label: '感覚',
        desc: '体で覚える。言葉にしない。教えるときは体でムーブをなぞる。「なぜ止まったか分からないまま完登した」ことがある。',
      },
      {
        kanji: '理',
        word: 'Logic',
        letter: 'L',
        label: '理論',
        desc: '重心・支点・力の向きで考える。教えるときは壁に触れて説明する、レーザーポインタで一手ずつ指す。',
      },
    ],
    note: 'うまい／へたの軸ではない。感覚派の強い人も、理論派の弱い人も山ほどいる。むしろ感覚派は天才として尊敬される。観測点は教え方の所作で、体でなぞるか、壁に触れて言葉で説明するか。',
  },
];

export interface Group {
  ground: 0 | 1;
  commitment: 0 | 1;
  jp: string;
  en: string;
  tape: string;
  key: string;
}

/** 場所 × 熱量 の4グループ。色はジムのテープ色から取っていて、グレードの難易度とは関係がない */
export const groups: Group[] = [
  { ground: 0, commitment: 0, jp: '岩住', en: 'ROCK DWELLER', tape: '#b23b2e', key: '生活が岩のほうを向いている' },
  { ground: 0, commitment: 1, jp: '岩通', en: 'ROCK VISITOR', tape: '#b08615', key: '行ける日に岩へ行く' },
  { ground: 1, commitment: 0, jp: '壁住', en: 'GYM DWELLER', tape: '#2f5d86', key: 'ジムが生活の一部になっている' },
  { ground: 1, commitment: 1, jp: '壁通', en: 'GYM VISITOR', tape: '#4c7a51', key: 'ジムに通っている' },
];

export interface ClimberType {
  slug: string;
  stem: string;
  letters: string;
  jp: string;
  en: string;
  body: string;
  feel: string;
  logic: string;
}

/** index = company * 8 + motion * 4 + ground * 2 + commitment */
export const types: ClimberType[] = [
  {
    slug: 'lone-feral',
    stem: '孤動岩住',
    letters: 'IDRH',
    jp: '単独野生種',
    en: 'THE LONE FERAL',
    body: '一人で岩場に向かい、一人でマットを敷き、一人で飛ぶ。着地は半分運任せで、落ちた回数を本人も覚えていない。足首は何度か終わっているが、それを大きな出来事としては語らない。',
    feel: '「なんか行けそうだったから行った」以上の説明が出てこない。',
    logic: '落下の軌道とマットの位置を計算してから飛ぶ。それでも一人なのは変わらない。',
  },
  {
    slug: 'sunday-feral',
    stem: '孤動岩通',
    letters: 'IDRV',
    jp: '日曜の野生児',
    en: 'THE SUNDAY FERAL',
    body: '月に一度か二度、一人で岩へ行き、思い切り飛んで帰る。頻度が低いぶん一回の熱量が高く、翌日から三日ほど使い物にならない。それでも予定が合えばまた行く。',
    feel: '準備運動もせずに本気トライへ行く。',
    logic: '行く前の一週間だけ念入りに体を作る。それでも月イチ。',
  },
  {
    slug: 'dyno-addict',
    stem: '孤動壁住',
    letters: 'IDGH',
    jp: 'ランジ中毒',
    en: 'THE DYNO ADDICT',
    body: 'コーディネーション課題しか触らない。毎日来て、飛んで、着地して、また飛ぶ。指皮より先に肩が終わる。',
    feel: '動画も見ずに、体が覚えた通りに飛ぶ。',
    logic: '踏み切りの角度を毎回変えて試し、成功率を把握している。',
  },
  {
    slug: 'monthly-burst',
    stem: '孤動壁通',
    letters: 'IDGV',
    jp: '月イチの爆発',
    en: 'THE MONTHLY BURST',
    body: 'たまにしか来ないのに、来た日は全力で飛ぶ。三日間まともに歩けなくなり、そのことをやや誇らしく思っている。次に来るのはまた一ヶ月後。',
    feel: 'アップもせずに本気の課題へ行く。',
    logic: '来る日に備えて前日から食事を変えている。',
  },
  {
    slug: 'finger-gambler',
    stem: '孤静岩住',
    letters: 'ISRH',
    jp: '指を賭ける人',
    en: 'THE FINGER GAMBLER',
    body: '一本のカチのために、同じ岩へ何年も通う。飛ばないし派手な動きもしないのに、指だけが確実に削れていく。完登の日を「いつか来るもの」として静かに待っている。',
    feel: '保持の感覚が戻る日と戻らない日がある、としか言えない。',
    logic: '指の負荷を計算し、休養日を設計し、それでも通うのをやめない。',
  },
  {
    slug: 'rock-caller',
    stem: '孤静岩通',
    letters: 'ISRV',
    jp: '岩を訪ねる人',
    en: 'THE ROCK CALLER',
    body: '登るより、岩を見に行く。コケを払い、触って、条件が合わなければ登らずに帰る日がある。完登の数が増えなくても本人は満足している。',
    feel: '「今日はそういう日じゃなかった」で片づける。',
    logic: '岩ごとの記録をつけていて、次に来るべき季節を決めて帰る。',
  },
  {
    slug: 'grade-machine',
    stem: '孤静壁住',
    letters: 'ISGH',
    jp: '昇段マシーン',
    en: 'THE GRADE MACHINE',
    body: '無言で段位を刈り続ける。同じ一手に三時間かけることを苦だと思っていない。指皮がなくなるまで帰らない。',
    feel: 'なぜ止まったか説明できないまま完登している。',
    logic: 'ハングボードの秒数まで管理していて、追い込みすぎて壊れる。',
  },
  {
    slug: 'steady-craftsman',
    stem: '孤静壁通',
    letters: 'ISGV',
    jp: '省エネ職人',
    en: 'THE STEADY CRAFTSMAN',
    body: '毎回同じグレードを淡々と十本登って帰る。強くはならないが、十年続いていて一度も壊していない。滞在時間まで毎回ほとんど同じ。',
    feel: '「今日はこんなもん」で切り上げる。',
    logic: '自分の限界の手前を正確に把握していて、意図的にそこで止めている。',
  },
  {
    slug: 'charge-leader',
    stem: '群動岩住',
    letters: 'EDRH',
    jp: '岩場の突撃隊長',
    en: 'THE CHARGE LEADER',
    body: 'パッドを並べ、全員を呼び、最初に飛ぶ。自分の怪我が一番おいしい話のネタで、武勇伝として何度も語られる。場の温度を上げるのが自分の役割だと本人も分かっている。',
    feel: '「行ける」と言った瞬間にはもう飛んでいる。',
    logic: '全員のマット配置を指示してから飛ぶ。声の大きさは変わらない。',
  },
  {
    slug: 'road-trip',
    stem: '群動岩通',
    letters: 'EDRV',
    jp: '遠征隊',
    en: 'THE ROAD TRIP',
    body: '年に数回、仲間と車に乗り込んで遠くの岩場へ行く。移動と食事と温泉が行程の半分を占めていて、登っている時間より笑っている時間が長い。それでも全員が真剣に飛ぶ瞬間がある。',
    feel: '現地に着いてから何を登るか決める。',
    logic: '出発前にトポを回覧し、課題リストを共有している。',
  },
  {
    slug: 'set-day-spark',
    stem: '群動壁住',
    letters: 'EDGH',
    jp: '新セットの火付け役',
    en: 'THE SET-DAY SPARK',
    body: 'セット変更の日に現れて暴れる。全部の新課題をその日のうちに触り、面白い課題を見つけると全員に知らせて回る。肩と指に湿布が貼ってある。',
    feel: '「これヤバい、来て」しか言わない。',
    logic: '新課題の傾向をセッターごとに把握していて、解説しながら回る。',
  },
  {
    slug: 'party-climber',
    stem: '群動壁通',
    letters: 'EDGV',
    jp: '宴会クライマー',
    en: 'THE PARTY CLIMBER',
    body: '登りに来ているのか話しに来ているのか分からない。ガンバの声が一番大きく、他人の完登を自分のことのように喜ぶ。帰りに必ず飲みに行く。',
    feel: '応援の声しか出していない。',
    logic: '人のムーブは的確に解説するのに、自分では試さない。',
  },
  {
    slug: 'project-captain',
    stem: '群静岩住',
    letters: 'ESRH',
    jp: 'プロジェクト班長',
    en: 'THE PROJECT CAPTAIN',
    body: '何年もかかる一本に、仲間ごと巻き込んで通う。日程を組み、天気を見て、コンディションの良い日を全員に知らせる。指はいつもテープだらけ。',
    feel: '「今日は岩の感じがいい」の一言で全員を動かす。',
    logic: '気温と湿度の記録をつけていて、それを根拠に日を決める。',
  },
  {
    slug: 'weekend-pilgrim',
    stem: '群静岩通',
    letters: 'ESRV',
    jp: '休日の巡礼者',
    en: 'THE WEEKEND PILGRIM',
    body: '数人で岩場に出かけ、順番に静かに打つ。声を張らず、待ち時間に座って話している時間のほうが長い。年に一本落ちればいい、くらいの速度で続いている。',
    feel: '「いい岩だね」以上の講評をしない。',
    logic: '誰かのムーブを見て、力の向きを言葉に整理して渡す。',
  },
  {
    slug: 'gym-fixture',
    stem: '群静壁住',
    letters: 'ESGH',
    jp: 'ジムの主',
    en: 'THE GYM FIXTURE',
    body: '受付の隣が定位置で、全員と顔見知り。開店から閉店までいるが、最近はそれほど登っていない。新しい人が来ると一番に話しかける。',
    feel: 'アドバイスは「もっとこう、腰から」で終わる。',
    logic: '初心者に向かって、重心と支点の話を丁寧に始めてしまう。',
  },
  {
    slug: 'friday-regular',
    stem: '群静壁通',
    letters: 'ESGV',
    jp: '金曜の常連',
    en: 'THE FRIDAY REGULAR',
    body: '週に一度、決まった曜日に現れる。十年続いていて、そのジムの人間関係をほぼ把握している。グレードは変わらないが、来なくなる気配もない。',
    feel: '「変わらないねえ」と言い合うのが目的になっている。',
    logic: '自分の停滞の理由を説明できるが、直す気はない。',
  },
];

export interface DanStep {
  jp: string;
  en: string;
  pace: string;
  state: string;
}

/** 軸4を細かくした表示。頻度だけでは決めない */
export const danScale: DanStep[] = [
  { jp: '10級', en: '10-kyu', pace: '月1以下', state: '誘われたら行く。シューズは借りる' },
  { jp: '5級', en: '5-kyu', pace: '週1', state: 'マイシューズを買った。習慣にはなった' },
  { jp: '1級', en: '1-kyu', pace: '週2〜3', state: 'クライミングのために予定を空けるようになる' },
  { jp: '初段', en: '1-dan', pace: '週3〜4 / ジム複数', state: '生活が寄り始める。会員カードが増える' },
  { jp: '二段', en: '2-dan', pace: '週4〜5 / 遠征', state: '仕事や学校よりクライミングを優先した日がある' },
  { jp: '三段', en: '3-dan', pace: '週5以上 / 転居・転職', state: '人間関係がクライミング側に置き換わっている' },
  { jp: '四段', en: '4-dan', pace: '職業', state: 'セッター、スタッフ、選手。生活とクライミングの区別がない' },
];

export const honors: { name: string; desc: string }[] = [
  { name: '復帰組', desc: '大きな怪我から戻ってきた' },
  { name: 'テーピング常連', desc: '指に何か巻いている' },
  { name: 'まだ無傷', desc: '一度も壊していない' },
  { name: 'ギア沼', desc: 'シューズ10足' },
  { name: 'SNS勢', desc: '三脚を立てる' },
  { name: 'リード民', desc: '高さが平気' },
  { name: '外岩未経験', desc: '岩に触れたことがない' },
  { name: '布教者', desc: '初心者を連れてくる' },
  { name: 'BCAA勢', desc: '登る前後に決める' },
];

export type Verdict = 'spare' | 'absorbed' | 'dropped';

export const VERDICT_LABELS: Record<Verdict, string> = {
  spare: '予備',
  absorbed: '吸収',
  dropped: '廃案',
};

export interface Candidate {
  pair: string;
  what: string;
  reason: string;
  verdict: Verdict;
}

/** 検討して外した軸と、その理由 */
export const candidates: Candidate[] = [
  { pair: '攻 / 護', what: 'リスクを取る / 取らない', reason: '5本目に据えていたが不採用。怪我は称号が引き受け、怪我の種類は軸2が決める', verdict: 'absorbed' },
  { pair: '数 / 美', what: '完登後の第一声', reason: '「なぜ登るか」を取れる良い軸。感 / 理 に枠を譲った。動機は診断で当てるよりインタビューで聞くもの', verdict: 'spare' },
  { pair: '挑 / 完', what: '落ちに行く / 登りに行く', reason: '行動で観測でき、両極が対等。枠が5つなので降格しただけ', verdict: 'spare' },
  { pair: '読 / 触', what: 'オブザベ / とりあえず触る', reason: '感 / 理 と同じ家族（認知スタイル）。射程は感 / 理 のほうが広く、壁の前の数分だけでなく教え方や動画の見方まで届く', verdict: 'dropped' },
  { pair: '好 / 克', what: '得意を伸ばす / 苦手を潰す', reason: '笑いは取れるが軸4と緩く相関する', verdict: 'dropped' },
  { pair: '整 / 素', what: '登る以外の時間もクライマーか', reason: 'トレーニング・食事・ケアを測る。軸4に丸ごと取り込んだ', verdict: 'absorbed' },
  { pair: '頻度', what: '週に何回登るか', reason: '単独では連続量。二分すると週2.5の人が量子化される。軸4の判定材料と段位へ', verdict: 'absorbed' },
  { pair: '熱 / 凪', what: '今の熱量', reason: '頻度と同じものを測っていた', verdict: 'absorbed' },
  { pair: 'ストイック / 楽しむ', what: '打ち込み方', reason: '対立が非対称。ストイックな人も楽しんでいるので片方が消去法の受け皿になる。どの趣味にも貼れて固有性がない', verdict: 'dropped' },
  { pair: '高グレード / 楽しむ', what: '目指すか、楽しむか', reason: '同じ非対称。「高グレードを目指す」の反対語は「楽しむ」ではない', verdict: 'dropped' },
  { pair: '縦 / 横', what: 'グレードを上げる / 範囲を広げる', reason: '優劣がなく図にもしやすいが、「横」の人は外岩に流れるので軸3と相関する', verdict: 'dropped' },
  { pair: '独 / 師', what: '独学 / 誰かに教わる', reason: '孤の人は独学に寄るので軸1と相関。空セルが出る', verdict: 'dropped' },
  { pair: '律 / 流', what: '予定に先に入れる / 空いた日に行く', reason: '頻度とほぼ同じものを測る。かつ地味で絵にならない', verdict: 'dropped' },
  { pair: '機嫌', what: '登れない日、不機嫌になるか', reason: '「ストイック / 楽しむ」を行動に翻訳した版。使わなかったが筋は通っている', verdict: 'spare' },
  { pair: '高さ', what: '高さが怖い / 平気', reason: '軸3とリード経験に強く相関。称号「リード民」に落とした', verdict: 'absorbed' },
];

/** 新しい候補が出たときに弾くための条件 */
export const criteria: { head: string; body: string }[] = [
  { head: '量ではなく方向か', body: '量を軸にすると必ず序列が出る。量は段位か実数で出す' },
  { head: '両極が対等か', body: '片方が消去法の受け皿になっていないか' },
  { head: '他の軸と相関しないか', body: '相関すると32のうち何セルかが空く' },
  { head: '行動で聞けるか', body: '「ストイックですか」は歪む。「今日何本完登した？」は歪まない' },
  { head: '志向か、環境か', body: '車と仲間と住んでいる場所を測っていないか' },
  { head: '性質か、状態か', body: '状態（怪我の前後で反転するもの）は軸ではなく称号か段位へ' },
];

export function typeIndex(company: number, motion: number, ground: number, commitment: number): number {
  return company * 8 + motion * 4 + ground * 2 + commitment;
}

// ---- 診断 ----

export interface Question {
  no: number;
  /** どの軸を測るか（axes の添字） */
  axis: number;
  /** 「当てはまる」がどちらの極に効くか（poles の添字） */
  dir: 0 | 1;
  text: string;
}

/**
 * 5軸 × 6問。各軸とも向きを3問ずつ逆にしてある（何でも「はい」と答える傾向を相殺するため）。
 * 全問、気持ちではなく行動を聞く。
 *
 * 軸2の設問に「危ない・怖い・痛い」を入れない（リスクの話と混ざる）。
 * 軸3の設問で「何回行ったか」を聞かない（車・仲間・住んでいる場所を測ってしまう）。
 */
export const questions: Question[] = [
  { no: 1, axis: 0, dir: 0, text: 'ジムには一人で行くことが多い' },
  { no: 2, axis: 0, dir: 1, text: '隣の人が落とすと、自分から声をかけたり拳を出したりする' },
  { no: 3, axis: 0, dir: 0, text: '登っている間、イヤホンをしていることがある' },
  { no: 4, axis: 0, dir: 1, text: 'ジムで知り合った人と、ジムの外でも会うことがある' },
  { no: 5, axis: 0, dir: 0, text: '誰かと行っても、途中から別々に登っていることが多い' },
  { no: 6, axis: 0, dir: 1, text: '初めて来た人がいると、自分から話しかけるほうだ' },

  { no: 7, axis: 1, dir: 0, text: '遠いホールドは、耐えるより飛んで取りにいく' },
  { no: 8, axis: 1, dir: 1, text: '足の位置を決め直してから、ゆっくり手を出す' },
  { no: 9, axis: 1, dir: 0, text: 'コーディネーション課題を見つけると、まずそれを触る' },
  { no: 10, axis: 1, dir: 1, text: 'ロックオフしたまま、片手で次のホールドを取りにいく' },
  { no: 11, axis: 1, dir: 0, text: '自分の登りは、人から「思い切りがいい」と言われるほうだ' },
  { no: 12, axis: 1, dir: 1, text: '同じ課題なら、飛ばずに済む方法を探す' },

  { no: 13, axis: 2, dir: 0, text: '知らない岩場の写真を見ると、そこに登れる線を探してしまう' },
  { no: 14, axis: 2, dir: 1, text: 'セット替えの告知が出ると、予定を調整してでも行きたくなる' },
  { no: 15, axis: 2, dir: 0, text: '岩の写真や動画を見ている時間が、ジムの課題動画より長い' },
  { no: 16, axis: 2, dir: 1, text: 'ホールドの種類やセッターの名前を覚えている' },
  { no: 17, axis: 2, dir: 0, text: '行ったことがなくても、名前を知っている岩や課題がある' },
  { no: 18, axis: 2, dir: 1, text: '登る場所を決めるとき、まず「どのジムに行くか」を考える' },

  { no: 19, axis: 3, dir: 0, text: '週に3回以上は登っている' },
  { no: 20, axis: 3, dir: 1, text: '登るのは、ほかの予定が入っていない日だけだ' },
  { no: 21, axis: 3, dir: 0, text: '登らない日にも、指や体のトレーニングをしている' },
  { no: 22, axis: 3, dir: 1, text: '家にクライミング用のトレーニング器具は置いていない' },
  { no: 23, axis: 3, dir: 1, text: 'ジムを出たら、次に行く日までクライミングのことは考えない' },
  { no: 24, axis: 3, dir: 0, text: 'クライミングのために、仕事や学校や人との約束を断ったことがある' },

  { no: 25, axis: 4, dir: 0, text: '落とした課題でも、どうやって登ったか言葉で説明できないことがある' },
  { no: 26, axis: 4, dir: 1, text: '人に教えるとき、壁やホールドを触りながら言葉で説明する' },
  { no: 27, axis: 4, dir: 0, text: '人に教えるとき、自分の体で動きをやって見せる' },
  { no: 28, axis: 4, dir: 1, text: 'うまくいかないとき、原因を言葉にしてから次のトライに入る' },
  { no: 29, axis: 4, dir: 0, text: '「なんとなくこう行けそう」でトライを始めることが多い' },
  { no: 30, axis: 4, dir: 1, text: '自分の登りの動画を、どこが悪かったか確かめるために見返す' },
];

/**
 * 答えの選択肢。中央（どちらでもない）を置かない。
 * 置くとそこに逃げる人が多く、合計が 0 になりやすい。
 */
export const choices: { label: string; value: number }[] = [
  { label: 'よく当てはまる', value: 2 },
  { label: 'やや当てはまる', value: 1 },
  { label: 'あまり当てはまらない', value: -1 },
  { label: '全く当てはまらない', value: -2 },
];

/** 合計が 0 で並んだときに向きを決める問い（軸の添字 → 設問番号） */
export const tiebreakers: number[] = [1, 7, 13, 24, 25];
