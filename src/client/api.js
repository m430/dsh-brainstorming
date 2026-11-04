export const API = {
  expand: '/api/dsh-brainstorming/brainstorm/expand',
  intents: '/api/dsh-brainstorming/brainstorm/intents',
  questions: '/api/dsh-brainstorming/brainstorm/questions',
  outline: '/api/dsh-brainstorming/brainstorm/outline',
  research: '/api/dsh-brainstorming/brainstorm/research',
  modify: '/api/dsh-brainstorming/brainstorm/modify',
};

export async function postJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('登录状态已失效，请刷新页面后重试。');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`接口返回非 JSON（HTTP ${response.status}）。`);
  }
  if (!response.ok || !data || data.ok !== true) {
    throw new Error(data && data.error ? data.error : `请求失败（HTTP ${response.status}）。`);
  }
  return data.result;
}
