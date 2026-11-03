// Builds the hot-load files (docs/HOT-LOAD.md) into hotload/ and the bookmarklet page docs/install.html.
//   node scripts/build-loader.mjs           build
//   node scripts/build-loader.mjs --check   build in memory and fail when the committed files differ (or a budget is exceeded)
// Env: CLAUDE_CHAN_BASE (default GitHub Pages) = base URL baked into the userscripts and the bookmarklet;
//      USERSCRIPT_MATCH (default "*://*/*") = comma-separated @match patterns for the userscripts.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BASE = 'https://kmaj1st.github.io/claude-chan/';
// Alternative once the repository is public: jsDelivr, served straight from the repository.
export const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/Kmaj1st/claude-chan@main/';
// Size budgets (bytes). The inline build embeds every pose as a data: URI.
export const BUDGET = { loader: 80 * 1024, inline: 3.5 * 1024 * 1024 };

const root = new URL('../', import.meta.url);
const path = (rel) => new URL(rel, root);
const pkg = JSON.parse(readFileSync(path('package.json'), 'utf8'));
const check = process.argv.includes('--check');
const base = (process.env.CLAUDE_CHAN_BASE || DEFAULT_BASE).replace(/\/?$/, '/');
const matches = (process.env.USERSCRIPT_MATCH || '*://*/*').split(',').map((s) => s.trim()).filter(Boolean);

const banner = '/*! claude-chan hot-load ' + pkg.version + ' | code MIT (LICENSE) | sprites MIT, from Chaosnap/Claude_Overdose ' +
 '(assets/chars/NOTICE.md) | fan project, not affiliated with or endorsed by Anthropic */';

function inlineSprites() {
 const dir = path('assets/chars/');
 const poses = JSON.parse(readFileSync(new URL('poses.json', dir), 'utf8'));
 const motions = JSON.parse(readFileSync(new URL('motions.json', dir), 'utf8'));
 const images = {};
 for (const def of Object.values(poses.poses)) {
 if (images[def.file]) continue;
 const mime = def.file.endsWith('.png') ? 'image/png' : 'image/webp';
 images[def.file] = 'data:' + mime + ';base64,' + readFileSync(new URL(def.file, dir)).toString('base64');
 }
 return { poses, motions, images };
}

async function bundle(inline) {
 const plugins = inline
 ? [{
 name: 'inline-sprites',
 setup(b) {
 b.onResolve({ filter: /\/loader-assets$/ }, () => ({ path: 'inline-sprites', namespace: 'cc-inline' }));
 b.onLoad({ filter: /.*/, namespace: 'cc-inline' }, () => ({
 contents: 'export const INLINE_SPRITES = ' + JSON.stringify(inlineSprites()) + ';',
 loader: 'js',
 }));
 },
 }]
 : [];
 const out = await build({
 entryPoints: [fileURLToPath(path('src/loader.ts'))],
 bundle: true,
 write: false,
 format: 'iife',
 target: 'es2020',
 minify: true,
 legalComments: 'none',
 banner: { js: banner },
 define: { __CLAUDE_CHAN_AUTORUN__: 'true', 'import.meta.url': 'undefined' },
 // Live2D stays out of the hot-load bundle (it needs a self-hosted Cubism Core anyway).
 external: ['pixi.js', 'pixi-live2d-display', 'pixi-live2d-display/*'],
 logLevel: 'error',
 plugins,
 });
 return out.outputFiles[0].text;
}

function userscript(name, description, body) {
 const head = [
 '// ==UserScript==',
 '// @name         ' + name,
 '// @namespace    https://github.com/Kmaj1st/claude-chan',
 '// @version      ' + pkg.version,
 '// @description  ' + description,
 ...matches.map((m) => '// @match        ' + m),
 '// @grant        none',
 '// @noframes',
 '// @run-at       document-idle',
 '// @homepageURL  https://github.com/Kmaj1st/claude-chan',
 '// ==/UserScript==',
 '',
 ].join('\n');
 return head + body;
}

// Toggle: loads the mascot, or removes it when it is already there.
export function bookmarklet(b) {
 const src = JSON.stringify(b.replace(/\/?$/, '/') + 'hotload/loader.js');
 return 'javascript:(()=>{const c=window.claudeChan;if(window.__claudeChanLoader&&c&&c.unload){c.unload();return}' +
 'const s=document.createElement("script");s.src=' + src + ';' +
 's.onerror=()=>alert("claude-chan: could not load "+s.src+" (blocked by this site\'s Content-Security-Policy? See docs/HOT-LOAD.md)");' +
 '(document.head||document.documentElement).appendChild(s)})()';
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Bilingual helpers for the install page: every text exists in English and Chinese; CSS shows one of them.
const T = (en, zh) => '<span class="en">' + en + '</span><span class="zh">' + zh + '</span>';
const P = (en, zh) => '<p class="en">' + en + '</p><p class="zh">' + zh + '</p>';
const L = (items) => '<ul>' + items.map(([en, zh]) => '<li>' + T(en, zh) + '</li>').join('') + '</ul>';
// A copyable code block. "__BASE__" in the template becomes the base URL (static default here, live in the page).
const snippet = (tpl, id = '') =>
 '<div class="snip"><pre><code' + (id ? ' id="' + id + '"' : '') + ' data-tpl="' + esc(tpl) + '">' +
 esc(tpl.split('__BASE__').join(DEFAULT_BASE)) + '</code></pre>' +
 '<button type="button" class="copy" data-copy>' + T('Copy', '复制') + '</button></div>';
const link = (tpl, text) => '<a data-link="' + esc(tpl) + '" href="' + esc(tpl.split('__BASE__').join(DEFAULT_BASE)) + '">' + text + '</a>';

export const INSTALL_SNIPPETS = {
 script: "document.head.append(Object.assign(document.createElement('script'),{src:'__BASE__hotload/loader.js'}))",
 import: "import('__BASE__hotload/loader.js')",
 tag: '<script src="__BASE__hotload/loader.js" data-position="bottom-right" data-size="180"></script>',
};

function installPage() {
 const tpl = bookmarklet('__BASE__');
 const config = "window.claudeChanConfig = { position: 'bottom-right', dock: 'free', size: 180, zIndex: 2147483000, simplified: false };\n" +
 INSTALL_SNIPPETS.script;
 const api = [
 'claudeChan.help()                  // list of commands',
 'claudeChan.hide()                  // hide for this page load',
 'claudeChan.hide({ persist: true }) // stay hidden after reloads (until show())',
 'claudeChan.show()                  // show again',
 'claudeChan.toggle()                // hide/show, returns true when visible',
 'claudeChan.setPosition(0.8, 0.9)   // fractions 0..1 of the window (numbers > 1 are px)',
 'claudeChan.resetPosition()         // back to the home corner',
 'claudeChan.unload()                // remove her completely',
 'claudeChan.unload({ forget: true }) // also forget the stored position',
 'claudeChan.renderer                // "sprites" (full version), "live2d" (Cubism model) or "simplified"',
 ].join('\n');
 return `<!doctype html>
<!-- Generated by scripts/build-loader.mjs (npm run build:loader); edit the script, not this file. -->
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude-chan install</title>
<style>
:root{color-scheme:light dark;--bg:#fff8ef;--fg:#3b2416;--mut:#7a5a45;--line:#e4cdb5;--code:#f6e9da;--btn:#c96f3b;--ok:#2f7d32;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#1f1712;--fg:#f4e6d8;--mut:#c4a68e;--line:#4a3628;--code:#2b2019;--btn:#e08a55;--ok:#7bc47f;--bad:#f2867d}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.7rem;margin:0 0 4px}h2{font-size:1.2rem;margin:36px 0 8px;padding-top:12px;border-top:1px solid var(--line)}
p,li{color:var(--mut)}code{font:13px ui-monospace,Consolas,monospace}
p code,li code{background:var(--code);padding:1px 4px;border-radius:4px;color:var(--fg)}
a{color:var(--btn)}
[data-lang=en] .zh,[data-lang=zh] .en{display:none}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.lang{flex:none;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:transparent;color:inherit;cursor:pointer}
.panel{margin:20px 0;padding:14px;border:1px solid var(--line);border-radius:10px}
label{display:block;font-weight:600;margin-bottom:6px}
.row{display:flex;gap:8px;flex-wrap:wrap}
input{flex:1 1 260px;min-width:0;padding:8px;border:1px solid var(--line);border-radius:6px;background:transparent;color:inherit;font:14px ui-monospace,monospace}
button{font:inherit}
.btn,.bm{display:inline-block;padding:9px 16px;border:0;border-radius:999px;background:var(--btn);color:#fff;text-decoration:none;font-weight:600;cursor:pointer}
.ghost{padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:transparent;color:inherit;cursor:pointer}
.status{margin:10px 0 0;font:13px ui-monospace,monospace;word-break:break-all}
.status.ok{color:var(--ok)}.status.bad{color:var(--bad)}
.snip{position:relative;margin:8px 0 14px}
pre{margin:0;padding:12px 76px 12px 12px;background:var(--code);border-radius:8px;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.copy{position:absolute;top:8px;right:8px;padding:4px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:inherit;cursor:pointer;font-size:13px}
.copy.done::after{content:" \\2713"}
#trymsg{margin-left:8px}
</style>
</head>
<body>
<main>
<div class="top">
<div>
<h1>${T('Load Claude-chan onto any page', '把 Claude-chan 加载到任意网页')}</h1>
${P('<b>Full version = sprites (default).</b> Every method below loads the real sprite art: 21 hand-drawn poses and 15 motions, fetched from the base URL (or embedded in the inline build). <b>Simplified version = a code-drawn stand-in</b> that appears only if the sprites cannot be loaded, or when you ask for it with <code>simplified:true</code>. It has fewer expressions/poses and no real art.',
 '<b>完整版 = 精灵图（默认）。</b>下面每种方式都会加载真正的精灵图：21 个手绘姿势和 15 个动作，从基础地址获取（内嵌版则直接内置）。<b>简化版 = 代码绘制的替身</b>，只有在精灵图无法加载时才会出现，或当你用 <code>simplified:true</code> 主动要求时。它的表情和姿势更少，也没有真正的美术。')}
${L([
 ['The simplified version lacks: the 21 hand-drawn poses (idea, giggle, cheer, typing, explain, away, ...), the real anime art (it is a plain code-drawn figure), and the sprite cross-fades. It only tilts, blinks, moves brows, mouth and arms.', '简化版缺少：21 个手绘姿势（灵感、咯咯笑、欢呼、打字、讲解、离开等）、真正的动漫美术（只是简单的代码绘制人物）以及精灵图的淡入淡出。它只会倾斜、眨眼、动眉毛、嘴和手臂。'],
 ['How to tell: after loading, <code>claudeChan.renderer</code> is <code>"sprites"</code> (full) or <code>"simplified"</code>, <code>claudeChan.isSimplified</code> is true/false, and <code>claudeChan.help()</code> prints it. If the sprites fail, the console shows <code>claude-chan: sprites could not be loaded from …; showing the SIMPLIFIED code-drawn version</code>.', '如何判断：加载后 <code>claudeChan.renderer</code> 为 <code>"sprites"</code>（完整）或 <code>"simplified"</code>（简化），<code>claudeChan.isSimplified</code> 为 true/false，<code>claudeChan.help()</code> 也会打印。精灵图加载失败时，控制台会显示 <code>claude-chan: sprites could not be loaded from …; showing the SIMPLIFIED code-drawn version</code>。'],
 ['Live2D (optional): set <code>window.claudeChanConfig = { renderer: "live2d", model: "https://…/claude-chan.model3.json" }</code> before loading. Only then are the Cubism Core (official Live2D CDN) and the Live2D runtime fetched; if anything fails she shows the sprites. See docs/LIVE2D.md.', 'Live2D（可选）：加载前设置 <code>window.claudeChanConfig = { renderer: "live2d", model: "https://…/claude-chan.model3.json" }</code>。只有这样才会获取 Cubism Core（Live2D 官方 CDN）和 Live2D 运行库；任何部分失败都会显示精灵图。见 docs/LIVE2D.md。'],
])}
${P('Pick one way below: a console line, a bookmark, or a userscript. Every snippet already uses the base URL from the field, so it is ready to copy.',
 '下面任选一种方式：控制台一行代码、书签或用户脚本。每段代码都已经填好了上方输入框里的基础地址，可以直接复制。')}
</div>
<button type="button" class="lang" id="lang">中文 / EN</button>
</div>

<div class="panel">
<label for="base">${T('Base URL (where <code>hotload/loader.js</code> is served)', '基础地址（提供 <code>hotload/loader.js</code> 的地址）')}</label>
<div class="row">
<input id="base" value="${esc(DEFAULT_BASE)}" spellcheck="false" autocomplete="off">
<button type="button" class="ghost" id="reset">${T('Reset', '重置')}</button>
</div>
<p class="status" id="status" role="status"></p>
<p class="status" id="renderer" role="status"></p>
${L([
 ['<code>' + esc(DEFAULT_BASE) + '</code>: GitHub Pages (default when this page is opened as a file).', '<code>' + esc(DEFAULT_BASE) + '</code>：GitHub Pages（以本地文件打开本页时的默认值）。'],
 ['<code>http://127.0.0.1:5179/</code>: local copy, after <code>npm run serve:loader</code>.', '<code>http://127.0.0.1:5179/</code>：本地副本，先运行 <code>npm run serve:loader</code>。'],
 ['<code>' + esc(JSDELIVR_BASE) + '</code>: jsDelivr, works only once the GitHub repository is public.', '<code>' + esc(JSDELIVR_BASE) + '</code>：jsDelivr，仅在 GitHub 仓库公开后可用。'],
])}
<p><button type="button" class="btn" id="try">${T('Try it on this page', '在本页试一下')}</button><span id="trymsg" role="status"></span></p>
</div>

<h2>${T('1. Console (script hot-load)', '1. 控制台（脚本热加载）')}</h2>
${P('Open the page where you want her, press <b>F12</b> (or Ctrl+Shift+J / Cmd+Option+J), open the <b>Console</b> tab, paste this line and press Enter:',
 '打开要放她的网页，按 <b>F12</b>（或 Ctrl+Shift+J / Cmd+Option+J），切到 <b>Console（控制台）</b> 标签，粘贴下面这行并回车：')}
${snippet(INSTALL_SNIPPETS.script, 'snip-script')}
${P('Or as a module import (also works where <code>document.head</code> is missing):', '或者用模块导入（在没有 <code>document.head</code> 的页面也能用）：')}
${snippet(INSTALL_SNIPPETS.import, 'snip-import')}
${L([
 ['Chrome and Edge block the first paste into the console: type <code>allow pasting</code>, press Enter, then paste again. Firefox asks the same.', 'Chrome 和 Edge 会拦截第一次粘贴：先输入 <code>allow pasting</code> 并回车，再粘贴一次。Firefox 也会这样提示。'],
 ['What you should see: Claude-chan in the bottom-left corner within a second, and <code>window.claudeChan</code> in the console.', '应看到：一秒内 Claude-chan 出现在左下角，控制台里可以访问 <code>window.claudeChan</code>。'],
 ['Running it twice does nothing: there is never more than one mascot.', '重复运行不会有副作用：页面上永远只有一个吉祥物。'],
 ['Remove her with <code>claudeChan.unload()</code>. Reloading the page removes her too.', '用 <code>claudeChan.unload()</code> 移除她；刷新页面也会移除。'],
])}

<h2>${T('2. Bookmarklet', '2. 书签')}</h2>
${P('Drag this button to your bookmarks bar (show it with Ctrl+Shift+B). Click the bookmark on any page to add Claude-chan; click it again to remove her.',
 '把这个按钮拖到书签栏（Ctrl+Shift+B 显示书签栏）。在任意网页点击该书签即可加入 Claude-chan，再点一次移除。')}
<p><a class="bm" id="bm" href="${esc(bookmarklet(DEFAULT_BASE))}">Claude-chan</a></p>
${P('If dragging does not work: create a new bookmark and paste this code into its URL field.', '如果拖不动：新建一个书签，把下面的代码粘贴到网址栏。')}
${snippet(bookmarklet(DEFAULT_BASE), 'bmcode')}

<h2>${T('3. Userscript (every page, automatically)', '3. 用户脚本（每个网页自动加载）')}</h2>
${P('Install Tampermonkey or Violentmonkey, then open one of these links; the manager offers to install it:',
 '先安装 Tampermonkey 或 Violentmonkey 扩展，再打开下面的链接，扩展会弹出安装页面：')}
<ul>
<li>${link('__BASE__hotload/claude-chan.user.js', T('Install claude-chan.user.js', '安装 claude-chan.user.js'))} ${T('(plain loader, about 50 KB; FULL version, fetches the sprites from the base URL)', '（普通加载器，约 50 KB；完整版，从基础地址获取精灵图）')}</li>
<li>${link('__BASE__hotload/claude-chan.inline.user.js', T('Install claude-chan.inline.user.js', '安装 claude-chan.inline.user.js'))} ${T('(inline, strict-CSP sites; FULL version, all 21 poses and 15 motions embedded, about 2.3 MB)', '（内嵌版，适用于严格 CSP 的网站；完整版，内嵌全部 21 个姿势和 15 个动作，约 2.3 MB）')}</li>
</ul>
${L([
 ['It runs on every page (<code>@match *://*/*</code>). To limit it, edit the <code>@match</code> lines in the manager, for example <code>https://example.com/*</code>.', '默认在所有网页运行（<code>@match *://*/*</code>）。要限制范围，在扩展里编辑 <code>@match</code> 行，例如 <code>https://example.com/*</code>。'],
 ['The userscripts load sprites from <code>' + esc(DEFAULT_BASE) + '</code>.', '用户脚本从 <code>' + esc(DEFAULT_BASE) + '</code> 加载图像。'],
])}

<h2>${T('4. Sites with a strict Content-Security-Policy', '4. 内容安全策略（CSP）严格的网站')}</h2>
${P('Some sites (for example GitHub) only allow their own scripts. Symptom: nothing appears, the console shows <code>Refused to load the script … because it violates the following Content Security Policy directive</code>, and the bookmarklet shows an alert.',
 '有些网站（例如 GitHub）只允许自己的脚本。现象：什么都没出现，控制台显示 <code>Refused to load the script … Content Security Policy</code>，书签会弹出提示。')}
${L([
 ['Use the inline userscript (<code>claude-chan.inline.user.js</code>): the manager injects it, and the sprites are embedded.', '改用内嵌版用户脚本（<code>claude-chan.inline.user.js</code>）：由扩展注入，图像已内嵌。'],
 ['If even <code>data:</code> images are blocked, the sprites cannot load and she shows the SIMPLIFIED code-drawn version instead (fewer poses, no real art; see the top of this page).', '如果连 <code>data:</code> 图像也被禁止，精灵图无法加载，她会显示简化版（代码绘制，姿势更少，没有真正的美术；见本页顶部）。'],
 ['The console line and the bookmarklet add a script tag, which CSP blocks. Pasting the <em>contents</em> of ' + link('__BASE__hotload/claude-chan.inline.js', '<code>claude-chan.inline.js</code>') + ' into the console works on most CSP sites.', '控制台代码和书签会添加 script 标签，会被 CSP 拦截。把 ' + link('__BASE__hotload/claude-chan.inline.js', '<code>claude-chan.inline.js</code>') + ' 的<em>文件内容</em>粘贴到控制台，在大多数 CSP 网站上可用。'],
])}

<h2>${T('5. Options and console commands', '5. 选项与控制台命令')}</h2>
${P('Set options before loading, as <code>window.claudeChanConfig</code> or as <code>data-*</code> attributes on the script tag:',
 '在加载前设置选项：用 <code>window.claudeChanConfig</code>，或在 script 标签上写 <code>data-*</code> 属性：')}
${snippet(config, 'snip-config')}
${snippet(INSTALL_SNIPPETS.tag, 'snip-tag')}
${L([
 ['<code>position</code>: bottom-left (default), bottom-right, top-left, top-right. <code>dock</code>: free (drag anywhere) or fixed-default. <code>size</code>: height in px. <code>zIndex</code>: stacking order.', '<code>position</code>：bottom-left（默认）、bottom-right、top-left、top-right。<code>dock</code>：free（可随意拖动）或 fixed-default。<code>size</code>：高度（像素）。<code>zIndex</code>：层级。'],
 [`<code>simplified</code>: false (default, full sprite version) or true to deliberately show the SIMPLIFIED code-drawn stand-in. <code>sprites</code>: URL of the sprite folder (default: <code>base</code> + <code>assets/chars/</code>).`, `<code>simplified</code>：false（默认，完整精灵版）或 true（主动显示简化的代码绘制替身）。<code>sprites</code>：精灵图文件夹地址（默认 <code>base</code> + <code>assets/chars/</code>）。`],
 ['Attributes: <code>data-position</code>, <code>data-dock</code>, <code>data-size</code>, <code>data-z-index</code>, <code>data-base</code>, <code>data-sprites</code>, <code>data-frames</code>, <code>data-simplified</code>.', '属性名：<code>data-position</code>、<code>data-dock</code>、<code>data-size</code>、<code>data-z-index</code>、<code>data-base</code>、<code>data-sprites</code>、<code>data-frames</code>、<code>data-simplified</code>。'],
])}
${P('Console commands once she is loaded:', '加载后可在控制台使用：')}
${snippet(api, 'snip-api')}

<h2>${T('6. Troubleshooting', '6. 故障排查')}</h2>
${L([
 ['<b>Nothing appears.</b> Look at the status line at the top of this page: it must say OK for your base URL. In DevTools open the <b>Network</b> tab and check that <code>loader.js</code> returns 200.', '<b>什么都没出现。</b>先看本页顶部的状态行，必须显示 OK。在开发者工具的 <b>Network（网络）</b> 标签里确认 <code>loader.js</code> 返回 200。'],
 ['<b>Wrong base URL</b> (404): the base must be the folder that contains <code>hotload/</code>, ending with <code>/</code>.', '<b>基础地址错误</b>（404）：基础地址必须是包含 <code>hotload/</code> 的目录，并以 <code>/</code> 结尾。'],
 ['<b>CSP error</b> in the console: see section 4.', '控制台出现 <b>CSP 错误</b>：见第 4 节。'],
 ['<b>Ad or script blockers</b> can block <code>loader.js</code>; allow the base host for that site.', '<b>广告或脚本拦截扩展</b>可能拦截 <code>loader.js</code>；为该网站放行基础地址的域名。'],
 ['<b>Inside an iframe</b> she does not mount unless <code>frames: true</code> is set; run the line in the top page.', '<b>在 iframe 里</b>默认不加载，除非设置 <code>frames: true</code>；请在顶层页面运行。'],
 ['<b>Mixed content</b>: an <code>https://</code> page may not load scripts from <code>http://</code> hosts, except <code>http://127.0.0.1</code> (localhost counts as secure).', '<b>混合内容</b>：<code>https://</code> 页面不能从 <code>http://</code> 地址加载脚本，<code>http://127.0.0.1</code> 除外（本机地址视为安全）。'],
 ['<b>Old art or old behaviour after an update</b>: GitHub Pages lets browsers cache files for 10 minutes. Wait, or hard-refresh (Ctrl+F5 / Cmd+Shift+R). A base you set in <code>window.claudeChanConfig.base</code> always wins over the one baked into the userscript.', '<b>更新后仍是旧图像或旧行为</b>：GitHub Pages 允许浏览器缓存文件 10 分钟。请稍等，或强制刷新（Ctrl+F5 / Cmd+Shift+R）。在 <code>window.claudeChanConfig.base</code> 中自行设置的基础地址总是优先于用户脚本内置的地址。'],
 ['<b>404 from jsDelivr</b>: jsDelivr only serves public repositories. Use the GitHub Pages base until the repository is public.', '<b>jsDelivr 返回 404</b>：jsDelivr 只提供公开仓库的文件。仓库公开前请使用 GitHub Pages 地址。'],
])}
${P('More: <a href="https://github.com/Kmaj1st/claude-chan/blob/main/docs/HOT-LOAD.md">docs/HOT-LOAD.md</a>.', '更多内容：<a href="https://github.com/Kmaj1st/claude-chan/blob/main/docs/HOT-LOAD.md">docs/HOT-LOAD.md</a>。')}
</main>
<script>
(function () {
 var FALLBACK = ${JSON.stringify(DEFAULT_BASE)};
 var BM = ${JSON.stringify(tpl)};
 var BM_KEY = ${JSON.stringify(JSON.stringify('__BASE__/hotload/loader.js'))};
 var root = document.documentElement, base = document.getElementById('base');
 var status = document.getElementById('status'), rend = document.getElementById('renderer'), trymsg = document.getElementById('trymsg');
 var lang = 'en', seq = 0, timer = 0, last = null;
 function norm(v) { v = (v || '').trim() || FALLBACK; return v.charAt(v.length - 1) === '/' ? v : v + '/'; }
 // Served over http(s): this site's root (everything before /docs/install.html). Opened as a file: GitHub Pages.
 function own() {
 if (!/^https?:$/.test(location.protocol)) return FALLBACK;
 var p = location.pathname, i = p.lastIndexOf('/docs/');
 return location.origin + (i >= 0 ? p.slice(0, i + 1) : p.replace(/[^/]*$/, ''));
 }
 function tr(en, zh) { return lang === 'zh' ? zh : en; }
 function setLang(l) {
 lang = l; root.setAttribute('data-lang', l); root.lang = l === 'zh' ? 'zh-CN' : 'en';
 try { localStorage.setItem('claude-chan-install-lang', l); } catch (e) {}
 if (last) show(last);
 }
 function show(s) {
 last = s;
 status.className = 'status ' + s.cls;
 status.textContent = s.cls === 'ok' ? tr('OK: ', '正常：') + s.url + ' (' + s.code + ')'
 : s.cls === 'bad' ? tr('FAILED: ', '失败：') + s.url + ' (' + (s.code || tr('network error, CORS or blocked', '网络错误、CORS 或被拦截')) + ')'
 : tr('Checking ', '正在检查 ') + s.url + ' …';
 }
 // Shows which renderer is on screen once the mascot is ready: sprites (full) or SIMPLIFIED.
 function showRenderer() {
 var inst = window.__claudeChanLoader, c = window.claudeChan;
 if (!inst || !c) { rend.className = 'status'; rend.textContent = ''; return; }
 inst.controller.ready.then(function () {
 var simple = c.isSimplified === true;
 rend.className = 'status ' + (simple ? 'bad' : 'ok');
 rend.textContent = simple
 ? tr('Renderer: SIMPLIFIED (code-drawn stand-in; the sprites could not be loaded)', '渲染方式：简化版（代码绘制的替身；精灵图无法加载）')
 : tr('Renderer: sprites (full)', '渲染方式：精灵图（完整版）');
 });
 }
 function probe(b) {
 var n = ++seq, url = b + 'hotload/loader.js';
 show({ cls: 'wait', url: url });
 fetch(url, { cache: 'no-store' }).then(function (r) {
 if (n === seq) show({ cls: r.ok ? 'ok' : 'bad', url: url, code: r.status });
 }, function () { if (n === seq) show({ cls: 'bad', url: url }); });
 }
 function apply() {
 var b = norm(base.value), i, els;
 els = document.querySelectorAll('[data-tpl]');
 for (i = 0; i < els.length; i++) els[i].textContent = els[i].getAttribute('data-tpl').split('__BASE__').join(b);
 els = document.querySelectorAll('[data-link]');
 for (i = 0; i < els.length; i++) els[i].href = els[i].getAttribute('data-link').split('__BASE__').join(b);
 var js = BM.split(BM_KEY).join(JSON.stringify(b + 'hotload/loader.js'));
 document.getElementById('bm').href = js;
 document.getElementById('bmcode').textContent = js;
 clearTimeout(timer); timer = setTimeout(function () { probe(b); }, 250);
 }
 function copy(text, btn) {
 function done() { btn.classList.add('done'); setTimeout(function () { btn.classList.remove('done'); }, 1200); }
 function fallback() {
 var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
 try { document.execCommand('copy'); } catch (e) {}
 ta.remove(); done();
 }
 if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
 }
 document.addEventListener('click', function (ev) {
 var btn = ev.target.closest && ev.target.closest('[data-copy]');
 if (btn) copy(btn.parentNode.querySelector('code').textContent, btn);
 });
 document.getElementById('lang').addEventListener('click', function () { setLang(lang === 'zh' ? 'en' : 'zh'); });
 document.getElementById('reset').addEventListener('click', function () { base.value = own(); apply(); });
 document.getElementById('try').addEventListener('click', function () {
 var c = window.claudeChan;
 if (window.__claudeChanLoader && c && c.unload) { c.unload(); trymsg.textContent = tr('Removed.', '已移除。'); showRenderer(); return; }
 var s = document.createElement('script');
 s.src = norm(base.value) + 'hotload/loader.js';
 s.onload = function () { trymsg.textContent = tr('Loaded: she is in the bottom-left corner. Click again to remove her.', '已加载：她在左下角。再点一次移除。'); showRenderer(); };
 s.onerror = function () { trymsg.textContent = tr('Could not load ', '无法加载 ') + s.src; };
 document.head.appendChild(s);
 });
 base.addEventListener('input', apply);
 var saved = null;
 try { saved = localStorage.getItem('claude-chan-install-lang'); } catch (e) {}
 setLang(saved === 'zh' || saved === 'en' ? saved : (/^zh/i.test(navigator.language || '') ? 'zh' : 'en'));
 base.value = own();
 apply();
})();
</script>
</body>
</html>
`;
}

async function outputs() {
 const loader = await bundle(false);
 const inline = await bundle(true);
 const cfg = 'window.claudeChanConfig=Object.assign({base:' + JSON.stringify(base) + '},window.claudeChanConfig);\n';
 return {
 'hotload/loader.js': loader,
 'hotload/claude-chan.inline.js': inline,
 'hotload/claude-chan.user.js': userscript('Claude-chan', 'Shows the Claude-chan mascot on web pages: FULL sprite version, sprites from ' + base + '. Shows a SIMPLIFIED code-drawn stand-in only if the sprites cannot load.', cfg + loader),
 'hotload/claude-chan.inline.user.js': userscript('Claude-chan (inline)', 'Shows the Claude-chan mascot on web pages: FULL sprite version, all poses embedded, works on strict-CSP sites that allow data: images. Shows a SIMPLIFIED code-drawn stand-in only if data: images are blocked.', cfg + inline),
 'hotload/bookmarklet.txt': bookmarklet(base) + '\n',
 'docs/install.html': installPage(),
 };
}

const files = await outputs();
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
let bad = 0;
for (const [name, limit] of [['hotload/loader.js', BUDGET.loader], ['hotload/claude-chan.inline.js', BUDGET.inline]]) {
 const size = Buffer.byteLength(files[name]);
 const ok = size <= limit;
 console.log((ok ? 'size ok  ' : 'TOO BIG  ') + name + ' ' + kb(size) + ' (budget ' + kb(limit) + ')');
 if (!ok) bad++;
}
if (check) {
 for (const [name, text] of Object.entries(files)) {
 let have = null;
 try { have = readFileSync(path(name), 'utf8'); } catch { /* missing */ }
 if (have !== text) {
 console.log('STALE    ' + name + ' (run npm run build:loader)');
 bad++;
 }
 }
 if (!bad) console.log('hotload/ and docs/install.html are up to date');
} else {
 mkdirSync(path('hotload/'), { recursive: true });
 for (const [name, text] of Object.entries(files)) writeFileSync(path(name), text);
 console.log('wrote ' + Object.keys(files).join(', '));
}
process.exit(bad ? 1 : 0);
