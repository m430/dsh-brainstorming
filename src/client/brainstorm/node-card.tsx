import React from 'react';

import type { BrainstormNode, Translate } from '../../shared/types.js';
import { Button } from '../ui/button.js';
import { NodeBody, NodeStatus, editsPoints } from './node-body.js';
import { NodeTools } from './node-tools.js';
import type { NodePatch } from './types.js';
import { isInsideInteractiveElement, useNodeDrag } from './use-node-drag.js';

export interface NodeCardProps {
  node: BrainstormNode;
  t: Translate;
  selected: boolean;
  zoom: number;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMeasure: (id: string, height: number) => void;
  onOption: (nodeId: string, optionId: string) => void;
  onRetry: (nodeId: string) => void;
  onAsk: (node: BrainstormNode) => void;
  onAnalyzeIntent: (node: BrainstormNode) => void;
  onStartOutline: (id: string) => void;
  onModify: (node: BrainstormNode) => void;
  onAddIdea: (node: BrainstormNode) => void;
  onDelete: (node: BrainstormNode) => void;
  onConfirmOutline: (id: string) => void;
  onUpdateNode: (id: string, patch: NodePatch) => void;
  onAnswer: (id: string, answer: string) => void;
  autoEdit: boolean;
  onAutoEditHandled?: () => void;
  onDiscard?: (id: string) => void;
}

export function NodeCard(props: NodeCardProps) {
  const {
    node,
    t,
    selected,
    zoom,
    onSelect,
    onMove,
    onMeasure,
    onOption,
    onRetry,
    onAsk,
    onAnalyzeIntent,
    onStartOutline,
    onModify,
    onAddIdea,
    onDelete,
    onConfirmOutline,
    onUpdateNode,
    onAnswer,
    autoEdit,
    onAutoEditHandled,
    onDiscard,
  } = props;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const { dragging, handlePointerDown, handlePointerMove, handlePointerUp } = useNodeDrag({
    nodeId: node.id,
    x: node.x,
    y: node.y,
    zoom,
    editing,
    onSelect,
    onMove,
  });

  React.useEffect(() => {
    if (!editing) return;
    setDraft(editsPoints(node) ? (node.points || []).join('\n') : node.content || '');
  }, [editing, node.id]);

  const cancelEdit = () => {
    setEditing(false);
    if (node.freeNode && (node.content || '').trim() === '') onDiscard?.(node.id);
  };

  React.useEffect(() => {
    if (!autoEdit) return;
    setEditing(true);
    onAutoEditHandled?.();
  }, [autoEdit, onAutoEditHandled]);

  React.useEffect(() => {
    if (!selected && editing) cancelEdit();
  }, [selected, editing]);

  React.useEffect(() => {
    const element = cardRef.current;
    if (!element) return undefined;
    const measure = () => {
      if (element.offsetHeight > 0) onMeasure(node.id, element.offsetHeight);
    };
    measure();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(element);
    }
    return () => {
      observer?.disconnect();
    };
  }, [node.id, node.content, node.options.length, node.points.length, editing, onMeasure]);

  return (
    <article
      className={`bn-nodeWrap${selected ? ' bn-selected' : ''}${dragging ? ' bn-dragging' : ''}`}
      style={{ left: node.x, top: node.y, width: node.width || 320 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={(event) => {
        if (isInsideInteractiveElement(event.target)) return;
        event.stopPropagation();
        setEditing(true);
      }}
      data-node-id={node.id}
    >
      <div ref={cardRef} className={`bn-card bn-kind-${node.kind}`}>
        {selected && !editing ? (
          <NodeTools
            node={node}
            t={t}
            onAsk={onAsk}
            onAnalyzeIntent={onAnalyzeIntent}
            onStartOutline={onStartOutline}
            onModify={onModify}
            onAddIdea={onAddIdea}
            onDelete={onDelete}
          />
        ) : null}
        <NodeBody
          node={node}
          t={t}
          editing={editing}
          setEditing={setEditing}
          onCancelEdit={cancelEdit}
          draft={draft}
          setDraft={setDraft}
          onUpdateNode={onUpdateNode}
          onAnswer={onAnswer}
          onOption={onOption}
          onConfirmOutline={onConfirmOutline}
        />
        <NodeStatus node={node} t={t} />
        {node.error ? (
          <div className="bn-error" role="alert">
            <span>{t('brainstorm.error')}：{node.error}</span>
            {node.retry ? (
              <Button variant="outline" size="xs" onClick={() => onRetry(node.id)}>
                {t('brainstorm.retry')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
