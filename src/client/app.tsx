import React from 'react';

import type { Translate } from '../shared/types.js';
import { BrainstormWorkspace } from './brainstorm/workspace.js';

export interface BrainstormingWorkspaceProps {
  t?: Translate;
}

export function BrainstormingWorkspace(props: BrainstormingWorkspaceProps) {
  const t: Translate = typeof props.t === 'function' ? props.t : (key) => key;
  return <BrainstormWorkspace t={t} />;
}
