import React from 'react';

interface DragState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

export function isInsideInteractiveElement(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, a, input, textarea') !== null;
}

export function useNodeDrag(args: {
  nodeId: string;
  x: number;
  y: number;
  zoom: number;
  editing: boolean;
  locked?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const { nodeId, x, y, zoom, editing, locked = false, onSelect, onMove } = args;
  const [dragging, setDragging] = React.useState(false);
  const drag = React.useRef<DragState | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (editing || event.button !== 0) return;
    if (isInsideInteractiveElement(event.target)) return;
    event.stopPropagation();
    onSelect(nodeId);
    if (locked) return;
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, originX: x, originY: y, moved: false };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (locked) return;
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.startX) / zoom;
    const dy = (event.clientY - state.startY) / zoom;
    if (!state.moved && Math.hypot(dx * zoom, dy * zoom) > 3) {
      state.moved = true;
      setDragging(true);
    }
    if (state.moved) onMove(nodeId, state.originX + dx, state.originY + dy);
  };

  const handlePointerUp = () => {
    if (drag.current && !drag.current.moved) onSelect(nodeId);
    drag.current = null;
    setDragging(false);
  };

  return { dragging, handlePointerDown, handlePointerMove, handlePointerUp };
}
