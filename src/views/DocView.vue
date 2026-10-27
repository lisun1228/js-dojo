<template>
  <div
    v-if="content !== undefined"
    class="doc-layout"
  >
    <article class="doc">
      <!-- 正文：来自 src/docs/<分类目录>/<id>.md，路由守卫已完成加载 -->
      <MarkdownView :content="content" />
      <!-- 交互演示：来自 src/components/demos/<demo>.vue -->
      <component
        :is="meta?.demoComponent"
        v-if="meta?.demoComponent"
      />
      <!-- 关联知识：与 /graph 共用同一份构建期图谱数据 -->
      <RelatedKnowledge :doc-id="id" />
      <!-- 文末：分类归属、已读标记与上下篇 -->
      <DocFooter :doc-id="id" />
    </article>
    <!-- 长文右侧大纲，短文档不渲染 -->
    <DocOutline :content="content" />
  </div>

  <p
    v-else-if="!meta"
    class="missing"
  >
    未找到教程：{{ id }}
  </p>

  <p
    v-else
    class="missing"
  >
    正在加载教程…
  </p>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DocFooter from '../components/DocFooter.vue'
import DocOutline from '../components/DocOutline.vue'
import MarkdownView from '../components/MarkdownView.vue'
import RelatedKnowledge from '../components/RelatedKnowledge.vue'
import { getDocContent, getDocMeta, loadDocContent } from '../docs'
import { categories } from '../router/tutorials'
import { hashTarget } from '../utils/hash'

const props = defineProps<{ id: string }>()

const DESCRIPTION_LIMIT = 120

const route = useRoute()
const meta = computed(() => getDocMeta(props.id))
const content = ref<string>()

/** 标题由路由守卫统一设置，这里用正文首段补一条更具体的描述 */
const writeDocMeta = (id: string, markdown: string) => {
  const doc = getDocMeta(id)
  if (!doc) return

  document.title = `${doc.title} · JS 道场`

  const isSkippable = (line: string) =>
    line.startsWith('#') ||
    line.startsWith('>') ||
    line.startsWith('|') ||
    line.startsWith('!') ||
    line.startsWith('```') ||
    line.startsWith('~~~') ||
    // 构建期插入的 Mermaid SVG 也是正文的一部分，不能拿来当描述
    line.startsWith('<') ||
    /^-{3,}$/.test(line) ||
    /^[-*+]\s/.test(line) ||
    /^\*\*.*\*\*$/.test(line) ||
    /^\[.*\]\(#/.test(line) ||
    /^\d+\.\s*\[.*\]\(#/.test(line)

  const firstLine = markdown
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !isSkippable(line))

  const text = firstLine
    ?.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const category = categories.find((group) => group.dir === doc.dir)?.title
  const description = text
    ? text.slice(0, DESCRIPTION_LIMIT)
    : `${category ?? 'JS 道场'}：${doc.title}`

  document.querySelector('meta[name="description"]')?.setAttribute('content', description)
}

// 正常导航时路由守卫已把正文加载进缓存，这里同步取到；
// 守卫未命中（如直接挂载）时再兜底加载一次
watch(
  () => props.id,
  async (id) => {
    content.value = getDocContent(id)
    if (content.value !== undefined) {
      writeDocMeta(id, content.value)
      return
    }

    const loaded = await loadDocContent(id).catch(() => undefined)
    // 等待期间可能已经切到另一篇，丢弃过期结果
    if (id === props.id) {
      content.value = loaded
      if (loaded !== undefined) writeDocMeta(id, loaded)
    }
  },
  { immediate: true },
)

// 路由守则会先加载正文，但首屏直链时标题可能还没挂载：
// 等 MarkdownView 渲染完再定位一次，避免 /doc/xxx#anchor 落在顶部
watch(
  [content, () => route.hash],
  async () => {
    if (content.value === undefined || !route.hash) return
    await nextTick()
    hashTarget(route.hash)?.scrollIntoView({ block: 'start' })
  },
  { immediate: true },
)
</script>

<style scoped>
.doc-layout {
  text-align: left;
}

.doc {
  min-width: 0;
  text-align: left;
}

/* 只有长文渲染出大纲时，才让出右侧一列 */
@media (min-width: 1280px) {
  .doc-layout:has(.doc-outline) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 28px;
    align-items: start;
  }
}

.missing {
  text-align: left;
  color: var(--text);
}
</style>
