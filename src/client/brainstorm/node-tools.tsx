import React from 'react';

import type { BrainstormNode, Translate } from '../../shared/types.js';
import { Button } from '../ui/button.js';

export interface NodeToolsProps {
  node: BrainstormNode;
  nodes: BrainstormNode[];
  t: Translate;
  locked?: boolean;
  /** Pixel offset from node left for horizontal center (e.g. free-group frame midline). */
  anchorLeft?: number;
  onStartInterview: (node: BrainstormNode) => void;
  onStartDiverge: (node: BrainstormNode) => void;
}

function parentOf(nodes: BrainstormNode[], node: BrainstormNode): BrainstormNode | undefined {
  if (!node.parentId) return undefined;
  return nodes.find((item) => item.id === node.parentId);
}

export function NodeTools({
  node,
  nodes,
  t,
  locked = false,
  anchorLeft,
  onStartInterview,
  onStartDiverge,
}: NodeToolsProps) {
  if (locked) return null;
  if (node.kind === 'interview') return null;

  const toolsStyle =
    typeof anchorLeft === 'number' && Number.isFinite(anchorLeft)
      ? ({ left: anchorLeft } as React.CSSProperties)
      : undefined;

  // Free-group title: interview only (diverge / research stay per-card / later).
  if (node.kind === 'group') {
    return (
      <div
        className="bn-tools"
        style={toolsStyle}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="xs"
          className="bn-toolButton bn-toolPrimary"
          onClick={() => onStartInterview(node)}
        >
          {t('brainstorm.startInterview')}
        </Button>
      </div>
    );
  }

  // Members inside a free group: no explore toolbar (group is the context).
  if (parentOf(nodes, node)?.kind === 'group') return null;

  // Free cards: interview + diverge only (outline follows interview, not the card toolbar).
  const canExplore = node.kind === 'idea' || node.kind === 'intent' || node.kind === 'statement';
  if (!canExplore) return null;
  return (
    <div className="bn-tools" style={toolsStyle} onPointerDown={(event) => event.stopPropagation()}>
      <Button
        variant="ghost"
        size="xs"
        className="bn-toolButton bn-toolPrimary"
        onClick={() => onStartInterview(node)}
      >
        {t('brainstorm.startInterview')}
      </Button>
      <Button
        variant="ghost"
        size="xs"
        className="bn-toolButton bn-toolPrimary"
        onClick={() => onStartDiverge(node)}
      >
        {t('brainstorm.startDiverge')}
      </Button>
    </div>
  );
}
