import { notFound } from 'next/navigation';
import { getPageById, loadPages } from '@/lib/pages';
import { renderMarkdown } from '@/lib/mdx';
import { resolveTemplate } from '@/components/layouts';

export function generateStaticParams() {
  return loadPages()
    .filter((p) => p.id !== 'index')
    .map((p) => ({ slug: p.slug }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const id = slug.join('/');
  const page = getPageById(id);
  if (!page) notFound();

  const content = await renderMarkdown(page.rawContent);
  const Template = resolveTemplate(page.frontmatter.template);

  return (
    <>
      <p className="breadcrumb">{page.id}.md</p>
      {Template ? <Template>{content}</Template> : content}
    </>
  );
}
