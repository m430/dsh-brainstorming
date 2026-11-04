import React from 'react';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { Textarea } from '../ui/textarea.jsx';
import { Spinner } from '../ui/spinner.jsx';

function editsPoints(node) {
  return node.kind === 'outline' || (node.kind === 'result' && Array.isArray(node.points) && node.points.length > 0);
}

function NodeTools({ node, t, onAsk, onAnalyzeIntent, onStartOutline, onModify, onAddIdea, onDelete }) {
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

function NodeStatus({ node, t }) {
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

function AnswerBox({ node, t, onAnswer }) {
  const [draft, setDraft] = React.useState(node.answer || '');
  const [editing, setEditing] = React.useState(!node.answer);

  React.useEffect(() => {
    if (!editing) setDraft(node.answer || '');
  }, [node.answer]);

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
            setDraft(node.answer);
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

function NodeBody(props) {
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
            error: node.kind === 'outline' ? '调研大纲至少需要两条。' : '请至少保留一条要点。',
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

export function NodeCard(props) {
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
  const [dragging, setDragging] = React.useState(false);
  const cardRef = React.useRef(null);
  const drag = React.useRef(null);

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
  }, [autoEdit]);

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
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(element);
    }
    return () => {
      if (observer) observer.disconnect();
    };
  }, [node.id, node.content, node.options && node.options.length, node.points && node.points.length, editing, onMeasure]);

  const handlePointerDown = (event) => {
    if (editing || event.button !== 0) return;
    if (event.target.closest('button, a, input, textarea')) return;
    event.stopPropagation();
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y, moved: false };
    onSelect(node.id);
  };
  const handlePointerMove = (event) => {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.startX) / zoom;
    const dy = (event.clientY - state.startY) / zoom;
    if (!state.moved && Math.hypot(dx * zoom, dy * zoom) > 3) {
      state.moved = true;
      setDragging(true);
    }
    if (state.moved) onMove(node.id, state.originX + dx, state.originY + dy);
  };
  const handlePointerUp = () => {
    if (drag.current && !drag.current.moved) onSelect(node.id);
    drag.current = null;
    setDragging(false);
  };

  return (
    <article
      className={`bn-nodeWrap${selected ? ' bn-selected' : ''}${dragging ? ' bn-dragging' : ''}`}
      style={{ left: node.x, top: node.y, width: node.width || 320 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={(event) => {
        if (event.target.closest('button, a, input, textarea')) return;
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
