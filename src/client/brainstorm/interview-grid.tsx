import React from 'react';

import type { BrainstormNode } from '../../shared/types.js';
import {
  GROUP_PAD,
  INTERVIEW_CARD_WIDTH,
  INTERVIEW_COLS,
  INTERVIEW_H_GAP,
  INTERVIEW_V_GAP,
  groupFrameOrigin,
} from './layout.js';

export interface InterviewGridProps {
  interview: BrainstormNode;
  questions: BrainstormNode[];
  children: React.ReactNode;
  selected?: boolean;
}

/**
 * Obsidian-style interview cluster: CSS grid packs each row to the tallest card
 * with a fixed gap. Card world-coordinates for edges/bounds stay algorithmic
 * (see interviewGroupBounds) — do not write DOM offsets back into React state
 * (that caused max-update-depth loops via ResizeObserver → mutate → render).
 */
export function InterviewGrid({
  interview,
  questions,
  children,
  selected = false,
}: InterviewGridProps) {
  // Same title-anchored frame origin as free groups (interview = locked-title group).
  const origin = groupFrameOrigin(interview);
  const empty = questions.length === 0;
  const minWidth = empty
    ? INTERVIEW_CARD_WIDTH * 2 + INTERVIEW_H_GAP + GROUP_PAD * 2
    : undefined;
  const minHeight = empty ? 120 + GROUP_PAD * 2 : undefined;

  return (
    <div
      className={`bn-groupFrame bn-interviewGrid${selected ? ' bn-groupFrameSelected' : ''}${empty ? ' bn-interviewGridEmpty' : ''}`}
      style={{
        left: origin.x,
        top: origin.y,
        gridTemplateColumns: `repeat(${INTERVIEW_COLS}, ${INTERVIEW_CARD_WIDTH}px)`,
        gap: `${INTERVIEW_V_GAP}px ${INTERVIEW_H_GAP}px`,
        padding: GROUP_PAD,
        ...(minWidth !== undefined ? { minWidth } : null),
        ...(minHeight !== undefined ? { minHeight } : null),
      }}
      data-interview-id={interview.id}
    >
      {children}
    </div>
  );
}
