import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { categories } from '../src/router/tutorials.ts'
import { slugify } from '../src/utils/slugify.ts'

/**
 * 构建期生成全文检索索引（virtual:search-index）。
 *
 * 以前搜索要动态 import 整个 docs 模块：既包含 146 篇正文，
 * 还带着构建期内联的 Mermaid SVG，首次搜索要解析 6.7MB。
 * 现在索引只保留「文档 id / 标题 / 小节标题 / 锚点 / 纯正文」，
 * 并且是独立 chunk，只有用户真正输入关键词时才加载。
 *
 * 文档仍由 router/tutorials.ts 定位，不在此处维护第二份清单。
 */

const VIRTUAL_ID = 'virtual:search-index'
const RESOLVED_ID = `\0${VIRTUAL_ID}`
const DOCS_ROOT = resolve('src/docs')

interface IndexedSection {
  docId: string
  docTitle: string
  heading: string
  anchor: string
  text: string
}

/** 按 ## 二级标题切分：目录本身只是锚点链接，命中它没有意义 */
const splitSections = (content: string, docId: string, docTitle: string): IndexedSection[] => {
  const list: IndexedSection[] = []
  let heading = ''
  let anchor = ''
  let skip = false
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join('\n').trim()
    if (skip || !text) return
    list.push({ docId, docTitle, heading: heading || docTitle, anchor, text })
  }

  for (const line of content.split('\n')) {
    const matched = /^##\s+(.+?)\s*$/.exec(line)
    if (matched) {
      flush()
      heading = matched[1]
      anchor = slugify(heading)
      skip = heading === '目录'
      buffer = []
    } else {
      buffer.push(line)
    }
  }
  flush()

  return list
}

export function searchIndexPlugin(): Plugin {
  return {
    name: 'search-index',
    enforce: 'pre',

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },

    load(id) {
      if (id !== RESOLVED_ID) return null

      const sections: IndexedSection[] = []
      for (const category of categories) {
        for (const item of category.items) {
          const file = resolve(DOCS_ROOT, category.dir, `${item.id}.md`)
          this.addWatchFile(file)
          const content = readFileSync(file, 'utf8')
          sections.push(...splitSections(content, item.id, item.title))
        }
      }

      return `export default ${JSON.stringify(sections)}`
    },
  }
}
