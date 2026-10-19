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

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
