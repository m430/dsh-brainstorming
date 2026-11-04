import type {
  Board,
  BrainstormNode,
  BrainstormOption,
  NodeBusy,
  NodeKind,
  NodeRetry,
  NodeStatus,
  PathContext,
  PathStep,
  Point,
} from '../shared/types.js';

export const NODE_WIDTH = 320;
export const H_GAP = 120;
export const V_GAP = 28;

export const BOARDS_KEY = 'dsh-brainstorming:boards:v1';
export const LEGACY_BOARDS_KEY = 'requirement-analyzer:brainstorm:boards:v2';
export const LEGACY_BOARDS_V1_KEY = 'requirement-analyzer:brainstorm:boards:v1';
export const LEGACY_KEY = 'requirement-analyzer:brainstorm:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const NODE_KINDS: readonly NodeKind[] = ['idea', 'question', 'outline', 'result', 'intent'];
const NODE_STATUSES: readonly NodeStatus[] = ['ready', 'thinking', 'error'];
const NODE_BUSY: readonly NodeBusy[] = ['modify', 'research', 'outline', 'intents', 'questions'];

function normalizeOptions(value: unknown): BrainstormOption[] {
  if (!Array.isArray(value)) return [];
  const options: BrainstormOption[] = [];
  for (const item of value) {
    if (options.length >= 8) break;
    if (typeof item === 'string') {
      const label = item.trim();
      if (label !== '') {
        options.push({ id: String.fromCharCode(65 + options.length), label, description: '' });
      }
      continue;
    }
    if (!isRecord(item)) continue;
    const label = asString(item.label).trim();
    if (label === '') continue;
    options.push({
      id: asString(item.id) || String.fromCharCode(65 + options.length),
      label,
      description: asString(item.description),
    });
  }
  return options;
}

function normalizeRetry(value: unknown): NodeRetry | null {
  if (!isRecord(value)) return null;
  if (value.type === 'expand' && typeof value.ideaId === 'string') {
    return { type: 'expand', ideaId: value.ideaId };
  }
  if (value.type === 'outline' && typeof value.targetNodeId === 'string') {
    return { type: 'outline', targetNodeId: value.targetNodeId };
  }
  if (value.type === 'research' && typeof value.outlineId === 'string') {
    return { type: 'research', outlineId: value.outlineId };
  }
  return null;
}

function normalizeNode(value: unknown): BrainstormNode {
  const node = isRecord(value) ? value : {};
  const kind = NODE_KINDS.includes(node.kind as NodeKind) ? (node.kind as NodeKind) : 'idea';
  const status = NODE_STATUSES.includes(node.status as NodeStatus) ? (node.status as NodeStatus) : 'ready';
  const busy = NODE_BUSY.includes(node.busy as NodeBusy) ? (node.busy as NodeBusy) : null;
  return {
    id: asString(node.id) || makeId(),
    kind,
    title: asString(node.title),
    content: asString(node.content),
    points: asStringArray(node.points),
    options: normalizeOptions(node.options),
    selectedOptionId: typeof node.selectedOptionId === 'string' ? node.selectedOptionId : null,
    confirmed: node.confirmed === true,
    status,
    busy,
    error: typeof node.error === 'string' ? node.error : null,
    retry: normalizeRetry(node.retry),
    parentId: typeof node.parentId === 'string' ? node.parentId : null,
    x: asNumber(node.x, 120),
    y: asNumber(node.y, 120),
    ...(typeof node.width === 'number' && Number.isFinite(node.width) ? { width: node.width } : {}),
    ...(node.freeNode === true ? { freeNode: true } : {}),
    ...(node.answerMode === true ? { answerMode: true } : {}),
    ...(typeof node.answer === 'string' ? { answer: node.answer } : {}),
    ...(typeof node.answeredAt === 'number' ? { answeredAt: node.answeredAt } : {}),
  };
}

function normalizeBoard(value: unknown): Board {
  const board = isRecord(value) ? value : {};
  const pan: Point = isRecord(board.pan) && Number.isFinite(board.pan.x) && Number.isFinite(board.pan.y)
    ? { x: board.pan.x as number, y: board.pan.y as number }
    : { x: 120, y: 100 };
  const nodeValues = Array.isArray(board.nodes) ? board.nodes : [];
  const nodes = nodeValues.map(normalizeNode);
  return {
    id: asString(board.id) || makeId(),
    title: asString(board.title) || '头脑风暴',
    createdAt: asNumber(board.createdAt, Date.now()),
    updatedAt: asNumber(board.updatedAt, Date.now()),
    nodeCount: typeof board.nodeCount === 'number' ? board.nodeCount : nodes.length,
    rootIdea: asString(board.rootIdea),
    nodes,
    pan,
    zoom: typeof board.zoom === 'number' && board.zoom > 0 ? Math.min(2, Math.max(0.3, board.zoom)) : 1,
    ...(Array.isArray(board.legacyNodes) ? { legacyNodes: board.legacyNodes } : {}),
  };
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 不可用时静默降级为单次会话状态。
  }
}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

export function defaultBoardTitle(): string {
  try {
    const now = new Date();
    const date = new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(now);
    return `头脑风暴 ${date} ${time}`;
  } catch {
    return '头脑风暴';
  }
}

export function estimateNodeHeight(node: Pick<BrainstormNode, 'content' | 'points' | 'options'>): number {
  const content = typeof node.content === 'string' ? node.content : '';
  const contentLines = Math.max(1, Math.ceil(content.length / 25));
  const points = Array.isArray(node.points) ? node.points.length : 0;
  const options = Array.isArray(node.options) ? node.options.length : 0;
  return Math.max(104, 74 + contentLines * 22 + points * 22 + options * 58);
}

function boardsFromLegacy(value: unknown[]): Board[] {
  return value.map((item) => {
    const board = isRecord(item) ? item : {};
    let legacyNodes: unknown[] = Array.isArray(board.legacyNodes)
      ? board.legacyNodes
      : Array.isArray(board.nodes)
        ? board.nodes
        : [];
    if (legacyNodes.length === 0 && typeof board.rootIdea === 'string' && board.rootIdea.trim() !== '') {
      legacyNodes = [
        {
          id: makeId(),
          kind: 'idea',
          title: '点子',
          content: board.rootIdea.trim(),
          points: [],
          options: [],
          selectedOptionId: null,
          confirmed: false,
          status: 'ready',
          busy: null,
          error: null,
          retry: null,
          parentId: null,
          x: 120,
          y: 120,
          width: 320,
        },
      ];
    }
    return normalizeBoard({ ...board, legacyNodes: undefined, nodes: legacyNodes, nodeCount: legacyNodes.length });
  });
}

export function loadBoards(): Board[] {
  const stored = readStorage<unknown>(BOARDS_KEY, null);
  if (Array.isArray(stored)) return stored.map(normalizeBoard);
  // 迁移旧 requirement-analyzer 版本的画布数据。
  for (const legacyKey of [LEGACY_BOARDS_KEY, LEGACY_BOARDS_V1_KEY]) {
    const legacyBoards = readStorage<unknown>(legacyKey, null);
    if (Array.isArray(legacyBoards) && legacyBoards.length > 0) return boardsFromLegacy(legacyBoards);
  }
  const legacy = readStorage<unknown>(LEGACY_KEY, null);
  const legacyRecord = isRecord(legacy) ? legacy : {};
  if (Array.isArray(legacyRecord.nodes) && legacyRecord.nodes.length > 0) {
    const firstIdea = legacyRecord.nodes.find(
      (node) => isRecord(node) && node.kind === 'idea' && !node.parentId,
    );
    return [
      normalizeBoard({
        id: makeId(),
        title: isRecord(firstIdea) && typeof firstIdea.content === 'string'
          ? firstIdea.content.slice(0, 28)
          : '历史头脑风暴',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodeCount: legacyRecord.nodes.length,
        nodes: legacyRecord.nodes,
        pan: legacyRecord.pan,
        zoom: legacyRecord.zoom,
      }),
    ];
  }
  return [];
}

export function saveBoards(boards: Board[]): void {
  writeStorage(BOARDS_KEY, boards);
}

export function buildPath(nodes: BrainstormNode[], nodeId: string): PathContext {
  const byId = new Map<string, BrainstormNode>(nodes.map((node) => [node.id, node]));
  let current = byId.get(nodeId);
  const chain: BrainstormNode[] = [];
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  const ideaNode = [...chain].reverse().find((node) => node.kind === 'idea');
  const path: PathStep[] = [];
  for (const node of chain) {
    if (node.kind === 'question' && node.selectedOptionId) {
      const option = node.options.find((item) => item.id === node.selectedOptionId);
      path.push({ question: node.content || '', choice: option ? option.label : '' });
    }
  }
  return { idea: ideaNode && ideaNode.content ? ideaNode.content : '', path };
}

export function buildContextText(nodes: BrainstormNode[], nodeId: string): string {
  const byId = new Map<string, BrainstormNode>(nodes.map((node) => [node.id, node]));
  let current = byId.get(nodeId);
  const chain: BrainstormNode[] = [];
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain
    .slice(0, -1)
    .map((node) => {
      const kind =
        node.kind === 'idea'
          ? '点子'
          : node.kind === 'question'
            ? '追问'
            : node.kind === 'outline'
              ? '调研大纲'
              : '调研结果';
      return [kind, node.title || '', node.content || '', Array.isArray(node.points) ? node.points.join('；') : '']
        .filter((part) => part !== '')
        .join('：');
    })
    .join('\n')
    .slice(0, 6000);
}
