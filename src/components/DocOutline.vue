<template>
  <aside
    v-if="show"
    class="doc-outline"
    aria-label="本页大纲"
  >
    <p class="outline-title">本页目录</p>
    <ul>
      <li
        v-for="item in items"
        :key="item.id"
      >
        <a
          :href="`#${item.id}`"
          :class="{ active: item.id === activeId }"
          :aria-current="item.id === activeId ? 'location' : undefined"
          @click="jump($event, item.id)"
        >
          {{ item.label }}
        </a>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { slugify } from '../utils/slugify'

/**
 * 右侧常驻大纲。
 * 只在长文里出现，滚动时高亮当前小节；锚点复用 slugify，
 * 与正文目录、搜索结果跳转使用同一套 id。
 */
const props = defineProps<{ content: string }>()

// 短于这个长度的文档，顶部目录够用，不再占右侧空间
const MIN_LENGTH = 8000
// 判定「当前小节」时标题距视口顶部的阈值
const TOP_OFFSET = 96

interface OutlineItem {
  id: string
  label: string
}

const items = computed<OutlineItem[]>(() => {
  const list: OutlineItem[] = []
  const seen = new Set<string>()
  let inFence = false

  for (const line of props.content.split('\n')) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (!match) continue

    const raw = match[1]
    const label = raw
      .replace(/`/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .trim()
    if (label === '目录') continue

    const id = slugify(raw)
    if (!id || seen.has(id)) continue
    seen.add(id)
    list.push({ id, label })
  }

  return list
})

const show = computed(() => props.content.length >= MIN_LENGTH && items.value.length >= 3)

const activeId = ref('')
let frame = 0

const updateActive = () => {
  frame = 0
  const headings = items.value
    .map((item) => document.getElementById(item.id))
    .filter((element): element is HTMLElement => Boolean(element))
  if (!headings.length) {
    activeId.value = ''
    return
  }

  let current = headings[0].id
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top > TOP_OFFSET) break
    current = heading.id
  }
  activeId.value = current
}

const onScroll = () => {
  if (frame) return
  frame = window.requestAnimationFrame(updateActive)
}

const jump = (event: MouseEvent, id: string) => {
  const target = document.getElementById(id)
  if (!target) return

  event.preventDefault()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
  window.history.replaceState(null, '', `#${id}`)
  activeId.value = id
}

watch(
  [items, show],
  () => {
    void nextTick(updateActive)
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  void nextTick(updateActive)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (frame) window.cancelAnimationFrame(frame)
})
</script>

<style scoped>
.doc-outline {
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 40px);
  padding-left: 16px;
  overflow-y: auto;
  border-left: 1px solid var(--border);
}

.outline-title {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--text);
  opacity: 0.65;
}

ul {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

a {
  display: block;
  padding: 4px 0 4px 8px;
  border-left: 2px solid transparent;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
  text-decoration: none;
  transition:
    color 0.2s,
    border-color 0.2s;
}

a:hover {
  color: var(--accent);
}

a.active {
  border-left-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}

a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

/* 窄屏不占正文宽度，也不在文末多出一块无用的目录 */
@media (max-width: 1279px) {
  .doc-outline {
    display: none;
  }
}
</style>
