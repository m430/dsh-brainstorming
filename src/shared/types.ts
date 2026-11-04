/**
 * Shared domain and API types for the dsh-brainstorming plugin.
 *
 * Type-only for Host/Client; runtime API paths live in `./api.js`.
 */

export type NodeKind = 'idea' | 'question' | 'outline' | 'result' | 'intent';

export type NodeStatus = 'ready' | 'thinking' | 'error';

export type NodeBusy = 'modify' | 'research' | 'outline' | 'intents' | 'questions';

export interface BrainstormOption {
  id: string;
  label: string;
  description: string;
}

export type NodeRetry =
  | { type: 'expand'; ideaId: string }
  | { type: 'outline'; targetNodeId: string }
  | { type: 'research'; outlineId: string };

export interface BrainstormNode {
  id: string;
  kind: NodeKind;
  title: string;
  content: string;
  points: string[];
  options: BrainstormOption[];
  selectedOptionId: string | null;
  confirmed: boolean;
  status: NodeStatus;
  busy: NodeBusy | null;
  error: string | null;
  retry: NodeRetry | null;
  parentId: string | null;
  x: number;
  y: number;
  width?: number;
  freeNode?: boolean;
  answerMode?: boolean;
  answer?: string;
  answeredAt?: number | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface Board {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  rootIdea: string;
  nodes: BrainstormNode[];
  pan: Point;
  zoom: number;
  legacyNodes?: unknown[];
}

export type BoardPatch = Partial<Omit<Board, 'id'>>;

/** List-row projection without full node payloads. */
export interface BoardSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  rootIdea: string;
}

export interface PathStep {
  question: string;
  choice: string;
}

export interface PathContext {
  idea: string;
  path: PathStep[];
}

export interface QuestionItem {
  question: string;
  why: string;
}

export interface IntentItem {
  label: string;
  detail: string;
}

export interface ExpandRequest {
  idea: string;
  context?: string;
}

export interface ExpandResult {
  question: string;
  options: BrainstormOption[];
  model: string;
  elapsedMs?: number;
}

export interface OutlineRequest {
  idea: string;
  path: PathStep[];
  context?: string;
}

export interface OutlineResult {
  title: string;
  points: string[];
  model: string;
  elapsedMs?: number;
}

export interface ResearchRequest {
  idea: string;
  path: PathStep[];
  outline: {
    title: string;
    points: string[];
  };
}

export interface ResearchResult {
  result: {
    title: string;
    points: string[];
  };
  model: string;
  elapsedMs?: number;
}

export interface QuestionsRequest {
  content: string;
  context?: string;
}

export interface QuestionsResult {
  questions: QuestionItem[];
  model: string;
  elapsedMs?: number;
}

export interface IntentsRequest {
  content: string;
  prompt?: string;
  context?: string;
}

export interface IntentsResult {
  intents: IntentItem[];
  model: string;
  elapsedMs?: number;
}

export interface ModifyRequest {
  node: {
    kind: NodeKind;
    title: string;
    content: string;
    points: string[];
  };
  instruction: string;
  context?: string;
}

export interface ModifyQuestionResult {
  question: string;
  options: BrainstormOption[];
  model: string;
  elapsedMs?: number;
}

export interface ModifyNodeResult {
  title: string;
  content: string;
  points: string[];
  model: string;
  elapsedMs?: number;
}

export type ModifyResult = ModifyQuestionResult | ModifyNodeResult;

export interface ApiResultMap {
  expand: ExpandResult;
  outline: OutlineResult;
  research: ResearchResult;
  questions: QuestionsResult;
  intents: IntentsResult;
  modify: ModifyResult;
}

export type ApiName = keyof ApiResultMap;

export type ApiEnvelope<T> =
  | { ok: true; result: T }
  | { ok: false; error?: string };

export type TranslateParams = Record<string, string | number>;

export type Translate = (key: string, params?: TranslateParams) => string;

export type TranslateDict = Record<string, string>;
