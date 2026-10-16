<template>
  <DemoPanel
    :logs="logs"
    @clear="clear"
  >
    <button
      v-for="item in demos"
      :key="item.name"
      class="run"
      @click="item.run"
    >
      {{ item.name }}
    </button>
  </DemoPanel>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 装饰器需要处理任意目标，仅用于演示 */
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

/* ==================== 1. 类装饰器 ==================== */
const runClassDemo = () => {
  push('▶ 类装饰器 @entity')
  function entity(target: any) {
    target.tableName = 't_' + target.name.toLowerCase()
  }
  @entity
  class Article {}
  push('  Article.tableName = ' + (Article as any).tableName)
}

/* ==================== 2. 方法装饰器 ==================== */
const runMethodDemo = () => {
  push('▶ 方法装饰器 @log')
  function log(_target: any, _key: string, descriptor: PropertyDescriptor) {
    const fn = descriptor.value
    descriptor.value = function (...args: any[]) {
      push('  before')
      const result = fn.apply(this, args)
      push('  after')
      return result
    }
    return descriptor
  }
  class User {
    @log
    say() {
      push('  hello world')
    }
  }
  new User().say()
}

/* ==================== 3. 属性装饰器 ==================== */
const runPropertyDemo = () => {
  push('▶ 属性装饰器 @Column')
  const meta: Record<string, string[]> = {}
  function Column(label: string) {
    return function (_target: any, key: string) {
      if (!meta[label]) meta[label] = []
      meta[label].push(key)
    }
  }
  class Product {
    @Column('basic')
    name!: string

    @Column('basic')
    price!: number
  }
  Object.keys(meta).forEach((label) => {
    push('  ' + label + ' 字段: ' + meta[label].join(', ') + '（类 ' + Product.name + '）')
  })
}

/* ==================== 4. 访问器装饰器 ==================== */
const runAccessorDemo = () => {
  push('▶ 访问器装饰器 @enumerable')
  function enumerable(value: boolean) {
    return function (_target: any, _key: string, descriptor: PropertyDescriptor) {
      descriptor.enumerable = value
    }
  }
  class Point {
    private _x = 3

    @enumerable(false)
    get x() {
      return this._x
    }
  }
  const p = new Point()
  push('  p.x = ' + p.x)
  push('  Object.keys(p).length = ' + Object.keys(p).length + '（get x 不可枚举）')
}

/* ==================== 5. 参数装饰器 ==================== */
const runParamDemo = () => {
  push('▶ 参数装饰器 @Inject')
  function Inject(_target: any, key: string, index: number) {
    push('  方法 ' + key + ' 的第 ' + index + ' 个参数需要注入')
  }
  class Service {
    find(@Inject id: number, @Inject type: string) {
      return id + ':' + type
    }
  }
  push('  调用 find(1, "book") => ' + new Service().find(1, 'book'))
}

/* ==================== 6. 装饰器模式 ==================== */
const runPatternDemo = () => {
  push('▶ 装饰器模式')
  interface Coffee {
    cost(): number
    desc(): string
  }
  class Espresso implements Coffee {
    cost() {
      return 15
    }
    desc() {
      return '浓缩咖啡'
    }
  }
  class MilkDecorator implements Coffee {
    inner: Coffee
    constructor(inner: Coffee) {
      this.inner = inner
    }
    cost() {
      return this.inner.cost() + 3
    }
    desc() {
      return this.inner.desc() + ' + 牛奶'
    }
  }
  let coffee: Coffee = new Espresso()
  coffee = new MilkDecorator(coffee)
  coffee = new MilkDecorator(coffee)
  push('  ' + coffee.desc())
  push('  合计价格：' + coffee.cost() + ' 元')
}

/* ==================== 按钮列表 ==================== */
const demos = [
  { name: '1. 类装饰器', run: runClassDemo },
  { name: '2. 方法装饰器', run: runMethodDemo },
  { name: '3. 属性装饰器', run: runPropertyDemo },
  { name: '4. 访问器装饰器', run: runAccessorDemo },
  { name: '5. 参数装饰器', run: runParamDemo },
  { name: '6. 装饰器模式', run: runPatternDemo },
]
</script>
