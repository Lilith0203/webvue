/** 转义 HTML，用于彩色标记内的展示文本 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const COLOR_VALUE = /^[a-z#0-9]+$/i

function colorSpan(color, text) {
  const c = String(color ?? '').trim()
  if (!COLOR_VALUE.test(c)) return text
  return `<span style="color:${c}">${escapeHtml(text)}</span>`
}

/**
 * 将正文中的彩色标记转为 <span style="color:...">
 * - [color:red|红色文字] 或 [color:#ff5500|自定义]
 * - [Lilith工具箱:blue] 展示文字在前、颜色在后
 */
export function applyInlineColorMarkup(text) {
  if (!text) return ''

  let result = String(text)

  result = result.replace(
    /\[color:([a-z#0-9]+)\|(.*?)\]/gi,
    (_, color, label) => colorSpan(color, label)
  )

  result = result.replace(
    /\[([^\]:|\]]+):([a-z#0-9]+)\]/gi,
    (match, label, color) => {
      if (/^color$/i.test(label.trim())) return match
      return colorSpan(color, label)
    }
  )

  return result
}
