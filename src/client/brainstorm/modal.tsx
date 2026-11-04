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
  const isModify = modal.type === 'modify';
  const isDelete = modal.type === 'delete';
  const isIntent = modal.type === 'intents';

  const submit = () => {
    const value = text.trim();
    if (!isIntent && value === '') return;
    onSubmit(value);
  };

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
              <DialogTitle>
                {isModify
                  ? t('brainstorm.modalModifyTitle')
                  : isIntent
                    ? t('brainstorm.intentTitle')
                    : t('brainstorm.modalAddTitle')}
              </DialogTitle>
              <DialogDescription>
                {isModify
                  ? t('brainstorm.modalModifyHint')
                  : isIntent
                    ? t('brainstorm.intentHint')
                    : t('brainstorm.modalAddHint')}
              </DialogDescription>
            </DialogHeader>
            {(isModify || isIntent) && node ? <p className="bn-modalPreview">{node.content || node.title || ''}</p> : null}
            <Textarea
              value={text}
              autoFocus
              placeholder={
                isModify
                  ? t('brainstorm.modalModifyPlaceholder')
                  : isIntent
                    ? t('brainstorm.intentPlaceholder')
                    : t('brainstorm.modalAddPlaceholder')
              }
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
              <Button variant="default" onClick={submit} disabled={!isIntent && text.trim() === ''}>
                {isModify
                  ? t('brainstorm.confirmModify')
                  : isIntent
                    ? t('brainstorm.intentAnalyze')
                    : t('brainstorm.confirmAdd')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
