import {
  resolveUpdateCheckConfig,
  type UpdateCheckConfig,
} from './update/service.js';

export interface BrainstormConfig {
  provider?: string;
  model?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  updateCheck?: {
    enabled?: boolean;
    intervalMs?: number;
    initialDelayMs?: number;
    registry?: string;
    fetchTimeoutMs?: number;
  };
}

export interface ResolvedConfig {
  provider?: string;
  model?: string;
  timeoutMs: number;
  maxOutputTokens: number;
  updateCheck: UpdateCheckConfig;
}

export function resolveConfig(config: BrainstormConfig | undefined): ResolvedConfig {
  const value = config ?? {};
  const provider = typeof value.provider === 'string' && value.provider.trim() !== ''
    ? value.provider.trim()
    : undefined;
  const model = typeof value.model === 'string' && value.model.trim() !== ''
    ? value.model.trim()
    : undefined;
  return {
    provider: provider && model ? provider : undefined,
    model: provider && model ? model : undefined,
    timeoutMs: typeof value.timeoutMs === 'number' && Number.isInteger(value.timeoutMs) ? value.timeoutMs : 120000,
    maxOutputTokens: typeof value.maxOutputTokens === 'number' && Number.isInteger(value.maxOutputTokens)
      ? value.maxOutputTokens
      : 1800,
    updateCheck: resolveUpdateCheckConfig(value.updateCheck),
  };
}
