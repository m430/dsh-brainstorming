/**
 * Shared domain and API types for the dsh-brainstorming plugin.
 *
 * Type-only for Host/Client; runtime API paths live in `./api.js`.
 */

export type NodeKind =
  | 'idea'
  | 'question'
  | 'outline'
  | 'result'
  | 'intent'
  | 'statement'
  | 'interview'
  | 'group';

export type NodeStatus = 'ready' | 'thinking' | 'error';

export type NodeBusy = 'modify' | 'research' | 'outline' | 'intents' | 'questions' | 'clarify' | 'statement';

/** @deprecated 保留给发散路径；主路径已改为工具栏「访谈 / 发散」。 */
export type ExploreMode = 'deep' | 'quick';

export interface BrainstormOption {
  id: string;
  label: string;
  description: string;
  /** grill-me：模型推荐的选项。 */
  recommended?: boolean;
}

export type NodeRetry =
  | { type: 'expand'; ideaId: string }
  | { type: 'outline'; targetNodeId: string }
  | { type: 'research'; outlineId: string }
  | { type: 'clarify'; rootId: string; interviewId: string };

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
  /** 深挖澄清轮次（1-based）。 */
  clarifyRound?: number;
  /** 被澄清的根点子 id。 */
  clarifyRootId?: string;
  /** 速扩产生的方向，UI 标「未澄清」。 */
  quickExpand?: boolean;
  /** 调研结果评论。 */
  comments?: string[];
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
  /** 深挖模式：引用用户原话的依据。 */
  rationale?: string;
}

export interface ClarifyTurn {
  question: string;
  answer: string;
}

export interface ClarifyRequest {
  content: string;
  prompt?: string;
  context?: string;
  prior?: ClarifyTurn[];
  round?: number;
}

export interface ClarifyResult {
  done: boolean;
  question?: string;
  options?: BrainstormOption[];
  model: string;
  elapsedMs?: number;
}

export interface StatementRequest {
  content: string;
  prompt?: string;
  context?: string;
  prior: ClarifyTurn[];
}

export interface StatementResult {
  title: string;
  goal: string;
  users: string;
  constraints: string[];
  nonGoals: string[];
  model: string;
  elapsedMs?: number;
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
  /** Short markdown overview shown above bullet points. */
  overview: string;
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
  mode?: ExploreMode;
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

export interface TitleRequest {
  content: string;
}

export interface TitleResult {
  title: string;
  model: string;
  elapsedMs?: number;
}

export interface ApiResultMap {
  expand: ExpandResult;
  outline: OutlineResult;
  research: ResearchResult;
  questions: QuestionsResult;
  intents: IntentsResult;
  modify: ModifyResult;
  title: TitleResult;
  clarify: ClarifyResult;
  statement: StatementResult;
}

export type ApiName = keyof ApiResultMap;

export type ApiEnvelope<T> =
  | { ok: true; result: T }
  | { ok: false; error?: string };

export type TranslateParams = Record<string, string | number>;

export type Translate = (key: string, params?: TranslateParams) => string;

export type TranslateDict = Record<string, string>;

export type UpdateInstallKind = 'registry' | 'local' | 'unknown';

/** Client-safe update status (Host omits profileDir). */
export interface UpdateStatus {
  packageName: string;
  enabled: boolean;
  kind: UpdateInstallKind;
  current: string | null;
  latest: string | null;
  available: boolean;
  upgrading: boolean;
  checkedAt: number | null;
  error: string | null;
  hotReload: boolean;
}

export interface UpdateApplyResult {
  ok: boolean;
  current: string | null;
  target: string | null;
  message: string;
  needsRestart: boolean;
}
