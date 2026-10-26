import { tutorialMenus } from '../router'

export interface NavMenuItem {
  title: string
  path: string
}

export interface NavMenuGroup {
  title: string
  items: NavMenuItem[]
}

/** 顶层条目：单条链接直接平铺，分组才渲染成可折叠的父节点 */
export type NavEntry = NavMenuItem | NavMenuGroup

export const isNavGroup = (entry: NavEntry): entry is NavMenuGroup => 'items' in entry

/**
 * 侧边栏与顶部搜索共用的导航菜单。
 * 教程分类仍由 src/router/tutorials.ts 提供，这里只补几个非教程入口。
 */
export const navMenus: NavEntry[] = [
  { title: '首页', path: '/' },
  { title: '知识图谱', path: '/graph' },
  // {
  //   title: '路由演示',
  //   items: [{ title: '404 兜底', path: '/abc' }],
  // },
  ...tutorialMenus,
]
