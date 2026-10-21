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
