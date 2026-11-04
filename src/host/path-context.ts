import type { PathStep } from '../shared/types.js';

import { asRecord, readText } from './parse.js';

export function formatPathForPrompt(path: PathStep[]): string {
  if (!Array.isArray(path) || path.length === 0) return '（还没有做出选择）';
  return path
    .map((item, index) => `${index + 1}. 追问：${item.question}\n   用户选择：${item.choice}`)
    .join('\n');
}

export function readPath(body: unknown): PathStep[] {
  const path = asRecord(body).path;
  if (!Array.isArray(path)) return [];
  return path
    .slice(0, 12)
    .map((item) => {
      const record = asRecord(item);
      return {
        question: readText(record.question, 1000),
        choice: readText(record.choice, 500),
      };
    })
    .filter((item) => item.question !== '' && item.choice !== '');
}
