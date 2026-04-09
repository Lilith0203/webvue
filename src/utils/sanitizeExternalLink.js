/**
 * 去掉常见外链跟踪参数（如 B 站分享后缀 &share_source=copy_web&vd_source=...）
 */
export function sanitizeExternalStoryLink(urlString) {
  if (urlString == null || typeof urlString !== 'string') return urlString ?? ''
  const trimmed = urlString.trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) return trimmed
  try {
    const u = new URL(trimmed)
    ;['share_source', 'vd_source'].forEach((key) => u.searchParams.delete(key))
    return u.toString()
  } catch {
    return trimmed
  }
}
