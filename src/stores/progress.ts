import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * 阅读进度：只记录已读教程 id，写入 localStorage。
 * 不做自动打卡，是否已读由读者在文末手动确认。
 */
export const useProgressStore = defineStore(
  'progress',
  () => {
    const readIds = ref<string[]>([])
    const readCount = computed(() => readIds.value.length)

    const isRead = (id: string) => readIds.value.includes(id)

    const markRead = (id: string) => {
      if (readIds.value.includes(id)) return
      readIds.value = [...readIds.value, id]
    }

    const unmarkRead = (id: string) => {
      readIds.value = readIds.value.filter((item) => item !== id)
    }

    const clear = () => {
      readIds.value = []
    }

    return { readIds, readCount, isRead, markRead, unmarkRead, clear }
  },
  {
    // 与主题的 js-dojo-theme 分开存放，避免互相覆盖
    persist: { key: 'js-dojo-progress', pick: ['readIds'] },
  },
)
