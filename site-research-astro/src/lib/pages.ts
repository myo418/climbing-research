import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MarkdownInstance } from 'astro';

const modules = import.meta.glob<MarkdownInstance<Record<string, any>>>(
  '../../contents/**/*.md',
  { eager: true },
);

const CONTENTS_ROOT = fileURLToPath(new URL('../../contents/', import.meta.url));

export type Page = {
  id: string;
  file: string;
  Content: MarkdownInstance<Record<string, any>>['Content'];
  frontmatter: Record<string, any>;
};

function isExcluded(rel: string, frontmatter: Record<string, any>): boolean {
  // Convention: CLAUDE.md files are prompts/notes for Claude, not site content.
  if (path.basename(rel) === 'CLAUDE.md') return true;
  if (frontmatter.private === true) return true;
  return false;
}

export const pages: Page[] = Object.values(modules)
  .map((mod) => {
    const rel = path.relative(CONTENTS_ROOT, mod.file).replace(/\\/g, '/');
    return {
      rel,
      mod,
      frontmatter: mod.frontmatter ?? {},
    };
  })
  .filter(({ rel, frontmatter }) => !isExcluded(rel, frontmatter))
  .map(({ rel, mod, frontmatter }) => ({
    // foo/index.md → id "foo" (served at /foo/). Root index.md stays "index" (served at /).
    id: rel.replace(/\.md$/, '').replace(/\/index$/, ''),
    file: mod.file,
    Content: mod.Content,
    frontmatter,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

export function getPageById(id: string): Page | undefined {
  return pages.find((p) => p.id === id);
}
