# Props、$attrs 与插槽

父子组件通信的基础：**props 传值**、**$attrs 透传**、**插槽分发内容**，以及配套的 **$emit / $event**。插槽的编译原理与完整语法见 `vue/slots.md`，本篇只保留 props 视角下的用法。

---

## 目录

- [1. 父传子：props](#1-父传子props)
- [2. `$props` 与 `$attrs` 的区别](#2-props-与-attrs-的区别)
- [3. 插槽](#3-插槽)
- [4. 事件：`$emit` 与 `$event`](#4-事件emit-与-event)
- [5. 顺带一提：模板 ref](#5-顺带一提模板-ref)
- [6. 常用实例属性速查](#6-常用实例属性速查)

---

## 1. 父传子：props

父组件用 `v-bind`（简写 `:`）传值，子组件用 `defineProps` 声明接收。`defineProps` 是编译宏：只能在 `<script setup>` 顶层使用，无需 import，编译后转成组件的 `props` 选项。

```vue
<!-- 子组件 Child.vue -->
<script setup>
defineProps(['name', 'age'])
</script>

<template>
  <p>props.name = {{ $props.name }}</p>
  <p>props.age = {{ $props.age }}</p>
</template>
```

```vue
<!-- 父组件 -->
<Child
  :name="parentName"
  :age="20"
/>
```

TypeScript 下用类型声明，需要默认值时用 `withDefaults`（两种写法二选一）：

```ts
defineProps<{ name: string; age: number }>()

withDefaults(defineProps<{ age?: number }>(), { age: 18 })
```

- **单向数据流**：子组件不直接改 props；开发环境下 `setup` 里的 `props` 是 `shallowReadonly`，改顶层字段会告警且不生效，生产构建没有这层保护。要改值就 `emit` 事件交给父组件。
- 只读是浅层的：`props.obj.key = 'x'` 不告警，会直接改到父组件的数据。

## 2. `$props` 与 `$attrs` 的区别

父组件传入的内容按「子组件是否声明」分成两份：

| 位置 | 内容 |
| --- | --- |
| `$props` | `defineProps` 声明过的 props |
| `$attrs` | 未声明的属性、未声明的事件监听器、`class` / `style` |

```vue
<Child
  :name="parentName"
  :age="20"
  data-test="testAttr"
  @custom="onCustom"
/>
```

- `name` / `age` 声明过 → `$props`
- `data-test`、`@custom` 未声明 → `$attrs`，监听器以 `onCustom` 键存在
- 在 `defineEmits` 里声明过的事件不进 `$attrs`

### 自动透传与 inheritAttrs

`inheritAttrs` 默认 `true`：`$attrs` 挂到子组件根元素，`class` / `style` 与根元素原有值合并。

```vue
<!-- 父：<Child class="c" data-test="t" style="color:red" />，子组件根元素 class="root" -->
<div class="root c" data-test="t" style="color:red;">child</div>
```

组件是多根 / 文本根节点时没有唯一落点，Vue 不自动继承并告警，需要 `inheritAttrs: false` 手动挂：

```vue
<script setup>
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="wrapper">
    <input v-bind="$attrs" />
  </div>
</template>
```

- 关掉后根元素不再收到 `$attrs`，只在 `v-bind="$attrs"` 处生效。
- 中间层组件不声明 props、只写 `v-bind="$attrs"`，就能把属性和事件原样转给深层组件。

## 3. 插槽

子组件用 `<slot>` 占位，父组件提供内容：

```vue
<!-- 子组件 -->
<slot />
<slot name="header" />
<slot name="item" :row="row" />
<slot>没有传入时的后备内容</slot>

<!-- 父组件 -->
<Child>
  默认内容
  <template #header>标题</template>
  <template #item="{ row }">{{ row.name }}</template>
</Child>
```

- 默认插槽接收没有指定插槽名的内容；具名插槽由 `<template #name>` 对应 `<slot name="name">`。
- 作用域插槽把 `<slot>` 上的属性作为参数传给父组件，父组件用 `#item="{ row }"` 解构。
- `<slot>` 内部内容只在父组件没传该插槽时渲染；`v-if="$slots.header"` 决定外层容器是否出现。
- 更多插槽语法与编译产物见 `vue/slots.md`。

## 4. 事件：`$emit` 与 `$event`

子组件用 `defineEmits` 声明事件，再调用 `emit` 触发：

```vue
<!-- 子组件 -->
<script setup>
const emit = defineEmits<{
  'update:name': [name: string, count: number, flag: boolean]
}>()

const handleEmit = () => emit('update:name', '新名字', 99, true)
</script>
```

父组件的三种接法与收到的参数：

| 写法 | 处理函数收到 |
| --- | --- |
| `@update:name="onUpdateName"` | 全部参数：`'新名字', 99, true` |
| `@update:name="onUpdateName($event)"` | 只有第一个参数 |
| `@update:name="handleWithAllArgs"`（`(...args)` 接收） | 全部参数 |

- 自定义事件里的 `$event` 是 `emit` 的第一个参数，模板里没有 `$arguments`。
- 原生事件里的 `$event` 是浏览器原生 `Event` 对象，`@click="fn($event)"` 中 `event.target.tagName` 为 `BUTTON`。

## 5. 顺带一提：模板 ref

`<script setup>` 里用 `useTemplateRef`（Vue 3.5+）拿 DOM 元素或子组件实例：

```vue
<script setup>
import { useTemplateRef } from 'vue'

const inputEl = useTemplateRef('inputEl')
const focus = () => inputEl.value?.focus()
</script>

<template>
  <input ref="inputEl" />
  <button @click="focus">聚焦输入框</button>
</template>
```

- 字符串要和模板里的 `ref="inputEl"` 一致，挂载后 `inputEl.value` 才有值。
- 拿到的是真实 DOM，`inputEl.value.value` 是普通字符串、不是响应式数据，要随输入更新得自己同步：

```vue
<input
  ref="inputEl"
  @input="readValue"
/>
<p>{{ inputValue }}</p>

const inputValue = ref('')
const readValue = () => { inputValue.value = inputEl.value?.value ?? '' }
```

- 旧写法 `const inputEl = ref(null)` + 同名 `ref="inputEl"` 仍可用，只是变量名要手工和 ref 名保持一致。

## 6. 常用实例属性速查

| 属性 | 作用 |
| --- | --- |
| `$props` | 已声明的 props |
| `$attrs` | 未声明的属性 / 事件 / class / style |
| `$slots` | 父组件传入的插槽 |
| `$emit` | 触发自定义事件 |
| `$refs` | 模板 ref 集合（推荐改用 `useTemplateRef`） |
| `$el` | 组件根节点；多根时是 fragment 起始锚点（文本节点） |
