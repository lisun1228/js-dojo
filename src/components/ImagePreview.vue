<template>
  <Teleport to="body">
    <div
      class="image-preview"
      role="dialog"
      aria-modal="true"
      :aria-label="alt || '图片预览'"
      @click="emit('close')"
    >
      <img
        class="image-preview__img"
        :src="src"
        :alt="alt"
      />
      <span class="image-preview__tip">点击任意位置或按 Esc 关闭</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

/**
 * 正文图片的全屏预览遮罩。
 * 由 MarkdownView 在点击正文图片时挂载，卸载即关闭。
 */
withDefaults(defineProps<{ src: string; alt?: string }>(), { alt: '' })

const emit = defineEmits<{ close: [] }>()

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

// 预览期间锁住页面滚动，关闭后还原，避免背景跟着滚
let prevOverflow = ''

onMounted(() => {
  prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.body.style.overflow = prevOverflow
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.image-preview {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  background: rgba(8, 6, 13, 0.82);
  cursor: zoom-out;
  animation: preview-in 0.18s ease;
}

.image-preview__img {
  max-width: 94vw;
  max-height: 84vh;
  border-radius: 8px;
  /* 示意图多为透明或浅色底，垫一层背景保证在深色遮罩上可读 */
  background: var(--bg);
  box-shadow: var(--shadow);
}

.image-preview__tip {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

@keyframes preview-in {
  from {
    opacity: 0;
  }
}
</style>
