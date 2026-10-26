import { buildKnowledgeGraph, validateKnowledgeGraph } from './knowledge-graph.ts'

const graph = buildKnowledgeGraph()
const errors = validateKnowledgeGraph(graph)
const { stats } = graph

if (errors.length) {
  for (const message of errors) process.stderr.write(`[graph] ${message}\n`)
  process.stderr.write(`知识图谱检查失败：${errors.length} 个问题\n`)
  process.exitCode = 1
} else {
  process.stdout.write(
    `知识图谱检查通过：${stats.docs} 篇文档 / ${stats.categories} 个分类 / ` +
      `${stats.explicitPairs} 对显式关联 / ${stats.conceptPairs} 对共同考点 / ` +
      `${stats.isolatedDocs} 篇未关联\n`,
  )
  process.stdout.write(`未关联文档：${graph.isolated.length ? graph.isolated.join(', ') : '无'}\n`)
}
