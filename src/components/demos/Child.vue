<template>
  <div class="child-wrap">
    <h3>子组件 Child</h3>

    <!-- 1. $props：当前组件已经声明的 props -->
    <p>【$props】name = {{ $props.name }}，age = {{ $props.age }}</p>

    <!-- 2. $attrs：父组件传了、但这里没有声明的属性（inheritAttrs 默认 true，会自动透传到根元素） -->
    <p>【$attrs】{{ $attrs }}</p>

    <!-- 3. $slots：判断父组件有没有传入插槽 -->
    <div v-if="$slots.default" class="slot-box">
      默认插槽：<slot />
    </div>
    <div v-if="$slots.header" class="slot-box">
      具名 header 插槽：<slot name="header" />
    </div>
    <p v-if="!$slots.default && !$slots.header">父组件没有传入插槽</p>

    <!-- 4. 模板 ref：ref 拿到的是 DOM 元素本身，读它的值需要自己同步 -->
    <input ref="inputEl" placeholder="在这里输入" @input="readValue" />
    <p>【模板 ref】tagName = {{ inputEl?.tagName }}，value = {{ inputValue }}</p>

    <!-- 5. 自定义事件：一次 emit 三个参数，用来观察父组件能拿到什么 -->
    <button @click="handleEmit">emit 三个参数</button>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

// 声明 props，会进入 $props
defineProps<{ name: string; age: number }>()

// 声明自定义事件，并按顺序标注参数类型
const emit = defineEmits<{
  'update:name': [name: string, count: number, flag: boolean]
}>()

// 模板 ref（Vue 3.5+ 推荐写法），变量名与模板里的 ref="inputEl" 对应
const inputEl = useTemplateRef<HTMLInputElement>('inputEl')

// ref 指向的是普通 DOM 元素，读值 / 改值不会自动触发更新，需要自己同步
const inputValue = ref('')
const readValue = () => {
  inputValue.value = inputEl.value?.value ?? ''
}

const handleEmit = () => {
  emit('update:name', '新名字', 99, true)
}
</script>

<style scoped>
.child-wrap {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px dashed var(--accent-border);
  border-radius: 8px;
}

.child-wrap h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-h);
}

.child-wrap p {
  margin: 0 0 6px;
  font-size: 13px;
}

.slot-box {
  margin: 0 0 6px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--accent-bg);
  font-size: 13px;
}

.child-wrap input {
  margin-top: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text-h);
  font-size: 13px;
}
</style>
