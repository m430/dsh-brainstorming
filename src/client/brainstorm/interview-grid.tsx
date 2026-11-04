import React from 'react';

import type { BrainstormNode } from '../../shared/types.js';
import {
  INTERVIEW_CARD_WIDTH,
  INTERVIEW_COLS,
  INTERVIEW_GROUP_PAD,
  INTERVIEW_H_GAP,
  INTERVIEW_LABEL_HEIGHT,
  INTERVIEW_V_GAP,
} from './layout.js';

export interface InterviewGridProps {
  interview: BrainstormNode;
  questions: BrainstormNode[];
  children: React.ReactNode;
}

/**
 * Obsidian-style interview cluster: CSS grid packs each row to the tallest card
 * with a fixed gap. Card world-coordinates for edges/bounds stay algorithmic
 * (see interviewGroupBounds) — do not write DOM offsets back into React state
 * (that caused max-update-depth loops via ResizeObserver → mutate → render).
 */
export function InterviewGrid({ interview, questions, children }: InterviewGridProps) {
  const left = interview.x - INTERVIEW_GROUP_PAD;
  const top = interview.y + INTERVIEW_LABEL_HEIGHT;
  const empty = questions.length === 0;
  const minWidth = empty
    ? INTERVIEW_CARD_WIDTH * 2 + INTERVIEW_H_GAP + INTERVIEW_GROUP_PAD * 2
    : undefined;
  const minHeight = empty ? 120 + INTERVIEW_GROUP_PAD * 2 : undefined;

  return (
    <div
      className={`bn-interviewGrid${empty ? ' bn-interviewGridEmpty' : ''}`}
      style={{
        left,
        top,
        gridTemplateColumns: `repeat(${INTERVIEW_COLS}, ${INTERVIEW_CARD_WIDTH}px)`,
        gap: `${INTERVIEW_V_GAP}px ${INTERVIEW_H_GAP}px`,
        padding: INTERVIEW_GROUP_PAD,
        ...(minWidth !== undefined ? { minWidth } : null),
        ...(minHeight !== undefined ? { minHeight } : null),
      }}
      data-interview-id={interview.id}
    >
      {children}
    </div>
  );
}
