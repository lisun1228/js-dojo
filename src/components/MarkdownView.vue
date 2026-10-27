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
import scss from 'highlight.js/lib/languages/scss'
import http from 'highlight.js/lib/languages/http'
import nginx from 'highlight.js/lib/languages/nginx'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import java from 'highlight.js/lib/languages/java'
import python from 'highlight.js/lib/languages/python'
import apache from 'highlight.js/lib/languages/apache'
import markdown from 'highlight.js/lib/languages/markdown'

import ImagePreview from './ImagePreview.vue'
import { slugify } from '../utils/slugify'

// 语言标记清单同时被 build/doc-check.ts 使用，两边不能各写一份
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
// highlight.js 没有独立 jsx 语法，javascript 已内置 JSX 规则
hljs.registerLanguage('jsx', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('vue', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('scss', scss)
// highlight.js 没有 sass 语法，缩进语法用 scss 近似
hljs.registerLanguage('sass', scss)
hljs.registerLanguage('http', http)
hljs.registerLanguage('nginx', nginx)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('java', java)
hljs.registerLanguage('python', python)
hljs.registerLanguage('apache', apache)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

const props = defineProps<{ content: string }>()

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const normalizeLang = (info: string) => (info.trim().split(/\s+/)[0] ?? '').toLowerCase()

// text / mermaid / 未注册语言都原样输出，至少保证换行与转义正确
const highlightCode = (code: string, lang: string) => {
  if (!lang || lang === 'text' || lang === 'mermaid' || !hljs.getLanguage(lang)) {
    return escapeHtml(code)
  }
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
})

// 自定义代码块结构：语言角标 + 复制按钮 + 高亮内容
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const lang = normalizeLang(token.info)
  const label = lang || 'text'
  const code = highlightCode(token.content, lang)
  return [
    '<div class="code-block">',
    `<div class="code-head"><span class="code-lang">${escapeHtml(label)}</span>`,
    '<button type="button" class="code-copy" aria-label="复制代码">复制</button></div>',
    `<pre class="hljs"><code>${code}</code></pre>`,
    '</div>',
  ].join('')
}

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

// 图片与复制按钮都是 v-html 动态插入的，挂不上监听器，所以在容器上做事件委托
const previewSrc = ref('')
const previewAlt = ref('')

// 剪贴板 API 在非 https 环境不可用，保留一次性 textarea 兜底
const legacyCopy = (text: string) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.cssText = 'position: fixed; top: -9999px; opacity: 0;'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  const ok = document.execCommand('copy')
  textarea.remove()
  return ok
}

const copyText = async (text: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 权限被拒时走兜底
  }
  return legacyCopy(text)
}

const onContentClick = async (event: MouseEvent) => {
  const target = event.target
  if (target instanceof HTMLImageElement) {
    previewSrc.value = target.currentSrc || target.src
    previewAlt.value = target.alt
    return
  }

  if (!(target instanceof HTMLElement)) return
  const button = target.closest<HTMLButtonElement>('button.code-copy')
  if (!button) return

  const text = button.closest('.code-block')?.querySelector('pre code')?.textContent ?? ''
  const ok = await copyText(text)
  button.textContent = ok ? '已复制' : '复制失败'
  button.dataset.state = ok ? 'done' : 'error'

  window.setTimeout(() => {
    if (!button.isConnected) return
    button.textContent = '复制'
    delete button.dataset.state
  }, 1600)
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
.markdown-body :deep(.code-block) {
  margin: 0 0 14px;
}

/* 语言角标与复制按钮：贴在高亮块的顶部，不占正文宽度 */
.markdown-body :deep(.code-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: var(--code-bg);
}

.markdown-body :deep(.code-lang) {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--text);
  opacity: 0.75;
}

.markdown-body :deep(.code-copy) {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s;
}

.markdown-body :deep(.code-copy:hover) {
  border-color: var(--accent-border);
  color: var(--accent);
}

.markdown-body :deep(.code-copy[data-state='done']) {
  border-color: var(--accent-border);
  color: var(--accent);
}

.markdown-body :deep(.code-copy[data-state='error']) {
  color: #d33;
}

.markdown-body :deep(pre) {
  margin: 0 0 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--code-bg);
  overflow: auto;
}

/* 代码块与角标拼在一起时，圆角只保留底部 */
.markdown-body :deep(.code-block pre) {
  margin: 0;
  border-radius: 0 0 8px 8px;
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
