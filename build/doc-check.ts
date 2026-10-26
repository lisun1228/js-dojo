import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { categories } from '../src/router/tutorials.ts'
import { slugify } from '../src/utils/slugify.ts'

/**
 * 文档契约检查：把 docs-mapping.md 里的人工自检变成命令。
 *
 * 检查项：
 *   1. tutorials.ts 与磁盘文件双向一致（缺正文 / 缺演示 / 多余文档 / 重复 id）
 *   2. 首行是唯一的 H1
 *   3. 非总览页必须有 ## 目录，且它是第一个二级标题
 *   4. 目录只收录 h2、锚点能落到真实标题、h2 一个不漏
 *   5. 正文里的 #锚点、/doc/:id、public 图片都能找到目标
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_ROOT = join(ROOT, 'src/docs')
const DEMOS_ROOT = join(ROOT, 'src/components/demos')
const PUBLIC_ROOT = join(ROOT, 'public')
const TUTORIALS_FILE = 'src/router/tutorials.ts'

interface Issue {
  file: string
  line?: number
  message: string
}

interface Heading {
  level: number
  text: string
  line: number
  anchor: string
}

interface VisibleLine {
  line: number
  text: string
}

const issues: Issue[] = []

const report = (file: string, message: string, line?: number) => {
  issues.push({ file, line, message })
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })

const rel = (file: string) => relative(ROOT, file).split(sep).join('/')
const isKebabCase = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)

/** 跳过围栏代码块，避免把示例里的链接和标题当成真实文档结构 */
const collectVisibleLines = (lines: string[]): VisibleLine[] => {
  const visible: VisibleLine[] = []
  let fence: string | undefined

  lines.forEach((text, index) => {
    if (fence) {
      if (text.trimStart().startsWith(fence)) fence = undefined
      return
    }

    const fenceMatch = /^\s*(```|~~~)/.exec(text)
    if (fenceMatch) {
      fence = fenceMatch[1]
      return
    }

    visible.push({ line: index + 1, text })
  })

  return visible
}

const parseHeadings = (visible: VisibleLine[]): Heading[] =>
  visible.flatMap(({ line, text }) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(text)
    if (!match) return []
    return [{ level: match[1].length, text: match[2], line, anchor: slugify(match[2]) }]
  })

/* ---------- 1. 清单与磁盘文件 ---------- */

const expectedDocById = new Map<string, string>()
const seenDirs = new Set<string>()

for (const category of categories) {
  if (!isKebabCase(category.dir)) {
    report(TUTORIALS_FILE, `分类目录名不是 kebab-case：${category.dir}`)
  }
  if (seenDirs.has(category.dir)) {
    report(TUTORIALS_FILE, `分类目录重复：${category.dir}`)
  }
  seenDirs.add(category.dir)

  const categoryDir = join(DOCS_ROOT, category.dir)
  if (!existsSync(categoryDir)) {
    report(TUTORIALS_FILE, `分类目录不存在：src/docs/${category.dir}`)
  }

  for (const item of category.items) {
    if (!isKebabCase(item.id)) {
      report(TUTORIALS_FILE, `教程 id 不是 kebab-case：${item.id}`)
    }
    if (expectedDocById.has(item.id)) {
      report(TUTORIALS_FILE, `教程 id 重复：${item.id}`)
    }

    const docPath = join(categoryDir, `${item.id}.md`)
    expectedDocById.set(item.id, docPath)
    if (!existsSync(docPath)) {
      report(TUTORIALS_FILE, `缺少教程正文：src/docs/${category.dir}/${item.id}.md`)
    }
    if (item.demo && !existsSync(join(DEMOS_ROOT, `${item.demo}.vue`))) {
      report(TUTORIALS_FILE, `缺少演示组件：src/components/demos/${item.demo}.vue`)
    }
  }
}

const mdFiles = walk(DOCS_ROOT).filter((file) => file.endsWith('.md'))

for (const file of mdFiles) {
  const expected = expectedDocById.get(basename(file, '.md'))
  if (!expected) {
    report(rel(file), '未在 src/router/tutorials.ts 登记')
  } else if (expected !== file) {
    report(rel(file), `文档位置与 tutorials.ts 不一致，应为 ${rel(expected)}`)
  }
}

/* ---------- 2~5. 单篇结构 ---------- */

for (const file of mdFiles) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const visible = collectVisibleLines(lines)
  const headings = parseHeadings(visible)

  const firstContent = visible.find(({ text }) => text.trim())
  const h1s = headings.filter((heading) => heading.level === 1)
  if (h1s.length !== 1) {
    report(rel(file), `一级标题必须且只能有一个，当前 ${h1s.length} 个`, h1s[0]?.line)
  } else if (firstContent?.line !== h1s[0].line) {
    report(rel(file), '首行必须是 # 标题', firstContent?.line)
  }

  const h2s = headings.filter((heading) => heading.level === 2)
  const h2Anchors = new Set(h2s.map((heading) => heading.anchor))
  const allAnchors = new Set(headings.map((heading) => heading.anchor))
  const toc = h2s.find((heading) => heading.text === '目录')
  const tocEnd = toc
    ? (h2s.find((heading) => heading.line > toc.line)?.line ?? lines.length + 1)
    : 0
  const isTocLine = (line: number) => Boolean(toc && line > toc.line && line < tocEnd)

  let listedAnchors = new Set<string>()

  if (!file.endsWith('-overview.md')) {
    if (!toc) {
      report(rel(file), '缺少 ## 目录')
    } else {
      if (h2s[0] !== toc) {
        report(rel(file), '## 目录 必须是第一个二级标题', toc.line)
      }

      listedAnchors = new Set<string>()
      for (const { line, text } of visible.filter(({ line }) => isTocLine(line))) {
        for (const match of text.matchAll(/\]\(#([^)]+)\)/g)) {
          listedAnchors.add(match[1])
          if (!h2Anchors.has(match[1])) {
            report(rel(file), `目录锚点不存在或不是二级标题：#${match[1]}`, line)
          }
        }
      }

      for (const heading of h2s.filter(({ line }) => line > toc.line)) {
        if (!listedAnchors.has(heading.anchor)) {
          report(rel(file), `目录缺少二级标题：${heading.text}`, heading.line)
        }
      }
    }
  }

  const seenH2 = new Set<string>()
  for (const heading of h2s) {
    if (seenH2.has(heading.anchor)) {
      report(rel(file), `二级标题锚点重复：#${heading.anchor}`, heading.line)
    }
    seenH2.add(heading.anchor)
  }

  for (const { line, text } of visible) {
    if (!isTocLine(line)) {
      for (const match of text.matchAll(/\]\(#([^)]+)\)/g)) {
        if (!allAnchors.has(match[1])) {
          report(rel(file), `锚点不存在：#${match[1]}`, line)
        }
      }
    }

    for (const match of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const src = match[1]
      if (/^https?:\/\//.test(src)) continue
      if (!src.startsWith('/')) {
        report(rel(file), `图片必须使用 public 根路径：${src}`, line)
        continue
      }
      const publicPath = src.split(/[?#]/)[0]
      if (!existsSync(join(PUBLIC_ROOT, publicPath))) {
        report(rel(file), `图片不存在：public${publicPath}`, line)
      }
    }

    for (const match of text.matchAll(/\]\((\/doc\/[^)\s]+)\)/g)) {
      const id = match[1].slice('/doc/'.length).split(/[#?]/)[0].replace(/\/$/, '')
      if (!expectedDocById.has(id)) {
        report(rel(file), `链接指向不存在的教程：${match[1]}`, line)
      }
    }
  }
}

/* ---------- 输出 ---------- */

const demoCount = categories.reduce(
  (total, category) => total + category.items.filter((item) => item.demo).length,
  0,
)
const summary = `${mdFiles.length} 篇文档 / ${categories.length} 个分类 / ${demoCount} 个演示`

if (issues.length === 0) {
  process.stdout.write(`文档契约检查通过：${summary}\n`)
} else {
  issues.sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0))
  for (const issue of issues) {
    const location = issue.line ? `${issue.file}:${issue.line}` : issue.file
    process.stderr.write(`[docs] ${location} ${issue.message}\n`)
  }
  process.stderr.write(`文档契约检查失败：${issues.length} 个问题（${summary}）\n`)
  process.exitCode = 1
}
