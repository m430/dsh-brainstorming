import type {
  FinishReason,
  GenerateOptions,
  Message,
  MessageId,
  StreamChunk,
} from '@deepseek-ai/dsh-llm';

import type { ResolvedConfig } from './config.js';
import type { HostContext, ModelRoute } from './types.js';

/** 解析当前模型路由：配置优先，否则使用 Harness 的默认模型。 */
export function resolveRoute(ctx: HostContext, config: ResolvedConfig): ModelRoute {
  if (config.provider && config.model) {
    return { provider: config.provider, model: config.model };
  }
  const selection = ctx.agentDefaultModel.currentSelection();
  if (!selection || typeof selection.provider !== 'string' || typeof selection.model !== 'string') {
    throw new Error('当前没有可用的默认模型，请先在设置中选择模型。');
  }
  return {
    provider: selection.provider,
    model: selection.model,
    ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
  };
}

/** 调用当前模型，返回原始文本与所用模型。 */
export async function completeJson(
  ctx: HostContext,
  config: ResolvedConfig,
  system: string,
  userText: string,
  signal: AbortSignal,
): Promise<{ text: string; model: string }> {
  const route = resolveRoute(ctx, config);
  const prepared = await ctx.llm.prepareCall(
    {
      provider: route.provider,
      model: route.model,
      maxTokens: config.maxOutputTokens,
      ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
    },
    signal,
  );
  const message: Message = {
    id: `dsh-brainstorming-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` as MessageId,
    role: 'user',
    content: [{ type: 'text', text: userText }],
    source: { kind: 'user' },
  };
  const options: GenerateOptions = {
    ...prepared.config,
    messages: [message],
    system,
    signal,
  };
  let output = '';
  let finish: FinishReason | undefined;
  for await (const chunk of prepared.stream(options) as AsyncIterable<StreamChunk>) {
    if (chunk.type === 'text-delta') {
      output += chunk.text;
    } else if (chunk.type === 'block-end' && chunk.block?.type === 'text' && output === '') {
      output += chunk.block.text;
    } else if (chunk.type === 'finish') {
      finish = chunk.reason;
    }
  }
  if (finish && (finish.kind === 'error' || finish.kind === 'aborted')) {
    throw new Error(finish.failure?.message || '模型调用失败。');
  }
  const trimmed = output.trim();
  if (trimmed === '') throw new Error('模型没有返回内容。');
  return { text: trimmed, model: route.model };
}
