import React from 'react';

import type { BrainstormNode, Translate } from '../../shared/types.js';
import { Button } from '../ui/button.js';

export interface NodeToolsProps {
  node: BrainstormNode;
  t: Translate;
  onAsk: (node: BrainstormNode) => void;
  onAnalyzeIntent: (node: BrainstormNode) => void;
  onStartOutline: (id: string) => void;
  onModify: (node: BrainstormNode) => void;
  onAddIdea: (node: BrainstormNode) => void;
  onDelete: (node: BrainstormNode) => void;
}

export function NodeTools({
  node,
  t,
  onAsk,
  onAnalyzeIntent,
  onStartOutline,
  onModify,
  onAddIdea,
  onDelete,
}: NodeToolsProps) {
  return (
    <div className="bn-tools" onPointerDown={(event) => event.stopPropagation()}>
      <Button variant="ghost" size="xs" className="bn-toolButton bn-toolPrimary" onClick={() => onAsk(node)}>
        {t('brainstorm.ask')}
      </Button>
      <Button variant="ghost" size="xs" className="bn-toolButton" onClick={() => onAnalyzeIntent(node)}>
        {t('brainstorm.analyzeIntent')}
      </Button>
      {node.kind !== 'outline' ? (
        <Button variant="ghost" size="xs" className="bn-toolButton bn-toolPrimary" onClick={() => onStartOutline(node.id)}>
          {t('brainstorm.startOutline')}
        </Button>
      ) : null}
      {node.kind !== 'outline' || !node.confirmed ? (
        <Button variant="ghost" size="xs" className="bn-toolButton" onClick={() => onModify(node)}>
          {t('brainstorm.modify')}
        </Button>
      ) : null}
      <Button variant="ghost" size="xs" className="bn-toolButton" onClick={() => onAddIdea(node)}>
        {t('brainstorm.addChildIdea')}
      </Button>
      <Button variant="ghost" size="xs" className="bn-toolButton bn-toolDanger" onClick={() => onDelete(node)}>
        {t('brainstorm.delete')}
      </Button>
    </div>
  );
}
