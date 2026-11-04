# 头脑风暴 UI 规范

本插件后续所有 UI 一律使用 **shadcn 风格组件 + Base UI 原语**。

## 组件库位置

`src/client/ui/`：

| 组件 | 文件 | 底层 |
| --- | --- | --- |
| `Button` | `button.jsx` | 原生 button + shadcn variants |
| `Input` | `input.jsx` | 原生 input |
| `Textarea` | `textarea.jsx` | 原生 textarea |
| `Dialog` 系列 | `dialog.jsx` | `@base-ui/react/dialog` |
| `DropdownMenu` 系列 | `dropdown-menu.jsx` | `@base-ui/react/menu` |
| `Badge` | `badge.jsx` | 原生 span |
| `Spinner` | `spinner.jsx` | 原生 span |

统一从 `src/client/ui/index.js` 导入：

```js
import { Button, Dialog, DialogContent, DropdownMenu } from '../ui/index.js';
```

## 硬规则

1. **不要再写裸控件**：新增 UI 不使用原生 `<button>`、`<input>`、`<textarea>`、自研弹窗或自研菜单。
2. **弹窗统一用 `Dialog`**：标题、描述、底部操作分别用 `DialogTitle` / `DialogDescription` / `DialogFooter`。
3. **菜单统一用 `DropdownMenu`**：菜单项用 `DropdownMenuItem`；删除等危险操作传 `danger`。
4. **按钮统一用 `Button`**：`variant` 只用 `default / outline / ghost / danger`；尺寸用 `default / sm / xs / icon`。
5. **新增组件走同一路径**：先看 shadcn Base UI 对应组件结构，复制到 `src/client/ui/`，用 `cn` 合并类名，再在此文档登记。
6. **颜色只使用 `--dsw-alias-*` 主题 token**；不引入第二套设计变量。
7. **Portal 组件**（Dialog / Menu）会挂到 `document.body`，新增全局层级样式时使用 `z-index` 约定：Dialog `1000/1001`，Menu `1002`。

## 例外

`NodeCard`、`BoardCard`、画布本身属于领域组件，可以组合上述 UI 组件并保留业务样式；但交互控件仍必须来自组件库。
