<template>
  <Transition name="back-to-top">
    <button
      v-if="visible"
      class="back-to-top"
      type="button"
      aria-label="回到顶部"
      title="回到顶部"
      @click="scrollToTop"
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 回到顶部按钮。
 * 页面整体高度由内容撑开，实际滚动发生在 window 上，
 * 所以监听 window.scrollY，超过阈值后出现。
 */
const THRESHOLD = 320

const visible = ref(false)

const onScroll = () => {
  visible.value = window.scrollY > THRESHOLD
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

const scrollToTop = () => {
  // 尊重系统的「减少动态效果」设置
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior: 'auto' | 'smooth' = reduceMotion ? 'auto' : 'smooth'

  window.scrollTo({ top: 0, behavior })
}
</script>

<style scoped>
.back-to-top {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  padding: 0;
  border: 1px solid var(--accent-border);
  border-radius: 50%;
  background: var(--bg);
  color: var(--accent);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* 外圈光晕：悬停时扩散一圈，呼应主题色 */
.back-to-top::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  background: var(--accent-bg);
  opacity: 0;
  transform: scale(0.85);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  pointer-events: none;
}

.back-to-top:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  transform: translateY(-3px);
  box-shadow: 0 12px 24px -10px var(--accent-border);
}

.back-to-top:hover::after {
  opacity: 1;
  transform: scale(1);
}

.back-to-top:active {
  transform: translateY(-1px) scale(0.96);
}

.back-to-top:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* 出现 / 消失 */
.back-to-top-enter-active,
.back-to-top-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.9);
}

@media (max-width: 640px) {
  .back-to-top {
    right: 16px;
    bottom: 18px;
    width: 42px;
    height: 42px;
  }
}
</style>
