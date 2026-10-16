<template>
  <DemoPanel
    :logs="logs"
    hint="在下方子组件里输入、点按钮，观察 $props / $attrs / 插槽 / 事件参数的不同。"
    @clear="clear"
  >
    <button
      class="run"
      @click="resetName"
    >
      重置父组件 name
    </button>
    <button
      class="run"
      @click="handleNativeClick($event)"
    >
      运行：原生事件 $event
    </button>

    <template #body>
      <p class="parent-line">
        父组件 name：<b>{{ parentName }}</b>
      </p>

      <!--
        传给子组件：
        :name :age        → 子组件 defineProps 声明过 → 进入 $props
        data-test         → 没声明 → 进入 $attrs
        标签内的内容       → 默认插槽，#header 是具名插槽
      -->
      <Child
        :name="parentName"
        :age="20"
        data-test="testAttr"
        @update:name="onUpdateName"
      >
        我是父组件传入的默认插槽文本
        <template #header>我是具名 header 插槽</template>
      </Child>

      <!-- 第二个子组件：不传插槽，事件用 rest 参数接收全部 emit 参数 -->
      <Child
        :name="parentName"
        :age="20"
        data-test="testAttr"
        @update:name="handleWithAllArgs"
      />
    </template>
  </DemoPanel>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DemoPanel from './DemoPanel.vue'
import Child from './Child.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

const parentName = ref('张三')

const resetName = () => {
  parentName.value = '张三'
  push('父组件 name 已重置为「张三」')
}

/** 方法引用写法：emit 的所有参数会依次传进来 */
const onUpdateName = (name: string) => {
  push('【自定义事件 $event（仅第一个参数）】' + JSON.stringify(name))
  parentName.value = name
}

/** 用 rest 参数接收 emit 的全部参数 */
const handleWithAllArgs = (...args: unknown[]) => {
  push('【emit 全部参数】' + JSON.stringify(args))
}

/** 原生 DOM 事件：$event 是浏览器原生 Event 对象 */
const handleNativeClick = (event: Event) => {
  push('【原生事件 $event】target = ' + (event.target as HTMLElement).tagName)
}
</script>

<style scoped>
.parent-line {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--text-h);
}
</style>
