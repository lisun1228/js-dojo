<template>
  <div class="layout">
    <!-- 头部总标题 + 主题切换 -->
    <header class="header">
      <h1 class="title">JS 道场</h1>
      <ThemeSwitcher />
    </header>

    <div class="container">
      <!-- 左侧树状导航 -->
      <aside class="sidebar">
        <div class="sidebar-inner">
          <div
            v-for="group in menus"
            :key="group.title"
            class="menu-group"
          >
            <button
              type="button"
              class="group-title"
              :aria-expanded="isExpanded(group.title)"
              @click="toggle(group.title)"
            >
              <span>{{ group.title }}</span>
              <span
                class="chevron"
                :class="{ collapsed: !isExpanded(group.title) }"
                aria-hidden="true"
              ></span>
            </button>
            <ul
              v-show="isExpanded(group.title)"
              class="tree"
            >
              <li
                v-for="item in group.items"
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
        </div>
      </aside>

      <main class="content">
        <RouterView />
      </main>
    </div>

    <!-- 划词后浮出 AI 对话入口 -->
    <AiSearch />

    <!-- 页面滚动超过一定距离后出现 -->
    <BackToTop />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AiSearch from './components/AiSearch.vue'
import BackToTop from './components/BackToTop.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import { tutorialMenus } from './router'

// 左侧导航菜单，按分组构成树状结构
const menus = [
  {
    title: '开始',
    items: [{ title: '首页', path: '/' }],
  },
  {
    title: '路由演示',
    items: [{ title: '404 兜底', path: '/abc' }],
  },
  // 教程分类来自 src/router/tutorials.ts，改分类只改那一处
  ...tutorialMenus,
]

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
    const current = menus.find((group) => group.items.some((item) => item.path === path))
    if (current) expanded.value[current.title] = true
  },
  { immediate: true },
)
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

.container {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ---------- 左侧导航 ---------- */
.sidebar {
  flex: none;
  width: 200px;
  border-right: 1px solid var(--border);
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

/* ---------- 右侧内容 ---------- */
.content {
  flex: 1;
  min-width: 0;
  padding: 20px 24px;
  overflow: auto;
}
</style>
