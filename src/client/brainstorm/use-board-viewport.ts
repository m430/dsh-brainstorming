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

interface MarqueeState {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

export interface MarqueeScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    Boolean(target.closest?.('input, textarea, [contenteditable="true"]'))
  );
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function screenMarquee(state: MarqueeState): MarqueeScreenRect {
  const left = Math.min(state.originX, state.currentX);
  const top = Math.min(state.originY, state.currentY);
  return {
    left,
    top,
    width: Math.abs(state.currentX - state.originX),
    height: Math.abs(state.currentY - state.originY),
  };
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
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
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
  setSelectedIds,
}: BoardViewportArgs) {
  const panDrag = React.useRef<PanDragState | null>(null);
  const marqueeDrag = React.useRef<MarqueeState | null>(null);
  const sizesRef = React.useRef(sizes);
  sizesRef.current = sizes;
  const [spaceHeld, setSpaceHeld] = React.useState(false);
  const [panning, setPanning] = React.useState(false);
  const [marqueeRect, setMarqueeRect] = React.useState<MarqueeScreenRect | null>(null);
  const spaceHeldRef = React.useRef(false);

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

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      if (!panDrag.current) setPanning(false);
    };
    const onBlur = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      setPanning(false);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const finishMarquee = React.useCallback(
    (state: MarqueeState) => {
      const screen = screenMarquee(state);
      const zoom = zoomRef.current;
      const pan = panRef.current;
      const world = {
        x: (screen.left - pan.x) / zoom,
        y: (screen.top - pan.y) / zoom,
        width: screen.width / zoom,
        height: screen.height / zoom,
      };
      if (world.width < 4 / zoom && world.height < 4 / zoom) {
        setSelectedIds([]);
        return;
      }
      const hits: string[] = [];
      for (const node of nodesRef.current) {
        if (node.kind === 'interview' || node.kind === 'group') continue;
        const size = sizeOf(node, sizesRef.current);
        if (rectsIntersect(world, { x: node.x, y: node.y, width: size.width, height: size.height })) {
          hits.push(node.id);
        }
      }
      setSelectedIds(hits);
    },
    [nodesRef, panRef, setSelectedIds, zoomRef],
  );

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('.bn-zoom, .bn-empty .ui-btn, .ui-btn')) {
      return;
    }
    const onNode = event.target instanceof Element && Boolean(event.target.closest('.bn-nodeWrap'));
    if (onNode && !spaceHeldRef.current) return;

    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    const canvasRect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - canvasRect.left;
    const localY = event.clientY - canvasRect.top;

    if (spaceHeldRef.current) {
      panDrag.current = {
        startX: event.clientX,
        startY: event.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      setPanning(true);
      return;
    }

    marqueeDrag.current = {
      originX: localX,
      originY: localY,
      currentX: localX,
      currentY: localY,
    };
    setMarqueeRect({ left: localX, top: localY, width: 0, height: 0 });
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panState = panDrag.current;
    if (panState) {
      setPan({
        x: panState.panX + event.clientX - panState.startX,
        y: panState.panY + event.clientY - panState.startY,
      });
      return;
    }
    const box = marqueeDrag.current;
    if (!box) return;
    const canvasRect = event.currentTarget.getBoundingClientRect();
    box.currentX = event.clientX - canvasRect.left;
    box.currentY = event.clientY - canvasRect.top;
    setMarqueeRect(screenMarquee(box));
  };

  const onCanvasPointerUp = () => {
    if (panDrag.current) {
      panDrag.current = null;
      setPanning(false);
      return;
    }
    const box = marqueeDrag.current;
    marqueeDrag.current = null;
    setMarqueeRect(null);
    if (box) finishMarquee(box);
  };

  const canvasMode = panning ? 'pan' : spaceHeld ? 'space' : marqueeRect ? 'marquee' : 'default';

  return {
    fitView,
    zoomAt,
    spaceHeld,
    canvasMode,
    marqueeRect,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
  };
}
