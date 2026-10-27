import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import {
  knowledgeConcepts,
  matchesConcept,
  type KnowledgeConcept,
} from '../src/config/knowledge.ts'
import { categories } from '../src/router/tutorials.ts'
import type {
  KnowledgeGraph,
  KnowledgeGraphCategory,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from '../src/types/knowledge-graph.ts'
import { collectVisibleLines, parseHeadings } from './markdown-scan.ts'

/**
 * 知识图谱数据：节点是教程，边只有两种来源。
 *   - link：正文里的 /doc/:id 显式引用
 *   - concept：两篇文档的标题共享受控概念词且满足稀有度门槛，
 *     或强概念在双方的标题 / h1 / h2 里同时命中
 *
 * 同分类只用于页面分组，不生成边，避免每个分类内部变成全连接。
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_ROOT = join(ROOT, 'src/docs')
const TUTORIALS_FILE = join(ROOT, 'src/router/tutorials.ts')
const CONCEPTS_FILE = join(ROOT, 'src/config/knowledge.ts')
const VIRTUAL_ID = 'virtual:knowledge-graph'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

/** 泛词门槛：出现在超过 8 篇标题里的概念不建边 */
const MAX_DF = 8
/** 单个概念也能建边时，它必须足够稀有 */
const RARE_DF = 3
/** 一条显式引用在排序里的权重，高于普通概念边 */
const LINK_WEIGHT = 2

interface DocInput {
  node: KnowledgeGraphNode
  concepts: string[]
  /** 标题 / h1 / h2 级别命中的强概念，可单独建边 */
  strongConcepts: Set<string>
  links: string[]
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })

const conceptLabel = new Map(knowledgeConcepts.map((concept) => [concept.term, concept.label]))
const conceptMaxDf = new Map(
  knowledgeConcepts.map((concept) => [concept.term, concept.maxDf ?? MAX_DF]),
)

/** 概念命中标题后，还要排掉同形异义的上下文（如「字节流」里的「节流」） */
const matchConcept = (text: string, concept: KnowledgeConcept) =>
  matchesConcept(text, concept.term) && !concept.exclude?.some((pattern) => pattern.test(text))

const readDocs = (): DocInput[] => {
  const nodes = new Map<string, KnowledgeGraphNode>()
  for (const category of categories) {
    for (const item of category.items) {
      nodes.set(item.id, {
        id: item.id,
        title: item.title,
        category: category.dir,
        categoryTitle: category.title,
      })
    }
  }

  const docs: DocInput[] = []
  for (const category of categories) {
    for (const item of category.items) {
      const node = nodes.get(item.id)
      if (!node) throw new Error(`缺少教程节点：${item.id}`)

      const lines = readFileSync(join(DOCS_ROOT, category.dir, `${item.id}.md`), 'utf8').split('\n')
      const visible = collectVisibleLines(lines)
      const headings = parseHeadings(visible)
      const text = [item.title, ...headings.map((heading) => heading.text)].join(' ').toLowerCase()
      const primaryText = [
        item.title,
        ...headings.filter((heading) => heading.level <= 2).map((heading) => heading.text),
      ]
        .join(' ')
        .toLowerCase()
      const matched = knowledgeConcepts.filter((concept) => matchConcept(text, concept))
      const concepts = matched.map((concept) => concept.term)
      const strongConcepts = new Set(
        matched
          .filter((concept) => concept.strong && matchConcept(primaryText, concept))
          .map((concept) => concept.term),
      )

      const links = new Set<string>()
      for (const { text: line } of visible) {
        for (const match of line.matchAll(/\]\((\/doc\/[^)\s]+)\)/g)) {
          const target = match[1].slice('/doc/'.length).split(/[#?]/)[0].replace(/\/$/, '')
          if (target !== item.id && nodes.has(target)) links.add(target)
        }
      }

      docs.push({ node, concepts, strongConcepts, links: [...links] })
    }
  }

  return docs
}

const getEdge = (edges: Map<string, KnowledgeGraphEdge>, a: string, b: string) => {
  const [left, right] = a < b ? [a, b] : [b, a]
  const key = `${left}|${right}`
  let edge = edges.get(key)
  if (!edge) {
    edge = { a: left, b: right, links: [], concepts: [], weight: 0 }
    edges.set(key, edge)
  }
  return edge
}

export const buildKnowledgeGraph = (): KnowledgeGraph => {
  const docs = readDocs()
  const nodes = docs.map((doc) => doc.node)
  const categoriesOut: KnowledgeGraphCategory[] = categories.map((category) => ({
    dir: category.dir,
    title: category.title,
    count: category.items.length,
  }))

  const conceptDf = new Map<string, number>()
  for (const doc of docs) {
    for (const term of doc.concepts) {
      conceptDf.set(term, (conceptDf.get(term) ?? 0) + 1)
    }
  }

  const edges = new Map<string, KnowledgeGraphEdge>()

  for (const doc of docs) {
    for (const target of doc.links) {
      const edge = getEdge(edges, doc.node.id, target)
      edge.links.push({ from: doc.node.id, to: target })
      edge.weight += LINK_WEIGHT
    }
  }

  const docConcepts = docs.map(
    (doc) =>
      new Set(
        doc.concepts.filter(
          (term) => (conceptDf.get(term) ?? 0) <= (conceptMaxDf.get(term) ?? MAX_DF),
        ),
      ),
  )

  for (let i = 0; i < docs.length; i += 1) {
    for (let j = i + 1; j < docs.length; j += 1) {
      const shared = [...docConcepts[i]].filter((term) => docConcepts[j].has(term))
      if (shared.length === 0) continue

      const hasRare = shared.some((term) => (conceptDf.get(term) ?? 0) <= RARE_DF)
      const hasStrong = shared.some(
        (term) => docs[i].strongConcepts.has(term) && docs[j].strongConcepts.has(term),
      )
      if (shared.length < 2 && !hasRare && !hasStrong) continue

      shared.sort((a, b) => (conceptDf.get(a) ?? 0) - (conceptDf.get(b) ?? 0) || a.localeCompare(b))

      const edge = getEdge(edges, docs[i].node.id, docs[j].node.id)
      for (const term of shared) {
        const label = conceptLabel.get(term)
        if (label && !edge.concepts.includes(label)) edge.concepts.push(label)
        edge.weight += 1 / (conceptDf.get(term) ?? 1)
      }
    }
  }

  const edgeList = [...edges.values()].sort(
    (a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b),
  )

  const touched = new Set<string>()
  for (const edge of edgeList) {
    touched.add(edge.a)
    touched.add(edge.b)
  }
  const isolated = nodes.filter((node) => !touched.has(node.id)).map((node) => node.id)

  return {
    nodes,
    categories: categoriesOut,
    edges: edgeList,
    isolated,
    stats: {
      docs: nodes.length,
      categories: categoriesOut.length,
      explicitLinks: edgeList.reduce((total, edge) => total + edge.links.length, 0),
      explicitPairs: edgeList.filter((edge) => edge.links.length > 0).length,
      conceptPairs: edgeList.filter((edge) => edge.concepts.length > 0).length,
      conceptOnlyPairs: edgeList.filter(
        (edge) => edge.links.length === 0 && edge.concepts.length > 0,
      ).length,
      totalEdges: edgeList.length,
      connectedDocs: nodes.length - isolated.length,
      isolatedDocs: isolated.length,
    },
  }
}

export const validateKnowledgeGraph = (graph: KnowledgeGraph): string[] => {
  const errors: string[] = []
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const labels = new Set(knowledgeConcepts.map((concept) => concept.label))

  if (nodeIds.size !== graph.nodes.length) errors.push('节点 id 重复')
  if (
    graph.categories.reduce((total, category) => total + category.count, 0) !== graph.nodes.length
  ) {
    errors.push('分类计数与节点数不一致')
  }

  const seen = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.a === edge.b) errors.push(`自环：${edge.a}`)
    if (!nodeIds.has(edge.a) || !nodeIds.has(edge.b)) {
      errors.push(`悬空节点：${edge.a} / ${edge.b}`)
    }
    if (!edge.links.length && !edge.concepts.length) {
      errors.push(`缺少来源：${edge.a} ↔ ${edge.b}`)
    }

    const key = `${edge.a}|${edge.b}`
    if (seen.has(key)) errors.push(`重复边：${key}`)
    seen.add(key)

    for (const link of edge.links) {
      if (link.from === link.to) errors.push(`自引用链接：${link.from}`)
      if (!nodeIds.has(link.from) || !nodeIds.has(link.to)) {
        errors.push(`链接悬空：${link.from} → ${link.to}`)
      }
    }
    for (const concept of edge.concepts) {
      if (!labels.has(concept)) errors.push(`未知概念：${concept}`)
    }
  }

  const touched = new Set<string>()
  for (const edge of graph.edges) {
    touched.add(edge.a)
    touched.add(edge.b)
  }
  const isolated = graph.nodes.filter((node) => !touched.has(node.id)).map((node) => node.id)
  if (isolated.join('|') !== graph.isolated.join('|')) {
    errors.push('未关联文档列表与边不一致')
  }

  const stats = graph.stats
  if (stats.docs !== graph.nodes.length) errors.push('stats.docs 不一致')
  if (stats.categories !== graph.categories.length) errors.push('stats.categories 不一致')
  if (stats.totalEdges !== graph.edges.length) errors.push('stats.totalEdges 不一致')
  if (stats.explicitLinks !== graph.edges.reduce((total, edge) => total + edge.links.length, 0)) {
    errors.push('stats.explicitLinks 不一致')
  }
  if (stats.connectedDocs + stats.isolatedDocs !== stats.docs) {
    errors.push('连接/未连接计数不一致')
  }

  return errors
}

const knowledgeGraphInputs = (): string[] => [
  TUTORIALS_FILE,
  CONCEPTS_FILE,
  ...walk(DOCS_ROOT).filter((file) => file.endsWith('.md')),
]

export function knowledgeGraphPlugin(): Plugin {
  return {
    name: 'knowledge-graph',
    enforce: 'pre',

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },

    load(id) {
      if (id !== RESOLVED_ID) return null

      const graph = buildKnowledgeGraph()
      const errors = validateKnowledgeGraph(graph)
      if (errors.length) {
        throw new Error(`知识图谱数据有问题：\n${errors.join('\n')}`)
      }

      for (const file of knowledgeGraphInputs()) this.addWatchFile(file)
      return `export default ${JSON.stringify(graph)}`
    },
  }
}
