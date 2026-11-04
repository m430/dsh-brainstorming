import type {
  BrainstormOption,
  ExpandResult,
  IntentItem,
  IntentsResult,
  ModifyNodeResult,
  ModifyQuestionResult,
  NodeKind,
  OutlineResult,
  QuestionItem,
  QuestionsResult,
} from '../shared/types.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function readText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

/** 从模型文本中抽取第一个完整 JSON 对象，容忍代码围栏与前后说明。 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
  try {
    return JSON.parse(unfenced) as unknown;
  } catch {
    // 继续尝试从任意位置截取 JSON 对象。
  }
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(unfenced.slice(start, end + 1)) as unknown;
  } catch {
    return undefined;
  }
}

function asSentence(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function asList(value: unknown, limit: number): string[] {
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

export function normalizeOptions(value: unknown): BrainstormOption[] {
  if (!Array.isArray(value)) return [];
  const options: BrainstormOption[] = [];
  let recommendedIndex = -1;
  for (const raw of value) {
    if (options.length >= 4) break;
    let label = '';
    let description = '';
    let recommended = false;
    if (typeof raw === 'string') {
      label = raw.trim();
    } else if (isRecord(raw)) {
      label = asSentence(raw.label ?? raw.title ?? raw.text);
      description = asSentence(raw.description ?? raw.detail ?? '');
      recommended =
        raw.recommended === true ||
        raw.recommend === true ||
        raw.preferred === true ||
        /^推荐[:：]/u.test(description);
      if (recommended && description.startsWith('推荐')) {
        description = description.replace(/^推荐[:：]\s*/u, '');
      }
    }
    if (label === '') continue;
    if (recommended && recommendedIndex < 0) recommendedIndex = options.length;
    options.push({
      id: String.fromCharCode(65 + options.length),
      label: label.slice(0, 60),
      description: description.slice(0, 160),
      ...(recommended ? { recommended: true } : {}),
    });
  }
  if (recommendedIndex >= 0) {
    for (let index = 0; index < options.length; index += 1) {
      if (index === recommendedIndex) {
        options[index] = { ...options[index], recommended: true };
      } else if (options[index].recommended) {
        options[index] = {
          id: options[index].id,
          label: options[index].label,
          description: options[index].description,
        };
      }
    }
  }
  return options;
}

export function normalizeExpand(value: unknown): Pick<ExpandResult, 'question' | 'options'> {
  const record = asRecord(value);
  const question = asSentence(record.question);
  const options = normalizeOptions(record.options);
  if (question === '' || options.length < 2) {
    throw new Error('模型没有给出有效的追问或选项，请重试。');
  }
  return { question, options };
}

export function normalizeOutline(value: unknown): Pick<OutlineResult, 'title' | 'overview' | 'points'> {
  const record = asRecord(value);
  const title = asSentence(record.title) || '调研大纲';
  const overview = asSentence(record.overview ?? record.summary ?? record.intro ?? '');
  const points = asList(record.points, 10);
  if (points.length < 2) {
    throw new Error('模型没有给出有效的调研大纲，请重试。');
  }
  return { title, overview, points };
}

export function normalizeResearch(value: unknown): { result: { title: string; points: string[] } } {
  const outer = asRecord(value);
  const rawResult = outer.result ?? (Array.isArray(outer.results) ? outer.results[0] : undefined) ?? value;
  const record = asRecord(rawResult);
  const title = asSentence(record.title) || '调研结果';
  const points = asList(record.points ?? record.content ?? record.findings, 10);
  if (points.length === 0) {
    throw new Error('调研结果为空，请重试。');
  }
  return { result: { title, points } };
}

export function normalizeQuestions(value: unknown): Pick<QuestionsResult, 'questions'> {
  const record = asRecord(value);
  const raw = record.questions ?? record.items ?? record.results;
  const list = Array.isArray(raw) ? raw : [];
  const questions: QuestionItem[] = [];
  for (const item of list) {
    if (questions.length >= 5) break;
    let question = '';
    let why = '';
    if (typeof item === 'string') {
      question = item.trim();
    } else if (isRecord(item)) {
      question = asSentence(item.question ?? item.title ?? item.text ?? item.label);
      why = asSentence(item.why ?? item.reason ?? item.detail);
    }
    if (question === '') continue;
    questions.push({ question, why });
  }
  if (questions.length === 0) throw new Error('模型没有给出可用的问题，请重试。');
  return { questions };
}

export function normalizeIntents(value: unknown, max = 3): Pick<IntentsResult, 'intents'> {
  const record = asRecord(value);
  const raw = record.intents ?? record.results ?? record.items;
  const list = Array.isArray(raw) ? raw : [];
  const intents: IntentItem[] = [];
  for (const item of list) {
    if (intents.length >= max) break;
    let label = '';
    let detail = '';
    let rationale = '';
    if (typeof item === 'string') {
      label = item.trim();
    } else if (isRecord(item)) {
      label = asSentence(item.label ?? item.title ?? item.intent ?? item.name);
      detail = asSentence(item.detail ?? item.description ?? item.content);
      rationale = asSentence(item.rationale ?? item.because ?? item.evidence);
    }
    if (label === '' && detail === '') continue;
    intents.push({
      label: label || '意图',
      detail,
      ...(rationale ? { rationale } : {}),
    });
  }
  if (intents.length === 0) throw new Error('模型没有给出可用的意图，请重试。');
  return { intents };
}

export function normalizeClarify(value: unknown): { done: boolean; question: string; options: BrainstormOption[] } {
  const record = asRecord(value);
  const done = record.done === true || record.ready === true;
  if (done) return { done: true, question: '', options: [] };
  const question = asSentence(record.question ?? record.prompt ?? record.text);
  const options = normalizeOptions(record.options);
  if (question === '' || options.length < 2) {
    throw new Error('模型没有给出可用的澄清追问，请重试。');
  }
  return { done: false, question, options };
}

export function normalizeStatement(value: unknown): {
  title: string;
  goal: string;
  users: string;
  constraints: string[];
  nonGoals: string[];
} {
  const record = asRecord(value);
  const title = asSentence(record.title) || '问题陈述';
  const goal = asSentence(record.goal ?? record.objective ?? record.content);
  const users = asSentence(record.users ?? record.user ?? record.audience);
  const constraints = asList(record.constraints ?? record.constraint, 4);
  const nonGoals = asList(record.nonGoals ?? record.non_goals ?? record.outOfScope, 4);
  if (goal === '' && users === '' && constraints.length === 0) {
    throw new Error('模型没有给出可用的问题陈述，请重试。');
  }
  return { title, goal: goal || '待确认', users: users || '待确认', constraints, nonGoals };
}

export type NormalizedModify =
  | Pick<ModifyQuestionResult, 'question' | 'options'>
  | Pick<ModifyNodeResult, 'title' | 'content' | 'points'>;

export function normalizeModify(value: unknown, kind: NodeKind): NormalizedModify {
  if (!isRecord(value)) {
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
