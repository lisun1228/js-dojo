<template>
  <Transition name="ai-search">
    <div
      v-if="visible"
      ref="panelRef"
      class="ai-search"
      :class="{ 'is-bottom': placement === 'bottom' }"
      :style="{ left: `${x}px`, top: `${y}px` }"
      role="group"
      aria-label="复制选中内容并打开 AI 对话"
    >
      <button
        v-for="provider in providers"
        :key="provider.id"
        type="button"
        class="ai-search__item"
        :title="`复制选中内容并打开${provider.name}`"
        :aria-label="`复制选中内容并打开${provider.name}`"
        @click="search(provider)"
      >
        {{ provider.name }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { aiSearchProviders as providers, type AiSearchProvider } from '../config/ai-search'

/**
 * 划词 AI 搜索。
 * 监听全文选区，选中正文文字后浮出入口，点击复制选中内容并在新标签页打开对应 AI 对话页。
 * 正文由 v-html 渲染，无法逐节点绑定事件，所以在 document 上做全局监听。
 * 站点清单见 src/config/ai-search.ts。
 */
// 正文主区域（App.vue 的 <main class="content">），侧边栏与页头不触发
const CONTENT_SELECTOR = '.content'
// 复制文字上限，过长选区没必要整段带过去
const MAX_LENGTH = 500
// 选区与浮层之间的垂直间距
const OFFSET = 10
// 选区内文字变化后稍等一下再定位，避免拖拽过程中浮层乱跳
const DEBOUNCE = 120
// 浮层与视口左右边缘的最小留白
const EDGE_GAP = 8

const visible = ref(false)
const x = ref(0)
const y = ref(0)
const placement = ref<'top' | 'bottom'>('top')
const selectedText = ref('')
const panelRef = ref<HTMLElement | null>(null)

// 选区中心的横坐标，夹紧视口时基于它计算
let anchorX = 0
let dragging = false
let timer: number | undefined

const clearTimer = () => {
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timer = undefined
  }
}

const hide = () => {
  clearTimer()
  visible.value = false
}

const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim()

// 浮层宽度随站点数量变化，按实测宽度把中心点夹在视口内
const position = () => {
  const halfWidth = (panelRef.value?.offsetWidth ?? 240) / 2
  const min = halfWidth + EDGE_GAP
  const max = window.innerWidth - halfWidth - EDGE_GAP
  x.value = max > min ? Math.min(Math.max(anchorX, min), max) : window.innerWidth / 2
}

const update = () => {
  timer = undefined
  if (dragging) return

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    hide()
    return
  }

  const text = normalizeText(selection.toString())
  if (!text) {
    hide()
    return
  }

  // 只对正文区域内的选区生效，侧边栏、页头等界面文字不打扰
  const content = document.querySelector(CONTENT_SELECTOR)
  const range = selection.getRangeAt(0)
  const anchor = range.commonAncestorContainer
  const anchorElement = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement
  if (!content || !anchorElement || !content.contains(anchorElement)) {
    hide()
    return
  }

  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) {
    hide()
    return
  }

  selectedText.value = text.slice(0, MAX_LENGTH)
  anchorX = rect.left + rect.width / 2

  // 上方空间不够时改到选区下方展示
  const isTop = rect.top > 64
  placement.value = isTop ? 'top' : 'bottom'
  y.value = isTop ? rect.top - OFFSET : rect.bottom + OFFSET

  visible.value = true
  position()
  // 首次渲染后拿到真实宽度，再夹紧一次
  nextTick(position)
}

const schedule = () => {
  clearTimer()
  timer = window.setTimeout(update, DEBOUNCE)
}

const onPointerDown = (event: PointerEvent) => {
  const target = event.target
  // 点在浮层自身上时不清掉选区，也不移动浮层
  if (target instanceof Node && panelRef.value?.contains(target)) return
  dragging = true
  hide()
}

const onPointerUp = () => {
  dragging = false
  schedule()
}

const onSelectionChange = () => {
  if (dragging) return
  schedule()
}

// 滚动 / 缩放后选区坐标已失效，直接收起
const onViewportChange = () => {
  if (visible.value) hide()
}

// 兜底复制：剪贴板 API 在非 https 环境下不可用
const legacyCopy = (text: string) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.cssText = 'position: fixed; top: -9999px; opacity: 0;'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  document.execCommand('copy')
  textarea.remove()
}

const copyText = (text: string) => {
  if (!navigator.clipboard?.writeText) {
    legacyCopy(text)
    return
  }
  navigator.clipboard.writeText(text).catch(() => legacyCopy(text))
}

const search = (provider: AiSearchProvider) => {
  const text = selectedText.value
  hide()
  if (!text) return
  // 先发起复制再开新页：两步都落在同一次点击的激活期内，弹窗和剪贴板才不会被拦
  copyText(text)
  window.open(provider.url, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('selectionchange', onSelectionChange)
  // 捕获阶段监听，正文容器内部滚动也能收到
  window.addEventListener('scroll', onViewportChange, { capture: true, passive: true })
  window.addEventListener('resize', onViewportChange)
})

onBeforeUnmount(() => {
  clearTimer()
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('selectionchange', onSelectionChange)
  window.removeEventListener('scroll', onViewportChange, { capture: true })
  window.removeEventListener('resize', onViewportChange)
})
</script>

<style scoped>
.ai-search {
  position: fixed;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  background: var(--bg);
  box-shadow: var(--shadow);
  /* 默认放在选区上方，水平居中于选区 */
  transform: translate(-50%, -100%);
}

/* 上方空间不足时改放在选区下方 */
.ai-search.is-bottom {
  transform: translate(-50%, 0);
}

.ai-search__item {
  padding: 6px 10px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.ai-search__item:hover {
  background: var(--accent);
  color: #fff;
}

.ai-search__item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.ai-search-enter-active,
.ai-search-leave-active {
  transition: opacity 0.15s ease;
}

.ai-search-enter-from,
.ai-search-leave-to {
  opacity: 0;
}
</style>
