<template>
  <div
    ref="containerRef"
    class="doc-search"
  >
    <div
      class="search-box"
      :class="{ focused: open }"
    >
      <svg
        class="search-icon"
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
        <circle
          cx="11"
          cy="11"
          r="7"
        />
        <path d="m20 20-3.5-3.5" />
      </svg>

      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="search-input"
        placeholder="搜索菜单或笔记内容"
        aria-label="搜索菜单或笔记内容"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="doc-search-results"
        :aria-expanded="open"
        @focus="open = true"
        @keydown="onKeydown"
      />

      <button
        v-if="query"
        type="button"
        class="clear"
        title="清空"
        aria-label="清空搜索"
        @click="clear"
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <Transition name="search-panel">
      <div
        v-if="open"
        id="doc-search-results"
        ref="panelRef"
        class="panel"
        role="listbox"
        aria-label="搜索结果"
      >
        <p
          v-if="!trimmedQuery"
          class="hint"
        >
          输入关键词，可搜索菜单标题与笔记正文
        </p>

        <template v-else>
          <p
            v-if="results.length === 0"
            class="hint"
          >
            {{ loading ? '正在加载笔记索引…' : `没有找到「${trimmedQuery}」相关内容` }}
          </p>

          <template v-if="menuResults.length">
            <p class="group-title">菜单</p>
            <button
              v-for="(item, index) in menuResults"
              :key="item.key"
              type="button"
              class="option"
              :class="{ active: index === activeIndex }"
              :data-active="index === activeIndex"
              role="option"
              :aria-selected="index === activeIndex"
              @mouseenter="activeIndex = index"
              @click="go(item)"
            >
              <span class="option-head">
                <span class="option-title">{{ item.title }}</span>
                <span
                  v-if="item.breadcrumb"
                  class="option-meta"
                  >{{ item.breadcrumb }}</span
                >
              </span>
            </button>
          </template>

          <template v-if="contentResults.length">
            <p class="group-title">笔记内容</p>
            <button
              v-for="(item, index) in contentResults"
              :key="item.key"
              type="button"
              class="option"
              :class="{ active: menuResults.length + index === activeIndex }"
              :data-active="menuResults.length + index === activeIndex"
              role="option"
              :aria-selected="menuResults.length + index === activeIndex"
              @mouseenter="activeIndex = menuResults.length + index"
              @click="go(item)"
            >
              <span class="option-head">
                <span class="option-title">{{ item.title }}</span>
                <span class="option-meta">{{ item.breadcrumb }}</span>
              </span>
              <span
                v-if="item.before || item.match"
                class="option-snippet"
                >{{ item.before }}<mark>{{ item.match }}</mark
                >{{ item.after }}</span
              >
            </button>
          </template>

          <p
            v-else-if="loading"
            class="hint"
          >
            正在加载笔记索引…
          </p>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { IndexedSection } from 'virtual:search-index'
import { isNavGroup, navMenus } from '../config/nav-menus'

/** 正文按二级标题切成的检索单元 */
interface Section extends IndexedSection {
  textLower: string
}

interface SearchResult {
  key: string
  title: string
  /** 分类或所属文档，作为结果的次要信息 */
  breadcrumb: string
  path: string
  anchor: string
  before: string
  match: string
  after: string
}

const MAX_MENU_RESULTS = 5
const MAX_CONTENT_RESULTS = 8
const DEBOUNCE = 180

const router = useRouter()

const containerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const query = ref('')
const open = ref(false)
const loading = ref(false)
const activeIndex = ref(0)
const menuResults = ref<SearchResult[]>([])
const contentResults = ref<SearchResult[]>([])

const trimmedQuery = computed(() => query.value.trim())
const results = computed(() => [...menuResults.value, ...contentResults.value])

/* ---------- 菜单检索 ---------- */

const matchMenus = (keyword: string): SearchResult[] => {
  const found: SearchResult[] = []
  // 平铺成「条目 + 所属分组」，顶层链接的分组为空
  const entries = navMenus.flatMap((entry) =>
    isNavGroup(entry)
      ? entry.items.map((item) => ({ item, group: entry.title }))
      : [{ item: entry, group: '' }],
  )
  for (const { item, group } of entries) {
    const hit = item.title.toLowerCase().includes(keyword) || group.toLowerCase().includes(keyword)
    if (!hit) continue
    found.push({
      key: `menu:${item.path}`,
      title: item.title,
      breadcrumb: group,
      path: item.path,
      anchor: '',
      before: '',
      match: '',
      after: '',
    })
    if (found.length >= MAX_MENU_RESULTS) return found
  }
  return found
}

/* ---------- 正文索引 ---------- */

// 索引由 build/search-index.ts 在构建期生成，是独立 chunk：
// 只有用户真正输入关键词时才加载，不再把全部正文打进主路径
let sectionsPromise: Promise<Section[]> | null = null

const ensureSections = (): Promise<Section[]> => {
  sectionsPromise ??= import('virtual:search-index').then(({ default: indexed }) =>
    indexed.map((section) => ({ ...section, textLower: section.text.toLowerCase() })),
  )
  return sectionsPromise
}

/** 去掉 markdown 标记，让结果摘要读起来像正文 */
const cleanSnippet = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const buildSnippet = (section: Section, keyword: string, index: number) => {
  const start = Math.max(0, index - 24)
  const end = Math.min(section.text.length, index + keyword.length + 60)
  const cleaned = cleanSnippet(section.text.slice(start, end))
  const hit = cleaned.toLowerCase().indexOf(keyword)
  if (hit === -1) return { before: cleaned, match: '', after: '' }

  return {
    before: (start > 0 ? '…' : '') + cleaned.slice(0, hit),
    match: cleaned.slice(hit, hit + keyword.length),
    after: cleaned.slice(hit + keyword.length) + (end < section.text.length ? '…' : ''),
  }
}

const matchContent = (keyword: string, list: Section[]): SearchResult[] => {
  const found: SearchResult[] = []
  for (const section of list) {
    const index = section.textLower.indexOf(keyword)
    const headingHit = section.heading.toLowerCase().includes(keyword)
    if (index === -1 && !headingHit) continue

    found.push({
      key: `content:${section.docId}:${section.anchor}:${found.length}`,
      title: section.heading,
      breadcrumb: section.docTitle,
      path: `/doc/${section.docId}`,
      anchor: section.anchor,
      ...(index === -1
        ? { before: '', match: '', after: '' }
        : buildSnippet(section, keyword, index)),
    })
    if (found.length >= MAX_CONTENT_RESULTS) break
  }
  return found
}

/* ---------- 输入联动 ---------- */

let timer: ReturnType<typeof setTimeout> | undefined
// 输入变化后旧查询的结果要丢弃，避免异步加载完成后覆盖新结果
let searchToken = 0

const runSearch = async (keyword: string, token: number) => {
  loading.value = true
  try {
    const indexed = await ensureSections()
    if (token !== searchToken) return
    contentResults.value = matchContent(keyword, indexed)
    activeIndex.value = 0
  } finally {
    if (token === searchToken) loading.value = false
  }
}

watch(query, (value) => {
  searchToken += 1
  const token = searchToken
  const keyword = value.trim().toLowerCase()

  clearTimeout(timer)
  contentResults.value = []
  activeIndex.value = 0

  if (!keyword) {
    menuResults.value = []
    loading.value = false
    return
  }

  // Esc 关闭后继续输入（焦点还在输入框里）也要重新展开
  open.value = true
  menuResults.value = matchMenus(keyword)
  timer = setTimeout(() => runSearch(keyword, token), DEBOUNCE)
})

/* ---------- 交互 ---------- */

const clear = () => {
  query.value = ''
  open.value = true
  inputRef.value?.focus()
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    open.value = false
    return
  }

  const total = results.value.length
  if (!open.value) open.value = true
  if (total === 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % total
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + total) % total
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    go(results.value[activeIndex.value])
  }
}

const scrollActiveIntoView = async () => {
  await nextTick()
  panelRef.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
    block: 'nearest',
  })
}

const go = async (result?: SearchResult) => {
  if (!result) return
  open.value = false
  query.value = ''
  contentResults.value = []
  menuResults.value = []

  await router.push(result.path)
  await nextTick()
  // 路由的 scrollBehavior 会在同一个 tick 里回到顶部，等它执行完再定位到命中小节
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  // 正文标题的 id 与 slugify 一致，能定位到命中的小节
  const target = result.anchor ? document.getElementById(result.anchor) : null
  if (target) target.scrollIntoView({ block: 'start' })
  else window.scrollTo({ top: 0 })
}

const onPointerDown = (event: PointerEvent) => {
  if (!containerRef.value?.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  clearTimeout(timer)
})
</script>

<style scoped>
.doc-search {
  position: relative;
  flex: 1;
  max-width: 420px;
  min-width: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.search-box.focused {
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.search-icon {
  flex: none;
  opacity: 0.6;
}

.search-input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-h);
  font: inherit;
  font-size: 14px;
  outline: none;
}

.search-input::placeholder {
  color: var(--text);
  opacity: 0.6;
}

.clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--accent-bg);
  color: var(--accent);
  cursor: pointer;
}

.clear:hover {
  background: var(--accent);
  color: #fff;
}

/* ---------- 结果面板 ---------- */
.panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 40;
  max-height: 380px;
  padding: 6px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  box-shadow: var(--shadow);
}

.hint {
  margin: 0;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text);
  opacity: 0.75;
}

.group-title {
  margin: 6px 0 4px;
  padding: 0 12px;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--text);
  opacity: 0.6;
}

.option {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.option.active {
  background: var(--accent-bg);
}

.option-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.option-title {
  font-size: 14px;
  color: var(--text-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-meta {
  flex: none;
  max-width: 45%;
  font-size: 12px;
  color: var(--text);
  opacity: 0.65;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-snippet {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text);
  opacity: 0.8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.option-snippet mark {
  padding: 0 1px;
  border-radius: 2px;
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 600;
}

/* 出现 / 消失 */
.search-panel-enter-active,
.search-panel-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.search-panel-enter-from,
.search-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
