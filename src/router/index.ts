import { createRouter, createWebHistory } from 'vue-router'

// 教程分类与清单的唯一数据源在 ./tutorials，这里统一向外导出供侧边栏使用
export { tutorialMenus } from './tutorials'

const routes = [
  {
    path: '/',
    name: 'home',
    // 懒加载，按需拆分 chunk
    component: () => import('../views/HomeView.vue'),
  },
  {
    // 通用教程页：id 对应 src/docs/<分类目录>/<id>.md
    // 分类与清单见 src/router/tutorials.ts，正文装配见 src/docs/index.ts
    path: '/doc/:id',
    name: 'doc',
    component: () => import('../views/DocView.vue'),
    props: true,
  },
  {
    // 分类级知识地图，节点与边由 build/knowledge-graph.ts 在构建期生成
    path: '/graph',
    name: 'graph',
    component: () => import('../views/GraphView.vue'),
  },
  {
    // 兜底：匹配不到的路由
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    component: () => import('../views/NotFound.vue'),
  },
]

// 每篇笔记的滚动位置：离开时记下，再次切回来时恢复
const scrollPositions = new Map<string, number>()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (to, _from, savedPosition) => {
    // 浏览器前进 / 后退优先用历史记录里的位置
    if (savedPosition) return savedPosition
    // 侧栏或搜索结果跳转：回到这篇笔记上次停留的位置，没记录过则回顶
    return { top: scrollPositions.get(to.fullPath) ?? 0 }
  },
})

router.beforeEach((_to, from) => {
  // 只在已经进入过页面的情况下记录，避开初始导航
  if (from.matched.length) scrollPositions.set(from.fullPath, window.scrollY)
})

router.beforeEach(async (to) => {
  if (to.name !== 'doc') return
  // 正文按篇分包，导航完成前先加载好，DocView 首帧即有内容：
  // 否则滚动位置恢复和搜索结果锚点跳转都会因为页面高度不足而失效。
  // 动态 import 让 docs 装配层不进入首页首包。
  try {
    const { loadDocContent } = await import('../docs')
    await loadDocContent(String(to.params.id))
  } catch {
    // 分包加载失败时交给 DocView 展示提示，不阻断导航
  }
})

export default router
