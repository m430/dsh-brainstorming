import type { IntentsResult } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeIntents, readText } from '../parse.js';
import { BRAINSTORM_INTENTS_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

export async function analyzeIntents(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<IntentsResult> {
  const input = asRecord(body);
  const content = readText(input.content, 8000);
  const prompt = readText(input.prompt, 2000);
  if (content === '' && prompt === '') throw userError('当前节点没有内容，也没有提供分析提示。', 400);
  const context = readText(input.context, 8000);
  const userText = [
    `当前节点内容：${content || '（空）'}`,
    prompt === '' ? '' : `用户分析提示：${prompt}`,
    context === '' ? '' : `上下文：${context}`,
    '',
    '请分析当前节点，拆出 2–6 个不同的意图/方向。只输出 JSON。',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_INTENTS_SYSTEM, userText, signal);
  const parsed = normalizeIntents(extractJson(response.text));
  return { ...parsed, model: response.model };
}
