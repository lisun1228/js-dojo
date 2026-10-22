/**
 * 生成 GitHub 风格锚点 id，正文里的 [目录](#xxx) 才能跳到对应标题。
 * 规则：转小写、去掉标点、空格换成 -（保留中英文与数字）。
 *
 * 正文渲染（MarkdownView）与搜索结果跳转（DocSearch）必须用同一套规则，
 * 否则拼出来的锚点在页面上找不到。
 */
export const slugify = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
