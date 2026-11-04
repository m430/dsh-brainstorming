import { API_PATHS } from '../shared/api.js';
import type { ApiEnvelope, ApiName, ApiResultMap } from '../shared/types.js';

export const API = API_PATHS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function postJson<T>(
  path: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('登录状态已失效，请刷新页面后重试。');
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`接口返回非 JSON（HTTP ${response.status}）。`);
  }
  if (!response.ok || !isRecord(data) || data.ok !== true) {
    const message = isRecord(data) && typeof data.error === 'string'
      ? data.error
      : `请求失败（HTTP ${response.status}）。`;
    throw new Error(message);
  }
  return (data as unknown as ApiEnvelope<T> & { ok: true }).result;
}

export async function postApi<K extends ApiName>(
  name: K,
  payload: unknown,
  signal?: AbortSignal,
): Promise<ApiResultMap[K]> {
  return postJson<ApiResultMap[K]>(API[name], payload, signal);
}
