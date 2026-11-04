import type { BrainstormNode, Point } from '../../shared/types.js';
import { H_GAP, NODE_WIDTH, V_GAP, estimateNodeHeight } from '../model.js';
import type { NodeSizes } from './types.js';

export function nodeWidth(node: BrainstormNode): number {
  return node.width || NODE_WIDTH;
}

export function nodeText(node: BrainstormNode): string {
  return [node.content, ...(Array.isArray(node.points) ? node.points : [])]
    .filter((part) => typeof part === 'string' && part !== '')
    .join('\n');
}

export function sizeOf(node: BrainstormNode, sizes: NodeSizes): { width: number; height: number } {
  return {
    width: nodeWidth(node),
    height: sizes[node.id]?.height || estimateNodeHeight(node),
  };
}

export function makeNode(
  input: Pick<BrainstormNode, 'id' | 'kind' | 'title' | 'content' | 'parentId' | 'x' | 'y'> & Partial<BrainstormNode>,
): BrainstormNode {
  return {
    points: [],
    options: [],
    selectedOptionId: null,
    confirmed: false,
    status: 'ready',
    busy: null,
    error: null,
    retry: null,
    ...input,
  };
}

export function viewportCenterFrom(
  element: HTMLDivElement | null,
  pan: Point,
  zoom: number,
): Point {
  if (!element) return { x: 120, y: 120 };
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.width / 2 - pan.x) / zoom - NODE_WIDTH / 2,
    y: (rect.height / 2 - pan.y) / zoom - 90,
  };
}

export function childPositionOf(
  nodes: BrainstormNode[],
  sizes: NodeSizes,
  parentId: string,
  fallback: Point,
): Point {
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return fallback;
  const siblings = nodes.filter((node) => node.parentId === parentId);
  let offset = 0;
  for (const sibling of siblings) offset += sizeOf(sibling, sizes).height + V_GAP;
  return { x: parent.x + nodeWidth(parent) + H_GAP, y: parent.y + offset };
}

export function stackChildrenY(
  nodes: BrainstormNode[],
  sizes: NodeSizes,
  parentId: string,
): { x: number; y: number } | null {
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return null;
  const siblings = nodes.filter((node) => node.parentId === parentId);
  let y = parent.y;
  for (const sibling of siblings) y += sizeOf(sibling, sizes).height + V_GAP;
  return { x: parent.x + nodeWidth(parent) + H_GAP, y };
}

export { NODE_WIDTH, H_GAP, V_GAP, estimateNodeHeight };
