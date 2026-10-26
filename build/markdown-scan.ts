import { slugify } from '../src/utils/slugify.ts'

/** 文档里参与结构解析的行：跳过围栏代码块，避免把示例代码当成标题或链接。 */
export interface VisibleLine {
  line: number
  text: string
}

export interface Heading {
  level: number
  text: string
  line: number
  anchor: string
}

export const collectVisibleLines = (lines: string[]): VisibleLine[] => {
  const visible: VisibleLine[] = []
  let fence: string | undefined

  lines.forEach((text, index) => {
    if (fence) {
      if (text.trimStart().startsWith(fence)) fence = undefined
      return
    }

    const fenceMatch = /^\s*(```|~~~)/.exec(text)
    if (fenceMatch) {
      fence = fenceMatch[1]
      return
    }

    visible.push({ line: index + 1, text })
  })

  return visible
}

export const parseHeadings = (visible: VisibleLine[]): Heading[] =>
  visible.flatMap(({ line, text }) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(text)
    if (!match) return []
    return [{ level: match[1].length, text: match[2], line, anchor: slugify(match[2]) }]
  })
