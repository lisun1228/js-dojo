import { defineAsyncComponent } from 'vue'
import type { Component } from 'vue'
import { tutorials } from '../router/tutorials'

/**
 * 教程内容的装配层：把 router/tutorials.ts 里的清单，
 * 变成「正文 + 演示组件」，供 DocView 渲染。
 */

/** 正文：src/docs/<id>.md，用 Vite 的 ?raw 在编译期读成字符串 */
const mdModules = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** 演示组件：src/components/demos/*.vue，懒加载按需分包 */
const demoModules = import.meta.glob('../components/demos/*.vue') as Record<
  string,
  () => Promise<{ default: Component }>
>

export interface DocItem {
  id: string
  title: string
  content: string
  demoComponent?: Component
}

export const docs: DocItem[] = tutorials.map((tutorial) => {
  const content = mdModules[`./${tutorial.id}.md`]
  if (content === undefined) {
    throw new Error(`缺少教程文档：src/docs/${tutorial.id}.md`)
  }

  const loader = tutorial.demo
    ? demoModules[`../components/demos/${tutorial.demo}.vue`]
    : undefined
  if (tutorial.demo && !loader) {
    throw new Error(`缺少演示组件：src/components/demos/${tutorial.demo}.vue`)
  }

  return {
    id: tutorial.id,
    title: tutorial.title,
    content,
    demoComponent: loader ? defineAsyncComponent(loader) : undefined,
  }
})

const docMap = new Map(docs.map((doc) => [doc.id, doc]))

export const getDoc = (id: string) => docMap.get(id)
