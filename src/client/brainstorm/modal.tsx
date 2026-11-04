import React from 'react';

import type { BrainstormNode, Translate } from '../../shared/types.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { Textarea } from '../ui/textarea.js';
import type { BrainstormModalState } from './types.js';

export interface BrainstormModalProps {
  modal: BrainstormModalState;
  node?: BrainstormNode | null;
  deleteCount: number;
  t: Translate;
  onClose: () => void;
  onSubmit: (value: string) => void;
  onDelete: () => void;
}

export function BrainstormModal({ modal, node, deleteCount, t, onClose, onSubmit, onDelete }: BrainstormModalProps) {
  const [text, setText] = React.useState('');
  const isDelete = modal.type === 'delete';
  const isResearch = modal.type === 'research';
  const isRevise = modal.type === 'revise';
  const allowEmpty = isResearch;

  const submit = () => {
    const value = text.trim();
    if (!allowEmpty && !isRevise && value === '') return;
    if (isRevise && value === '') return;
    onSubmit(value);
  };

  const title = isResearch
    ? t('brainstorm.researchTitle')
    : isRevise
      ? t('brainstorm.reviseTitle')
      : t('brainstorm.modalAddTitle');
  const hint = isResearch
    ? t('brainstorm.researchHint')
    : isRevise
      ? t('brainstorm.reviseHint')
      : t('brainstorm.modalAddHint');
  const placeholder = isResearch
    ? t('brainstorm.researchPlaceholder')
    : isRevise
      ? t('brainstorm.revisePlaceholder')
      : t('brainstorm.modalAddPlaceholder');
  const confirmLabel = isResearch
    ? t('brainstorm.researchConfirm')
    : isRevise
      ? t('brainstorm.reviseConfirm')
      : t('brainstorm.confirmAdd');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {isDelete ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('brainstorm.deleteTitle')}</DialogTitle>
              <DialogDescription>{t('brainstorm.deleteHint')}</DialogDescription>
            </DialogHeader>
            {node ? (
              <p className="bn-modalPreview">
                {[node.title, node.content].filter((part) => typeof part === 'string' && part !== '').join('\n')}
              </p>
            ) : null}
            {deleteCount > 0 ? <p className="bn-deleteCount">{t('brainstorm.deleteSubtree', { count: deleteCount })}</p> : null}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('brainstorm.cancel')}
              </Button>
              <Button variant="danger" onClick={onDelete}>
                {t('brainstorm.deleteConfirm')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{hint}</DialogDescription>
            </DialogHeader>
            {(isResearch || isRevise) && node ? (
              <p className="bn-modalPreview">{node.content || node.title || ''}</p>
            ) : null}
            <Textarea
              value={text}
              autoFocus
              placeholder={placeholder}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('brainstorm.cancel')}
              </Button>
              <Button variant="default" onClick={submit} disabled={!allowEmpty && text.trim() === ''}>
                {confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
