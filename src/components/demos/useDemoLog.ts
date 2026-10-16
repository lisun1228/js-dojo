import { ref } from 'vue'

/**
 * 交互演示统一使用的日志收集器。
 * 各演示组件把运行过程中的输出 push 进来，由 DemoPanel 负责展示。
 */
export function useDemoLog() {
  const logs = ref<string[]>([])

  const push = (text: string) => {
    logs.value.push(text)
  }

  const clear = () => {
    logs.value = []
  }

  return { logs, push, clear }
}
