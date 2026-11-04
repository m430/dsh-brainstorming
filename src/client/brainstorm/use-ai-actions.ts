import React from 'react';

import type {
  BrainstormNode,
  ClarifyResult,
  ClarifyTurn,
  ExpandResult,
  ExploreMode,
  IntentsResult,
  ModifyResult,
  OutlineResult,
  ResearchResult,
  Translate,
} from '../../shared/types.js';
import { postApi } from '../api.js';
import { buildContextText, buildPath, makeId } from '../model.js';
import {
  INTERVIEW_CARD_WIDTH,
  NODE_WIDTH,
  V_GAP,
  childPositionOf,
  estimateNodeHeight,
  makeNode,
  nodeText,
  reflowChildren,
  stackChildrenY,
  tidyLayout,
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
  /** Runtime-only enter animation markers (ids cleared by the editor). */
  markEntering?: (ids: string[]) => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && /abort/iu.test(error.name + error.message);
}

function mergeContext(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part !== '')
    .join('\n')
    .slice(0, 6000);
}

function collectClarifyPrior(nodes: BrainstormNode[], rootId: string): ClarifyTurn[] {
  return nodes
    .filter(
      (node) =>
        node.clarifyRootId === rootId &&
        node.kind === 'question' &&
        typeof node.answer === 'string' &&
        node.answer.trim() !== '',
    )
    .sort((a, b) => (a.clarifyRound || 0) - (b.clarifyRound || 0))
    .map((node) => ({ question: node.content || '', answer: (node.answer || '').trim() }));
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

  const reflowParent = (parentId: string) => {
    const { sizes, mutate } = depsRef.current;
    mutate((previous) => reflowChildren(previous, sizes, parentId));
  };

  /** Kept for retry of legacy expand nodes on old boards; UI no longer starts expand. */
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
      mutate((previous) =>
        reflowChildren(
          [
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
          ],
          depsRef.current.sizes,
          ideaId,
        ),
      );
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
      reflowParent(ideaId);
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

  const startOutline = async (
    targetNodeId: string,
    userContext = '',
    existingOutlineId?: string,
  ) => {
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
    const clarifyRootId =
      target.kind === 'interview'
        ? target.parentId || targetNodeId
        : target.clarifyRootId || targetNodeId;
    const prior = collectClarifyPrior(current, clarifyRootId);
    const priorText =
      prior.length === 0
        ? ''
        : `访谈问答：\n${prior.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n')}`;
    const context = mergeContext([
      buildContextText(current, targetNodeId),
      nodeText(target) ? `当前节点内容：${nodeText(target)}` : '',
      priorText,
      userContext.trim() ? `用户调研要求：${userContext.trim()}` : '',
    ]);
    let outlineId = existingOutlineId;
    if (!outlineId) {
      const position = childPosition(targetNodeId);
      outlineId = makeId();
      mutate((previous) =>
        reflowChildren(
          [
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
          ],
          sizes,
          targetNodeId,
        ),
      );
      setSelectedId(outlineId);
    } else {
      updateNode(outlineId, { status: 'thinking', busy: 'outline', error: null });
    }
    const signal = beginRequest(`outline:${outlineId}`);
    try {
      const interviewPath =
        path.path.length > 0
          ? path.path
          : prior.map((item) => ({ question: item.question, choice: item.answer }));
      const result: OutlineResult = await postApi(
        'outline',
        {
          idea: path.idea || nodeText(target),
          path: interviewPath,
          context,
        },
        signal,
      );
      updateNode(outlineId, {
        status: 'ready',
        busy: null,
        title: result.title,
        content: result.overview || '',
        points: result.points,
        confirmed: false,
        error: null,
        retry: null,
      });
      reflowParent(targetNodeId);
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
    const { t, nodesRef, sizes, mutate, updateNode, setSelectedId } = depsRef.current;
    const current = nodesRef.current;
    const outline = current.find((node) => node.id === outlineId);
    if (!outline || outline.kind !== 'outline') return;
    const path = buildPath(current, outlineId);
    let resultId = existingResultId;
    if (!resultId) {
      const position = childPosition(outlineId);
      resultId = makeId();
      mutate((previous) =>
        reflowChildren(
          [
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
          ],
          sizes,
          outlineId,
        ),
      );
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
      reflowParent(outlineId);
    } catch (error) {
      if (isAbortError(error)) return;
      updateNode(resultId, {
        status: 'error',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const findInterviewForSource = (sourceId: string): BrainstormNode | undefined => {
    const { nodesRef } = depsRef.current;
    return nodesRef.current.find(
      (node) => node.kind === 'interview' && node.parentId === sourceId && !node.confirmed,
    );
  };

  const appendIntentChildren = (
    parentId: string,
    intents: IntentsResult['intents'],
    quickExpand: boolean,
  ) => {
    const { sizes, mutate, markEntering } = depsRef.current;
    const origin = stackChildrenY(depsRef.current.nodesRef.current, sizes, parentId);
    if (!origin) return;
    let { x, y } = origin;
    const children: BrainstormNode[] = [];
    for (const intent of intents) {
      const content = [intent.label, intent.detail, intent.rationale ? `依据：${intent.rationale}` : '']
        .filter((part) => part !== '')
        .join('\n');
      const child = makeNode({
        id: makeId(),
        kind: 'intent',
        title: intent.label || '',
        content,
        parentId,
        x,
        y,
        width: NODE_WIDTH,
        quickExpand,
      });
      children.push(child);
      y += estimateNodeHeight(child) + V_GAP;
    }
    markEntering?.(children.map((child) => child.id));
    mutate((previous) => reflowChildren([...previous, ...children], sizes, parentId));
  };

  const generateDirections = async (parentId: string, prompt: string, mode: ExploreMode) => {
    const { nodesRef, updateNode } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === parentId);
    if (!node) return;
    updateNode(parentId, { status: 'thinking', busy: 'intents', error: null });
    const signal = beginRequest(`intents:${parentId}`);
    try {
      const context = mergeContext([
        buildContextText(nodesRef.current, parentId),
        prompt.trim() ? `发散要求：${prompt.trim()}` : '',
      ]);
      const result: IntentsResult = await postApi(
        'intents',
        { content: nodeText(node), prompt, context, mode },
        signal,
      );
      updateNode(parentId, { status: 'ready', busy: null, error: null });
      appendIntentChildren(parentId, result.intents, mode === 'quick');
    } catch (error) {
      if (isAbortError(error)) return;
      updateNode(parentId, {
        status: 'ready',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const startDiverge = async (nodeId: string) => {
    await generateDirections(nodeId, '', 'quick');
  };

  /** Append next interview question into the group, or finish → outline. */
  const runInterviewRound = async (rootId: string, interviewId: string, prompt = '') => {
    const { t, nodesRef, sizes, mutate, updateNode, setSelectedId, markEntering } = depsRef.current;
    const root = nodesRef.current.find((item) => item.id === rootId);
    const interview = nodesRef.current.find((item) => item.id === interviewId);
    if (!root || !interview || interview.kind !== 'interview') return;
    const prior = collectClarifyPrior(nodesRef.current, rootId);
    const round = prior.length + 1;
    updateNode(interviewId, { status: 'thinking', busy: 'clarify', error: null, content: '' });
    const signal = beginRequest(`clarify:${rootId}:${round}`);
    try {
      const context = buildContextText(nodesRef.current, rootId);
      const result: ClarifyResult = await postApi(
        'clarify',
        { content: nodeText(root), prompt, context, prior, round },
        signal,
      );
      if (result.done) {
        updateNode(interviewId, {
          status: 'ready',
          busy: null,
          confirmed: true,
          content: '',
          error: null,
        });
        // Outline hangs off the interview group (to its right).
        await startOutline(interviewId, prompt);
        return;
      }
      const position = childPosition(interviewId);
      const questionId = makeId();
      markEntering?.([questionId]);
      mutate((previous) =>
        reflowChildren(
          [
            ...previous.map((node) =>
              node.id === interviewId
                ? {
                    ...node,
                    status: 'ready' as const,
                    busy: null,
                    content: '',
                    error: null,
                  }
                : node,
            ),
            makeNode({
              id: questionId,
              kind: 'question',
              title: t('brainstorm.clarifyTitle'),
              content: result.question || '',
              options: result.options || [],
              answerMode: true,
              answer: '',
              clarifyRound: round,
              clarifyRootId: rootId,
              parentId: interviewId,
              x: position.x,
              y: position.y,
              width: INTERVIEW_CARD_WIDTH,
            }),
          ],
          sizes,
          interviewId,
        ),
      );
      setSelectedId(questionId);
    } catch (error) {
      if (isAbortError(error)) return;
      const message = error instanceof Error ? error.message : String(error);
      updateNode(interviewId, { status: 'ready', busy: null, error: message });
    }
  };

  const startInterview = async (sourceId: string) => {
    const { t, nodesRef, sizes, mutate, updateNode, setSelectedId, markEntering } = depsRef.current;
    const source = nodesRef.current.find((item) => item.id === sourceId);
    if (!source) return;
    const existing = findInterviewForSource(sourceId);
    if (existing) {
      setSelectedId(existing.id);
      const pending = nodesRef.current.find(
        (node) =>
          node.parentId === existing.id &&
          node.kind === 'question' &&
          !(typeof node.answer === 'string' && node.answer.trim() !== ''),
      );
      if (pending) {
        setSelectedId(pending.id);
        return;
      }
      if (!existing.confirmed) {
        void runInterviewRound(sourceId, existing.id);
      }
      return;
    }
    const position = childPosition(sourceId);
    const interviewId = makeId();
    markEntering?.([interviewId]);
    mutate((previous) =>
      reflowChildren(
        [
          ...previous,
          makeNode({
            id: interviewId,
            kind: 'interview',
            title: t('brainstorm.interviewTitle'),
            content: '',
            status: 'thinking',
            busy: 'clarify',
            parentId: sourceId,
            x: position.x,
            y: position.y,
            width: 96,
          }),
        ],
        sizes,
        sourceId,
      ),
    );
    setSelectedId(interviewId);
    await runInterviewRound(sourceId, interviewId);
  };

  const interviewIdForQuestion = (question: BrainstormNode): string | null => {
    if (question.parentId) {
      const parent = depsRef.current.nodesRef.current.find((item) => item.id === question.parentId);
      if (parent?.kind === 'interview') return parent.id;
    }
    return null;
  };

  const submitClarifyAnswer = (questionId: string, answer: string) => {
    const { nodesRef, updateNode } = depsRef.current;
    const text = answer.trim();
    if (text === '') return;
    const node = nodesRef.current.find((item) => item.id === questionId);
    if (!node || node.kind !== 'question' || !node.clarifyRootId) return;
    if (node.answer && node.selectedOptionId) return;
    updateNode(questionId, {
      answer: text,
      answeredAt: Date.now(),
      selectedOptionId: node.selectedOptionId || 'custom',
      error: null,
    });
    const interviewId = interviewIdForQuestion(node);
    if (interviewId) {
      void runInterviewRound(node.clarifyRootId, interviewId);
      return;
    }
    void startInterview(node.clarifyRootId);
  };

  const selectOption = (questionId: string, optionId: string) => {
    const { nodesRef, updateNode } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === questionId);
    if (!node || node.selectedOptionId || node.status !== 'ready') return;
    const option = node.options.find((item) => item.id === optionId);
    if (!option) return;
    if (node.clarifyRootId) {
      const answer = [option.label, option.description].filter((part) => part !== '').join('：');
      updateNode(questionId, { selectedOptionId: optionId, answer, answeredAt: Date.now() });
      const interviewId = interviewIdForQuestion(node);
      if (interviewId) {
        void runInterviewRound(node.clarifyRootId, interviewId);
        return;
      }
      void startInterview(node.clarifyRootId);
      return;
    }
    updateNode(questionId, { selectedOptionId: optionId });
  };

  const confirmOutline = (outlineId: string) => {
    const { nodesRef, updateNode } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === outlineId);
    if (!node || node.kind !== 'outline' || node.status !== 'ready' || node.confirmed) return;
    updateNode(outlineId, { confirmed: true, error: null });
    void runResearch(outlineId);
  };

  const confirmStatement = (statementId: string, prompt = '') => {
    const { nodesRef, updateNode } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === statementId);
    if (!node || node.kind !== 'statement' || node.status !== 'ready' || node.confirmed) return;
    updateNode(statementId, { confirmed: true, error: null });
    void generateDirections(statementId, prompt, 'quick');
  };

  const continueClarifyFromStatement = (statementId: string) => {
    const { nodesRef } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === statementId);
    if (!node || node.kind !== 'statement' || node.confirmed) return;
    const rootId = node.parentId;
    if (!rootId) return;
    void startInterview(rootId);
  };

  const reviseResult = async (nodeId: string, instruction: string) => {
    const { nodesRef, updateNode, setModal } = depsRef.current;
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node || node.kind !== 'result') return;
    setModal(null);
    updateNode(nodeId, { status: 'thinking', busy: 'modify', error: null });
    const signal = beginRequest(`modify:${nodeId}`);
    try {
      const comments = Array.isArray(node.comments) ? node.comments : [];
      const mergedInstruction = [instruction.trim(), comments.length ? `已有评论：\n- ${comments.join('\n- ')}` : '']
        .filter((part) => part !== '')
        .join('\n');
      const context = JSON.stringify(buildPath(nodesRef.current, nodeId));
      const result: ModifyResult = await postApi(
        'modify',
        {
          node: { kind: node.kind, title: node.title, content: node.content, points: node.points || [] },
          instruction: mergedInstruction,
          context,
        },
        signal,
      );
      const nodeResult = result as Extract<ModifyResult, { title: string }>;
      const nextPoints =
        Array.isArray(nodeResult.points) && nodeResult.points.length > 0
          ? nodeResult.points
          : node.points || [];
      updateNode(nodeId, {
        status: 'ready',
        busy: null,
        title: nodeResult.title || node.title,
        content: nextPoints.length > 0 ? '' : nodeResult.content || node.content || '',
        points: nextPoints,
        error: null,
      });
    } catch (error) {
      if (isAbortError(error)) return;
      updateNode(nodeId, {
        status: 'ready',
        busy: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const addResultComment = (nodeId: string, comment: string) => {
    const text = comment.trim();
    if (text === '') return;
    depsRef.current.updateNode(nodeId, (node) => ({
      comments: [...(Array.isArray(node.comments) ? node.comments : []), text],
    }));
  };

  const retryNode = (nodeId: string) => {
    const node = depsRef.current.nodesRef.current.find((item) => item.id === nodeId);
    if (!node || !node.retry) return;
    if (node.retry.type === 'expand') void runExpand(node.retry.ideaId, nodeId);
    else if (node.retry.type === 'outline') void startOutline(node.retry.targetNodeId, '', nodeId);
    else if (node.retry.type === 'research') void runResearch(node.retry.outlineId, nodeId);
  };

  const addIdea = (text: string, parentId: string | null) => {
    const {
      t,
      canvasRef,
      panRef,
      zoomRef,
      sizes,
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
    mutate((previous) => {
      const next = [
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
      ];
      return parentId ? reflowChildren(next, sizes, parentId) : next;
    });
    setSelectedId(id);
    setModal(null);
    if (!parentId) void startInterview(id);
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

  const tidyBoard = () => {
    const { sizes, mutate } = depsRef.current;
    mutate((previous) => tidyLayout(previous, sizes));
  };

  return {
    startOutline,
    startInterview,
    startDiverge,
    selectOption,
    submitClarifyAnswer,
    confirmOutline,
    confirmStatement,
    continueClarifyFromStatement,
    reviseResult,
    addResultComment,
    retryNode,
    addIdea,
    addFreeNodeAt,
    tidyBoard,
  };
}
