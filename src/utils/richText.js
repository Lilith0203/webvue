import { marked } from 'marked'

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
  const mark = checked ? '✓' : ''
  if (interactive) {
    return `<button type="button" class="${cls}" data-guide-task-idx="${idx}" aria-pressed="${checked ? 'true' : 'false'}">${mark}</button>`
  }
  return `<span class="${cls}">${mark}</span>`
}

/**
 * 将 - [ ] / - [x] 行预处理为 div，避免 marked 生成 ul/li
 */
export function preprocessGuideTaskLines(content, interactive = false) {
  resetGuideTaskIndex()
  const taskLineRe = /^(\s*)(?:[-*+]|\d+\.)\s+\[([ xX])\]\s*(.*)$/gm
  return String(content ?? '').replace(taskLineRe, (_, indent, check, text) => {
    const checked = check.toLowerCase() === 'x'
    const indentEm = Math.floor(String(indent).replace(/\t/g, '  ').length / 2)
    const style = indentEm > 0 ? ` style="margin-left:${indentEm * 1.5}em"` : ''
    const checkbox = renderGuideCheckbox(checked, interactive)
    const inlineHtml = marked.parseInline(String(text).trim())
    return `\n<div class="guide-task-line"${style}>${checkbox}<span class="guide-task-text">${inlineHtml}</span></div>\n`
  })
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

/** 编辑器中 2 个半角空格 ≈ 1 个汉字宽，转为等宽全角空格 */
function leadingSpacesToChineseIndent(indent) {
  const spaces = indent.replace(/\t/g, '    ').length
  const fullWidth = Math.floor(spaces / 2)
  const half = spaces % 2
  return '\u3000'.repeat(fullWidth) + (half ? '\u00a0' : '')
}

/**
 * 将段落行首空格转为全角空格，与编辑区「2 半角 = 1 汉字」对齐
 * 避免 4 个及以上前导空格被 Markdown 解析为 <pre><code>
 * 列表、任务、标题、引用行不处理；``` 围栏内保持原样
 */
export function preserveLeadingSpacesInMarkdown(content) {
  const lines = String(content ?? '').split('\n')
  let inFence = false

  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence || !line || /^\s*</.test(line)) return line

      const m = line.match(/^(\s+)(.+)$/)
      if (!m) return line

      const body = m[2]
      if (/^#{1,6}\s/.test(body)) return line
      if (/^>/.test(body)) return line
      if (/^(?:[-*+]|\d+\.)\s/.test(body)) return line

      return leadingSpacesToChineseIndent(m[1]) + body
    })
    .join('\n')
}

/** 转义单个 *，保留 ** 粗体（与剧情/攻略详情一致） */
export function escapeMarkdownSingleAsterisks(content) {
  const placeholder = '___DOUBLESTAR___'
  let text = String(content ?? '')
  text = text.replace(/\*\*/g, placeholder)
  text = text.replace(/\*/g, '\\*')
  return text.replace(new RegExp(placeholder, 'g'), '**')
}

/**
 * 单行引用（> …）后若紧跟普通段落，插入空行结束 blockquote。
 * 避免后续未加 > 的行被 Markdown 吞进同一段引用。
 */
export function isolateSingleLineBlockquotes(content) {
  const lines = String(content ?? '').split('\n')
  let inFence = false
  const result = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      result.push(line)
      continue
    }
    if (inFence) {
      result.push(line)
      continue
    }

    result.push(line)

    if (/^>\s/.test(line)) {
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      const next = lines[j]
      if (next !== undefined && !/^>\s/.test(next)) {
        result.push('')
      }
    }
  }

  return result.join('\n')
}

/** 仅去掉 blockquote 相邻标签间的单个换行（marked 排版），保留双换行形成的空白行 */
export function compactBlockquoteHtml(html) {
  const singleNl = '\\r?\\n(?!\\r?\\n)'
  return String(html ?? '')
    .replace(new RegExp(`</p>${singleNl}<blockquote\\b`, 'gi'), '</p><blockquote')
    .replace(new RegExp(`</blockquote>${singleNl}<p\\b`, 'gi'), '</blockquote><p')
    .replace(new RegExp(`</blockquote>${singleNl}<blockquote\\b`, 'gi'), '</blockquote><blockquote')
    .replace(new RegExp(`<blockquote\\b([^>]*)>${singleNl}<p\\b`, 'gi'), '<blockquote$1><p')
    .replace(new RegExp(`</p>${singleNl}</blockquote>`, 'gi'), '</p></blockquote>')
}
