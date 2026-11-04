/**
 * 头脑风暴插件 · Host 端。
 *
 * 职责：
 * 1. 头脑风暴画布的 AI 追问、调研大纲、调研分析、节点修改；
 * 2. 统一调用 Harness 当前默认模型，并对模型输出做容错解析。
 */
const ENDPOINT_BRAINSTORM = '/api/dsh-brainstorming';

export const inject = ['llm', 'agentDefaultModel', 'connection'];

const BRAINSTORM_EXPAND_SYSTEM = [
  '你是产品头脑风暴助手。用户刚提出一个点子。你的任务不是马上下结论，而是先帮用户确认方向。',
  '',
  '请只输出一个 JSON 对象，不要 Markdown 代码围栏或解释：',
  '{"question":"一句最关键的追问","options":[{"id":"A","label":"选项标签","description":"一句话说明取舍"}]}',
  '',
  '规则：',
  '- 提出 1 个最关键的追问，帮助把方向缩小到可验证的范围。',
  '- 给出 2–4 个互斥、具体、可执行的选项，覆盖不同方向；不要只是换措辞。',
  '- 选项标签不超过 24 个字，description 用一句话说明这个方向的取舍或风险。',
  '- 使用简体中文。不虚构数据；不确定的地方写「待确认」。',
].join('\n');

const BRAINSTORM_OUTLINE_SYSTEM = [
  '你是产品调研策划助手。根据用户的点子和已经选择的方向，先给出一个可执行的调研大纲，不要直接下结论。',
  '',
  '请只输出一个 JSON 对象：',
  '{"title":"调研大纲标题","points":["大纲条目1","大纲条目2"]}',
  '',
  '规则：',
  '- points 写 5–8 条，按顺序覆盖：调研目标、关键问题、信息源/方法、样本或范围、输出物、风险与未知项。',
  '- 每条一句话，具体到可以照着执行；不要写空泛的「深入分析」。',
  '- 这是给用户确认或二次修改的大纲，不是最终结论。',
  '- 使用简体中文，不虚构数据；不确定处写「待确认」。',
].join('\n');

const BRAINSTORM_RESEARCH_SYSTEM = [
  '你是产品调研分析助手。用户已经确认了调研大纲，请严格按照大纲执行调研分析并产出结论。',
  '',
  '请只输出一个 JSON 对象：',
  '{"result":{"title":"结果标题","points":["发现1","发现2","发现3"]}}',
  '',
  '规则：',
  '- result.title 用一句话概括本次调研结论。',
  '- result.points 写 4–8 条，按大纲的结构给出发现、证据、关键假设、风险或下一步动作。',
  '- 不虚构具体数据、竞品事实或用户调研结论；没有证据的内容写成「假设：」或「待确认」。',
  '- 不是逐条追问用户，而是一次性给出基于大纲的完整调研结果。',
  '- 使用简体中文，语言简练。',
].join('\n');

const BRAINSTORM_QUESTIONS_SYSTEM = [
  '你是产品思考教练。请先分析给定节点的内容，找出其中最关键、但尚未明确的假设、取舍、风险或验证点，然后提出 3–5 个高质量问题，推动用户把想法想得更深。',
  '',
  '请只输出一个 JSON 对象：',
  '{"questions":[{"question":"问题","why":"为什么这个问题重要"}]}',
  '',
  '规则：',
  '- 问题必须针对节点内容中的具体内容，不要泛泛而问。',
  '- 优先问能改变方向或暴露关键假设的问题，而不是让用户补充背景。',
  '- 每个问题一句话；why 一句话说明它为什么重要。',
  '- 问题要能由用户用自然语言回答，不要求选择项。',
  '- 使用简体中文；不虚构数据。',
].join('\n');

const BRAINSTORM_INTENTS_SYSTEM = [
  '你是产品头脑风暴助手。请分析给定节点的内容，拆出 2–6 个不同且互不重复的意图/方向。',
  '',
  '请只输出一个 JSON 对象：',
  '{"intents":[{"label":"意图名称","detail":"一句话说明这个意图要解决什么"}]}',
  '',
  '规则：',
  '- 每个意图必须来自节点内容本身，不是泛泛的建议。',
  '- 意图之间要互斥或明显不同，避免换措辞重复。',
  '- label 不超过 20 个字；detail 一句话，具体可执行。',
  '- 不虚构数据；不确定处写「待确认」。',
  '- 使用简体中文。',
].join('\n');

const BRAINSTORM_MODIFY_SYSTEM = [
  '你是产品头脑风暴助手。请根据用户指令整体替换一个画布节点的内容。',
  '',
  '如果节点类型是 question（AI 追问），只输出：',
  '{"question":"修改后的追问问题","options":[{"id":"A","label":"新选项","description":"取舍或风险"}]}',
  '要求：',
  '- question 只写提问本身，不要把 A/B/C 等选项编号或选项内容写进 question 文本。',
  '- options 必须给 2–4 个新的、互斥的可选项，用来整体替换原选项。',
  '',
  '如果节点类型是 idea（点子）、result（调研结果）或 outline（调研大纲），只输出：',
  '{"title":"节点标题","content":"节点正文","points":["可选要点"]}',
  '要求：',
  '- content 是整体替换后的正文；points 只在 result 或 outline 节点使用，其它节点返回空数组。',
  '',
  '通用规则：',
  '- 保持原节点的类型和表达目的，不要解释，不要增加无关内容。',
  '- 使用简体中文，语言简练直接。',
].join('\n');

function resolveConfig(config) {
  const value = config ?? {};
  const provider = typeof value.provider === 'string' && value.provider.trim() !== '' ? value.provider.trim() : undefined;
  const model = typeof value.model === 'string' && value.model.trim() !== '' ? value.model.trim() : undefined;
  return {
    provider: provider && model ? provider : undefined,
    model: provider && model ? model : undefined,
    timeoutMs: Number.isInteger(value.timeoutMs) ? value.timeoutMs : 120000,
    maxOutputTokens: Number.isInteger(value.maxOutputTokens) ? value.maxOutputTokens : 1800,
  };
}

/** 解析当前模型路由：配置优先，否则使用 Harness 的默认模型。 */
function resolveRoute(ctx, config) {
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

function readText(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

/** 从模型文本中抽取第一个完整 JSON 对象，容忍代码围栏与前后说明。 */
function extractJson(text) {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    // 继续尝试从任意位置截取 JSON 对象。
  }
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function asSentence(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function asList(value, limit) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item !== '')
      .slice(0, limit);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|；|;/u)
      .map((item) => item.trim().replace(/^[-*·]\s*/u, ''))
      .filter((item) => item !== '')
      .slice(0, limit);
  }
  return [];
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];
  const options = [];
  for (const item of value) {
    if (options.length >= 4) break;
    let label = '';
    let description = '';
    if (typeof item === 'string') {
      label = item.trim();
    } else if (item !== null && typeof item === 'object') {
      label = asSentence(item.label ?? item.title ?? item.text);
      description = asSentence(item.description ?? item.detail ?? '');
    }
    if (label === '') continue;
    options.push({
      id: String.fromCharCode(65 + options.length),
      label: label.slice(0, 60),
      description: description.slice(0, 160),
    });
  }
  return options;
}

function normalizeExpand(value) {
  const question = asSentence(value?.question);
  const options = normalizeOptions(value?.options);
  if (question === '' || options.length < 2) {
    throw new Error('模型没有给出有效的追问或选项，请重试。');
  }
  return { question, options };
}

function normalizeOutline(value) {
  const title = asSentence(value?.title) || '调研大纲';
  const points = asList(value?.points, 10);
  if (points.length < 2) {
    throw new Error('模型没有给出有效的调研大纲，请重试。');
  }
  return { title, points };
}

function normalizeResearch(value) {
  const rawResult = value?.result ?? value?.results?.[0] ?? value;
  const title = asSentence(rawResult?.title) || '调研结果';
  const points = asList(rawResult?.points ?? rawResult?.content ?? rawResult?.findings, 10);
  if (points.length === 0) {
    throw new Error('调研结果为空，请重试。');
  }
  return { result: { title, points } };
}

function normalizeQuestions(value) {
  const raw = value?.questions ?? value?.items ?? value?.results;
  const list = Array.isArray(raw) ? raw : [];
  const questions = [];
  for (const item of list) {
    if (questions.length >= 5) break;
    let question = '';
    let why = '';
    if (typeof item === 'string') {
      question = item.trim();
    } else if (item !== null && typeof item === 'object') {
      question = asSentence(item.question ?? item.title ?? item.text ?? item.label);
      why = asSentence(item.why ?? item.reason ?? item.detail);
    }
    if (question === '') continue;
    questions.push({ question, why });
  }
  if (questions.length === 0) throw new Error('模型没有给出可用的问题，请重试。');
  return { questions };
}

function normalizeIntents(value) {
  const raw = value?.intents ?? value?.results ?? value?.items;
  const list = Array.isArray(raw) ? raw : [];
  const intents = [];
  for (const item of list) {
    if (intents.length >= 6) break;
    let label = '';
    let detail = '';
    if (typeof item === 'string') {
      label = item.trim();
    } else if (item !== null && typeof item === 'object') {
      label = asSentence(item.label ?? item.title ?? item.intent ?? item.name);
      detail = asSentence(item.detail ?? item.description ?? item.content);
    }
    if (label === '' && detail === '') continue;
    intents.push({ label: label || '意图', detail });
  }
  if (intents.length === 0) throw new Error('模型没有给出可用的意图，请重试。');
  return { intents };
}

function normalizeModify(value, kind) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('模型没有返回可用的修改结果。');
  }
  if (kind === 'question') {
    const question = asSentence(value.question ?? value.content);
    const options = normalizeOptions(value.options);
    if (question === '' || options.length < 2) {
      throw new Error('模型没有给出新的追问选项，请重试。');
    }
    return { question, options };
  }
  const title = asSentence(value.title);
  const content = asSentence(value.content);
  const points = asList(value.points, 8);
  if (title === '' && content === '' && points.length === 0) {
    throw new Error('模型没有返回可用的修改结果。');
  }
  return { title, content, points };
}

/** 调用当前模型，返回原始文本与所用模型。 */
async function completeJson(ctx, config, system, userText, signal) {
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
  const options = {
    ...prepared.config,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: userText }],
      },
    ],
    system,
    signal,
  };
  let output = '';
  let finish;
  for await (const chunk of prepared.stream(options)) {
    if (chunk.type === 'text-delta') {
      output += chunk.text;
    } else if (chunk.type === 'block-end' && chunk.block?.type === 'text' && output === '') {
      output += chunk.block.text;
    } else if (chunk.type === 'finish') {
      finish = chunk.reason;
    }
  }
  if (finish?.kind === 'error' || finish?.kind === 'aborted') {
    throw new Error(finish.failure?.message || '模型调用失败。');
  }
  const trimmed = output.trim();
  if (trimmed === '') throw new Error('模型没有返回内容。');
  return { text: trimmed, model: route.model };
}

function formatPathForPrompt(path) {
  if (!Array.isArray(path) || path.length === 0) return '（还没有做出选择）';
  return path
    .map((item, index) => `${index + 1}. 追问：${item.question}\n   用户选择：${item.choice}`)
    .join('\n');
}

async function expandIdea(ctx, config, body, signal) {
  const idea = readText(body?.idea, 6000);
  if (idea === '') throw userError('请先输入点子。', 400);
  const context = readText(body?.context, 6000);
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

function readPath(body) {
  return Array.isArray(body?.path)
    ? body.path
        .slice(0, 12)
        .map((item) => ({
          question: readText(item?.question, 1000),
          choice: readText(item?.choice, 500),
        }))
        .filter((item) => item.question !== '' && item.choice !== '')
    : [];
}

async function outlineIdea(ctx, config, body, signal) {
  const idea = readText(body?.idea, 6000);
  if (idea === '') throw userError('缺少点子上下文。', 400);
  const path = readPath(body);
  const context = readText(body?.context, 6000);
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

async function researchIdea(ctx, config, body, signal) {
  const idea = readText(body?.idea, 6000);
  if (idea === '') throw userError('缺少点子上下文。', 400);
  const path = readPath(body);
  const sourceOutline = body?.outline ?? {};
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

async function askQuestions(ctx, config, body, signal) {
  const content = readText(body?.content, 8000);
  if (content === '') throw userError('当前节点没有内容。', 400);
  const context = readText(body?.context, 8000);
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

async function analyzeIntents(ctx, config, body, signal) {
  const content = readText(body?.content, 8000);
  const prompt = readText(body?.prompt, 2000);
  if (content === '' && prompt === '') throw userError('当前节点没有内容，也没有提供分析提示。', 400);
  const context = readText(body?.context, 8000);
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

async function modifyNode(ctx, config, body, signal) {
  const instruction = readText(body?.instruction, 3000);
  if (instruction === '') throw userError('请先输入修改指令。', 400);
  const source = body?.node ?? {};
  const kind = ['idea', 'question', 'result', 'outline'].includes(source.kind) ? source.kind : 'result';
  const node = {
    kind,
    title: readText(source.title, 300),
    content: readText(source.content, 8000),
    points: Array.isArray(source.points) ? source.points.slice(0, 10).map((item) => readText(item, 500)).filter(Boolean) : [],
  };
  const context = readText(body?.context, 8000);
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
  return { ...parsed, model: response.model };
}

function userError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function makeRouteHandler(ctx, config, run) {
  return async (request) => {
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: '仅支持 POST 请求。' }, 405);
    }
    const startedAt = Date.now();
    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: '请求体不是合法 JSON。' }, 400);
      }
      const result = await run(ctx, config, body, AbortSignal.timeout(config.timeoutMs));
      return jsonResponse({ ok: true, result: { ...result, elapsedMs: Date.now() - startedAt } });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message =
        name === 'TimeoutError' || /aborted|timeout/iu.test(rawMessage)
          ? '分析超时，请缩短内容或稍后重试。'
          : rawMessage;
      ctx.logger?.warn?.(`dsh-brainstorming: ${rawMessage}`);
      const status = error && typeof error.status === 'number' ? error.status : 500;
      return jsonResponse({ ok: false, error: message }, status);
    }
  };
}

/**
 * 注册分析接口。走 `ctx.connection.fetch`，由 Connection 的统一 /api 通道完成
 * Host/Origin 与浏览器会话鉴权，避免额外暴露未鉴权的本机端口。
 * @param ctx - Cordis 上下文（llm / agentDefaultModel / connection）。
 * @param config - 插件配置。
 */
export function apply(ctx, config) {
  const resolved = resolveConfig(config);
  const routes = [
    { path: `${ENDPOINT_BRAINSTORM}/expand`, run: expandIdea },
    { path: `${ENDPOINT_BRAINSTORM}/intents`, run: analyzeIntents },
    { path: `${ENDPOINT_BRAINSTORM}/questions`, run: askQuestions },
    { path: `${ENDPOINT_BRAINSTORM}/outline`, run: outlineIdea },
    { path: `${ENDPOINT_BRAINSTORM}/research`, run: researchIdea },
    { path: `${ENDPOINT_BRAINSTORM}/modify`, run: modifyNode },
  ];
  for (const route of routes) {
    ctx.effect(
      () =>
        ctx.connection.fetch.register({
          path: route.path,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: makeRouteHandler(ctx, resolved, route.run),
        }),
      `dsh-brainstorming: ${route.path}`,
    );
  }
}
