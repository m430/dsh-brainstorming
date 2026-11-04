import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';

import type { Board, BoardPatch, BrainstormNode } from '../../shared/types.js';

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const optionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  recommended: z.boolean().optional(),
});

const retrySchema = z.union([
  z.object({ type: z.literal('expand'), ideaId: z.string() }),
  z.object({ type: z.literal('outline'), targetNodeId: z.string() }),
  z.object({ type: z.literal('research'), outlineId: z.string() }),
]);

const nodeSchema = z.object({
  id: z.string(),
  kind: z.enum(['idea', 'question', 'outline', 'result', 'intent', 'statement', 'interview']),
  title: z.string(),
  content: z.string(),
  points: z.array(z.string()),
  options: z.array(optionSchema),
  selectedOptionId: z.string().nullable(),
  confirmed: z.boolean(),
  status: z.enum(['ready', 'thinking', 'error']),
  busy: z
    .enum(['modify', 'research', 'outline', 'intents', 'questions', 'clarify', 'statement'])
    .nullable(),
  error: z.string().nullable(),
  retry: retrySchema.nullable(),
  parentId: z.string().nullable(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().optional(),
  freeNode: z.boolean().optional(),
  answerMode: z.boolean().optional(),
  answer: z.string().optional(),
  answeredAt: z.number().finite().nullable().optional(),
  clarifyRound: z.number().finite().optional(),
  clarifyRootId: z.string().optional(),
  quickExpand: z.boolean().optional(),
  comments: z.array(z.string()).optional(),
});

export const boardRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
  nodeCount: z.number().int().nonnegative(),
  rootIdea: z.string(),
  nodes: z.array(nodeSchema),
  pan: pointSchema,
  zoom: z.number().finite().positive(),
  legacyNodes: z.array(z.unknown()).optional(),
});

export type BoardRecord = z.infer<typeof boardRecordSchema>;

export const brainstormDomain = defineDomain({
  name: 'brainstorm',
  version: 1,
  layout: 'per-record',
  tables: {
    boards: domainTable<string, BoardRecord>(boardRecordSchema),
  },
});

export type BrainstormDomain = typeof brainstormDomain;

/** Strip ephemeral UI runtime fields before durable write. */
export function persistableBoard(board: Board): BoardRecord {
  const nodes: BrainstormNode[] = (Array.isArray(board.nodes) ? board.nodes : []).map((node) => ({
    ...node,
    status: 'ready',
    busy: null,
    error: null,
  }));
  const record: BoardRecord = {
    id: board.id,
    title: board.title || '头脑风暴',
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    nodeCount: typeof board.nodeCount === 'number' ? board.nodeCount : nodes.length,
    rootIdea: board.rootIdea || '',
    nodes,
    pan: board.pan || { x: 120, y: 100 },
    zoom: typeof board.zoom === 'number' && board.zoom > 0 ? Math.min(2, Math.max(0.3, board.zoom)) : 1,
  };
  if (Array.isArray(board.legacyNodes)) record.legacyNodes = board.legacyNodes;
  return boardRecordSchema.parse(record);
}

export function applyBoardPatch(current: BoardRecord, patch: BoardPatch): BoardRecord {
  const merged: Board = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now(),
  };
  return persistableBoard(merged);
}

export interface BoardSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  rootIdea: string;
}

export function toBoardSummary(board: BoardRecord): BoardSummary {
  return {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    nodeCount: board.nodeCount,
    rootIdea: board.rootIdea,
  };
}
