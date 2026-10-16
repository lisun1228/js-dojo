<template>
  <DemoPanel
    :logs="logs"
    hint="依次运行三个用例，观察 this 的指向差异。"
    @clear="clear"
  >
    <button class="run" @click="runMyCall">运行：myCall</button>
    <button class="run" @click="runMyBind">运行：myBind（普通调用）</button>
    <button class="run" @click="runMyBindNew">运行：myBind + new</button>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

type AnyFn = (this: any, ...args: any[]) => any

// 挂到 Function.prototype 上，等价于 `fn.myCall(ctx)` / `fn.myBind(ctx)`
const proto = Function.prototype as any

proto.myCall = function (this: AnyFn, ctx: any, ...args: any[]) {
  ctx = ctx || globalThis

  const key = Symbol('temp')
  ctx[key] = this

  const res = ctx[key](...args)

  delete ctx[key]
  return res
}

proto.myBind = function (this: AnyFn, ctx: any, ...bindArgs: any[]) {
  const originFn = this

  function boundFn(this: any, ...innerArgs: any[]) {
    const allArgs = [...bindArgs, ...innerArgs]
    // new 调用时 this 是新实例
    if (this instanceof boundFn) {
      return originFn.apply(this, allArgs)
    }
    return originFn.apply(ctx, allArgs)
  }

  // 保留原型链
  boundFn.prototype = Object.create(originFn.prototype)
  boundFn.prototype.constructor = boundFn

  return boundFn
}

const runMyCall = () => {
  push('▶ myCall：立即执行，this 指向传入的对象')
  function test(this: any) {
    push('  this.name = ' + this.name + '，this.age = ' + this.age)
  }
  const res = (test as any).myCall({ name: '张三', age: 18 })
  push('  返回值 res = ' + res)
}

const runMyBind = () => {
  push('▶ myBind：返回新函数，this 指向绑定的对象')
  const user = { name: '李四' }
  function greet(this: any, a: number, b: number) {
    push('  ' + this.name + ' ' + a + ' ' + b)
  }
  const bound = (greet as any).myBind(user, 100)
  bound(200)
  push('  → 输出「李四 100 200」')
}

const runMyBindNew = () => {
  push('▶ myBind + new：new 优先级高于 bind，this 变成新实例')
  const user = { name: '李四' }
  function greet(this: any, a: number, b: number) {
    push('  this.name = ' + this.name + '，参数 ' + a + ' ' + b)
  }
  const bound = (greet as any).myBind(user, 100)
  const ins = new bound(300)
  push('  实例 instanceof greet → ' + (ins instanceof greet))
}
</script>
