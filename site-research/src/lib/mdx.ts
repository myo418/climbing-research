import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';

export async function renderMarkdown(source: string) {
  const { content } = await compileMDX({
    source,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
      },
    },
  });
  return content;
}
