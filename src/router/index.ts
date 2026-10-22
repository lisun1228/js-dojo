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

export default router
