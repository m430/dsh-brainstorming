# dsh-brainstorming

[![npm version](https://img.shields.io/npm/v/dsh-brainstorming.svg)](https://www.npmjs.com/package/dsh-brainstorming)
[![GitHub Actions](https://github.com/m430/dsh-brainstorming/actions/workflows/ci.yml/badge.svg)](https://github.com/m430/dsh-brainstorming/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DeepSeek Harness Web UI 的 AI 头脑风暴插件：在无限画布上从一个想法出发，通过提问、意图分析、调研和人工编辑，把思路逐步展开成一棵可交互的思考树。

## 功能

- **无限画布**：Canvas 2D 点阵背景与连线，支持平移、缩放、节点拖拽和自动保存
- **AI 提问**：分析当前节点，生成 3–5 个能推进思考的高质量问题；问题节点可以直接输入回答
- **分析意图**：从当前节点提炼多个不同意图，并分别生成子节点
- **调研流程**：选择方向 → 生成可编辑调研大纲 → 确认后生成调研结果
- **节点编辑**：双击节点编辑内容；选中后按 `Delete` / `Backspace` 删除
- **历史画布**：每个画布独立保存在浏览器 `localStorage`（数据 owner = browser）
- **统一 UI**：shadcn 风格组件 + Base UI 原语，详见 [`docs/UI_STANDARD.md`](docs/UI_STANDARD.md)

## 环境要求

- [DeepSeek Harness](https://github.com/deepseek-ai) Web UI
- 一个可用的 DSH 模型 provider（默认模型或插件配置）

## 安装

### 从 npm 安装（推荐）

在 DeepSeek Harness 的 **Plugin Manager / 插件管理** 中安装：

```text
dsh-brainstorming
```

或指定版本：

```text
dsh-brainstorming@0.0.1
```

安装后刷新页面，左侧栏会出现「头脑风暴」面板。

### 从源码安装

```bash
git clone https://github.com/m430/dsh-brainstorming.git
cd dsh-brainstorming
pnpm install
pnpm build
```

然后在 DSH Plugin Manager 中选择这个本地目录安装。

## 使用

1. 左侧栏点击「头脑风暴」。
2. 新建一个画布，点击「+ 添加点子」。
3. 选中节点后：
   - 点击「提问」：AI 生成问题子节点，可直接输入回答
   - 点击「分析意图」：AI 把节点拆成多个意图子节点
   - 点击「调研」：生成调研大纲，确认后继续调研
   - 点击「AI 修改」：根据你的指令改写当前节点
4. 双击任意节点编辑内容；拖动节点调整位置；滚轮缩放。

## 配置

默认使用 DSH 当前选择的模型。也可以在 profile 的 `cordis.patch.yml` 中为插件指定模型：

```yaml
- id: dsh-brainstorming
  config:
    provider: magpie
    model: auto/deepseek-v4.1-flash
    timeoutMs: 120000
    maxOutputTokens: 1800
```

**插件不需要也不读取 API Key。** Key 由 DSH 的 provider / credentials 层管理。

## 安全与隐私

- 插件不会把 API Key 打包进前端或提交到仓库。
- AI 请求通过 DSH 的 `ctx.llm` 服务发出，Key 留在 Host 的 credentials 层。
- 所有插件路由走 DSH `/api` 鉴权通道，未登录请求返回 `401`。
- 画布内容保存在浏览器 `localStorage`，属于本地数据。
- 节点内容和提示词会发送给当前配置的模型 provider；处理敏感内容时请使用本地模型。
- 安全问题请通过 [`SECURITY.md`](SECURITY.md) 报告。

## 开发

```bash
pnpm install --ignore-scripts
pnpm typecheck
pnpm build
pnpm check
```

源码使用 TypeScript/TSX。`src/host/**` 由 `tsc` 编译到 `lib/host/`，`src/client/**` 由 esbuild 打包成 `lib/client.js`；提交前请运行 `pnpm check`。发布包只包含 `lib/` 等构建产物，不包含 `src/`。从 Git / 本地 path 安装时会跑 `prepare` 构建；也可用 `pnpm build` 手动生成。

Base UI 组件打包进 `lib/client.js`，React / ReactDOM 由 Harness Client 模块表提供。

画布数据目前由浏览器 `localStorage` 拥有（数据 owner = browser）；Host 只提供 AI 分析 API，不持久化 board。UI 文案单源在 `locale/ui-zh.json` / `locale/ui-en.json`，插件 meta 在 `locale/zh.json` / `locale/en.json`。

### 本地热更新

开发时先以本地目录安装插件，让 profile 使用 `link:`（Plugin Manager 选择本地目录即可），然后运行：

```bash
pnpm dev
```

它会同时启动：

- Host：`tsc -p tsconfig.host.json --watch`
- Client：`node scripts/build-client.mjs --watch`（esbuild watch）

Client UI 由 DSH 的 `@deepseek-ai/dsh-client-hmr` 自动热替换：它会轮询插件 bundle，检测到 `client.js` 重建后替换运行中的插件，不需要刷新页面。会话、工作区和连接状态保留，插件内部 React state 会重置。

Host 侧热更新需要在当前 profile 的 `cordis.patch.yml` 中启用 `hmr` 行（默认可能是 disabled）：

```yaml
- id: hmr
  disabled: false
  config:
    root: ["/Users/zhengmin/Projects/DBB/infra/dsh-plugins/dsh-brainstorming"]
```

保存后 Host 插件会重载；框架级依赖、`package.json` 等变化仍可能需要重启。只改 Client UI 时不需要这一步。

### 项目结构

```text
src/host/index.ts            Host：提示词、模型调用、/api 路由
src/client/index.tsx         Client 入口：样式、locale、slot 注册
src/client/app.tsx           工作区根组件
src/client/ui/               shadcn 风格组件库
src/client/brainstorm/       画布、节点、历史画布、弹窗
src/shared/                  Host/Client 共享类型与 API 路径
locale/ui-*.json             Client UI 文案（单源）
locale/{zh,en}.json          插件 meta
scripts/build-client.mjs     esbuild 构建脚本
scripts/dev.mjs              Host/Client 双 watch 开发脚本
scripts/verify-pack.mjs      发布包与 exports 断言
lib/host/                    Host 构建产物
lib/client.js                Client 构建产物（__ModuleLoader__ factory）
```

### API

```text
POST /api/dsh-brainstorming/brainstorm/expand
POST /api/dsh-brainstorming/brainstorm/questions
POST /api/dsh-brainstorming/brainstorm/intents
POST /api/dsh-brainstorming/brainstorm/outline
POST /api/dsh-brainstorming/brainstorm/research
POST /api/dsh-brainstorming/brainstorm/modify
```

## 许可证

项目代码使用 [MIT License](LICENSE)。打包的第三方依赖及图标许可证见
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
