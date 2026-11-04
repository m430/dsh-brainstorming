import type { BrainstormNode } from '../../shared/types.js';

export type BrainstormModalState =
  | { type: 'addIdea'; parentId: string | null }
  | { type: 'modify'; nodeId: string }
  | { type: 'delete'; nodeId: string }
  | { type: 'intents'; nodeId: string };

export type NodePatch = Partial<BrainstormNode> | ((node: BrainstormNode) => Partial<BrainstormNode>);

export type NodeSizes = Record<string, { height: number }>;
