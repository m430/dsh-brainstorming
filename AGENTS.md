# 插件级约束

需求：头脑风暴插件后续所有 UI 统一使用 shadcn 风格组件 + Base UI 原语，组件库位于 `src/client/ui/`。

- 禁止新增裸 `<button>` / `<input>` / `<textarea>` / 自研弹窗 / 自研菜单。
- 弹窗用 `Dialog`，菜单用 `DropdownMenu`，按钮用 `Button`，输入用 `Input` / `Textarea`。
- 新组件先按 shadcn Base UI 结构加入 `src/client/ui/`，再登记到根目录 [`DESIGN.md`](DESIGN.md)。
- 颜色只使用 `--dsw-alias-*` 主题 token。
- 修改 `src/**` 后执行 `pnpm check && pnpm build`。
- 本地热更新：运行 `pnpm dev`（Host tsc watch + Client esbuild watch）。

## Learned User Preferences

- 构建与发布产物须符合 DeepSeek Harness 插件打包规范（`dsh` manifest、exports、`cordis.patch.yml` 等），以 [dsh.pub/develop-plugin](https://dsh.pub/develop-plugin.md) 为准。
- 本地 IDE/缓存目录（如 `.cursor/`、`.pnpm-store/`）不要提交；应留在 `.gitignore`。
- 存储架构变更不做 localStorage 等旧数据迁移；插件早期用户少，避免复杂迁移逻辑。
- 画布 UI 倾向极简：不要操作提示、次要工具栏动作与选中态删除按钮（快捷键即可）；分组外观对齐 Obsidian（标题在分组框外、贴上边框左侧）。
- 产品主线：根节点默认进入「访谈」（grill 式一次一问，问答落入访谈组），工具栏主操作为「访谈 / 发散」；访谈结束后从访谈组引出调研大纲供确认，再生成调研结果，支持评论与二次修改。
- 节点正文用 Markdown 渲染（尤其调研大纲：先概览再分点）。
- Agent/UI 设计标准以根目录 `DESIGN.md` 为准；`docs/` 是私有研发思路，不作为开源/打包的一部分。

## Learned Workspace Facts

- 本仓库是 DeepSeek Harness web 插件：Client 入口为 `lib/client.js`，Host 为 `lib/host`；可用 `pnpm verify-pack` 校验发布布局。
- 画布 durable 数据存 Host `storageDomain`（`src/host/domain/brainstorm.ts`，`per-record`）；Client 经 `BOARD_API_PATHS` CRUD，不再使用 localStorage。
- API 路径以 `src/shared/api.ts` 为单一来源，Host 路由前缀为 `/brainstorm`。
- Client 画布为自研栈（React 绝对定位节点 + Canvas 2D 网格/连线），非 React Flow；节点落位与防重叠逻辑在 `src/client/brainstorm/layout.ts`。
- 画布节点流：`idea` → `interview` 组（内含 `question` 卡片网格）→ `outline` → 调研结果；连线带箭头，访谈进行中组与前置节点锁定。
