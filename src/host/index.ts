/**
 * 头脑风暴插件 · Host 端。
 *
 * 职责：注册 AI 分析接口；模型调用、提示词与解析见同目录子模块。
 */

import { API_PATHS } from '../shared/api.js';
import type { BrainstormConfig } from './config.js';
import { resolveConfig } from './config.js';
import { makeRouteHandler } from './http.js';
import { expandIdea } from './routes/expand.js';
import { analyzeIntents } from './routes/intents.js';
import { modifyNode } from './routes/modify.js';
import { outlineIdea } from './routes/outline.js';
import { askQuestions } from './routes/questions.js';
import { researchIdea } from './routes/research.js';
import type { HostContext, RouteRunner } from './types.js';

export type { BrainstormConfig } from './config.js';

/** Cordis row id — keep aligned with cordis.patch.yml. */
export const name = 'dsh-brainstorming';

export const inject: string[] = ['llm', 'agentDefaultModel', 'connection'];

/**
 * 注册分析接口。走 `ctx.connection.fetch`，由 Connection 的统一 /api 通道完成
 * Host/Origin 与浏览器会话鉴权，避免额外暴露未鉴权的本机端口。
 */
export function apply(ctx: HostContext, config?: BrainstormConfig): void {
  const resolved = resolveConfig(config);
  const routes: Array<{ path: string; run: RouteRunner }> = [
    { path: API_PATHS.expand, run: expandIdea },
    { path: API_PATHS.intents, run: analyzeIntents },
    { path: API_PATHS.questions, run: askQuestions },
    { path: API_PATHS.outline, run: outlineIdea },
    { path: API_PATHS.research, run: researchIdea },
    { path: API_PATHS.modify, run: modifyNode },
  ];
  for (const route of routes) {
    ctx.effect(
      () =>
        ctx.connection.fetch.register({
          path: route.path,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: makeRouteHandler(ctx, resolved, route.run),
        }),
      `dsh-brainstorming: ${route.path}`,
    );
  }
}
