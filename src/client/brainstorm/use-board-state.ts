import React from 'react';

import type { Board, BoardPatch, BrainstormNode, Point } from '../../shared/types.js';
import type { NodePatch, NodeSizes } from './types.js';

export type BoardSaveStatus = 'saved' | 'saving' | 'failed';

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
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  autoEditId: string | null;
  setAutoEditId: React.Dispatch<React.SetStateAction<string | null>>;
  mutate: (updater: (nodes: BrainstormNode[]) => BrainstormNode[]) => void;
  updateNode: (id: string, patch: NodePatch) => void;
  saveStatus: BoardSaveStatus;
  persistPatch: (patch: BoardPatch) => Promise<void>;
}

/**
 * Editor owns nodes/pan/zoom for the mounted board lifetime.
 * Workspace owns durable Board; this hook copies board fields on mount and debounce-writes patches back.
 */
export function useBoardState(
  board: Board,
  onChange: (patch: BoardPatch) => void | Promise<void>,
): BoardState {
  const [nodes, setNodes] = React.useState<BrainstormNode[]>(Array.isArray(board.nodes) ? board.nodes : []);
  const nodesRef = React.useRef<BrainstormNode[]>(nodes);
  const [pan, setPan] = React.useState<Point>(board.pan || { x: 120, y: 100 });
  const panRef = React.useRef<Point>(pan);
  const [zoom, setZoom] = React.useState<number>(typeof board.zoom === 'number' ? board.zoom : 1);
  const zoomRef = React.useRef<number>(zoom);
  const [sizes, setSizes] = React.useState<NodeSizes>({});
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const selectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1]! : null;
  const setSelectedId = React.useCallback((value: React.SetStateAction<string | null>) => {
    setSelectedIds((previous) => {
      const current = previous.length > 0 ? previous[previous.length - 1]! : null;
      const next = typeof value === 'function' ? value(current) : value;
      if (next === null) return [];
      if (previous.length === 1 && previous[0] === next) return previous;
      return [next];
    });
  }, []);
  const [autoEditId, setAutoEditId] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<BoardSaveStatus>('saved');
  const persistRef = React.useRef({ nodes, pan, zoom });
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const persistGeneration = React.useRef(0);

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

  const persistPatch = React.useCallback(async (patch: BoardPatch) => {
    const generation = ++persistGeneration.current;
    setSaveStatus('saving');
    try {
      await onChangeRef.current(patch);
      if (generation === persistGeneration.current) setSaveStatus('saved');
    } catch {
      if (generation === persistGeneration.current) setSaveStatus('failed');
    }
  }, []);

  const persistCanvas = React.useCallback(() => {
    const latest = persistRef.current;
    const root = latest.nodes.find((node) => node.kind === 'idea' && !node.parentId);
    void persistPatch({
      nodes: latest.nodes,
      pan: latest.pan,
      zoom: latest.zoom,
      nodeCount: latest.nodes.length,
      rootIdea: root && root.content ? root.content.slice(0, 80) : '',
      updatedAt: Date.now(),
    });
  }, [persistPatch]);

  React.useEffect(() => {
    persistRef.current = { nodes, pan, zoom };
    const timer = setTimeout(persistCanvas, 220);
    return () => clearTimeout(timer);
  }, [nodes, pan, zoom, persistCanvas]);

  React.useEffect(() => () => persistCanvas(), [persistCanvas]);

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
    selectedIds,
    setSelectedIds,
    autoEditId,
    setAutoEditId,
    mutate,
    updateNode,
    saveStatus,
    persistPatch,
  };
}
