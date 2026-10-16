<template>
  <DemoPanel
    :logs="logs"
    hint="分别运行两种代理，对比深层属性赋值时 set 是否被拦截。"
    @clear="clear"
  >
    <button
      class="run"
      @click="runShallow"
    >
      运行：只代理最外层
    </button>
    <button
      class="run"
      @click="runDeep"
    >
      运行：惰性递归 + 缓存
    </button>
  </DemoPanel>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- Proxy 处理器需兼容任意对象，仅用于演示 */
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

/* 只代理最外层：get 直接返回原始值 */
const runShallow = () => {
  push('▶ 只代理最外层')
  const obj = { a: 1, inner: { b: 2 } }
  const p = new Proxy(obj, {
    get(target, key) {
      push('  get ' + String(key))
      return Reflect.get(target, key)
    },
    set(target, key, value) {
      push('  set ' + String(key) + ' = ' + String(value))
      return Reflect.set(target, key, value)
    },
  })

  p.a = 10
  push('  —— p.inner.b = 20 ——')
  p.inner.b = 20
  push('  ⚠ 只有 a 触发了 set，inner.b 没有')
}

/* 惰性递归 + WeakMap 缓存 */
const runDeep = () => {
  push('▶ 惰性递归 + WeakMap 缓存')
  const cache = new WeakMap<object, object>()

  const reactive = (target: any): any => {
    if (target === null || typeof target !== 'object') return target
    if (cache.has(target)) return cache.get(target)

    const proxy = new Proxy(target, {
      get(t, key) {
        return reactive(Reflect.get(t, key))
      },
      set(t, key, value) {
        push('  set ' + String(key) + ' = ' + String(value))
        return Reflect.set(t, key, value)
      },
    })

    cache.set(target, proxy)
    return proxy
  }

  const state = reactive({ a: 1, inner: { b: 2 } })

  state.a = 10
  push('  —— state.inner.b = 20 ——')
  state.inner.b = 20
  push('  ✅ inner.b 也触发了 set')
  push('  缓存生效：state.inner === state.inner → ' + (state.inner === state.inner))
}
</script>
