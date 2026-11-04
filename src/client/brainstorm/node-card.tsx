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
  entering?: boolean;
  locked?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMeasure: (id: string, height: number) => void;
  onOption: (nodeId: string, optionId: string) => void;
  onRetry: (nodeId: string) => void;
  onStartInterview: (node: BrainstormNode) => void;
  onStartDiverge: (node: BrainstormNode) => void;
  onStartResearch: (node: BrainstormNode) => void;
  onConfirmOutline: (id: string) => void;
  onConfirmStatement?: (id: string) => void;
  onContinueClarify?: (id: string) => void;
  onAddComment?: (id: string, comment: string) => void;
  onReviseResult?: (node: BrainstormNode) => void;
  onUpdateNode: (id: string, patch: NodePatch) => void;
  onAnswer: (id: string, answer: string) => void;
  autoEdit: boolean;
  onAutoEditHandled?: () => void;
  onDiscard?: (id: string) => void;
  /** When true, card is a CSS-grid item (no absolute left/top; drag disabled). */
  gridItem?: boolean;
}

export function NodeCard(props: NodeCardProps) {
  const {
    node,
    t,
    selected,
    zoom,
    entering,
    locked = false,
    onSelect,
    onMove,
    onMeasure,
    onOption,
    onRetry,
    onStartInterview,
    onStartDiverge,
    onStartResearch,
    onConfirmOutline,
    onConfirmStatement,
    onContinueClarify,
    onAddComment,
    onReviseResult,
    onUpdateNode,
    onAnswer,
    autoEdit,
    onAutoEditHandled,
    onDiscard,
    gridItem = false,
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
    locked: locked || gridItem, // grid items stay in CSS grid — no free drag
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
    if (!autoEdit || locked) return;
    setEditing(true);
    onAutoEditHandled?.();
  }, [autoEdit, locked, onAutoEditHandled]);

  React.useEffect(() => {
    if (locked && editing) setEditing(false);
  }, [locked, editing]);

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
  }, [
    node.id,
    node.content,
    node.answer,
    node.options.length,
    node.points.length,
    node.status,
    editing,
    onMeasure,
  ]);

  const width =
    node.kind === 'interview'
      ? node.width || undefined
      : gridItem
        ? undefined
        : node.width || 320;

  return (
    <article
      className={`bn-nodeWrap${selected ? ' bn-selected' : ''}${dragging ? ' bn-dragging' : ''}${entering ? ' bn-enter' : ''}${locked ? ' bn-locked' : ''}${node.kind === 'interview' ? ' bn-wrap-interview' : ''}${gridItem ? ' bn-gridItem' : ''}`}
      style={
        gridItem
          ? undefined
          : {
              left: node.x,
              top: node.y,
              ...(width !== undefined ? { width } : { width: 'max-content' }),
            }
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={(event) => {
        if (locked || node.kind === 'interview') return;
        if (isInsideInteractiveElement(event.target)) return;
        event.stopPropagation();
        setEditing(true);
      }}
      data-node-id={node.id}
      title={locked ? t('brainstorm.nodeLocked') : undefined}
    >
      <div ref={cardRef} className={`bn-card bn-kind-${node.kind}`}>
        {selected && !editing && !locked ? (
          <NodeTools
            node={node}
            t={t}
            locked={locked}
            onStartInterview={onStartInterview}
            onStartDiverge={onStartDiverge}
            onStartResearch={onStartResearch}
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
          onConfirmStatement={onConfirmStatement}
          onContinueClarify={onContinueClarify}
          onAddComment={onAddComment}
          onReviseResult={onReviseResult}
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
