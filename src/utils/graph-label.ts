/** 分类配色：按 tutorials.ts 的分类顺序取色，明暗主题共用同一套色相 */
const palette = [
  '#aa3bff',
  '#0e7fd6',
  '#16a34a',
  '#e0447f',
  '#f59e0b',
  '#14b8a6',
  '#8b5cf6',
  '#ef4444',
  '#0ea5e9',
  '#84cc16',
  '#f97316',
  '#06b6d4',
  '#a855f7',
  '#10b981',
  '#f43f5e',
  '#6366f1',
  '#eab308',
]

export const categoryColor = (index: number) => palette[index % palette.length]

/** 侧边栏标题带「323 题」这类计数，图谱节点只保留分类名 */
export const categoryLabel = (title: string) => title.replace(/\s*\d+\s*题$/, '')

/** 教程标题带「01｜」编号，图谱里去掉编号只留主题 */
export const docLabel = (title: string) => title.replace(/^\d+｜\s*/, '')

export const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}…` : text
