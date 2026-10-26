<template>
  <article
    v-if="content !== undefined"
    class="doc"
  >
    <!-- 正文：来自 src/docs/<分类目录>/<id>.md，路由守卫已完成加载 -->
    <MarkdownView :content="content" />
    <!-- 交互演示：来自 src/components/demos/<demo>.vue -->
    <component
      :is="meta?.demoComponent"
      v-if="meta?.demoComponent"
    />
    <!-- 关联知识：与 /graph 共用同一份构建期图谱数据 -->
    <RelatedKnowledge :doc-id="id" />
  </article>

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
import MarkdownView from '../components/MarkdownView.vue'
import RelatedKnowledge from '../components/RelatedKnowledge.vue'
import { getDocContent, getDocMeta, loadDocContent } from '../docs'
import { hashTarget } from '../utils/hash'

const props = defineProps<{ id: string }>()

const route = useRoute()
const meta = computed(() => getDocMeta(props.id))
const content = ref<string>()

// 正常导航时路由守卫已把正文加载进缓存，这里同步取到；
// 守卫未命中（如直接挂载）时再兜底加载一次
watch(
  () => props.id,
  async (id) => {
    content.value = getDocContent(id)
    if (content.value !== undefined) return

    const loaded = await loadDocContent(id).catch(() => undefined)
    // 等待期间可能已经切到另一篇，丢弃过期结果
    if (id === props.id) content.value = loaded
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
.doc {
  text-align: left;
}

.missing {
  text-align: left;
  color: var(--text);
}
</style>
