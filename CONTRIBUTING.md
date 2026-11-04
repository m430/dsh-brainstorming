# Contributing

Thanks for improving `dsh-brainstorming`.

## Development

```bash
pnpm install --ignore-scripts
pnpm typecheck
pnpm build
pnpm check
```

本地开发时运行 `pnpm dev`，同时监听 Host 与 Client 源码。

## Pull Requests

- Keep changes focused and describe the user-facing effect.
- Run `pnpm build` after changing `src/**`; `pnpm check` includes type checking and bundle syntax validation.
- Update `docs/UI_STANDARD.md` when adding a new UI component.
- Do not commit `node_modules`, `build`, `lib`, `.env` files, API keys, or board data.
- Run `pnpm verify-pack` before publishing-related changes.
- UI copy lives in `locale/ui-zh.json` / `locale/ui-en.json`; update both when adding strings.
