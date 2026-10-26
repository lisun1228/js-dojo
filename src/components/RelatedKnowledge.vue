<template>
  <section class="related">
    <header class="related-head">
      <div>
        <h2>关联知识</h2>
        <p v-if="neighbors.length">
          显式引用与共同考点都标了原因{{
            neighbors.length > 8 ? '；图中只画权重最高的 8 条' : ''
          }}。
        </p>
        <p v-else>从当前文档出发，找同一考点的其他文章。</p>
      </div>
      <RouterLink
        class="graph-link"
        :to="`/graph?focus=${docId}`"
        >在知识图谱中查看</RouterLink
      >
    </header>

    <p
      v-if="!graph && !error"
      class="state"
    >
      正在加载关联知识…
    </p>
    <p
      v-else-if="error"
      class="state"
    >
      关联知识加载失败。
    </p>
    <p
      v-else-if="!neighbors.length"
      class="state"
    >
      这篇还没有关联知识。
    </p>

    <div
      v-else
      class="related-body"
    >
      <div class="mini-graph">
        <svg
          viewBox="0 0 640 320"
          role="img"
          aria-label="当前文档与其他教程的关联图"
        >
          <line
            v-for="item in positioned"
            :key="`line-${item.node.id}`"
            :x1="CENTER.x"
            :y1="CENTER.y"
            :x2="item.x"
            :y2="item.y"
            class="edge"
            :class="{ explicit: item.outgoing || item.incoming }"
          />
          <circle
            :cx="CENTER.x"
            :cy="CENTER.y"
            r="11"
            class="center-dot"
          />
          <text
            :x="CENTER.x"
            :y="CENTER.y + 27"
            text-anchor="middle"
            class="center-label"
          >
            {{ truncate(docLabel(node?.title ?? ''), 12) }}
          </text>
          <g
            v-for="item in positioned"
            :key="item.node.id"
            class="related-node"
            role="link"
            tabindex="0"
            :aria-label="`打开 ${item.node.title}`"
            @click="go(item.node.id)"
            @keydown.enter.prevent="go(item.node.id)"
            @keydown.space.prevent="go(item.node.id)"
          >
            <circle
              :cx="item.x"
              :cy="item.y"
              r="7"
              :fill="item.color"
              fill-opacity="0.2"
              :stroke="item.color"
              stroke-width="1.5"
            />
            <text
              :x="item.labelX"
              :y="item.labelY"
              :text-anchor="item.anchor"
              dominant-baseline="middle"
              class="node-label"
            >
              {{ truncate(docLabel(item.node.title), 12) }}
            </text>
            <title>{{ item.node.title }} · {{ reasonText(item) }}</title>
          </g>
        </svg>
      </div>

      <ul class="related-list">
        <li
          v-for="item in neighbors"
          :key="item.node.id"
        >
          <RouterLink
            class="related-title"
            :to="`/doc/${item.node.id}`"
          >
            {{ docLabel(item.node.title) }}
          </RouterLink>
          <span class="related-meta">{{ item.node.categoryTitle }}</span>
          <span class="tags">
            <span
              v-if="item.outgoing"
              class="tag"
              >本文引用</span
            >
            <span
              v-if="item.incoming"
              class="tag"
              >引用本文</span
            >
            <span
              v-if="item.edge.concepts.length"
              class="tag concept"
              :title="item.edge.concepts.join(' / ')"
            >
              共同考点：{{ item.edge.concepts.slice(0, 6).join(' / ') }}
              <template v-if="item.edge.concepts.length > 6">
                +{{ item.edge.concepts.length - 6 }}
              </template>
            </span>
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useKnowledgeGraph } from '../composables/useKnowledgeGraph'
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '../types/knowledge-graph'
import { categoryColor, docLabel, truncate } from '../utils/graph-label'

const props = defineProps<{ docId: string }>()

const router = useRouter()
const { graph, error } = useKnowledgeGraph()

const CENTER = { x: 320, y: 160 }
const RADIUS = 112

interface RelatedItem {
  edge: KnowledgeGraphEdge
  node: KnowledgeGraphNode
  outgoing: boolean
  incoming: boolean
}

const node = computed(() => graph.value?.nodes.find((item) => item.id === props.docId))

const categoryIndex = computed(
  () => new Map(graph.value?.categories.map((item, index) => [item.dir, index]) ?? []),
)

const neighbors = computed<RelatedItem[]>(() => {
  if (!graph.value) return []

  const items: RelatedItem[] = []
  for (const edge of graph.value.edges) {
    const neighborId = edge.a === props.docId ? edge.b : edge.b === props.docId ? edge.a : ''
    if (!neighborId) continue

    const neighbor = graph.value.nodes.find((item) => item.id === neighborId)
    if (!neighbor) continue

    items.push({
      edge,
      node: neighbor,
      outgoing: edge.links.some((link) => link.from === props.docId && link.to === neighborId),
      incoming: edge.links.some((link) => link.from === neighborId && link.to === props.docId),
    })
  }

  return items.sort(
    (a, b) => b.edge.weight - a.edge.weight || a.node.title.localeCompare(b.node.title),
  )
})

const positioned = computed(() => {
  const items = neighbors.value.slice(0, 8)
  return items.map((item, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(items.length, 1)
    const x = CENTER.x + RADIUS * Math.cos(angle)
    const y = CENTER.y + RADIUS * Math.sin(angle)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return {
      ...item,
      x,
      y,
      labelX: x + cos * 12,
      labelY: y + sin * 18,
      anchor: cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle',
      color: categoryColor(categoryIndex.value.get(item.node.category) ?? 0),
    }
  })
})

const reasonText = (item: RelatedItem) => {
  const reasons: string[] = []
  if (item.outgoing) reasons.push('本文引用')
  if (item.incoming) reasons.push('引用本文')
  if (item.edge.concepts.length) reasons.push(`共同考点：${item.edge.concepts.join(' / ')}`)
  return reasons.join('；')
}

const go = (id: string) => {
  void router.push(`/doc/${id}`)
}
</script>

<style scoped>
.related {
  margin-top: 28px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  text-align: left;
}

.related-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.related-head h2 {
  margin: 0 0 4px;
  font-size: 17px;
  color: var(--text-h);
}

.related-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text);
  opacity: 0.8;
}

.graph-link {
  flex: none;
  font-size: 13px;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}

.graph-link:hover {
  text-decoration: underline;
}

.related-body {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.mini-graph {
  width: 100%;
}

.mini-graph svg {
  display: block;
  width: 100%;
  height: auto;
}

.edge {
  stroke: var(--accent-border);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}

.edge.explicit {
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: none;
}

.center-dot {
  fill: var(--accent-bg);
  stroke: var(--accent);
  stroke-width: 2;
}

.center-label {
  fill: var(--text-h);
  font-size: 13px;
  font-weight: 600;
}

.node-label {
  fill: var(--text-h);
  font-size: 13px;
}

.related-node {
  cursor: pointer;
  outline: none;
}

.related-node:hover circle,
.related-node:focus-visible circle {
  stroke-width: 3;
}

.related-node text {
  pointer-events: none;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.related-list li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--border);
}

.related-list li:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.related-title {
  font-size: 14px;
  color: var(--text-h);
  text-decoration: none;
}

.related-title:hover {
  color: var(--accent);
}

.related-meta {
  font-size: 12px;
  color: var(--text);
  opacity: 0.65;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--code-bg);
  color: var(--text);
  font-size: 12px;
}

.tag.concept {
  background: var(--accent-bg);
  color: var(--accent);
}

.state {
  margin: 0;
  font-size: 13px;
  color: var(--text);
  opacity: 0.75;
}

@media (max-width: 1200px) {
  .related-body {
    grid-template-columns: 1fr;
  }

  .mini-graph {
    max-width: 640px;
    margin: 0 auto;
  }
}

@media (max-width: 720px) {
  .related-head {
    flex-direction: column;
  }
}
</style>
