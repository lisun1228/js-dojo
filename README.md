# JS 道场 · js-dojo

一个用来沉淀前端知识点的学习型项目：**教程正文用 Markdown 写，页面负责渲染，并配一个可运行的交互演示**。

- 正文与样式解耦：新增教程只需写 `.md`，不用手写模板和 CSS
- 每个教程配独立的可运行 Demo，点按钮即可看到实际输出
- 教程分类、菜单、路由由同一份配置驱动

## 技术栈

| 依赖                        | 版本 | 用途                                                               |
| --------------------------- | ---- | ------------------------------------------------------------------ |
| Vue                         | ^3.5 | 框架（`<script setup>` SFC，Vue 3.5 的 `useTemplateRef` 等新 API） |
| Vue Router                  | ^4.6 | 路由（history 模式 + 懒加载）                                      |
| Pinia                       | ^4.1 | 状态管理（主题切换）                                               |
| pinia-plugin-persistedstate | ^4.7 | Pinia 状态持久化到 localStorage                                    |
| TypeScript                  | ~6.0 | 类型检查                                                           |
| Vite                        | ^8.3 | 开发与构建                                                         |
| markdown-it                 | ^15  | Markdown → HTML                                                    |
| highlight.js                | ^11  | 代码块语法高亮                                                     |

## 快速开始

```bash
npm install

npm run dev       # 启动开发服务器（默认 http://localhost:5173）
npm run build     # 类型检查 + 构建产物（vue-tsc -b && vite build）
npm run preview   # 本地预览构建产物
```

环境要求：Node.js 20+（建议使用 LTS 版本）。

## 开发规范

### 一、代码书写规范

为保证团队成员书写出一致的代码风格，本项目使用 eslint 约束了代码风格并会在文件进行保存时自动进行格式化修复。

规则由 [eslint.config.js](eslint.config.js)（ESLint + typescript-eslint + eslint-plugin-vue + Prettier）与 [.prettierrc.json](.prettierrc.json) 共同定义。

> 教程正文 `src/docs/**/*.md` 属于手写讲解、含刻意编排的示例代码，已在 [.prettierignore](.prettierignore) 中排除，不参与自动格式化。

**编辑器配置（保存时自动修复）**

VS Code 需安装 `Vue.volar`、`dbaeumer.vscode-eslint`、`esbenp.prettier-vscode`，并在 `.vscode/settings.json` 中开启：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": ["javascript", "typescript", "vue"]
}
```

**常用命令**

| 命令                   | 说明                             |
| ---------------------- | -------------------------------- |
| `npm run lint`         | 全量检查代码规范问题（不改文件） |
| `npm run lint:fix`     | 全量检查并自动修复可修复的问题   |
| `npm run format`       | 用 Prettier 格式化全仓文件       |
| `npm run format:check` | 只校验格式，不做修改             |

**提交前校验**

自动修复并不能覆盖所有场景，为了保证代码的可靠性，项目还会在代码进行 git 提交时校验代码的正确性：Husky 的 `pre-commit` 钩子会对暂存文件跑一遍 eslint / Prettier 校验，如果存在未修复的代码格式错误，将会导致代码无法进行 git 提交。请手动按照 eslint 错误提示进行修复（或执行 `npm run lint:fix`）后再进行 git 提交。

### 二、Git 提交规范

git 提交时采用了 commitlint 规范进行格式验证，提交代码时说明信息需要符合相关规范格式才能够提交，格式为 `<type>: <subject>`。

例如：本次提交是新功能开发，则填写提交信息为

```
feat: 用户管理增加编辑用户信息能力
```

常用 type：

| type       | 含义                         |
| ---------- | ---------------------------- |
| `feat`     | 新功能                       |
| `fix`      | 修复 bug                     |
| `docs`     | 仅文档变更                   |
| `style`    | 代码格式（不影响逻辑）       |
| `refactor` | 重构（既非新功能也非修 bug） |
| `perf`     | 性能优化                     |
| `test`     | 测试相关                     |
| `build`    | 构建或依赖变更               |
| `ci`       | CI 配置变更                  |
| `chore`    | 其他杂项                     |
| `revert`   | 回滚提交                     |

规则定义在 [commitlint.config.js](commitlint.config.js)，由 Husky 的 `commit-msg` 钩子执行校验，格式不符会被拒绝提交。

commitlint 规范参考文档：<https://blog.csdn.net/weixin_41447256/article/details/124260333/>

## 目录结构

```
build/
└── mermaid.ts               # Vite 插件：构建期把 mermaid 代码块渲染成内联 SVG

src/
├── docs/                    # 教程正文，按分类分目录（目录名 = tutorials.ts 的 dir）
│   ├── index.ts             # 装配层：按清单加载 md 与演示组件
│   ├── design-patterns/     # 设计模式
│   ├── vue/                 # Vue
│   ├── es6/                 # ES6 三十二题
│   ├── performance/         # 性能优化 25 题
│   ├── security/            # 前端安全 21 题
│   ├── algorithms/          # 算法 19 题
│   └── js-principles/       # JS 原理
├── components/
│   ├── MarkdownView.vue     # Markdown 渲染组件（markdown-it + highlight.js）
│   ├── ImagePreview.vue     # 正文图片点击后的全屏预览遮罩
│   ├── ThemeSwitcher.vue    # 页头主题色块切换器
│   ├── BackToTop.vue        # 页面滚动后的回到顶部悬浮按钮
│   └── demos/               # 各教程的交互演示
│       ├── DemoPanel.vue    # 统一的「按钮 + 运行日志」外壳
│       ├── useDemoLog.ts    # 日志收集 composable
│       └── *Demo.vue
├── stores/
│   └── theme.ts             # 主题清单与当前主题（pinia + 持久化）
├── router/
│   ├── tutorials.ts         # ★ 教程分类与清单（唯一数据源）
│   └── index.ts             # 路由表
├── views/
│   ├── DocView.vue          # 通用教程页：按 /doc/:id 渲染正文 + 演示
│   ├── HomeView.vue         # 首页（占位）
│   └── NotFound.vue         # 404 兜底
├── App.vue                  # 布局：页头 + 左侧分类导航 + 内容区
├── main.ts                  # 入口
└── style.css                # 全局样式与多主题变量（data-theme 驱动）
```

## 教程体系

### 数据流

[`src/router/tutorials.ts`](src/router/tutorials.ts) 是**唯一数据源**，一份清单同时驱动三处：

```
tutorials.ts（分类 + 教程清单）
   ├─ tutorialMenus  →  App.vue 左侧导航
   ├─ /doc/:id       →  DocView.vue 按 id 取内容
   └─ tutorials      →  docs/index.ts 按 dir + id 装配 src/docs/<dir>/<id>.md
```

分类的**目录名**（`dir`，英文 kebab-case）与**中文名**（`title`）只在 `categories` 里定义一次：`dir` 决定文档位置，`title` 用于侧边栏分组，改分类名只需改一处。

### 现有教程

| 分类           | 教程                                                  | 路由                                    |
| -------------- | ----------------------------------------------------- | --------------------------------------- |
| 设计模式       | 装饰器 + @语法糖                                      | `/doc/decorator`                        |
| 设计模式       | 适配器模式                                            | `/doc/adapter`                          |
| 设计模式       | 策略模式                                              | `/doc/strategy`                         |
| 设计模式       | 单例模式                                              | `/doc/singleton`                        |
| Vue            | Props / 插槽 / $attrs                                 | `/doc/props-slots`                      |
| Vue            | Proxy 与响应式                                        | `/doc/proxy-reactive`                   |
| Vue            | 响应式原理 effect                                     | `/doc/reactive-effect`                  |
| Vue            | Vue3 Diff算法原理（面试版）                           | `/doc/diff-algorithm`                   |
| Vue            | Pinia 与 Vuex 完全指南                                | `/doc/pinia-vuex`                       |
| Vue            | Vue 中 keep-alive 详解与面试回答模板                  | `/doc/keep-alive`                       |
| Vue            | Vue 插槽 slot 详解与面试回答                          | `/doc/slots`                            |
| Vue            | Vue 自定义指令详解与面试回答                          | `/doc/custom-directive`                 |
| Vue            | Vue 路由模式详解与面试回答                            | `/doc/router-mode`                      |
| Vue            | Vue 路由守卫详解与面试回答                            | `/doc/router-guard`                     |
| Vue            | Vue 3 高频面试题详解与答题模板                        | `/doc/vue3-interview`                   |
| ES6 三十二题   | ES6 三十二题 · 分册索引与「新特性」总览               | `/doc/es6-overview`                     |
| ES6 三十二题   | 分册 01 · 变量、作用域、闭包与 this                   | `/doc/es6-variables-scope-closure-this` |
| ES6 三十二题   | 分册 02 · 对象、原型与继承                            | `/doc/es6-object-prototype-inheritance` |
| ES6 三十二题   | 分册 03 · 响应式原理：Proxy 与 Object.defineProperty  | `/doc/es6-reactivity-proxy`             |
| ES6 三十二题   | 分册 04 · 异步：Promise、async/await 与事件循环       | `/doc/es6-async-event-loop`             |
| ES6 三十二题   | 分册 05 · 模块与工程化：ESM vs CommonJS、HMR          | `/doc/es6-module-engineering`           |
| ES6 三十二题   | 分册 06 · 集合、迭代与数组扩展                        | `/doc/es6-collections-iteration`        |
| ES6 三十二题   | 分册 07 · 类型转换与隐式规则                          | `/doc/es6-type-coercion`                |
| JS 原理        | 事件传播与停止                                        | `/doc/event-propagation`                |
| JS 原理        | 手写 call / bind                                      | `/doc/call-bind`                        |
| JS 原理        | 原型与原型链                                          | `/doc/prototype-chain`                  |
| 性能优化 25 题 | 性能优化 25 题 · 总览与索引                           | `/doc/perf-overview`                    |
| 性能优化 25 题 | 性能 · 01 指标体系与监控                              | `/doc/perf-metrics-monitoring`          |
| 性能优化 25 题 | 性能 · 02 加载与网络：缓存 / CDN / HTTP2 / 资源优先级 | `/doc/perf-loading-network`             |
| 性能优化 25 题 | 性能 · 03 首屏优化：从 SSR 到关键路径                 | `/doc/perf-first-screen`                |
| 性能优化 25 题 | 性能 · 04 渲染优化：渲染流水线与重排重绘              | `/doc/perf-rendering`                   |
| 性能优化 25 题 | 性能 · 05 图片与资源优化：懒加载                      | `/doc/perf-images-lazy-load`            |
| 性能优化 25 题 | 性能 · 06 JS 引擎与内存：V8 优化与内存泄漏            | `/doc/perf-js-engine-memory`            |
| 性能优化 25 题 | 性能 · 07 Webpack：打包原理 / 构建优化 / HMR          | `/doc/perf-webpack`                     |
| 前端安全 21 题 | 前端安全 21 题 · 总览与索引                           | `/doc/security-overview`                |
| 前端安全 21 题 | 安全 · 01 XSS 跨站脚本攻击                            | `/doc/security-xss`                     |
| 前端安全 21 题 | 安全 · 02 CSRF 与 Cookie 安全                         | `/doc/security-csrf-cookie`             |
| 前端安全 21 题 | 安全 · 03 CSP 与安全响应头                            | `/doc/security-csp-headers`             |
| 前端安全 21 题 | 安全 · 04 点击劫持与 iframe 安全                      | `/doc/security-clickjacking-iframe`     |
| 前端安全 21 题 | 安全 · 05 传输层：HTTPS、中间人、网络劫持与 SRI       | `/doc/security-transport-https`         |
| 前端安全 21 题 | 安全 · 06 鉴权体系与数据安全                          | `/doc/security-auth-data`               |
| 前端安全 21 题 | 安全 · 07 跨域与 WebSocket 安全                       | `/doc/security-cors-websocket`          |
| 前端安全 21 题 | 安全 · 08 工程化落地：SQL 注入、供应链与检查清单      | `/doc/security-supply-chain`            |
| 算法 19 题     | 算法 19 题 · 总览与索引                               | `/doc/algo-overview`                    |
| 算法 19 题     | 算法 · 01 复杂度分析与递归（尾调用）                  | `/doc/algo-complexity-recursion`        |
| 算法 19 题     | 算法 · 02 基础排序：冒泡 / 选择 / 插入 / 希尔         | `/doc/algo-basic-sorts`                 |
| 算法 19 题     | 算法 · 03 进阶排序：归并 / 快排 / 堆排                | `/doc/algo-advanced-sorts`              |
| 算法 19 题     | 算法 · 04 线性排序：计数 / 桶 / 基数                  | `/doc/algo-linear-sorts`                |
| 算法 19 题     | 算法 · 05 链表与堆：合并 K 个升序链表                 | `/doc/algo-linked-list-heap`            |
| 算法 19 题     | 算法 · 06 哈希与缓存：LRU                             | `/doc/algo-hash-lru`                    |
| 算法 19 题     | 算法 · 07 字符串与双指针                              | `/doc/algo-string-two-pointers`         |
| 算法 19 题     | 算法 · 08 概率与随机：洗牌与最优停止                  | `/doc/algo-probability-random`          |

### 新增一篇教程

1. 在 `src/docs/<dir>/` 下新建 `<id>.md` 作为正文（`dir` 取目标分类的 `dir`，首行用 `# 标题`）
2. 需要交互演示的话，在 `src/components/demos/` 下新建 `<Xxx>Demo.vue`
3. 在 `src/router/tutorials.ts` 对应分类里加一条记录：

```ts
{ id: 'xxx', title: '菜单标题', demo: 'XxxDemo' }
```

文档路径由分类的 `dir` 和教程的 `id` 拼出（`src/docs/<dir>/<id>.md`），侧边栏、路由、正文渲染都会自动跟随，不需要改其他地方。新增分类时在 `categories` 里同时补上 `dir`（英文目录名）与 `title`（中文名），并在 `src/docs/` 下建好同名目录。

### 在正文里插图

图片统一放在 `public/`，正文里用根路径引用，点击即可放大预览：

```
![原型与原型链示意图](/yuanxinglian.png)
```

正文是用 Vite `?raw` 读成字符串再交给 markdown-it 渲染的，`src/assets` 下的相对路径不会被 Vite 处理、运行时也无法解析，所以图片必须放 `public/`。

### 写一个演示组件

演示统一用 `DemoPanel` 承载「按钮 + 运行日志」，样式由它提供，业务组件只关心逻辑：

```vue
<template>
  <DemoPanel
    :logs="logs"
    hint="操作提示"
    @clear="clear"
  >
    <button
      class="run"
      @click="run"
    >
      运行
    </button>

    <!-- 需要可视化交互的元素（可点击的 DOM 结构等）放 body 插槽 -->
    <template #body>
      <div ref="boxEl">点我</div>
    </template>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

const run = () => push('输出一行日志')
</script>
```

按钮加 `.run` 类即可获得统一样式（`DemoPanel` 通过 `:slotted()` 提供）。

## 路由

| 路径               | 说明                                           |
| ------------------ | ---------------------------------------------- |
| `/`                | 首页（占位）                                   |
| `/doc/:id`         | 通用教程页，`id` 对应 `src/docs/<dir>/<id>.md` |
| `/:pathMatch(.*)*` | 404 兜底，展示请求的路径                       |

## 实现要点

- **Markdown 渲染**：用 Vite 的 `?raw` 把 `.md` 当字符串导入，交给 `markdown-it` 渲染；`highlight.js` 只按需注册 `ts / js / json / bash / sh / html / xml / vue / css / md`，避免整个语言包进 bundle。
- **标题锚点**：`MarkdownView` 重写了 `heading_open` 规则，给标题生成 GitHub 风格 `id`，正文里写的 `[目录](#xxx)` 可以直接跳转。
- **Mermaid 图表**：正文里写 `mermaid` 代码块即可，构建期由 [build/mermaid.ts](build/mermaid.ts) 用本机 Chrome 渲染成内联 SVG（明暗主题各渲染一份，按内容哈希缓存在 `node_modules/.cache/mermaid`），页面运行时不会加载 mermaid。本机需有 Chrome，或用 `CHROME_PATH` 指定路径。
- **代码分割**：md 正文与演示组件都随 `DocView` 懒加载，主包保持精简。
- **图片放大**：正文图片是 `v-html` 插入的，挂不上监听器，所以 `MarkdownView` 在容器上做事件委托，点击 `img` 后交给 `ImagePreview` 全屏预览；预览挂到 `body` 上，避免被 `main.content` 的 `overflow` 裁剪或页头层叠遮挡。
- **代码块换行**：全局 `style.css` 给 `code` 设了 `display: inline-flex`，会把高亮产生的每个 `<span>` 当成 flex item 横排、丢掉换行，因此 `MarkdownView` 里把 `pre code` 重置为 `display: block`。
- **左侧导航吸附**：`.sidebar-inner` 用 `position: sticky; top: 0`，页头滚出视口后导航停住不再跟随滚动；`.sidebar` 自身保持撑满全高，保证右侧分隔竖线完整。
- **装饰器教程**：`tsconfig.app.json` 开启了 `experimentalDecorators`。
- **TS 6.0 注意点**：不再允许对普通函数声明使用 `new`（TS7009），示例里改用 `class` 或 `Object.create(X.prototype)`。
