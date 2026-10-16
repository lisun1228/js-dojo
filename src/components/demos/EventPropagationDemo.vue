<template>
  <DemoPanel
    :logs="logs"
    hint="先选择一种拦截方式，再点击下方嵌套区域里的「child」，观察日志顺序。"
    @clear="clear"
  >
    <button
      v-for="m in modes"
      :key="m.value"
      class="run"
      @click="mode = m.value"
    >
      {{ m.label }}{{ mode === m.value ? '（当前）' : '' }}
    </button>

    <template #body>
      <div
        ref="parentEl"
        class="node parent"
      >
        parent（冒泡监听）
        <div
          ref="childEl"
          class="node child"
        >
          child（点我）
        </div>
      </div>
    </template>
  </DemoPanel>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

type Mode = 'none' | 'stop' | 'immediate'

const mode = ref<Mode>('none')
const modes: { value: Mode; label: string }[] = [
  { value: 'none', label: '不拦截' },
  { value: 'stop', label: 'stopPropagation' },
  { value: 'immediate', label: 'stopImmediatePropagation' },
]

const parentEl = ref<HTMLElement>()
const childEl = ref<HTMLElement>()

onMounted(() => {
  const parent = parentEl.value!
  const child = childEl.value!

  // 父元素：冒泡阶段
  parent.addEventListener('click', () => push('parent 冒泡'))

  // 子元素：捕获阶段
  child.addEventListener('click', () => push('child 捕获'), true)

  // 子元素：冒泡阶段的第一个监听（在这里决定拦截方式）
  child.addEventListener('click', (e) => {
    push('child 冒泡 #1')
    if (mode.value === 'stop') e.stopPropagation()
    if (mode.value === 'immediate') e.stopImmediatePropagation()
  })

  // 子元素：冒泡阶段的第二个监听
  child.addEventListener('click', () => push('child 冒泡 #2'))
})
</script>

<style scoped>
.node {
  padding: 10px 12px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-h);
}

.parent {
  display: inline-block;
  background: var(--code-bg);
}

.child {
  margin-top: 10px;
  padding: 14px 24px;
  border-color: var(--accent-border);
  background: var(--accent-bg);
  text-align: center;
  cursor: pointer;
  user-select: none;
}
</style>
