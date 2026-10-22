<template>
  <aside
    class="sidebar"
    :class="{ collapsed: !visible, resizing }"
    :style="asideStyle"
    :aria-hidden="!visible"
  >
    <div
      class="sidebar-inner"
      :style="{ width: `${width}px` }"
    >
      <template
        v-for="entry in menus"
        :key="isNavGroup(entry) ? entry.title : entry.path"
      >
        <div
          v-if="isNavGroup(entry)"
          class="menu-group"
        >
          <button
            type="button"
            class="group-title"
            :aria-expanded="isExpanded(entry.title)"
            @click="toggle(entry.title)"
          >
            <span>{{ entry.title }}</span>
            <span
              class="chevron"
              :class="{ collapsed: !isExpanded(entry.title) }"
              aria-hidden="true"
            ></span>
          </button>
          <ul
            v-show="isExpanded(entry.title)"
            class="tree"
          >
            <li
              v-for="item in entry.items"
              :key="item.path"
              class="tree-item"
            >
              <RouterLink
                :to="item.path"
                class="tree-link"
                >{{ item.title }}</RouterLink
              >
            </li>
          </ul>
        </div>
        <div
          v-else
          class="menu-group"
        >
          <RouterLink
            :to="entry.path"
            class="tree-link"
            >{{ entry.title }}</RouterLink
          >
        </div>
      </template>
    </div>

    <!-- 拖拽手柄：左右拖动调整宽度，聚焦后可用左右方向键微调 -->
    <div
      class="resizer"
      role="separator"
      aria-orientation="vertical"
      :aria-label="`调整导航宽度，当前 ${width} 像素`"
      :aria-valuenow="width"
      :aria-valuemin="MIN_WIDTH"
      :aria-valuemax="MAX_WIDTH"
      tabindex="0"
      @pointerdown="startResize"
      @keydown="onResizeKeydown"
    ></div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { isNavGroup, navMenus } from '../config/nav-menus'

// 拖拽宽度的上下限，App.vue 初始宽度也落在这个区间内
const MIN_WIDTH = 160
const MAX_WIDTH = 480
const KEYBOARD_STEP = 16

const props = defineProps<{ width: number; visible: boolean }>()
const emit = defineEmits<{ (event: 'update:width', width: number): void }>()

// 左侧导航菜单，按分组构成树状结构；数据同时供顶部搜索使用
const menus = navMenus

/* ---------- 分组折叠 ---------- */

// 记录展开状态，默认全部收起；进入页面时只展开当前路由所在分组
const expanded = ref<Record<string, boolean>>({})

const isExpanded = (title: string) => expanded.value[title] === true

const toggle = (title: string) => {
  expanded.value[title] = !isExpanded(title)
}

const route = useRoute()

// 路由首次匹配完成前（START_LOCATION）为空，避免误展开「开始」分组
const currentPath = computed(() => (route.matched.length ? route.path : ''))

watch(
  currentPath,
  (path) => {
    if (!path) return
    // 顶层单条链接没有分组，也就没有可展开的父节点
    const current = menus.find(
      (entry) => isNavGroup(entry) && entry.items.some((item) => item.path === path),
    )
    if (current && isNavGroup(current)) expanded.value[current.title] = true
  },
  { immediate: true },
)

/* ---------- 宽度拖拽 ---------- */

const resizing = ref(false)

// 收起时宽度归零，内容由 overflow-x: clip 裁掉，展开时按记录值恢复
const asideStyle = computed(() => ({ width: props.visible ? `${props.width}px` : '0px' }))

const clampWidth = (value: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))

let startX = 0
let startWidth = 0

const onPointerMove = (event: PointerEvent) => {
  emit('update:width', clampWidth(startWidth + event.clientX - startX))
}

const stopResize = () => {
  resizing.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointercancel', stopResize)
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
}

const startResize = (event: PointerEvent) => {
  event.preventDefault()
  resizing.value = true
  startX = event.clientX
  startWidth = props.width
  // 拖动期间锁定光标与选中，避免误选正文
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
}

const onResizeKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const delta = event.key === 'ArrowRight' ? KEYBOARD_STEP : -KEYBOARD_STEP
  emit('update:width', clampWidth(props.width + delta))
}
</script>

<style scoped>
/* overflow-x: clip 只裁剪不生成滚动容器，保证内部 sticky 仍然生效 */
.sidebar {
  position: relative;
  flex: none;
  box-sizing: border-box;
  overflow-x: clip;
  border-right: 1px solid var(--border);
  transition:
    width 0.2s ease,
    border-color 0.2s ease;
}

/* 收起时连 1px 边框一起收掉，避免还占着一点宽度 */
.sidebar.collapsed {
  border-right-width: 0;
}

/* 拖拽过程中关掉过渡，否则手柄会跟不上指针 */
.sidebar.resizing {
  transition: none;
}

/* 导航内容 sticky：页头滚出视口后，导航停在顶部不再跟着滚动 */
.sidebar-inner {
  position: sticky;
  top: 0;
  max-height: 100svh;
  padding: 16px 12px;
  overflow-y: auto;
  box-sizing: border-box;
}

.menu-group {
  margin-bottom: 16px;
}

/* 分组标题兼折叠开关 */
.group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--text);
  opacity: 0.7;
  cursor: pointer;
  transition:
    opacity 0.2s,
    background 0.2s;
}

.group-title:hover {
  background: var(--accent-bg);
  opacity: 1;
}

.group-title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* 折叠箭头：默认朝下，收起时朝右 */
.chevron {
  flex: none;
  width: 6px;
  height: 6px;
  margin-right: 2px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s;
}

.chevron.collapsed {
  transform: rotate(-45deg);
}

.tree {
  position: relative;
  display: flex;
  flex-direction: column;
  /* 相邻条目的 hover / 选中背景不要贴在一起 */
  gap: 4px;
  list-style: none;
  margin: 6px 0 0;
  padding: 0 0 0 12px;
}

/* 树状竖线 */
.tree::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  border-left: 1px dashed var(--border);
}

.tree-item {
  position: relative;
}

/* 树状横线 */
.tree-item::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 50%;
  width: 8px;
  border-top: 1px dashed var(--border);
}

.tree-link {
  display: block;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 15px;
  color: var(--text-h);
  text-decoration: none;
  transition:
    background 0.2s,
    color 0.2s;
}

.tree-link:hover {
  background: var(--accent-bg);
}

.tree-link.router-link-active {
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 600;
}

/* ---------- 宽度拖拽手柄 ---------- */
.resizer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  width: 8px;
  cursor: col-resize;
  /* 触屏上交给指针事件处理，避免拖动时触发页面滚动 */
  touch-action: none;
}

/* 悬停 / 聚焦时显示一条主题色分隔线 */
.resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.15s;
}

.resizer:hover::after,
.resizer:focus-visible::after {
  opacity: 0.6;
}

.resizer:focus-visible {
  outline: none;
}
</style>
