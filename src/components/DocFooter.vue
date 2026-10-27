<template>
  <footer class="doc-footer">
    <div class="footer-head">
      <p class="category">{{ categoryTitle }}</p>

      <div class="read-action">
        <button
          v-if="!read"
          type="button"
          class="mark"
          @click="progress.markRead(docId)"
        >
          标记已读
        </button>
        <template v-else>
          <span class="read-label">已读</span>
          <button
            type="button"
            class="unmark"
            @click="progress.unmarkRead(docId)"
          >
            取消
          </button>
        </template>
      </div>
    </div>

    <p
      v-if="!read && reachedEnd"
      class="read-hint"
    >
      已读到文末，标记一下方便下次继续。
    </p>

    <nav
      class="neighbors"
      aria-label="教程上下篇"
    >
      <RouterLink
        v-if="prev"
        class="neighbor"
        :to="tutorialPath(prev.id)"
      >
        <span class="direction">上一篇</span>
        <span class="title">{{ prev.title }}</span>
      </RouterLink>
      <span
        v-else
        class="neighbor placeholder"
        aria-hidden="true"
      ></span>

      <RouterLink
        v-if="next"
        class="neighbor next"
        :to="tutorialPath(next.id)"
      >
        <span class="direction">下一篇</span>
        <span class="title">{{ next.title }}</span>
      </RouterLink>
    </nav>
  </footer>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getCategoryOfTutorial, getTutorialNeighbors, tutorialPath } from '../router/tutorials'
import { useProgressStore } from '../stores/progress'

/**
 * 文末的「归属 + 已读 + 上下篇」。
 * 滚动到 90% 只提示，不自动写入；是否已读始终由读者确认。
 */
const props = defineProps<{ docId: string }>()

const progress = useProgressStore()
const read = computed(() => progress.isRead(props.docId))
const categoryTitle = computed(() => getCategoryOfTutorial(props.docId)?.title ?? '未分类')
const neighbors = computed(() => getTutorialNeighbors(props.docId))
const prev = computed(() => neighbors.value.prev)
const next = computed(() => neighbors.value.next)

const reachedEnd = ref(false)

const onScroll = () => {
  if (read.value || reachedEnd.value) return
  const total = document.documentElement.scrollHeight
  // 内容比视口还短时不算「读到底」，避免一进页面就提示
  if (total <= window.innerHeight + 200) return
  if ((window.scrollY + window.innerHeight) / total >= 0.9) reachedEnd.value = true
}

watch(
  () => props.docId,
  () => {
    reachedEnd.value = false
    void nextTick(onScroll)
  },
)

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  void nextTick(onScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.doc-footer {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.footer-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.category {
  margin: 0;
  font-size: 13px;
  color: var(--text);
  opacity: 0.75;
}

.read-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mark,
.unmark {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
}

.mark:hover,
.unmark:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

.read-label {
  font-size: 12px;
  color: var(--accent);
}

.read-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--accent);
}

.neighbors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.neighbor {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.neighbor:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.neighbor.next {
  text-align: right;
}

.neighbor.placeholder {
  border-color: transparent;
}

.direction {
  font-size: 12px;
  color: var(--text);
  opacity: 0.7;
}

.title {
  font-size: 14px;
  color: var(--text-h);
}

@media (max-width: 640px) {
  .neighbors {
    grid-template-columns: 1fr;
  }

  .neighbor.next {
    text-align: left;
  }
}
</style>
