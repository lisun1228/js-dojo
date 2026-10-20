<template>
  <DemoPanel
    :logs="logs"
    hint="v-focus 自动聚焦、v-debounce:600 点击防抖、v-click-outside 点击外部关闭；指令都定义在本组件的 script setup 里。"
    @clear="clear"
  >
    <button
      class="run"
      @click="toggleInput"
    >
      {{ inputVisible ? '卸载输入框' : '重新挂载输入框' }}
    </button>

    <template #body>
      <div class="row">
        <label for="directive-focus">v-focus：</label>
        <input
          v-if="inputVisible"
          id="directive-focus"
          v-focus
          class="field"
          placeholder="挂载后自动聚焦"
        />
        <span
          v-else
          class="muted"
        >
          输入框已卸载
        </span>
      </div>

      <div class="row">
        <button
          v-debounce:600="onDebouncedClick"
          class="btn"
          @click="rawClicks += 1"
        >
          连点我：600ms 内只执行最后一次
        </button>
        <span class="muted">原始点击 {{ rawClicks }} 次 / 实际执行 {{ debouncedClicks }} 次</span>
      </div>

      <div class="row">
        <button
          v-if="!floatVisible"
          class="btn"
          @click="openFloat"
        >
          打开浮层
        </button>
        <span
          v-else
          class="muted"
        >
          点浮层外面关闭它
        </span>
      </div>

      <div
        v-if="floatVisible"
        v-click-outside="closeFloat"
        class="float"
      >
        我是浮层，点外面关闭
      </div>
    </template>
  </DemoPanel>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DirectiveBinding } from 'vue'
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

const inputVisible = ref(true)
const floatVisible = ref(false)
const rawClicks = ref(0)
const debouncedClicks = ref(0)

/** v-focus：元素挂载后自动聚焦 */
const vFocus = {
  mounted(el: HTMLInputElement) {
    el.focus()
    push('v-focus mounted → el.focus()')
  },
  unmounted() {
    push('v-focus unmounted → 输入框已卸载')
  },
}

/** v-debounce:600="fn"：冒号后是延迟毫秒数，值是要执行的回调 */
const vDebounce = {
  mounted(el: HTMLElement, binding: DirectiveBinding<() => void>) {
    let timer: number | undefined
    const delay = binding.arg ? Number(binding.arg) : 300
    const handler = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => binding.value?.(), delay)
    }
    ;(el as HTMLElement & { __debounce?: () => void }).__debounce = handler
    el.addEventListener('click', handler)
  },
  unmounted(el: HTMLElement & { __debounce?: () => void }) {
    if (el.__debounce) el.removeEventListener('click', el.__debounce)
    delete el.__debounce
  },
}

/** v-click-outside="fn"：点击元素外部时回调 */
const vClickOutside = {
  mounted(el: HTMLElement, binding: DirectiveBinding<() => void>) {
    const handler = (event: MouseEvent) => {
      if (!el.contains(event.target as Node)) binding.value()
    }
    ;(el as HTMLElement & { __clickOutside?: (event: MouseEvent) => void }).__clickOutside = handler
    document.addEventListener('click', handler, true)
  },
  unmounted(el: HTMLElement & { __clickOutside?: (event: MouseEvent) => void }) {
    if (el.__clickOutside) document.removeEventListener('click', el.__clickOutside, true)
    delete el.__clickOutside
  },
}

const toggleInput = () => {
  inputVisible.value = !inputVisible.value
}

const onDebouncedClick = () => {
  debouncedClicks.value += 1
  push(`v-debounce 执行第 ${debouncedClicks.value} 次（原始点击 ${rawClicks.value} 次）`)
}

const openFloat = () => {
  floatVisible.value = true
  push('浮层已打开，v-click-outside 开始监听')
}

const closeFloat = () => {
  floatVisible.value = false
  push('v-click-outside 触发 → 浮层已关闭')
}
</script>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--text-h);
}

.field {
  padding: 5px 10px;
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text-h);
  font-size: 13px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--code-bg);
  color: var(--text-h);
  font-size: 13px;
  cursor: pointer;
}

.muted {
  font-size: 13px;
  opacity: 0.75;
}

.float {
  margin-top: 4px;
  padding: 12px 16px;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 13px;
}
</style>
