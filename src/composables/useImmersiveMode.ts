import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 沉浸式阅读模式：隐藏页面头部与侧边栏，并尽量让浏览器进入全屏。
 *
 * 浏览器不支持全屏 API 或被用户拒绝时，只保留页面内的沉浸布局；
 * 通过 Esc、浏览器全屏退出时，同步恢复原布局。
 */
export function useImmersiveMode() {
  const immersive = ref(false)

  const enter = () => {
    immersive.value = true
    // 失败（无权限 / 不支持）不影响沉浸布局，忽略即可
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const exit = () => {
    immersive.value = false
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  const toggle = () => {
    if (immersive.value) exit()
    else enter()
  }

  // 没有全屏 API 的环境下，Esc 仍可退出
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && immersive.value && !document.fullscreenElement) exit()
  }

  // 用户用 Esc / 浏览器按钮退出全屏时，页面布局跟着恢复
  const onFullscreenChange = () => {
    if (!document.fullscreenElement) immersive.value = false
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    window.removeEventListener('keydown', onKeydown)
  })

  return { immersive, toggle }
}
