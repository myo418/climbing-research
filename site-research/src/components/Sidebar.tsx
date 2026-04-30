import Link from 'next/link';
import { loadPages } from '@/lib/pages';
import styles from './Sidebar.module.css';

type Node = {
  name: string;
  path: string;
  children: Map<string, Node>;
  entryId?: string;
};

function buildTree(): Node {
  const root: Node = { name: '', path: '', children: new Map() };
  for (const page of loadPages()) {
    if (page.id === 'index') continue;
    const parts = page.slug;
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          children: new Map(),
        });
      }
      node = node.children.get(part)!;
      if (isLeaf) node.entryId = page.id;
    }
  }
  return root;
}

function sortChildren(node: Node): Node[] {
  return [...node.children.values()].sort((a, b) => {
    const aIsDir = a.children.size > 0;
    const bIsDir = b.children.size > 0;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

const MAX_DEPTH = 2;

function TreeNode({ node, depth = 0 }: { node: Node; depth?: number }) {
  if (depth >= MAX_DEPTH) return null;
  const children = sortChildren(node);
  return (
    <ul>
      {children.map((child) => (
        <li key={child.path}>
          {child.entryId !== undefined ? (
            <Link className="page" href={`/${child.entryId}`}>
              {child.name}
            </Link>
          ) : (
            <>
              <span className="dirName">{child.name}/</span>
              <TreeNode node={child} depth={depth + 1} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Sidebar() {
  const root = buildTree();
  return (
    <nav className={styles.sidebar}>
      <Link href="/" className={styles.home}>クライミングのリサーチ</Link>
      <TreeNode node={root} />
    </nav>
  );
}
