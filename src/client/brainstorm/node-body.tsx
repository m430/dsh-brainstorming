import React from 'react';

import type { BrainstormNode, Translate } from '../../shared/types.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { Spinner } from '../ui/spinner.js';
import { Textarea } from '../ui/textarea.js';
import type { NodePatch } from './types.js';

export function editsPoints(node: BrainstormNode): boolean {
  return node.kind === 'outline' || (node.kind === 'result' && Array.isArray(node.points) && node.points.length > 0);
}

export function NodeStatus({ node, t }: { node: BrainstormNode; t: Translate }) {
  if (node.status !== 'thinking') return null;
  const key =
    node.busy === 'modify'
      ? 'brainstorm.modifying'
      : node.busy === 'research'
        ? 'brainstorm.researching'
        : node.busy === 'outline'
          ? 'brainstorm.outlineGenerating'
          : node.busy === 'intents'
            ? 'brainstorm.intentAnalyzing'
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
      </div>
    );
  }

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
}

export function NodeBody(props: NodeBodyProps) {
  const { node, t, editing, setEditing, onCancelEdit, draft, setDraft, onUpdateNode, onOption, onConfirmOutline } = props;
  if (editing) {
    const save = () => {
      const value = draft.trim();
      if (value === '') return;
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
          onUpdateNode(node.id, { points, content: '', error: null });
        }
      } else {
        onUpdateNode(node.id, { content: value, error: null });
      }
      setEditing(false);
    };
    return (
      <div className="bn-editArea" onPointerDown={(event) => event.stopPropagation()}>
        <Textarea
          className="bn-editTextarea"
          value={draft}
          placeholder={node.freeNode ? t('brainstorm.freeNodePlaceholder') : undefined}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              save();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancelEdit();
            }
          }}
        />
        <div className="bn-editActions">
          <Button variant="outline" size="sm" onClick={onCancelEdit}>
            {t('brainstorm.cancel')}
          </Button>
          <Button variant="default" size="sm" onClick={save} disabled={draft.trim() === ''}>
            {t('brainstorm.save')}
          </Button>
        </div>
      </div>
    );
  }
  if (node.kind === 'question' && node.answerMode) {
    return (
      <div>
        <p className="bn-content">{node.content || t('brainstorm.emptyNode')}</p>
        {Array.isArray(node.points) && node.points.length > 0 ? (
          <ul className="bn-points">
            {node.points.map((point, index) => <li key={String(index)}>{point}</li>)}
          </ul>
        ) : null}
        <AnswerBox node={node} t={t} onAnswer={props.onAnswer} />
      </div>
    );
  }
  if (node.kind === 'question') {
    return (
      <div>
        <p className="bn-content">{node.content || t('brainstorm.emptyNode')}</p>
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
  if (node.kind === 'outline') {
    return (
      <div>
        {Array.isArray(node.points) && node.points.length > 0 ? (
          <ul className="bn-points bn-outlinePoints">
            {node.points.map((point, index) => <li key={String(index)}>{point}</li>)}
          </ul>
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
  return (
    <div>
      {node.content ? <p className="bn-content">{node.content}</p> : null}
      {Array.isArray(node.points) && node.points.length > 0 ? (
        <ul className="bn-points">
          {node.points.map((point, index) => <li key={String(index)}>{point}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
