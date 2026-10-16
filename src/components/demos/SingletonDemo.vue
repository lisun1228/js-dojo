<template>
  <DemoPanel
    :logs="logs"
    hint="多次获取实例，验证拿到的始终是同一个对象。"
    @clear="clear"
  >
    <button class="run" @click="run">运行：getInstance 两次 + 外部 new</button>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

class Singleton {
  // 静态变量保存唯一实例
  static instance: Singleton | undefined

  constructor() {
    // 已经创建过就直接返回旧实例
    const existing = Singleton.instance
    if (existing) return existing
    Singleton.instance = this
  }

  static getInstance() {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton()
    }
    return Singleton.instance
  }

  sayHello() {
    push('  我是单例 sayHello()')
  }
}

const run = () => {
  push('▶ 单例模式')
  const s1 = Singleton.getInstance()
  const s2 = Singleton.getInstance()
  const s3 = new Singleton()

  push('  s1 === s2 → ' + (s1 === s2))
  push('  new Singleton() === s1 → ' + (s3 === s1) + '（外部 new 也拿到同一实例）')
  s1.sayHello()
}
</script>
