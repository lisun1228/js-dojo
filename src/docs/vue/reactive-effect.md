# 响应式原理：track / trigger 与 effect

Vue 3 响应式的核心是三个角色：

- **activeEffect**：当前正在执行的副作用函数
- **targetMap**：`WeakMap<target, Map<key, Set<effect>>>`，记录「哪个对象的哪个属性」被「哪些 effect」依赖
- **effect(fn)**：执行 `fn` 并收集依赖；数据变化时由 `trigger` 重新执行

---

## 目录

- [track（收集依赖）](#track收集依赖)
- [trigger（触发更新）](#trigger触发更新)
- [用 Proxy 把两者串起来](#用-proxy-把两者串起来)
- [effect](#effect)

---

## track（收集依赖）

在 `get` 阶段，把当前的 `activeEffect` 记录到 `targetMap` 对应 key 的 `Set` 里。

```js
const targetMap = new WeakMap()
let activeEffect = null

function track(target, key) {
  if (!activeEffect) return

  let depsMap = targetMap.get(target)
  if (!depsMap) targetMap.set(target, (depsMap = new Map()))

  let dep = depsMap.get(key)
  if (!dep) depsMap.set(key, (dep = new Set()))

  dep.add(activeEffect)
}
```

## trigger（触发更新）

在 `set` 阶段，取出该 key 对应的所有 effect 依次执行。

```js
function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)
  dep?.forEach((effect) => effect())
}
```

## 用 Proxy 把两者串起来

```js
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver)
      track(target, key)          // 读取时收集依赖
      return res
    },
    set(target, key, value, receiver) {
      const ok = Reflect.set(target, key, value, receiver)
      trigger(target, key)        // 赋值时触发更新
      return ok
    },
  })
}
```

## effect

```js
function effect(fn) {
  activeEffect = fn   // 标记当前 effect
  fn()                // 执行过程中读属性 → get → track 收集 activeEffect
  activeEffect = null // 收集完清空
}

const state = reactive({ name: 'vue', age: 18 })

effect(() => console.log('name =', state.name))  // 依赖：state.name
effect(() => console.log('age =', state.age))    // 依赖：state.age

state.name = 'vue3'  // 只重新执行第一个 effect
state.age = 20       // 只重新执行第二个 effect
```

> 关键：**精确到属性级**的依赖收集。`name` 变化不会带着 `age` 的 effect 一起跑，这就是细粒度响应式的来源。
