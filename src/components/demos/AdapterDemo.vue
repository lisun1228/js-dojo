<template>
  <DemoPanel
    :logs="logs"
    hint="两种适配器写法：对象适配器（前端最常用）与类适配器。"
    @clear="clear"
  >
    <button class="run" @click="runObjectAdapter">运行：对象适配器</button>
    <button class="run" @click="runClassAdapter">运行：类适配器</button>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

/* 对象适配器：包装旧接口，把返回格式转换成目标格式 */
const runObjectAdapter = () => {
  push('▶ 对象适配器：转换接口格式')

  // 被适配者 Adaptee：旧接口（不能改动）
  const oldApi = {
    request() {
      return {
        code: 0,
        msg: 'ok',
        data: { userName: '张三' },
      }
    },
  }

  // 适配器 Adapter：包装旧接口，做字段映射
  const apiAdapter = {
    fetch() {
      const oldRes = oldApi.request()
      return {
        success: oldRes.code === 0,
        message: oldRes.msg,
        result: { name: oldRes.data.userName },
      }
    },
  }

  push('  旧接口 oldApi.request() → ' + JSON.stringify(oldApi.request()))
  push('  适配后 apiAdapter.fetch() → ' + JSON.stringify(apiAdapter.fetch()))
  push('  业务代码只认 fetch()，不再关心旧字段')
}

/* 类适配器：继承被适配者并实现目标接口 */
const runClassAdapter = () => {
  push('▶ 类适配器：继承被适配者，实现目标接口')

  // 目标接口 Target
  interface Target {
    getInfo(): { name: string }
  }

  // 被适配者 Adaptee
  class OldService {
    oldGet() {
      return { userName: '李四' }
    }
  }

  // 适配器：复用 OldService，对外暴露 Target 的 getInfo()
  class Adapter extends OldService implements Target {
    getInfo() {
      const oldData = this.oldGet()
      return { name: oldData.userName }
    }
  }

  const adapter = new Adapter()
  push('  旧方法 oldGet() → ' + JSON.stringify(adapter.oldGet()))
  push('  目标方法 getInfo() → ' + JSON.stringify(adapter.getInfo()))
}
</script>
