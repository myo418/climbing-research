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

// The rehype pass below only sees anchors markdown itself produced; raw <a> tags
// written inside markdown (image captions) stay untouched strings, so patch those here.
function remarkExternalLinksInRawHtml() {
  return () => (tree) => {
    const visit = (node) => {
      if (node.type === 'html' && typeof node.value === 'string') {
        node.value = node.value.replace(
          /<a\s+([^>]*href="https?:\/\/[^"]*"[^>]*)>/gi,
          (match, attrs) =>
            /\btarget=/i.test(attrs)
              ? match
              : `<a ${attrs} target="_blank" rel="noopener noreferrer">`,
        );
      }
      if (node.children) for (const child of node.children) visit(child);
    };
    visit(tree);
  };
}

// Open external links in a new tab. Internal links (including the BASE-prefixed
// ones the plugin above produces) are left alone so in-site navigation stays put.
// Applies to markdown links and to raw <a> tags written inside markdown.
function rehypeExternalLinks() {
  return () => (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'a') {
        const href = node.properties?.href;
        if (typeof href === 'string' && /^https?:\/\//i.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = 'noopener noreferrer';
        }
      }
      if (node.children) for (const child of node.children) visit(child);
    };
    visit(tree);
  };
}

const remarkPlugins = [remarkBasePath(BASE), remarkExternalLinksInRawHtml()];
const rehypePlugins = [rehypeExternalLinks()];

export default defineConfig({
  site: 'https://myo418.github.io',
  base: BASE,
  integrations: [mdx({ remarkPlugins, rehypePlugins })],
  markdown: {
    remarkPlugins,
    rehypePlugins,
  },
  server: {
    port: 4700,
    host: true,
  },
});
