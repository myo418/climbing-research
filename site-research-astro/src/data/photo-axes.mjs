// 写真メタ情報の軸の定義。ここが唯一の定義元。
// admin（scripts/admin.mjs）とサイト（src/pages/design/photos/）の両方がこれを読む。
// 軸を増やす／選択肢を足すときはこのファイルだけを編集する。

/** 選択式の軸。key は photos.json のキーになる */
export const AXES = [
  {
    key: 'place',
    label: '場所',
    hint: '室内か屋外か',
    options: [
      { value: 'indoor', label: '室内' },
      { value: 'outdoor', label: '屋外' },
    ],
  },
  {
    key: 'elevation',
    label: '高さ',
    hint: '地面のすぐ上か、落ちたら大怪我になる高さか',
    options: [
      { value: 'low', label: '地面近く' },
      { value: 'high', label: '高所' },
    ],
  },
  {
    key: 'framing',
    label: '画角',
    hint: '被写体をどこまで入れているか',
    options: [
      { value: 'wide', label: '引き（岩・壁ごと）' },
      { value: 'full', label: '全身' },
      { value: 'upper', label: '半身' },
      { value: 'closeup', label: 'クローズアップ' },
    ],
  },
  {
    key: 'angle',
    label: 'アングル',
    hint: 'カメラの高さ。登り手を見上げているか見下ろしているか',
    options: [
      { value: 'up', label: '煽り（下から）' },
      { value: 'level', label: '水平' },
      { value: 'down', label: '俯瞰（上から）' },
    ],
  },
  {
    key: 'position',
    label: '立ち位置',
    hint: '登り手に対してどこから撮っているか',
    options: [
      { value: 'front', label: '正面から' },
      { value: 'side', label: 'サイドから' },
      { value: 'back', label: '真後ろから' },
    ],
  },
  {
    key: 'motion',
    label: '動き',
    hint: '動いている瞬間か、止まっている瞬間か',
    options: [
      { value: 'dynamic', label: 'ダイナミック' },
      { value: 'static', label: 'スタティック' },
    ],
  },
  {
    key: 'face',
    label: '表情',
    hint: '顔が読めるか',
    options: [
      { value: 'visible', label: '見える' },
      { value: 'partial', label: '半分（横顔・一部）' },
      { value: 'hidden', label: '見えない' },
    ],
  },
  {
    key: 'sleeve',
    label: '服装',
    options: [
      { value: 'short', label: '半袖' },
      { value: 'long', label: '長袖' },
      { value: 'sleeveless', label: '袖無し' },
      { value: 'bare', label: '上裸' },
    ],
  },
  {
    key: 'light',
    label: '光',
    hint: '光がどこから当たっているか',
    options: [
      { value: 'back', label: '逆光' },
      { value: 'front', label: '順光' },
      { value: 'spot', label: 'スポットライト' },
      { value: 'side', label: '横から' },
    ],
  },
  {
    key: 'style',
    label: 'ジャンル',
    options: [
      { value: 'boulder', label: 'ボルダー' },
      { value: 'lead', label: 'リード' },
      { value: 'ice', label: 'アイス' },
      { value: 'other', label: 'その他' },
    ],
  },
  {
    key: 'source',
    label: '出どころ',
    hint: '自分の写真か、拾ってきた画像か',
    options: [
      { value: 'own', label: '自分で撮った' },
      { value: 'found', label: '拾い画像' },
    ],
  },
  {
    key: 'orientation',
    label: '向き',
    hint: '画像の縦横から自動で入る',
    auto: true,
    options: [
      { value: 'portrait', label: '縦' },
      { value: 'landscape', label: '横' },
      { value: 'square', label: '正方形' },
    ],
  },
  {
    key: 'rating',
    label: '手ごたえ',
    hint: '構図として効いていると思うか',
    options: [
      { value: 'best', label: '★ 最高' },
      { value: 'good', label: '◎ よい' },
      { value: 'ok', label: '○ ふつう' },
      { value: 'weak', label: '△ 弱い' },
    ],
  },
];

/** 自由記述のフィールド */
export const FIELDS = [
  { key: 'photographer', label: '撮影者', placeholder: 'myojin / 名前 / 不明' },
  { key: 'subject', label: '登っている人', placeholder: '名前・仮名' },
  { key: 'location', label: '場所の名前', placeholder: 'ジム名・岩場名' },
  { key: 'date', label: '撮影日', placeholder: '2026-08-15' },
  { key: 'sourceUrl', label: '出典URL', placeholder: '拾い画像のとき、拾った元のページ' },
  { key: 'credit', label: 'クレジット', placeholder: '作者 / ライセンス（拾い画像のとき）' },
  { key: 'note', label: '構図メモ', placeholder: '何が効いている／効いていないか', multiline: true },
];

/** value -> label の逆引き */
export function labelOf(axisKey, value) {
  const axis = AXES.find((a) => a.key === axisKey);
  return axis?.options.find((o) => o.value === value)?.label ?? value;
}

export const AXIS_BY_KEY = Object.fromEntries(AXES.map((a) => [a.key, a]));
