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
 * 新增教程：
 *   1. 在 src/docs/<dir>/ 下新增 <id>.md（dir 取目标分类的 dir）
 *   2. 需要演示则在 src/components/demos/ 下新增 <Demo>.vue
 *   3. 在下面 categories 的对应分类里补一条记录
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
    dir: 'design-patterns',
    title: '设计模式',
    items: [
      { id: 'decorator', title: '装饰器 + @语法糖', demo: 'DecoratorDemo' },
      { id: 'adapter', title: '适配器模式', demo: 'AdapterDemo' },
      { id: 'strategy', title: '策略模式', demo: 'StrategyDemo' },
      { id: 'singleton', title: '单例模式', demo: 'SingletonDemo' },
    ],
  },
  {
    dir: 'vue',
    title: 'Vue',
    items: [
      { id: 'props-slots', title: 'Props / 插槽 / $attrs', demo: 'PropsDemo' },
      { id: 'proxy-reactive', title: 'Proxy 与响应式', demo: 'ProxyReactiveDemo' },
      { id: 'reactive-effect', title: '响应式原理 effect', demo: 'ReactiveEffectDemo' },
      { id: 'diff-algorithm', title: 'Vue3 Diff算法原理（面试版）' },
      { id: 'pinia-vuex', title: 'Pinia 与 Vuex 完全指南' },
      { id: 'keep-alive', title: 'Vue 中 keep-alive 详解与面试回答模板' },
      { id: 'slots', title: 'Vue 插槽 slot 详解与面试回答' },
      {
        id: 'custom-directive',
        title: 'Vue 自定义指令详解与面试回答',
        demo: 'CustomDirectiveDemo',
      },
      { id: 'router-mode', title: 'Vue 路由模式详解与面试回答' },
      { id: 'router-guard', title: 'Vue 路由守卫详解与面试回答' },
      { id: 'vue3-interview', title: 'Vue 3 高频面试题详解与答题模板' },
    ],
  },
  {
    dir: 'es6',
    title: 'ES6 三十二题',
    items: [
      { id: 'es6-overview', title: 'ES6 三十二题 · 分册索引与「新特性」总览' },
      { id: 'es6-variables-scope-closure-this', title: '分册 01 · 变量、作用域、闭包与 this' },
      { id: 'es6-object-prototype-inheritance', title: '分册 02 · 对象、原型与继承' },
      { id: 'es6-reactivity-proxy', title: '分册 03 · 响应式原理：Proxy 与 Object.defineProperty' },
      { id: 'es6-async-event-loop', title: '分册 04 · 异步：Promise、async/await 与事件循环' },
      { id: 'es6-module-engineering', title: '分册 05 · 模块与工程化：ESM vs CommonJS、HMR' },
      { id: 'es6-collections-iteration', title: '分册 06 · 集合、迭代与数组扩展' },
      { id: 'es6-type-coercion', title: '分册 07 · 类型转换与隐式规则' },
    ],
  },
  {
    dir: 'js-principles',
    title: 'JS 原理',
    items: [
      { id: 'event-propagation', title: '事件传播与停止', demo: 'EventPropagationDemo' },
      { id: 'call-bind', title: '手写 call / bind', demo: 'CallBindDemo' },
      { id: 'prototype-chain', title: '原型与原型链', demo: 'PrototypeChainDemo' },
    ],
  },
  {
    dir: 'javascript',
    title: 'JavaScript 323 题',
    items: [
      { id: 'js-overview', title: 'JavaScript 323 题 · 总览与索引' },
      {
        id: 'js-types-coercion',
        title: 'JS · 01 类型判断与类型转换（题 1、14、31~34、80、95~98）',
      },
      {
        id: 'js-scope-closure-this',
        title: 'JS · 02 作用域 · 闭包 · this · 执行上下文（题 2、3、4、35、77、79、83~85、99）',
      },
      { id: 'js-prototype-inheritance', title: 'JS · 03 原型链与继承（题 5、13、15、78）' },
      { id: 'js-event-loop', title: 'JS · 04 事件循环（题 6、76、81、82）' },
      { id: 'js-promise-async', title: 'JS · 05 Promise 与 async/await（题 7、8、17、47、52）' },
      { id: 'js-es6-syntax', title: 'JS · 06 ES6+ 语法特性（题 10、16、36~42、53、100）' },
      {
        id: 'js-collections-metaprogramming',
        title: 'JS · 07 集合与元编程（题 43~46、48~52）',
      },
      { id: 'js-memory-gc', title: 'JS · 08 内存管理与垃圾回收（题 19、20、86、87）' },
      {
        id: 'js-dom-events-browser',
        title: 'JS · 09 DOM 事件与浏览器边界（题 21~30、88~94）',
      },
      {
        id: 'js-handwritten-functions',
        title: 'JS · 10 手写实现（上）· 函数与工具（题 11、12、57~63、71、73~75）',
      },
      {
        id: 'js-handwritten-async-data',
        title: 'JS · 11 手写实现（下）· 异步与数据处理（题 9、54~56、64~70、72）',
      },
    ],
  },
  {
    dir: 'performance',
    title: '性能优化 25 题',
    items: [
      { id: 'perf-overview', title: '性能优化 25 题 · 总览与索引' },
      { id: 'perf-metrics-monitoring', title: '性能 · 01 指标体系与监控' },
      {
        id: 'perf-loading-network',
        title: '性能 · 02 加载与网络：缓存 / CDN / HTTP2 / 资源优先级',
      },
      { id: 'perf-first-screen', title: '性能 · 03 首屏优化：从 SSR 到关键路径' },
      { id: 'perf-rendering', title: '性能 · 04 渲染优化：渲染流水线与重排重绘' },
      { id: 'perf-images-lazy-load', title: '性能 · 05 图片与资源优化：懒加载' },
      { id: 'perf-js-engine-memory', title: '性能 · 06 JS 引擎与内存：V8 优化与内存泄漏' },
      { id: 'perf-webpack', title: '性能 · 07 Webpack：打包原理 / 构建优化 / HMR' },
    ],
  },
  {
    dir: 'security',
    title: '前端安全 21 题',
    items: [
      { id: 'security-overview', title: '前端安全 21 题 · 总览与索引' },
      { id: 'security-xss', title: '安全 · 01 XSS 跨站脚本攻击' },
      { id: 'security-csrf-cookie', title: '安全 · 02 CSRF 与 Cookie 安全' },
      { id: 'security-csp-headers', title: '安全 · 03 CSP 与安全响应头' },
      { id: 'security-clickjacking-iframe', title: '安全 · 04 点击劫持与 iframe 安全' },
      {
        id: 'security-transport-https',
        title: '安全 · 05 传输层：HTTPS、中间人、网络劫持与 SRI',
      },
      { id: 'security-auth-data', title: '安全 · 06 鉴权体系与数据安全' },
      { id: 'security-cors-websocket', title: '安全 · 07 跨域与 WebSocket 安全' },
      {
        id: 'security-supply-chain',
        title: '安全 · 08 工程化落地：SQL 注入、供应链与检查清单',
      },
    ],
  },
  {
    dir: 'algorithms',
    title: '算法 19 题',
    items: [
      { id: 'algo-overview', title: '算法 19 题 · 总览与索引' },
      { id: 'algo-complexity-recursion', title: '算法 · 01 复杂度分析与递归（尾调用）' },
      { id: 'algo-basic-sorts', title: '算法 · 02 基础排序：冒泡 / 选择 / 插入 / 希尔' },
      { id: 'algo-advanced-sorts', title: '算法 · 03 进阶排序：归并 / 快排 / 堆排' },
      { id: 'algo-linear-sorts', title: '算法 · 04 线性排序：计数 / 桶 / 基数' },
      { id: 'algo-linked-list-heap', title: '算法 · 05 链表与堆：合并 K 个升序链表' },
      { id: 'algo-hash-lru', title: '算法 · 06 哈希与缓存：LRU' },
      { id: 'algo-string-two-pointers', title: '算法 · 07 字符串与双指针' },
      { id: 'algo-probability-random', title: '算法 · 08 概率与随机：洗牌与最优停止' },
    ],
  },
  {
    dir: 'programming',
    title: '编程题 50 题',
    items: [
      { id: 'programming-overview', title: '编程题 50 题 · 总览与索引' },
      { id: 'programming-closure-hof', title: '编程 01｜闭包与高阶函数' },
      { id: 'programming-this-prototype', title: '编程 02｜this 绑定与原型链' },
      { id: 'programming-promise', title: '编程 03｜Promise 核心实现' },
      { id: 'programming-concurrency', title: '编程 04｜并发控制与异步调度' },
      { id: 'programming-array-string-sort', title: '编程 05｜数组、字符串与排序' },
      { id: 'programming-deep-clone', title: '编程 06｜深拷贝与对象处理' },
      { id: 'programming-data-structure-dom', title: '编程 07｜数据结构与 DOM' },
    ],
  },
  {
    dir: 'network',
    title: '计算机网络 71 题',
    items: [
      { id: 'network-overview', title: '计算机网络 71 题 · 总览与索引' },
      {
        id: 'network-layering-encapsulation',
        title: '网络 · 01 分层模型与数据封装（题 45）',
      },
      {
        id: 'network-url-to-page',
        title: '网络 · 02 从输入 URL 到页面展示（题 2、6、22、29、41、63、71 + DNS 题 64）',
      },
      {
        id: 'network-tcp-handshake',
        title: '网络 · 03 TCP 连接管理：三次握手与四次挥手（题 3、4、28、32、37、56）',
      },
      {
        id: 'network-tcp-reliability',
        title: '网络 · 04 TCP 可靠传输 · 流量控制 · 拥塞控制（题 61）',
      },
      { id: 'network-tcp-udp', title: '网络 · 05 TCP 与 UDP（题 5、42、53、67）' },
      {
        id: 'network-http-message',
        title:
          '网络 · 06 HTTP 报文 · 方法 · 状态码 · 头部（题 7、11、12、15、16、18、19、21、31、36、46、49、51、70）',
      },
      {
        id: 'network-http-versions',
        title: '网络 · 07 HTTP 版本演进：HTTP/1.0 → 1.1 → 2 → 3（题 1、14、57）',
      },
      {
        id: 'network-http-cache',
        title: '网络 · 08 HTTP 缓存（题 8、10、20、23、35、38、40、43、58、60、62、65、69）',
      },
      {
        id: 'network-https-tls',
        title: '网络 · 09 HTTPS 与 TLS（题 13、17、30、34、39、47、48、59、66）',
      },
      {
        id: 'network-cors',
        title: '网络 · 10 跨域与 CORS（题 9、24、25、26、27、44、50、52、54、55、68）',
      },
      { id: 'network-websocket', title: '网络 · 11 WebSocket 与实时通信（题 33、70）' },
    ],
  },
  {
    dir: 'typescript',
    title: 'TypeScript 46 题',
    items: [
      { id: 'typescript-overview', title: 'TypeScript 46 题 · 总览与索引' },
      {
        id: 'typescript-language-overview',
        title: 'TS · 01 语言全景与工程价值（题 2、27、34、46）',
      },
      {
        id: 'typescript-basic-types-assertion',
        title: 'TS · 02 类型系统基础：原始类型 · 联合 · 断言（题 20、30、17、4、39、31、44）',
      },
      {
        id: 'typescript-any-unknown-never-narrowing',
        title: 'TS · 03 any / unknown / never / void 与类型收窄（题 21、22、36、7、19、23）',
      },
      { id: 'typescript-interface-vs-type', title: 'TS · 04 interface 与 type（题 37、35）' },
      { id: 'typescript-generics-overload', title: 'TS · 05 泛型与方法重载（题 3、5）' },
      {
        id: 'typescript-class-oop',
        title: 'TS · 06 类与面向对象（题 8、38、40、32、28、41）',
      },
      { id: 'typescript-decorator-mixin', title: 'TS · 07 装饰器与 mixin（题 42、43）' },
      {
        id: 'typescript-enum-declare-module',
        title: 'TS · 08 枚举 · declare · namespace 与 module（题 26、25、33、1、45）',
      },
      {
        id: 'typescript-tsconfig-sourcemap',
        title: 'TS · 09 工程化：tsconfig 与 sourcemap（题 24、29）',
      },
      {
        id: 'typescript-handwritten',
        title: 'TS · 10 手写实现题 10 道（题 6、9、10、11、12、13、14、15、16、18）',
      },
    ],
  },
  {
    dir: 'engineering',
    title: '前端工程化 34 题',
    items: [
      { id: 'engineering-overview', title: '前端工程化 34 题｜总览与索引' },
      { id: 'engineering-panorama-scaffold', title: '工程化 01｜工程化全景与脚手架' },
      { id: 'engineering-webpack', title: '工程化 02｜Webpack 原理与插件开发' },
      { id: 'engineering-vite', title: '工程化 03｜Vite 与新一代构建工具' },
      { id: 'engineering-babel-ast', title: '工程化 04｜Babel 与 AST' },
      { id: 'engineering-tree-shaking', title: '工程化 05｜产物优化与 Tree Shaking' },
      { id: 'engineering-lint-quality', title: '工程化 06｜规范与质量保障' },
      { id: 'engineering-cicd-deploy', title: '工程化 07｜CI/CD、Docker 与部署' },
      { id: 'engineering-git-workflow', title: '工程化 08｜Git 工作流' },
    ],
  },
  {
    dir: 'nodejs',
    title: 'Node.js 27 题',
    items: [
      { id: 'node-overview', title: 'Node.js 27 题｜总览与索引' },
      { id: 'node-runtime-globals', title: 'Node 01｜运行时全景与全局对象' },
      { id: 'node-event-loop-eventemitter', title: 'Node 02｜事件循环与 EventEmitter' },
      { id: 'node-modules-cjs-esm', title: 'Node 03｜模块系统：CommonJS 与 ES Module' },
      { id: 'node-stream-buffer-fs', title: 'Node 04｜Stream、Buffer 与 fs' },
      { id: 'node-express-koa-middleware', title: 'Node 05｜Express 与 Koa 中间件' },
      {
        id: 'node-server-jwt-upload-pagination',
        title: 'Node 06｜服务端实战：JWT、文件上传、分页',
      },
      { id: 'node-multiprocess-pm2', title: 'Node 07｜多进程、进程通信与 pm2' },
      { id: 'node-performance-debugging', title: 'Node 08｜性能监控与调试' },
      { id: 'node-npm-package-management', title: 'Node 09｜npm 与包管理' },
    ],
  },
  {
    dir: 'mini-program',
    title: '小程序 9 题',
    items: [
      { id: 'mini-program-overview', title: '小程序面试题 · 总览与索引' },
      { id: 'mini-program-architecture', title: '小程序 · 01 架构与双线程模型' },
      { id: 'mini-program-structure-wxss', title: '小程序 · 02 工程结构与 WXSS 样式体系' },
      { id: 'mini-program-events-communication', title: '小程序 · 03 事件系统与页面间通信' },
      { id: 'mini-program-pros-cons', title: '小程序 · 04 优劣势与选型对比' },
    ],
  },
  {
    dir: 'css',
    title: 'CSS 61 题精讲',
    items: [
      { id: 'css-overview', title: 'CSS 61 题精讲 · 索引与去重映射' },
      { id: 'css-basics-box-model', title: 'CSS · 01 基础与盒模型' },
      { id: 'css-selectors-cascade', title: 'CSS · 02 选择器与层叠' },
      { id: 'css-layout-position', title: 'CSS · 03 布局与定位' },
      { id: 'css-centering-shapes', title: 'CSS · 04 居中与常见图形效果' },
      { id: 'css-responsive-mobile', title: 'CSS · 05 响应式与移动端适配' },
      { id: 'css-animation-rendering', title: 'CSS · 06 动画与渲染性能' },
      { id: 'css-engineering-loading', title: 'CSS · 07 工程化与样式加载' },
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
