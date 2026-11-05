import { PACKAGE_NAME, VERSION_PATTERN } from './constants.js';

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

function normalizeRegistryBase(registry: string): string {
  return registry.replace(/\/+$/u, '');
}

/**
 * Fetch the `latest` dist-tag version for this package only.
 * Never returns description / README — only a validated version string.
 */
export async function fetchLatestVersion(
  registry: string,
  fetchTimeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${normalizeRegistryBase(registry)}/${encodeURIComponent(PACKAGE_NAME)}/latest`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new RegistryError(`registry HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new RegistryError('registry response is not an object');
    }
    const version = (data as { version?: unknown }).version;
    if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
      throw new RegistryError('registry version missing or invalid');
    }
    return version;
  } catch (error) {
    if (error instanceof RegistryError) throw error;
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      throw new RegistryError('registry request timed out');
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new RegistryError(message || 'registry request failed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
