<template>
  <DemoPanel
    :logs="logs"
    hint="运行后修改数据，观察 track / trigger 日志与 effect 的重新执行。"
    @clear="clear"
  >
    <button
      class="run"
      @click="run"
    >
      运行：track / trigger / effect
    </button>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

const run = () => {
  push('▶ 响应式原理：track / trigger / effect')

  const targetMap = new WeakMap<object, Map<string, Set<() => void>>>()
  let activeEffect: (() => void) | null = null

  // 收集依赖：把当前 effect 存进 target[key] 的集合里
  function track(target: object, key: string) {
    if (!activeEffect) return

    let depsMap = targetMap.get(target)
    if (!depsMap) targetMap.set(target, (depsMap = new Map()))

    let dep = depsMap.get(key)
    if (!dep) depsMap.set(key, (dep = new Set()))

    dep.add(activeEffect)
    push('  track ' + key + '：收集当前 effect')
  }

  // 触发更新：取出该 key 的所有 effect 依次执行
  function trigger(target: object, key: string) {
    const depsMap = targetMap.get(target)
    if (!depsMap) return

    const dep = depsMap.get(key)
    if (!dep) return

    push('  trigger ' + key + '：重新执行 ' + dep.size + ' 个 effect')
    dep.forEach((fn) => fn())
  }

  function reactive<T extends object>(target: T): T {
    return new Proxy(target, {
      get(t, key, receiver) {
        const res = Reflect.get(t, key, receiver)
        track(t, String(key))
        return res
      },
      set(t, key, value, receiver) {
        const ok = Reflect.set(t, key, value, receiver)
        trigger(t, String(key))
        return ok
      },
    })
  }

  function effect(fn: () => void) {
    activeEffect = fn
    fn() // 执行过程中读属性 → get → track 收集依赖
    activeEffect = null
  }

  const state = reactive({ name: 'vue', age: 18 })

  push('— 注册两个 effect —')
  effect(() => push('  effect#1：name = ' + state.name))
  effect(() => push('  effect#2：age = ' + state.age))

  push('— 修改 state.name（只应触发 effect#1）—')
  state.name = 'vue3'

  push('— 修改 state.age（只应触发 effect#2）—')
  state.age = 20
}
</script>
