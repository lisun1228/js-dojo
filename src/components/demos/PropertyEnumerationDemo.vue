<template>
  <DemoPanel
    :logs="logs"
    hint="同一个对象跑四种枚举方式，再对比 Proxy 陷阱、可枚举性来源与复制行为。"
    @clear="clear"
  >
    <button
      class="run"
      @click="runCompare"
    >
      运行：四种方式对比
    </button>
    <button
      class="run"
      @click="runProxy"
    >
      运行：Proxy 陷阱追踪
    </button>
    <button
      class="run"
      @click="runEnumerable"
    >
      运行：可枚举性来源
    </button>
    <button
      class="run"
      @click="runCopy"
    >
      运行：assign / 展开 / JSON
    </button>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

const show = (keys: readonly (string | symbol)[]) =>
  keys.map((key) => String(key)).join(', ') || '（空）'

const collectForIn = (target: object) => {
  const keys: string[] = []
  for (const key in target) keys.push(key)
  return keys
}

/** 同时含整数键、字符串键、Symbol、不可枚举键与继承键的样例 */
const makeSample = () => {
  const sym = Symbol('s')
  const obj = Object.create({ inherited: 1 }) as Record<PropertyKey, unknown>
  obj.b = 1
  obj[2] = 'two'
  obj.a = 2
  obj[1] = 'one'
  obj[sym] = 'sym'
  Object.defineProperty(obj, 'hidden', { value: 1, enumerable: false })
  return obj
}

const runCompare = () => {
  clear()
  const obj = makeSample()
  push('▶ 自有：b、2、a、1、Symbol(s)、不可枚举 hidden；继承：inherited')
  push(`  Object.keys → ${show(Object.keys(obj))}`)
  push(`  for...in → ${show(collectForIn(obj))}`)
  push(`  Object.getOwnPropertyNames → ${show(Object.getOwnPropertyNames(obj))}`)
  push(`  Reflect.ownKeys → ${show(Reflect.ownKeys(obj))}`)
}

const runProxy = () => {
  clear()
  const target = { a: 1 } as Record<PropertyKey, unknown>
  target[Symbol('s')] = 2
  Object.defineProperty(target, 'hidden', { value: 3, enumerable: false })

  const trace = (name: string, action: (proxy: Record<PropertyKey, unknown>) => void) => {
    const steps: string[] = []
    const proxy = new Proxy(target, {
      ownKeys: (t) => {
        steps.push('ownKeys')
        return Reflect.ownKeys(t)
      },
      getOwnPropertyDescriptor: (t, key) => {
        steps.push(`gopd:${String(key)}`)
        return Reflect.getOwnPropertyDescriptor(t, key)
      },
      get: (t, key, receiver) => {
        steps.push(`get:${String(key)}`)
        return Reflect.get(t, key, receiver)
      },
    })
    action(proxy)
    push(`  ${name} → ${steps.join(' → ')}`)
  }

  push('▶ target：a、Symbol(s)、不可枚举 hidden')
  trace('Reflect.ownKeys', (proxy) => {
    void Reflect.ownKeys(proxy)
  })
  trace('Object.getOwnPropertyNames', (proxy) => {
    void Object.getOwnPropertyNames(proxy)
  })
  trace('Object.keys', (proxy) => {
    void Object.keys(proxy)
  })
  trace('for...in', (proxy) => {
    collectForIn(proxy)
  })
  trace('Object.assign', (proxy) => {
    Object.assign({}, proxy)
  })
  trace('JSON.stringify', (proxy) => {
    void JSON.stringify(proxy)
  })
}

const runEnumerable = () => {
  clear()
  const literal = { visible: 1 }
  Object.defineProperty(literal, 'hidden', { value: 2 })
  push('▶ 字面量 + defineProperty（不写 enumerable 默认 false）')
  push(`  Object.keys → ${show(Object.keys(literal))}`)
  push(`  getOwnPropertyNames → ${show(Object.getOwnPropertyNames(literal))}`)

  class Sample {
    method() {}
  }
  push('▶ class 原型上的方法')
  push(`  Object.keys(Sample.prototype) → ${show(Object.keys(Sample.prototype))}`)
  push(`  Reflect.ownKeys(Sample.prototype) → ${show(Reflect.ownKeys(Sample.prototype))}`)

  const arr = [1, 2]
  push('▶ 数组的 length')
  push(`  Object.keys → ${show(Object.keys(arr))}`)
  push(`  Reflect.ownKeys → ${show(Reflect.ownKeys(arr))}`)

  const withSymbol = { [Symbol('x')]: 1 }
  push('▶ 可枚举的 Symbol 键')
  push(`  Object.keys → ${show(Object.keys(withSymbol))}`)
  push(`  Reflect.ownKeys → ${show(Reflect.ownKeys(withSymbol))}`)
}

const runCopy = () => {
  clear()
  const sym = Symbol('s')
  let reads = 0
  const source = {
    visible: 1,
    get computed() {
      reads += 1
      return 2
    },
    [sym]: 3,
  }
  Object.defineProperty(source, 'hidden', { value: 4, enumerable: false })

  push(`▶ Object.keys → ${show(Object.keys(source))}，getter 触发 ${reads} 次`)
  const assigned = Object.assign({}, source)
  push(`▶ Object.assign → ${show(Reflect.ownKeys(assigned))}，getter 触发 ${reads} 次`)
  const spread = { ...source }
  push(`▶ 展开 → ${show(Reflect.ownKeys(spread))}，getter 触发 ${reads} 次`)
  const json = JSON.stringify(source)
  push(`▶ JSON.stringify → ${json}，getter 触发 ${reads} 次`)
  push('  结论：Symbol 会被 assign / 展开复制，但不会进 JSON；hidden 三者都拿不到')
}
</script>
