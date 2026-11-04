import type { QuestionsResult } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeQuestions, readText } from '../parse.js';
import { BRAINSTORM_QUESTIONS_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

export async function askQuestions(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<QuestionsResult> {
  const input = asRecord(body);
  const content = readText(input.content, 8000);
  if (content === '') throw userError('当前节点没有内容。', 400);
  const context = readText(input.context, 8000);
  const userText = [
    `当前节点内容：${content}`,
    context === '' ? '' : `上下文：${context}`,
    '',
    '请分析当前节点，提炼 3–5 个能推进思考的高质量问题。只输出 JSON。',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_QUESTIONS_SYSTEM, userText, signal);
  const parsed = normalizeQuestions(extractJson(response.text));
  return { ...parsed, model: response.model };
}
