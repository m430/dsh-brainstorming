/** Client-only structural types for the DSH Web plugin context. */

import type { ComponentType } from 'react';

import type { Translate } from '../shared/types.js';

export interface ClientLocaleService {
  register(namespace: string, locale: string, dict: Record<string, string>): () => void;
  bind(namespace: string): Translate;
}

export interface SlotRegistrationOptions {
  name: string;
  key?: string;
  id?: string;
  order?: number;
  locale?: string;
  label?: () => string;
}

export interface ClientSlotsService {
  inject(key: string, callback: () => () => void): () => void;
  register(options: SlotRegistrationOptions, component: ComponentType<any>): () => void;
}

export interface ClientContext {
  effect(callback: () => (() => void) | void, label?: string): void;
  locale: ClientLocaleService;
  slots: ClientSlotsService;
}
