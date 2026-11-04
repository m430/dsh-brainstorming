import React from 'react';

import type { Board, BoardPatch, BrainstormNode, Translate } from '../../shared/types.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { BoardBackdrop } from './board-backdrop.js';
import { BrainstormModal } from './modal.js';
import { NodeCard } from './node-card.js';
import { collectSubtreeIds, countDescendants } from './tree.js';
import type { BrainstormModalState } from './types.js';
import { useAiActions } from './use-ai-actions.js';
import { useBoardState } from './use-board-state.js';
import { useBoardViewport } from './use-board-viewport.js';

export interface BoardEditorProps {
  board: Board;
  t: Translate;
  onBack: () => void;
  onChange: (patch: BoardPatch) => void;
}

/**
 * Board editor shell.
 *
 * State ownership: Workspace owns `Board[]`. This component mounts with a board
 * snapshot (`key={board.id}` remounts on switch); runtime `nodes/pan/zoom` live
 * here and debounce-write patches back via `onChange`.
 */
export function BoardEditor({ board, t, onBack, onChange }: BoardEditorProps) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const [modal, setModal] = React.useState<BrainstormModalState | null>(null);
  const state = useBoardState(board, onChange);
  const {
    nodes,
    nodesRef,
    pan,
    setPan,
    panRef,
    zoom,
    setZoom,
    zoomRef,
    sizes,
    measure,
    selectedId,
    setSelectedId,
    autoEditId,
    setAutoEditId,
    mutate,
    updateNode,
  } = state;

  const viewport = useBoardViewport({
    canvasRef,
    nodesRef,
    sizes,
    panRef,
    zoomRef,
    setPan,
    setZoom,
    setSelectedId,
  });

  const actions = useAiActions({
    t,
    canvasRef,
    nodesRef,
    panRef,
    zoomRef,
    sizes,
    mutate,
    updateNode,
    setSelectedId,
    setAutoEditId,
    setModal,
  });

  const deleteNode = (nodeId: string) => {
    const ids = collectSubtreeIds(nodesRef.current, nodeId);
    mutate((previous) => previous.filter((node) => !ids.has(node.id)));
    setSelectedId((previous) => (previous && ids.has(previous) ? null : previous));
    setModal(null);
  };

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedId || modal) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest?.('[contenteditable="true"]'))
      ) {
        return;
      }
      event.preventDefault();
      deleteNode(selectedId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, modal]);

  const onCanvasDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('.bn-nodeWrap, .bn-zoom, .ui-btn')) return;
    event.preventDefault();
    actions.addFreeNodeAt(event.clientX, event.clientY);
  };

  let modalNode: BrainstormNode | null = null;
  if (modal && modal.type !== 'addIdea') {
    modalNode = nodes.find((node) => node.id === modal.nodeId) ?? null;
  }
  const deleteCount = modal && modal.type === 'delete' && modalNode
    ? countDescendants(nodes, modalNode.id)
    : 0;

  const deleteFromModal = () => {
    if (modal?.type === 'delete') deleteNode(modal.nodeId);
  };

  const submitFromModal = (value: string) => {
    const current = modal;
    setModal(null);
    if (!current) return;
    if (current.type === 'addIdea') actions.addIdea(value, current.parentId);
    else if (current.type === 'intents') void actions.analyzeIntents(current.nodeId, value);
    else if (current.type === 'modify') void actions.modifyNode(current.nodeId, value);
  };

  return (
    <div className="bn-editor">
      <div className="bn-editorTopbar">
        <Button variant="ghost" size="sm" className="bn-backButton" onClick={onBack}>
          ← {t('brainstorm.backToList')}
        </Button>
        <Input
          className="bn-titleInput"
          value={board.title || ''}
          placeholder={t('brainstorm.boardTitlePlaceholder')}
          onChange={(event) => onChange({ title: event.target.value })}
          aria-label={t('brainstorm.boardTitlePlaceholder')}
        />
        <span className="bn-saveStatus">{t('brainstorm.autoSaved')}</span>
        <div className="bn-editorActions">
          <Button variant="outline" size="sm" onClick={viewport.fitView}>
            {t('brainstorm.fitView')}
          </Button>
          <Button variant="default" size="sm" onClick={() => setModal({ type: 'addIdea', parentId: null })}>
            {t('brainstorm.addIdea')}
          </Button>
        </div>
      </div>
      <div
        className="bn-canvas"
        ref={canvasRef}
        onPointerDown={viewport.onCanvasPointerDown}
        onPointerMove={viewport.onCanvasPointerMove}
        onPointerUp={viewport.onCanvasPointerUp}
        onPointerCancel={viewport.onCanvasPointerUp}
        onDoubleClick={onCanvasDoubleClick}
      >
        <BoardBackdrop nodes={nodes} sizes={sizes} pan={pan} zoom={zoom} />
        <div className="bn-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              t={t}
              selected={node.id === selectedId}
              zoom={zoom}
              onSelect={setSelectedId}
              onMove={(id, x, y) => updateNode(id, { x, y })}
              onMeasure={measure}
              onOption={actions.selectOption}
              onRetry={actions.retryNode}
              onStartOutline={(id) => void actions.startOutline(id)}
              onModify={(target) => setModal({ type: 'modify', nodeId: target.id })}
              onAddIdea={(target) => setModal({ type: 'addIdea', parentId: target.id })}
              onDelete={(target) => setModal({ type: 'delete', nodeId: target.id })}
              onAsk={(target) => void actions.askQuestions(target.id)}
              onAnalyzeIntent={(target) => setModal({ type: 'intents', nodeId: target.id })}
              onAnswer={actions.submitAnswer}
              onConfirmOutline={actions.confirmOutline}
              onUpdateNode={updateNode}
              autoEdit={node.id === autoEditId}
              onAutoEditHandled={() => setAutoEditId(null)}
              onDiscard={(id) => deleteNode(id)}
            />
          ))}
        </div>
        {nodes.length === 0 ? (
          <div className="bn-empty">
            <div className="bn-emptyIcon" aria-hidden="true">◇</div>
            <h2>{t('brainstorm.boardEmpty')}</h2>
            <p>{t('brainstorm.boardEmptyHint')}</p>
            <Button variant="default" onClick={() => setModal({ type: 'addIdea', parentId: null })}>
              {t('brainstorm.addIdea')}
            </Button>
          </div>
        ) : null}
        <div className="bn-zoom">
          <Button
            variant="ghost"
            size="icon"
            className="bn-zoomButton"
            aria-label="zoom out"
            onClick={() => {
              const rect = canvasRef.current ? canvasRef.current.getBoundingClientRect() : null;
              if (rect) viewport.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.85);
            }}
          >
            −
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bn-zoomButton"
            aria-label="zoom in"
            onClick={() => {
              const rect = canvasRef.current ? canvasRef.current.getBoundingClientRect() : null;
              if (rect) viewport.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.18);
            }}
          >
            +
          </Button>
          <Button variant="ghost" size="sm" className="bn-zoomFit" onClick={viewport.fitView}>
            {t('brainstorm.fitView')}
          </Button>
        </div>
        <div className="bn-canvasHint">{t('brainstorm.canvasHint')}</div>
      </div>
      {modal ? (
        <BrainstormModal
          modal={modal}
          node={modalNode}
          deleteCount={deleteCount}
          t={t}
          onClose={() => setModal(null)}
          onDelete={deleteFromModal}
          onSubmit={submitFromModal}
        />
      ) : null}
    </div>
  );
}
