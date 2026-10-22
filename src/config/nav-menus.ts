import { tutorialMenus } from '../router'

export interface NavMenuItem {
  title: string
  path: string
}

export interface NavMenuGroup {
  title: string
  items: NavMenuItem[]
}

/**
 * 侧边栏与顶部搜索共用的导航菜单。
 * 教程分类仍由 src/router/tutorials.ts 提供，这里只补几个非教程入口。
 */
export const navMenus: NavMenuGroup[] = [
  {
    title: '开始',
    items: [{ title: '首页', path: '/' }],
  },
  {
    title: '路由演示',
    items: [{ title: '404 兜底', path: '/abc' }],
  },
  ...tutorialMenus,
]
