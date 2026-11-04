import React from 'react';

import type {
  BrainstormNode,
  ExpandResult,
  IntentsResult,
  ModifyResult,
  OutlineResult,
  QuestionsResult,
  ResearchResult,
  Translate,
} from '../../shared/types.js';
import { postApi } from '../api.js';
import { buildContextText, buildPath, makeId } from '../model.js';
import {
  NODE_WIDTH,
  V_GAP,
  childPositionOf,
  estimateNodeHeight,
  makeNode,
  nodeText,
  stackChildrenY,
  viewportCenterFrom,
} from './layout.js';
import type { NodePatch, NodeSizes } from './types.js';

export interface AiActionsDeps {
  t: Translate;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nodesRef: React.MutableRefObject<BrainstormNode[]>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  zoomRef: React.MutableRefObject<number>;
  sizes: NodeSizes;
  mutate: (updater: (nodes: BrainstormNode[]) => BrainstormNode[]) => void;
  updateNode: (id: string, patch: NodePatch) => void;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setAutoEditId: React.Dispatch<React.SetStateAction<string | null>>;
  setModal: React.Dispatch<React.SetStateAction<import('./types.js').BrainstormModalState | null>>;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && /abort/iu.test(error.name + error.message);
}

export function useAiActions(deps: AiActionsDeps) {
  const depsRef = React.useRef(deps);
  depsRef.current = deps;
  const controllersRef = React.useRef(new Map<string, AbortController>());

  const abortAll = React.useCallback(() => {
    for (const controller of controllersRef.current.values()) controller.abort();
    controllersRef.current.clear();
  }, []);

  React.useEffect(() => () => abortAll(), [abortAll]);

  const beginRequest = (key: string): AbortSignal => {
    const previous = controllersRef.current.get(key);
    previous?.abort();
    const controller = new AbortController();
    controllersRef.current.set(key, controller);
    return controller.signal;
  };

  const childPosition = (parentId: string) => {
    const { nodesRef, sizes, canvasRef, panRef, zoomRef } = depsRef.current;
    return childPositionOf(
      nodesRef.current,
      sizes,
      parentId,
      viewportCenterFrom(canvasRef.current, panRef.current, zoomRef.current),
    );
  };

  const runExpand = async (ideaId: string, existingQuestionId?: string) => {
    const { t, nodesRef, mutate, updateNode, setSelectedId } = depsRef.current;
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
        makeNode({
          id: questionId as string,
          kind: 'question',
          title: t('brainstorm.questionTitle'),
          content: '',
          status: 'thinking',
          retry: { type: 'expand', ideaId },
          parentId: ideaId,
          x: position.x,
          y: position.y,
          width: NODE_WIDTH,
        }),
      ]);
      setSelectedId(questionId);
    } else {
      updateNode(questionId, { status: 'thinking', busy: null, error: null });
    }
    const signal = beginRequest(`expand:${questionId}`);
    try {
      const result: ExpandResult = await postApi('expand', { idea: idea.content, context }, signal);
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
      if (isAbortError(error)) return;
      updateNode(questionId, {
        status: 'error',
        busy: null,
        content: '',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const startOutline = async (targetNodeId: string, existingOutlineId?: string) => {
    const { t, nodesRef, sizes, mutate, updateNode, setSelectedId } = depsRef.current;
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
        makeNode({
          id: outlineId as string,
          kind: 'outline',
          title: t('brainstorm.outlineTitle'),
          content: '',
          status: 'thinking',
          busy: 'outline',
          retry: { type: 'outline', targetNodeId },
          parentId: targetNodeId,
          x: position.x,
          y: position.y,
          width: NODE_WIDTH,
        }),
      ]);
      setSelectedId(outlineId);
    } else {
      updateNode(outlineId, { status: 'thinking', busy: 'outline', error: null });
    }
    const signal = beginRequest(`outline:${outlineId}`);
    try {
      const result: OutlineResult = await postApi(
        'outline',
        { idea: path.idea, path: path.path, context },
        signal,
      );
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
      if (isAbortError(error)) return;
      updateNode(outlineId, {
        status: 'error',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const runResearch = async (outlineId: string, existingResultId?: string) => {
    const { t, nodesRef, mutate, updateNode, setSelectedId } = depsRef.current;
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
        makeNode({
          id: resultId as string,
          kind: 'result',
          title: t('brainstorm.resultTitle'),
          content: '',
          status: 'thinking',
          busy: 'research',
          retry: { type: 'research', outlineId },
          parentId: outlineId,
          x: position.x,
          y: position.y,
          width: NODE_WIDTH,
        }),
      ]);
      setSelectedId(resultId);
    } else {
      updateNode(resultId, {
        status: 'thinking',
        busy: 'research',
        error: null,
        retry: { type: 'research', outlineId },
      });
    }
    const signal = beginRequest(`research:${resultId}`);
    try {
      const result: ResearchResult = await postApi(
        'research',
        {
          idea: path.idea,
          path: path.path,
          outline: { title: outline.title, points: outline.points || [] },
        },
        signal,
      );
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
      if (isAbortError(error)) return;
      updateNode(resultId, {
        status: 'error',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const selectOption = (questionId: string, optionId: string) => {
    const { nodesRef, updateNode } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === questionId);
    if (!node || node.selectedOptionId || node.status !== 'ready') return;
    if (!node.options.some((option) => option.id === optionId)) return;
    updateNode(questionId, { selectedOptionId: optionId });
    void startOutline(questionId);
  };

  const confirmOutline = (outlineId: string) => {
    const { nodesRef, updateNode } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === outlineId);
    if (!node || node.kind !== 'outline' || node.status !== 'ready' || node.confirmed) return;
    updateNode(outlineId, { confirmed: true, error: null });
    void runResearch(outlineId);
  };

  const askQuestions = async (nodeId: string) => {
    const { nodesRef, sizes, mutate, updateNode } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node) return;
    updateNode(nodeId, { status: 'thinking', busy: 'questions', error: null });
    const signal = beginRequest(`questions:${nodeId}`);
    try {
      const context = JSON.stringify(buildPath(nodesRef.current, nodeId));
      const result: QuestionsResult = await postApi(
        'questions',
        { content: nodeText(node), context },
        signal,
      );
      updateNode(nodeId, { status: 'ready', busy: null, error: null });
      const origin = stackChildrenY(nodesRef.current, sizes, nodeId);
      if (!origin) return;
      let { x, y } = origin;
      const children: BrainstormNode[] = [];
      for (const question of result.questions) {
        const child = makeNode({
          id: makeId(),
          kind: 'question',
          title: '',
          content: question.question,
          points: question.why ? [question.why] : [],
          answerMode: true,
          answer: '',
          answeredAt: null,
          parentId: nodeId,
          x,
          y,
          width: NODE_WIDTH,
        });
        children.push(child);
        y += estimateNodeHeight(child) + V_GAP;
      }
      mutate((previous) => [...previous, ...children]);
    } catch (error) {
      if (isAbortError(error)) return;
      updateNode(nodeId, {
        status: 'ready',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const submitAnswer = (nodeId: string, answer: string) => {
    const text = answer.trim();
    if (text === '') return;
    depsRef.current.updateNode(nodeId, { answer: text, answeredAt: Date.now(), error: null });
  };

  const analyzeIntents = async (nodeId: string, prompt: string) => {
    const { nodesRef, sizes, mutate, updateNode, setModal } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node) return;
    setModal(null);
    updateNode(nodeId, { status: 'thinking', busy: 'intents', error: null });
    const signal = beginRequest(`intents:${nodeId}`);
    try {
      const context = JSON.stringify(buildPath(nodesRef.current, nodeId));
      const result: IntentsResult = await postApi(
        'intents',
        { content: nodeText(node), prompt, context },
        signal,
      );
      updateNode(nodeId, { status: 'ready', busy: null, error: null });
      const origin = stackChildrenY(nodesRef.current, sizes, nodeId);
      if (!origin) return;
      let { x, y } = origin;
      const children: BrainstormNode[] = [];
      for (const intent of result.intents) {
        const content = [intent.label, intent.detail].filter((part) => part !== '').join('：');
        const child = makeNode({
          id: makeId(),
          kind: 'intent',
          title: '',
          content,
          parentId: nodeId,
          x,
          y,
          width: NODE_WIDTH,
        });
        children.push(child);
        y += estimateNodeHeight(child) + V_GAP;
      }
      mutate((previous) => [...previous, ...children]);
    } catch (error) {
      if (isAbortError(error)) return;
      updateNode(nodeId, {
        status: 'ready',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const modifyNode = async (nodeId: string, instruction: string) => {
    const { t, nodesRef, updateNode, setModal } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node) return;
    setModal(null);
    updateNode(nodeId, { status: 'thinking', busy: 'modify', error: null });
    const signal = beginRequest(`modify:${nodeId}`);
    try {
      const context = JSON.stringify(buildPath(nodesRef.current, nodeId));
      const result: ModifyResult = await postApi(
        'modify',
        {
          node: { kind: node.kind, title: node.title, content: node.content, points: node.points || [] },
          instruction,
          context,
        },
        signal,
      );
      if (node.kind === 'question') {
        const questionResult = result as Extract<ModifyResult, { question: string }>;
        updateNode(nodeId, {
          status: 'ready',
          busy: null,
          title: t('brainstorm.questionTitle'),
          content: questionResult.question || node.content || '',
          options:
            Array.isArray(questionResult.options) && questionResult.options.length >= 2
              ? questionResult.options
              : node.options || [],
          selectedOptionId: null,
          retry: null,
          error: null,
        });
      } else {
        const nodeResult = result as Extract<ModifyResult, { title: string }>;
        const nextPoints =
          Array.isArray(nodeResult.points) && nodeResult.points.length > 0
            ? nodeResult.points
            : node.points || [];
        updateNode(nodeId, {
          status: 'ready',
          busy: null,
          title: nodeResult.title || node.title,
          content: node.kind === 'result' && nextPoints.length > 0 ? '' : nodeResult.content || node.content || '',
          points: nextPoints,
          error: null,
        });
      }
    } catch (error) {
      if (isAbortError(error)) return;
      updateNode(nodeId, {
        status: 'ready',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const retryNode = (nodeId: string) => {
    const node = depsRef.current.nodesRef.current.find((item) => item.id === nodeId);
    if (!node || !node.retry) return;
    if (node.retry.type === 'expand') void runExpand(node.retry.ideaId, nodeId);
    else if (node.retry.type === 'outline') void startOutline(node.retry.targetNodeId, nodeId);
    else if (node.retry.type === 'research') void runResearch(node.retry.outlineId, nodeId);
  };

  const addIdea = (text: string, parentId: string | null) => {
    const {
      t,
      canvasRef,
      panRef,
      zoomRef,
      mutate,
      setSelectedId,
      setModal,
    } = depsRef.current;
    const content = text.trim();
    if (content === '') return;
    const position = parentId
      ? childPosition(parentId)
      : viewportCenterFrom(canvasRef.current, panRef.current, zoomRef.current);
    const id = makeId();
    mutate((previous) => [
      ...previous,
      makeNode({
        id,
        kind: 'idea',
        title: t('brainstorm.kind.idea'),
        content,
        parentId,
        x: position.x,
        y: position.y,
        width: NODE_WIDTH,
      }),
    ]);
    setSelectedId(id);
    setModal(null);
    void runExpand(id);
  };

  const addFreeNodeAt = (clientX: number, clientY: number) => {
    const { t, canvasRef, panRef, zoomRef, mutate, setSelectedId, setAutoEditId } = depsRef.current;
    const element = canvasRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const id = makeId();
    const x = (clientX - rect.left - panRef.current.x) / zoomRef.current - NODE_WIDTH / 2;
    const y = (clientY - rect.top - panRef.current.y) / zoomRef.current - 40;
    mutate((previous) => [
      ...previous,
      makeNode({
        id,
        kind: 'idea',
        title: t('brainstorm.freeNodeTitle'),
        content: '',
        parentId: null,
        x,
        y,
        width: NODE_WIDTH,
        freeNode: true,
      }),
    ]);
    setSelectedId(id);
    setAutoEditId(id);
  };

  return {
    runExpand,
    startOutline,
    runResearch,
    selectOption,
    confirmOutline,
    askQuestions,
    submitAnswer,
    analyzeIntents,
    modifyNode,
    retryNode,
    addIdea,
    addFreeNodeAt,
  };
}
