/** 解码 location.hash / route.hash 里的 id，非法编码时保留原文 */
export const hashId = (hash: string) => {
  const raw = hash.replace(/^#/, '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** 找到 hash 对应的标题；正文还没渲染时返回 null */
export const hashTarget = (hash: string) => {
  const id = hashId(hash)
  return id ? document.getElementById(id) : null
}
