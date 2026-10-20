<template>
  <div
    class="theme-switcher"
    role="group"
    aria-label="主题切换"
  >
    <span class="label">主题</span>
    <button
      v-for="item in themes"
      :key="item.id"
      type="button"
      class="swatch"
      :class="{ active: item.id === theme.id }"
      :style="{ '--swatch': item.color }"
      :title="item.label"
      :aria-label="item.label"
      :aria-pressed="item.id === theme.id"
      @click="store.setTheme(item.id)"
    ></button>
    <span class="current">{{ theme.label }}</span>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useThemeStore } from '../stores/theme'

const store = useThemeStore()
// 解构 store 会丢掉 computed 的响应性，必须走 storeToRefs
const { theme } = storeToRefs(store)
const themes = store.themes
</script>

<style scoped>
.theme-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  margin-right: 2px;
  font-size: 13px;
  color: var(--text);
  opacity: 0.75;
}

.swatch {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--swatch);
  cursor: pointer;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}

.swatch:hover {
  transform: scale(1.15);
}

/* 选中态：用背景色 + 主题色双环，避免和色块本身混在一起 */
.swatch.active {
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 4px var(--swatch);
}

.swatch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.current {
  min-width: 3.5em;
  font-size: 13px;
  color: var(--accent);
}
</style>
