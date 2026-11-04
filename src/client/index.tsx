import React from 'react';

import { BrainstormingWorkspace } from './app.js';
import { BrainstormIcon } from './components.js';
import { NS, en, zh } from './locale.js';
import type { ClientContext } from './types.js';
import appCss from './styles.css';

const STYLE_ID = 'dsh-brainstorming/panel.css';

function installStyle(css: string, id: string): (() => void) | undefined {
  if (typeof document === 'undefined') return undefined;
  const selector = `style[data-plugin-css="${id}"]`;
  if (document.querySelector(selector) !== null) return undefined;
  const tag = document.createElement('style');
  tag.dataset.plugin = 'dsh-brainstorming';
  tag.dataset.pluginCss = id;
  tag.textContent = css;
  document.head.appendChild(tag);
  return () => tag.remove();
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => installStyle(appCss, `${STYLE_ID}/app`), 'dsh-brainstorming: app styles');
  ctx.effect(() => ctx.locale.register(NS, 'zh', zh), 'dsh-brainstorming: zh dictionary');
  ctx.effect(() => ctx.locale.register(NS, 'en', en), 'dsh-brainstorming: en dictionary');

  const t = ctx.locale.bind(NS);
  ctx.slots.inject('main', () =>
    ctx.slots.register({ name: 'main', key: 'dsh-brainstorming', locale: NS }, BrainstormingWorkspace),
  );
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: 'dsh-brainstorming', order: 20, locale: NS, label: () => t('panel.label') },
      BrainstormIcon,
    ),
  );
}

export const inject = ['slots', 'locale'];
