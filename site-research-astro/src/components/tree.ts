export type Node = {
  name: string;
  path: string;
  children: Map<string, Node>;
  entryId?: string;
  title?: string;
  order?: number;
  draft?: boolean;
  reverseSort?: boolean;
};

export function sortChildren(node: Node): Node[] {
  const reverse = node.reverseSort === true;
  return [...node.children.values()].sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    const aIsDir = a.children.size > 0;
    const bIsDir = b.children.size > 0;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return reverse ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
  });
}
