import type { ResolvedConfig } from './config.js';
import type { HostContext, RouteRunner } from './types.js';

export function userError(message: string, status: number): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function makeRouteHandler(ctx: HostContext, config: ResolvedConfig, run: RouteRunner) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: '仅支持 POST 请求。' }, 405);
    }
    const startedAt = Date.now();
    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: '请求体不是合法 JSON。' }, 400);
      }
      const result = await run(ctx, config, body, AbortSignal.timeout(config.timeoutMs));
      return jsonResponse({ ok: true, result: { ...result, elapsedMs: Date.now() - startedAt } });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message =
        name === 'TimeoutError' || /aborted|timeout/iu.test(rawMessage)
          ? '分析超时，请缩短内容或稍后重试。'
          : rawMessage;
      ctx.logger?.warn?.(`dsh-brainstorming: ${rawMessage}`);
      const status = error && typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 500;
      return jsonResponse({ ok: false, error: message }, status);
    }
  };
}
