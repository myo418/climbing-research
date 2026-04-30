import Link from 'next/link';
import { getPageById, loadPages } from '@/lib/pages';
import { renderMarkdown } from '@/lib/mdx';
import { resolveTemplate } from '@/components/layouts';

export default async function HomePage() {
  const top = getPageById('index');
  const otherPages = loadPages().filter((p) => p.id !== 'index');

  let topNode: React.ReactNode = null;
  if (top) {
    const content = await renderMarkdown(top.rawContent);
    const Template = resolveTemplate(top.frontmatter.template);
    topNode = Template ? <Template>{content}</Template> : content;
  }

  const byFolder = new Map<string, typeof otherPages>();
  for (const p of otherPages) {
    const folder = p.slug.length > 1 ? p.slug[0] : '(root)';
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder)!.push(p);
  }

  const folders = [...byFolder.keys()].sort((a, b) => {
    if (a === '(root)') return 1;
    if (b === '(root)') return -1;
    return a.localeCompare(b);
  });

  return (
    <>
      {topNode}

      <h2>全ページ一覧</h2>
      <p className="meta">content/ 配下の全 md を自動でページ化しています（{otherPages.length} ページ）。</p>
      {folders.map((folder) => (
        <section key={folder}>
          <h3>{folder}</h3>
          <ul>
            {byFolder
              .get(folder)!
              .slice()
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((p) => (
                <li key={p.id}>
                  <Link href={`/${p.id}`}>{p.id}</Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
