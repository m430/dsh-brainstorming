# dsh-brainstorming

[![npm version](https://img.shields.io/npm/v/dsh-brainstorming.svg)](https://www.npmjs.com/package/dsh-brainstorming)
[![GitHub Actions](https://github.com/m430/dsh-brainstorming/actions/workflows/ci.yml/badge.svg)](https://github.com/m430/dsh-brainstorming/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DeepSeek Harness Web UI 的 AI 头脑风暴插件：在无限画布上从一个模糊点子出发，默认通过「访谈」对齐问题，再「确认调研」生成大纲与结果；也可选「发散」快速展开方向。

## 功能

- **无限画布**：点阵背景与带箭头连线，支持平移、缩放、子树拖拽、「整理布局」和自动保存
- **访谈**：一次一问，问答落入访谈组；结束后可引出调研大纲。新建点子后默认进入访谈
- **发散**：快速展开若干方向意图，不必先走完整访谈
- **确认调研**：可补充调研要求，先确认大纲，再生成调研结果；结果支持评论与二次改写
- **无重叠布局**：兄弟重排与列碰撞避让；内容变高后自动推开
- **节点编辑**：双击编辑正文，正文以 Markdown 渲染；选中后按 `Delete` / `Backspace` 删除
- **历史画布**：列表管理多画布；新建默认为 Untitled，写入首个有效节点后由 AI 自动总结标题
- **统一 UI**：shadcn 风格组件 + Base UI 原语，约定见 [`DESIGN.md`](DESIGN.md)

## 环境要求

- [DeepSeek Harness](https://github.com/deepseek-ai) Web UI
- 一个可用的 DSH 模型 provider

## 安装

### 从 npm 安装（推荐）

在 DeepSeek Harness 的 **Plugin Manager / 插件管理** 中安装：

```text
dsh-brainstorming
```

或指定版本：

```text
dsh-brainstorming@0.0.5
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

1. 左侧栏点击「头脑风暴」，进入画布列表。
2. 点击「+ 新建头脑风暴」打开空白画布，标题默认为 Untitled。
3. 双击空白处添加点子并提交，根节点会默认进入「访谈」。
4. 选中节点后，工具栏主操作：
   - **访谈**：一次一问，答案写入访谈组；访谈结束后可「确认调研」
   - **发散**：快速生成方向意图
   - **确认调研**：可选补充要求，确认大纲后生成调研结果；结果可评论并按评论改写
5. 拖动节点会带动整棵子树；需要时可点「整理布局」。选中后按 `Delete` / `Backspace` 删除。

## 配置

默认跟随 DeepSeek Harness 当前选中的模型，无论你用的是官方 API Key，还是 Harness 里配置的其他 provider。插件不读取、也不需要单独的 API Key；鉴权与密钥都由 Harness 的 credentials 层管理。

一般无需改配置。若要为插件单独指定模型，或调整超时与输出长度，可在 profile 的 `cordis.patch.yml` 中写入，例如：

```yaml
- id: dsh-brainstorming
  config:
    # provider / model 须与你在 Harness 里已配置、可用的条目一致
    provider: your-provider-id
    model: your-model-id
    timeoutMs: 120000
    maxOutputTokens: 1800
```

`provider` 与 `model` 需同时填写才会覆盖默认选择；只填其中一个会被忽略。

## 安全与隐私

- 插件不会把 API Key 打包进前端或提交到仓库。
- AI 请求通过 DSH 的 `ctx.llm` 服务发出，Key 留在 Host 的 credentials 层。
- 所有插件路由走 DSH `/api` 鉴权通道，未登录请求返回 `401`。
- 画布内容由 Host `storageDomain` 的 `brainstorm` domain 持久化，经鉴权 `/api` 访问。
- 节点内容和提示词会发送给当前配置的模型 provider；处理敏感内容时请使用本地模型。
- 安全问题请通过 [`SECURITY.md`](SECURITY.md) 报告。

## 许可证

项目代码使用 [MIT License](LICENSE)。打包的第三方依赖及图标许可证见
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
