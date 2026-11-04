import type { Context } from '@deepseek-ai/cordis';
import type { LlmRuntime, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import type { DomainFacility } from '@deepseek-ai/dsh-storage-domain';

import type { ResolvedConfig } from './config.js';

export interface ModelRoute {
  provider: string;
  model: string;
  reasoningEffort?: ReasoningEffortId;
}

export interface ModelSelection {
  provider: string;
  model: string;
  reasoningEffort?: ReasoningEffortId;
}

export interface AgentDefaultModelLike {
  currentSelection(): ModelSelection | undefined;
}

export interface ConnectionFetchRoute {
  path: string;
  methods: readonly ('GET' | 'HEAD' | 'POST')[];
  requestBody: 'buffered' | 'streaming';
  fetch: (request: Request) => Promise<Response>;
}

export interface ConnectionFetch {
  register(route: ConnectionFetchRoute): () => Promise<void> | void;
}

export interface ConnectionService {
  fetch: ConnectionFetch;
}

export type HostContext = Omit<Context, 'connection' | 'storageDomain'> & {
  llm: LlmRuntime;
  agentDefaultModel: AgentDefaultModelLike;
  connection: ConnectionService;
  storageDomain?: DomainFacility;
};

export type RouteRunner = (
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
) => Promise<object>;
