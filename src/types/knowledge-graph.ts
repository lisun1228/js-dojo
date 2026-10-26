/** 知识图谱数据：节点是教程，边只保留可解释的来源（显式链接或共同考点）。 */

export interface KnowledgeGraphNode {
  /** 教程 id，与 /doc/:id 一致 */
  id: string
  /** 教程标题 */
  title: string
  /** 所属分类目录，对应 tutorials.ts 的 dir */
  category: string
  /** 分类中文名 */
  categoryTitle: string
}

export interface KnowledgeGraphCategory {
  dir: string
  title: string
  count: number
}

export interface KnowledgeGraphLink {
  from: string
  to: string
}

export interface KnowledgeGraphEdge {
  /** 无序边，a < b */
  a: string
  b: string
  /** 正文里的显式 /doc/:id 引用，保留方向 */
  links: KnowledgeGraphLink[]
  /** 共同考点，按稀有度从高到低排列 */
  concepts: string[]
  /** 排序权重：显式链接优先，概念边按 1/df 累加 */
  weight: number
}

export interface KnowledgeGraphStats {
  docs: number
  categories: number
  /** 有向显式链接数 */
  explicitLinks: number
  /** 有显式链接的无序文档对数 */
  explicitPairs: number
  /** 有共同考点的无序文档对数 */
  conceptPairs: number
  /** 只有共同考点、没有显式链接的文档对数 */
  conceptOnlyPairs: number
  totalEdges: number
  connectedDocs: number
  isolatedDocs: number
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[]
  categories: KnowledgeGraphCategory[]
  edges: KnowledgeGraphEdge[]
  /** 没有任何边的教程 id，按 tutorials.ts 顺序 */
  isolated: string[]
  stats: KnowledgeGraphStats
}
