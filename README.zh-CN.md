[English](README.md)

# Claude-chan

可嵌入网页的二次元吉祥物，由 AI 工具调用驱动。Claude-chan 会根据 agent 正在做的事做出反应：挥手、思考、欢呼、弹出对话气泡，还可以拖到页面上的任意位置。

> Claude-chan 是一个同人项目，与 Anthropic 无关，也未获其认可。"Claude" 是 Anthropic 的商标，此处仅作描述性使用。

<!-- SCREENSHOT: docs/images/hero.png — mascot on a page, 1200x700 -->

## 功能

- 精灵图渲染器，内置 21 个 MIT 授权的动漫姿势，淡入淡出切换；缺少精灵图时自动退回程序化 SVG 小人。
- 可选的 Live2D 渲染器（Cubism 4），Core 需自行托管。
- 鼠标、触摸、手写笔都能拖到任意位置，也可用键盘移动；位置按站点记忆。`dock` 为 `free`（默认）或 `fixed-default`。
- 由工具调用驱动：MCP 服务器、本地 WebSocket 中枢、postMessage 桥，或纯文本标记，如 `[motion:wave]`。
- 控制台 API `window.claudeChan`，供用户使用（位置、隐藏、显示）。
- 一行代码、书签或用户脚本即可热加载到任意页面，无需改动页面源码。
- 不依赖框架；可用作 Web Component、原生 API，也可用在 React 和 Vue 中。

<!-- SCREENSHOT: docs/images/poses-grid.png — grid of the 21 poses, 1200x900 -->

## 快速开始

### a) 三行嵌入

```html
<claude-chan position="bottom-left" size="220"></claude-chan>
<script type="module">import { defineClaudeChan } from 'claude-chan'; defineClaudeChan();</script>
```

或者用 JavaScript：

```js
import { ClaudeChan } from 'claude-chan';
const cc = ClaudeChan.mount(document.body, { position: 'bottom-left', size: 220 });
await cc.ready;
cc.act({ motion: 'wave', expression: 'smile', say: 'Hello!' });
```

该包暂未发布到 npm；请先运行 `npm run build`，再引入 `dist/claude-chan.js`。完整选项和框架说明见 [docs/API.md](docs/API.md)、[docs/INTEGRATION.md](docs/INTEGRATION.md)。

### b) 热加载到任意页面

热加载文件托管在 GitHub Pages 上。安装页 https://kmaj1st.github.io/claude-chan/docs/install.html （中文 / English）逐一介绍每种方式，带复制按钮，会检查基础地址，还有“在本页试一下”按钮。也可以在任意页面的浏览器控制台（F12）粘贴下面的代码（如果 Chrome 或 Edge 拒绝粘贴，先输入 `allow pasting`）：

```js
document.head.append(Object.assign(document.createElement('script'),{src:'https://kmaj1st.github.io/claude-chan/hotload/loader.js'}))
```

离线或测试本地改动时，运行 `npm run serve:loader`（提供 http://127.0.0.1:5179），改用 `http://127.0.0.1:5179/hotload/loader.js`。仓库公开后也可用 jsDelivr：`https://cdn.jsdelivr.net/gh/Kmaj1st/claude-chan@main/hotload/loader.js`。要移除热加载的吉祥物，运行 `claudeChan.unload()`。

<!-- SCREENSHOT: docs/images/hot-load.png — mascot hot-loaded on a third-party site, 1200x700 -->

### c) 书签

打开安装页 https://kmaj1st.github.io/claude-chan/docs/install.html （仓库中的 [docs/install.html](docs/install.html)），把书签拖到书签栏，在任意页面点击即可。

### d) 用户脚本

在 Tampermonkey 或 Violentmonkey 中安装 https://kmaj1st.github.io/claude-chan/hotload/claude-chan.user.js 。对内容安全策略（CSP）严格的网站，请用 `hotload/claude-chan.inline.user.js`。

更多内容（包括 CSP 限制）见 [docs/HOT-LOAD.md](docs/HOT-LOAD.md)。

## 拖动与位置

可以把吉祥物拖到任意位置；短按仍然算作点击。聚焦后可用方向键移动（Shift 为大步，Home 回到原位）。它始终保持在视口内，并以窗口比例记住位置。没有关闭按钮，双击也没有特殊作用；请使用下面的控制台命令。

<!-- SCREENSHOT: docs/images/drag.png — mascot being dragged (lifted and tilted), 800x600 -->

动作（稳定名称）：idle, wave, nod, shake_head, think, happy, surprised, bow, cheer, sleepy, typing, tea_serve, pout, wink, point。

表情：neutral, smile, sad, angry, blush, surprised。

心情：neutral, happy, sad, angry, shy, sleepy, thinking。Agent 状态：idle, listening, thinking, working, waiting, speaking, success, error, sleeping（`applyState(cc, 'thinking')` 或 `el.setState('thinking')`）。

对话气泡只用 `textContent`，从不使用 `innerHTML`，最长 280 个字符。动画遵守 `prefers-reduced-motion`。

<!-- SCREENSHOT: docs/images/bubble.png — speech bubble, 600x400 -->

## API 与命令

控制器：`act`、`say`、`setMood`、`setState`、`lookAt`、`stop`、`lipSync`、`getPosition`、`setPosition`、`resetPosition`、`hide`、`show`、`toggle`、`setDock`、`relayout`、`on`、`destroy`、`ready`。详见 [docs/API.md](docs/API.md)。

控制台命令（输入 `claudeChan.help()` 查看列表）：

| 命令 | 作用 |
| --- | --- |
| `claudeChan.help()` | 列出所有命令 |
| `claudeChan.getPosition()` | 返回 `{ x, y, fx, fy, free, dock }` |
| `claudeChan.setPosition(fx, fy)` | 移动到屏幕的 0..1 比例位置（大于 1 的数按像素） |
| `claudeChan.resetPosition()` | 回到默认位置 |
| `claudeChan.hide()` / `hide({ persist: true })` | 本次页面加载内隐藏 / 刷新后仍隐藏 |
| `claudeChan.show()` | 重新显示，并清除持久隐藏 |
| `claudeChan.toggle()` | 本次页面加载内切换隐藏/显示 |
| `claudeChan.unload()` | 移除热加载的吉祥物（仅热加载时可用） |

给 agent 用的工具：`claude_chan_act`、`claude_chan_say`、`claude_chan_set_mood`、`claude_chan_set_state`、`claude_chan_list_motions`、`claude_chan_set_position`、`claude_chan_reset_position`。刻意没有隐藏/显示工具：只有用户自己能隐藏吉祥物。JSON schema 在 `schema/` 目录。

| 方式 | 适用场景 | 文档 |
| --- | --- | --- |
| MCP 服务器（stdio 或 streamable HTTP） | Claude Code 等 MCP 客户端 | [docs/MCP.md](docs/MCP.md) |
| 本地 WebSocket 中枢（`connectHub`） | 让本地页面接收 MCP 调用 | [docs/MCP.md](docs/MCP.md) |
| postMessage 桥 | iframe 中的页面或父框架 | [docs/API.md](docs/API.md) |
| 文本标记，如 `[motion:wave]` | 不支持工具调用的模型 | `src/markers.ts` |
| JSON schema `schema/claude_chan_act.json` | 任何支持工具调用的 LLM API | `schema/` |

## MCP 设置

```bash
npm run build:server
CLAUDE_CHAN_TOKEN=change-me-to-a-long-random-token node server/dist/cli.js
```

把它加入 `.mcp.json`，并在页面里用 `connectHub(controller, { token })` 连接。完整设置、HTTP 模式和系统提示词片段见 [docs/MCP.md](docs/MCP.md)。

## 安全

- 中枢只绑定 `127.0.0.1`，需要令牌（至少 16 个字符），检查 `Origin` 头（默认只允许本机回环地址），并限制速率和消息大小。令牌会出现在页面里，因此中枢只适用于本地页面。
- postMessage 桥只接受显式的来源白名单（默认是页面自身的来源），从不接受 `*`。
- 对话气泡不会渲染 HTML。
- 热加载会在你加载的页面上运行脚本，可能被页面的内容安全策略拦截，见 [docs/HOT-LOAD.md](docs/HOT-LOAD.md)。

## 真正的 Live2D 模型

把 `model` 设为 `.model3.json` 的 URL，把 `core-url` 设为你自行托管的 `live2dcubismcore.min.js`。专有的 Core 文件不随项目分发（见 [docs/LICENSES.md](docs/LICENSES.md)）。使用 `renderer=auto` 时，模型加载失败会退回精灵图。

```html
<claude-chan model="/model/claude.model3.json" core-url="/live2dcubismcore.min.js"></claude-chan>
```

用 `npm run check:model -- <folder>` 校验模型文件夹。画师需求文档：[docs/ART-PIPELINE.md](docs/ART-PIPELINE.md)。

## 嵌入其他应用

Claude-chan 的设计目标是嵌入宿主应用，例如 HAPI 网页应用（一个私有宿主应用）。

<!-- SCREENSHOT: docs/images/hapi-chan.png — mascot inside the HAPI web app, 1200x700 -->

打包方式、在自家界面旁设置默认位置、SSR 注意事项见 [docs/INTEGRATION.md](docs/INTEGRATION.md)。

## 致谢与许可

- 代码：MIT，见 [LICENSE](LICENSE)。
- `assets/chars` 中的精灵图改编自 [Chaosnap/Claude_Overdose](https://github.com/Chaosnap/Claude_Overdose)（MIT，版权归 Yuki 所有），见 [assets/chars/NOTICE.md](assets/chars/NOTICE.md)。歌曲 "INTERNET OVERDOSE"、游戏 NEEDY GIRL OVERDOSE 和 "Claude" 商标不在该许可范围内，也未包含在本项目中。
- 不附带 Live2D Cubism Core，也没有提交任何 Live2D 模型。
- 其余内容见 [docs/LICENSES.md](docs/LICENSES.md)。

## 参与贡献

```bash
npm ci
npm test            # 单元测试（vitest）
npm run test:e2e    # 无头浏览器测试
npm run test:loader # 构建 hotload/ 并运行热加载浏览器测试
npm run check:loader # 检查 hotload/ 是否最新、是否超出体积预算
npm run check:links # 检查文档中的相对链接和锚点
npx tsc --noEmit
```

一个改动对应一个 pull request。运行 `npm run dev` 可打开演示页（http://127.0.0.1:5178）：每个动作、表情、心情和状态都有按钮，另有口型同步和工具调用控制台。

## 项目状态

早期阶段（0.1）。API 记录在 [docs/API.md](docs/API.md)；未完成事项见 [docs/ROADMAP.md](docs/ROADMAP.md)。全部文档：[docs/README.md](docs/README.md)。
