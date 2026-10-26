<template>
  <div class="graph-page">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">JS 道场 · 知识图谱</p>
        <h1>按分类看知识之间的关系</h1>
        <p class="lead">
          节点是分类，连线是跨分类的文档关联。点击分类查看文档；每篇文档还会标出关联数量与共同考点。
        </p>
      </div>

      <dl
        v-if="stats"
        class="stats"
      >
        <div class="stat">
          <dt>教程</dt>
          <dd>{{ stats.docs }}</dd>
        </div>
        <div class="stat">
          <dt>分类</dt>
          <dd>{{ stats.categories }}</dd>
        </div>
        <div class="stat">
          <dt>显式引用</dt>
          <dd>{{ stats.explicitPairs }}</dd>
        </div>
        <div class="stat">
          <dt>共同考点</dt>
          <dd>{{ stats.conceptPairs }}</dd>
        </div>
        <div class="stat">
          <dt>关联总数</dt>
          <dd>{{ stats.totalEdges }}</dd>
        </div>
      </dl>
    </header>

    <p
      v-if="!graph && !error"
      class="state"
    >
      正在加载知识图谱…
    </p>
    <p
      v-else-if="error"
      class="state"
    >
      知识图谱加载失败。
    </p>

    <div
      v-else
      class="graph-layout"
    >
      <section class="canvas-wrap">
        <svg
          viewBox="0 0 900 620"
          role="img"
          aria-label="按分类组织的知识地图"
        >
          <g class="edges">
            <path
              v-for="edge in categoryEdges"
              :key="edge.key"
              :d="edge.path"
              class="category-edge"
              :class="{
                active: isEdgeActive(edge),
                dimmed: Boolean(selectedDir) && !isEdgeActive(edge),
              }"
              :style="{ strokeWidth: edge.width }"
            >
              <title>
                {{ categoryTitleOf(edge.a) }} ↔ {{ categoryTitleOf(edge.b) }}：{{ edge.weight }}
                条文档关联
              </title>
            </path>
          </g>

          <g class="nodes">
            <g
              v-for="category in categoryViews"
              :key="category.dir"
              class="category-node"
              :class="{
                active: category.dir === selectedDir,
                dimmed: Boolean(selectedDir) && !relatedDirs.has(category.dir),
              }"
              role="button"
              tabindex="0"
              :aria-label="`${category.title}，${category.count} 篇文档`"
              @click="selectCategory(category.dir)"
              @keydown.enter.prevent="selectCategory(category.dir)"
              @keydown.space.prevent="selectCategory(category.dir)"
            >
              <circle
                :cx="category.x"
                :cy="category.y"
                :r="category.radius"
                :fill="category.color"
                fill-opacity="0.18"
                :stroke="category.color"
                stroke-width="1.6"
              />
              <text
                :x="category.labelX"
                :y="category.labelY"
                :text-anchor="category.anchor"
                dominant-baseline="middle"
                class="category-label"
              >
                {{ category.label }}
              </text>
              <text
                :x="category.x"
                :y="category.y"
                text-anchor="middle"
                dominant-baseline="middle"
                class="category-count"
              >
                {{ category.count }}
              </text>
              <title>{{ category.title }}：{{ category.count }} 篇</title>
            </g>
          </g>
        </svg>
        <p class="hint">
          线宽 = 两个分类之间的文档关联数；节点大小 = 分类文档数。点击分类查看文档，窄屏可左右滑动。
        </p>
      </section>

      <aside
        ref="panelRef"
        class="panel"
      >
        <template v-if="selected">
          <div class="panel-head">
            <div>
              <p class="panel-eyebrow">{{ selected.title }}</p>
              <h2>{{ selected.count }} 篇文档</h2>
            </div>
            <button
              type="button"
              class="reset"
              @click="clearSelection"
            >
              查看全部分类
            </button>
          </div>

          <ul class="doc-list">
            <li
              v-for="doc in selectedDocs"
              :key="doc.id"
              :class="{ focused: doc.id === focusedDoc }"
            >
              <RouterLink
                class="doc-title"
                :to="`/doc/${doc.id}`"
                >{{ docLabel(doc.title) }}</RouterLink
              >
              <span class="doc-meta">{{ doc.degree }} 条关联</span>
              <span
                v-if="doc.concepts.length"
                class="doc-concepts"
                >{{ doc.concepts.join(' / ') }}</span
              >
            </li>
          </ul>
        </template>

        <template v-else>
          <h2>分类</h2>
          <p class="panel-hint">点击分类查看文档；也可以直接按分类进入。</p>

          <ul class="category-list">
            <li
              v-for="category in categoryViews"
              :key="category.dir"
            >
              <button
                type="button"
                class="category-item"
                @click="selectCategory(category.dir)"
              >
                <span
                  class="dot"
                  :style="{ background: category.color }"
                ></span>
                <span class="category-name">{{ category.title }}</span>
                <span class="category-count">{{ category.count }}</span>
              </button>
            </li>
          </ul>

          <div class="isolated">
            <h3>未关联文档</h3>
            <p v-if="isolated.length === 0">当前 {{ docCount }} 篇文档都至少有一条关联。</p>
            <ul v-else>
              <li
                v-for="id in isolated"
                :key="id"
              >
                <RouterLink :to="`/doc/${id}`">{{ docLabel(nodeTitle(id)) }}</RouterLink>
              </li>
            </ul>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useKnowledgeGraph } from '../composables/useKnowledgeGraph'
import type { KnowledgeGraphCategory, KnowledgeGraphNode } from '../types/knowledge-graph'
import { categoryColor, categoryLabel, docLabel } from '../utils/graph-label'

const CENTER = { x: 450, y: 310 }
const RADIUS = 215

interface CategoryView extends KnowledgeGraphCategory {
  index: number
  color: string
  x: number
  y: number
  radius: number
  label: string
  labelX: number
  labelY: number
  anchor: string
}

interface CategoryEdgeView {
  key: string
  a: string
  b: string
  weight: number
  path: string
  width: number
}

interface DocViewItem extends KnowledgeGraphNode {
  degree: number
  concepts: string[]
}

const route = useRoute()
const { graph, error } = useKnowledgeGraph()

const selectedDir = ref('')
const focusedDoc = ref('')
const panelRef = ref<HTMLElement | null>(null)

const stats = computed(() => graph.value?.stats ?? null)
const isolated = computed(() => graph.value?.isolated ?? [])
const docCount = computed(() => graph.value?.stats.docs ?? 0)

const categoryViews = computed<CategoryView[]>(() => {
  const data = graph.value
  if (!data) return []

  const total = data.categories.length
  return data.categories.map((category, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / total
    const x = CENTER.x + RADIUS * Math.cos(angle)
    const y = CENTER.y + RADIUS * Math.sin(angle)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const radius = 10 + Math.sqrt(category.count) * 1.4
    return {
      ...category,
      index,
      color: categoryColor(index),
      x,
      y,
      radius,
      label: categoryLabel(category.title),
      labelX: x + cos * (radius + 16),
      labelY: y + sin * (radius + 16),
      anchor: cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle',
    }
  })
})

const categoryMap = computed(() => new Map(categoryViews.value.map((item) => [item.dir, item])))

const categoryEdges = computed<CategoryEdgeView[]>(() => {
  const data = graph.value
  if (!data) return []

  const dirByDoc = new Map(data.nodes.map((node) => [node.id, node.category]))
  const pairs = new Map<string, { a: string; b: string; weight: number }>()

  for (const edge of data.edges) {
    const leftDir = dirByDoc.get(edge.a)
    const rightDir = dirByDoc.get(edge.b)
    if (!leftDir || !rightDir || leftDir === rightDir) continue

    const [a, b] = leftDir < rightDir ? [leftDir, rightDir] : [rightDir, leftDir]
    const key = `${a}|${b}`
    const item = pairs.get(key) ?? { a, b, weight: 0 }
    item.weight += 1
    pairs.set(key, item)
  }

  const result: CategoryEdgeView[] = []
  for (const item of pairs.values()) {
    const aNode = categoryMap.value.get(item.a)
    const bNode = categoryMap.value.get(item.b)
    if (!aNode || !bNode) continue

    const dx = bNode.x - aNode.x
    const dy = bNode.y - aNode.y
    const length = Math.hypot(dx, dy) || 1
    const offset = Math.min(42, length * 0.12)
    const cx = (aNode.x + bNode.x) / 2 - (dy / length) * offset
    const cy = (aNode.y + bNode.y) / 2 + (dx / length) * offset

    result.push({
      key: `${item.a}|${item.b}`,
      a: item.a,
      b: item.b,
      weight: item.weight,
      path: `M ${aNode.x} ${aNode.y} Q ${cx} ${cy} ${bNode.x} ${bNode.y}`,
      width: 1 + Math.min(item.weight, 10) * 0.35,
    })
  }

  return result
})

const relatedDirs = computed(() => {
  const dirs = new Set<string>()
  if (!selectedDir.value) return dirs

  dirs.add(selectedDir.value)
  for (const edge of categoryEdges.value) {
    if (edge.a === selectedDir.value) dirs.add(edge.b)
    if (edge.b === selectedDir.value) dirs.add(edge.a)
  }
  return dirs
})

const selected = computed(
  () => graph.value?.categories.find((category) => category.dir === selectedDir.value) ?? null,
)

const selectedDocs = computed<DocViewItem[]>(() => {
  const data = graph.value
  if (!data || !selectedDir.value) return []

  return data.nodes
    .filter((node) => node.category === selectedDir.value)
    .map((node) => {
      const incident = data.edges.filter((edge) => edge.a === node.id || edge.b === node.id)
      const concepts = new Set<string>()
      for (const edge of incident) {
        for (const concept of edge.concepts) concepts.add(concept)
      }
      return { ...node, degree: incident.length, concepts: [...concepts].slice(0, 3) }
    })
    .sort((a, b) => b.degree - a.degree || a.title.localeCompare(b.title))
})

const categoryTitleOf = (dir: string) =>
  graph.value?.categories.find((category) => category.dir === dir)?.title ?? dir

const nodeTitle = (id: string) => graph.value?.nodes.find((node) => node.id === id)?.title ?? id

const isEdgeActive = (edge: CategoryEdgeView) =>
  Boolean(selectedDir.value) && (edge.a === selectedDir.value || edge.b === selectedDir.value)

const selectCategory = (dir: string) => {
  selectedDir.value = selectedDir.value === dir ? '' : dir
  focusedDoc.value = ''
}

const clearSelection = () => {
  selectedDir.value = ''
  focusedDoc.value = ''
}

const scrollToFocused = async () => {
  await nextTick()
  panelRef.value
    ?.querySelector<HTMLElement>('.doc-list li.focused')
    ?.scrollIntoView({ block: 'center', inline: 'nearest' })
}

const applyQuery = () => {
  const data = graph.value
  if (!data) return

  const focus = Array.isArray(route.query.focus) ? route.query.focus[0] : route.query.focus
  if (focus) {
    const node = data.nodes.find((item) => item.id === focus)
    if (node) {
      selectedDir.value = node.category
      focusedDoc.value = node.id
      void scrollToFocused()
      return
    }
  }

  const category = Array.isArray(route.query.category)
    ? route.query.category[0]
    : route.query.category
  if (category && data.categories.some((item) => item.dir === category)) {
    selectedDir.value = category
    focusedDoc.value = ''
  }
}

watch([graph, () => route.query.focus, () => route.query.category], applyQuery, {
  immediate: true,
})
</script>

<style scoped>
.graph-page {
  max-width: 1180px;
  margin: 0 auto;
  padding-bottom: 48px;
  text-align: left;
}

/* ---------- 页头 ---------- */
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px 32px;
  padding: 16px 0 24px;
  border-bottom: 1px solid var(--border);
}

.hero-copy {
  max-width: 680px;
}

.eyebrow {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.12em;
  color: var(--accent);
}

.hero h1 {
  margin: 10px 0 12px;
  font-size: clamp(26px, 3.5vw, 34px);
  line-height: 1.25;
  letter-spacing: -0.5px;
}

.lead {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin: 0;
}

.stat {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
}

.stat dt {
  font-size: 12px;
  color: var(--text);
}

.stat dd {
  margin: 0;
  font-family: var(--mono);
  font-size: 22px;
  color: var(--text-h);
}

/* ---------- 主布局 ---------- */
.graph-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.8fr);
  gap: 20px;
  margin-top: 20px;
}

.canvas-wrap,
.panel {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.canvas-wrap {
  padding: 10px;
  overflow-x: auto;
}

.canvas-wrap svg {
  display: block;
  width: 100%;
  min-width: 600px;
  height: auto;
}

.hint {
  margin: 8px 4px 0;
  font-size: 12px;
  color: var(--text);
  opacity: 0.7;
}

/* ---------- 分类图 ---------- */
.category-edge {
  fill: none;
  stroke: var(--accent);
  stroke-opacity: 0.16;
  transition: stroke-opacity 0.2s;
}

.category-edge.active {
  stroke-opacity: 0.55;
}

.category-edge.dimmed {
  stroke-opacity: 0.05;
}

.category-node {
  cursor: pointer;
  outline: none;
  transition: opacity 0.2s;
}

.category-node circle {
  transition:
    fill-opacity 0.2s,
    stroke-width 0.2s;
}

.category-node:hover circle,
.category-node:focus-visible circle {
  fill-opacity: 0.32;
  stroke-width: 2.4;
}

.category-node.active circle {
  fill-opacity: 0.4;
  stroke-width: 3;
}

.category-node.dimmed {
  opacity: 0.28;
}

.category-label {
  fill: var(--text-h);
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
}

.category-count {
  fill: var(--text-h);
  font-size: 13px;
  pointer-events: none;
}

/* ---------- 右侧面板 ---------- */
.panel {
  padding: 16px;
}

.panel h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-h);
}

.panel-hint {
  margin: 4px 0 12px;
  font-size: 13px;
  color: var(--text);
  opacity: 0.75;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.reset {
  flex: none;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.reset:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 520px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.doc-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 8px;
  padding: 8px 10px;
  border-radius: 8px;
}

.doc-list li:hover,
.doc-list li.focused {
  background: var(--accent-bg);
}

.doc-title {
  overflow: hidden;
  font-size: 14px;
  color: var(--text-h);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-title:hover {
  color: var(--accent);
}

.doc-meta {
  font-size: 12px;
  color: var(--accent);
  white-space: nowrap;
}

.doc-concepts {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--text);
  opacity: 0.65;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text-h);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.category-item:hover {
  background: var(--accent-bg);
}

.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.category-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-count {
  flex: none;
  font-size: 12px;
  color: var(--text);
  opacity: 0.65;
}

.isolated {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px dashed var(--border);
}

.isolated h3 {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--text-h);
}

.isolated p,
.isolated li {
  font-size: 13px;
  color: var(--text);
}

.isolated ul {
  margin: 0;
  padding-left: 18px;
}

.isolated a {
  color: var(--accent);
}

.state {
  margin: 24px 0;
  font-size: 14px;
  color: var(--text);
  opacity: 0.75;
}

@media (max-width: 1200px) {
  .graph-layout {
    grid-template-columns: 1fr;
  }

  .doc-list {
    max-height: none;
  }
}

@media (max-width: 640px) {
  .stats {
    gap: 14px;
  }

  .stat dd {
    font-size: 19px;
  }
}
</style>
