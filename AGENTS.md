# 插件级约束

需求：头脑风暴插件后续所有 UI 统一使用 shadcn 风格组件 + Base UI 原语，组件库位于 `src/client/ui/`。

- 禁止新增裸 `<button>` / `<input>` / `<textarea>` / 自研弹窗 / 自研菜单。
- 弹窗用 `Dialog`，菜单用 `DropdownMenu`，按钮用 `Button`，输入用 `Input` / `Textarea`。
- 新组件先按 shadcn Base UI 结构加入 `src/client/ui/`，再登记到 `docs/UI_STANDARD.md`。
- 颜色只使用 `--dsw-alias-*` 主题 token。
- 修改 `src/**` 后执行 `pnpm check && pnpm build`。
- 本地热更新：运行 `pnpm dev`（Host tsc watch + Client esbuild watch）。
