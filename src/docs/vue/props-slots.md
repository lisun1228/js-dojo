# Props、$attrs 与插槽

父子组件通信的三块基础内容：**props 传值**、**$attrs 透传**、**插槽分发内容**，以及配套的 **$emit / $event**。

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

父组件用 `v-bind`（简写 `:`）传值，子组件用 `defineProps` 声明接收。

```vue
<!-- 子组件 Child.vue -->
<script setup>
const props = defineProps(['name', 'age'])
</script>

<template>
  <p>props.name = {{ $props.name }}</p>
  <p>props.age = {{ $props.age }}</p>
</template>
```

```vue
<!-- 父组件 -->
<Child :name="parentName" :age="20" />
```

推荐用类型声明（`<script setup lang="ts">`）：

```ts
const props = defineProps<{ name: string; age: number }>()
// 需要默认值时配合 withDefaults
const props = withDefaults(defineProps<{ age?: number }>(), { age: 18 })
```

> props 是**单向数据流**：子组件只读，不要直接修改；需要改就 `emit` 事件，由父组件改。

## 2. `$props` 与 `$attrs` 的区别

父组件传过来的东西会被分成两份：

| 位置 | 内容 |
| --- | --- |
| `$props` | 子组件里用 `defineProps` **声明过**的 |
| `$attrs` | **没有声明**的属性、事件监听器、`class` / `style` |

```vue
<Child :name="parentName" :age="20" data-test="testAttr" />
```

- `name` / `age` 声明过 → 进 `$props`
- `data-test` 没声明 → 进 `$attrs`

### 自动透传与 inheritAttrs

`$attrs` 默认会**自动挂到子组件的根元素上**（`inheritAttrs: true`），所以最终渲染出的 DOM 上能看到 `data-test="testAttr"`。

想自己控制挂载位置，就关掉自动透传：

```vue
<script setup>
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="wrapper">
    <!-- 手动决定 $attrs 挂到哪个元素 -->
    <input v-bind="$attrs" />
  </div>
</template>
```

> `$attrs` 最典型的用法是**透传**：中间层组件什么都不声明，把属性和事件原样转给更深层的组件。

## 3. 插槽

### 默认插槽

父组件标签**内部的内容**会进入子组件的 `<slot>`：

```vue
<!-- 父 -->
<Child>我是默认插槽内容</Child>

<!-- 子 -->
<slot />
```

### 具名插槽

用 `<template #名字>` 区分多个插槽：

```vue
<!-- 父 -->
<Child>
  我是默认插槽文本
  <template #header>我是具名 header 插槽</template>
</Child>

<!-- 子 -->
<slot />
<slot name="header" />
```

### `$slots`：判断有没有传

```vue
<div v-if="$slots.header">
  <slot name="header" />
</div>
<p v-else>没有传入 header 插槽</p>
```

### 作用域插槽：子组件把数据「带出去」

子组件在 `<slot>` 上绑定的属性，会作为插槽内容的参数传给父组件：

```vue
<!-- 子 -->
<slot name="item" :row="row" :index="index" />

<!-- 父 -->
<template #item="{ row, index }">
  {{ index }} - {{ row.name }}
</template>
```

## 4. 事件：`$emit` 与 `$event`

### 自定义事件

子组件用 `defineEmits` 声明事件，再调用 `emit` 触发：

```vue
<!-- 子组件 -->
<script setup>
const emit = defineEmits<{
  'update:name': [name: string, count: number, flag: boolean]
}>()

const handleEmit = () => {
  emit('update:name', '新名字', 99, true)
}
</script>
```

```vue
<!-- 父组件：方法引用写法，所有参数依次传给处理函数 -->
<Child @update:name="onUpdateName" />

const onUpdateName = (name, count, flag) => {
  console.log(name, count, flag) // '新名字' 99 true
}
```

### `$event` 只代表第一个参数

`$event` 在自定义事件里代表 **`emit` 的第一个参数**：

```vue
<!-- 内联写法：只能拿到第一个参数 -->
<Child @update:name="onUpdateName($event)" />
```

想拿到**全部参数**，用 rest 参数接：

```vue
<Child @update:name="handleWithAllArgs" />

const handleWithAllArgs = (...args) => {
  // args = ['新名字', 99, true]
}
```

> Vue 3 模板里**没有** `$arguments` 这个内置变量。要拿全部参数，就用方法引用写法（所有参数自动传入）或 rest 参数。
> 反过来，如果只想拿第一个参数，内联写 `handler($event)` 即可。

### 原生 DOM 事件里的 `$event`

同一个 `$event`，在原生事件上含义不同 —— 它是**浏览器原生 Event 对象**：

```vue
<button @click="handleNativeClick($event)">点我</button>

const handleNativeClick = (event) => {
  // event 是原生 Event
  console.log(event.target.tagName) // BUTTON
}
```

对比总结：

| 场景 | `$event` 是什么 |
| --- | --- |
| `@自定义事件` | `emit` 的第一个参数 |
| `@click` 等原生事件 | 浏览器原生 `Event` 对象 |

## 5. 顺带一提：模板 ref

想在 `<script setup>` 里拿到 DOM 元素 / 子组件实例，用 `useTemplateRef`（Vue 3.5+）：

```vue
<script setup>
import { useTemplateRef } from 'vue'

const inputEl = useTemplateRef('inputEl')

// 通过 inputEl.value 访问真实 DOM，比如聚焦、测量、读取值
const focus = () => inputEl.value?.focus()
</script>

<template>
  <input ref="inputEl" />
  <button @click="focus">聚焦输入框</button>
</template>
```

> 注意：ref 拿到的是**普通 DOM 元素**，它的 `value` 等属性并**不是响应式的**，直接在模板里写 `{{ inputEl?.value }}` 不会随输入实时更新，需要像下面这样自己同步：
>
> ```vue
> <input ref="inputEl" @input="readValue" />
> <p>{{ inputValue }}</p>
>
> const inputValue = ref('')
> const readValue = () => { inputValue.value = inputEl.value?.value ?? '' }
> ```
>
> 只是想要「输入框和变量双向同步」的话，直接用 `v-model` 就够了，不需要模板 ref。
>
> 老版本用 `const inputEl = ref(null)` + 同名 `ref="inputEl"` 也能实现，但变量名必须和模板里的 ref 值一致，容易写错，所以 3.5 起推荐 `useTemplateRef`。

## 6. 常用实例属性速查

| 属性 | 作用 |
| --- | --- |
| `$props` | 已声明的 props |
| `$attrs` | 未声明的属性 / 事件 / class / style |
| `$slots` | 父组件传入的插槽 |
| `$emit` | 触发自定义事件 |
| `$refs` | 模板 ref 集合（推荐改用 `useTemplateRef`） |
| `$el` | 组件根元素（多根节点时不适用） |
