# 插件级约束

需求：头脑风暴插件后续所有 UI 统一使用 shadcn 风格组件 + Base UI 原语，组件库位于 `src/client/ui/`。

- 禁止新增裸 `<button>` / `<input>` / `<textarea>` / 自研弹窗 / 自研菜单。
- 弹窗用 `Dialog`，菜单用 `DropdownMenu`，按钮用 `Button`，输入用 `Input` / `Textarea`。
- 新组件先按 shadcn Base UI 结构加入 `src/client/ui/`，再登记到 `docs/UI_STANDARD.md`。
- 颜色只使用 `--dsw-alias-*` 主题 token。
- 修改 `src/**` 后执行 `pnpm check && pnpm build`。
- 本地热更新：运行 `pnpm dev`（Host tsc watch + Client esbuild watch）。

## Learned User Preferences

- 构建与发布产物须符合 DeepSeek Harness 插件打包规范（`dsh` manifest、exports、`cordis.patch.yml` 等），以 [dsh.pub/develop-plugin](https://dsh.pub/develop-plugin.md) 为准。
- 本地 IDE/缓存目录（如 `.cursor/`、`.pnpm-store/`）不要提交；应留在 `.gitignore`。

## Learned Workspace Facts

- 本仓库是 DeepSeek Harness web 插件：Client 入口为 `lib/client.js`，Host 为 `lib/host`；可用 `pnpm verify-pack` 校验发布布局。
- 画布 durable 数据存 Host `storageDomain`（`src/host/domain/brainstorm.ts`，`per-record`）；Client 经 `BOARD_API_PATHS` CRUD，不再使用 localStorage。
- API 路径以 `src/shared/api.ts` 为单一来源，Host 路由前缀为 `/brainstorm`。
