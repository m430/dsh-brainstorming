import { jsonResponse, userError } from '../http.js';
import type { UpdateService } from '../update/service.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function makeUpdateHandlers(getService: () => UpdateService | null) {
  const status = async (_request: Request): Promise<Response> => {
    const service = getService();
    if (!service) {
      return jsonResponse({ ok: false, error: '更新服务未就绪。' }, 503);
    }
    try {
      const result = await service.refreshStatus();
      // Never expose profileDir to the browser.
      const { profileDir: _profileDir, ...safe } = result;
      return jsonResponse({ ok: true, result: safe });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse({ ok: false, error: message }, 500);
    }
  };

  const apply = async (request: Request): Promise<Response> => {
    const service = getService();
    if (!service) {
      return jsonResponse({ ok: false, error: '更新服务未就绪。' }, 503);
    }
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: '仅支持 POST 请求。' }, 405);
    }
    try {
      let body: unknown = {};
      const text = await request.text();
      if (text.trim() !== '') {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          throw userError('请求体不是合法 JSON。', 400);
        }
      }
      const version = isRecord(body) && typeof body.version === 'string'
        ? body.version
        : undefined;
      const result = await service.apply(version);
      return jsonResponse({ ok: result.ok, result }, result.ok ? 200 : 400);
    } catch (error) {
      if (error && typeof (error as { status?: unknown }).status === 'number') {
        return jsonResponse(
          { ok: false, error: (error as Error).message },
          (error as { status: number }).status,
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse({ ok: false, error: message }, 500);
    }
  };

  return { status, apply };
}
