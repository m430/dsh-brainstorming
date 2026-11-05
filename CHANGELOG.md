# Changelog

## 0.0.4 - 2026-11-05

### Features

- Obsidian-style canvas pointer: default select / marquee, hold Space to pan.
- Freeform groups from multi-select (AABB preview + create group) with chip-style editable titles outside the frame.
- Interview and free groups share the same frame / title chrome; interview titles stay locked with thinking / retry warning.

### Changed

- Only the first contentful root idea auto-enters interview; later free nodes stay plain.
- Node layer zoom uses CSS `zoom` (keeps text sharp); long-form outline / result cards use a wider doc width.

### Fixes

- Free-group title no longer overlaps the frame; removed a title-snap layout effect that blanked the board (React #185).

## 0.0.3 - 2026-11-05

### Features

- In-plugin update check: Host polls the npm registry and the board list title shows when a newer version is available; confirming runs `pnpm add` in the current profile.

### Documentation

- README aligned with the interview / diverge / confirm-research flow; config examples use generic provider placeholders and no longer document auto-update or developer setup.

## 0.0.2 - 2026-11-04

### Features

- Interview / diverge toolbar path: deep-dive Q&A clusters on the canvas, then outline confirmation and research.
- Obsidian-style interview groups with CSS grid card packing, outside title labels, Markdown node bodies, and keyboard-only delete.
- Board persistence on Host `storageDomain` with authenticated `/api` boards CRUD (replaces browser `localStorage`).

### Changed

- Interaction narrowed to two core actions — Split intents and Confirm research (both accept optional context); removed Ask, auto-expand, AI edit, and add-child from the primary toolbar.
- Layout: deterministic sibling reflow + column AABB avoidance, reflow on measured height, subtree drag, and a Tidy layout action (no continuous force simulation).
- Migrated the source tree to TypeScript/TSX; Host emits `lib/host/`, Client ships as `lib/client.js`.
- Aligned DSH packaging (`exports`, `verify-pack`), split Host/Client modules, replaced Pixi with Canvas 2D, and added `pnpm dev` watch mode.
- Added a Host/Client API path consistency check (`pnpm verify-routes`) to prevent route drift from regressing into opaque 404s.

## 0.0.1 - 2026-11-04

### Features

- Initial public release.
- PixiJS infinite canvas with dot-grid background.
- AI-generated follow-up questions with answerable question nodes.
- AI intent analysis with child intent nodes.
- Research outline and research result workflow.
- Node editing, dragging, zooming, keyboard deletion, and local persistence.
- shadcn-style UI built on Base UI primitives.

### Documentation

- Public installation, development, security, and third-party license notes.
