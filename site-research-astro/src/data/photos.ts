// 写真のメタ情報。軸の定義は photo-axes.mjs（admin と共有）、値は photos.json。
// photos.json は `npm run admin`（http://127.0.0.1:4701）から編集する。手で書いてもよい。
import raw from './photos.json';
import { AXES as RAW_AXES, FIELDS as RAW_FIELDS } from './photo-axes.mjs';

export interface AxisOption {
  value: string;
  label: string;
}
export interface Axis {
  key: string;
  label: string;
  hint?: string;
  auto?: boolean;
  options: AxisOption[];
}
export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

export interface Photo {
  id: string;
  /** クライミングしていない写真など、サイトに出さないもの */
  excluded?: boolean;
  /** public/photos/ からの相対パス（原本） */
  file: string;
  /** public/photos/ からの相対パス（表示用・長辺1600px） */
  web: string;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape' | 'square';
  /** 元ファイルが public/photos/ に無い */
  missing?: boolean;
  [key: string]: unknown;
}

export const AXES = RAW_AXES as Axis[];
export const FIELDS = RAW_FIELDS as FieldDef[];
const allPhotos = (raw as { photos: Photo[] }).photos;

/** admin で「クライミングしていない写真」として除外した印 */
export const isExcluded = (p: Photo) => p.excluded === true;

/** サイトに出す写真。除外印の付いたものは含めない */
export const photos = allPhotos.filter((p) => !isExcluded(p));
/** 除外も含めた全件 */
export { allPhotos };

/** 絞り込みに使う軸（自動で入るものは除く） */
export const FILTER_AXES = AXES.filter((a) => !a.auto);

export function labelOf(axisKey: string, value: unknown): string {
  const axis = AXES.find((a) => a.key === axisKey);
  return axis?.options.find((o) => o.value === value)?.label ?? String(value ?? '');
}

/** ある軸の値ごとの枚数 */
export function countBy(axisKey: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of photos) {
    const v = p[axisKey];
    if (typeof v === 'string' && v) out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}
