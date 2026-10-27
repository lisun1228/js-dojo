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
        aria-controls="doc-search-panel"
        :aria-expanded="open"
        @focus="open = true"
        @keydown="onKeydown"
      />

      <kbd
        v-if="!query"
        class="shortcut"
        :title="`快捷键 ${shortcutLabel}`"
        >{{ shortcutLabel }}</kbd
      >

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
        id="doc-search-panel"
        ref="panelRef"
        class="panel"
      >
        <div
          v-if="trimmedQuery"
          class="filters"
        >
          <label
            class="filter-label"
            for="doc-search-category"
            >分类</label
          >
          <select
            id="doc-search-category"
            v-model="categoryFilter"
            class="filter-select"
          >
            <option value="">全部分类</option>
            <option
              v-for="category in categoryOptions"
              :key="category"
              :value="category"
            >
              {{ category }}
            </option>
          </select>
          <span class="result-count">共 {{ results.length }} 条</span>
        </div>

        <template v-if="!trimmedQuery">
          <p class="hint">输入关键词，可搜索菜单标题与笔记正文</p>

          <div
            v-if="recentSearches.length"
            class="recent"
          >
            <div class="recent-head">
              <span class="group-title">最近搜索</span>
              <button
                type="button"
                class="recent-clear"
                @click="clearRecent"
              >
                清空
              </button>
            </div>
            <div class="recent-list">
              <button
                v-for="keyword in recentSearches"
                :key="keyword"
                type="button"
                class="recent-item"
                @click="useRecent(keyword)"
              >
                {{ keyword }}
              </button>
            </div>
          </div>
        </template>

        <div
          v-else
          id="doc-search-results"
          class="results"
          role="listbox"
          aria-label="搜索结果"
          :aria-busy="loading"
        >
          <p
            v-if="results.length === 0"
            class="hint"
            role="presentation"
          >
            {{ loading ? '正在加载笔记索引…' : `没有找到「${trimmedQuery}」相关内容` }}
          </p>

          <template v-if="menuResults.length">
            <p
              class="group-title"
              role="presentation"
            >
              菜单
            </p>
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
            <p
              class="group-title"
              role="presentation"
            >
              笔记内容
            </p>
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
            v-if="loading && results.length > 0"
            class="hint"
            role="presentation"
          >
            正在加载笔记索引…
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { IndexedSection } from 'virtual:search-index'
import { isNavGroup, navMenus } from '../config/nav-menus'
import { categories } from '../router/tutorials'

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
  /** 标题命中记 2，仅正文命中记 1，用于把更相关的结果排在前面 */
  score?: number
}

const MAX_MENU_RESULTS = 5
const MAX_CONTENT_RESULTS = 8
const MAX_RECENT = 5
const RECENT_KEY = 'js-dojo-recent-searches'
const DEBOUNCE = 180

const router = useRouter()

// 分类筛选与结果归属都直接复用教程清单，不在这里再维护一份分类名
const categoryOptions = categories.map((category) => category.title)
const docCategoryById = new Map(
  categories.flatMap((category) =>
    category.items.map((item) => [item.id, category.title] as const),
  ),
)

const categoryFilter = ref('')

const loadRecent = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT)
  } catch {
    // 隐私模式或数据损坏时按空记录处理
    return []
  }
}

const recentSearches = ref<string[]>(loadRecent())

const persistRecent = () => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value))
  } catch {
    // 存储不可用不影响搜索
  }
}

const rememberSearch = (keyword: string) => {
  if (!keyword) return
  recentSearches.value = [
    keyword,
    ...recentSearches.value.filter((item) => item !== keyword),
  ].slice(0, MAX_RECENT)
  persistRecent()
}

const useRecent = (keyword: string) => {
  query.value = keyword
  inputRef.value?.focus()
}

const clearRecent = () => {
  recentSearches.value = []
  persistRecent()
}

const shortcutLabel = /mac/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K'

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
    if (categoryFilter.value && group !== categoryFilter.value) continue

    const titleHit = item.title.toLowerCase().includes(keyword)
    const groupHit = group.toLowerCase().includes(keyword)
    if (!titleHit && !groupHit) continue

    found.push({
      key: `menu:${item.path}`,
      title: item.title,
      breadcrumb: group,
      path: item.path,
      anchor: '',
      before: '',
      match: '',
      after: '',
      score: titleHit ? 2 : 1,
    })
  }

  return found.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, MAX_MENU_RESULTS)
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
    if (categoryFilter.value && docCategoryById.get(section.docId) !== categoryFilter.value) {
      continue
    }

    const index = section.textLower.indexOf(keyword)
    const headingHit = section.heading.toLowerCase().includes(keyword)
    if (index === -1 && !headingHit) continue

    found.push({
      key: `content:${section.docId}:${section.anchor}:${found.length}`,
      title: section.heading,
      breadcrumb: section.docTitle,
      path: `/doc/${section.docId}`,
      anchor: section.anchor,
      score: headingHit ? 2 : 1,
      ...(index === -1
        ? { before: '', match: '', after: '' }
        : buildSnippet(section, keyword, index)),
    })
  }

  // 标题命中优先；同分保持文档原顺序（Array.sort 稳定）
  return found.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, MAX_CONTENT_RESULTS)
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

// 切换分类后立即按当前关键词重算，不等输入变化
watch(categoryFilter, () => {
  activeIndex.value = 0
  const keyword = trimmedQuery.value.toLowerCase()
  if (!keyword) return

  menuResults.value = matchMenus(keyword)
  searchToken += 1
  clearTimeout(timer)
  void runSearch(keyword, searchToken)
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
  rememberSearch(trimmedQuery.value)
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

// Cmd/Ctrl + K 在任意页面唤起搜索
const onGlobalKeydown = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return

  event.preventDefault()
  open.value = true
  inputRef.value?.focus()
  inputRef.value?.select()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onGlobalKeydown)
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

.shortcut {
  flex: none;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text);
  opacity: 0.65;
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

.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.filter-label {
  font-size: 12px;
  color: var(--text);
  opacity: 0.7;
}

.filter-select {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text-h);
  font: inherit;
  font-size: 12px;
}

.result-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text);
  opacity: 0.65;
}

.group-title {
  margin: 6px 0 4px;
  padding: 0 12px;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--text);
  opacity: 0.6;
}

/* ---------- 最近搜索 ---------- */
.recent {
  padding: 0 12px 10px;
}

.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recent .group-title {
  margin: 0;
  padding: 0;
}

.recent-clear {
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.recent-item {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.recent-item:hover {
  border-color: var(--accent-border);
  color: var(--accent);
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

@media (max-width: 640px) {
  .shortcut {
    display: none;
  }
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
