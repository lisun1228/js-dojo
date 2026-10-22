<template>
  <div
    class="layout"
    :class="{ immersive }"
  >
    <!-- 头部总标题 + 布局控制 + 主题切换；沉浸阅读时整体隐藏 -->
    <header
      v-if="!immersive"
      class="header"
    >
      <h1 class="title">JS 道场</h1>

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

    <div class="container">
      <!-- 左侧树状导航：可拖拽调宽、可整体收起 -->
      <SideNav
        v-model:width="navWidth"
        :visible="sidebarVisible && !immersive"
      />

      <main class="content">
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
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AiSearch from './components/AiSearch.vue'
import BackToTop from './components/BackToTop.vue'
import SideNav from './components/SideNav.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import { useImmersiveMode } from './composables/useImmersiveMode'

// 侧边栏初始宽度；可拖拽范围（160 ~ 480）在 SideNav 内部约束
const navWidth = ref(240)
const sidebarVisible = ref(true)

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
  overflow: auto;
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
</style>
