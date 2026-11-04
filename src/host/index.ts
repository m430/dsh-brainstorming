/**
 * 头脑风暴插件 · Host 端。
 *
 * 职责：注册 AI 分析接口与 boards CRUD；模型调用、提示词与解析见同目录子模块。
 */

import { BOARD_API_PATHS, API_PATHS } from '../shared/api.js';
import type { BrainstormConfig } from './config.js';
import { resolveConfig } from './config.js';
import { brainstormDomain } from './domain/brainstorm.js';
import { makeRouteHandler } from './http.js';
import { expandIdea } from './routes/expand.js';
import { analyzeIntents } from './routes/intents.js';
import { modifyNode } from './routes/modify.js';
import { outlineIdea } from './routes/outline.js';
import { askQuestions } from './routes/questions.js';
import { researchIdea } from './routes/research.js';
import { makeBoardsHandlers } from './routes/boards.js';
import type { Domain } from '@deepseek-ai/dsh-storage-domain';
import type { HostContext, RouteRunner } from './types.js';
import type { BrainstormDomain } from './domain/brainstorm.js';

export type { BrainstormConfig } from './config.js';

/** Cordis row id — keep aligned with cordis.patch.yml. */
export const name = 'dsh-brainstorming';

/** Required services. `storageDomain` is optional via `ctx.get` so AI routes still load without it. */
export const inject: string[] = ['llm', 'agentDefaultModel', 'connection'];

/**
 * 注册分析接口与 boards CRUD。走 `ctx.connection.fetch`，由 Connection 的统一 /api 通道完成
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

  let domain: Domain<BrainstormDomain> | null = null;
  const handlers = makeBoardsHandlers(() => domain);

  ctx.effect(() => {
    let disposed = false;
    const openPromise = (async () => {
      const storageDomain = ctx.get('storageDomain');
      if (!storageDomain) {
        ctx.logger?.warn?.('dsh-brainstorming: storageDomain unavailable; boards API returns 503');
        return;
      }
      try {
        const opened = await storageDomain.open(brainstormDomain);
        if (disposed) {
          await opened.close();
          return;
        }
        domain = opened;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger?.warn?.(`dsh-brainstorming: failed to open brainstorm domain: ${message}`);
        domain = null;
      }
    })();

    return async () => {
      disposed = true;
      await openPromise;
      const current = domain;
      domain = null;
      if (current) await current.close();
    };
  }, 'dsh-brainstorming: brainstorm domain');

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: BOARD_API_PATHS.list,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: (request) => (request.method === 'GET' ? handlers.list(request) : handlers.create(request)),
      }),
    `dsh-brainstorming: ${BOARD_API_PATHS.list}`,
  );

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: BOARD_API_PATHS.item,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: handlers.getItem,
      }),
    `dsh-brainstorming: ${BOARD_API_PATHS.item}`,
  );

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: BOARD_API_PATHS.update,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: handlers.update,
      }),
    `dsh-brainstorming: ${BOARD_API_PATHS.update}`,
  );

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: BOARD_API_PATHS.delete,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: handlers.remove,
      }),
    `dsh-brainstorming: ${BOARD_API_PATHS.delete}`,
  );
}
