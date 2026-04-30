import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const CONTENT_ROOT = path.join(process.cwd(), 'content');

export type Page = {
  id: string;
  slug: string[];
  filePath: string;
  rawContent: string;
  frontmatter: Record<string, any>;
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

function isExcluded(filePath: string, frontmatter: Record<string, any>): boolean {
  if (path.basename(filePath) === 'CLAUDE.md') return true;
  if (frontmatter.private === true) return true;
  return false;
}

let cached: Page[] | null = null;

export function loadPages(): Page[] {
  if (cached) return cached;
  if (!fs.existsSync(CONTENT_ROOT)) return [];

  const files = walk(CONTENT_ROOT);
  const pages = files
    .map((filePath) => {
      const raw = fs.readFileSync(filePath, 'utf8');
      const { content, data } = matter(raw);
      if (isExcluded(filePath, data)) return null;
      const rel = path.relative(CONTENT_ROOT, filePath).replace(/\\/g, '/');
      const id = rel.replace(/\.md$/, '');
      return {
        id,
        slug: id.split('/'),
        filePath,
        rawContent: content,
        frontmatter: data,
      };
    })
    .filter((p): p is Page => p !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

  cached = pages;
  return pages;
}

export function getPageById(id: string): Page | undefined {
  return loadPages().find((p) => p.id === id);
}
