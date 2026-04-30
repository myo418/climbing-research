import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

const BASE = '/climbing-research';

// Rewrite root-relative links/images in markdown so authors can write
// `/climbers/people/rena/` without manually prefixing the site base.
// External URLs and `./` / `../` paths are left untouched.
function remarkBasePath(base) {
  return () => (tree) => {
    const visit = (node) => {
      if ((node.type === 'link' || node.type === 'image') && typeof node.url === 'string') {
        const u = node.url;
        if (u.startsWith('/') && !u.startsWith('//') && !u.startsWith(base + '/') && u !== base) {
          node.url = base + u;
        }
      }
      if (node.children) for (const child of node.children) visit(child);
    };
    visit(tree);
  };
}

const remarkPlugins = [remarkBasePath(BASE)];

export default defineConfig({
  site: 'https://myo418.github.io',
  base: BASE,
  integrations: [mdx({ remarkPlugins })],
  markdown: {
    remarkPlugins,
  },
  server: {
    port: 4321,
    host: true,
  },
});
