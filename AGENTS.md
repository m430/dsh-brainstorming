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
- 开源文档与配置示例禁止写本机绝对路径（如 `/Users/...`）；用相对路径、`pwd` 说明或占位符。
- 存储架构变更不做 localStorage 等旧数据迁移；插件早期用户少，避免复杂迁移逻辑。
- 画布 UI 倾向极简：不要操作提示、次要工具栏动作与选中态删除按钮（快捷键即可）；默认指针 + 框选，按住空格 grab 平移（对齐 Obsidian）；框选多节点时半透明建组预览（视觉对齐访谈组）与快捷建组；用户组标题双击编辑、新建组默认可编辑标题，分组框在卡片之下勿遮挡。分组外观对齐 Obsidian（标题在分组框外、贴上边框左侧）；访谈组内提问卡用 Grid，行距相对最高卡片固定 padding。
- 产品主线：仅第一个写入有效内容的根节点自动进入「访谈」（一次一问，问答落入访谈组）；其余自由节点不默认访谈。工具栏主操作为「访谈 / 发散」；访谈 AI 沿决策树 frontier 高杠杆追问，避免 checklist 空洞题；访谈 API 失败静默自动重试，持续失败仅在访谈组 title 旁 warning（hover 详情、点击重试），不在卡片内露出错误条。访谈结束后从访谈组引出调研大纲供确认，再生成调研结果，支持评论与二次修改。
- 新建画布默认名为 Untitled；用户写入第一个有效节点后，由 AI 总结标题并自动保存。
- 节点正文 Markdown 渲染（调研大纲先概览再分点）；双击卡片内无边框源码编辑，失焦或 Cmd/Ctrl+Enter 保存后渲染，Esc 取消，首版不做编辑中 Live Preview。
- 面向用户的 README 等文档：勿出现 grill、Obsidian 等内部参照；少用括号补充；不写自动更新与本地开发段；模型/provider 配置示例须适配 Harness 多种接入，勿写个人专属部署。
- Agent/UI 设计标准以根目录 `DESIGN.md` 为准；`docs/` 是私有研发思路，不作为开源/打包的一部分。
- 插件自研静默升级：有新版本时在消费侧画布列表页 title 旁提示，点击后引导用户完成升级；默认检查间隔 5 分钟。

## Learned Workspace Facts

- 本仓库是 DeepSeek Harness web 插件：Client 入口为 `lib/client.js`，Host 为 `lib/host`；可用 `pnpm verify-pack` 校验发布布局。
- 画布 durable 数据存 Host `storageDomain`（`src/host/domain/brainstorm.ts`，`per-record`）；Client 经 `BOARD_API_PATHS` CRUD，不再使用 localStorage。
- API 路径以 `src/shared/api.ts` 为单一来源（含 `BOARD_API_PATHS` / `UPDATE_API_PATHS`），Host 路由前缀为 `/brainstorm`。
- 自研自动更新：Host `src/host/update/` + `routes/update.ts` 查 registry/应用升级；Client `update-hint.tsx` 挂在列表页 title；默认 `intervalMs: 300000`。
- Client 画布为自研栈（React 绝对定位节点 + Canvas 2D 网格/连线），非 React Flow；节点落位与防重叠逻辑在 `src/client/brainstorm/layout.ts`；节点层缩放用 CSS `zoom`（`.bn-world`），平移在 `.bn-worldPan` 的 `translate`，勿对整层 `transform: scale` 以免放大后文字发糊。
- `outline` / `result` 长文卡宽 `DOC_NODE_WIDTH`（480）；`nodeWidth` 对 legacy 存 320 的 outline/result 仍回退加宽。
- 画布节点流：`idea` → `interview` 组（内含 `question` 卡片网格）→ `outline` → 调研结果；连线带箭头，访谈进行中组与前置节点锁定。
- 访谈追问生成：`BRAINSTORM_CLARIFY_SYSTEM`（`src/host/prompts.ts`）+ `routes/clarify.ts` user prompt；卡片内联编辑在 `src/client/brainstorm/node-body.tsx`。
