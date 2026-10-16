/**
 * 教程目录 —— 唯一数据源。
 *
 * 分类、教程清单、演示组件都在这里维护：
 *   - src/router/index.ts 向外统一导出，供侧边栏使用
 *   - src/docs/index.ts   据此加载对应 md 正文与演示组件
 *   - 路由本身由 /doc/:id 统一承载，无需逐个登记
 *
 * 新增教程：
 *   1. 在 src/docs/ 下新增 <id>.md
 *   2. 需要演示则在 src/components/demos/ 下新增 <Demo>.vue
 *   3. 在下面 categories 的对应分类里补一条记录
 * 分类（标题、顺序、归属）只在 categories 中定义一次，改分类名也只需改这一处。
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
  /** 分类名，同时作为侧边栏分组标题 */
  title: string
  items: Tutorial[]
}

/** 教程分类：标题、顺序、每个分类下有哪些教程都在这里定义 */
export const categories: TutorialCategory[] = [
  {
    title: '设计模式',
    items: [
      { id: 'decorator', title: '装饰器 + @语法糖', demo: 'DecoratorDemo' },
      { id: 'adapter', title: '适配器模式', demo: 'AdapterDemo' },
      { id: 'strategy', title: '策略模式', demo: 'StrategyDemo' },
      { id: 'singleton', title: '单例模式', demo: 'SingletonDemo' },
    ],
  },
  {
    title: 'Vue',
    items: [
      { id: 'props-slots', title: 'Props / 插槽 / $attrs', demo: 'PropsDemo' },
      { id: 'proxy-reactive', title: 'Proxy 与响应式', demo: 'ProxyReactiveDemo' },
      { id: 'reactive-effect', title: '响应式原理 effect', demo: 'ReactiveEffectDemo' },
    ],
  },
  {
    title: 'JS 原理',
    items: [
      { id: 'event-propagation', title: '事件传播与停止', demo: 'EventPropagationDemo' },
      { id: 'call-bind', title: '手写 call / bind', demo: 'CallBindDemo' },
      { id: 'prototype-chain', title: '原型与原型链', demo: 'PrototypeChainDemo' },
    ],
  },
]

/** 拍平后的教程清单，便于按 id 查找、按顺序加载正文 */
export const tutorials: Tutorial[] = categories.flatMap((category) => category.items)

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
