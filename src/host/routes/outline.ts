import type { OutlineResult } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeOutline, readText } from '../parse.js';
import { formatPathForPrompt, readPath } from '../path-context.js';
import { BRAINSTORM_OUTLINE_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

export async function outlineIdea(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<OutlineResult> {
  const input = asRecord(body);
  const idea = readText(input.idea, 6000);
  if (idea === '') throw userError('缺少点子上下文。', 400);
  const path = readPath(body);
  const context = readText(input.context, 6000);
  const userText = [
    `点子：${idea}`,
    '',
    '用户已经做出的选择（按顺序）：',
    formatPathForPrompt(path),
    context === '' ? '' : `已有上下文：${context}`,
    '',
    '请先给出一个可执行的调研大纲，供用户确认或修改。只输出 JSON。',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_OUTLINE_SYSTEM, userText, signal);
  const parsed = normalizeOutline(extractJson(response.text));
  return { ...parsed, model: response.model };
}
