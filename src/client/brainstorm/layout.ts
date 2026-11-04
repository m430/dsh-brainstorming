import type { BrainstormNode, Point } from '../../shared/types.js';
import { H_GAP, NODE_WIDTH, V_GAP, estimateNodeHeight } from '../model.js';
import { collectSubtreeIds } from './tree.js';
import type { NodeSizes } from './types.js';

/** Interview Q&A cards: 4 per row. */
export const INTERVIEW_COLS = 4;
export const INTERVIEW_CARD_WIDTH = 260;
export const INTERVIEW_H_GAP = 16;
export const INTERVIEW_V_GAP = 16;
/** Title sits outside above the group frame (Obsidian-style). */
export const INTERVIEW_LABEL_HEIGHT = 20;
export const INTERVIEW_GROUP_PAD = 14;

export function interviewContentOrigin(interview: BrainstormNode): { x: number; y: number } {
  return {
    x: interview.x,
    y: interview.y + INTERVIEW_LABEL_HEIGHT + INTERVIEW_GROUP_PAD,
  };
}

export function nodeWidth(node: BrainstormNode): number {
  if (typeof node.width === 'number' && Number.isFinite(node.width)) return node.width;
  if (node.kind === 'question' && node.clarifyRootId) return INTERVIEW_CARD_WIDTH;
  return NODE_WIDTH;
}

export function nodeText(node: BrainstormNode): string {
  return [node.content, ...(Array.isArray(node.points) ? node.points : [])]
    .filter((part) => typeof part === 'string' && part !== '')
    .join('\n');
}

export function sizeOf(node: BrainstormNode, sizes: NodeSizes): { width: number; height: number } {
  if (node.kind === 'interview') {
    return {
      width: node.width || 96,
      height: sizes[node.id]?.height || INTERVIEW_LABEL_HEIGHT,
    };
  }
  return {
    width: nodeWidth(node),
    height: sizes[node.id]?.height || estimateNodeHeight(node),
  };
}

/** Interview group (or its source / members) locked while AI is thinking. */
export function isInterviewBranchLocked(nodes: BrainstormNode[], nodeId: string): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const node = byId.get(nodeId);
  if (!node) return false;
  const thinkingInterview = nodes.find(
    (item) => item.kind === 'interview' && item.status === 'thinking',
  );
  if (!thinkingInterview) return false;
  if (node.id === thinkingInterview.id) return true;
  if (node.id === thinkingInterview.parentId) return true;
  if (node.parentId === thinkingInterview.id) return true;
  return false;
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
    comments: [],
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

type Rect = { x: number; y: number; w: number; h: number };

export function aabbOverlap(a: Rect, b: Rect, gap: number): boolean {
  return !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y);
}

/** Lowest y ≥ preferredY whose AABB (inflated by V_GAP) does not hit any non-ignored node. */
export function findFreeY(
  nodes: BrainstormNode[],
  sizes: NodeSizes,
  rect: { x: number; width: number; height: number; preferredY: number },
  ignoreIds: Set<string>,
): number {
  let y = rect.preferredY;
  for (let guard = 0; guard < 120; guard += 1) {
    const candidate: Rect = { x: rect.x, y, w: rect.width, h: rect.height };
    let blockerBottom: number | null = null;
    for (const node of nodes) {
      if (ignoreIds.has(node.id)) continue;
      const size = sizeOf(node, sizes);
      const other: Rect = { x: node.x, y: node.y, w: size.width, h: size.height };
      if (!aabbOverlap(candidate, other, V_GAP)) continue;
      const bottom = other.y + other.h;
      if (blockerBottom === null || bottom > blockerBottom) blockerBottom = bottom;
    }
    if (blockerBottom === null) return y;
    y = blockerBottom + V_GAP;
  }
  return y;
}

function interviewQuestions(nodes: BrainstormNode[], interviewId: string): BrainstormNode[] {
  return nodes
    .filter((node) => node.parentId === interviewId && node.kind === 'question')
    .sort((a, b) => (a.clarifyRound || 0) - (b.clarifyRound || 0) || a.y - b.y);
}

function interviewExtras(nodes: BrainstormNode[], interviewId: string): BrainstormNode[] {
  return nodes.filter((node) => node.parentId === interviewId && node.kind !== 'question');
}

function gridCell(
  originX: number,
  originY: number,
  index: number,
  rowHeights: number[],
): { x: number; y: number } {
  const col = index % INTERVIEW_COLS;
  const row = Math.floor(index / INTERVIEW_COLS);
  let y = originY;
  for (let r = 0; r < row; r += 1) y += (rowHeights[r] || 104) + INTERVIEW_V_GAP;
  return {
    x: originX + col * (INTERVIEW_CARD_WIDTH + INTERVIEW_H_GAP),
    y,
  };
}

function computeRowHeights(questions: BrainstormNode[], sizes: NodeSizes): number[] {
  const rows: number[] = [];
  for (let index = 0; index < questions.length; index += 1) {
    const row = Math.floor(index / INTERVIEW_COLS);
    const height = sizeOf(questions[index], sizes).height;
    rows[row] = Math.max(rows[row] || 0, height);
  }
  return rows;
}

/**
 * Group frame around question cards only (excludes the title label, which sits outside
 * above the top-left border like Obsidian Canvas).
 */
export function interviewGroupBounds(
  nodes: BrainstormNode[],
  sizes: NodeSizes,
  interviewId: string,
): { x: number; y: number; w: number; h: number } | null {
  const interview = nodes.find((node) => node.id === interviewId && node.kind === 'interview');
  if (!interview) return null;
  const origin = interviewContentOrigin(interview);
  const questions = interviewQuestions(nodes, interviewId);
  const pad = INTERVIEW_GROUP_PAD;

  if (questions.length === 0) {
    const emptyW = INTERVIEW_CARD_WIDTH * 2 + INTERVIEW_H_GAP;
    const emptyH = 120;
    return {
      x: origin.x - pad,
      y: origin.y - pad,
      w: emptyW + pad * 2,
      h: emptyH + pad * 2,
    };
  }

  // Prefer CSS-grid geometry (row = max card height + fixed gap) over raw node.y,
  // which can lag behind measured heights and leave huge inter-row gaps.
  const rowHeights = computeRowHeights(questions, sizes);
  const cols = Math.min(INTERVIEW_COLS, questions.length);
  const rows = Math.ceil(questions.length / INTERVIEW_COLS);
  let contentH = 0;
  for (let r = 0; r < rows; r += 1) {
    contentH += rowHeights[r] || 104;
    if (r < rows - 1) contentH += INTERVIEW_V_GAP;
  }
  const contentW = cols * INTERVIEW_CARD_WIDTH + Math.max(0, cols - 1) * INTERVIEW_H_GAP;
  return {
    x: origin.x - pad,
    y: origin.y - pad,
    w: contentW + pad * 2,
    h: contentH + pad * 2,
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

  if (parent.kind === 'interview') {
    const questions = interviewQuestions(nodes, parentId);
    const origin = interviewContentOrigin(parent);
    const rowHeights = computeRowHeights(questions, sizes);
    // Next question cell (assuming caller will append a question).
    const index = questions.length;
    return gridCell(origin.x, origin.y, index, [...rowHeights, 104]);
  }

  const siblings = nodes.filter((node) => node.parentId === parentId);
  let preferredY = parent.y;
  for (const sibling of siblings) preferredY += sizeOf(sibling, sizes).height + V_GAP;
  const x = parent.x + nodeWidth(parent) + H_GAP;
  const ignore = new Set(siblings.map((node) => node.id));
  const y = findFreeY(
    nodes,
    sizes,
    { x, width: NODE_WIDTH, height: 104, preferredY },
    ignore,
  );
  return { x, y };
}

export function stackChildrenY(
  nodes: BrainstormNode[],
  sizes: NodeSizes,
  parentId: string,
): { x: number; y: number } | null {
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return null;
  if (parent.kind === 'interview') {
    return childPositionOf(nodes, sizes, parentId, { x: parent.x, y: parent.y });
  }
  const siblings = nodes.filter((node) => node.parentId === parentId);
  let y = parent.y;
  for (const sibling of siblings) y += sizeOf(sibling, sizes).height + V_GAP;
  return { x: parent.x + nodeWidth(parent) + H_GAP, y };
}

function applyDelta(
  nodes: BrainstormNode[],
  id: string,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  const ignore = collectSubtreeIds(nodes, id);
  for (const node of nodes) {
    if (!ignore.has(node.id)) continue;
    node.x += dx;
    node.y += dy;
  }
}

/**
 * Reposition direct children of `parentId`.
 * Interview: questions in a 4-col grid below the header; other kids to the right of the group.
 * Other parents: L→R column to the right.
 */
export function reflowChildren(
  nodes: BrainstormNode[],
  sizes: NodeSizes,
  parentId: string,
): BrainstormNode[] {
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return nodes;
  const children = nodes.filter((node) => node.parentId === parentId);
  if (children.length === 0) return nodes;

  const next = nodes.map((node) => ({ ...node }));
  const liveParent = next.find((node) => node.id === parentId);
  if (!liveParent) return nodes;

  if (liveParent.kind === 'interview') {
    const questions = interviewQuestions(next, parentId);
    const extras = interviewExtras(next, parentId);
    const origin = interviewContentOrigin(liveParent);
    const rowHeights = computeRowHeights(questions, sizes);

    // Question cards are laid out by CSS grid (.bn-interviewGrid); only keep width
    // and seed approximate coordinates for bounds until the grid syncs.
    for (let index = 0; index < questions.length; index += 1) {
      const live = next.find((node) => node.id === questions[index].id);
      if (!live) continue;
      live.width = INTERVIEW_CARD_WIDTH;
      const cell = gridCell(origin.x, origin.y, index, rowHeights);
      live.x = cell.x;
      live.y = cell.y;
    }

    const bounds = interviewGroupBounds(next, sizes, parentId);
    const extraX = bounds ? bounds.x + bounds.w + H_GAP : origin.x + INTERVIEW_CARD_WIDTH + H_GAP;
    let preferredY = bounds ? bounds.y + INTERVIEW_GROUP_PAD : origin.y;
    for (const extra of extras) {
      const live = next.find((node) => node.id === extra.id);
      if (!live) continue;
      const size = sizeOf(live, sizes);
      const ignore = collectSubtreeIds(next, live.id);
      const freeY = findFreeY(
        next,
        sizes,
        { x: extraX, width: size.width, height: size.height, preferredY },
        ignore,
      );
      applyDelta(next, live.id, extraX - live.x, freeY - live.y);
      preferredY = freeY + size.height + V_GAP;
    }
    return next;
  }

  const x = liveParent.x + nodeWidth(liveParent) + H_GAP;
  let preferredY = liveParent.y;
  for (const child of children) {
    const live = next.find((node) => node.id === child.id);
    if (!live) continue;
    const size = sizeOf(live, sizes);
    const ignore = collectSubtreeIds(next, live.id);
    const freeY = findFreeY(
      next,
      sizes,
      { x, width: size.width, height: size.height, preferredY },
      ignore,
    );
    applyDelta(next, live.id, x - live.x, freeY - live.y);
    preferredY = freeY + size.height + V_GAP;
  }

  return next;
}

function childrenOf(nodes: BrainstormNode[], parentId: string | null): BrainstormNode[] {
  return nodes.filter((node) => node.parentId === parentId);
}

function interviewSubtreeHeight(nodes: BrainstormNode[], sizes: NodeSizes, interviewId: string): number {
  const bounds = interviewGroupBounds(nodes, sizes, interviewId);
  if (!bounds) return sizeOf(nodes.find((n) => n.id === interviewId)!, sizes).height;
  const extras = interviewExtras(nodes, interviewId);
  let bottom = bounds.y + bounds.h;
  for (const extra of extras) {
    const size = sizeOf(extra, sizes);
    bottom = Math.max(bottom, extra.y + size.height);
    for (const desc of nodes) {
      if (desc.parentId !== extra.id) continue;
      const dSize = sizeOf(desc, sizes);
      bottom = Math.max(bottom, desc.y + dSize.height);
    }
  }
  const interview = nodes.find((n) => n.id === interviewId);
  return interview ? bottom - interview.y : bounds.h;
}

function subtreeSpanHeight(nodes: BrainstormNode[], sizes: NodeSizes, nodeId: string): number {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return 0;
  if (node.kind === 'interview') return interviewSubtreeHeight(nodes, sizes, nodeId);
  const self = sizeOf(node, sizes).height;
  const kids = childrenOf(nodes, nodeId);
  if (kids.length === 0) return self;
  let sum = 0;
  for (let index = 0; index < kids.length; index += 1) {
    if (index > 0) sum += V_GAP;
    sum += subtreeSpanHeight(nodes, sizes, kids[index].id);
  }
  return Math.max(self, sum);
}

/** One-shot tidy: forest of L→R trees from root ideas / free nodes. */
export function tidyLayout(nodes: BrainstormNode[], sizes: NodeSizes): BrainstormNode[] {
  if (nodes.length === 0) return nodes;
  let next = nodes.map((node) => ({ ...node }));

  const place = (nodeId: string, x: number, y: number) => {
    const node = next.find((item) => item.id === nodeId);
    if (!node) return;
    node.x = x;
    node.y = y;
    const kids = childrenOf(next, nodeId);
    if (kids.length === 0) return;
    if (node.kind === 'interview') {
      next = reflowChildren(next, sizes, nodeId);
      return;
    }
    const childX = x + nodeWidth(node) + H_GAP;
    let childY = y;
    for (const kid of kids) {
      place(kid.id, childX, childY);
      childY += subtreeSpanHeight(next, sizes, kid.id) + V_GAP;
    }
  };

  const roots = childrenOf(next, null);
  let rootY = 80;
  const rootX = 80;
  for (const root of roots) {
    place(root.id, rootX, rootY);
    rootY += subtreeSpanHeight(next, sizes, root.id) + V_GAP * 2;
  }

  return next;
}

/** Translate a node and its descendants by (dx, dy). */
export function translateSubtree(
  nodes: BrainstormNode[],
  rootId: string,
  dx: number,
  dy: number,
): BrainstormNode[] {
  if (dx === 0 && dy === 0) return nodes;
  const ids = collectSubtreeIds(nodes, rootId);
  return nodes.map((node) => (ids.has(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node));
}

export { NODE_WIDTH, H_GAP, V_GAP, estimateNodeHeight };
