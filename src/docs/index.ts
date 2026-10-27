import { defineAsyncComponent } from 'vue'
import type { Component } from 'vue'
import { tutorials } from '../router/tutorials'

/**
 * 教程内容的装配层：把 router/tutorials.ts 里的清单，
 * 变成「按需加载的正文 + 懒加载演示组件」，供 DocView 渲染。
 *
 * 正文不再用 eager 全量打包，每篇 md 单独分包，
 * 由路由守卫在进入文章前预加载。
 */

/** 正文：src/docs/<分类目录>/<id>.md，按需加载，每篇独立分包 */
const mdModules = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

/** 演示组件：src/components/demos/*.vue，懒加载按需分包 */
const demoModules = import.meta.glob('../components/demos/*.vue') as Record<
  string,
  () => Promise<{ default: Component }>
>

export interface DocMeta {
  id: string
  title: string
  /** 所属分类目录，用于取分类名与拼上一篇 / 下一篇 */
  dir: string
  demoComponent?: Component
}

const fileMap = new Map<string, string>()
const metaMap = new Map<string, DocMeta>()

// 启动时校验映射完整性：缺文档 / 缺演示组件仍然第一时间抛错
for (const tutorial of tutorials) {
  const file = `${tutorial.dir}/${tutorial.id}.md`
  if (!mdModules[`./${file}`]) {
    throw new Error(`缺少教程文档：src/docs/${file}`)
  }

  const loader = tutorial.demo ? demoModules[`../components/demos/${tutorial.demo}.vue`] : undefined
  if (tutorial.demo && !loader) {
    throw new Error(`缺少演示组件：src/components/demos/${tutorial.demo}.vue`)
  }

  fileMap.set(tutorial.id, file)
  metaMap.set(tutorial.id, {
    id: tutorial.id,
    title: tutorial.title,
    dir: tutorial.dir,
    demoComponent: loader ? defineAsyncComponent(loader) : undefined,
  })
}

const contentCache = new Map<string, string>()
const pendingLoads = new Map<string, Promise<string | undefined>>()

/** 已加载完成的正文；未加载过返回 undefined */
export const getDocContent = (id: string) => contentCache.get(id)

/**
 * 加载正文并缓存，重复调用复用同一个 Promise。
 * 路由守卫会在导航完成前 await 它，DocView 首次渲染即可同步拿到内容，
 * 这样滚动位置恢复和搜索结果锚点跳转都不会落空。
 */
export const loadDocContent = (id: string): Promise<string | undefined> => {
  const cached = contentCache.get(id)
  if (cached !== undefined) return Promise.resolve(cached)

  const file = fileMap.get(id)
  if (file === undefined) return Promise.resolve(undefined)

  const loading = pendingLoads.get(id)
  if (loading) return loading

  const promise = mdModules[`./${file}`]()
    .then((content) => {
      contentCache.set(id, content)
      return content
    })
    .finally(() => {
      pendingLoads.delete(id)
    })

  pendingLoads.set(id, promise)
  return promise
}

export const getDocMeta = (id: string) => metaMap.get(id)
