<template>
  <!--
    渲染 Markdown 文本。
    注意：v-html 插入的节点不会带 scoped 属性，所以内容样式统一用 :deep() 穿透。
  -->
  <!-- eslint-disable vue/no-v-html -- 正文来自仓库内置的 md，需按 HTML 渲染 -->
  <div
    class="markdown-body"
    @click="onContentClick"
    v-html="html"
  ></div>
  <!-- eslint-enable vue/no-v-html -->

  <ImagePreview
    v-if="previewSrc"
    :src="previewSrc"
    :alt="previewAlt"
    @close="closePreview"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'

// 按需注册语言，避免把整个 highlight.js 打进包里
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import markdown from 'highlight.js/lib/languages/markdown'

import ImagePreview from './ImagePreview.vue'
import { slugify } from '../utils/slugify'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('vue', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

const props = defineProps<{ content: string }>()

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 返回以 <pre> 开头时，markdown-it 会直接采用该结果，不再额外包装
const highlight = (code: string, lang: string) => {
  const value =
    lang && hljs.getLanguage(lang)
      ? hljs.highlight(code, { language: lang }).value
      : escapeHtml(code)
  return `<pre class="hljs"><code>${value}</code></pre>`
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight,
})

/**
 * 给标题生成 GitHub 风格锚点 id，正文里写的 [目录](#xxx) 才能跳转。
 * 规则与搜索结果跳转共用，见 src/utils/slugify.ts。
 */
md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const inline = tokens[idx + 1]
  const text = inline?.type === 'inline' ? inline.content : ''
  tokens[idx].attrSet('id', slugify(text))
  return self.renderToken(tokens, idx, options)
}

const html = computed(() => md.render(props.content))

/* ---------- 正文图片点击放大 ---------- */

// 图片是 v-html 动态插入的，挂不上监听器，所以在容器上做事件委托
const previewSrc = ref('')
const previewAlt = ref('')

const onContentClick = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return
  previewSrc.value = target.currentSrc || target.src
  previewAlt.value = target.alt
}

const closePreview = () => {
  previewSrc.value = ''
}
</script>

<style scoped>
.markdown-body {
  text-align: left;
  line-height: 1.75;
  color: var(--text);

  /* 代码高亮配色：明暗模式各一套，规则只写一次 */
  --hl-comment: #6e7781;
  --hl-keyword: #cf222e;
  --hl-string: #0a3069;
  --hl-number: #0550ae;
  --hl-title: #8250df;
  --hl-attr: #953800;
}

/* 暗色主题下换一套高亮配色，data-mode 由主题 store 写到 <html> 上 */
[data-mode='dark'] .markdown-body {
  --hl-comment: #8b949e;
  --hl-keyword: #ff7b72;
  --hl-string: #a5d6ff;
  --hl-number: #79c0ff;
  --hl-title: #d2a8ff;
  --hl-attr: #ffa657;
}

/* ---------- 标题 ---------- */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 1.6em 0 0.6em;
  line-height: 1.3;
  color: var(--text-h);
}

.markdown-body :deep(h1) {
  margin-top: 0;
  font-size: 26px;
}

.markdown-body :deep(h2) {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border);
  font-size: 21px;
}

.markdown-body :deep(h3) {
  font-size: 17px;
}

.markdown-body :deep(h4) {
  font-size: 15px;
}

/* ---------- 段落 / 列表 / 链接 ---------- */
.markdown-body :deep(p) {
  margin: 0 0 12px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 12px;
  padding-left: 22px;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(strong) {
  color: var(--text-h);
}

.markdown-body :deep(a) {
  color: var(--accent);
}

.markdown-body :deep(hr) {
  margin: 24px 0;
  border: none;
  border-top: 1px solid var(--border);
}

/* ---------- 图片 ---------- */
.markdown-body :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 0 14px;
  /* 提示可点击放大 */
  cursor: zoom-in;
}

/* ---------- Mermaid 图表（构建期已渲染成内联 SVG） ---------- */
.markdown-body :deep(.mermaid-diagram) {
  margin: 0 0 14px;
  text-align: center;
}

.markdown-body :deep(.mermaid-diagram svg) {
  max-width: 100%;
  height: auto;
}

.markdown-body :deep(.mermaid-diagram__dark) {
  display: none;
}

/* 构建期会渲染明暗两版 SVG，暗色主题下切到暗色版 */
[data-mode='dark'] .markdown-body :deep(.mermaid-diagram__light) {
  display: none;
}

[data-mode='dark'] .markdown-body :deep(.mermaid-diagram__dark) {
  display: block;
}

/* ---------- 行内代码 ---------- */
.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--code-bg);
  color: var(--text-h);
  font-family: var(--mono);
  font-size: 0.88em;
}

/* ---------- 代码块 ---------- */
.markdown-body :deep(pre) {
  margin: 0 0 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--code-bg);
  overflow: auto;
}

.markdown-body :deep(pre code) {
  /* 全局 style.css 给 code 设了 display: inline-flex，
     会把高亮产生的每个 <span> 当成 flex item 横排，导致换行符丢失，这里必须还原 */
  display: block;
  padding: 0;
  background: none;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre;
}

.markdown-body :deep(pre.hljs) {
  color: var(--text-h);
}

/* ---------- 引用 ---------- */
.markdown-body :deep(blockquote) {
  margin: 0 0 14px;
  padding: 8px 14px;
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
  background: var(--accent-bg);
}

.markdown-body :deep(blockquote p:last-child) {
  margin-bottom: 0;
}

/* ---------- 表格 ---------- */
.markdown-body :deep(table) {
  width: 100%;
  margin: 0 0 14px;
  border-collapse: collapse;
  font-size: 14px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--border);
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--code-bg);
  color: var(--text-h);
}

/* ---------- 语法高亮 token ---------- */
.markdown-body :deep(.hljs-comment),
.markdown-body :deep(.hljs-quote) {
  color: var(--hl-comment);
  font-style: italic;
}

.markdown-body :deep(.hljs-keyword),
.markdown-body :deep(.hljs-selector-tag),
.markdown-body :deep(.hljs-literal),
.markdown-body :deep(.hljs-type),
.markdown-body :deep(.hljs-meta) {
  color: var(--hl-keyword);
}

.markdown-body :deep(.hljs-string),
.markdown-body :deep(.hljs-regexp),
.markdown-body :deep(.hljs-addition) {
  color: var(--hl-string);
}

.markdown-body :deep(.hljs-number),
.markdown-body :deep(.hljs-symbol),
.markdown-body :deep(.hljs-bullet) {
  color: var(--hl-number);
}

.markdown-body :deep(.hljs-title),
.markdown-body :deep(.hljs-section),
.markdown-body :deep(.hljs-title.function_) {
  color: var(--hl-title);
}

.markdown-body :deep(.hljs-attr),
.markdown-body :deep(.hljs-attribute),
.markdown-body :deep(.hljs-variable),
.markdown-body :deep(.hljs-template-variable),
.markdown-body :deep(.hljs-property),
.markdown-body :deep(.hljs-built_in) {
  color: var(--hl-attr);
}
</style>
