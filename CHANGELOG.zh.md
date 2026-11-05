# 更新日志

## 0.0.3 - 2026-11-05

### 新功能

- 插件内版本检查：Host 轮询 npm registry，画布列表标题旁提示新版本；确认后在当前 profile 执行 `pnpm add` 升级。

### 文档

- README 对齐「访谈 / 发散 / 确认调研」主路径；配置示例改为通用 provider 占位，并去掉自动更新与开发章节。

## 0.0.2 - 2026-11-04

### 新功能

- 工具栏「访谈 / 发散」主路径：画布上深挖问答组，确认大纲后再调研。
- Obsidian 风格访谈分组（CSS Grid 排布、标题在框外）、节点 Markdown 渲染、删除仅用快捷键。
- 画布持久化迁到 Host `storageDomain`，经鉴权 `/api` boards CRUD（不再使用浏览器 `localStorage`）。

### 变更

- 交互收敛为双核心：「拆分意图」「确认调研」（均可补上下文）；去掉提问 / 自动 expand / AI 修改 / 加子想法主入口。
- 布局：确定性兄弟重排 + 列 AABB 避让、测高后重排、子树拖拽、「整理布局」一键 tidy；不做持续力排斥。
- 源码迁移到 TypeScript/TSX；Host 输出 `lib/host/`，Client 输出 `lib/client.js`。
- 对齐 DSH 打包契约（`exports`、`verify-pack`），拆分 Host/Client 模块，Canvas 2D 替代 Pixi，并新增 `pnpm dev` 双 watch。
- 新增 Host/Client API 路径一致性检查（`pnpm verify-routes`），防止路由漂移导致 404 回归。

## 0.0.1 - 2026-11-04

### 新功能

- 首个公开版本。
- PixiJS 无限画布与点阵背景。
- AI 提问生成可回答的问题节点。
- AI 分析意图并生成意图子节点。
- 调研大纲与调研结果流程。
- 节点编辑、拖拽、缩放、快捷键删除与本地持久化。
- 基于 Base UI 原语的 shadcn 风格 UI。

### 文档

- 公开安装、开发、安全和第三方许可证说明。
