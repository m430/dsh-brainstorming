import React from 'react';

import type { BrainstormNode, Translate } from '../../shared/types.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { Markdown } from '../ui/markdown.js';
import { Spinner } from '../ui/spinner.js';
import { Textarea } from '../ui/textarea.js';
import type { NodePatch } from './types.js';

export function editsPoints(node: BrainstormNode): boolean {
  return (
    node.kind === 'outline' ||
    node.kind === 'statement' ||
    (node.kind === 'result' && Array.isArray(node.points) && node.points.length > 0)
  );
}

export function NodeStatus({ node, t }: { node: BrainstormNode; t: Translate }) {
  if (node.status !== 'thinking') return null;
  // Interview shows Thinking… in the group title instead.
  if (node.kind === 'interview') return null;
  const key =
    node.busy === 'modify'
      ? 'brainstorm.modifying'
      : node.busy === 'research'
        ? 'brainstorm.researching'
        : node.busy === 'outline'
          ? 'brainstorm.outlineGenerating'
          : node.busy === 'intents'
            ? 'brainstorm.intentAnalyzing'
            : node.busy === 'clarify'
              ? 'brainstorm.interviewing'
              : node.busy === 'statement'
                ? 'brainstorm.statementBuilding'
                : node.busy === 'questions'
                  ? 'brainstorm.asking'
                  : 'brainstorm.thinking';
  return (
    <div className="bn-status">
      <Spinner />
      {t(key)}
    </div>
  );
}

interface AnswerBoxProps {
  node: BrainstormNode;
  t: Translate;
  onAnswer: (id: string, answer: string) => void;
}

function AnswerBox({ node, t, onAnswer }: AnswerBoxProps) {
  const [draft, setDraft] = React.useState(node.answer || '');
  const [editing, setEditing] = React.useState(!node.answer);

  React.useEffect(() => {
    if (!editing) setDraft(node.answer || '');
  }, [node.answer, editing]);

  if (node.answer && !editing) {
    return (
      <div className="bn-answer" onDoubleClick={(event) => event.stopPropagation()}>
        <p className="bn-answerText">
          <span className="bn-answerLabel">{t('brainstorm.answerLabel')}</span>
          {node.answer}
        </p>
        {!node.clarifyRootId ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setDraft(node.answer || '');
              setEditing(true);
            }}
          >
            {t('brainstorm.answerUpdate')}
          </Button>
        ) : null}
      </div>
    );
  }

  if (node.selectedOptionId && node.clarifyRootId) return null;

  return (
    <div className="bn-answer" onDoubleClick={(event) => event.stopPropagation()}>
      <Textarea
        className="bn-answerInput"
        value={draft}
        placeholder={t('brainstorm.answerPlaceholder')}
        onChange={(event) => setDraft(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <div className="bn-answerActions">
        <Button
          variant="default"
          size="xs"
          disabled={draft.trim() === ''}
          onClick={() => {
            const value = draft.trim();
            if (value === '') return;
            onAnswer(node.id, value);
            setEditing(false);
          }}
        >
          {t('brainstorm.answerSubmit')}
        </Button>
      </div>
    </div>
  );
}

function ResultComments({
  node,
  t,
  onAddComment,
  onRevise,
}: {
  node: BrainstormNode;
  t: Translate;
  onAddComment: (id: string, comment: string) => void;
  onRevise: (node: BrainstormNode) => void;
}) {
  const [draft, setDraft] = React.useState('');
  const comments = Array.isArray(node.comments) ? node.comments : [];
  return (
    <div className="bn-comments" onPointerDown={(event) => event.stopPropagation()}>
      {comments.length > 0 ? (
        <ul className="bn-commentList">
          {comments.map((comment, index) => (
            <li key={`${index}-${comment.slice(0, 12)}`}>
              <Markdown source={comment} />
            </li>
          ))}
        </ul>
      ) : null}
      <Textarea
        className="bn-commentInput"
        value={draft}
        placeholder={t('brainstorm.commentPlaceholder')}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="bn-outlineActions">
        <Button
          variant="outline"
          size="xs"
          disabled={draft.trim() === ''}
          onClick={() => {
            const value = draft.trim();
            if (value === '') return;
            onAddComment(node.id, value);
            setDraft('');
          }}
        >
          {t('brainstorm.commentAdd')}
        </Button>
        <Button variant="default" size="xs" onClick={() => onRevise(node)}>
          {t('brainstorm.reviseFromComments')}
        </Button>
      </div>
    </div>
  );
}

function MarkdownPoints({ points }: { points: string[] }) {
  if (!Array.isArray(points) || points.length === 0) return null;
  return (
    <ol className="bn-mdPoints">
      {points.map((point, index) => (
        <li key={`${index}-${point.slice(0, 24)}`}>
          <Markdown source={point} />
        </li>
      ))}
    </ol>
  );
}

function InlineEditArea({
  node,
  t,
  draft,
  setDraft,
  setEditing,
  onCancelEdit,
  onUpdateNode,
}: {
  node: BrainstormNode;
  t: Translate;
  draft: string;
  setDraft: (draft: string) => void;
  setEditing: (editing: boolean) => void;
  onCancelEdit: () => void;
  onUpdateNode: (id: string, patch: NodePatch) => void;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const skipBlurSaveRef = React.useRef(false);

  const resize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  }, []);

  React.useLayoutEffect(() => {
    resize();
  }, [draft, resize]);

  const save = () => {
    const value = draft.trim();
    if (value === '') {
      onCancelEdit();
      return;
    }
    if (editsPoints(node)) {
      const points = value
        .split(/\r?\n/u)
        .map((item) => item.trim().replace(/^[-*·]\s*/u, ''))
        .filter((item) => item !== '')
        .slice(0, 12);
      const minimum = node.kind === 'outline' ? 2 : 1;
      if (points.length < minimum) {
        onUpdateNode(node.id, {
          error: node.kind === 'outline'
            ? t('brainstorm.outlineNeedTwoPoints')
            : t('brainstorm.pointsNeedOne'),
        });
        return;
      }
      if (node.kind === 'outline') {
        onUpdateNode(node.id, { points, confirmed: false, error: null });
      } else {
        onUpdateNode(node.id, { points, content: node.kind === 'statement' ? points[0] || node.content : '', error: null });
      }
    } else {
      onUpdateNode(node.id, { content: value, error: null });
    }
    setEditing(false);
  };

  return (
    <div className="bn-editArea" onPointerDown={(event) => event.stopPropagation()}>
      <Textarea
        ref={textareaRef}
        className="bn-editTextarea"
        value={draft}
        placeholder={node.freeNode ? t('brainstorm.freeNodePlaceholder') : undefined}
        autoFocus
        rows={1}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (skipBlurSaveRef.current) {
            skipBlurSaveRef.current = false;
            return;
          }
          save();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            save();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            skipBlurSaveRef.current = true;
            onCancelEdit();
          }
        }}
      />
    </div>
  );
}

export interface NodeBodyProps {
  node: BrainstormNode;
  t: Translate;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  onCancelEdit: () => void;
  draft: string;
  setDraft: (draft: string) => void;
  onUpdateNode: (id: string, patch: NodePatch) => void;
  onAnswer: (id: string, answer: string) => void;
  onOption: (nodeId: string, optionId: string) => void;
  onConfirmOutline: (id: string) => void;
  onConfirmStatement?: (id: string) => void;
  onContinueClarify?: (id: string) => void;
  onAddComment?: (id: string, comment: string) => void;
  onReviseResult?: (node: BrainstormNode) => void;
  onRetry?: (nodeId: string) => void;
}

function WarningIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.6 14.4 13.2H1.6L8 1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8 6.2v3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function NodeBody(props: NodeBodyProps) {
  const {
    node,
    t,
    editing,
    setEditing,
    onCancelEdit,
    draft,
    setDraft,
    onUpdateNode,
    onOption,
    onConfirmOutline,
    onConfirmStatement,
    onContinueClarify,
    onAddComment,
    onReviseResult,
    onRetry,
  } = props;
  if (editing) {
    return (
      <InlineEditArea
        node={node}
        t={t}
        draft={draft}
        setDraft={setDraft}
        setEditing={setEditing}
        onCancelEdit={onCancelEdit}
        onUpdateNode={onUpdateNode}
      />
    );
  }

  if (node.kind === 'interview') {
    const thinking = node.status === 'thinking';
    const failed = Boolean(node.error) && !thinking;
    return (
      <div className="bn-groupTitle" aria-busy={thinking || undefined}>
        <span className="bn-groupTitleText">{t('brainstorm.interviewTitle')}</span>
        {thinking ? (
          <span className="bn-groupThinking">
            <Spinner />
            {t('brainstorm.interviewThinking')}
          </span>
        ) : null}
        {failed ? (
          <span className="bn-groupWarn">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="bn-groupWarnButton"
              aria-label={`${t('brainstorm.error')}：${node.error || ''}。${t('brainstorm.retry')}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onRetry?.(node.id);
              }}
            >
              <WarningIcon />
            </Button>
            <span className="bn-groupWarnTip" role="tooltip">
              {node.error}
              <span className="bn-groupWarnTipAction">{t('brainstorm.retry')}</span>
            </span>
          </span>
        ) : null}
      </div>
    );
  }

  if (node.kind === 'question' && node.clarifyRootId) {
    const answered = typeof node.answer === 'string' && node.answer.trim() !== '';
    const serial = node.clarifyRound && node.clarifyRound > 0 ? node.clarifyRound : 1;
    if (answered) {
      return (
        <div className="bn-qaCard">
          <div className="bn-qaSerial">{serial}</div>
          <div className="bn-qaBlock">
            <p className="bn-qaLabel">{t('brainstorm.qaQuestion')}</p>
            <Markdown source={node.content || t('brainstorm.emptyNode')} />
          </div>
          <div className="bn-qaBlock">
            <p className="bn-qaLabel">{t('brainstorm.qaAnswer')}</p>
            <Markdown source={node.answer || ''} />
          </div>
        </div>
      );
    }
    return (
      <div>
        <div className="bn-qaSerialPending">{serial}</div>
        <Markdown className="bn-content" source={node.content || t('brainstorm.emptyNode')} />
        {Array.isArray(node.options) && node.options.length > 0 && !node.selectedOptionId ? (
          <div className="bn-options">
            {node.options.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                className={`bn-option${option.recommended ? ' bn-optionRecommended' : ''}`}
                disabled={node.status === 'thinking'}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onOption(node.id, option.id)}
              >
                <span className="bn-optionLabel">
                  <span className="bn-optionKey" aria-hidden="true">{option.id}</span>
                  {option.label}
                  {option.recommended ? <Badge>{t('brainstorm.optionRecommended')}</Badge> : null}
                </span>
                {option.description ? <span className="bn-optionDesc">{option.description}</span> : null}
              </Button>
            ))}
          </div>
        ) : null}
        <AnswerBox node={node} t={t} onAnswer={props.onAnswer} />
      </div>
    );
  }

  if (node.kind === 'question' && node.answerMode) {
    return (
      <div>
        <Markdown source={node.content || t('brainstorm.emptyNode')} />
        <MarkdownPoints points={node.points || []} />
        <AnswerBox node={node} t={t} onAnswer={props.onAnswer} />
      </div>
    );
  }

  if (node.kind === 'question') {
    return (
      <div>
        <Markdown source={node.content || t('brainstorm.emptyNode')} />
        {Array.isArray(node.options) && node.options.length > 0 ? (
          <div className="bn-options">
            {node.options.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                className={`bn-option${node.selectedOptionId === option.id ? ' bn-optionSelected' : ''}`}
                disabled={Boolean(node.selectedOptionId) || node.status === 'thinking'}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onOption(node.id, option.id)}
              >
                <span className="bn-optionLabel">
                  <span className="bn-optionKey" aria-hidden="true">{option.id}</span>
                  {option.label}
                  {node.selectedOptionId === option.id ? <Badge>{t('brainstorm.selectedOption')}</Badge> : null}
                </span>
                {option.description ? <span className="bn-optionDesc">{option.description}</span> : null}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (node.kind === 'statement') {
    return (
      <div>
        {Array.isArray(node.points) && node.points.length > 0 ? (
          <MarkdownPoints points={node.points} />
        ) : (
          <Markdown source={node.content || t('brainstorm.emptyNode')} />
        )}
        {node.confirmed ? (
          <p className="bn-outlineConfirmed">{t('brainstorm.statementConfirmed')}</p>
        ) : node.status === 'ready' ? (
          <div className="bn-outlineActions" onPointerDown={(event) => event.stopPropagation()}>
            <Button variant="outline" size="xs" onClick={() => onContinueClarify?.(node.id)}>
              {t('brainstorm.statementContinue')}
            </Button>
            <Button variant="default" size="sm" className="bn-confirmButton" onClick={() => onConfirmStatement?.(node.id)}>
              {t('brainstorm.statementConfirm')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (node.kind === 'outline') {
    return (
      <div>
        {node.title ? <p className="bn-outlineTitle">{node.title}</p> : null}
        {node.content ? (
          <div className="bn-outlineOverview">
            <p className="bn-qaLabel">{t('brainstorm.outlineOverview')}</p>
            <Markdown source={node.content} />
          </div>
        ) : null}
        {Array.isArray(node.points) && node.points.length > 0 ? (
          <div className="bn-outlinePointsBlock">
            <p className="bn-qaLabel">{t('brainstorm.outlinePoints')}</p>
            <MarkdownPoints points={node.points} />
          </div>
        ) : null}
        {node.confirmed ? (
          <p className="bn-outlineConfirmed">{t('brainstorm.outlineConfirmed')}</p>
        ) : node.status === 'ready' ? (
          <div className="bn-outlineActions" onPointerDown={(event) => event.stopPropagation()}>
            <Button variant="outline" size="xs" onClick={() => setEditing(true)}>
              {t('brainstorm.outlineEdit')}
            </Button>
            <Button variant="default" size="sm" className="bn-confirmButton" onClick={() => onConfirmOutline(node.id)}>
              {t('brainstorm.outlineConfirm')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (node.kind === 'result') {
    return (
      <div>
        {node.title ? <p className="bn-outlineTitle">{node.title}</p> : null}
        {node.content ? <Markdown source={node.content} /> : null}
        <MarkdownPoints points={node.points || []} />
        {onAddComment && onReviseResult ? (
          <ResultComments node={node} t={t} onAddComment={onAddComment} onRevise={onReviseResult} />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {node.quickExpand ? <Badge className="bn-quickBadge">{t('brainstorm.quickExpandBadge')}</Badge> : null}
      {node.content ? <Markdown source={node.content} /> : null}
      <MarkdownPoints points={node.points || []} />
    </div>
  );
}
