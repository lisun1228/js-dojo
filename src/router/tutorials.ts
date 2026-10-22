/**
 * 教程目录 —— 唯一数据源。
 *
 * 分类、教程清单、演示组件都在这里维护：
 *   - src/router/index.ts 向外统一导出，供侧边栏使用
 *   - src/docs/index.ts   据此加载对应 md 正文与演示组件
 *   - 路由本身由 /doc/:id 统一承载，无需逐个登记
 *
 * 分类目录映射：src/docs/<dir>/<id>.md
 *   - dir   分类子目录名（英文 kebab-case），同时决定文档位置
 *   - title 分类中文名，作为侧边栏分组标题
 *
 * 分类顺序即侧边栏顺序，按「语言基础 → 框架 → 工程化 → 专题」排列。
 *
 * 标题规范（分类名已提供上下文，条目标题不再重复分类前缀）：
 *   - 总览项：00｜总览与索引
 *   - 章节项：两位序号｜主题，序号在分类内从 01 递增
 *   - 去掉“详解与面试回答”等冗余后缀，只保留主题
 *
 * 新增教程：
 *   1. 在 src/docs/<dir>/ 下新增 <id>.md（dir 取目标分类的 dir）
 *   2. 需要演示则在 src/components/demos/ 下新增 <Demo>.vue
 *   3. 在下面 categories 的对应分类里补一条记录，并按标题规范编号
 * 分类（目录、标题、顺序、归属）只在 categories 中定义一次，改分类名也只需改这一处。
 */

export interface Tutorial {
  /** 唯一 id：同时是 md 文件名与路由参数，对应路由 /doc/<id> */
  id: string
  /** 侧边栏与文档标题 */
  title: string
  /** 演示组件文件名（不含 .vue），对应 components/demos/<demo>.vue */
  demo?: string
}

export interface TutorialCategory {
  /** 分类目录名（英文 kebab-case），对应 src/docs/<dir>/ */
  dir: string
  /** 分类中文名，同时作为侧边栏分组标题 */
  title: string
  items: Tutorial[]
}

/** 教程分类：目录、中文名、顺序、每个分类下有哪些教程都在这里定义 */
export const categories: TutorialCategory[] = [
  {
    dir: 'javascript',
    title: 'JavaScript 323 题',
    items: [
      { id: 'js-overview', title: '00｜总览与索引' },
      {
        id: 'js-types-coercion',
        title: '01｜类型判断与类型转换',
      },
      {
        id: 'js-scope-closure-this',
        title: '02｜作用域 · 闭包 · this · 执行上下文',
      },
      { id: 'js-prototype-inheritance', title: '03｜原型链与继承' },
      { id: 'js-event-loop', title: '04｜事件循环' },
      {
        id: 'js-promise-async',
        title: '05｜Promise 与 async/await',
      },
      { id: 'js-es6-syntax', title: '06｜ES6+ 语法特性' },
      {
        id: 'js-collections-metaprogramming',
        title: '07｜集合与元编程',
      },
      { id: 'js-memory-gc', title: '08｜内存管理与垃圾回收' },
      {
        id: 'js-dom-events-browser',
        title: '09｜DOM 事件与浏览器边界',
      },
      {
        id: 'js-handwritten-functions',
        title: '10｜手写实现（上）· 函数与工具',
      },
      {
        id: 'js-handwritten-async-data',
        title: '11｜手写实现（下）· 异步与数据处理',
      },
    ],
  },
  {
    dir: 'js-principles',
    title: 'JS 原理',
    items: [
      { id: 'event-propagation', title: '01｜事件传播与停止', demo: 'EventPropagationDemo' },
      { id: 'call-bind', title: '02｜手写 call / bind', demo: 'CallBindDemo' },
      { id: 'prototype-chain', title: '03｜原型与原型链', demo: 'PrototypeChainDemo' },
    ],
  },
  {
    dir: 'css',
    title: 'CSS 61 题',
    items: [
      { id: 'css-overview', title: '00｜总览与索引' },
      { id: 'css-basics-box-model', title: '01｜基础与盒模型' },
      { id: 'css-selectors-cascade', title: '02｜选择器与层叠' },
      { id: 'css-layout-position', title: '03｜布局与定位' },
      { id: 'css-centering-shapes', title: '04｜居中与常见图形效果' },
      { id: 'css-responsive-mobile', title: '05｜响应式与移动端适配' },
      { id: 'css-animation-rendering', title: '06｜动画与渲染性能' },
      { id: 'css-engineering-loading', title: '07｜工程化与样式加载' },
    ],
  },
  {
    dir: 'html',
    title: 'HTML 57 题',
    items: [
      { id: 'html-overview', title: '00｜总览与索引' },
      { id: 'html-basics-document-structure', title: '01｜基础概念与文档结构' },
      { id: 'html-semantics-elements-seo', title: '02｜语义化、元素分类与 SEO' },
      { id: 'html-forms-a11y-data-attributes', title: '03｜表单、无障碍与自定义属性' },
      { id: 'html-head-resources', title: '04｜文档头部与资源引用' },
      { id: 'html-script-loading-rendering', title: '05｜脚本加载与渲染链路' },
      { id: 'html-storage-cache-offline', title: '06｜存储、缓存与离线' },
      { id: 'html5-features-overview', title: '07｜HTML5 新特性全景' },
      { id: 'html-non-html-questions', title: '08｜题单里的非 HTML 题' },
    ],
  },
  {
    dir: 'vue',
    title: 'Vue',
    items: [
      { id: 'props-slots', title: '01｜Props / 插槽 / $attrs', demo: 'PropsDemo' },
      { id: 'proxy-reactive', title: '02｜Proxy 与响应式', demo: 'ProxyReactiveDemo' },
      { id: 'reactive-effect', title: '03｜响应式原理：effect', demo: 'ReactiveEffectDemo' },
      { id: 'diff-algorithm', title: '04｜Diff 算法原理' },
      { id: 'pinia-vuex', title: '05｜Pinia 与 Vuex' },
      { id: 'keep-alive', title: '06｜keep-alive 缓存机制' },
      { id: 'slots', title: '07｜插槽机制' },
      { id: 'custom-directive', title: '08｜自定义指令', demo: 'CustomDirectiveDemo' },
      { id: 'router-mode', title: '09｜路由模式' },
      { id: 'router-guard', title: '10｜路由守卫' },
      { id: 'vue3-interview', title: '11｜Vue 3 高频面试题' },
    ],
  },
  {
    dir: 'react',
    title: 'React 83 题',
    items: [
      { id: 'react-overview', title: '00｜总览与索引' },
      { id: 'react-design-virtual-dom', title: '01｜设计思想与虚拟 DOM' },
      { id: 'react-rendering-fiber-diff', title: '02｜渲染机制：Fiber 与 Diff' },
      { id: 'react-lifecycle-useeffect', title: '03｜生命周期与 useEffect' },
      { id: 'react-hooks-principles', title: '04｜Hooks 原理与规范' },
      { id: 'react-state-management-data-flow', title: '05｜状态管理与数据流' },
      { id: 'react-events-forms-communication', title: '06｜事件、表单与组件通信' },
      { id: 'react-performance', title: '07｜性能优化' },
      { id: 'react-router-code-splitting', title: '08｜路由与代码分割' },
      { id: 'react-ecosystem-engineering', title: '09｜生态与工程化' },
    ],
  },
  {
    dir: 'es6',
    title: 'ES6 32 题',
    items: [
      { id: 'es6-overview', title: '00｜总览与索引' },
      { id: 'es6-variables-scope-closure-this', title: '01｜变量、作用域、闭包与 this' },
      { id: 'es6-object-prototype-inheritance', title: '02｜对象、原型与继承' },
      {
        id: 'es6-reactivity-proxy',
        title: '03｜响应式原理：Proxy 与 Object.defineProperty',
      },
      {
        id: 'es6-async-event-loop',
        title: '04｜异步：Promise、async/await 与事件循环',
      },
      {
        id: 'es6-module-engineering',
        title: '05｜模块与工程化：ESM vs CommonJS、HMR',
      },
      { id: 'es6-collections-iteration', title: '06｜集合、迭代与数组扩展' },
      { id: 'es6-type-coercion', title: '07｜类型转换与隐式规则' },
    ],
  },
  {
    dir: 'typescript',
    title: 'TypeScript 46 题',
    items: [
      { id: 'typescript-overview', title: '00｜总览与索引' },
      {
        id: 'typescript-language-overview',
        title: '01｜语言全景与工程价值',
      },
      {
        id: 'typescript-basic-types-assertion',
        title: '02｜类型系统基础：原始类型 · 联合 · 断言',
      },
      {
        id: 'typescript-any-unknown-never-narrowing',
        title: '03｜any / unknown / never / void 与类型收窄',
      },
      { id: 'typescript-interface-vs-type', title: '04｜interface 与 type' },
      { id: 'typescript-generics-overload', title: '05｜泛型与方法重载' },
      { id: 'typescript-class-oop', title: '06｜类与面向对象' },
      { id: 'typescript-decorator-mixin', title: '07｜装饰器与 mixin' },
      {
        id: 'typescript-enum-declare-module',
        title: '08｜枚举 · declare · namespace 与 module',
      },
      {
        id: 'typescript-tsconfig-sourcemap',
        title: '09｜工程化：tsconfig 与 sourcemap',
      },
      {
        id: 'typescript-handwritten',
        title: '10｜手写实现题 10 道',
      },
    ],
  },
  {
    dir: 'mini-program',
    title: '小程序 9 题',
    items: [
      { id: 'mini-program-overview', title: '00｜总览与索引' },
      { id: 'mini-program-architecture', title: '01｜架构与双线程模型' },
      { id: 'mini-program-structure-wxss', title: '02｜工程结构与 WXSS 样式体系' },
      { id: 'mini-program-events-communication', title: '03｜事件系统与页面间通信' },
      { id: 'mini-program-pros-cons', title: '04｜优劣势与选型对比' },
    ],
  },
  {
    dir: 'nodejs',
    title: 'Node.js 27 题',
    items: [
      { id: 'node-overview', title: '00｜总览与索引' },
      { id: 'node-runtime-globals', title: '01｜运行时全景与全局对象' },
      { id: 'node-event-loop-eventemitter', title: '02｜事件循环与 EventEmitter' },
      { id: 'node-modules-cjs-esm', title: '03｜模块系统：CommonJS 与 ES Module' },
      { id: 'node-stream-buffer-fs', title: '04｜Stream、Buffer 与 fs' },
      { id: 'node-express-koa-middleware', title: '05｜Express 与 Koa 中间件' },
      {
        id: 'node-server-jwt-upload-pagination',
        title: '06｜服务端实战：JWT、文件上传、分页',
      },
      { id: 'node-multiprocess-pm2', title: '07｜多进程、进程通信与 pm2' },
      { id: 'node-performance-debugging', title: '08｜性能监控与调试' },
      { id: 'node-npm-package-management', title: '09｜npm 与包管理' },
    ],
  },
  {
    dir: 'network',
    title: '计算机网络 71 题',
    items: [
      { id: 'network-overview', title: '00｜总览与索引' },
      { id: 'network-layering-encapsulation', title: '01｜分层模型与数据封装' },
      {
        id: 'network-url-to-page',
        title: '02｜从输入 URL 到页面展示',
      },
      {
        id: 'network-tcp-handshake',
        title: '03｜TCP 连接管理：三次握手与四次挥手',
      },
      {
        id: 'network-tcp-reliability',
        title: '04｜TCP 可靠传输 · 流量控制 · 拥塞控制',
      },
      { id: 'network-tcp-udp', title: '05｜TCP 与 UDP' },
      {
        id: 'network-http-message',
        title: '06｜HTTP 报文 · 方法 · 状态码 · 头部',
      },
      {
        id: 'network-http-versions',
        title: '07｜HTTP 版本演进：HTTP/1.0 → 1.1 → 2 → 3',
      },
      {
        id: 'network-http-cache',
        title: '08｜HTTP 缓存',
      },
      {
        id: 'network-https-tls',
        title: '09｜HTTPS 与 TLS',
      },
      {
        id: 'network-cors',
        title: '10｜跨域与 CORS',
      },
      { id: 'network-websocket', title: '11｜WebSocket 与实时通信' },
    ],
  },
  {
    dir: 'engineering',
    title: '前端工程化 34 题',
    items: [
      { id: 'engineering-overview', title: '00｜总览与索引' },
      { id: 'engineering-panorama-scaffold', title: '01｜工程化全景与脚手架' },
      { id: 'engineering-webpack', title: '02｜Webpack 原理与插件开发' },
      { id: 'engineering-vite', title: '03｜Vite 与新一代构建工具' },
      { id: 'engineering-babel-ast', title: '04｜Babel 与 AST' },
      { id: 'engineering-tree-shaking', title: '05｜产物优化与 Tree Shaking' },
      { id: 'engineering-lint-quality', title: '06｜规范与质量保障' },
      { id: 'engineering-cicd-deploy', title: '07｜CI/CD、Docker 与部署' },
      { id: 'engineering-git-workflow', title: '08｜Git 工作流' },
    ],
  },
  {
    dir: 'performance',
    title: '性能优化 25 题',
    items: [
      { id: 'perf-overview', title: '00｜总览与索引' },
      { id: 'perf-metrics-monitoring', title: '01｜指标体系与监控' },
      { id: 'perf-loading-network', title: '02｜加载与网络：缓存 / CDN / HTTP2 / 资源优先级' },
      { id: 'perf-first-screen', title: '03｜首屏优化：从 SSR 到关键路径' },
      { id: 'perf-rendering', title: '04｜渲染优化：渲染流水线与重排重绘' },
      { id: 'perf-images-lazy-load', title: '05｜图片与资源优化：懒加载' },
      { id: 'perf-js-engine-memory', title: '06｜JS 引擎与内存：V8 优化与内存泄漏' },
      { id: 'perf-webpack', title: '07｜Webpack：打包原理 / 构建优化 / HMR' },
    ],
  },
  {
    dir: 'design-patterns',
    title: '设计模式',
    items: [
      { id: 'decorator', title: '01｜装饰器与 @ 语法糖', demo: 'DecoratorDemo' },
      { id: 'adapter', title: '02｜适配器模式', demo: 'AdapterDemo' },
      { id: 'strategy', title: '03｜策略模式', demo: 'StrategyDemo' },
      { id: 'singleton', title: '04｜单例模式', demo: 'SingletonDemo' },
    ],
  },
  {
    dir: 'security',
    title: '前端安全 21 题',
    items: [
      { id: 'security-overview', title: '00｜总览与索引' },
      { id: 'security-xss', title: '01｜XSS 跨站脚本攻击' },
      { id: 'security-csrf-cookie', title: '02｜CSRF 与 Cookie 安全' },
      { id: 'security-csp-headers', title: '03｜CSP 与安全响应头' },
      { id: 'security-clickjacking-iframe', title: '04｜点击劫持与 iframe 安全' },
      { id: 'security-transport-https', title: '05｜传输层：HTTPS、中间人、网络劫持与 SRI' },
      { id: 'security-auth-data', title: '06｜鉴权体系与数据安全' },
      { id: 'security-cors-websocket', title: '07｜跨域与 WebSocket 安全' },
      { id: 'security-supply-chain', title: '08｜工程化落地：SQL 注入、供应链与检查清单' },
    ],
  },
  {
    dir: 'algorithms',
    title: '算法 19 题',
    items: [
      { id: 'algo-overview', title: '00｜总览与索引' },
      { id: 'algo-complexity-recursion', title: '01｜复杂度分析与递归（尾调用）' },
      { id: 'algo-basic-sorts', title: '02｜基础排序：冒泡 / 选择 / 插入 / 希尔' },
      { id: 'algo-advanced-sorts', title: '03｜进阶排序：归并 / 快排 / 堆排' },
      { id: 'algo-linear-sorts', title: '04｜线性排序：计数 / 桶 / 基数' },
      { id: 'algo-linked-list-heap', title: '05｜链表与堆：合并 K 个升序链表' },
      { id: 'algo-hash-lru', title: '06｜哈希与缓存：LRU' },
      { id: 'algo-string-two-pointers', title: '07｜字符串与双指针' },
      { id: 'algo-probability-random', title: '08｜概率与随机：洗牌与最优停止' },
    ],
  },
  {
    dir: 'programming',
    title: '编程题 50 题',
    items: [
      { id: 'programming-overview', title: '00｜总览与索引' },
      { id: 'programming-closure-hof', title: '01｜闭包与高阶函数' },
      { id: 'programming-this-prototype', title: '02｜this 绑定与原型链' },
      { id: 'programming-promise', title: '03｜Promise 核心实现' },
      { id: 'programming-concurrency', title: '04｜并发控制与异步调度' },
      { id: 'programming-array-string-sort', title: '05｜数组、字符串与排序' },
      { id: 'programming-deep-clone', title: '06｜深拷贝与对象处理' },
      { id: 'programming-data-structure-dom', title: '07｜数据结构与 DOM' },
    ],
  },
]

/** 拍平后的教程清单，带上所属分类目录，供 docs/index.ts 定位 md */
export interface TutorialEntry extends Tutorial {
  /** 所属分类目录，文档位于 src/docs/<dir>/<id>.md */
  dir: string
}

export const tutorials: TutorialEntry[] = categories.flatMap((category) =>
  category.items.map((item) => ({ ...item, dir: category.dir })),
)

/** 教程路由路径 */
export const tutorialPath = (id: string) => `/doc/${id}`

/** 侧边栏菜单分组：分类 → { title, path } */
export const tutorialMenus = categories.map((category) => ({
  title: category.title,
  items: category.items.map((item) => ({
    title: item.title,
    path: tutorialPath(item.id),
  })),
}))
