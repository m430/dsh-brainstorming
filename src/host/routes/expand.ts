import type { ExpandResult } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeExpand, readText } from '../parse.js';
import { BRAINSTORM_EXPAND_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

export async function expandIdea(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<ExpandResult> {
  const input = asRecord(body);
  const idea = readText(input.idea, 6000);
  if (idea === '') throw userError('请先输入点子。', 400);
  const context = readText(input.context, 6000);
  const userText = [
    `点子：${idea}`,
    context === '' ? '' : `已有上下文：${context}`,
    '',
    '请提出一个最关键的追问，并给出 2–4 个互斥的方向选项。只输出 JSON。',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_EXPAND_SYSTEM, userText, signal);
  const parsed = normalizeExpand(extractJson(response.text));
  return { ...parsed, model: response.model };
}
