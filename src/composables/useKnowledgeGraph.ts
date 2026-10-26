import { ref, type Ref } from 'vue'
import type { KnowledgeGraph } from '../types/knowledge-graph'

let loading: Promise<void> | null = null
const graph = ref<KnowledgeGraph | null>(null)
const error = ref(false)

/**
 * 图谱数据是所有文档共用的构建期产物，只加载一次。
 * 文档页和 /graph 页都用它，避免各自打一份 JSON。
 */
export function useKnowledgeGraph(): {
  graph: Ref<KnowledgeGraph | null>
  error: Ref<boolean>
  load: () => Promise<void>
} {
  const load = () => {
    loading ??= import('virtual:knowledge-graph')
      .then(({ default: data }) => {
        graph.value = data
      })
      .catch(() => {
        error.value = true
      })
    return loading
  }

  void load()
  return { graph, error, load }
}
