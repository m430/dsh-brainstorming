import type {
  BrainstormNode,
  NodeBusy,
  NodeKind,
  NodeRetry,
  NodeStatus,
  PathContext,
  PathStep,
  BrainstormOption,
} from '../shared/types.js';

export const NODE_WIDTH = 320;
/** Wider card for long-form outline / research result nodes. */
export const DOC_NODE_WIDTH = 480;
export const H_GAP = 120;
export const V_GAP = 28;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const NODE_KINDS: readonly NodeKind[] = [
  'idea',
  'question',
  'outline',
  'result',
  'intent',
  'statement',
  'interview',
  'group',
];
const NODE_STATUSES: readonly NodeStatus[] = ['ready', 'thinking', 'error'];
const NODE_BUSY: readonly NodeBusy[] = [
  'modify',
  'research',
  'outline',
  'intents',
  'questions',
  'clarify',
  'statement',
];

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
  return 'Untitled';
}

/** True when the board still has a placeholder title eligible for AI naming. */
export function isPlaceholderBoardTitle(title: string): boolean {
  const value = title.trim();
  if (value === '') return true;
  if (value === 'Untitled' || value === '未命名头脑风暴') return true;
  if (/^头脑风暴\s+\d/u.test(value)) return true;
  return false;
}

export function estimateNodeHeight(node: Pick<BrainstormNode, 'content' | 'points' | 'options'>): number {
  const content = typeof node.content === 'string' ? node.content : '';
  const contentLines = Math.max(1, Math.ceil(content.length / 25));
  const points = Array.isArray(node.points) ? node.points.length : 0;
  const options = Array.isArray(node.options) ? node.options.length : 0;
  return Math.max(104, 74 + contentLines * 22 + points * 22 + options * 58);
}

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
      ...(item.recommended === true ? { recommended: true } : {}),
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
  if (
    value.type === 'clarify' &&
    typeof value.rootId === 'string' &&
    typeof value.interviewId === 'string'
  ) {
    return { type: 'clarify', rootId: value.rootId, interviewId: value.interviewId };
  }
  return null;
}

/** Lightweight runtime coerce for nodes coming from AI responses / editor drafts. */
export function normalizeNode(value: unknown): BrainstormNode {
  const node = isRecord(value) ? value : {};
  const kind = NODE_KINDS.includes(node.kind as NodeKind) ? (node.kind as NodeKind) : 'idea';
  const status = NODE_STATUSES.includes(node.status as NodeStatus) ? (node.status as NodeStatus) : 'ready';
  const busy = NODE_BUSY.includes(node.busy as NodeBusy) ? (node.busy as NodeBusy) : null;
  return {
    id: asString(node.id) || makeId(),
    kind,
    title: asString(node.title),
    content: asString(node.content),
    points: Array.isArray(node.points) ? node.points.filter((item): item is string => typeof item === 'string') : [],
    options: normalizeOptions(node.options),
    selectedOptionId: typeof node.selectedOptionId === 'string' ? node.selectedOptionId : null,
    confirmed: node.confirmed === true,
    status,
    busy,
    error: typeof node.error === 'string' ? node.error : null,
    retry: normalizeRetry(node.retry),
    parentId: typeof node.parentId === 'string' ? node.parentId : null,
    x: typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 120,
    y: typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 120,
    ...(typeof node.width === 'number' && Number.isFinite(node.width) ? { width: node.width } : {}),
    ...(node.freeNode === true ? { freeNode: true } : {}),
    ...(node.answerMode === true ? { answerMode: true } : {}),
    ...(typeof node.answer === 'string' ? { answer: node.answer } : {}),
    ...(typeof node.answeredAt === 'number' ? { answeredAt: node.answeredAt } : {}),
  };
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
    if (node.kind !== 'question') continue;
    const answer = typeof node.answer === 'string' ? node.answer.trim() : '';
    if (!node.selectedOptionId && answer === '') continue;
    const option = node.options.find((item) => item.id === node.selectedOptionId);
    path.push({
      question: node.content || '',
      choice: answer || (option ? option.label : ''),
    });
  }
  return { idea: ideaNode && ideaNode.content ? ideaNode.content : '', path };
}

/** Seed text for interviewing a free group: title + all member bodies. */
export function groupInterviewSeed(nodes: BrainstormNode[], groupId: string): string {
  const group = nodes.find((node) => node.id === groupId && node.kind === 'group');
  const members = nodes.filter((node) => node.parentId === groupId);
  const parts: string[] = [];
  const title = (group?.title || '').trim();
  if (title !== '') parts.push(`分组：${title}`);
  for (const member of members) {
    const body = [member.content, ...(Array.isArray(member.points) ? member.points : [])]
      .filter((part) => typeof part === 'string' && part.trim() !== '')
      .join('\n')
      .trim();
    if (body !== '') parts.push(body);
  }
  return parts.join('\n\n').slice(0, 6000);
}

export function buildContextText(nodes: BrainstormNode[], nodeId: string): string {
  const byId = new Map<string, BrainstormNode>(nodes.map((node) => [node.id, node]));
  let current = byId.get(nodeId);
  const chain: BrainstormNode[] = [];
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  const lines = chain.slice(0, -1).map((node) => {
    const kind =
      node.kind === 'idea'
        ? '点子'
        : node.kind === 'interview'
          ? '访谈'
          : node.kind === 'group'
            ? '分组'
            : node.kind === 'question'
              ? '追问'
              : node.kind === 'intent'
                ? '意图'
                : node.kind === 'statement'
                  ? '问题陈述'
                  : node.kind === 'outline'
                    ? '调研大纲'
                    : '调研结果';
    const answer =
      node.kind === 'question' && typeof node.answer === 'string' && node.answer.trim() !== ''
        ? `回答：${node.answer.trim()}`
        : '';
    return [
      kind,
      node.title || '',
      node.content || '',
      answer,
      Array.isArray(node.points) ? node.points.join('；') : '',
    ]
      .filter((part) => part !== '')
      .join('：');
  });
  const target = byId.get(nodeId);
  // Free-group root has no ancestors; fold member summary into context.
  if (target?.kind === 'group') {
    const seed = groupInterviewSeed(nodes, nodeId);
    if (seed !== '') lines.push(seed);
  }
  return lines.join('\n').slice(0, 6000);
}
