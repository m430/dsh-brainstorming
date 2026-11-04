import type { ClarifyTurn, StatementResult } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeStatement, readText } from '../parse.js';
import { BRAINSTORM_STATEMENT_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

function readPrior(value: unknown): ClarifyTurn[] {
  if (!Array.isArray(value)) return [];
  const prior: ClarifyTurn[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const question = readText(row.question, 500);
    const answer = readText(row.answer, 2000);
    if (question === '' && answer === '') continue;
    prior.push({ question, answer });
  }
  return prior;
}

export async function buildStatement(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<StatementResult> {
  const input = asRecord(body);
  const content = readText(input.content, 8000);
  const prompt = readText(input.prompt, 2000);
  const context = readText(input.context, 8000);
  const prior = readPrior(input.prior);
  if (content === '' && prior.length === 0) throw userError('没有可用于汇总的点子或问答。', 400);
  const priorText =
    prior.length === 0
      ? '（无）'
      : prior.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n');
  const userText = [
    `点子：${content || '（空）'}`,
    prompt === '' ? '' : `用户补充要求：${prompt}`,
    context === '' ? '' : `上下文：${context}`,
    '澄清问答：',
    priorText,
    '',
    '请汇总可确认的问题陈述。只输出 JSON。',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_STATEMENT_SYSTEM, userText, signal);
  const parsed = normalizeStatement(extractJson(response.text));
  return { ...parsed, model: response.model };
}
