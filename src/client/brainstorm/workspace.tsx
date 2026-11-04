import React from 'react';

import type { Board, BoardPatch, Translate } from '../../shared/types.js';
import { Badge } from '../ui/badge.js';
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
import { defaultBoardTitle, formatTime, loadBoards, makeId, saveBoards } from '../model.js';
import { BoardEditor } from './board-editor.js';

interface BoardCardProps {
  board: Board;
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
      {board.legacyNodes && board.legacyNodes.length > 0 ? (
        <Badge className="bn-boardCardBadge">{t('brainstorm.legacyBoard')}</Badge>
      ) : null}
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

export interface BrainstormWorkspaceProps {
  t: Translate;
}

export function BrainstormWorkspace({ t }: BrainstormWorkspaceProps) {
  const [boards, setBoards] = React.useState<Board[]>(loadBoards);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [deleteBoardId, setDeleteBoardId] = React.useState<string | null>(null);

  React.useEffect(() => {
    saveBoards(boards);
  }, [boards]);

  const updateBoard = (patch: BoardPatch) => {
    if (!selectedId) return;
    setBoards((previous) =>
      previous.map((board) =>
        board.id === selectedId
          ? { ...board, ...patch, updatedAt: typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now() }
          : board,
      ),
    );
  };

  const createBoard = () => {
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
    setBoards((previous) => [board, ...previous]);
    setSelectedId(board.id);
  };

  const selectedBoard = boards.find((board) => board.id === selectedId) || null;
  if (selectedBoard) {
    return (
      <BoardEditor
        key={selectedBoard.id}
        board={selectedBoard}
        t={t}
        onBack={() => setSelectedId(null)}
        onChange={updateBoard}
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
          <Button variant="default" onClick={createBoard}>{t('brainstorm.newBoard')}</Button>
        </div>
      </div>
      {boards.length === 0 ? (
        <div className="bn-boardsEmpty">
          <div className="bn-boardsEmptyIcon" aria-hidden="true">◇</div>
          <h2>{t('brainstorm.emptyBoards')}</h2>
          <p>{t('brainstorm.emptyBoardsHint')}</p>
          <Button variant="default" onClick={createBoard}>{t('brainstorm.newBoard')}</Button>
        </div>
      ) : (
        <div className="bn-boardGrid">
          {boards
            .slice()
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .map((board) => (
              <BoardCard board={board} t={t} key={board.id} onOpen={setSelectedId} onDelete={setDeleteBoardId} />
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
              <Button
                variant="danger"
                onClick={() => {
                  setBoards((previous) => previous.filter((board) => board.id !== deleteBoardId));
                  setDeleteBoardId(null);
                }}
              >
                {t('brainstorm.deleteConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
