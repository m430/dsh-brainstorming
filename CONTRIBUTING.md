# Contributing

Thanks for improving `dsh-brainstorming`.

## Development

```bash
pnpm install --ignore-scripts
pnpm build
pnpm check
```

## Pull Requests

- Keep changes focused and describe the user-facing effect.
- Rebuild `client.js` after changing `src/client/**`.
- Update `docs/UI_STANDARD.md` when adding a new UI component.
- Do not commit `node_modules`, `build`, `.env` files, API keys, or board data.
- Run `npm pack --dry-run` before publishing-related changes.
