import { API_PATHS, BOARD_API_PATHS, UPDATE_API_PATHS } from '../shared/api.js';
import type {
  ApiEnvelope,
  ApiName,
  ApiResultMap,
  Board,
  BoardPatch,
  BoardSummary,
  UpdateApplyResult,
  UpdateStatus,
} from '../shared/types.js';

export const API = API_PATHS;
export const BOARDS_API = BOARD_API_PATHS;
export const UPDATE_API = UPDATE_API_PATHS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function parseEnvelope<T>(response: Response): Promise<T> {
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
  return parseEnvelope<T>(response);
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  });
  return parseEnvelope<T>(response);
}

export async function postApi<K extends ApiName>(
  name: K,
  payload: unknown,
  signal?: AbortSignal,
): Promise<ApiResultMap[K]> {
  return postJson<ApiResultMap[K]>(API[name], payload, signal);
}

export async function listBoards(signal?: AbortSignal): Promise<BoardSummary[]> {
  return getJson<BoardSummary[]>(BOARDS_API.list, signal);
}

export async function getBoard(id: string, signal?: AbortSignal): Promise<Board> {
  const url = `${BOARDS_API.item}?id=${encodeURIComponent(id)}`;
  return getJson<Board>(url, signal);
}

export async function createBoard(board: Board, signal?: AbortSignal): Promise<Board> {
  return postJson<Board>(BOARDS_API.create, board, signal);
}

export async function updateBoard(id: string, patch: BoardPatch, signal?: AbortSignal): Promise<Board> {
  return postJson<Board>(BOARDS_API.update, { id, patch }, signal);
}

export async function deleteBoard(id: string, signal?: AbortSignal): Promise<void> {
  await postJson<{ id: string }>(BOARDS_API.delete, { id }, signal);
}

export async function getUpdateStatus(signal?: AbortSignal): Promise<UpdateStatus> {
  return getJson<UpdateStatus>(UPDATE_API.status, signal);
}

/**
 * Apply returns `{ ok, result }` even on failure (HTTP 400) so the UI can show
 * Host's message; do not use parseEnvelope which throws on !ok.
 */
export async function applyUpdate(
  version?: string,
  signal?: AbortSignal,
): Promise<UpdateApplyResult> {
  const response = await fetch(UPDATE_API.apply, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(version ? { version } : {}),
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
  if (!isRecord(data) || !isRecord(data.result)) {
    const message = isRecord(data) && typeof data.error === 'string'
      ? data.error
      : `请求失败（HTTP ${response.status}）。`;
    throw new Error(message);
  }
  const result = data.result as unknown as UpdateApplyResult;
  if (typeof result.ok !== 'boolean') {
    throw new Error('升级接口返回格式异常。');
  }
  return result;
}
