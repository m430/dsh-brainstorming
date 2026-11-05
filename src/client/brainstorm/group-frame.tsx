import React from 'react';

import type { BrainstormNode } from '../../shared/types.js';
import { freeGroupBounds } from './layout.js';
import type { NodeSizes } from './types.js';

export interface GroupFrameProps {
  group: BrainstormNode;
  nodes: BrainstormNode[];
  sizes: NodeSizes;
  selected?: boolean;
}

/** Durable freeform group chrome (title is a separate NodeCard like interview). */
export function GroupFrame({ group, nodes, sizes, selected = false }: GroupFrameProps) {
  const bounds = freeGroupBounds(nodes, sizes, group.id);
  if (!bounds) return null;
  return (
    <div
      className={`bn-freeGroup${selected ? ' bn-freeGroupSelected' : ''}`}
      style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }}
      data-group-id={group.id}
    />
  );
}
