# Pinia 与 Vuex 完全指南

> 覆盖：状态模型、Vuex 4 / Pinia 4.1.0 的 API、同一需求的两种实现、迁移路径与高频追问
> 版本基线：本仓库 `pinia@4.1.0`（peer `vue ^3.5.11`）、`vue@3.5.42`；Vuex 示例按 4.x API 书写

---

## 目录

1. [什么是状态管理](#一什么是状态管理)
2. [Vuex 详解](#二vuex-详解)
3. [Pinia 详解](#三pinia-详解)
4. [Pinia 与 Vuex 的区别对比](#四pinia-与-vuex-的区别对比)
5. [代码实例：同一需求两套实现](#五代码实例同一需求两套实现)
6. [迁移指南：Vuex → Pinia](#六迁移指南vuex--pinia)
7. [高频面试题总结](#七高频面试题总结)
8. [速查表](#八速查表)
9. [附录：Vuex → Pinia 迁移检查清单](#附录vuex--pinia-迁移检查清单)

---

## 一、什么是状态管理

### 1.1 为什么需要状态管理

`props` / `emit` / `provide-inject` 适用于相邻组件或单条链路。出现下列情况时需要独立的状态层：

- 多个不相邻组件读写同一份数据
- 需要单一数据源，避免多处副本不同步
- 状态变更需要可追踪、可调试
- 全局数据跨路由、跨层级共享（用户、权限、主题、购物车）

状态管理库的职责：把共享状态移出组件树，用统一的规则读写。

### 1.2 核心概念模型

| 角色 | 职责 |
|---|---|
| State | 唯一数据源 |
| Getter / Computed | 派生状态，带缓存 |
| Action / Method | 修改状态的入口，可含异步逻辑 |

Vuex 与 Pinia 都是这个模型，差别在约束强度：Vuex 用 mutation 强制同步写入，Pinia 由 action 直接写入，靠订阅与 DevTools 追踪。

---

## 二、Vuex 详解

### 2.1 Vuex 是什么

Vuex 是 Vue 官方早期的状态管理库，设计沿用 Flux 的单向数据流。

> 核心规则：**mutation 是修改 state 的唯一入口，且必须同步**；异步逻辑放 action，完成后 `commit` mutation。

### 2.2 五大核心概念

| 概念 | 作用 | 可异步 | 直接修改 state |
|---|---|---|---|
| `state` | 存储数据 | — | — |
| `getters` | 派生状态，结果缓存 | 否 | — |
| `mutations` | 修改 state 的唯一入口 | 否，必须同步 | 唯一合法途径 |
| `actions` | 业务逻辑、异步请求 | 是 | 需 `commit` mutation |
| `modules` | 拆分大型 store | — | — |

### 2.3 数据流转

读取走 `state` / `getters`；写入只有两条路径：组件 `commit` mutation，或组件 `dispatch` action 后由 action `commit` mutation。mutation 同步改 state，响应式系统再更新视图。

### 2.4 基础用法

```js
// store/index.js（Vuex 4）
import { createStore } from 'vuex'

export default createStore({
  state: () => ({
    count: 0,
    todos: [],
  }),
  getters: {
    doneTodos: (state) => state.todos.filter((t) => t.done),
    doneCount: (state, getters) => getters.doneTodos.length,
    // 返回函数用于传参，但不会命中 getter 缓存
    getTodoById: (state) => (id) => state.todos.find((t) => t.id === id),
  },
  mutations: {
    INCREMENT(state, payload = 1) {
      state.count += payload
    },
    SET_TODOS(state, todos) {
      state.todos = todos
    },
  },
  actions: {
    async incrementAsync({ commit }, payload) {
      await new Promise((r) => setTimeout(r, 300))
      commit('INCREMENT', payload)
    },
    async fetchTodos({ commit }) {
      commit('SET_TODOS', await fetch('/api/todos').then((r) => r.json()))
    },
  },
  // 开发环境开启：在 mutation 之外改 state 会直接抛错
  strict: import.meta.env.DEV,
})
```

```vue
<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()
const count = computed(() => store.state.count)
const doneCount = computed(() => store.getters.doneCount)
</script>
```

选项式 API 用 `...mapState(['count'])` 展开到 `computed`；`<script setup>` 里不要直接解构 `mapState`，原因见 Q6。

### 2.5 Modules 与命名空间

```js
// store/modules/user.js
export default {
  namespaced: true,
  state: () => ({ token: '', profile: null }),
  getters: {
    isLogin: (state) => !!state.token,
  },
  mutations: {
    SET_TOKEN(state, token) {
      state.token = token
    },
    SET_PROFILE(state, profile) {
      state.profile = profile
    },
  },
  actions: {
    async login({ commit }, payload) {
      const res = await api.login(payload)
      commit('SET_TOKEN', res.token)
      commit('SET_PROFILE', res.profile)
    },
  },
}
```

```js
// store/index.js
export default createStore({
  modules: { user, cart },
  // 根 state 形状：{ user: {...}, cart: {...} }
})
```

```js
// 完整路径访问
store.dispatch('user/login', payload)
store.getters['user/isLogin']

// 命名空间辅助函数
const { mapActions, mapState } = createNamespacedHelpers('user')
```

未加 `namespaced: true` 时，模块的 getters / mutations / actions 都注册到根命名空间，不同模块出现同名 key 会互相干扰；state 仍嵌在模块下，是隔离的。

### 2.6 Vuex 的几个"坑"

| 坑 | 说明 |
|---|---|
| **`namespaced` 缺失** | mutation / action / getter 全局注册，同名 key 冲突 |
| **严格模式开销** | 对整棵 state 做深度同步监听，state 越大越慢，生产环境应关闭 |
| **动态增删 state 属性** | Vuex 3（Vue 2）需 `Vue.set` / `Vue.delete`；Vuex 4 基于 Vue 3 响应式，无需处理 |
| **`<script setup>` 里的辅助函数** | `mapState` 返回值不是 ref，必须包 `computed` |
| **模块热更新** | 需要手动调用 `store.hotUpdate()` |

### 2.7 Vuex 的实现原理（简述）

```js
// 极简核心：响应式 state + 订阅 + computed 缓存的 getters
function createStore({ state, mutations, actions, getters }) {
  const store = reactive({ state: state() })
  const listeners = new Set()

  const commit = (type, payload) => {
    mutations[type](store.state, payload)
    listeners.forEach((fn) => fn({ type, payload }, store.state))
  }
  const dispatch = (type, payload) =>
    actions[type]({ commit, dispatch, state: store.state }, payload)

  const computedGetters = {}
  Object.keys(getters).forEach((key) => {
    computedGetters[key] = computed(() => getters[key](store.state, computedGetters))
  })

  return {
    state: store.state,
    getters: computedGetters,
    commit,
    dispatch,
    subscribe: (fn) => listeners.add(fn),
  }
}
```

Vuex 4 用 `reactive` 承载 state，getter 用 `computed` 缓存，`subscribe` 供 DevTools 与插件监听；strict 模式额外对整个 state 做深度同步监听。

---

## 三、Pinia 详解

### 3.1 Pinia 是什么

Pinia 是 Vue 3 官方推荐的状态管理库：每个 store 独立，TypeScript 类型自动推导，与组合式 API 同构。Vuex 处于维护模式。

### 3.2 核心概念（只有三个）

| 概念 | 等价 Vuex | 说明 |
|---|---|---|
| `state` | state | 数据 |
| `getters` | getters | 派生状态；普通函数可用 `this` 访问其他 getter |
| `actions` | mutations + actions | 同步、异步均可，直接修改 state |

Pinia 没有 mutation、没有 `namespaced`、没有全局唯一的 `$store`；每个 `defineStore` 生成一个独立 store 实例。

### 3.3 两种定义风格

#### 风格一：Option Store（类 Vuex 写法）

```js
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    double: (state) => state.count * 2,
    // 使用其他 getter 时必须用普通函数，this 指向 store
    doublePlusOne() {
      return this.double + 1
    },
  },
  actions: {
    increment(payload = 1) {
      this.count += payload
    },
    async incrementAsync(payload) {
      await sleep(300)
      this.increment(payload)
    },
  },
})
```

#### 风格二：Setup Store（组合式 API 写法，**推荐**）

```js
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', () => {
  // state → ref
  const count = ref(0)
  // getters → computed
  const double = computed(() => count.value * 2)

  // actions → function
  function increment(payload = 1) {
    count.value += payload
  }
  async function incrementAsync(payload) {
    await sleep(300)
    increment(payload)
  }

  // 必须 return，未返回的成员外部访问不到
  return { count, double, increment, incrementAsync }
})
```

Setup Store 与 `<script setup>` 写法一致，可直接复用 composable；返回的 ref / computed 成为 store 的 state / getters，函数成为 actions。

### 3.4 在组件中使用

```vue
<script setup>
import { storeToRefs } from 'pinia'
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()

// 模板里直接 counter.count / counter.double 保持响应性
// 解构会取到普通值，state 与 getters 必须走 storeToRefs
const { count, double } = storeToRefs(counter)
// actions 是普通函数，可以直接解构
const { increment } = counter
</script>
```

### 3.5 修改 State 的四种方式

```js
const store = useCounterStore()

// 1. 直接赋值
store.count++

// 2. $patch 对象形式：一次提交
store.$patch({ count: 1, profile: { name: 'Tom' } })

// 3. $patch 函数形式：适合数组 push 等复杂变更
store.$patch((state) => {
  state.items.push({ id: 1, name: 'book' })
  state.updatedAt = Date.now()
})

// 4. $reset：仅 Option Store 可用
store.$reset()
```

- `$patch` 对象形式对普通对象递归合并，数组和其他值直接替换：`$patch({ list: [9] })` 会把 `[1, 2, 3]` 变成 `[9]`。
- 一次 `$patch` 只触发一次 `$subscribe` 回调；函数形式不能是 `async`。
- Setup Store 没有实现 `$reset`，调用会抛 `Store "xxx" is built using the setup syntax and does not implement $reset().`，需要自己写重置 action。

### 3.6 订阅与插件

```js
// state 变更
const unsubscribe = store.$subscribe(
  (mutation, state) => {
    // mutation.type: 'direct' | 'patch object' | 'patch function'
    track(mutation.type, state)
  },
  { detached: true }, // 默认随组件作用域销毁；detached 后组件卸载仍生效
)

// action 调用
store.$onAction(({ name, args, after, onError }) => {
  after((result) => log(name, result))
  onError((err) => report(name, err))
})
```

```js
// stores/index.js
import { createPinia } from 'pinia'

const pinia = createPinia()

pinia.use(({ store }) => {
  store.$api = api
})

app.use(pinia)
```

插件在 store 创建时执行；`pinia.use()` 可以写在 `app.use(pinia)` 之前，插件先入队，安装时统一注册。

### 3.7 跨 store 互相调用

```js
// stores/cart.js
import { defineStore } from 'pinia'
import { useUserStore } from './user'

export const useCartStore = defineStore('cart', {
  state: () => ({ items: [] }),
  getters: {
    discount() {
      return useUserStore().isVip ? 0.8 : 1
    },
  },
  actions: {
    async checkout() {
      const user = useUserStore()
      if (!user.isLogin) throw new Error('请先登录')
    },
  },
})
```

跨 store 直接调用另一个 `useXxxStore()`。调用必须发生在已激活 pinia 的上下文（组件 setup、action、getter）；模块顶层调用会抛 `"getActivePinia()" was called but there was no active Pinia`（开发环境文案）。

---

## 四、Pinia 与 Vuex 的区别对比

### 4.1 核心差异总览

| 维度 | Vuex (4.x) | Pinia (4.x) |
|---|---|---|
| **官方定位** | 维护模式 | 官方推荐，Vue 3 新项目首选 |
| **Vue 版本** | Vuex 3 → Vue 2；Vuex 4 → Vue 3 | Vue ≥ 3.5.11；Pinia 1.x 支持 Vue 2 |
| **Mutation** | 必须，且必须同步 | 移除，action 直接改 state |
| **命名空间** | 需 `namespaced: true` 手动开启 | 天然隔离，每个 store 独立 |
| **TypeScript** | 需手写 RootState / Module 泛型 | 从 `defineStore` 自动推导 |
| **组合式 API** | 辅助函数需配合 `computed` | Setup Store 与 setup 同构 |
| **代码量** | state / getters / mutations / actions | state / getters / actions |
| **模块注册** | 静态 `createStore({ modules })` | 动态 `defineStore`，支持代码分割 |
| **严格模式** | 可开启，有性能开销 | 无此概念 |
| **DevTools** | 支持 | 支持，含 action 追踪与时间线 |
| **SSR** | 支持 | 支持，每请求 `createPinia()` |
| **Store 实例** | 全局单一 `$store` | 多个独立 store，按需创建 |
| **动态增删 state** | Vuex 3 需 `Vue.set` | Vue 3 响应式天然支持 |
| **热更新** | `store.hotUpdate()` | `acceptHMRUpdate()` |
| **插件机制** | `plugins` + `subscribe` | `pinia.use()`，可访问全部 store |
| **跨模块调用** | `rootState` / `dispatch('other/xx')` | 直接 `useOtherStore()` |

### 4.2 代码结构对比

| 环节 | Vuex | Pinia |
|---|---|---|
| 定义 | module + `namespaced` | `defineStore('id', ...)` |
| 同步修改 | `commit('INCREMENT', n)` | `store.increment(n)` |
| 异步 | `dispatch('incrementAsync', n)` | 直接调用 async action |
| 读取 | `store.state.counter.count` | `store.count` |

同一计数器，Pinia 少一层 mutation，也不需要拼接命名空间路径。完整代码见 5.1 / 5.2。

### 4.3 为什么 Pinia 要删掉 Mutation？

Vuex 引入 mutation 的目的有两个：让每次变更同步发生，DevTools 能记录确定的变更前后快照；把异步逻辑隔离在 action。

代价是每个写操作都要多写一段 mutation 和一次 `commit`。Pinia 让 action 直接写 state，DevTools 仍能追踪 action 调用与 state 变更，约束从框架强制变为开发约定。

### 4.4 响应式机制差异

| | Vuex 3 (Vue 2) | Vuex 4 (Vue 3) | Pinia |
|---|---|---|---|
| 响应式内核 | `new Vue({ data })` / `Vue.observable` | `reactive()` | `reactive()` + `ref()` |
| 数组索引赋值 | 不响应 | 响应 | 响应 |
| 新增对象属性 | 需 `Vue.set` | 响应 | 响应 |
| 解构取值 | `computed` / `mapState` | `computed` / `mapState` | `storeToRefs` |

解构本质是取值，取到的不是响应式引用，所以三种方案都要额外包一层；这是响应式模型决定的，不是库的缺陷。

---

## 五、代码实例：同一需求两套实现

### 5.0 需求

- 登录后展示待办列表，支持新增、完成、删除
- 展示已完成数量与完成率
- 数据持久化到 localStorage
- 类型安全（TypeScript）

### 5.1 Vuex 4 实现

```ts
// store/types.ts
export interface Todo {
  id: number
  title: string
  done: boolean
}
export interface User {
  id: number
  name: string
  isVip: boolean
}
```

```ts
// store/modules/todo.ts
import type { Module } from 'vuex'
import type { RootState } from '../index'
import type { Todo } from '../types'

export interface TodoState {
  list: Todo[]
}

export const todo: Module<TodoState, RootState> = {
  namespaced: true,
  state: () => ({ list: [] }),
  getters: {
    doneList: (state) => state.list.filter((t) => t.done),
    doneCount: (state, getters) => getters.doneList.length,
    rate: (state, getters) =>
      state.list.length === 0 ? 0 : Math.round((getters.doneCount / state.list.length) * 100),
  },
  mutations: {
    SET_LIST(state, list: Todo[]) {
      state.list = list
    },
    ADD(state, item: Todo) {
      state.list.push(item)
    },
    TOGGLE(state, id: number) {
      const item = state.list.find((t) => t.id === id)
      if (item) item.done = !item.done
    },
    REMOVE(state, id: number) {
      state.list = state.list.filter((t) => t.id !== id)
    },
  },
  actions: {
    async fetchList({ commit }) {
      commit('SET_LIST', await fetch('/api/todos').then((r) => r.json()))
    },
    addTodo({ commit }, title: string) {
      commit('ADD', { id: Date.now(), title, done: false })
    },
    toggle({ commit }, id: number) {
      commit('TOGGLE', id)
    },
    remove({ commit }, id: number) {
      commit('REMOVE', id)
    },
  },
}
```

```ts
// store/modules/user.ts
import type { Module } from 'vuex'
import type { RootState } from '../index'
import type { User } from '../types'

export interface UserState {
  profile: User | null
}

export const user: Module<UserState, RootState> = {
  namespaced: true,
  state: () => ({ profile: null }),
  getters: {
    isLogin: (state) => !!state.profile,
    isVip: (state) => state.profile?.isVip ?? false,
  },
  mutations: {
    SET_PROFILE(state, profile: User | null) {
      state.profile = profile
    },
  },
  actions: {
    async login({ commit }, payload: { username: string; password: string }) {
      commit('SET_PROFILE', await api.login(payload))
    },
    logout({ commit }) {
      commit('SET_PROFILE', null)
    },
  },
}
```

```ts
// store/index.ts
import { createLogger, createStore } from 'vuex'
import { todo, type TodoState } from './modules/todo'
import { user, type UserState } from './modules/user'

export interface RootState {
  todo: TodoState
  user: UserState
}

const store = createStore<RootState>({
  modules: { todo, user },
  strict: import.meta.env.DEV,
  plugins: import.meta.env.DEV ? [createLogger()] : [],
})

// 持久化：Vuex 没有内置方案，手写 subscribe
store.subscribe((_mutation, state) => {
  localStorage.setItem('vuex', JSON.stringify(state))
})

export default store
```

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

// 解构 store 会丢响应性，取值统一用 computed
const list = computed(() => store.state.todo.list)
const doneCount = computed(() => store.getters['todo/doneCount'])
const rate = computed(() => store.getters['todo/rate'])
const isLogin = computed(() => store.getters['user/isLogin'])

const addTodo = (title: string) => store.dispatch('todo/addTodo', title)
const toggle = (id: number) => store.dispatch('todo/toggle', id)
const remove = (id: number) => store.dispatch('todo/remove', id)
const login = (p: { username: string; password: string }) => store.dispatch('user/login', p)
</script>
```

模板两套实现相同：`v-for` 渲染 `list`，勾选调用 `toggle(t.id)`，按钮调用 `remove` / `addTodo`，未登录时显示登录按钮。

### 5.2 Pinia 实现（Setup Store）

```ts
// stores/todo.ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useUserStore } from './user'
import type { Todo } from '@/types'

export const useTodoStore = defineStore('todo', () => {
  const list = ref<Todo[]>([])

  const doneList = computed(() => list.value.filter((t) => t.done))
  const doneCount = computed(() => doneList.value.length)
  const rate = computed(() =>
    list.value.length === 0 ? 0 : Math.round((doneCount.value / list.value.length) * 100),
  )

  async function fetchList() {
    list.value = await fetch('/api/todos').then((r) => r.json())
  }
  function addTodo(title: string) {
    if (!useUserStore().isLogin) throw new Error('请先登录')
    list.value.push({ id: Date.now(), title, done: false })
  }
  function toggle(id: number) {
    const item = list.value.find((t) => t.id === id)
    if (item) item.done = !item.done
  }
  function remove(id: number) {
    list.value = list.value.filter((t) => t.id !== id)
  }

  return { list, doneList, doneCount, rate, fetchList, addTodo, toggle, remove }
})
```

```ts
// stores/user.ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  const profile = ref<User | null>(null)

  const isLogin = computed(() => !!profile.value)
  const isVip = computed(() => profile.value?.isVip ?? false)

  async function login(payload: { username: string; password: string }) {
    profile.value = await api.login(payload)
  }
  function logout() {
    profile.value = null
  }

  return { profile, isLogin, isVip, login, logout }
})
```

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTodoStore } from '@/stores/todo'
import { useUserStore } from '@/stores/user'

const todoStore = useTodoStore()
const userStore = useUserStore()

const { list, doneCount, rate } = storeToRefs(todoStore)
const { isLogin } = storeToRefs(userStore)
const { addTodo, toggle, remove } = todoStore
const { login } = userStore
</script>
```

模板与 5.1 相同，变量直接来自上面的解构结果。

### 5.3 Pinia 持久化（生产常用）

```ts
// main.ts
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
```

```ts
// stores/todo.ts 中开启
export const useTodoStore = defineStore(
  'todo',
  () => {
    /* 同 5.2 */
  },
  {
    persist: {
      key: 'todo-store',
      storage: localStorage,
      pick: ['list'], // 4.x 的白名单写法
    },
  },
)
```

### 5.4 Pinia 单元测试

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTodoStore } from '@/stores/todo'
import { useUserStore } from '@/stores/user'

describe('todo store', () => {
  beforeEach(() => {
    setActivePinia(createPinia()) // 每个用例独立 pinia 实例
  })

  it('新增待办', () => {
    const store = useTodoStore()
    useUserStore().profile = { id: 1, name: 'a', isVip: false }
    store.addTodo('学 Pinia')
    expect(store.list).toHaveLength(1)
    expect(store.list[0].title).toBe('学 Pinia')
  })

  it('完成率计算正确', () => {
    const store = useTodoStore()
    store.list = [
      { id: 1, title: 'a', done: true },
      { id: 2, title: 'b', done: false },
    ]
    expect(store.rate).toBe(50)
  })
})
```

`setActivePinia(createPinia())` 即可获得干净实例；Vuex 需要重新 `createStore` 并 mock modules。

---

## 六、迁移指南：Vuex → Pinia

### 6.1 映射关系

| Vuex | Pinia |
|---|---|
| `state: () => ({})` | `const x = ref()` / `ref({})` |
| `getters: { a: s => s.x }` | `const a = computed(() => x.value)` |
| `mutations: { M(s, p) {} }` + `commit('M', p)` | 直接写 action 函数 |
| `actions: { A({ commit }) {} }` + `dispatch('A')` | `function A() {}` 直接调用 |
| `modules: { user }` + `namespaced` | `defineStore('user', ...)` |
| `mapState(['x'])` | `storeToRefs(store).x` |
| `rootState.other.y` | `useOtherStore().y` |
| `createStore({ plugins })` | `pinia.use(plugin)` |
| `store.subscribe` | `store.$subscribe` |

### 6.2 迁移步骤

1. `npm i pinia pinia-plugin-persistedstate`，移除 `vuex`
2. `main.ts` 用 `app.use(createPinia())` 替换 `app.use(store)`
3. 每个 module 改写为一个 `defineStore`（推荐 Setup Store）
4. mutation 逻辑内联到 action
5. 组件 `useStore()` 改为按模块 `useXxxStore()`
6. `mapState` 改为 `storeToRefs`，`mapActions` 改为直接解构
7. 类型从手写 `RootState` / `Module` 改为 `ReturnType<typeof useXxxStore>`
8. 持久化、日志插件替换为 Pinia 等价实现

### 6.3 渐进式迁移技巧

Vuex 与 Pinia 可以在同一项目共存，按模块迁移：

```ts
// 旧代码继续用 useStore()，新代码用 useXxxStore()
// 需要互相访问时，直接调用对方；前提是 pinia 已 install
import { useUserStore } from '@/stores/user'

export const isLoggedIn = () => useUserStore().isLogin
```

---

## 七、高频面试题总结

### Q1：Pinia 和 Vuex 的核心区别是什么？

见 4.1 对比表。三点概括：

- API：移除 mutation，action 直接改 state，可同步可异步
- 模块：`defineStore` 天然隔离，无需 `namespaced`，支持代码分割
- 工程：TypeScript 自动推导，Setup Store 与组合式 API 同构

### Q2：Pinia 为什么删掉了 mutation？会不会导致状态难以追踪？

不会。可追踪性由 DevTools 的 action 追踪与 `$subscribe` 提供；mutation 那层同步约束由 action + 订阅替代，原因见 4.3。

### Q3：Pinia 的 store 是怎么实现响应式的？

- Option Store：`reactive(state())`，每个 getter 包一层 `computed`
- Setup Store：直接复用用户返回的 `ref` / `computed`
- store 本身是 reactive 代理，直接赋值与 `$patch` 都会被拦截
- 解构取到的是值，state / getter 必须用 `storeToRefs`；返回结果只含 state 与 getters，actions 不在其中

### Q4：Vuex 的 mutation 和 action 有什么区别？为什么 action 不能直接改 state？

| | mutation | action |
|---|---|---|
| 是否同步 | 必须同步 | 可异步 |
| 修改 state | 唯一合法途径 | 需 `commit` mutation |
| 调用方式 | `commit` | `dispatch` |
| 能否互相调用 | 不能调用 action | 可 commit 多个 mutation、dispatch 其他 action |

原因是可追踪性与时序确定性：mutation 同步执行，DevTools 才能拿到确定的变更前后快照；异步回调时机不定，允许直接改就无法复现竞态。

### Q5：Vuex 的严格模式有什么代价？

`strict: true` 会开启对整个 state 的深度同步监听：

- state 越大，开销越明显
- 大数据列表下可能明显卡顿
- 生产环境必须关闭

Pinia 没有这个概念。

### Q6：`mapState` / `mapGetters` 在 Vue3 中为什么"失效"了？

二者返回的是函数集合，不是 `ref`。Vue2 中它们被混入 `computed`，所以有响应性；`<script setup>` 没有 `this` 和 `computed` 容器，直接解构拿到的是快照。

```js
// Vuex 4 + setup
const count = computed(() => store.state.count)

// Pinia
const { count } = storeToRefs(useCounterStore())
```

### Q7：Pinia 中如何实现跨 store 调用？有什么坑？

在 action / getter 内直接调用另一个 `useXxxStore()`。坑是不能写在模块顶层：此时 pinia 尚未 install，开发环境会抛 `"getActivePinia()" was called but there was no active Pinia`。

组件外确实需要时，显式传入实例：

```js
const pinia = createPinia()
app.use(pinia)
useUserStore(pinia)
```

### Q8：Pinia 的 `$patch` 有什么作用？什么时候用？

- 作用：一次提交多个 state 变更，只触发一次订阅回调
- 场景：表单批量提交、初始数据灌入、从 localStorage 恢复
- 对象 / 函数两种形式的合并与替换规则见 3.5

```js
store.$patch((state) => {
  state.items.push(newItem)
  state.total += newItem.price
})
```

### Q9：Pinia 如何做持久化？为什么不用手写？

官方推荐 `pinia-plugin-persistedstate`。原理：`pinia.use()` 注册插件，插件为每个 store 注册 `$subscribe`（`detached: true`），变更时写入 storage；初始化时读取并 `$patch`。

相比 Vuex 手写 `subscribe`，插件可按 store 配置 `key` / `storage` / `pick` 白名单。

### Q10：什么情况下还应该用 Vuex 而不是 Pinia？

- Vue 2 + Vuex 3 的存量项目，没有升级 Vue 3 的计划
- 工作流强依赖 mutation 的严格约束与基于它的时间旅行审计

其余场景选 Pinia，决策表见 8.2。

### Q11：Pinia 的 store 是一个单例吗？

是。`defineStore('id', ...)` 只定义工厂，首次调用 `useXxxStore()` 时创建实例并缓存在 `pinia._s`，之后返回同一实例：

```js
useCounterStore() === useCounterStore() // true
```

单例范围是单个 pinia 实例。SSR 必须每请求新建 `createPinia()`，否则请求之间会串数据；两个不同 pinia 实例下的同名 store 互不影响。

### Q12：Pinia 支持 Vue2 吗？

- Pinia 1.x 支持 Vue 2.6+，需要 `@vue/composition-api`
- Pinia 2.x 起仅支持 Vue 3
- Pinia 4.x 要求 `vue ^3.5.11`

### Q13：Vuex 的 modules 为什么要 `namespaced: true`？

默认扁平注册：不同模块的同名 mutation / action / getter 会冲突；state 仍按模块嵌套隔离（见 2.5）。开启后调用路径变为 `'moduleName/actionName'`。Pinia 每个 store 独立，没有这个问题。

### Q14：Pinia 相比 Vuex 在 TypeScript 上的优势具体是什么？

Vuex 需要手写 `RootState` 与 `Module<S, R>` 泛型、手写 action payload 类型，访问 `this.$store` 还需 module augmentation。

Pinia 从 `defineStore` 自动推导 state / getters / actions：

```ts
const store = useCounterStore()
store.count // number
store.increment(1) // 参数类型自动推导
type CounterStore = ReturnType<typeof useCounterStore>
```

### Q15：Vuex 中如何优雅地处理异步？Pinia 呢？

Vuex 只能放在 action，且 action 必须 `return` 数据，组件 `await store.dispatch(...)` 才能拿到结果。

Pinia 的 action 是普通函数，直接 `return` 即可，组件 `await store.fetchData()`。

### Q16：Pinia 的 `$onAction` 和 `$subscribe` 有什么区别？

| | `$subscribe` | `$onAction` |
|---|---|---|
| 监听对象 | state 变化 | action 调用 |
| 触发时机 | state 变更后 | action 执行前、成功后、出错时 |
| 参数 | `(mutation, state)` | `({ name, args, after, onError })` |
| 典型用途 | 持久化、埋点、审计 | 全局 loading、错误上报、性能监控 |

### Q17：Vuex 的 state 为什么必须是函数？

因为 module 会被复用，SSR 下也会服务多个请求。对象形式会在实例之间共享同一份引用；函数每次调用返回新对象。

```js
state: { count: 0 } // 共享引用
state: () => ({ count: 0 }) // 每次新建
```

Pinia 的 Option Store 同样要求 `state` 是函数，非函数会抛 `TypeError: state is not a function`；Setup Store 用 `ref` 天然每次创建新值。

### Q18：如何做状态管理的性能优化？

1. **按需引入与拆分 store**：按业务域拆，避免巨型 store
2. **getter 保持纯函数**：无副作用才能命中 `computed` 缓存
3. **`$patch` 批量更新**：减少订阅回调与渲染次数
4. **`shallowRef` / `markRaw`**：大对象、图表实例不做深度代理
5. **生产关闭 Vuex strict**
6. **持久化写入防抖**：`$subscribe` 里写 localStorage 时加 throttle / debounce

```js
const save = debounce((state) => {
  localStorage.setItem('cart', JSON.stringify(state))
}, 300)
store.$subscribe((_mutation, state) => save(state))
```

---

## 八、速查表

### 8.1 API 对照

```js
// ============ 定义 ============
// Vuex
createStore({ state, getters, mutations, actions, modules })
// Pinia
defineStore('id', { state, getters, actions })
defineStore('id', () => { ...; return { ... } })

// ============ 读取 ============
// Vuex
store.state.count
store.getters.double
// Pinia
store.count
store.double

// ============ 修改 ============
// Vuex
store.commit('INCREMENT', 1)
store.dispatch('incrementAsync', 1)
// Pinia
store.count++
store.$patch({ count: 1 })
store.increment(1)

// ============ 解构 ============
// Vuex
computed(() => store.state.count)
// Pinia
storeToRefs(store).count

// ============ 监听 ============
// Vuex
store.subscribe((mutation, state) => {})
store.watch(fn, cb)
// Pinia
store.$subscribe((mutation, state) => {})
store.$onAction(({ name, after, onError }) => {})

// ============ 重置 ============
// Vuex
// 需手写 mutation 或重新 set
// Pinia
store.$reset() // 仅 Option Store
```

### 8.2 选型决策

| 场景 | 选择 |
|---|---|
| Vue 3 新项目 | Pinia |
| Vue 2 + Vuex 3 稳定运行，无升级计划 | 保持 Vuex 3 |
| 有计划升级 Vue 3 | 先升 Vue 3，再迁 Pinia |
| 依赖严格 mutation / 时间旅行审计 | Vuex strict，或自建 DevTools 插件 |

### 8.3 一句话记住

> Vuex 用 mutation 的同步约束换取可追踪性；Pinia 用 action + `$subscribe` 达到同样的可追踪性，少一层模板代码。

---

## 附录：Vuex → Pinia 迁移检查清单

- [ ] 移除 `vuex` 依赖，安装 `pinia` + `pinia-plugin-persistedstate`
- [ ] `main.ts` 改为 `app.use(createPinia())`
- [ ] 每个 module 转为 `defineStore`
- [ ] mutations 全部内联进 actions
- [ ] `namespaced` 路径调用 `'user/login'` 改为 `useUserStore().login()`
- [ ] `rootState.x` 改为 `useXStore().x`
- [ ] 组件 `mapState` → `storeToRefs`，`mapActions` → 解构
- [ ] 持久化逻辑改为插件配置
- [ ] 单元测试加 `setActivePinia(createPinia())`
- [ ] 检查类型定义（移除手写 `RootState` / `Module` 泛型）
