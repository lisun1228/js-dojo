<template>
  <div class="layout">
    <!-- 头部总标题 -->
    <header class="header">
      <h1 class="title">JS 道场</h1>
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
            <p class="group-title">{{ group.title }}</p>
            <ul class="tree">
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
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
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
</script>

<style scoped>
.layout {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.header {
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

.group-title {
  margin: 0 0 6px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--text);
  opacity: 0.7;
}

.tree {
  position: relative;
  list-style: none;
  margin: 0 0 16px;
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
