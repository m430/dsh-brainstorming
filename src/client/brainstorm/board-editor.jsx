import React from 'react';
import { API, postJson } from '../api.js';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { NODE_WIDTH, H_GAP, V_GAP, buildContextText, buildPath, estimateNodeHeight, makeId } from '../model.js';
import { BrainstormModal } from './modal.jsx';
import { NodeCard } from './node-card.jsx';
import { PixiCanvas } from './pixi-canvas.jsx';

const nodeWidth = (node) => node.width || NODE_WIDTH;
const nodeText = (node) =>
  [node.content, ...(Array.isArray(node.points) ? node.points : [])].filter((part) => typeof part === 'string' && part !== '').join('\n');
const sizeOf = (node, sizes) => ({
  width: nodeWidth(node),
  height: (sizes[node.id] && sizes[node.id].height) || estimateNodeHeight(node),
});

function countDescendants(nodes, nodeId) {
  const ids = new Set();
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (ids.has(id)) continue;
    ids.add(id);
    for (const node of nodes) if (node.parentId === id) stack.push(node.id);
  }
  return Math.max(0, ids.size - 1);
}

export function BoardEditor({ board, t, onBack, onChange }) {
  const [nodes, setNodes] = React.useState(Array.isArray(board.nodes) ? board.nodes : []);
  const nodesRef = React.useRef(nodes);
  const [pan, setPan] = React.useState(board.pan || { x: 120, y: 100 });
  const panRef = React.useRef(pan);
  const [zoom, setZoom] = React.useState(typeof board.zoom === 'number' ? board.zoom : 1);
  const zoomRef = React.useRef(zoom);
  const [sizes, setSizes] = React.useState({});
  const [selectedId, setSelectedId] = React.useState(null);
  const [autoEditId, setAutoEditId] = React.useState(null);
  const [modal, setModal] = React.useState(null);
  const canvasRef = React.useRef(null);
  const panDrag = React.useRef(null);
  const persistRef = React.useRef({ nodes, pan, zoom });

  const mutate = (updater) => {
    const next = updater(nodesRef.current);
    nodesRef.current = next;
    setNodes(next);
  };
  const updateNode = (id, patch) => {
    mutate((previous) =>
      previous.map((node) => (node.id === id ? { ...node, ...(typeof patch === 'function' ? patch(node) : patch) } : node)),
    );
  };
  const measure = React.useCallback((id, height) => {
    setSizes((previous) => {
      const prior = previous[id];
      if (prior && Math.abs(prior.height - height) < 2) return previous;
      return { ...previous, [id]: { height } };
    });
  }, []);

  React.useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  React.useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  React.useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const persist = () => {
    const latest = persistRef.current;
    const root = latest.nodes.find((node) => node.kind === 'idea' && !node.parentId);
    onChange({
      nodes: latest.nodes,
      pan: latest.pan,
      zoom: latest.zoom,
      nodeCount: latest.nodes.length,
      rootIdea: root && root.content ? root.content.slice(0, 80) : '',
      updatedAt: Date.now(),
    });
  };

  React.useEffect(() => {
    persistRef.current = { nodes, pan, zoom };
    const timer = setTimeout(persist, 220);
    return () => clearTimeout(timer);
  }, [nodes, pan, zoom]);

  React.useEffect(() => () => persist(), []);

  const viewportCenter = () => {
    const element = canvasRef.current;
    if (!element) return { x: 120, y: 120 };
    const rect = element.getBoundingClientRect();
    return {
      x: (rect.width / 2 - panRef.current.x) / zoomRef.current - NODE_WIDTH / 2,
      y: (rect.height / 2 - panRef.current.y) / zoomRef.current - 90,
    };
  };
  const childPosition = (parentId) => {
    const current = nodesRef.current;
    const parent = current.find((node) => node.id === parentId);
    if (!parent) return viewportCenter();
    const siblings = current.filter((node) => node.parentId === parentId);
    let offset = 0;
    for (const sibling of siblings) offset += sizeOf(sibling, sizes).height + V_GAP;
    return { x: parent.x + nodeWidth(parent) + H_GAP, y: parent.y + offset };
  };

  const runExpand = async (ideaId, existingQuestionId) => {
    const current = nodesRef.current;
    const idea = current.find((node) => node.id === ideaId);
    if (!idea) return;
    const context = buildContextText(current, ideaId);
    let questionId = existingQuestionId;
    if (!questionId) {
      const position = childPosition(ideaId);
      questionId = makeId();
      mutate((previous) => [
        ...previous,
        {
          id: questionId,
          kind: 'question',
          title: t('brainstorm.questionTitle'),
          content: '',
          points: [],
          options: [],
          selectedOptionId: null,
          confirmed: false,
          status: 'thinking',
          busy: null,
          error: null,
          retry: { type: 'expand', ideaId },
          parentId: ideaId,
          x: position.x,
          y: position.y,
          width: NODE_WIDTH,
        },
      ]);
      setSelectedId(questionId);
    } else {
      updateNode(questionId, { status: 'thinking', busy: null, error: null });
    }
    try {
      const result = await postJson(API.expand, { idea: idea.content, context });
      updateNode(questionId, {
        status: 'ready',
        busy: null,
        title: t('brainstorm.questionTitle'),
        content: result.question,
        options: result.options,
        error: null,
        retry: null,
      });
    } catch (error) {
      updateNode(questionId, {
        status: 'error',
        busy: null,
        content: '',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const addIdea = (text, parentId) => {
    const content = text.trim();
    if (content === '') return;
    const position = parentId ? childPosition(parentId) : viewportCenter();
    const id = makeId();
    mutate((previous) => [
      ...previous,
      {
        id,
        kind: 'idea',
        title: t('brainstorm.kind.idea'),
        content,
        points: [],
        options: [],
        selectedOptionId: null,
        confirmed: false,
        status: 'ready',
        busy: null,
        error: null,
        retry: null,
        parentId: parentId || null,
        x: position.x,
        y: position.y,
        width: NODE_WIDTH,
      },
    ]);
    setSelectedId(id);
    setModal(null);
    void runExpand(id);
  };

  const addFreeNodeAt = (clientX, clientY) => {
    const element = canvasRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const id = makeId();
    const x = (clientX - rect.left - panRef.current.x) / zoomRef.current - NODE_WIDTH / 2;
    const y = (clientY - rect.top - panRef.current.y) / zoomRef.current - 40;
    mutate((previous) => [
      ...previous,
      {
        id,
        kind: 'idea',
        title: t('brainstorm.freeNodeTitle'),
        content: '',
        points: [],
        options: [],
        selectedOptionId: null,
        confirmed: false,
        status: 'ready',
        busy: null,
        error: null,
        retry: null,
        parentId: null,
        x,
        y,
        width: NODE_WIDTH,
        freeNode: true,
      },
    ]);
    setSelectedId(id);
    setAutoEditId(id);
  };

  const startOutline = async (targetNodeId, existingOutlineId) => {
    const current = nodesRef.current;
    const target = current.find((node) => node.id === targetNodeId);
    if (!target) return;
    if (
      !existingOutlineId &&
      current.some((node) => node.parentId === targetNodeId && node.kind === 'outline' && node.status === 'thinking')
    ) {
      return;
    }
    const path = buildPath(current, targetNodeId);
    const context = [buildContextText(current, targetNodeId), nodeText(target) ? `当前节点内容：${nodeText(target)}` : '']
      .filter((part) => part !== '')
      .join('\n');
    let outlineId = existingOutlineId;
    if (!outlineId) {
      const position = childPosition(targetNodeId);
      outlineId = makeId();
      mutate((previous) => [
        ...previous,
        {
          id: outlineId,
          kind: 'outline',
          title: t('brainstorm.outlineTitle'),
          content: '',
          points: [],
          options: [],
          selectedOptionId: null,
          confirmed: false,
          status: 'thinking',
          busy: 'outline',
          error: null,
          retry: { type: 'outline', targetNodeId },
          parentId: targetNodeId,
          x: position.x,
          y: position.y,
          width: NODE_WIDTH,
        },
      ]);
      setSelectedId(outlineId);
    } else {
      updateNode(outlineId, { status: 'thinking', busy: 'outline', error: null });
    }
    try {
      const result = await postJson(API.outline, { idea: path.idea, path: path.path, context });
      updateNode(outlineId, {
        status: 'ready',
        busy: null,
        title: result.title,
        points: result.points,
        confirmed: false,
        error: null,
        retry: null,
      });
    } catch (error) {
      updateNode(outlineId, {
        status: 'error',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const runResearch = async (outlineId, existingResultId) => {
    const current = nodesRef.current;
    const outline = current.find((node) => node.id === outlineId);
    if (!outline || outline.kind !== 'outline') return;
    const path = buildPath(current, outlineId);
    let resultId = existingResultId;
    if (!resultId) {
      const position = childPosition(outlineId);
      resultId = makeId();
      mutate((previous) => [
        ...previous,
        {
          id: resultId,
          kind: 'result',
          title: t('brainstorm.resultTitle'),
          content: '',
          points: [],
          options: [],
          selectedOptionId: null,
          confirmed: false,
          status: 'thinking',
          busy: 'research',
          error: null,
          retry: { type: 'research', outlineId },
          parentId: outlineId,
          x: position.x,
          y: position.y,
          width: NODE_WIDTH,
        },
      ]);
      setSelectedId(resultId);
    } else {
      updateNode(resultId, { status: 'thinking', busy: 'research', error: null, retry: { type: 'research', outlineId } });
    }
    try {
      const result = await postJson(API.research, {
        idea: path.idea,
        path: path.path,
        outline: { title: outline.title, points: outline.points || [] },
      });
      updateNode(resultId, {
        status: 'ready',
        busy: null,
        title: result.result.title,
        content: '',
        points: result.result.points,
        error: null,
        retry: null,
      });
    } catch (error) {
      updateNode(resultId, {
        status: 'error',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const selectOption = (questionId, optionId) => {
    const node = nodesRef.current.find((item) => item.id === questionId);
    if (!node || node.selectedOptionId || node.status !== 'ready') return;
    if (!(node.options || []).some((option) => option.id === optionId)) return;
    updateNode(questionId, { selectedOptionId: optionId });
    void startOutline(questionId);
  };

  const confirmOutline = (outlineId) => {
    const node = nodesRef.current.find((item) => item.id === outlineId);
    if (!node || node.kind !== 'outline' || node.status !== 'ready' || node.confirmed) return;
    updateNode(outlineId, { confirmed: true, error: null });
    void runResearch(outlineId);
  };

  const askQuestions = async (nodeId) => {
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node) return;
    updateNode(nodeId, { status: 'thinking', busy: 'questions', error: null });
    try {
      const context = JSON.stringify(buildPath(nodesRef.current, nodeId));
      const result = await postJson(API.questions, {
        content: nodeText(node),
        context,
      });
      updateNode(nodeId, { status: 'ready', busy: null, error: null });
      const current = nodesRef.current;
      const parent = current.find((item) => item.id === nodeId);
      if (!parent) return;
      const siblings = current.filter((item) => item.parentId === nodeId);
      let y = parent.y;
      for (const sibling of siblings) y += sizeOf(sibling, sizes).height + V_GAP;
      const x = parent.x + nodeWidth(parent) + H_GAP;
      const children = [];
      for (const question of result.questions) {
        const child = {
          id: makeId(),
          kind: 'question',
          title: '',
          content: question.question,
          points: question.why ? [question.why] : [],
          options: [],
          selectedOptionId: null,
          answerMode: true,
          answer: '',
          answeredAt: null,
          confirmed: false,
          status: 'ready',
          busy: null,
          error: null,
          retry: null,
          parentId: nodeId,
          x,
          y,
          width: NODE_WIDTH,
        };
        children.push(child);
        y += estimateNodeHeight(child) + V_GAP;
      }
      mutate((previous) => [...previous, ...children]);
    } catch (error) {
      updateNode(nodeId, {
        status: 'ready',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const submitAnswer = (nodeId, answer) => {
    const text = answer.trim();
    if (text === '') return;
    updateNode(nodeId, { answer: text, answeredAt: Date.now(), error: null });
  };

  const analyzeIntents = async (nodeId, prompt) => {
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node) return;
    setModal(null);
    updateNode(nodeId, { status: 'thinking', busy: 'intents', error: null });
    try {
      const context = JSON.stringify(buildPath(nodesRef.current, nodeId));
      const result = await postJson(API.intents, {
        content: nodeText(node),
        prompt,
        context,
      });
      updateNode(nodeId, { status: 'ready', busy: null, error: null });
      const current = nodesRef.current;
      const parent = current.find((item) => item.id === nodeId);
      if (!parent) return;
      const siblings = current.filter((item) => item.parentId === nodeId);
      let y = parent.y;
      for (const sibling of siblings) y += sizeOf(sibling, sizes).height + V_GAP;
      const x = parent.x + nodeWidth(parent) + H_GAP;
      const children = [];
      for (const intent of result.intents) {
        const content = [intent.label, intent.detail].filter((part) => part !== '').join('：');
        const child = {
          id: makeId(),
          kind: 'intent',
          title: '',
          content,
          points: [],
          options: [],
          selectedOptionId: null,
          confirmed: false,
          status: 'ready',
          busy: null,
          error: null,
          retry: null,
          parentId: nodeId,
          x,
          y,
          width: NODE_WIDTH,
        };
        children.push(child);
        y += estimateNodeHeight(child) + V_GAP;
      }
      mutate((previous) => [...previous, ...children]);
    } catch (error) {
      updateNode(nodeId, {
        status: 'ready',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const modifyNode = async (nodeId, instruction) => {
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node) return;
    setModal(null);
    updateNode(nodeId, { status: 'thinking', busy: 'modify', error: null });
    try {
      const context = JSON.stringify(buildPath(nodesRef.current, nodeId));
      const result = await postJson(API.modify, {
        node: { kind: node.kind, title: node.title, content: node.content, points: node.points || [] },
        instruction,
        context,
      });
      if (node.kind === 'question') {
        updateNode(nodeId, {
          status: 'ready',
          busy: null,
          title: t('brainstorm.questionTitle'),
          content: result.question || result.content || node.content || '',
          options: Array.isArray(result.options) && result.options.length >= 2 ? result.options : node.options || [],
          selectedOptionId: null,
          retry: null,
          error: null,
        });
      } else {
        const nextPoints = Array.isArray(result.points) && result.points.length > 0 ? result.points : node.points || [];
        updateNode(nodeId, {
          status: 'ready',
          busy: null,
          title: result.title || node.title,
          content: node.kind === 'result' && nextPoints.length > 0 ? '' : result.content || node.content || '',
          points: nextPoints,
          error: null,
        });
      }
    } catch (error) {
      updateNode(nodeId, {
        status: 'ready',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const retryNode = (nodeId) => {
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node || !node.retry) return;
    if (node.retry.type === 'expand') void runExpand(node.retry.ideaId, nodeId);
    else if (node.retry.type === 'outline') void startOutline(node.retry.targetNodeId, nodeId);
    else if (node.retry.type === 'research') void runResearch(node.retry.outlineId, nodeId);
  };

  const deleteNode = (nodeId) => {
    const current = nodesRef.current;
    const ids = new Set();
    const stack = [nodeId];
    while (stack.length > 0) {
      const id = stack.pop();
      if (ids.has(id)) continue;
      ids.add(id);
      for (const node of current) if (node.parentId === id) stack.push(node.id);
    }
    mutate((previous) => previous.filter((node) => !ids.has(node.id)));
    setSelectedId((previous) => (previous && ids.has(previous) ? null : previous));
    setModal(null);
  };

  const fitView = () => {
    const element = canvasRef.current;
    const current = nodesRef.current;
    if (!element || current.length === 0) return;
    const rect = element.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of current) {
      const size = sizeOf(node, sizes);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + size.width);
      maxY = Math.max(maxY, node.y + size.height);
    }
    const padding = 90;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const nextZoom = Math.min(1.1, Math.max(0.3, Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height)));
    setZoom(nextZoom);
    setPan({
      x: (rect.width - width * nextZoom) / 2 - minX * nextZoom,
      y: (rect.height - height * nextZoom) / 2 - minY * nextZoom,
    });
  };

  const zoomAt = (clientX, clientY, factor) => {
    const element = canvasRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const currentZoom = zoomRef.current;
    const nextZoom = Math.min(2, Math.max(0.3, currentZoom * factor));
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const currentPan = panRef.current;
    setPan({
      x: px - ((px - currentPan.x) * nextZoom) / currentZoom,
      y: py - ((py - currentPan.y) * nextZoom) / currentZoom,
    });
    setZoom(nextZoom);
  };

  React.useEffect(() => {
    const element = canvasRef.current;
    if (!element) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey || event.altKey) {
        zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0015));
      } else {
        setPan((previous) => ({ x: previous.x - event.deltaX, y: previous.y - event.deltaY }));
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (!selectedId || modal) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const target = event.target;
      if (
        target &&
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

  const onCanvasDoubleClick = (event) => {
    if (event.target.closest('.bn-nodeWrap, .bn-zoom, .ui-btn')) return;
    event.preventDefault();
    addFreeNodeAt(event.clientX, event.clientY);
  };

  const onCanvasPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.bn-nodeWrap, .bn-zoom, .bn-empty .ui-btn, .ui-btn')) return;
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    panDrag.current = { startX: event.clientX, startY: event.clientY, panX: panRef.current.x, panY: panRef.current.y };
    setSelectedId(null);
  };
  const onCanvasPointerMove = (event) => {
    const state = panDrag.current;
    if (!state) return;
    setPan({ x: state.panX + event.clientX - state.startX, y: state.panY + event.clientY - state.startY });
  };
  const onCanvasPointerUp = () => {
    panDrag.current = null;
  };

  const modalNode =
    modal && (modal.type === 'modify' || modal.type === 'delete' || modal.type === 'intents')
      ? nodes.find((node) => node.id === modal.nodeId)
      : null;
  const deleteCount = modal && modal.type === 'delete' && modalNode
    ? countDescendants(nodes, modalNode.id)
    : 0;

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
          <Button variant="outline" size="sm" onClick={fitView}>
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
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onDoubleClick={onCanvasDoubleClick}
      >
        <PixiCanvas nodes={nodes} sizes={sizes} pan={pan} zoom={zoom} />
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
              onOption={selectOption}
              onRetry={retryNode}
              onStartOutline={(id) => void startOutline(id)}
              onModify={(target) => setModal({ type: 'modify', nodeId: target.id })}
              onAddIdea={(target) => setModal({ type: 'addIdea', parentId: target.id })}
              onDelete={(target) => setModal({ type: 'delete', nodeId: target.id })}
              onAsk={(target) => void askQuestions(target.id)}
              onAnalyzeIntent={(target) => setModal({ type: 'intents', nodeId: target.id })}
              onAnswer={submitAnswer}
              onConfirmOutline={confirmOutline}
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
              if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.85);
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
              if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.18);
            }}
          >
            +
          </Button>
          <Button variant="ghost" size="sm" className="bn-zoomFit" onClick={fitView}>
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
          onDelete={() => {
            if (modal.type === 'delete' && modal.nodeId) deleteNode(modal.nodeId);
          }}
          onSubmit={(value) => {
            const current = modal;
            setModal(null);
            if (current.type === 'addIdea') addIdea(value, current.parentId);
            else if (current.type === 'intents' && current.nodeId) void analyzeIntents(current.nodeId, value);
            else if (current.type === 'modify' && current.nodeId) void modifyNode(current.nodeId, value);
          }}
        />
      ) : null}
    </div>
  );
}
