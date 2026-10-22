/**
 * 划词浮层里的 AI 对话入口。
 * 增删站点只改这个数组：name 是按钮文案，url 是对话页地址。
 * 这些站点都不支持 URL 参数预填，点击时统一「复制选中内容 + 打开页面」，粘贴后即可提问。
 */
export interface AiSearchProvider {
  /** 唯一标识，仅用于列表 key */
  id: string
  /** 按钮文案 */
  name: string
  /** 对话页地址 */
  url: string
}

export const aiSearchProviders: AiSearchProvider[] = [
  { id: 'doubao', name: '豆包', url: 'https://www.doubao.com/chat/' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/' },
  { id: 'zhipu', name: '智谱清言', url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh' },
]
