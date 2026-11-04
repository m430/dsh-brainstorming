import React from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from './utils.js';

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;

export function DialogContent({ className, children, ...props }) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="ui-dialog-backdrop" />
      <BaseDialog.Popup className={cn('ui-dialog-content', className)} {...props}>
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('ui-dialog-header', className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('ui-dialog-footer', className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <BaseDialog.Title className={cn('ui-dialog-title', className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <BaseDialog.Description className={cn('ui-dialog-description', className)} {...props} />;
}
