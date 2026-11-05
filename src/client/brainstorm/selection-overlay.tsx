import React from 'react';

import type { Translate } from '../../shared/types.js';
import { Button } from '../ui/button.js';

export interface SelectionOverlayProps {
  x: number;
  y: number;
  w: number;
  h: number;
  t: Translate;
  onCreateGroup: () => void;
}

/** Dashed frame + two cards — reads clearly as “group these”. */
function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="1.75"
        y="1.75"
        width="12.5"
        height="12.5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.5 2"
      />
      <rect x="4" y="4.25" width="3.75" height="3.25" rx="0.8" fill="currentColor" opacity="0.85" />
      <rect x="8.25" y="4.25" width="3.75" height="3.25" rx="0.8" fill="currentColor" opacity="0.85" />
      <rect x="4" y="8.5" width="8" height="3" rx="0.8" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/** Multi-select group preview + create-group action (delete is keyboard-only). */
export function SelectionOverlay({ x, y, w, h, t, onCreateGroup }: SelectionOverlayProps) {
  return (
    <div
      className="bn-selectionOverlay"
      style={{ left: x, top: y, width: w, height: h }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="bn-selectionAABB" aria-hidden="true" />
      <div className="bn-selectionTools">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="bn-selectionToolBtn bn-toolPrimary"
          aria-label={t('brainstorm.createGroup')}
          title={t('brainstorm.createGroup')}
          onClick={onCreateGroup}
        >
          <GroupIcon />
          <span>{t('brainstorm.createGroup')}</span>
        </Button>
      </div>
    </div>
  );
}
