/**
 * Shared HTTP API paths for Host registration and Client fetch.
 * Single source of truth — do not hardcode these paths elsewhere.
 *
 * Note: DSH connection.fetch only allows GET | HEAD | POST, so board
 * mutations use POST endpoints rather than PUT/PATCH/DELETE.
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
  title: `${API_BASE}/title`,
  clarify: `${API_BASE}/clarify`,
  statement: `${API_BASE}/statement`,
} as const satisfies Record<ApiName, string>;

export const BOARD_API_PATHS = {
  list: `${API_BASE}/boards`,
  item: `${API_BASE}/boards/item`,
  create: `${API_BASE}/boards`,
  update: `${API_BASE}/boards/update`,
  delete: `${API_BASE}/boards/delete`,
} as const;

/** Plugin self-update (Host checks npm; Client prompts on board list). */
export const UPDATE_API_PATHS = {
  status: `${API_BASE}/update/status`,
  apply: `${API_BASE}/update/apply`,
} as const;

export const API_ROUTE_NAMES = Object.keys(API_PATHS) as ApiName[];
