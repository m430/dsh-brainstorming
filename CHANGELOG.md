# Changelog

## Unreleased

### Changed

- Migrated the source tree to TypeScript/TSX; Host emits `lib/host/`, Client ships as `lib/client.js`.
- Aligned DSH packaging (`exports`, `verify-pack`), split Host/Client modules, replaced Pixi with Canvas 2D, and added `pnpm dev` watch mode.
- Board persistence moved from browser `localStorage` to Host `storageDomain` (`brainstorm` domain, JSON by default) with authenticated `/api` boards CRUD.
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
