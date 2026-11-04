import React from 'react';

import type { BrainstormNode, Point } from '../../shared/types.js';
import { sizeOf } from './layout.js';
import type { NodeSizes } from './types.js';

interface PanDragState {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
}

export interface BoardViewportArgs {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nodesRef: React.MutableRefObject<BrainstormNode[]>;
  sizes: NodeSizes;
  panRef: React.MutableRefObject<Point>;
  zoomRef: React.MutableRefObject<number>;
  setPan: React.Dispatch<React.SetStateAction<Point>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useBoardViewport({
  canvasRef,
  nodesRef,
  sizes,
  panRef,
  zoomRef,
  setPan,
  setZoom,
  setSelectedId,
}: BoardViewportArgs) {
  const panDrag = React.useRef<PanDragState | null>(null);
  const sizesRef = React.useRef(sizes);
  sizesRef.current = sizes;

  const fitView = React.useCallback(() => {
    const element = canvasRef.current;
    const current = nodesRef.current;
    if (!element || current.length === 0) return;
    const rect = element.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of current) {
      const size = sizeOf(node, sizesRef.current);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + size.width);
      maxY = Math.max(maxY, node.y + size.height);
    }
    const padding = 90;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const nextZoom = Math.min(
      1.1,
      Math.max(0.3, Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height)),
    );
    setZoom(nextZoom);
    setPan({
      x: (rect.width - width * nextZoom) / 2 - minX * nextZoom,
      y: (rect.height - height * nextZoom) / 2 - minY * nextZoom,
    });
  }, [canvasRef, nodesRef, setPan, setZoom]);

  const zoomAt = React.useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const element = canvasRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const currentZoom = zoomRef.current;
      const nextZoom = Math.min(2, Math.max(0.3, currentZoom * factor));
      if (Math.abs(nextZoom - currentZoom) < 0.0001) return;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const currentPan = panRef.current;
      setPan({
        x: px - ((px - currentPan.x) * nextZoom) / currentZoom,
        y: py - ((py - currentPan.y) * nextZoom) / currentZoom,
      });
      setZoom(nextZoom);
    },
    [canvasRef, panRef, setPan, setZoom, zoomRef],
  );

  React.useEffect(() => {
    const element = canvasRef.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey || event.altKey) {
        zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0015));
      } else {
        setPan((previous) => ({ x: previous.x - event.deltaX, y: previous.y - event.deltaY }));
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [canvasRef, setPan, zoomAt]);

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('.bn-nodeWrap, .bn-zoom, .bn-empty .ui-btn, .ui-btn')) {
      return;
    }
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    panDrag.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    setSelectedId(null);
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = panDrag.current;
    if (!state) return;
    setPan({ x: state.panX + event.clientX - state.startX, y: state.panY + event.clientY - state.startY });
  };

  const onCanvasPointerUp = () => {
    panDrag.current = null;
  };

  return {
    fitView,
    zoomAt,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
  };
}
