<template>
  <div class="home">
    <!-- 总览：数据全部来自 tutorials.ts，新增教程后自动更新 -->
    <section class="hero">
      <p class="eyebrow">JS 道场 · 前端知识库</p>
      <h1>把零散的面试题<br />整理成一张知识地图</h1>
      <p class="lead">
        全站以 Markdown 沉淀，覆盖语言基础、框架原理、工程化与高频面试专题。左侧导航按分类顺序编排，
        每篇都有清晰编号；需要动手的章节还配有可运行演示，改一行代码就能看到结果。
      </p>

      <dl class="stats">
        <div class="stat">
          <dt>分类</dt>
          <dd>{{ totalCategories }}</dd>
        </div>
        <div class="stat">
          <dt>教程</dt>
          <dd>{{ totalDocs }}</dd>
        </div>
        <div class="stat">
          <dt>交互演示</dt>
          <dd>{{ totalDemos }}</dd>
        </div>
      </dl>

      <div class="actions">
        <RouterLink
          class="btn primary"
          :to="startPath"
          >从 {{ startTitle }} 开始</RouterLink
        >
        <a
          class="btn ghost"
          href="#categories"
          >浏览全部分类</a
        >
      </div>
    </section>

    <!-- 分类速览：每类给出入口和前三篇，完整清单在左侧导航 -->
    <section
      id="categories"
      class="section"
    >
      <div class="section-head">
        <h2>分类速览</h2>
        <p>按学习顺序排列，点击分类可直接进入总览或第一篇</p>
      </div>

      <div class="grid">
        <article
          v-for="section in sections"
          :key="section.title"
          class="card"
        >
          <header class="card-head">
            <h3>{{ section.title }}</h3>
            <span class="count">{{ section.count }} 篇</span>
          </header>

          <ul>
            <li
              v-for="link in section.links"
              :key="link.path"
            >
              <RouterLink :to="link.path">{{ link.title }}</RouterLink>
            </li>
          </ul>

          <RouterLink
            class="more"
            :to="section.entry"
          >
            {{ section.hasOverview ? '查看总览' : '开始阅读' }} →
          </RouterLink>
        </article>
      </div>
    </section>

    <!-- 交互演示：把带 demo 的教程集中成快捷入口 -->
    <section class="section">
      <div class="section-head">
        <h2>动手试试</h2>
        <p>这些章节附带可运行的交互演示</p>
      </div>

      <div class="chips">
        <RouterLink
          v-for="demo in demos"
          :key="demo.path"
          class="chip"
          :to="demo.path"
        >
          <span class="chip-category">{{ demo.category }}</span>
          {{ demo.title }}
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { categories, tutorialPath } from '../router/tutorials'

const totalCategories = categories.length
const totalDocs = categories.reduce((total, category) => total + category.items.length, 0)
const totalDemos = categories.reduce(
  (total, category) => total + category.items.filter((item) => item.demo).length,
  0,
)

// 总览项以 -overview 结尾，作为分类入口；没有总览的分类落到第一篇
const isOverview = (id: string) => id.endsWith('-overview')

const sections = categories.map((category) => {
  const overview = category.items.find((item) => isOverview(item.id))
  const chapters = category.items.filter((item) => !isOverview(item.id))
  return {
    title: category.title,
    count: category.items.length,
    hasOverview: Boolean(overview),
    entry: tutorialPath((overview ?? category.items[0]).id),
    links: chapters.slice(0, 3).map((item) => ({
      title: item.title,
      path: tutorialPath(item.id),
    })),
  }
})

const demos = categories.flatMap((category) =>
  category.items
    .filter((item) => item.demo)
    .map((item) => ({
      title: item.title,
      path: tutorialPath(item.id),
      category: category.title,
    })),
)

const firstCategory = categories[0]
const startTitle = firstCategory.title
const startPath = tutorialPath(firstCategory.items[0].id)
</script>

<style scoped>
.home {
  max-width: 1080px;
  margin: 0 auto;
  padding-bottom: 48px;
  text-align: left;
}

/* ---------- 头部总览 ---------- */
.hero {
  padding: 16px 0 28px;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  font-size: 13px;
  letter-spacing: 0.12em;
  color: var(--accent);
}

.hero h1 {
  margin: 12px 0;
  font-size: clamp(28px, 4vw, 40px);
  line-height: 1.25;
  letter-spacing: -0.5px;
}

.lead {
  max-width: 760px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--text);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  margin: 24px 0 0;
}

.stat {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
}

.stat dt {
  font-size: 13px;
  color: var(--text);
}

.stat dd {
  margin: 0;
  font-family: var(--mono);
  font-size: 28px;
  color: var(--text-h);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 26px;
}

.btn {
  padding: 9px 18px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  text-decoration: none;
  transition:
    background 0.2s,
    border-color 0.2s,
    color 0.2s;
}

.btn.primary {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.btn.primary:hover {
  opacity: 0.9;
}

.btn.ghost {
  border-color: var(--border);
  color: var(--text-h);
}

.btn.ghost:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
}

/* ---------- 通用区块 ---------- */
.section {
  margin-top: 44px;
  scroll-margin-top: 20px;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 16px;
}

.section-head h2 {
  margin: 0;
  font-size: 20px;
}

.section-head p {
  font-size: 13px;
  color: var(--text);
}

/* ---------- 分类卡片 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
}

.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow-wrap: anywhere;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.card-head h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-h);
}

.count {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-bg);
}

.card ul {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.card li a {
  display: block;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--text);
  text-decoration: none;
  transition: color 0.2s;
}

.card li a:hover {
  color: var(--accent);
}

.more {
  margin-top: 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
}

.more:hover {
  text-decoration: underline;
}

/* ---------- 演示入口 ---------- */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 13px;
  color: var(--text);
  text-decoration: none;
  transition:
    border-color 0.2s,
    background 0.2s,
    color 0.2s;
}

.chip:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
}

.chip-category {
  color: var(--accent);
  opacity: 0.8;
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .stats {
    gap: 24px;
  }
}
</style>
