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
│   ├── es6/                 # ES6 32 题
│   ├── js-principles/       # JS 原理
│   ├── javascript/          # JavaScript 323 题
│   ├── performance/         # 性能优化 25 题
│   ├── security/            # 前端安全 21 题
│   ├── algorithms/          # 算法 19 题
│   ├── programming/         # 编程题 50 题
│   ├── network/             # 计算机网络 71 题
│   ├── typescript/          # TypeScript 46 题
│   ├── engineering/         # 前端工程化 34 题
│   ├── nodejs/              # Node.js 27 题
│   ├── mini-program/        # 小程序 9 题
│   ├── css/                 # CSS 61 题
│   ├── html/                # HTML 57 题
│   ├── react/               # React 83 题
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

| 分类              | 教程                                                                                             | 路由                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| JavaScript 323 题 | 00｜总览与索引                                                                                   | `/doc/js-overview`                            |
| JavaScript 323 题 | 01｜类型判断与类型转换（题 1、14、31~34、80、95~98）                                             | `/doc/js-types-coercion`                      |
| JavaScript 323 题 | 02｜作用域 · 闭包 · this · 执行上下文（题 2、3、4、35、77、79、83~85、99）                       | `/doc/js-scope-closure-this`                  |
| JavaScript 323 题 | 03｜原型链与继承（题 5、13、15、78）                                                             | `/doc/js-prototype-inheritance`               |
| JavaScript 323 题 | 04｜事件循环（题 6、76、81、82）                                                                 | `/doc/js-event-loop`                          |
| JavaScript 323 题 | 05｜Promise 与 async/await（题 7、8、17、47、52）                                                | `/doc/js-promise-async`                       |
| JavaScript 323 题 | 06｜ES6+ 语法特性（题 10、16、36~42、53、100）                                                   | `/doc/js-es6-syntax`                          |
| JavaScript 323 题 | 07｜集合与元编程（题 43~46、48~52）                                                              | `/doc/js-collections-metaprogramming`         |
| JavaScript 323 题 | 08｜内存管理与垃圾回收（题 19、20、86、87）                                                      | `/doc/js-memory-gc`                           |
| JavaScript 323 题 | 09｜DOM 事件与浏览器边界（题 21~30、88~94）                                                      | `/doc/js-dom-events-browser`                  |
| JavaScript 323 题 | 10｜手写实现（上）· 函数与工具（题 11、12、57~63、71、73~75）                                    | `/doc/js-handwritten-functions`               |
| JavaScript 323 题 | 11｜手写实现（下）· 异步与数据处理（题 9、54~56、64~70、72）                                     | `/doc/js-handwritten-async-data`              |
| JS 原理           | 01｜事件传播与停止                                                                               | `/doc/event-propagation`                      |
| JS 原理           | 02｜手写 call / bind                                                                             | `/doc/call-bind`                              |
| JS 原理           | 03｜原型与原型链                                                                                 | `/doc/prototype-chain`                        |
| CSS 61 题         | 00｜总览与索引                                                                                   | `/doc/css-overview`                           |
| CSS 61 题         | 01｜基础与盒模型                                                                                 | `/doc/css-basics-box-model`                   |
| CSS 61 题         | 02｜选择器与层叠                                                                                 | `/doc/css-selectors-cascade`                  |
| CSS 61 题         | 03｜布局与定位                                                                                   | `/doc/css-layout-position`                    |
| CSS 61 题         | 04｜居中与常见图形效果                                                                           | `/doc/css-centering-shapes`                   |
| CSS 61 题         | 05｜响应式与移动端适配                                                                           | `/doc/css-responsive-mobile`                  |
| CSS 61 题         | 06｜动画与渲染性能                                                                               | `/doc/css-animation-rendering`                |
| CSS 61 题         | 07｜工程化与样式加载                                                                             | `/doc/css-engineering-loading`                |
| HTML 57 题        | 00｜总览与索引                                                                                   | `/doc/html-overview`                          |
| HTML 57 题        | 01｜基础概念与文档结构                                                                           | `/doc/html-basics-document-structure`         |
| HTML 57 题        | 02｜语义化、元素分类与 SEO                                                                       | `/doc/html-semantics-elements-seo`            |
| HTML 57 题        | 03｜表单、无障碍与自定义属性                                                                     | `/doc/html-forms-a11y-data-attributes`        |
| HTML 57 题        | 04｜文档头部与资源引用                                                                           | `/doc/html-head-resources`                    |
| HTML 57 题        | 05｜脚本加载与渲染链路                                                                           | `/doc/html-script-loading-rendering`          |
| HTML 57 题        | 06｜存储、缓存与离线                                                                             | `/doc/html-storage-cache-offline`             |
| HTML 57 题        | 07｜HTML5 新特性全景                                                                             | `/doc/html5-features-overview`                |
| HTML 57 题        | 08｜题单里的非 HTML 题                                                                           | `/doc/html-non-html-questions`                |
| Vue               | 01｜Props / 插槽 / $attrs                                                                        | `/doc/props-slots`                            |
| Vue               | 02｜Proxy 与响应式                                                                               | `/doc/proxy-reactive`                         |
| Vue               | 03｜响应式原理：effect                                                                           | `/doc/reactive-effect`                        |
| Vue               | 04｜Diff 算法原理                                                                                | `/doc/diff-algorithm`                         |
| Vue               | 05｜Pinia 与 Vuex                                                                                | `/doc/pinia-vuex`                             |
| Vue               | 06｜keep-alive 缓存机制                                                                          | `/doc/keep-alive`                             |
| Vue               | 07｜插槽机制                                                                                     | `/doc/slots`                                  |
| Vue               | 08｜自定义指令                                                                                   | `/doc/custom-directive`                       |
| Vue               | 09｜路由模式                                                                                     | `/doc/router-mode`                            |
| Vue               | 10｜路由守卫                                                                                     | `/doc/router-guard`                           |
| Vue               | 11｜Vue 3 高频面试题                                                                             | `/doc/vue3-interview`                         |
| React 83 题       | 00｜总览与索引                                                                                   | `/doc/react-overview`                         |
| React 83 题       | 01｜设计思想与虚拟 DOM                                                                           | `/doc/react-design-virtual-dom`               |
| React 83 题       | 02｜渲染机制：Fiber 与 Diff                                                                      | `/doc/react-rendering-fiber-diff`             |
| React 83 题       | 03｜生命周期与 useEffect                                                                         | `/doc/react-lifecycle-useeffect`              |
| React 83 题       | 04｜Hooks 原理与规范                                                                             | `/doc/react-hooks-principles`                 |
| React 83 题       | 05｜状态管理与数据流                                                                             | `/doc/react-state-management-data-flow`       |
| React 83 题       | 06｜事件、表单与组件通信                                                                         | `/doc/react-events-forms-communication`       |
| React 83 题       | 07｜性能优化                                                                                     | `/doc/react-performance`                      |
| React 83 题       | 08｜路由与代码分割                                                                               | `/doc/react-router-code-splitting`            |
| React 83 题       | 09｜生态与工程化                                                                                 | `/doc/react-ecosystem-engineering`            |
| ES6 32 题         | 00｜总览与索引                                                                                   | `/doc/es6-overview`                           |
| ES6 32 题         | 01｜变量、作用域、闭包与 this                                                                    | `/doc/es6-variables-scope-closure-this`       |
| ES6 32 题         | 02｜对象、原型与继承                                                                             | `/doc/es6-object-prototype-inheritance`       |
| ES6 32 题         | 03｜响应式原理：Proxy 与 Object.defineProperty                                                   | `/doc/es6-reactivity-proxy`                   |
| ES6 32 题         | 04｜异步：Promise、async/await 与事件循环                                                        | `/doc/es6-async-event-loop`                   |
| ES6 32 题         | 05｜模块与工程化：ESM vs CommonJS、HMR                                                           | `/doc/es6-module-engineering`                 |
| ES6 32 题         | 06｜集合、迭代与数组扩展                                                                         | `/doc/es6-collections-iteration`              |
| ES6 32 题         | 07｜类型转换与隐式规则                                                                           | `/doc/es6-type-coercion`                      |
| TypeScript 46 题  | 00｜总览与索引                                                                                   | `/doc/typescript-overview`                    |
| TypeScript 46 题  | 01｜语言全景与工程价值（题 2、27、34、46）                                                       | `/doc/typescript-language-overview`           |
| TypeScript 46 题  | 02｜类型系统基础：原始类型 · 联合 · 断言（题 20、30、17、4、39、31、44）                         | `/doc/typescript-basic-types-assertion`       |
| TypeScript 46 题  | 03｜any / unknown / never / void 与类型收窄（题 21、22、36、7、19、23）                          | `/doc/typescript-any-unknown-never-narrowing` |
| TypeScript 46 题  | 04｜interface 与 type（题 37、35）                                                               | `/doc/typescript-interface-vs-type`           |
| TypeScript 46 题  | 05｜泛型与方法重载（题 3、5）                                                                    | `/doc/typescript-generics-overload`           |
| TypeScript 46 题  | 06｜类与面向对象（题 8、38、40、32、28、41）                                                     | `/doc/typescript-class-oop`                   |
| TypeScript 46 题  | 07｜装饰器与 mixin（题 42、43）                                                                  | `/doc/typescript-decorator-mixin`             |
| TypeScript 46 题  | 08｜枚举 · declare · namespace 与 module（题 26、25、33、1、45）                                 | `/doc/typescript-enum-declare-module`         |
| TypeScript 46 题  | 09｜工程化：tsconfig 与 sourcemap（题 24、29）                                                   | `/doc/typescript-tsconfig-sourcemap`          |
| TypeScript 46 题  | 10｜手写实现题 10 道（题 6、9、10、11、12、13、14、15、16、18）                                  | `/doc/typescript-handwritten`                 |
| 小程序 9 题       | 00｜总览与索引                                                                                   | `/doc/mini-program-overview`                  |
| 小程序 9 题       | 01｜架构与双线程模型                                                                             | `/doc/mini-program-architecture`              |
| 小程序 9 题       | 02｜工程结构与 WXSS 样式体系                                                                     | `/doc/mini-program-structure-wxss`            |
| 小程序 9 题       | 03｜事件系统与页面间通信                                                                         | `/doc/mini-program-events-communication`      |
| 小程序 9 题       | 04｜优劣势与选型对比                                                                             | `/doc/mini-program-pros-cons`                 |
| Node.js 27 题     | 00｜总览与索引                                                                                   | `/doc/node-overview`                          |
| Node.js 27 题     | 01｜运行时全景与全局对象                                                                         | `/doc/node-runtime-globals`                   |
| Node.js 27 题     | 02｜事件循环与 EventEmitter                                                                      | `/doc/node-event-loop-eventemitter`           |
| Node.js 27 题     | 03｜模块系统：CommonJS 与 ES Module                                                              | `/doc/node-modules-cjs-esm`                   |
| Node.js 27 题     | 04｜Stream、Buffer 与 fs                                                                         | `/doc/node-stream-buffer-fs`                  |
| Node.js 27 题     | 05｜Express 与 Koa 中间件                                                                        | `/doc/node-express-koa-middleware`            |
| Node.js 27 题     | 06｜服务端实战：JWT、文件上传、分页                                                              | `/doc/node-server-jwt-upload-pagination`      |
| Node.js 27 题     | 07｜多进程、进程通信与 pm2                                                                       | `/doc/node-multiprocess-pm2`                  |
| Node.js 27 题     | 08｜性能监控与调试                                                                               | `/doc/node-performance-debugging`             |
| Node.js 27 题     | 09｜npm 与包管理                                                                                 | `/doc/node-npm-package-management`            |
| 计算机网络 71 题  | 00｜总览与索引                                                                                   | `/doc/network-overview`                       |
| 计算机网络 71 题  | 01｜分层模型与数据封装（题 45）                                                                  | `/doc/network-layering-encapsulation`         |
| 计算机网络 71 题  | 02｜从输入 URL 到页面展示（题 2、6、22、29、41、63、71 + DNS 题 64）                             | `/doc/network-url-to-page`                    |
| 计算机网络 71 题  | 03｜TCP 连接管理：三次握手与四次挥手（题 3、4、28、32、37、56）                                  | `/doc/network-tcp-handshake`                  |
| 计算机网络 71 题  | 04｜TCP 可靠传输 · 流量控制 · 拥塞控制（题 61）                                                  | `/doc/network-tcp-reliability`                |
| 计算机网络 71 题  | 05｜TCP 与 UDP（题 5、42、53、67）                                                               | `/doc/network-tcp-udp`                        |
| 计算机网络 71 题  | 06｜HTTP 报文 · 方法 · 状态码 · 头部（题 7、11、12、15、16、18、19、21、31、36、46、49、51、70） | `/doc/network-http-message`                   |
| 计算机网络 71 题  | 07｜HTTP 版本演进：HTTP/1.0 → 1.1 → 2 → 3（题 1、14、57）                                        | `/doc/network-http-versions`                  |
| 计算机网络 71 题  | 08｜HTTP 缓存（题 8、10、20、23、35、38、40、43、58、60、62、65、69）                            | `/doc/network-http-cache`                     |
| 计算机网络 71 题  | 09｜HTTPS 与 TLS（题 13、17、30、34、39、47、48、59、66）                                        | `/doc/network-https-tls`                      |
| 计算机网络 71 题  | 10｜跨域与 CORS（题 9、24、25、26、27、44、50、52、54、55、68）                                  | `/doc/network-cors`                           |
| 计算机网络 71 题  | 11｜WebSocket 与实时通信（题 33、70）                                                            | `/doc/network-websocket`                      |
| 前端工程化 34 题  | 00｜总览与索引                                                                                   | `/doc/engineering-overview`                   |
| 前端工程化 34 题  | 01｜工程化全景与脚手架                                                                           | `/doc/engineering-panorama-scaffold`          |
| 前端工程化 34 题  | 02｜Webpack 原理与插件开发                                                                       | `/doc/engineering-webpack`                    |
| 前端工程化 34 题  | 03｜Vite 与新一代构建工具                                                                        | `/doc/engineering-vite`                       |
| 前端工程化 34 题  | 04｜Babel 与 AST                                                                                 | `/doc/engineering-babel-ast`                  |
| 前端工程化 34 题  | 05｜产物优化与 Tree Shaking                                                                      | `/doc/engineering-tree-shaking`               |
| 前端工程化 34 题  | 06｜规范与质量保障                                                                               | `/doc/engineering-lint-quality`               |
| 前端工程化 34 题  | 07｜CI/CD、Docker 与部署                                                                         | `/doc/engineering-cicd-deploy`                |
| 前端工程化 34 题  | 08｜Git 工作流                                                                                   | `/doc/engineering-git-workflow`               |
| 性能优化 25 题    | 00｜总览与索引                                                                                   | `/doc/perf-overview`                          |
| 性能优化 25 题    | 01｜指标体系与监控                                                                               | `/doc/perf-metrics-monitoring`                |
| 性能优化 25 题    | 02｜加载与网络：缓存 / CDN / HTTP2 / 资源优先级                                                  | `/doc/perf-loading-network`                   |
| 性能优化 25 题    | 03｜首屏优化：从 SSR 到关键路径                                                                  | `/doc/perf-first-screen`                      |
| 性能优化 25 题    | 04｜渲染优化：渲染流水线与重排重绘                                                               | `/doc/perf-rendering`                         |
| 性能优化 25 题    | 05｜图片与资源优化：懒加载                                                                       | `/doc/perf-images-lazy-load`                  |
| 性能优化 25 题    | 06｜JS 引擎与内存：V8 优化与内存泄漏                                                             | `/doc/perf-js-engine-memory`                  |
| 性能优化 25 题    | 07｜Webpack：打包原理 / 构建优化 / HMR                                                           | `/doc/perf-webpack`                           |
| 设计模式          | 01｜装饰器与 @ 语法糖                                                                            | `/doc/decorator`                              |
| 设计模式          | 02｜适配器模式                                                                                   | `/doc/adapter`                                |
| 设计模式          | 03｜策略模式                                                                                     | `/doc/strategy`                               |
| 设计模式          | 04｜单例模式                                                                                     | `/doc/singleton`                              |
| 前端安全 21 题    | 00｜总览与索引                                                                                   | `/doc/security-overview`                      |
| 前端安全 21 题    | 01｜XSS 跨站脚本攻击                                                                             | `/doc/security-xss`                           |
| 前端安全 21 题    | 02｜CSRF 与 Cookie 安全                                                                          | `/doc/security-csrf-cookie`                   |
| 前端安全 21 题    | 03｜CSP 与安全响应头                                                                             | `/doc/security-csp-headers`                   |
| 前端安全 21 题    | 04｜点击劫持与 iframe 安全                                                                       | `/doc/security-clickjacking-iframe`           |
| 前端安全 21 题    | 05｜传输层：HTTPS、中间人、网络劫持与 SRI                                                        | `/doc/security-transport-https`               |
| 前端安全 21 题    | 06｜鉴权体系与数据安全                                                                           | `/doc/security-auth-data`                     |
| 前端安全 21 题    | 07｜跨域与 WebSocket 安全                                                                        | `/doc/security-cors-websocket`                |
| 前端安全 21 题    | 08｜工程化落地：SQL 注入、供应链与检查清单                                                       | `/doc/security-supply-chain`                  |
| 算法 19 题        | 00｜总览与索引                                                                                   | `/doc/algo-overview`                          |
| 算法 19 题        | 01｜复杂度分析与递归（尾调用）                                                                   | `/doc/algo-complexity-recursion`              |
| 算法 19 题        | 02｜基础排序：冒泡 / 选择 / 插入 / 希尔                                                          | `/doc/algo-basic-sorts`                       |
| 算法 19 题        | 03｜进阶排序：归并 / 快排 / 堆排                                                                 | `/doc/algo-advanced-sorts`                    |
| 算法 19 题        | 04｜线性排序：计数 / 桶 / 基数                                                                   | `/doc/algo-linear-sorts`                      |
| 算法 19 题        | 05｜链表与堆：合并 K 个升序链表                                                                  | `/doc/algo-linked-list-heap`                  |
| 算法 19 题        | 06｜哈希与缓存：LRU                                                                              | `/doc/algo-hash-lru`                          |
| 算法 19 题        | 07｜字符串与双指针                                                                               | `/doc/algo-string-two-pointers`               |
| 算法 19 题        | 08｜概率与随机：洗牌与最优停止                                                                   | `/doc/algo-probability-random`                |
| 编程题 50 题      | 00｜总览与索引                                                                                   | `/doc/programming-overview`                   |
| 编程题 50 题      | 01｜闭包与高阶函数                                                                               | `/doc/programming-closure-hof`                |
| 编程题 50 题      | 02｜this 绑定与原型链                                                                            | `/doc/programming-this-prototype`             |
| 编程题 50 题      | 03｜Promise 核心实现                                                                             | `/doc/programming-promise`                    |
| 编程题 50 题      | 04｜并发控制与异步调度                                                                           | `/doc/programming-concurrency`                |
| 编程题 50 题      | 05｜数组、字符串与排序                                                                           | `/doc/programming-array-string-sort`          |
| 编程题 50 题      | 06｜深拷贝与对象处理                                                                             | `/doc/programming-deep-clone`                 |
| 编程题 50 题      | 07｜数据结构与 DOM                                                                               | `/doc/programming-data-structure-dom`         |

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
