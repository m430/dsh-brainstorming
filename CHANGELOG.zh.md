# 更新日志

## 未发布

### 变更

- 产品主路径改为「深挖访谈 → 确认问题陈述 → 再分叉/调研」；拆分意图支持深挖/速扩双模式；调研结果可评论并二次改写。
- 交互收敛为双核心：「拆分意图」「确认调研」（均可补上下文）；去掉提问 / 自动 expand / AI 修改 / 加子想法主入口。
- 布局：确定性兄弟重排 + 列 AABB 避让、测高后重排、子树拖拽、「整理布局」一键 tidy；不做持续力排斥。
- 源码迁移到 TypeScript/TSX；Host 输出 `lib/host/`，Client 输出 `lib/client.js`。
- 对齐 DSH 打包契约（`exports`、`verify-pack`），拆分 Host/Client 模块，Canvas 2D 替代 Pixi，并新增 `pnpm dev` 双 watch。
- 画布持久化从浏览器 `localStorage` 迁到 Host `storageDomain`（`brainstorm` domain，默认 JSON），经鉴权 `/api` boards CRUD 访问。
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
