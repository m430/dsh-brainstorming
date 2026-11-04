import type { ExploreMode, IntentsResult } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeIntents, readText } from '../parse.js';
import { BRAINSTORM_INTENTS_DEEP_SYSTEM, BRAINSTORM_INTENTS_QUICK_SYSTEM } from '../prompts.js';
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
  const mode: ExploreMode = input.mode === 'quick' ? 'quick' : 'deep';
  const system = mode === 'quick' ? BRAINSTORM_INTENTS_QUICK_SYSTEM : BRAINSTORM_INTENTS_DEEP_SYSTEM;
  const userText = [
    `当前节点内容：${content || '（空）'}`,
    prompt === '' ? '' : `用户分析提示：${prompt}`,
    context === '' ? '' : `上下文：${context}`,
    `模式：${mode === 'quick' ? '速扩（短灵感）' : '深挖（有依据的方向）'}`,
    '',
    mode === 'quick'
      ? '请给出 2–3 条短灵感。只输出 JSON。'
      : '请给出 2–3 个建立在已确认陈述上的互斥方向。只输出 JSON。',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const response = await completeJson(ctx, config, system, userText, signal);
  const parsed = normalizeIntents(extractJson(response.text), 3);
  return { ...parsed, model: response.model };
}
