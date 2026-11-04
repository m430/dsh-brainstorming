import React from 'react';

import type { BrainstormNode, Point } from '../../shared/types.js';
import { interviewGroupBounds, sizeOf } from './layout.js';
import type { NodeSizes } from './types.js';

export interface BoardBackdropProps {
  nodes: BrainstormNode[];
  sizes: NodeSizes;
  pan: Point;
  zoom: number;
  /** nodeId → enter start timestamp (ms) for edge grow animation */
  enteringIds?: Record<string, number>;
}

const EDGE_GROW_MS = 520;

function cubicPoint(
  t: number,
  x1: number,
  y1: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x2: number,
  y2: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * u * x1 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x2,
    y: u * u * u * y1 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y2,
  };
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  size: number,
) {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - size * Math.cos(angle - Math.PI / 7), tipY - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(tipX - size * Math.cos(angle + Math.PI / 7), tipY - size * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

/** Lightweight Canvas 2D grid + edge layer (replaces Pixi for bundle size). */
export function BoardBackdrop({ nodes, sizes, pan, zoom, enteringIds = {} }: BoardBackdropProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [viewport, setViewport] = React.useState({ width: 0, height: 0, dpr: 1 });
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const update = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      setViewport({ width: host.clientWidth, height: host.clientHeight, dpr });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const hasAnimatingEdge = Object.keys(enteringIds).length > 0;
  React.useEffect(() => {
    if (!hasAnimatingEdge) return undefined;
    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hasAnimatingEdge, enteringIds]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height, dpr } = viewport;
    if (width <= 0 || height <= 0) return;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    let step = 24 * zoom;
    while (step < 12) step *= 2;
    const startX = ((pan.x % step) + step) % step;
    const startY = ((pan.y % step) + step) % step;
    const radius = Math.max(0.9, Math.min(1.4, zoom * 1.1));
    ctx.fillStyle = 'rgba(154, 160, 166, 0.32)';
    for (let x = startX; x <= width; x += step) {
      for (let y = startY; y <= height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const byId = new Map<string, BrainstormNode>(nodes.map((node) => [node.id, node]));

    // Interview group chrome is DOM (.bn-interviewGrid); canvas only draws edges.

    ctx.strokeStyle = 'rgba(154, 160, 166, 0.55)';
    ctx.fillStyle = 'rgba(154, 160, 166, 0.75)';
    ctx.lineWidth = 1.4 / zoom;
    const arrowSize = 9 / zoom;

    for (const node of nodes) {
      if (!node.parentId) continue;
      const parent = byId.get(node.parentId);
      if (!parent) continue;
      // Questions live inside the interview group — no per-card edges.
      if (parent.kind === 'interview' && node.kind === 'question') continue;

      const p = sizeOf(parent, sizes);
      const c = sizeOf(node, sizes);
      let x1 = parent.x + p.width;
      let y1 = parent.y + Math.min(p.height / 2, 120);
      // From interview group, attach to the group chrome's right edge.
      if (parent.kind === 'interview') {
        const bounds = interviewGroupBounds(nodes, sizes, parent.id);
        if (bounds) {
          x1 = bounds.x + bounds.w;
          y1 = bounds.y + Math.min(bounds.h / 2, 160);
        }
      }
      let x2 = node.x;
      let y2 = node.y + Math.min(c.height / 2, 120);
      // Into an interview group: land on the frame, not the outside title label.
      if (node.kind === 'interview') {
        const bounds = interviewGroupBounds(nodes, sizes, node.id);
        if (bounds) {
          x2 = bounds.x;
          y2 = bounds.y + Math.min(bounds.h / 2, 160);
        }
      }
      const cx1 = x1 + Math.max(40, Math.abs(x2 - x1) / 2);
      const cy1 = y1;
      const cx2 = x2 - Math.max(40, Math.abs(x2 - x1) / 2);
      const cy2 = y2;

      const enterAt = enteringIds[node.id];
      let progress = 1;
      if (typeof enterAt === 'number') {
        progress = Math.min(1, Math.max(0, (now - enterAt) / EDGE_GROW_MS));
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const endT = Math.max(0.02, progress);
      if (endT >= 0.999) {
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
      } else {
        const steps = 24;
        const end = Math.max(1, Math.floor(steps * endT));
        for (let i = 1; i <= end; i += 1) {
          const pt = cubicPoint(i / steps, x1, y1, cx1, cy1, cx2, cy2, x2, y2);
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();

      if (progress >= 0.85) {
        const tip = cubicPoint(endT, x1, y1, cx1, cy1, cx2, cy2, x2, y2);
        const prev = cubicPoint(Math.max(0, endT - 0.04), x1, y1, cx1, cy1, cx2, cy2, x2, y2);
        drawArrowHead(ctx, tip.x, tip.y, prev.x, prev.y, arrowSize);
      }
    }
    ctx.restore();
  }, [nodes, sizes, pan, zoom, viewport, enteringIds, now]);

  return (
    <div ref={hostRef} className="bn-pixi" aria-hidden="true">
      <canvas ref={canvasRef} style={{ display: 'block', pointerEvents: 'none' }} />
    </div>
  );
}
