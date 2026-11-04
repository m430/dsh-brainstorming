import type { TranslateDict } from '../shared/types.js';

import enUi from '../../locale/ui-en.json';
import zhUi from '../../locale/ui-zh.json';

export const NS = 'dsh-brainstorming';

/** UI copy — single source lives in locale/ui-*.json (plugin meta stays in locale/{zh,en}.json). */
export const zh: TranslateDict = zhUi;
export const en: TranslateDict = enUi;
