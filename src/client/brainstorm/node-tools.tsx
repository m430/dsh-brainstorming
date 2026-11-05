import React from 'react';

import type { BrainstormNode, Translate } from '../../shared/types.js';
import { Button } from '../ui/button.js';

export interface NodeToolsProps {
  node: BrainstormNode;
  t: Translate;
  locked?: boolean;
  onStartInterview: (node: BrainstormNode) => void;
  onStartDiverge: (node: BrainstormNode) => void;
  onStartResearch: (node: BrainstormNode) => void;
}

export function NodeTools({
  node,
  t,
  locked = false,
  onStartInterview,
  onStartDiverge,
  onStartResearch,
}: NodeToolsProps) {
  if (locked) return null;
  // Free groups / interview chrome — no toolbar actions on the title row.
  if (node.kind === 'group' || node.kind === 'interview') return null;
  const canExplore = node.kind === 'idea' || node.kind === 'intent' || node.kind === 'statement';
  const canResearch = node.kind !== 'outline' && node.kind !== 'question';
  if (!canExplore && !canResearch) return null;
  return (
    <div className="bn-tools" onPointerDown={(event) => event.stopPropagation()}>
      {canExplore ? (
        <>
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
        </>
      ) : null}
      {canResearch ? (
        <Button
          variant="ghost"
          size="xs"
          className="bn-toolButton bn-toolPrimary"
          onClick={() => onStartResearch(node)}
        >
          {t('brainstorm.startOutline')}
        </Button>
      ) : null}
    </div>
  );
}
