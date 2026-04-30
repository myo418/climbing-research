// Convention: each person directory may contain a `portfolio.{png,jpg,jpeg,webp}`
// image. When present, it is auto-used as the card thumbnail and profile photo,
// taking precedence over the `image` frontmatter field.
const portfolios = import.meta.glob<string>(
  '../../contents/climbers/people/*/portfolio.{png,jpg,jpeg,webp}',
  { eager: true, query: '?url', import: 'default' },
);

const map: Record<string, string> = {};
for (const [path, urlStr] of Object.entries(portfolios)) {
  const m = path.match(/people\/([^/]+)\/portfolio\.\w+$/);
  if (m) map[m[1]] = urlStr;
}

export function getPeoplePortrait(slug: string): string | undefined {
  return map[slug];
}
