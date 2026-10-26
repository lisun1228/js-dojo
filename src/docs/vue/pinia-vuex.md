# Pinia 与 Vuex 完全指南

> 从概念、API、原理到选型与面试题，一文吃透 Vue 两大状态管理方案。
> 适用版本：Vuex 3.x（Vue2）/ Vuex 4.x（Vue3）/ Pinia 2.x（Vue3）

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

组件通信在小型应用中靠 `props` / `emit` / `provide-inject` 就够。但当出现以下场景时，这些方式会迅速失控：

- 多个不相邻组件需要共享同一份数据
- 同一份数据被多处读写，需要保证"单一数据源"
- 状态变更需要可追踪、可调试、可回放
- 跨路由、跨层级的全局数据（用户信息、权限、主题、购物车）

状态管理库解决的核心问题：**把共享状态抽离到组件树之外，用统一的规则读写**。

### 1.2 核心概念模型

```
┌──────────────────────────────────────────┐
│              Store（单一数据源）           │
│  ┌──────────┐  ┌────────┐  ┌───────────┐ │
│  │  State   │  │Getter/ │  │ Action/   │ │
│  │  状态    │→ │Computed│  │ Method    │ │
│  └──────────┘  └────────┘  └───────────┘ │
└──────────────────────────────────────────┘
        ↑ 读取                 ↓ 修改
   ┌────────────────────────────────┐
   │          View / Component       │
   └────────────────────────────────┘
```

- **State**：唯一数据源
- **Getter / Computed**：派生状态（带缓存）
- **Action / Method**：修改状态的唯一入口（可含异步逻辑）

Vuex 和 Pinia 都遵循这个模型，区别在于**把规则做得多严格**以及**与 Vue 响应式系统的耦合方式**。

---

## 二、Vuex 详解

### 2.1 Vuex 是什么

Vuex 是 Vue 官方早期的状态管理库，受 Flux / Redux 启发，核心思想是**单向数据流 + 严格约束**。

> 关键设计：**Mutation 是唯一修改 State 的地方**，且必须是同步函数。Action 负责异步，再提交 Mutation。

### 2.2 五大核心概念

| 概念 | 作用 | 是否可异步 | 直接修改 state |
|---|---|---|---|
| `state` | 存储数据 | — | — |
| `getters` | 派生/计算属性 | 否 | — |
| `mutations` | **唯一**修改 state 的入口 | ❌ 必须同步 | ✅ 唯一合法途径 |
| `actions` | 业务逻辑、异步请求 | ✅ 可异步 | ❌ 需 `commit` mutation |
| `modules` | 拆分大型 store | — | — |

### 2.3 数据流转图

```
Component ──dispatch──▶ Action ──commit──▶ Mutation ──▶ State ──▶ Component 更新
                │                              ▲
                └──────── 也可直接 commit ──────┘
```

### 2.4 基础用法

```js
// store/index.js (Vuex 4)
import { createStore } from 'vuex'

export default createStore({
  // 1. 状态：必须是纯对象
  state: () => ({
    count: 0,
    todos: []
  }),

  // 2. 派生状态：类似 computed，结果缓存
  getters: {
    doneTodos: (state) => state.todos.filter(t => t.done),
    doneCount: (state, getters) => getters.doneTodos.length,
    // 返回函数，用于传参（不缓存）
    getTodoById: (state) => (id) => state.todos.find(t => t.id === id)
  },

  // 3. 同步修改：唯一入口
  mutations: {
    INCREMENT(state, payload = 1) {
      state.count += payload
    },
    ADD_TODO(state, todo) {
      state.todos.push(todo)
    }
  },

  // 4. 异步/复杂逻辑
  actions: {
    async incrementAsync({ commit, state }, payload) {
      await new Promise(r => setTimeout(r, 300))
      commit('INCREMENT', payload)
    },
    async fetchTodos({ commit }) {
      const res = await fetch('/api/todos').then(r => r.json())
      commit('SET_TODOS', res)
    }
  },

  // 5. 严格模式：禁止在 mutation 之外修改 state（开发环境）
  strict: process.env.NODE_ENV !== 'production'
})
```

组件中使用：

```vue
<template>
  <p>{{ count }} / 已完成 {{ doneCount }}</p>
  <button @click="$store.commit('INCREMENT', 2)">+2</button>
  <button @click="$store.dispatch('incrementAsync', 2)">异步+2</button>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

// 方式一：直接取
const count = computed(() => store.state.count)
const doneCount = computed(() => store.getters.doneCount)

// 方式二：辅助函数（Vue3 下需配合 computed 恢复响应性）
import { mapState, mapGetters, mapMutations, mapActions } from 'vuex'
const { count } = mapState(['count'])
const { doneCount } = mapGetters(['doneCount'])
</script>

<!-- 熟悉 Vue2 的写法： -->
<!-- <script>
export default {
  computed: {
    ...mapState(['count']),
    ...mapGetters(['doneCount'])
  },
  methods: {
    ...mapMutations(['INCREMENT']),
    ...mapActions(['incrementAsync'])
  }
}
</script> -->
```

### 2.5 Modules 与命名空间

大型项目必然要拆模块。Vuex 的 `modules` 默认是**扁平合并**的，需要手动开启 `namespaced: true` 才能隔离。

```js
// store/modules/user.js
const state = () => ({ profile: null, token: '' })

const mutations = {
  SET_TOKEN(state, token) { state.token = token },
  SET_PROFILE(state, profile) { state.profile = profile }
}

const actions = {
  async login({ commit }, { username, password }) {
    const res = await api.login({ username, password })
    commit('SET_TOKEN', res.token)
    commit('SET_PROFILE', res.profile)
  }
}

const getters = {
  isLogin: (state) => !!state.token
}

export default {
  namespaced: true,   // 不加这句，所有 getter/mutation/action 会挂到全局
  state, getters, mutations, actions
}
```

```js
export default createStore({
  modules: {
    user: userModule,
    cart: cartModule
  },
  // 全局 state 形状：
  // { user: {...}, cart: {...} }
})
```

组件里访问命名空间：

```js
// 写法一：完整路径
store.dispatch('user/login', payload)
store.getters['user/isLogin']

// 写法二：命名空间辅助函数
import { createNamespacedHelpers } from 'vuex'
const { mapActions, mapState } = createNamespacedHelpers('user')
```

### 2.6 Vuex 的几个"坑"

| 坑 | 说明 |
|---|---|
| **`namespaced` 忘记加** | 模块内的 mutation 会串到全局，不同模块同名 mutation 互相覆盖 |
| **严格模式性能** | `strict: true` 会为每个 mutation 做深度 watch，大 state 下明显变慢 |
| **动态增删 state 属性不响应** | Vue2 需用 `Vue.set` / `Vue.delete`（Vuex 3）；Vuex 4 基于 Proxy 无此问题 |
| **辅助函数在 `<script setup>` 中失去响应性** | `mapState` 返回的是原始值，Vue3 下必须包一层 `computed` |
| **action 中直接改 state** | 严格模式会报警告，且 devtools 无法追踪这次变更 |
| **模块热更新复杂** | 需要手动 `store.hotUpdate()` |

### 2.7 Vuex 的实现原理（简述）

```js
// 极简核心：本质是一个"带插件系统的响应式对象 + 订阅机制"
function createStore({ state, mutations, actions, getters }) {
  const store = reactive({ state: state() })   // Vue3 reactive（Vue2 用 new Vue）
  const listeners = []

  // commit 只负责找到 mutation 并同步执行，然后通知订阅者
  function commit(type, payload) {
    mutations[type](store.state, payload)
    listeners.forEach(fn => fn({ type, payload }, store.state))
  }

  // dispatch 找到 action 执行，返回值透传（支持 Promise）
  function dispatch(type, payload) {
    return actions[type]({ commit, dispatch, state: store.state }, payload)
  }

  // getters 用 computed 实现缓存
  const computed = {}
  Object.keys(getters).forEach(key => {
    computed[key] = Vue.computed(() => getters[key](store.state, computed))
  })

  return { ...store, commit, dispatch, getters: computed, subscribe: fn => listeners.push(fn) }
}
```

> 面试要点：Vuex 用 `reactive` 包裹 state 实现响应式；用 `subscribe` 通知 devtools；Getter 用 `computed` 实现惰性缓存；严格模式靠 `deep watch` 比对快照。

---

## 三、Pinia 详解

### 3.1 Pinia 是什么

Pinia（西班牙语"菠萝"）是 **Vue 官方推荐的下一代状态管理库**，由 Vuex 核心团队成员 Eduardo San Martin Morote 开发，设计目标是：**更轻、更简单、完整支持 TypeScript、天然支持组合式 API**。

> 官方立场：**Vue 3 新项目请直接用 Pinia**，Vuex 5 的 RFC 已被放弃，Pinia 事实上就是"Vuex 下一代"。

### 3.2 核心概念（只有三个）

| 概念 | 等价 Vuex | 说明 |
|---|---|---|
| `state` | state | 数据 |
| `getters` | getters | 派生状态，本例中支持 this 访问其他 getter |
| `actions` | **mutations + actions + methods 三合一** | 可同步可异步，直接修改 state |

**关键简化：Pinia 没有 mutation，没有 namespace，没有 `$store` 单一实例。**

### 3.3 两种定义风格

#### 风格一：Option Store（类 Vuex 写法）

```js
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),

  getters: {
    double: (state) => state.count * 2,
    // 需要用到其他 getter 时，用 this（必须写普通函数，不能箭头函数）
    doublePlusOne() {
      return this.double + 1
    }
  },

  actions: {
    increment(payload = 1) {
      this.count += payload          // 直接改，无需 commit
    },
    async incrementAsync(payload) {
      await sleep(300)
      this.increment(payload)
    }
  }
})
```

#### 风格二：Setup Store（组合式 API 写法，**推荐**）

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

  // 必须 return 出去，否则外部访问不到
  return { count, double, increment, incrementAsync }
})
```

> 💡 Setup Store 的优势：**写法与 `<script setup>` 完全一致**，无概念切换成本；可以用任意 composable；但要注意 `return` 前不要解构会丢失响应性。

### 3.4 在组件中使用

```vue
<template>
  <p>{{ counter.count }} — {{ counter.double }}</p>
  <button @click="counter.increment()">+1</button>
</template>

<script setup>
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()

// ✅ 模板里直接用 counter.xxx 即可保持响应性（推荐）
// 注意：在模板外解构 counter 会丢失响应性，需要 storeToRefs
</script>
```

**⚠️ 解构会丢失响应性**，必须用 `storeToRefs`：

```js
import { storeToRefs } from 'pinia'

const counter = useCounterStore()

// ❌ 错：count 变成普通值，后续变化不更新
const { count, double } = counter

// ✅ 对：state 与 getters 用 storeToRefs
const { count, double } = storeToRefs(counter)

// ✅ actions 本质是函数，可直接解构
const { increment } = counter
```

### 3.5 修改 State 的四种方式

```js
const store = useCounterStore()

// 1. 直接改（最简单，推荐）
store.count++

// 2. $patch 对象形式：一次批量修改，只触发一次更新
store.$patch({ count: store.count + 1, name: 'Tom' })

// 3. $patch 函数形式：处理复杂逻辑
store.$patch((state) => {
  state.items.push({ id: 1, name: 'book' })
  state.hasChanged = true
})

// 4. 重置到初始 state
store.$reset()
```

> `$patch` 内部会做"合并"而非替换，数组 push 也可以被正确追踪。

### 3.6 订阅与插件

```js
// 监听 state 与 action
const unsubscribe = store.$subscribe((mutation, state) => {
  // mutation.type: 'direct' | 'patch object' | 'patch function'
  localStorage.setItem('counter', JSON.stringify(state))
}, { detached: true })   // detached: 组件卸载后仍生效

store.$onAction(({ name, args, after, onError }) => {
  console.log(`action ${name} 开始`, args)
  after((result) => console.log(`action ${name} 结束`, result))
  onError((err) => console.error(`action ${name} 报错`, err))
})
```

Pinia 插件（替代 Vuex 的插件 + 全局 mixin）：

```js
// stores/index.js
import { createPinia } from 'pinia'

const pinia = createPinia()

pinia.use(({ store }) => {
  // 给所有 store 注入一个 $api
  store.$api = api
  // 或统一做持久化
  const saved = localStorage.getItem(store.$id)
  if (saved) store.$patch(JSON.parse(saved))
})

app.use(pinia)
```

### 3.7 跨 store 互相调用

Pinia 里每个 store 就是一个模块，**无需 namespace**，直接引用即可：

```js
// stores/cart.js
import { defineStore } from 'pinia'
import { useUserStore } from './user'

export const useCartStore = defineStore('cart', {
  state: () => ({ items: [] }),
  getters: {
    // 跨 store 用 getter
    discount() {
      const user = useUserStore()
      return user.isVip ? 0.8 : 1
    }
  },
  actions: {
    async checkout() {
      const user = useUserStore()   // 必须在 action 内部调用，不能在模块顶层
      if (!user.isLogin) throw new Error('请先登录')
      // ...
    }
  }
})
```

> ⚠️ 注意：`useUserStore()` **必须在函数内部调用**（action / getter 里），不能写在模块顶层，否则会因 pinia 实例未激活而报错。

---

## 四、Pinia 与 Vuex 的区别对比

### 4.1 核心差异总览

| 维度 | Vuex (4.x) | Pinia (2.x) |
|---|---|---|
| **官方定位** | 维护模式（maintenance） | ✅ 官方推荐，新项目首选 |
| **Vue 版本** | Vuex 3 → Vue2；Vuex 4 → Vue3 | 仅 Vue3（Pinia 1.x 支持 Vue2） |
| **Mutation** | ✅ 必须，且必须同步 | ❌ **移除**，action 直接改 state |
| **命名空间** | 需 `namespaced: true` 手动开启 | ❌ **天然隔离**，每个 store 独立 |
| **TypeScript** | 支持较差，需大量手写类型 | ✅ **一流支持**，完整类型推导 |
| **组合式 API** | 需适配，辅助函数在 setup 中失去响应性 | ✅ **原生设计**，Setup Store 与 setup 同构 |
| **代码量** | 多（state/getters/mutations/actions 四件套） | 少（state/getters/actions 三件套） |
| **模块注册** | 静态 `createStore({ modules })` | 动态 `defineStore`，按需引入，**支持代码分割** |
| **严格模式** | 可开启（性能损耗） | 不需要（无 mutation 概念） |
| **DevTools 支持** | ✅ | ✅ 且支持时间线、action 追踪 |
| **SSR** | 支持 | 支持更好（`createPinia()` 每请求一份） |
| **体积** | ~10KB (gzip ~3KB) | ~5KB (gzip ~1.5KB) |
| **Store 实例** | 全局单一 `$store` | 多个独立 store，按需创建 |
| **动态增删 state** | Vuex 3 需 `Vue.set` | Proxy 天然支持 |
| **热更新** | `store.hotUpdate()` 复杂 | Vite/webpack HMR 自动支持 |
| **插件机制** | `plugins` + `subscribe` | `pinia.use()`，可访问全部 store |
| **跨模块调用** | `rootState` / `dispatch('other/xx')` | 直接 `useOtherStore()` |

### 4.2 代码结构对比

**Vuex 实现一个计数器：**

```js
// store/counter.js
export default {
  namespaced: true,
  state: () => ({ count: 0 }),
  getters: { double: (s) => s.count * 2 },
  mutations: {
    INCREMENT(state, n) { state.count += n }
  },
  actions: {
    incrementAsync({ commit }, n) {
      setTimeout(() => commit('INCREMENT', n), 300)
    }
  }
}

// 组件
store.dispatch('counter/incrementAsync', 1)
```

**Pinia 实现同一个计数器：**

```js
// stores/counter.js
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)
  function incrementAsync(n) {
    setTimeout(() => (count.value += n), 300)
  }
  return { count, double, incrementAsync }
})

// 组件
useCounterStore().incrementAsync(1)
```

**对比结论**：同一功能，Pinia 代码量减少约 **40%**，且不需要记忆 `commit` / `dispatch` 两套调用约定。

### 4.3 为什么 Pinia 要删掉 Mutation？

Vuex 引入 Mutation 的初衷是：

1. **让状态变更可追踪**（DevTools 时间旅行）
2. **强制同步**，避免异步竞态导致状态混乱

但实践下来：

- 单个 mutation 在 devtools 里会刷出两条记录（action + mutation），噪音大
- 强制拆分 mutation/action 只是**模板代码**，业务上很少真正受益
- 现代 DevTools 已经能通过 `$subscribe` 追踪任意变更

Pinia 的做法：**action 既是唯一修改入口，也天然被 DevTools 记录**，用一个概念替代两个。

> 面试答法：*"Mutation 的设计是 Flux 时代的遗留，用强约束换取可追踪性。Pinia 通过 DevTools 与 `$subscribe` 的能力提升，把约束从'框架强制'降级为'开发约定'，减少了模板代码，这是权衡后的简化，不是功能退化。"*

### 4.4 响应式机制差异

| | Vuex 3 (Vue2) | Vuex 4 (Vue3) | Pinia |
|---|---|---|---|
| 响应式内核 | `new Vue({ data })` / `Vue.observable` | `reactive()` | `reactive()` + `ref()` |
| 数组索引赋值 | 不响应 | 响应 | 响应 |
| 新增对象属性 | 需 `Vue.set` | 响应 | 响应 |
| 解构 store | 需 `mapState` | 需 `mapState` + computed | 需 `storeToRefs` |

> 三者都需要 `storeToRefs` / `mapState` 辅助解构，**因为解构本质是取值，值本身不是响应式引用**。这是响应式原理决定的，不是库的缺陷。

---

## 五、代码实例：同一需求两套实现

用一个完整的 **待办事项（Todo）+ 用户登录** 场景，分别用 Vuex 和 Pinia 实现，方便直接对照。

### 5.0 需求

- 用户登录后展示待办列表
- 支持新增、完成、删除待办
- 展示"已完成数量"和"完成率"
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

export interface TodoState {
  list: Todo[]
}

export const todo: Module<TodoState, RootState> = {
  namespaced: true,

  state: () => ({
    list: []
  }),

  getters: {
    doneList: (state) => state.list.filter(t => t.done),
    doneCount: (state, getters) => getters.doneList.length,
    // Vuex 中 getter 返回函数即可传参
    rate: (state, getters) =>
      state.list.length === 0
        ? 0
        : Math.round((getters.doneCount / state.list.length) * 100)
  },

  mutations: {
    SET_LIST(state, list: Todo[]) {
      state.list = list
    },
    ADD(state, todo: Todo) {
      state.list.push(todo)
    },
    TOGGLE(state, id: number) {
      const item = state.list.find(t => t.id === id)
      if (item) item.done = !item.done
    },
    REMOVE(state, id: number) {
      state.list = state.list.filter(t => t.id !== id)
    }
  },

  actions: {
    async fetchList({ commit }) {
      const res = await fetch('/api/todos')
      const data: Todo[] = await res.json()
      commit('SET_LIST', data)
    },
    addTodo({ commit, state }, title: string) {
      const id = Date.now()
      commit('ADD', { id, title, done: false })
      // Vuex 中访问兄弟模块需 rootState
    },
    toggle({ commit }, id: number) {
      commit('TOGGLE', id)
    },
    remove({ commit }, id: number) {
      commit('REMOVE', id)
    }
  }
}
```

```ts
// store/modules/user.ts
export const user: Module<UserState, RootState> = {
  namespaced: true,
  state: () => ({ profile: null as User | null }),
  getters: {
    isLogin: (state) => !!state.profile,
    isVip: (state) => state.profile?.isVip ?? false
  },
  mutations: {
    SET_PROFILE(state, p: User | null) {
      state.profile = p
    }
  },
  actions: {
    async login({ commit }, payload: { username: string; password: string }) {
      const user: User = await api.login(payload)
      commit('SET_PROFILE', user)
    },
    logout({ commit }) {
      commit('SET_PROFILE', null)
    }
  }
}
```

```ts
// store/index.ts
import { createStore, createLogger } from 'vuex'
import { todo } from './modules/todo'
import { user } from './modules/user'

export interface RootState {
  todo: TodoState
  user: UserState
}

const store = createStore<RootState>({
  modules: { todo, user },
  strict: import.meta.env.DEV,
  plugins: import.meta.env.DEV ? [createLogger()] : []
})

// 持久化：Vuex 需手写插件
store.subscribe((mutation, state) => {
  localStorage.setItem('vuex', JSON.stringify(state))
})

export default store
```

```vue
<!-- components/TodoList.vue -->
<template>
  <div v-if="isLogin">
    <p>完成率：{{ rate }}%（{{ doneCount }}/{{ list.length }}）</p>
    <ul>
      <li v-for="t in list" :key="t.id">
        <input type="checkbox" :checked="t.done" @change="toggle(t.id)" />
        <span :class="{ done: t.done }">{{ t.title }}</span>
        <button @click="remove(t.id)">删除</button>
      </li>
    </ul>
    <button @click="addTodo('新任务')">新增</button>
  </div>
  <button v-else @click="login({ username: 'a', password: 'b' })">登录</button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

// 必须用 computed 包裹才能保持响应性
const list = computed(() => store.state.todo.list)
const doneCount = computed(() => store.getters['todo/doneCount'])
const rate = computed(() => store.getters['todo/rate'])
const isLogin = computed(() => store.getters['user/isLogin'])

const addTodo = (title: string) => store.dispatch('todo/addTodo', title)
const toggle = (id: number) => store.dispatch('todo/toggle', id)
const remove = (id: number) => store.dispatch('todo/remove', id)
const login = (p: { username: string; password: string }) =>
  store.dispatch('user/login', p)
</script>
```

### 5.2 Pinia 实现（Setup Store）

```ts
// stores/todo.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './user'
import type { Todo } from '@/types'

export const useTodoStore = defineStore('todo', () => {
  // ===== state =====
  const list = ref<Todo[]>([])

  // ===== getters =====
  const doneList = computed(() => list.value.filter(t => t.done))
  const doneCount = computed(() => doneList.value.length)
  const rate = computed(() =>
    list.value.length === 0
      ? 0
      : Math.round((doneCount.value / list.value.length) * 100)
  )

  // ===== actions =====
  async function fetchList() {
    const res = await fetch('/api/todos')
    list.value = await res.json()
  }

  function addTodo(title: string) {
    const user = useUserStore()          // 跨 store 直接拿到实例
    if (!user.isLogin) throw new Error('请先登录')
    list.value.push({ id: Date.now(), title, done: false })
  }

  function toggle(id: number) {
    const item = list.value.find(t => t.id === id)
    if (item) item.done = !item.done   // 直接改，无需 mutation
  }

  function remove(id: number) {
    list.value = list.value.filter(t => t.id !== id)
  }

  return { list, doneList, doneCount, rate, fetchList, addTodo, toggle, remove }
})
```

```ts
// stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  const profile = ref<User | null>(null)

  const isLogin = computed(() => !!profile.value)
  const isVip = computed(() => profile.value?.isVip ?? false)
  const displayName = computed(() => profile.value?.name ?? '游客')

  async function login(payload: { username: string; password: string }) {
    profile.value = await api.login(payload)
  }
  function logout() {
    profile.value = null
  }

  return { profile, isLogin, isVip, displayName, login, logout }
})
```

```vue
<!-- components/TodoList.vue -->
<template>
  <div v-if="isLogin">
    <p>完成率：{{ rate }}%（{{ doneCount }}/{{ list.length }}）</p>
    <ul>
      <li v-for="t in list" :key="t.id">
        <input type="checkbox" :checked="t.done" @change="toggle(t.id)" />
        <span :class="{ done: t.done }">{{ t.title }}</span>
        <button @click="remove(t.id)">删除</button>
      </li>
    </ul>
    <button @click="addTodo('新任务')">新增</button>
  </div>
  <button v-else @click="login({ username: 'a', password: 'b' })">登录</button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTodoStore } from '@/stores/todo'
import { useUserStore } from '@/stores/user'

const todoStore = useTodoStore()
const userStore = useUserStore()

// state 与 getters 用 storeToRefs 保持响应性
const { list, doneCount, rate } = storeToRefs(todoStore)
// actions 可直接解构
const { addTodo, toggle, remove } = todoStore
const { isLogin } = storeToRefs(userStore)
const { login } = userStore
</script>

<style scoped>
.done { text-decoration: line-through; color: #999; }
</style>
```

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
defineStore('todo', () => { /* ... */ }, {
  persist: {
    key: 'todo-store',
    storage: localStorage,
    pick: ['list']       // 只持久化 list
  }
})
```

### 5.4 Pinia 单元测试

```ts
// tests/todo.spec.ts
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect } from 'vitest'
import { useTodoStore } from '@/stores/todo'

describe('todo store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())   // 每个用例独立 pinia 实例
  })

  it('新增待办', () => {
    const store = useTodoStore()
    store.addTodo('学 Pinia')
    expect(store.list).toHaveLength(1)
    expect(store.list[0].title).toBe('学 Pinia')
  })

  it('完成率计算正确', () => {
    const store = useTodoStore()
    store.list = [
      { id: 1, title: 'a', done: true },
      { id: 2, title: 'b', done: false }
    ]
    expect(store.rate).toBe(50)
  })
})
```

> 测试优势：Pinia 无需 `createStore` 全局单例，`setActivePinia` 即可获得干净实例，**测试隔离天然友好**；Vuex 则需重新 `createStore` 并 mock modules。

---

## 六、迁移指南：Vuex → Pinia

### 6.1 映射关系

| Vuex | Pinia |
|---|---|
| `state: () => ({})` | `const x = ref()` / `ref({})` |
| `getters: { a: s => s.x }` | `const a = computed(() => x.value)` |
| `mutations: { M(s, p) {} }` + `commit('M', p)` | 直接写 action 函数 |
| `actions: { A({commit}) {} }` + `dispatch('A')` | `function A() {}` 直接调用 |
| `modules: { user }` + `namespaced` | `defineStore('user', ...)` |
| `mapState(['x'])` | `storeToRefs(store).x` |
| `rootState.other.y` | `useOtherStore().y` |
| `createStore({ plugins })` | `pinia.use(plugin)` |
| `store.subscribe` | `store.$subscribe` |

### 6.2 迁移步骤

1. `npm i pinia pinia-plugin-persistedstate`，移除 `vuex`
2. `main.ts` 中 `app.use(createPinia())` 替换 `app.use(store)`
3. 每个 Vuex module 改写为一个 `defineStore`（推荐 Setup Store）
4. mutation 逻辑直接内联到 action 中
5. 组件中 `useStore()` → 按模块 `useXxxStore()`
6. `mapState` → `storeToRefs`，`mapActions` → 直接解构
7. TypeScript 类型从手写改为 `ReturnType<typeof useXxxStore>`
8. 检查插件（持久化/日志）替换为 Pinia 等价实现

### 6.3 渐进式迁移技巧

Pinia 与 Vuex **可以在同一项目共存**（新的用 Pinia，旧的不动），因为两者互不侵入。迁移期可以：

```ts
// 旧代码继续用 useStore()，新代码用 useXxxStore()
// 需要互相访问时，包一层 adapter
import { useUserStore } from '@/stores/user'
const userStore = useUserStore()

// 在 Vuex action 里读 Pinia
export const someAction = () => {
  const userStore = useUserStore()   // ✅ 只要 pinia 已 install 即可
}
```

---

## 七、高频面试题总结

### Q1：Pinia 和 Vuex 的核心区别是什么？

**答题框架（三点）**

1. **API 层面**：Pinia 移除了 mutation，action 直接修改 state，且可同步可异步，概念从 4 个减到 3 个
2. **模块层面**：Pinia 天然模块化（每个 `defineStore` 独立），无需 `namespaced`；支持按需引入与代码分割
3. **工程层面**：Pinia 对 TypeScript 支持一流（自动推导），与组合式 API 同构，体积更小（~1.5KB gzip）

> 加分项：提及 Vuex 5 的 RFC 被放弃、Pinia 被官方列为推荐方案、Vuex 进入维护模式。

---

### Q2：Pinia 为什么删掉了 mutation？会不会导致状态难以追踪？

不会。理由：

- **可追踪性由 DevTools + `$subscribe` 保障**，不依赖 mutation 这一层抽象
- Vuex 中一次异步操作会在 DevTools 留下 `action + mutation` 两条记录，噪音大于价值
- mutation 强制同步的限制实际收益有限，异步竞态应通过业务层（如 loading 锁、请求取消）处理

> 结论：这是**用开发约定替代框架强制**的权衡，减少了模板代码，没有损失调试能力。

---

### Q3：Pinia 的 store 是怎么实现响应式的？

- Option Store：内部用 `reactive()` 包裹 state 对象，getters 用 `computed()` 包裹
- Setup Store：直接使用用户返回的 `ref` / `computed`
- 整体 store 是一个 `reactive` 代理对象，`$patch` 内部走 `reactive` 的 setter，因此所有修改都会被捕获
- 因此：**解构 state/getter 会丢失响应性**，必须用 `storeToRefs`（它内部对每个 key 调 `toRef`）

```ts
// storeToRefs 近似实现
function storeToRefs(store) {
  const refs = {}
  for (const key in store) {
    const val = store[key]
    if (isRef(val) || isReactive(val)) {
      refs[key] = toRef(store, key)
    }
  }
  return refs
}
```

---

### Q4：Vuex 的 mutation 和 action 有什么区别？为什么 action 不能直接改 state？

| | mutation | action |
|---|---|---|
| 是否同步 | 必须同步 | 可异步 |
| 修改 state | ✅ 唯一合法途径 | ❌ 需 commit mutation |
| 调用方式 | `commit` | `dispatch` |
| 能否互相调用 | 不能调用 action | 可 commit 多个 mutation / dispatch 其他 action |
| DevTools 记录 | 每次一条 | 记录为 pending → resolved |

**action 不能直接改 state 的原因**：

1. **可追踪性**：mutation 是同步的，DevTools 可以精确记录"变更前 / 变更后"快照，实现时间旅行
2. **时序确定性**：异步回调时机不确定，如果允许直接改，多个异步操作竞争时无法复现问题
3. **严格模式**：`strict: true` 会深度监听 state，非 mutation 修改会直接抛错

---

### Q5：Vuex 的严格模式有什么代价？

`strict: true` 内部通过 `store._vm.$watch(state, () => { ... }, { deep: true, sync: true })` 对整棵 state 做**深度同步监听**。每次 mutation 后都会比对一次完整快照：

- state 越大，性能损耗越明显
- 大数据列表（上万条）下可能造成明显卡顿
- 生产环境必须关闭

Pinia 没有这个概念，因为不需要。

---

### Q6：`mapState` / `mapGetters` 在 Vue3 中为什么"失效"了？

因为二者返回的是**普通对象/值**，不是 `ref`。在 Vue2 中它们被混入 `computed` 所以有响应性；在 `<script setup>` 中没有 `this` 也没有 `computed` 容器，直接使用会拿到快照值。

正确做法：

```js
// Vuex 4 + setup
const store = useStore()
const count = computed(() => store.state.count)   // 手动包 computed

// Pinia
const { count } = storeToRefs(useCounterStore())
```

---

### Q7：Pinia 中如何实现跨 store 调用？有什么坑？

```js
// stores/cart.js
import { useUserStore } from './user'

export const useCartStore = defineStore('cart', {
  actions: {
    checkout() {
      const user = useUserStore()   // ✅ 在函数内调用
    }
  }
})
```

**坑**：不能在模块顶层调用 `useUserStore()`，此时 pinia 实例尚未 install，会抛出 `getActivePinia was called with no active Pinia`。

如果确实需要在模块顶层使用（如工具函数），可以显式传入实例：

```js
const pinia = createPinia()
app.use(pinia)
// 之后
useUserStore(pinia)   // 显式传入
```

---

### Q8：Pinia 的 `$patch` 有什么作用？什么时候用？

- **作用**：一次批量修改多个 state，**只触发一次响应式更新**，减少渲染次数
- **场景**：表单批量提交、初始数据灌入、从 localStorage 恢复
- **与直接赋值区别**：`store.$patch({ list: [...] })` 是**合并**；`store.list = [...]` 是**替换**（若 store 是 reactive 对象，直接赋整个对象会破坏引用）

```js
// 数组场景对比
store.list = newList          // ✅ 可以（ref 场景）
store.$patch({ list: newList }) // ✅ 也可以，且一次更新
```

**函数形式**适合复杂逻辑：

```js
store.$patch((state) => {
  state.items.push(newItem)
  state.total += newItem.price
  state.updatedAt = Date.now()
})
```

---

### Q9：Pinia 如何做持久化？为什么不用手写？

- 官方推荐 `pinia-plugin-persistedstate`
- 原理：`pinia.use()` 注册插件，在插件里对每个 store 注册 `$subscribe`，变更时写入 storage，初始化时读取并 `$patch`
- 相比 Vuex 手写 `subscribe`，Pinia 插件可以**按 store 配置 key/storage/白名单**，更灵活

```ts
defineStore('user', () => {...}, {
  persist: { key: 'user', pick: ['token', 'profile'] }
})
```

---

### Q10：什么情况下还应该用 Vuex 而不是 Pinia？

只有两类：

1. **老项目 Vue2 + Vuex 3 稳定运行**，迁移收益不足以覆盖风险（Pinia 1.x 虽支持 Vue2，但生态不如 Vuex 3 成熟）
2. **团队强依赖 mutation → 时间旅行的严格工作流**（极少数，如某些审计场景）

除此之外，**新项目一律选 Pinia**。

---

### Q11：Pinia 的 store 是一个单例吗？

是。`defineStore('id', ...)` 只定义了"工厂"，**首次调用 `useXxxStore()` 时创建实例并缓存**，之后返回同一个实例（通过 `pinia._s` Map 缓存）。

```js
const a = useCounterStore()
const b = useCounterStore()
console.log(a === b)   // true
```

**跨请求 SSR 时必须每请求新建 pinia 实例**，否则会串数据：

```js
// server.js
app.use((req, res, next) => {
  const pinia = createPinia()          // 每请求一份
  app.use(pinia)
  // ...
})
```

---

### Q12：Pinia 支持 Vue2 吗？

- **Pinia 1.x** 支持 Vue 2.6+
- **Pinia 2.x** 仅支持 Vue 3
- 需要 Composition API（Vue2 需装 `@vue/composition-api`）

官方建议：Vue2 项目如果暂不升级，继续用 Vuex 3 更稳妥。

---

### Q13：Vuex 的 modules 为什么要 `namespaced: true`？

默认情况下，Vuex 把所有 module 的 `getters` / `mutations` / `actions` **扁平注册到根 store**：

- 两个模块都有 `SET_LIST` mutation → **后者覆盖前者**
- 两个模块都有 `loading` state → state 是隔离的（按 module 嵌套），但 mutation 不隔离

`namespaced: true` 后，调用路径变为 `'moduleName/actionName'`，实现逻辑隔离。

Pinia 不存在这个问题，因为每个 store 是独立实例。

---

### Q14：Pinia 相比 Vuex 在 TypeScript 上的优势具体是什么？

**Vuex 的类型痛点**：

```ts
// 需要手写 RootState 与 Module 泛型
interface RootState { user: UserState }
// action 的 payload 类型靠手写
// this.$store 类型需 module augmentation
declare module 'vuex' {
  interface Store<S> { ... }
}
```

**Pinia**：

```ts
const store = useCounterStore()
store.count        // number，自动推导
store.increment(1) // 参数类型自动推导
// store 类型 = ReturnType<typeof useCounterStore>
type CounterStore = ReturnType<typeof useCounterStore>
```

零额外类型声明，**IDE 补全和跳转完全可用**。

---

### Q15：Vuex 中如何优雅地处理异步？Pinia 呢？

**Vuex**：只能放 action，且必须返回 Promise 才能 `.then`

```js
actions: {
  async fetchData({ commit }) {
    const data = await api.get()
    commit('SET_DATA', data)
    return data          // 必须 return，组件才能 await
  }
}
// 组件
await store.dispatch('fetchData')
```

**Pinia**：action 就是普通函数，直接返回值即可

```js
async function fetchData() {
  list.value = await api.get()
  return list.value
}
// 组件
await store.fetchData()
```

---

### Q16：Pinia 的 `$onAction` 和 `$subscribe` 有什么区别？

| | `$subscribe` | `$onAction` |
|---|---|---|
| 监听对象 | **state 变化** | **action 调用** |
| 触发时机 | state 变更后 | action 执行前/后/出错时 |
| 参数 | `(mutation, state)` | `({ name, args, after, onError })` |
| 典型用途 | 持久化、埋点、审计 | 全局 loading、错误上报、性能监控 |

```js
// 全局 loading 示例
store.$onAction(({ name, after, onError }) => {
  if (name !== 'fetchData') return
  loading.value = true
  after(() => (loading.value = false))
  onError(() => (loading.value = false))
})
```

---

### Q17：Vuex 的 state 为什么必须是函数？

因为 **module 复用**。如果是对象，多个 module 实例（或 SSR 的多个请求）会共享同一份引用，造成数据污染。

```js
// ❌ 对象：所有实例共享
state: { count: 0 }

// ✅ 函数：每次调用返回新对象
state: () => ({ count: 0 })
```

Pinia 的 Setup Store 用 `ref` 天然每次创建新值，无此问题；Option Store 的 `state` 也要求是函数。

---

### Q18：如何做状态管理的性能优化？

1. **按需引入 store**：Pinia 天然支持，避免打包全量
2. **getter 缓存**：getter 内部避免副作用，纯函数才能命中 computed 缓存
3. **`$patch` 批量更新**：减少渲染次数
4. **`shallowRef` / `markRaw`**：大对象、图表实例不应被深度代理
5. **`storeToRefs` 精准订阅**：只取用到的字段，避免整个 store 变化触发组件更新
6. **拆分 store 粒度**：按业务域拆，避免一个巨型 store（Vuex 的巨型 module 尤其危险）
7. **关闭 Vuex strict**（生产环境）
8. **持久化做防抖**：`$subscribe` 中写 localStorage 时加 throttle

```js
import { debounce } from 'lodash-es'
const save = debounce((state) => {
  localStorage.setItem('cart', JSON.stringify(state))
}, 300)
store.$subscribe((_, state) => save(state))
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
store.$reset()
```

### 8.2 选型决策

```
新项目（Vue3）
  └─▶ Pinia ✅ 无脑选

老项目（Vue2 + Vuex3）
  ├─ 稳定运行，无重构预算 ──▶ 保持 Vuex
  └─ 有计划升级 Vue3 ──▶ 先升 Vue3，再迁 Pinia

需要严格时间旅行/审计
  └─▶ Vuex（strict）或自建 devtools 插件
```

### 8.3 一句话记住

> **Vuex 是"流程严格但啰嗦"的旧规范，Pinia 是"约定优于配置"的现代方案。Vue3 时代，Pinia 就是标准答案。**

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
- [ ] SSR 每请求 `createPinia()`
- [ ] 检查类型定义（移除手写 `RootState` / `Module` 泛型）
