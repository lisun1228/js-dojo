<template>
  <DemoPanel
    :logs="logs"
    hint="按顺序运行四个用例：优先级链、丢失 this 的现场、new 与 bind 的冲突、严格模式下的装箱。"
    @clear="clear"
  >
    <button
      class="run"
      @click="runPriority"
    >
      运行：优先级链
    </button>
    <button
      class="run"
      @click="runLost"
    >
      运行：丢失 this 的现场
    </button>
    <button
      class="run"
      @click="runNewBind"
    >
      运行：new 与 bind 谁优先
    </button>
    <button
      class="run"
      @click="runStrict"
    >
      运行：严格模式与原语
    </button>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

type Ctx = { tag?: string; mode?: string; constructed?: boolean }

const label = (value: unknown): string => {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (value === globalThis) return 'globalThis'
  if (typeof value === 'object') {
    return (value as Ctx).tag ?? Object.prototype.toString.call(value)
  }
  return String(value)
}

function whoAmI(this: Ctx | void) {
  push(`  this = ${label(this)}`)
}

const runPriority = () => {
  clear()
  const holder = { tag: 'holder', whoAmI }
  const callCtx: Ctx = { tag: 'call' }
  const bindCtx: Ctx = { tag: 'bind' }
  const secondBindCtx: Ctx = { tag: '第二次 bind' }

  push('▶ 普通调用 whoAmI()')
  whoAmI()
  push('▶ 方法调用 holder.whoAmI()')
  holder.whoAmI()
  push('▶ 显式调用 whoAmI.call(callCtx)')
  whoAmI.call(callCtx)

  const bound = whoAmI.bind(bindCtx)
  push('▶ bind 后 bound()')
  bound()
  push('▶ bind 后再 call(callCtx)，bind 优先')
  bound.call(callCtx)
  push('▶ 连续 bind 两次，第一次优先')
  bound.bind(secondBindCtx)()

  push('▶ new bound()，new 优先于 bind')
  const created = new (bound as unknown as new () => Ctx)()
  push(`  created instanceof whoAmI → ${created instanceof whoAmI}`)
}

const runLost = () => {
  clear()
  const user = {
    tag: 'user',
    greet(this: Ctx | void) {
      push(`  this = ${label(this)}`)
    },
  }

  push('▶ user.greet()')
  user.greet()

  const alias = user.greet
  push('▶ const alias = user.greet; alias()')
  alias()

  push('▶ (user.greet)()，括号保留引用')
  void user.greet()

  push('▶ (0, user.greet)()，逗号丢掉引用')
  void (0, user.greet)()

  push('▶ user.greet?.()，可选调用保留引用')
  user.greet?.()

  const { greet } = user
  push('▶ 解构后 greet()')
  greet()

  push('▶ 修复：alias.call(user)')
  alias.call(user)
  push('▶ 修复：箭头包一层 () => user.greet()')
  const arrowFix = () => user.greet()
  arrowFix()
}

const runNewBind = () => {
  clear()
  const ctx: Ctx = { tag: 'bind 上下文' }

  function Tagged(this: Ctx | void) {
    const self = this as Ctx
    self.constructed = true
  }

  const Bound = Tagged.bind(ctx)
  push('▶ Bound() 普通调用')
  Bound()
  push(`  ctx.constructed = ${String(ctx.constructed)}`)

  const callCtx: Ctx = { tag: 'call 上下文' }
  push('▶ Bound.call(callCtx)，bind 仍然优先')
  Bound.call(callCtx)
  push(`  callCtx.constructed = ${String(callCtx.constructed)}（未被写入）`)

  push('▶ new Bound()')
  const ins = new (Bound as unknown as new () => Ctx)()
  push(
    `  ins.constructed = ${String(ins.constructed)}，instanceof Tagged = ${ins instanceof Tagged}`,
  )

  const firstBindCtx: Ctx = { tag: '第一次 bind' }
  const secondBindCtx: Ctx = { tag: '第二次 bind' }
  Tagged.bind(firstBindCtx).bind(secondBindCtx)()
  push(
    `▶ 连续 bind 两次：第一次 constructed = ${String(firstBindCtx.constructed)}，第二次 = ${String(secondBindCtx.constructed)}`,
  )

  function Detect(this: Ctx | void) {
    const self = this as Ctx
    self.mode = new.target ? 'new' : 'call'
  }
  const called: Ctx = {}
  Detect.call(called)
  const constructed = new (Detect as unknown as new () => Ctx)()
  push(`▶ new.target：call → ${called.mode}，new → ${constructed.mode}`)

  class Person {
    tag = 'Person 实例'
    read() {
      return this.tag
    }
  }
  const person = new Person()
  const read = person.read
  let lost = ''
  try {
    read()
  } catch (error) {
    lost = (error as Error).constructor.name
  }
  const callPerson = Person as unknown as () => void
  let classCall = ''
  try {
    callPerson()
  } catch (error) {
    classCall = (error as Error).constructor.name
  }
  push('▶ class 的 this')
  push(`  person.read() → ${person.read()}；read() → ${lost}`)
  push(`  Person() 不 new → ${classCall}`)

  const holder = {
    tag: 'holder',
    make(this: Ctx) {
      const arrow = () => this.tag
      return arrow.call({ tag: '想覆盖的 this' })
    },
  }
  push(`▶ 箭头函数改不了 this：arrow.call(...) → ${holder.make()}`)
}

const runStrict = () => {
  clear()
  const sloppy = Function('return this') as (this: unknown) => unknown
  const strictFn = function (this: unknown) {
    return this
  }

  push('▶ 非严格函数（Function 构造）')
  const boxed = sloppy.call(1)
  push(`  call(1) → typeof ${typeof boxed}，${Object.prototype.toString.call(boxed)}`)
  push(`  call(null) === globalThis → ${sloppy.call(null) === globalThis}`)

  push('▶ 严格函数（模块内默认严格）')
  push(`  call(1) → ${String(strictFn.call(1))}，typeof ${typeof strictFn.call(1)}`)
  push(`  call(null) → ${String(strictFn.call(null))}`)
  push(`  普通调用 → ${String(strictFn())}`)
  push('  结论：是否装箱由被调用函数是否严格决定，与调用方无关')
}
</script>
