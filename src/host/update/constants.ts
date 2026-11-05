/** Fixed package identity — never accept caller-supplied package names. */
export const PACKAGE_NAME = 'dsh-brainstorming';

/** Registry / apply version strings must match this (same bound as dsh-update-notifier). */
export const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,64}$/;

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

export const DEFAULT_INTERVAL_MS = 300_000;
export const MIN_INTERVAL_MS = 60_000;
export const DEFAULT_INITIAL_DELAY_MS = 10_000;
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
