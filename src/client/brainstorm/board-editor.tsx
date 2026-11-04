import React from 'react';

import type {
  Board,
  BoardPatch,
  BrainstormNode,
  TitleResult,
  Translate,
} from '../../shared/types.js';
import { postApi } from '../api.js';
import { isPlaceholderBoardTitle } from '../model.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { BoardBackdrop } from './board-backdrop.js';
import { InterviewGrid } from './interview-grid.js';
import { isInterviewBranchLocked, reflowChildren, translateSubtree } from './layout.js';
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
  /** Called with the live node count so the list can drop empty Untitled boards. */
  onBack: (nodeCount: number) => void;
  onChange: (patch: BoardPatch) => void | Promise<void>;
}

function firstNodeSeed(nodes: BrainstormNode[]): string {
  for (const node of nodes) {
    const content = typeof node.content === 'string' ? node.content.trim() : '';
    if (content !== '') return content;
    const points = Array.isArray(node.points)
      ? node.points.filter((item) => typeof item === 'string' && item.trim() !== '')
      : [];
    if (points.length > 0) return points.join('\n');
  }
  return '';
}

/**
 * Board editor shell.
 *
 * State ownership: Workspace owns durable Board. This component mounts with a board
 * snapshot (`key={board.id}` remounts on switch); runtime `nodes/pan/zoom` live
 * here and debounce-write patches back via `onChange`.
 */
export function BoardEditor({ board, t, onBack, onChange }: BoardEditorProps) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const [modal, setModal] = React.useState<BrainstormModalState | null>(null);
  const [title, setTitle] = React.useState(board.title || '');
  const [enteringIds, setEnteringIds] = React.useState<Record<string, number>>({});
  const titleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleAutoRef = React.useRef(false);
  const titleManualRef = React.useRef(!isPlaceholderBoardTitle(board.title || ''));
  const sizesRef = React.useRef<Record<string, { height: number }>>({});
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
    saveStatus,
    persistPatch,
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

  const markEntering = React.useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const started = Date.now();
    setEnteringIds((previous) => {
      const next = { ...previous };
      for (const id of ids) next[id] = started;
      return next;
    });
    window.setTimeout(() => {
      setEnteringIds((previous) => {
        let changed = false;
        const next = { ...previous };
        for (const id of ids) {
          if (next[id] === started) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    }, 700);
  }, []);

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
    markEntering,
  });

  const commitNodeContent = React.useCallback(
    (id: string, patch: Parameters<typeof updateNode>[1]) => {
      const before = nodesRef.current.find((item) => item.id === id);
      updateNode(id, patch);
      if (!before || before.parentId !== null) return;
      if (before.kind !== 'idea') return;
      const hadContent = (before.content || '').trim() !== '';
      const after = nodesRef.current.find((item) => item.id === id);
      const nextContent =
        typeof patch === 'function'
          ? (after?.content || '').trim()
          : typeof patch.content === 'string'
            ? patch.content.trim()
            : (after?.content || '').trim();
      if (!hadContent && nextContent !== '') {
        const hasInterview = nodesRef.current.some(
          (node) => node.kind === 'interview' && node.parentId === id,
        );
        if (!hasInterview) void actions.startInterview(id);
      }
    },
    [actions, nodesRef, updateNode],
  );

  const deleteNode = (nodeId: string) => {
    if (isInterviewBranchLocked(nodesRef.current, nodeId)) return;
    const ids = collectSubtreeIds(nodesRef.current, nodeId);
    mutate((previous) => previous.filter((node) => !ids.has(node.id)));
    setSelectedId((previous) => (previous && ids.has(previous) ? null : previous));
    setModal(null);
  };

  React.useEffect(() => () => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedId || modal) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (isInterviewBranchLocked(nodesRef.current, selectedId)) return;
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
  }, [selectedId, modal, nodes]);

  // After measured height jumps, reflow siblings under the same parent.
  // Interview Q cards are visually CSS-grid; reflow still updates outline extras / bounds seeds.
  React.useEffect(() => {
    const previous = sizesRef.current;
    sizesRef.current = sizes;
    for (const [id, size] of Object.entries(sizes)) {
      const prior = previous[id];
      if (!prior || Math.abs(prior.height - size.height) < 8) continue;
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node?.parentId) continue;
      mutate((current) => reflowChildren(current, sizes, node.parentId!));
      break;
    }
  }, [sizes, mutate, nodesRef]);

  // First meaningful node → AI title while board still has a placeholder name.
  React.useEffect(() => {
    if (titleAutoRef.current || titleManualRef.current) return;
    if (!isPlaceholderBoardTitle(title)) return;
    const seed = firstNodeSeed(nodes);
    if (seed === '') return;
    titleAutoRef.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const result: TitleResult = await postApi('title', { content: seed }, controller.signal);
        if (controller.signal.aborted || titleManualRef.current) return;
        const next = result.title.trim();
        if (next === '' || !isPlaceholderBoardTitle(title)) return;
        setTitle(next);
        await persistPatch({ title: next, updatedAt: Date.now() });
      } catch {
        titleAutoRef.current = false;
      }
    })();
    return () => controller.abort();
  }, [nodes, title, persistPatch]);

  const onCanvasDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('.bn-nodeWrap, .bn-zoom, .ui-btn')) return;
    event.preventDefault();
    actions.addFreeNodeAt(event.clientX, event.clientY);
  };

  const moveSubtree = (id: string, x: number, y: number) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node) return;
    const dx = x - node.x;
    const dy = y - node.y;
    if (dx === 0 && dy === 0) return;
    mutate((previous) => translateSubtree(previous, id, dx, dy));
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
    else if (current.type === 'research') void actions.startOutline(current.nodeId, value);
    else if (current.type === 'revise') void actions.reviseResult(current.nodeId, value);
  };

  const zoomPercent = `${Math.round(zoom * 100)}%`;

  const interviewById = React.useMemo(() => {
    const map = new Map<string, BrainstormNode>();
    for (const node of nodes) {
      if (node.kind === 'interview') map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  const questionsByInterview = React.useMemo(() => {
    const map = new Map<string, BrainstormNode[]>();
    for (const node of nodes) {
      if (node.kind !== 'question' || !node.parentId) continue;
      if (!interviewById.has(node.parentId)) continue;
      const list = map.get(node.parentId) || [];
      list.push(node);
      map.set(node.parentId, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => (a.clarifyRound || 0) - (b.clarifyRound || 0) || a.y - b.y || a.id.localeCompare(b.id),
      );
    }
    return map;
  }, [nodes, interviewById]);

  const gridQuestionIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const list of questionsByInterview.values()) {
      for (const node of list) ids.add(node.id);
    }
    return ids;
  }, [questionsByInterview]);

  const renderNodeCard = (node: BrainstormNode, gridItem = false) => (
    <NodeCard
      key={node.id}
      node={node}
      t={t}
      selected={node.id === selectedId}
      zoom={zoom}
      entering={Boolean(enteringIds[node.id])}
      locked={isInterviewBranchLocked(nodes, node.id)}
      gridItem={gridItem}
      onSelect={setSelectedId}
      onMove={moveSubtree}
      onMeasure={measure}
      onOption={actions.selectOption}
      onRetry={actions.retryNode}
      onStartInterview={(target) => void actions.startInterview(target.id)}
      onStartDiverge={(target) => void actions.startDiverge(target.id)}
      onStartResearch={(target) => setModal({ type: 'research', nodeId: target.id })}
      onAnswer={(id, answer) => {
        if (isInterviewBranchLocked(nodesRef.current, id)) return;
        const target = nodesRef.current.find((item) => item.id === id);
        if (target?.clarifyRootId) {
          actions.submitClarifyAnswer(id, answer);
          return;
        }
        const text = answer.trim();
        if (text === '') return;
        updateNode(id, { answer: text, answeredAt: Date.now(), error: null });
      }}
      onConfirmOutline={actions.confirmOutline}
      onConfirmStatement={(id) => actions.confirmStatement(id)}
      onContinueClarify={(id) => actions.continueClarifyFromStatement(id)}
      onAddComment={actions.addResultComment}
      onReviseResult={(target) => setModal({ type: 'revise', nodeId: target.id })}
      onUpdateNode={(id, patch) => {
        if (isInterviewBranchLocked(nodesRef.current, id)) return;
        commitNodeContent(id, patch);
      }}
      autoEdit={node.id === autoEditId}
      onAutoEditHandled={() => setAutoEditId(null)}
      onDiscard={(id) => deleteNode(id)}
    />
  );

  return (
    <div className="bn-editor">
      <div className="bn-editorTopbar">
        <Button
          variant="ghost"
          size="sm"
          className="bn-backButton"
          onClick={() => onBack(nodesRef.current.length)}
        >
          ← {t('brainstorm.backToList')}
        </Button>
        <Input
          className="bn-titleInput"
          value={title}
          placeholder={t('brainstorm.boardTitlePlaceholder')}
          onChange={(event) => {
            const next = event.target.value;
            titleManualRef.current = true;
            setTitle(next);
            if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
            titleTimerRef.current = setTimeout(() => {
              void persistPatch({ title: next, updatedAt: Date.now() });
            }, 220);
          }}
          aria-label={t('brainstorm.boardTitlePlaceholder')}
        />
        <span className={`bn-saveStatus${saveStatus === 'failed' ? ' is-error' : ''}`}>
          {saveStatus === 'failed'
            ? t('brainstorm.saveFailed')
            : saveStatus === 'saving'
              ? t('brainstorm.save')
              : t('brainstorm.autoSaved')}
        </span>
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
        <BoardBackdrop nodes={nodes} sizes={sizes} pan={pan} zoom={zoom} enteringIds={enteringIds} />
        <div className="bn-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {Array.from(interviewById.values()).map((interview) => {
            const questions = questionsByInterview.get(interview.id) || [];
            return (
              <InterviewGrid
                key={`grid-${interview.id}`}
                interview={interview}
                questions={questions}
              >
                {questions.map((node) => renderNodeCard(node, true))}
              </InterviewGrid>
            );
          })}
          {nodes
            .filter((node) => !gridQuestionIds.has(node.id))
            .map((node) => renderNodeCard(node, false))}
        </div>
        {nodes.length === 0 ? (
          <div className="bn-empty">
            <div className="bn-emptyIcon" aria-hidden="true">◇</div>
            <h2>{t('brainstorm.boardEmpty')}</h2>
            <p>{t('brainstorm.boardEmptyHint')}</p>
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
          <span className="bn-zoomLevel" aria-live="polite">
            {zoomPercent}
          </span>
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
        </div>
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
