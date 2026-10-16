<template>
  <DemoPanel
    :logs="logs"
    hint="策略集合 + Context 调用，替换掉一长串 if / else。"
    @clear="clear"
  >
    <button class="run" @click="runDiscount">运行：会员折扣</button>
    <button class="run" @click="addVip">运行：新增 VIP 策略</button>
    <button class="run" @click="runValidate">运行：表单校验策略</button>
  </DemoPanel>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

/* 策略集合：各个独立算法 */
const strategies: Record<string, (price: number) => number> = {
  ordinary: (price) => price * 0.9,
  gold: (price) => price * 0.8,
  diamond: (price) => price * 0.7,
}

/* Context 上下文：只负责按名字取出策略并调用，不写判断逻辑 */
const getPrice = (memberType: string, price: number) => strategies[memberType](price)

const vipAdded = ref(false)

const runDiscount = () => {
  push('▶ 会员折扣：策略集合 + Context')
  push('  getPrice("ordinary", 100) → ' + getPrice('ordinary', 100))
  push('  getPrice("gold", 100) → ' + getPrice('gold', 100))
  push('  getPrice("diamond", 100) → ' + getPrice('diamond', 100))
}

const addVip = () => {
  if (vipAdded.value) {
    push('  VIP 策略已存在，无需重复添加')
    return
  }
  // 新增策略：直接往集合里加，getPrice 一行都不用改
  strategies.vip = (price) => price * 0.85
  vipAdded.value = true

  push('▶ 新增 VIP 策略：strategies.vip = (price) => price * 0.85')
  push('  getPrice 未做任何修改（符合开闭原则）')
  push('  getPrice("vip", 100) → ' + getPrice('vip', 100))
}

const runValidate = () => {
  push('▶ 表单校验：每条规则都是一个策略')

  const validateStrategy: Record<string, (value: string) => string | undefined> = {
    required(value) {
      if (!value) return '不能为空'
      return undefined
    },
    phone(value) {
      if (!/^1[3-9]\d{9}$/.test(value)) return '手机号格式错误'
      return undefined
    },
    email(value) {
      if (!/^\w+@\w+\.\w+$/.test(value)) return '邮箱错误'
      return undefined
    },
  }

  const validate = (type: string, value: string) => validateStrategy[type](value) ?? '校验通过'

  push('  validate("phone", "1234") → ' + validate('phone', '1234'))
  push('  validate("phone", "13800138000") → ' + validate('phone', '13800138000'))
  push('  validate("required", "") → ' + validate('required', ''))
  push('  validate("email", "abc@test.com") → ' + validate('email', 'abc@test.com'))
}
</script>
