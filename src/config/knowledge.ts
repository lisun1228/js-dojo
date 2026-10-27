/**
 * 知识图谱的受控概念词表。
 *
 * 只用于匹配文档标题与各级小标题，不读取正文，避免把示例代码里的词也算成考点。
 * 标题 / h1 / h2 视为主题级命中：标了 strong 的概念在这两级同时出现时，可单独成边。
 * 新增概念时优先放“换个文档还能独立成立”的词，不要把「性能 / 安全 / 接口」这类泛词加回来。
 */
export interface KnowledgeConcept {
  /** 匹配用的小写词；英文按词边界匹配，中文按标题子串匹配 */
  term: string
  /** 展示用名称 */
  label: string
  /** 允许出现的最大文档数；核心工具名可以放宽，泛词不要放宽 */
  maxDf?: number
  /**
   * 同形异义排除：标题命中后，若还命中这里任一条，就不算该概念。
   * 例：「节流」会命中「字节流」，但后者不是限流考点。
   */
  exclude?: RegExp[]
  /**
   * 强概念：在标题 / h1 / h2 里同时命中的两篇文档，允许只凭这一个概念建边。
   * 只给「文档主题本身就是它」的词加，如 Promise、TCP；不要给泛词加。
   */
  strong?: boolean
}

const asciiTerm = /^[a-z0-9 .+#/-]+$/
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 标题已经转小写；英文用词边界，避免 this 命中 thistle 之类的单词 */
export const matchesConcept = (text: string, term: string) =>
  asciiTerm.test(term)
    ? new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`).test(text)
    : text.includes(term)

export const knowledgeConcepts: KnowledgeConcept[] = [
  /* JavaScript 基础 */
  { term: '闭包', label: '闭包', strong: true },
  { term: '作用域', label: '作用域' },
  { term: 'this', label: 'this' },
  { term: '原型', label: '原型' },
  { term: '原型链', label: '原型链' },
  { term: '继承', label: '继承' },
  { term: 'call', label: 'call' },
  { term: 'bind', label: 'bind' },
  { term: 'apply', label: 'apply' },
  { term: 'instanceof', label: 'instanceof' },
  { term: '防抖', label: '防抖' },
  { term: '节流', label: '节流', exclude: [/字节流/] },
  { term: '柯里化', label: '柯里化' },
  { term: '深拷贝', label: '深拷贝' },
  { term: '扁平化', label: '扁平化' },
  { term: '千分位', label: '千分位' },
  { term: '并发控制', label: '并发控制' },
  { term: '重试', label: '重试' },
  { term: '洗牌', label: '洗牌' },

  /* 异步与元编程 */
  { term: '事件循环', label: '事件循环', strong: true },
  { term: '微任务', label: '微任务' },
  { term: '宏任务', label: '宏任务' },
  { term: 'promise', label: 'Promise', maxDf: 12, strong: true },
  { term: 'async', label: 'async' },
  { term: 'await', label: 'await' },
  { term: '生成器', label: '生成器' },
  { term: '迭代器', label: '迭代器' },
  { term: '事件传播', label: '事件传播' },
  { term: '事件流', label: '事件流' },
  { term: 'proxy', label: 'Proxy' },
  { term: 'reflect', label: 'Reflect' },
  { term: 'symbol', label: 'Symbol' },
  { term: 'weakmap', label: 'WeakMap' },
  { term: 'object.is', label: 'Object.is' },
  { term: 'toprimitive', label: 'ToPrimitive' },

  /* Vue */
  { term: '响应式', label: '响应式' },
  { term: 'defineproperty', label: 'defineProperty' },
  { term: 'effect', label: 'effect' },
  { term: '依赖收集', label: '依赖收集' },
  { term: '调度器', label: '调度器' },
  { term: '虚拟dom', label: '虚拟 DOM' },
  { term: 'diff', label: 'Diff' },
  { term: 'fiber', label: 'Fiber' },
  { term: 'hooks', label: 'Hooks' },
  { term: '生命周期', label: '生命周期' },
  { term: '插槽', label: '插槽' },
  { term: '自定义指令', label: '自定义指令' },
  { term: '路由守卫', label: '路由守卫' },
  { term: 'vue router', label: 'Vue Router' },
  { term: '路由懒加载', label: '路由懒加载' },
  { term: '路由', label: '路由' },
  { term: '状态管理', label: '状态管理' },
  { term: 'pinia', label: 'Pinia' },
  { term: 'vuex', label: 'Vuex' },
  { term: '组件通信', label: '组件通信' },
  { term: 'keep-alive', label: 'keep-alive', exclude: [/cluster/i] },
  { term: 'mixin', label: 'mixin' },

  /* React */
  { term: '合成事件', label: '合成事件' },
  { term: '受控组件', label: '受控组件' },
  { term: '高阶组件', label: '高阶组件' },
  { term: '代码分割', label: '代码分割' },
  { term: '状态提升', label: '状态提升' },

  /* TypeScript */
  { term: 'typescript', label: 'TypeScript' },
  { term: '泛型', label: '泛型' },
  { term: '装饰器', label: '装饰器' },
  { term: '枚举', label: '枚举' },
  { term: '类型收窄', label: '类型收窄' },
  { term: '类型断言', label: '类型断言' },
  { term: '重载', label: '重载' },
  { term: 'tsconfig', label: 'tsconfig' },
  { term: 'sourcemap', label: 'Source Map' },

  /* 工程化 */
  { term: 'webpack', label: 'Webpack', maxDf: 12, strong: true },
  { term: 'vite', label: 'Vite' },
  { term: 'babel', label: 'Babel' },
  { term: 'ast', label: 'AST' },
  { term: 'tree shaking', label: 'Tree Shaking' },
  { term: 'commonjs', label: 'CommonJS' },
  { term: 'esm', label: 'ESM' },
  { term: 'es module', label: 'ES Module' },
  { term: 'hmr', label: 'HMR' },
  { term: '模块化', label: '模块化' },
  { term: '工程化', label: '工程化' },
  { term: '脚手架', label: '脚手架' },
  { term: '部署', label: '部署' },
  { term: 'docker', label: 'Docker' },
  { term: 'ci/cd', label: 'CI/CD' },
  { term: 'git', label: 'Git' },
  { term: 'npm', label: 'npm' },
  { term: 'pnpm', label: 'pnpm' },
  { term: '热更新', label: '热更新' },

  /* Node.js */
  { term: 'eventemitter', label: 'EventEmitter' },
  { term: 'stream', label: 'Stream' },
  { term: 'buffer', label: 'Buffer', exclude: [/buffer pool/i] },
  { term: '中间件', label: '中间件' },
  { term: '进程', label: '进程' },
  { term: 'pm2', label: 'pm2' },
  { term: '分页', label: '分页' },
  { term: '文件上传', label: '文件上传' },
  { term: 'jwt', label: 'JWT' },
  { term: '鉴权', label: '鉴权' },

  /* 网络 */
  { term: 'http', label: 'HTTP' },
  { term: 'http 缓存', label: 'HTTP 缓存', strong: true },
  { term: 'http/2', label: 'HTTP/2' },
  { term: 'https', label: 'HTTPS' },
  { term: 'tls', label: 'TLS' },
  { term: 'tcp', label: 'TCP', strong: true },
  { term: 'udp', label: 'UDP' },
  { term: 'websocket', label: 'WebSocket', strong: true },
  { term: 'cors', label: 'CORS' },
  { term: '跨域', label: '跨域' },
  { term: '三次握手', label: '三次握手' },
  { term: '拥塞控制', label: '拥塞控制' },
  { term: 'service worker', label: 'Service Worker' },
  { term: 'cdn', label: 'CDN' },
  { term: 'gzip', label: 'gzip' },

  /* 性能 */
  { term: '首屏', label: '首屏' },
  { term: '强缓存', label: '强缓存' },
  { term: '懒加载', label: '懒加载' },
  { term: '预加载', label: '预加载' },
  { term: '重排', label: '重排', exclude: [/链表/] },
  { term: '重绘', label: '重绘' },
  { term: '内存泄漏', label: '内存泄漏' },
  { term: '垃圾回收', label: '垃圾回收' },
  { term: 'v8', label: 'V8' },
  { term: '监控', label: '监控' },
  { term: '指标', label: '指标' },

  /* 安全 */
  { term: 'xss', label: 'XSS' },
  { term: 'csrf', label: 'CSRF' },
  { term: 'csp', label: 'CSP' },
  { term: '点击劫持', label: '点击劫持' },
  { term: '供应链', label: '供应链' },
  { term: 'sri', label: 'SRI' },
  { term: 'cookie', label: 'Cookie' },
  { term: '同源策略', label: '同源策略' },

  /* 小程序 */
  { term: '小程序', label: '小程序' },
  { term: '双线程', label: '双线程' },
  { term: '逻辑层', label: '逻辑层' },
  { term: '渲染层', label: '渲染层' },
  { term: 'wxml', label: 'WXML' },
  { term: 'wxss', label: 'WXSS' },
  { term: 'setdata', label: 'setData' },
  { term: '页面通信', label: '页面通信' },

  /* 算法与编程题 */
  { term: '排序', label: '排序' },
  { term: '链表', label: '链表' },
  { term: '堆', label: '堆', strong: true },
  { term: '栈', label: '栈' },
  { term: '队列', label: '队列' },
  { term: '哈希', label: '哈希' },
  { term: 'lru', label: 'LRU' },
  { term: '递归', label: '递归' },
  { term: '复杂度', label: '复杂度' },
  { term: '双指针', label: '双指针' },

  /* 设计模式 */
  { term: '单例', label: '单例' },
  { term: '策略', label: '策略' },
  { term: '适配器', label: '适配器' },
  { term: '发布订阅', label: '发布订阅' },
  { term: '代理模式', label: '代理模式' },

  /* HTML / CSS / 浏览器 */
  { term: '盒模型', label: '盒模型' },
  { term: 'bfc', label: 'BFC' },
  { term: '层叠', label: '层叠' },
  { term: '选择器', label: '选择器' },
  { term: '居中', label: '居中' },
  { term: '媒体查询', label: '媒体查询' },
  { term: '动画', label: '动画', exclude: [/动画帧/] },
  { term: '语义化', label: '语义化' },
  { term: 'seo', label: 'SEO' },
  { term: '无障碍', label: '无障碍' },
  { term: '表单', label: '表单', strong: true },
  { term: '存储', label: '存储' },
  { term: '离线', label: '离线', exclude: [/离线修改/] },
  { term: '脚本加载', label: '脚本加载' },
  { term: '同源', label: '同源' },
  { term: 'dom', label: 'DOM' },
  { term: '事件冒泡', label: '事件冒泡' },
  { term: '事件委托', label: '事件委托' },
  { term: '事件捕获', label: '事件捕获' },
  { term: 'flex', label: 'Flex' },
  { term: 'grid', label: 'Grid' },
  { term: '浮动', label: '浮动', exclude: [/无锁|意外升级/] },
  { term: '伪类', label: '伪类' },
]
