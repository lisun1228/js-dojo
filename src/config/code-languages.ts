/**
 * 代码块允许的语言标记。
 *
 * MarkdownView 按这份清单注册高亮，build/doc-check.ts 用它校验正文：
 * 正文里写了未登记的语言，构建前会直接报错，而不是静默退化成纯文本。
 *
 * text / mermaid 不交给 highlight.js：
 *   - text 原样输出，只显示语言角标
 *   - mermaid 在构建期已渲染成内联 SVG，运行时不经过这里
 */
export const codeLanguages = [
  'js',
  'javascript',
  'ts',
  'typescript',
  'json',
  'bash',
  'sh',
  'xml',
  'html',
  'vue',
  'css',
  'jsx',
  'http',
  'nginx',
  'sql',
  'scss',
  'sass',
  'yaml',
  'dockerfile',
  'java',
  'python',
  'apache',
  'markdown',
  'md',
  'text',
  'mermaid',
] as const

const codeLanguageSet = new Set<string>(codeLanguages)

export const isCodeLanguage = (value: string) => codeLanguageSet.has(value)
