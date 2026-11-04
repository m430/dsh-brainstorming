import React from 'react';
import { BrainstormWorkspace } from './brainstorm/workspace.jsx';

export function BrainstormingWorkspace(props) {
  const t = typeof props.t === 'function' ? props.t : (key) => key;
  return <BrainstormWorkspace t={t} />;
}
