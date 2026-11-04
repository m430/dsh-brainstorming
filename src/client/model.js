export const NODE_WIDTH = 320;
export const H_GAP = 120;
export const V_GAP = 28;

export const BOARDS_KEY = 'dsh-brainstorming:boards:v1';
export const LEGACY_BOARDS_KEY = 'requirement-analyzer:brainstorm:boards:v2';
export const LEGACY_BOARDS_V1_KEY = 'requirement-analyzer:brainstorm:boards:v1';
export const LEGACY_KEY = 'requirement-analyzer:brainstorm:v1';

export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 不可用时静默降级为单次会话状态。
  }
}

export function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatTime(timestamp) {
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

export function defaultBoardTitle() {
  try {
    const now = new Date();
    const date = new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(now);
    return `头脑风暴 ${date} ${time}`;
  } catch {
    return '头脑风暴';
  }
}

export function estimateNodeHeight(node) {
  const content = typeof node.content === 'string' ? node.content : '';
  const contentLines = Math.max(1, Math.ceil(content.length / 25));
  const points = Array.isArray(node.points) ? node.points.length : 0;
  const options = Array.isArray(node.options) ? node.options.length : 0;
  return Math.max(104, 74 + contentLines * 22 + points * 22 + options * 58);
}

function normalizeBoard(board) {
  return {
    ...board,
    title: typeof board.title === 'string' ? board.title : '头脑风暴',
    createdAt: typeof board.createdAt === 'number' ? board.createdAt : Date.now(),
    updatedAt: typeof board.updatedAt === 'number' ? board.updatedAt : Date.now(),
    nodes: Array.isArray(board.nodes) ? board.nodes : [],
    pan:
      board.pan && Number.isFinite(board.pan.x) && Number.isFinite(board.pan.y)
        ? { x: board.pan.x, y: board.pan.y }
        : { x: 120, y: 100 },
    zoom: typeof board.zoom === 'number' && board.zoom > 0 ? Math.min(2, Math.max(0.3, board.zoom)) : 1,
  };
}

function boardsFromLegacy(boards) {
  return boards.map((board) => {
    let legacyNodes = Array.isArray(board.legacyNodes)
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

export function loadBoards() {
  const stored = readStorage(BOARDS_KEY, null);
  if (Array.isArray(stored)) return stored.map(normalizeBoard);
  // 迁移旧 requirement-analyzer 版本的画布数据。
  for (const legacyKey of [LEGACY_BOARDS_KEY, LEGACY_BOARDS_V1_KEY]) {
    const legacyBoards = readStorage(legacyKey, null);
    if (Array.isArray(legacyBoards) && legacyBoards.length > 0) return boardsFromLegacy(legacyBoards);
  }
  const legacy = readStorage(LEGACY_KEY, null);
  if (legacy && Array.isArray(legacy.nodes) && legacy.nodes.length > 0) {
    const firstIdea = legacy.nodes.find((node) => node && node.kind === 'idea' && !node.parentId);
    return [
      normalizeBoard({
        id: makeId(),
        title: firstIdea && typeof firstIdea.content === 'string' ? firstIdea.content.slice(0, 28) : '历史头脑风暴',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodeCount: legacy.nodes.length,
        nodes: legacy.nodes,
        pan: legacy.pan,
        zoom: legacy.zoom,
      }),
    ];
  }
  return [];
}

export function saveBoards(boards) {
  writeStorage(BOARDS_KEY, boards);
}

export function buildPath(nodes, nodeId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let current = byId.get(nodeId);
  const chain = [];
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  const ideaNode = [...chain].reverse().find((node) => node.kind === 'idea');
  const path = [];
  for (const node of chain) {
    if (node.kind === 'question' && node.selectedOptionId) {
      const option = (node.options || []).find((item) => item.id === node.selectedOptionId);
      path.push({ question: node.content || '', choice: option ? option.label : '' });
    }
  }
  return { idea: ideaNode && ideaNode.content ? ideaNode.content : '', path };
}

export function buildContextText(nodes, nodeId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let current = byId.get(nodeId);
  const chain = [];
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
