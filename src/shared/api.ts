/**
 * Shared HTTP API paths for Host registration and Client fetch.
 * Single source of truth — do not hardcode these paths elsewhere.
 */

import type { ApiName } from './types.js';

export const API_BASE = '/api/dsh-brainstorming/brainstorm';

export const API_PATHS = {
  expand: `${API_BASE}/expand`,
  intents: `${API_BASE}/intents`,
  questions: `${API_BASE}/questions`,
  outline: `${API_BASE}/outline`,
  research: `${API_BASE}/research`,
  modify: `${API_BASE}/modify`,
} as const satisfies Record<ApiName, string>;

export const API_ROUTE_NAMES = Object.keys(API_PATHS) as ApiName[];
