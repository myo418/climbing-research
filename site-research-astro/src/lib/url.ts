const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string): string {
  if (!path) return BASE + '/';
  if (/^([a-z]+:)?\/\//i.test(path)) return path;
  if (!path.startsWith('/')) path = '/' + path;
  return BASE + path;
}
