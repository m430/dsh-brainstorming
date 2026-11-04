import type { ResearchResult } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeResearch, readText } from '../parse.js';
import { formatPathForPrompt, readPath } from '../path-context.js';
import { BRAINSTORM_RESEARCH_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

export async function researchIdea(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<ResearchResult> {
  const input = asRecord(body);
  const idea = readText(input.idea, 6000);
  if (idea === '') throw userError('缺少点子上下文。', 400);
  const path = readPath(body);
  const sourceOutline = asRecord(input.outline);
  const outlineTitle = readText(sourceOutline.title, 300) || '调研大纲';
  const outlinePoints = Array.isArray(sourceOutline.points)
    ? sourceOutline.points.slice(0, 12).map((item) => readText(item, 500)).filter((item) => item !== '')
    : [];
  if (outlinePoints.length === 0) throw userError('调研大纲为空，请先确认大纲。', 400);
  const userText = [
    `点子：${idea}`,
    '',
    '用户已经做出的选择（按顺序）：',
    formatPathForPrompt(path),
    '',
    `已确认的调研大纲：${outlineTitle}`,
    outlinePoints.map((item) => `- ${item}`).join('\n'),
    '',
    '请严格按照这份大纲执行调研分析，一次性给出完整结果。只输出 JSON。',
  ].join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_RESEARCH_SYSTEM, userText, signal);
  const parsed = normalizeResearch(extractJson(response.text));
  return { ...parsed, model: response.model };
}
