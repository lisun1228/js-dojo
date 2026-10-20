import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'
import type { Browser, Page } from 'puppeteer-core'
import type { Plugin } from 'vite'

/**
 * 构建期把 Markdown 里的 ```mermaid 代码块渲染成内联 SVG。
 *
 * - 只在构建 / 开发时跑（按内容哈希缓存到 node_modules/.cache/mermaid）
 * - 页面运行时零成本：不加载 mermaid，正文里直接是 <svg>
 * - 明暗主题各渲染一份，由 CSS 按 prefers-color-scheme 切换
 * - 用本机 Chrome 渲染（puppeteer-core 不下载浏览器），可用 CHROME_PATH 指定
 */

const CACHE_DIR = resolve('node_modules/.cache/mermaid')
const MERMAID_JS = resolve('node_modules/mermaid/dist/mermaid.min.js')
const FENCE = /^```mermaid[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter((path): path is string => Boolean(path))

const cacheKey = (code: string, theme: string) =>
  createHash('sha1').update(`${theme}\n${code}`).digest('hex').slice(0, 16)

/**
 * 压成一行：markdown-it 遇到空行会结束 HTML 块，多行 SVG 会被切碎；
 * SVG 里换行只起排版作用，合并成空格不影响渲染。
 */
const oneLine = (svg: string) =>
  svg
    .replace(/^<\?xml[^>]*\?>\s*/i, '')
    .replace(/background-color:\s*[^;"]*;?/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim()

let browserPromise: Promise<Browser> | null = null
let pagePromise: Promise<Page> | null = null

/** 复用同一个浏览器页面，避免每张图都启动一次 Chrome */
function getPage(): Promise<Page> {
  pagePromise ??= (async () => {
    if (!existsSync(MERMAID_JS)) {
      throw new Error('未找到 mermaid，请先执行 npm install')
    }
    const executablePath = CHROME_CANDIDATES.find((path) => existsSync(path))
    if (!executablePath) {
      throw new Error('未找到 Chrome/Chromium，请安装 Chrome 或用 CHROME_PATH 指定路径')
    }

    const browser = await puppeteer.launch({ executablePath, headless: true })
    browserPromise = Promise.resolve(browser)

    const page = await browser.newPage()
    await page.setContent('<!DOCTYPE html><html><body></body></html>')
    await page.addScriptTag({ path: MERMAID_JS })
    return page
  })()

  return pagePromise
}

async function renderSvg(code: string, theme: 'default' | 'dark'): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true })

  const key = cacheKey(code, theme)
  const cachedFile = join(CACHE_DIR, `${theme}-${key}.svg`)
  if (existsSync(cachedFile)) return readFileSync(cachedFile, 'utf8')

  const page = await getPage()
  const svg = await page.evaluate(
    async (source: string, themeName: string) => {
      const mermaid = (
        globalThis as unknown as {
          mermaid: {
            initialize: (options: Record<string, unknown>) => void
            render: (id: string, text: string) => Promise<{ svg: string }>
          }
        }
      ).mermaid

      mermaid.initialize({ startOnLoad: false, theme: themeName, securityLevel: 'loose' })
      const id = `mermaid-${Date.now()}-${Math.round(Math.random() * 1e6)}`
      const result = await mermaid.render(id, source)
      return result.svg
    },
    code,
    theme,
  )

  const result = oneLine(svg)
  writeFileSync(cachedFile, result)
  return result
}

export function mermaidPlugin(): Plugin {
  return {
    name: 'inline-mermaid',
    enforce: 'pre',

    async load(id) {
      const [file, query] = id.split('?')
      if (!file.endsWith('.md') || query !== 'raw') return null

      const md = readFileSync(file, 'utf8')
      const blocks = [...md.matchAll(FENCE)]
      if (blocks.length === 0) return null

      // md 变更后重新渲染
      this.addWatchFile(file)

      let result = ''
      let last = 0

      for (const block of blocks) {
        const start = block.index ?? 0
        result += md.slice(last, start)

        const code = block[1].trim()
        const light = await renderSvg(code, 'default')
        const dark = await renderSvg(code, 'dark')
        result +=
          '<div class="mermaid-diagram">' +
          `<div class="mermaid-diagram__light">${light}</div>` +
          `<div class="mermaid-diagram__dark">${dark}</div>` +
          '</div>'

        last = start + block[0].length
      }

      result += md.slice(last)

      return `export default ${JSON.stringify(result)}`
    },

    async closeBundle() {
      if (!browserPromise) return
      const browser = await browserPromise
      browserPromise = null
      pagePromise = null
      await browser.close()
    },
  }
}
