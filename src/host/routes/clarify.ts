import type { ClarifyResult, ClarifyTurn } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeClarify, readText } from '../parse.js';
import { BRAINSTORM_CLARIFY_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

const MAX_ROUNDS = 6;

function readPrior(value: unknown): ClarifyTurn[] {
  if (!Array.isArray(value)) return [];
  const prior: ClarifyTurn[] = [];
  for (const item of value) {
    if (prior.length >= MAX_ROUNDS) break;
    const row = asRecord(item);
    const question = readText(row.question, 500);
    const answer = readText(row.answer, 2000);
    if (question === '' && answer === '') continue;
    prior.push({ question, answer });
  }
  return prior;
}

export async function clarifyIntent(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<ClarifyResult> {
  const input = asRecord(body);
  const content = readText(input.content, 8000);
  const prompt = readText(input.prompt, 2000);
  if (content === '' && prompt === '') throw userError('当前节点没有内容，无法开始澄清。', 400);
  const context = readText(input.context, 8000);
  const prior = readPrior(input.prior);
  const round = typeof input.round === 'number' && input.round > 0 ? Math.floor(input.round) : prior.length + 1;
  if (round > MAX_ROUNDS) {
    return { done: true, model: 'local-rule' };
  }
  const priorText =
    prior.length === 0
      ? '（尚无问答）'
      : prior.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n');
  const userText = [
    `当前点子：${content || '（空）'}`,
    prompt === '' ? '' : `用户补充要求：${prompt}`,
    context === '' ? '' : `上下文：${context}`,
    `当前轮次：${round}/${MAX_ROUNDS}`,
    '已有澄清问答：',
    priorText,
    '',
    '请给出下一轮澄清追问，或在足够清晰时设 done=true。只输出 JSON。',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_CLARIFY_SYSTEM, userText, signal);
  const parsed = normalizeClarify(extractJson(response.text));
  if (parsed.done || round >= MAX_ROUNDS) {
    return { done: true, model: response.model };
  }
  return {
    done: false,
    question: parsed.question,
    options: parsed.options,
    model: response.model,
  };
}
