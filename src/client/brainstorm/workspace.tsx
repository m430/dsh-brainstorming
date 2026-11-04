import React from 'react';

import type { Board, BoardPatch, BoardSummary, Translate } from '../../shared/types.js';
import {
  createBoard as createBoardApi,
  deleteBoard as deleteBoardApi,
  getBoard,
  listBoards,
  updateBoard as updateBoardApi,
} from '../api.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { defaultBoardTitle, formatTime, makeId } from '../model.js';
import { BoardEditor } from './board-editor.js';

interface BoardCardProps {
  board: BoardSummary;
  t: Translate;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function BoardCard({ board, t, onOpen, onDelete }: BoardCardProps) {
  const summary = board.rootIdea || t('brainstorm.boardEmpty');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const open = () => onOpen(board.id);

  const menuItems = [
    {
      id: 'delete',
      label: t('brainstorm.deleteBoard'),
      danger: true,
      onSelect: () => onDelete(board.id),
    },
  ];

  return (
    <div
      className="bn-boardCard"
      role="button"
      tabIndex={0}
      onClick={() => {
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        open();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      <div className="bn-boardCardTop">
        <span className="bn-boardCardIcon" aria-hidden="true">◈</span>
        <span className="bn-boardCardTitle">{board.title || t('brainstorm.untitledBoard')}</span>
      </div>
      <p className="bn-boardCardSummary">{summary}</p>
      <div className="bn-boardCardMeta">
        <span>{t('brainstorm.nodeCount', { count: board.nodeCount || 0 })}</span>
        <span>{t('brainstorm.boardUpdated', { time: formatTime(board.updatedAt || board.createdAt || Date.now()) })}</span>
      </div>
      <div
        className="bn-boardCardMenuRoot"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            className="ui-btn ui-btn-ghost ui-btn-icon bn-boardCardMenuButton"
            aria-label={t('brainstorm.more')}
            title={t('brainstorm.more')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <circle cx="3" cy="7" r="1.3" />
              <circle cx="7" cy="7" r="1.3" />
              <circle cx="11" cy="7" r="1.3" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bn-boardMenu" align="end" sideOffset={6}>
            {menuItems.map((item) => (
              <DropdownMenuItem key={item.id} danger={item.danger} onClick={item.onSelect}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function toSummary(board: Board): BoardSummary {
  return {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    nodeCount: board.nodeCount,
    rootIdea: board.rootIdea,
  };
}

export interface BrainstormWorkspaceProps {
  t: Translate;
}

export function BrainstormWorkspace({ t }: BrainstormWorkspaceProps) {
  const [boards, setBoards] = React.useState<BoardSummary[]>([]);
  const [activeBoard, setActiveBoard] = React.useState<Board | null>(null);
  const [listStatus, setListStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = React.useState<string | null>(null);
  const [openingId, setOpeningId] = React.useState<string | null>(null);
  const [deleteBoardId, setDeleteBoardId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refreshList = React.useCallback(async (signal?: AbortSignal) => {
    setListStatus('loading');
    setListError(null);
    try {
      const summaries = await listBoards(signal);
      if (signal?.aborted) return;
      setBoards(summaries);
      setListStatus('ready');
    } catch (error) {
      if (signal?.aborted) return;
      setListError(error instanceof Error ? error.message : String(error));
      setListStatus('error');
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void refreshList(controller.signal);
    return () => controller.abort();
  }, [refreshList]);

  const persistPatch = async (patch: BoardPatch) => {
    if (!activeBoard) return;
    const id = activeBoard.id;
    const updatedAt = typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now();
    const optimistic: Board = { ...activeBoard, ...patch, id, updatedAt };
    setActiveBoard(optimistic);
    setBoards((previous) => {
      const summary = toSummary(optimistic);
      const exists = previous.some((item) => item.id === id);
      if (!exists) return [summary, ...previous];
      return previous.map((item) => (item.id === id ? summary : item));
    });
    try {
      const saved = await updateBoardApi(id, { ...patch, updatedAt });
      setActiveBoard(saved);
      setBoards((previous) => previous.map((item) => (item.id === id ? toSummary(saved) : item)));
    } catch (error) {
      // Keep optimistic memory state; surface failure to editor.
      throw error;
    }
  };

  const createBoard = async () => {
    if (busy) return;
    setBusy(true);
    const board: Board = {
      id: makeId(),
      title: defaultBoardTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodeCount: 0,
      rootIdea: '',
      nodes: [],
      pan: { x: 120, y: 100 },
      zoom: 1,
    };
    try {
      const created = await createBoardApi(board);
      setBoards((previous) => [toSummary(created), ...previous.filter((item) => item.id !== created.id)]);
      setActiveBoard(created);
      setListStatus('ready');
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const openBoard = async (id: string) => {
    if (busy || openingId) return;
    setOpeningId(id);
    setListError(null);
    try {
      const board = await getBoard(id);
      setActiveBoard(board);
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setOpeningId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteBoardId || busy) return;
    const id = deleteBoardId;
    setBusy(true);
    try {
      await deleteBoardApi(id);
      setBoards((previous) => previous.filter((board) => board.id !== id));
      setDeleteBoardId(null);
      if (activeBoard?.id === id) setActiveBoard(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error));
      setDeleteBoardId(null);
    } finally {
      setBusy(false);
    }
  };

  if (activeBoard) {
    return (
      <BoardEditor
        key={activeBoard.id}
        board={activeBoard}
        t={t}
        onBack={() => {
          setActiveBoard(null);
          void refreshList();
        }}
        onChange={persistPatch}
      />
    );
  }

  return (
    <section className="bn-workspace" aria-label={t('brainstorm.boardListTitle')}>
      <div className="bn-listTopbar">
        <div className="bn-listTitle">
          <h1>{t('brainstorm.boardListTitle')}</h1>
          <p>{t('brainstorm.boardListSubtitle')}</p>
        </div>
        <div className="bn-listActions">
          <Button variant="default" disabled={busy} onClick={() => void createBoard()}>
            {t('brainstorm.newBoard')}
          </Button>
        </div>
      </div>
      {listStatus === 'loading' ? (
        <div className="bn-boardsEmpty">
          <p>{t('brainstorm.thinking')}</p>
        </div>
      ) : listStatus === 'error' ? (
        <div className="bn-boardsEmpty">
          <h2>{t('brainstorm.canvasError')}</h2>
          <p>{listError || t('brainstorm.canvasErrorHint')}</p>
          <Button variant="default" onClick={() => void refreshList()}>{t('brainstorm.retry')}</Button>
        </div>
      ) : boards.length === 0 ? (
        <div className="bn-boardsEmpty">
          <div className="bn-boardsEmptyIcon" aria-hidden="true">◇</div>
          <h2>{t('brainstorm.emptyBoards')}</h2>
          <p>{t('brainstorm.emptyBoardsHint')}</p>
          {listError ? <p className="bn-saveStatus is-error">{listError}</p> : null}
          <Button variant="default" disabled={busy} onClick={() => void createBoard()}>
            {t('brainstorm.newBoard')}
          </Button>
        </div>
      ) : (
        <div className="bn-boardGrid">
          {listError ? <p className="bn-saveStatus is-error">{listError}</p> : null}
          {boards
            .slice()
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .map((board) => (
              <BoardCard
                board={board}
                t={t}
                key={board.id}
                onOpen={(id) => void openBoard(id)}
                onDelete={setDeleteBoardId}
              />
            ))}
        </div>
      )}
      {deleteBoardId ? (
        <Dialog open onOpenChange={(open) => !open && setDeleteBoardId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('brainstorm.deleteBoardTitle')}</DialogTitle>
              <DialogDescription>{t('brainstorm.deleteBoardHint')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteBoardId(null)}>{t('brainstorm.cancel')}</Button>
              <Button variant="danger" disabled={busy} onClick={() => void confirmDelete()}>
                {t('brainstorm.deleteConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
