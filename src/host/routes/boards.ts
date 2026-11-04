import type { Domain } from '@deepseek-ai/dsh-storage-domain';

import type { Board, BoardPatch } from '../../shared/types.js';
import {
  applyBoardPatch,
  persistableBoard,
  toBoardSummary,
  type BoardRecord,
  type BrainstormDomain,
} from '../domain/brainstorm.js';
import { jsonResponse, userError } from '../http.js';

type OpenedBrainstorm = Domain<BrainstormDomain>;

function boardsTable(domain: OpenedBrainstorm) {
  return domain.table('boards');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readId(value: unknown): string {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  throw userError('缺少画布 id。', 400);
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw userError('请求体不是合法 JSON。', 400);
  }
}

function statusErrorResponse(error: unknown): Response | null {
  if (error && typeof (error as { status?: unknown }).status === 'number') {
    return jsonResponse({ ok: false, error: (error as Error).message }, (error as { status: number }).status);
  }
  return null;
}

function mapDomainError(error: unknown): Response {
  // Storage-domain may be provided by a different installed copy than the one
  // this plugin imports (linked dev installs, multiple profile versions), so
  // match its stable error code instead of relying on `instanceof`.
  if (isRecord(error) && error.code === 'missing-key') {
    return jsonResponse({ ok: false, error: '画布不存在。' }, 404);
  }
  const message = error instanceof Error ? error.message : String(error);
  return jsonResponse({ ok: false, error: message || '存储写入失败。' }, 500);
}

export function makeBoardsHandlers(getDomain: () => OpenedBrainstorm | null) {
  const requireDomain = (): OpenedBrainstorm => {
    const domain = getDomain();
    if (!domain) {
      throw userError('画布存储不可用（storageDomain 未就绪）。', 503);
    }
    return domain;
  };

  const list = async (_request: Request): Promise<Response> => {
    try {
      const table = boardsTable(requireDomain());
      const summaries = [...table.entries()]
        .map(([, board]) => toBoardSummary(board))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      return jsonResponse({ ok: true, result: summaries });
    } catch (error) {
      return statusErrorResponse(error) ?? mapDomainError(error);
    }
  };

  const getItem = async (request: Request): Promise<Response> => {
    try {
      const id = new URL(request.url).searchParams.get('id')?.trim();
      if (!id) throw userError('缺少画布 id。', 400);
      const board = boardsTable(requireDomain()).get(id);
      if (!board) throw userError('画布不存在。', 404);
      return jsonResponse({ ok: true, result: board });
    } catch (error) {
      return statusErrorResponse(error) ?? mapDomainError(error);
    }
  };

  const create = async (request: Request): Promise<Response> => {
    try {
      const body = await readJsonBody(request);
      const table = boardsTable(requireDomain());
      let record: BoardRecord;
      if (isRecord(body) && typeof body.id === 'string' && Array.isArray(body.nodes)) {
        record = persistableBoard(body as unknown as Board);
      } else {
        const title =
          isRecord(body) && typeof body.title === 'string' && body.title.trim() !== ''
            ? body.title.trim()
            : '头脑风暴';
        const now = Date.now();
        const id =
          isRecord(body) && typeof body.id === 'string' && body.id.trim() !== ''
            ? body.id.trim()
            : crypto.randomUUID();
        record = persistableBoard({
          id,
          title,
          createdAt: now,
          updatedAt: now,
          nodeCount: 0,
          rootIdea: '',
          nodes: [],
          pan: { x: 120, y: 100 },
          zoom: 1,
        });
      }
      if (table.get(record.id)) throw userError('画布已存在。', 409);
      await table.put(record.id, record);
      return jsonResponse({ ok: true, result: record }, 201);
    } catch (error) {
      return statusErrorResponse(error) ?? mapDomainError(error);
    }
  };

  const update = async (request: Request): Promise<Response> => {
    try {
      const body = await readJsonBody(request);
      if (!isRecord(body)) throw userError('请求体格式无效。', 400);
      const id = readId(body.id);
      const table = boardsTable(requireDomain());
      let next: BoardRecord;
      if (isRecord(body.board)) {
        next = persistableBoard({ ...(body.board as unknown as Board), id });
        await table.put(id, next);
      } else if (isRecord(body.patch)) {
        next = await table.update(id, (current) => applyBoardPatch(current, body.patch as BoardPatch));
      } else {
        const { id: _id, ...patch } = body;
        void _id;
        next = await table.update(id, (current) => applyBoardPatch(current, patch as BoardPatch));
      }
      return jsonResponse({ ok: true, result: next });
    } catch (error) {
      return statusErrorResponse(error) ?? mapDomainError(error);
    }
  };

  const remove = async (request: Request): Promise<Response> => {
    try {
      const body = await readJsonBody(request);
      if (!isRecord(body)) throw userError('请求体格式无效。', 400);
      const id = readId(body.id);
      const deleted = await boardsTable(requireDomain()).delete(id);
      if (!deleted) throw userError('画布不存在。', 404);
      return jsonResponse({ ok: true, result: { id } });
    } catch (error) {
      return statusErrorResponse(error) ?? mapDomainError(error);
    }
  };

  return { list, getItem, create, update, remove };
}
