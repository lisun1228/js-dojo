<template>
  <section class="demo">
    <h3>{{ title }}</h3>
    <p v-if="hint" class="hint">{{ hint }}</p>

    <!-- 演示按钮由各教程组件通过默认插槽传入 -->
    <div class="buttons">
      <slot />
    </div>

    <!-- 需要可视化交互的场景（如可点击的 DOM 结构）放在 body 插槽 -->
    <div v-if="$slots.body" class="body">
      <slot name="body" />
    </div>

    <div class="panel-head">
      <span>运行日志</span>
      <button class="clear" @click="emit('clear')">清空</button>
    </div>

    <ul v-if="logs.length" class="logs">
      <li v-for="(line, i) in logs" :key="i">{{ line }}</li>
    </ul>
    <p v-else class="empty">暂无输出。</p>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ logs: string[]; title?: string; hint?: string }>(), {
  title: '交互演示',
  hint: '',
})

const emit = defineEmits<{ clear: [] }>()
</script>

<style scoped>
.demo {
  margin-top: 28px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  text-align: left;
}

.demo h3 {
  margin: 0 0 6px;
  font-size: 17px;
  color: var(--text-h);
}

.hint {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text);
  opacity: 0.8;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

/* 插槽内容属于父组件作用域，用 :slotted 统一按钮样式 */
.buttons :slotted(.run) {
  padding: 6px 14px;
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.buttons :slotted(.run:hover) {
  opacity: 0.8;
}

.body {
  margin-bottom: 16px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-h);
}

.clear {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.logs {
  margin: 10px 0 0;
  padding: 10px 12px;
  list-style: none;
  border-radius: 8px;
  background: var(--code-bg);
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.empty {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--text);
  opacity: 0.7;
}
</style>
