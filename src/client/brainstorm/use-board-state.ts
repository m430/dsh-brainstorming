import React from 'react';

import type { Board, BoardPatch, BrainstormNode, Point } from '../../shared/types.js';
import type { NodePatch, NodeSizes } from './types.js';

export interface BoardState {
  nodes: BrainstormNode[];
  nodesRef: React.MutableRefObject<BrainstormNode[]>;
  pan: Point;
  setPan: React.Dispatch<React.SetStateAction<Point>>;
  panRef: React.MutableRefObject<Point>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  zoomRef: React.MutableRefObject<number>;
  sizes: NodeSizes;
  measure: (id: string, height: number) => void;
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  autoEditId: string | null;
  setAutoEditId: React.Dispatch<React.SetStateAction<string | null>>;
  mutate: (updater: (nodes: BrainstormNode[]) => BrainstormNode[]) => void;
  updateNode: (id: string, patch: NodePatch) => void;
}

/**
 * Editor owns nodes/pan/zoom for the mounted board lifetime.
 * Workspace owns Board[]; this hook copies board fields on mount and debounce-writes patches back.
 */
export function useBoardState(board: Board, onChange: (patch: BoardPatch) => void): BoardState {
  const [nodes, setNodes] = React.useState<BrainstormNode[]>(Array.isArray(board.nodes) ? board.nodes : []);
  const nodesRef = React.useRef<BrainstormNode[]>(nodes);
  const [pan, setPan] = React.useState<Point>(board.pan || { x: 120, y: 100 });
  const panRef = React.useRef<Point>(pan);
  const [zoom, setZoom] = React.useState<number>(typeof board.zoom === 'number' ? board.zoom : 1);
  const zoomRef = React.useRef<number>(zoom);
  const [sizes, setSizes] = React.useState<NodeSizes>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [autoEditId, setAutoEditId] = React.useState<string | null>(null);
  const persistRef = React.useRef({ nodes, pan, zoom });
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const mutate = (updater: (nodes: BrainstormNode[]) => BrainstormNode[]) => {
    const next = updater(nodesRef.current);
    nodesRef.current = next;
    setNodes(next);
  };

  const updateNode = (id: string, patch: NodePatch) => {
    mutate((previous) =>
      previous.map((node) =>
        node.id === id ? { ...node, ...(typeof patch === 'function' ? patch(node) : patch) } : node,
      ),
    );
  };

  const measure = React.useCallback((id: string, height: number) => {
    setSizes((previous) => {
      const prior = previous[id];
      if (prior && Math.abs(prior.height - height) < 2) return previous;
      return { ...previous, [id]: { height } };
    });
  }, []);

  React.useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  React.useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  React.useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const persist = React.useCallback(() => {
    const latest = persistRef.current;
    const root = latest.nodes.find((node) => node.kind === 'idea' && !node.parentId);
    onChangeRef.current({
      nodes: latest.nodes,
      pan: latest.pan,
      zoom: latest.zoom,
      nodeCount: latest.nodes.length,
      rootIdea: root && root.content ? root.content.slice(0, 80) : '',
      updatedAt: Date.now(),
    });
  }, []);

  React.useEffect(() => {
    persistRef.current = { nodes, pan, zoom };
    const timer = setTimeout(persist, 220);
    return () => clearTimeout(timer);
  }, [nodes, pan, zoom, persist]);

  React.useEffect(() => () => persist(), [persist]);

  return {
    nodes,
    nodesRef,
    pan,
    setPan,
    panRef,
    zoom,
    setZoom,
    zoomRef,
    sizes,
    measure,
    selectedId,
    setSelectedId,
    autoEditId,
    setAutoEditId,
    mutate,
    updateNode,
  };
}
