import React from 'react';

import type { BrainstormNode, Point } from '../../shared/types.js';
import { sizeOf } from './layout.js';
import type { NodeSizes } from './types.js';

export interface BoardBackdropProps {
  nodes: BrainstormNode[];
  sizes: NodeSizes;
  pan: Point;
  zoom: number;
}

/** Lightweight Canvas 2D grid + edge layer (replaces Pixi for bundle size). */
export function BoardBackdrop({ nodes, sizes, pan, zoom }: BoardBackdropProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [viewport, setViewport] = React.useState({ width: 0, height: 0, dpr: 1 });

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
    ctx.strokeStyle = 'rgba(154, 160, 166, 0.55)';
    ctx.lineWidth = 1.4 / zoom;
    const byId = new Map<string, BrainstormNode>(nodes.map((node) => [node.id, node]));
    for (const node of nodes) {
      if (!node.parentId) continue;
      const parent = byId.get(node.parentId);
      if (!parent) continue;
      const p = sizeOf(parent, sizes);
      const c = sizeOf(node, sizes);
      const x1 = parent.x + p.width;
      const y1 = parent.y + Math.min(p.height / 2, 120);
      const x2 = node.x;
      const y2 = node.y + Math.min(c.height / 2, 120);
      const curve = Math.max(40, Math.abs(x2 - x1) / 2);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + curve, y1, x2 - curve, y2, x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }, [nodes, sizes, pan, zoom, viewport]);

  return (
    <div ref={hostRef} className="bn-pixi" aria-hidden="true">
      <canvas ref={canvasRef} style={{ display: 'block', pointerEvents: 'none' }} />
    </div>
  );
}
