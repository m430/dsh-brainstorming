import type { BrainstormNode } from '../../shared/types.js';

/** Collect a node id and every descendant id (inclusive). */
export function collectSubtreeIds(nodes: BrainstormNode[], nodeId: string): Set<string> {
  const ids = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    for (const node of nodes) if (node.parentId === id) stack.push(node.id);
  }
  return ids;
}

export function countDescendants(nodes: BrainstormNode[], nodeId: string): number {
  return Math.max(0, collectSubtreeIds(nodes, nodeId).size - 1);
}
