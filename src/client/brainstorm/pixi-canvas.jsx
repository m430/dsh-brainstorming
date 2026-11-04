import React from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { estimateNodeHeight } from '../model.js';

const NODE_WIDTH = 320;

function sizeOf(node, sizes) {
  return {
    width: node.width || NODE_WIDTH,
    height: (sizes[node.id] && sizes[node.id].height) || estimateNodeHeight(node),
  };
}

export function PixiCanvas({ nodes, sizes, pan, zoom }) {
  const hostRef = React.useRef(null);
  const appRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const gridRef = React.useRef(null);
  const edgesRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let app;
    (async () => {
      try {
        app = new Application();
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          resizeTo: host,
        });
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        host.appendChild(app.canvas);
        app.canvas.style.display = 'block';
        app.canvas.style.pointerEvents = 'none';
        const world = new Container();
        const grid = new Graphics();
        const edges = new Graphics();
        world.addChild(edges);
        app.stage.addChild(grid, world);
        appRef.current = app;
        worldRef.current = world;
        gridRef.current = grid;
        edgesRef.current = edges;
        setReady(true);
      } catch (error) {
        console.error('dsh-brainstorming: PixiJS init failed', error);
      }
    })();
    return () => {
      disposed = true;
      appRef.current = null;
      worldRef.current = null;
      gridRef.current = null;
      edgesRef.current = null;
      if (app) {
        try {
          app.destroy(true, { children: true });
        } catch {
          // renderer already disposed
        }
      }
    };
  }, []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const update = () => setViewport({ width: host.clientWidth, height: host.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!ready || !appRef.current) return;
    const app = appRef.current;
    const host = hostRef.current;
    if (host && (app.renderer.width !== host.clientWidth || app.renderer.height !== host.clientHeight)) {
      app.renderer.resize(host.clientWidth, host.clientHeight);
    }
    const grid = gridRef.current;
    if (!grid) return;
    const width = host ? host.clientWidth : viewport.width;
    const height = host ? host.clientHeight : viewport.height;
    if (width <= 0 || height <= 0) return;
    let step = 24 * zoom;
    while (step < 12) step *= 2;
    const startX = ((pan.x % step) + step) % step;
    const startY = ((pan.y % step) + step) % step;
    grid.clear();
    const radius = Math.max(0.9, Math.min(1.4, zoom * 1.1));
    for (let x = startX; x <= width; x += step) {
      for (let y = startY; y <= height; y += step) {
        grid.circle(x, y, radius);
      }
    }
    grid.fill({ color: 0x9aa0a6, alpha: 0.32 });
  }, [ready, viewport, pan, zoom]);

  React.useEffect(() => {
    if (!ready || !worldRef.current) return;
    worldRef.current.position.set(pan.x, pan.y);
    worldRef.current.scale.set(zoom);
  }, [ready, pan, zoom]);

  React.useEffect(() => {
    if (!ready || !edgesRef.current) return;
    const edges = edgesRef.current;
    edges.clear();
    const byId = new Map(nodes.map((node) => [node.id, node]));
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
      edges.moveTo(x1, y1).bezierCurveTo(x1 + curve, y1, x2 - curve, y2, x2, y2);
    }
    edges.stroke({ color: 0x9aa0a6, width: 1.4, alpha: 0.55 });
  }, [ready, nodes, sizes]);

  return <div ref={hostRef} className="bn-pixi" aria-hidden="true" />;
}
