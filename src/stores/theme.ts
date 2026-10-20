import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark'

export interface ThemeOption {
  /** 与 style.css 里 [data-theme='<id>'] 一一对应 */
  id: string
  label: string
  /** 明暗类型，影响 color-scheme 与 Markdown / Mermaid 配色 */
  mode: ThemeMode
  /** 切换器上的色块颜色 */
  color: string
}

/** 主题清单：新增主题时在这里加一项，并在 style.css 补同名变量组 */
export const themeOptions = [
  { id: 'purple', label: '道场紫', mode: 'light', color: '#aa3bff' },
  { id: 'night', label: '暗夜', mode: 'dark', color: '#c084fc' },
  { id: 'sakura', label: '樱粉', mode: 'light', color: '#e0447f' },
  { id: 'forest', label: '森绿', mode: 'light', color: '#16a34a' },
  { id: 'ocean', label: '海蓝', mode: 'light', color: '#0e7fd6' },
] as const satisfies readonly ThemeOption[]

export type ThemeId = (typeof themeOptions)[number]['id']

export const DEFAULT_THEME: ThemeId = 'purple'

const isThemeId = (id: string): id is ThemeId => themeOptions.some((item) => item.id === id)

export const useThemeStore = defineStore(
  'theme',
  () => {
    const current = ref<ThemeId>(DEFAULT_THEME)

    const theme = computed<ThemeOption>(
      () => themeOptions.find((item) => item.id === current.value) ?? themeOptions[0],
    )
    const mode = computed(() => theme.value.mode)

    const setTheme = (id: ThemeId) => {
      // 持久化数据可能来自旧版本，非法 id 一律回落到默认主题
      current.value = isThemeId(id) ? id : DEFAULT_THEME
    }

    // 主题写到 <html> 上，全局 CSS 变量与 color-scheme 都跟着变
    watch(
      theme,
      (value) => {
        document.documentElement.dataset.theme = value.id
        document.documentElement.dataset.mode = value.mode
      },
      { immediate: true },
    )

    return { current, theme, mode, themes: themeOptions, setTheme }
  },
  {
    // current 变化自动写入 localStorage，刷新后由插件恢复
    persist: { key: 'js-dojo-theme', pick: ['current'] },
  },
)
