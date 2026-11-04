import type { TitleResult } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, isRecord, readText } from '../parse.js';
import { BRAINSTORM_TITLE_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

function normalizeTitle(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const title = raw.replace(/^["「『]|["」』]$/gu, '').trim();
  return title.slice(0, 40);
}

export async function summarizeTitle(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<TitleResult> {
  const input = asRecord(body);
  const content = readText(input.content, 4000);
  if (content === '') throw userError('没有可用于生成标题的内容。', 400);
  const userText = [
    `点子内容：${content}`,
    '',
    '请为这个头脑风暴画布生成一个简短标题。只输出 JSON。',
  ].join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_TITLE_SYSTEM, userText, signal);
  const parsed = extractJson(response.text);
  const record = isRecord(parsed) ? parsed : {};
  const title = normalizeTitle(record.title);
  if (title === '') throw new Error('模型没有给出可用的标题，请重试。');
  return { title, model: response.model };
}
