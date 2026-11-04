import type { ModifyResult, NodeKind } from '../../shared/types.js';
import type { ResolvedConfig } from '../config.js';
import { userError } from '../http.js';
import { completeJson } from '../llm.js';
import { asRecord, extractJson, normalizeModify, readText } from '../parse.js';
import { BRAINSTORM_MODIFY_SYSTEM } from '../prompts.js';
import type { HostContext } from '../types.js';

export async function modifyNode(
  ctx: HostContext,
  config: ResolvedConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<ModifyResult> {
  const input = asRecord(body);
  const instruction = readText(input.instruction, 3000);
  if (instruction === '') throw userError('请先输入修改指令。', 400);
  const source = asRecord(input.node);
  const requestedKind = source.kind;
  const kind: NodeKind =
    requestedKind === 'idea' || requestedKind === 'question' || requestedKind === 'result' || requestedKind === 'outline'
      ? requestedKind
      : 'result';
  const node = {
    kind,
    title: readText(source.title, 300),
    content: readText(source.content, 8000),
    points: Array.isArray(source.points)
      ? source.points.slice(0, 10).map((item) => readText(item, 500)).filter((item) => item !== '')
      : [],
  };
  const context = readText(input.context, 8000);
  const userText = [
    `节点类型：${kind}`,
    `节点标题：${node.title}`,
    `节点内容：${node.content}`,
    node.points.length > 0 ? `结果要点：\n${node.points.map((item) => `- ${item}`).join('\n')}` : '',
    context === '' ? '' : `上下文：${context}`,
    '',
    `用户修改指令：${instruction}`,
    '',
    '请只输出修改后的 JSON。',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const response = await completeJson(ctx, config, BRAINSTORM_MODIFY_SYSTEM, userText, signal);
  const parsed = normalizeModify(extractJson(response.text), kind);
  return { ...parsed, model: response.model } as ModifyResult;
}
