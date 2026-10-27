<template>
  <div
    class="layout"
    :class="{ immersive }"
  >
    <!-- 键盘用户跳过导航直达正文 -->
    <a
      class="skip-link"
      href="#main-content"
      >跳到正文</a
    >

    <!-- 头部总标题 + 布局控制 + 主题切换；沉浸阅读时整体隐藏 -->
    <header
      v-if="!immersive"
      class="header"
    >
      <h1 class="title">JS 道场</h1>

      <!-- 搜索菜单与笔记正文，选中结果直接跳转 -->
      <DocSearch class="header-search" />

      <div class="header-actions">
        <!-- 导航显隐：收起后宽度归零，内容区自动撑满 -->
        <button
          type="button"
          class="icon-button"
          :aria-pressed="sidebarVisible"
          :title="sidebarVisible ? '隐藏导航' : '显示导航'"
          :aria-label="sidebarVisible ? '隐藏导航' : '显示导航'"
          @click="sidebarVisible = !sidebarVisible"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="4"
              width="18"
              height="16"
              rx="2"
            />
            <path d="M9 4v16" />
          </svg>
        </button>

        <!-- 一键全屏：隐藏头尾、进入浏览器全屏，只看正文 -->
        <button
          type="button"
          class="icon-button"
          title="全屏阅读"
          aria-label="全屏阅读"
          @click="toggleImmersive"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>

        <ThemeSwitcher />
      </div>
    </header>

    <!-- 移动端抽屉遮罩：点击空白处收起 -->
    <Transition name="fade">
      <div
        v-if="isNarrow && sidebarVisible && !immersive"
        class="nav-backdrop"
        @click="sidebarVisible = false"
      ></div>
    </Transition>

    <!-- 导航显隐开关：固定贴在侧边栏右缘，滚到任意位置都能切换 -->
    <button
      v-if="!immersive"
      type="button"
      class="sidebar-toggle"
      :class="{ 'no-transition': navResizing, narrow: isNarrow }"
      :style="{ left: toggleLeft }"
      :aria-expanded="sidebarVisible"
      :title="sidebarVisible ? '隐藏导航' : '显示导航'"
      :aria-label="sidebarVisible ? '隐藏导航' : '显示导航'"
      @click="sidebarVisible = !sidebarVisible"
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="sidebarVisible ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'" />
      </svg>
    </button>

    <div class="container">
      <!-- 左侧树状导航：可拖拽调宽、可整体收起 -->
      <SideNav
        v-model:width="navWidth"
        :visible="sidebarVisible && !immersive"
        :drawer="isNarrow"
        @resizing="navResizing = $event"
      />

      <main
        id="main-content"
        class="content"
        tabindex="-1"
      >
        <RouterView />
      </main>
    </div>

    <!-- 沉浸阅读时保留退出入口；Esc 或浏览器全屏退出也会同步恢复 -->
    <Transition name="fade">
      <button
        v-if="immersive"
        type="button"
        class="exit-immersive"
        title="退出全屏（Esc）"
        @click="toggleImmersive"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M16 3v3a2 2 0 0 0 2 2h3" />
          <path d="M8 21v-3a2 2 0 0 0-2-2H3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
        <span>退出全屏</span>
      </button>
    </Transition>

    <!-- 划词后浮出 AI 对话入口 -->
    <AiSearch />

    <!-- 页面滚动超过一定距离后出现 -->
    <BackToTop />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AiSearch from './components/AiSearch.vue'
import BackToTop from './components/BackToTop.vue'
import DocSearch from './components/DocSearch.vue'
import SideNav from './components/SideNav.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import { useImmersiveMode } from './composables/useImmersiveMode'

// 移动端断点与 App.vue 的页头换行保持一致
const NARROW_QUERY = '(max-width: 860px)'

const route = useRoute()
const narrowQuery = window.matchMedia(NARROW_QUERY)
const isNarrow = ref(narrowQuery.matches)

// 侧边栏初始宽度；可拖拽范围（160 ~ 480）在 SideNav 内部约束
const navWidth = ref(240)
// 窄屏默认收起，把宽度让给正文
const sidebarVisible = ref(!isNarrow.value)
// 拖拽调宽期间关掉开关的 left 过渡，保证手柄跟手
const navResizing = ref(false)

// 开关贴着抽屉右缘；抽屉宽度被 SideNav 限制在 82vw
const toggleLeft = computed(() => {
  if (!sidebarVisible.value) return '0px'
  return isNarrow.value ? `min(${navWidth.value}px, 82vw)` : `${navWidth.value}px`
})

const onNarrowChange = (event: MediaQueryListEvent) => {
  isNarrow.value = event.matches
  // 跨断点时跟随新布局，避免桌面收起状态带到手机上
  sidebarVisible.value = !event.matches
}

// 抽屉里点任意链接后自动收起，正文立即完整露出
watch(
  () => route.fullPath,
  () => {
    if (isNarrow.value) sidebarVisible.value = false
  },
)

onMounted(() => narrowQuery.addEventListener('change', onNarrowChange))
onBeforeUnmount(() => narrowQuery.removeEventListener('change', onNarrowChange))

const { immersive, toggle: toggleImmersive } = useImmersiveMode()
</script>

<style scoped>
.layout {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 1px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 导航开关 / 全屏按钮，与主题切换保持同一行高 */
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--text);
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.icon-button:hover {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

.icon-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ---------- 跳到正文 ---------- */
.skip-link {
  position: fixed;
  top: -80px;
  left: 16px;
  z-index: 100;
  padding: 8px 14px;
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--accent);
  font-size: 14px;
  text-decoration: none;
  transition: top 0.15s ease;
}

.skip-link:focus-visible {
  top: 12px;
}

/* 抽屉遮罩：压在正文上、抽屉下方 */
.nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: rgba(0, 0, 0, 0.35);
}

/* ---------- 常驻的导航开关 ---------- */
/* 固定贴在侧边栏右缘，脱离文档流：滚动位置不受影响，也不会随页头滚走 */
.sidebar-toggle {
  position: fixed;
  top: 50%;
  z-index: 35;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 56px;
  padding: 0;
  border: 1px solid var(--border);
  border-left: 0;
  border-radius: 0 8px 8px 0;
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    left 0.2s ease,
    background 0.2s,
    border-color 0.2s,
    color 0.2s;
}

/* 拖拽调宽时手柄要跟手，关掉 left 过渡 */
.sidebar-toggle.no-transition {
  transition: none;
}

.sidebar-toggle:hover {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

.sidebar-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* 触屏上把开关放大到 44px，避免 16px 手柄点不中 */
.sidebar-toggle.narrow {
  width: 44px;
  height: 44px;
  border-radius: 0 10px 10px 0;
}

.container {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ---------- 右侧内容 ---------- */
.content {
  flex: 1;
  min-width: 0;
  padding: 20px 24px;
  /* 不能设 overflow: auto：它会让 content 成为滚动容器，
     长文大纲的 sticky 就以这个不滚动的容器为参照，随页面一起滚出视口 */
  overflow: visible;
}

/* 沉浸阅读：没有头部与导航，正文左右留白稍大一点更好读 */
.immersive .content {
  padding: 28px 32px;
}

/* 沉浸阅读下的退出入口，固定在右上角 */
.exit-immersive {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  background: var(--bg);
  color: var(--accent);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  box-shadow: var(--shadow);
}

.exit-immersive:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.exit-immersive:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .content,
  .immersive .content {
    padding: 16px;
  }

  .exit-immersive {
    top: 12px;
    right: 12px;
    padding: 6px 12px;
    font-size: 13px;
  }
}

/* 窄屏放不下标题 + 搜索 + 主题切换，搜索框单独占一行 */
@media (max-width: 860px) {
  .header {
    flex-wrap: wrap;
  }

  .header-search {
    order: 3;
    flex-basis: 100%;
    max-width: none;
  }

  .icon-button {
    width: 44px;
    height: 44px;
  }
}
</style>
