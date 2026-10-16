<template>
  <DemoPanel
    :logs="logs"
    hint="逐条验证原型链上的引用关系（用 Object.getPrototypeOf 代替 __proto__）。"
    @clear="clear"
  >
    <button
      class="run"
      @click="runObject"
    >
      验证：对象原型链
    </button>
    <button
      class="run"
      @click="runFunction"
    >
      验证：函数原型链
    </button>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

const check = (label: string, ok: boolean) => {
  push('  ' + (ok ? '✅' : '❌') + ' ' + label + ' → ' + ok)
}

const runObject = () => {
  push('▶ 对象原型链')
  function Person() {}
  // 等价于 new Person()，用 Object.create 更直接地体现「实例的原型」
  const p = Object.create(Person.prototype)

  check('p.__proto__ === Person.prototype', Object.getPrototypeOf(p) === Person.prototype)
  check('Person.prototype.constructor === Person', Person.prototype.constructor === Person)
  check(
    'Person.prototype.__proto__ === Object.prototype',
    Object.getPrototypeOf(Person.prototype) === Object.prototype,
  )
  check('Object.prototype.__proto__ === null', Object.getPrototypeOf(Object.prototype) === null)

  push('  p → Person.prototype → Object.prototype → null')
}

const runFunction = () => {
  push('▶ 函数原型链')
  function fn() {}

  check('fn.__proto__ === Function.prototype', Object.getPrototypeOf(fn) === Function.prototype)
  check(
    'Function.__proto__ === Function.prototype（自指特例）',
    Object.getPrototypeOf(Function) === Function.prototype,
  )
  check(
    'Function.prototype.__proto__ === Object.prototype',
    Object.getPrototypeOf(Function.prototype) === Object.prototype,
  )
  check('Object.prototype.__proto__ === null', Object.getPrototypeOf(Object.prototype) === null)

  push('  fn → Function.prototype → Object.prototype → null')
}
</script>
