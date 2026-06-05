/** 颜色管理中「标签颜色」且合集为「文本」的条目，用于正文 [文字:颜色名] */

export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function filterTextColors(colors) {
  return (colors || []).filter(
    (c) => c.category === 2 && c.set === '文本'
  )
}

/**
 * 在 HTML 中应用颜色管理配置（与剧情详情一致）
 * - [展示文字:颜色名称] → 使用 colors 里 name 对应的 code
 * - class="颜色名称" → 补充内联 color
 */
export function applyManagedColorMarkup(html, textColors) {
  if (!html || !textColors?.length) return html || ''

  let rendered = String(html)

  textColors.forEach((color) => {
    const name = escapeRegex(color.name)
    const classRegex = new RegExp(`class="([^"]*\\s)?${name}(\\s[^"]*)?"`, 'g')
    rendered = rendered.replace(
      classRegex,
      `class="$1${color.name}$2" style="color: ${color.code};"`
    )

    const colorRegex = new RegExp(`\\[([^\\]]+):${name}\\]`, 'g')
    rendered = rendered.replace(
      colorRegex,
      `<span style="color: ${color.code};">$1</span>`
    )
  })

  return rendered
}

/**
 * 解析文章图片 alt：![描述|600](url) 中 | 后为最大显示宽度（px）
 */
export function parseArticleImageAlt(alt) {
  const raw = String(alt ?? '').trim()
  const pipe = raw.lastIndexOf('|')
  if (pipe > 0) {
    const maybeW = parseInt(raw.slice(pipe + 1), 10)
    if (Number.isFinite(maybeW) && maybeW > 0) {
      return {
        alt: raw.slice(0, pipe).trim() || 'image',
        maxWidth: Math.min(2400, Math.round(maybeW))
      }
    }
  }
  return { alt: raw || 'image', maxWidth: null }
}

export function articleImageStyleAttr(maxWidth) {
  if (!maxWidth) return ''
  return ` style="max-width: ${maxWidth}px; width: 100%; height: auto; display: block; margin: 8px auto;"`
}

export function renderArticleImageHtml(href, altText) {
  const { alt, maxWidth } = parseArticleImageAlt(altText)
  const safeAlt = alt.replace(/"/g, '&quot;')
  return `<img src="${href}" alt="${safeAlt}"${articleImageStyleAttr(maxWidth)} />`
}

/** 攻略任务列表：- [ ] / - [x]，渲染为可勾选框或只读勾 */
let guideTaskIndex = 0

export function resetGuideTaskIndex() {
  guideTaskIndex = 0
}

export function renderGuideCheckbox(checked, interactive = false) {
  const idx = guideTaskIndex++
  const cls = `guide-task-check${checked ? ' is-checked' : ''}`
  // 未选中用不换行空格占位，与选中时 ✓ 保持相同行高，避免方框视觉上偏上
  const mark = checked ? '✓' : '\u00a0'
  if (interactive) {
    return `<button type="button" class="${cls}" data-guide-task-idx="${idx}" aria-pressed="${checked ? 'true' : 'false'}">${mark}</button>`
  }
  return `<span class="${cls}">${mark}</span>`
}

/** 按预览中的序号切换对应任务项勾选状态 */
export function toggleGuideTaskInMarkdown(content, taskIdx) {
  const target = Number(taskIdx)
  if (!Number.isFinite(target) || target < 0) return content

  let count = 0
  const lines = String(content ?? '').split('\n')
  const taskLineRe = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](\s*)(.*)$/

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(taskLineRe)
    if (!m) continue
    if (count === target) {
      const wasChecked = m[2].toLowerCase() === 'x'
      lines[i] = `${m[1]}[${wasChecked ? ' ' : 'x'}]${m[3]}${m[4]}`
      return lines.join('\n')
    }
    count++
  }
  return content
}

/** 转义单个 *，保留 ** 粗体（与剧情/攻略详情一致） */
export function escapeMarkdownSingleAsterisks(content) {
  const placeholder = '___DOUBLESTAR___'
  let text = String(content ?? '')
  text = text.replace(/\*\*/g, placeholder)
  text = text.replace(/\*/g, '\\*')
  return text.replace(new RegExp(placeholder, 'g'), '**')
}
