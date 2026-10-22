/**
 * build/search-index.ts 生成的虚拟模块类型声明。
 * 索引在构建期产出，运行时只被 DocSearch 按需动态导入。
 */
declare module 'virtual:search-index' {
  export interface IndexedSection {
    docId: string
    docTitle: string
    heading: string
    /** 标题锚点；文首（无二级标题前）为空，表示跳到文档顶部 */
    anchor: string
    text: string
  }

  const sections: IndexedSection[]
  export default sections
}
