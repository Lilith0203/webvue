/** 悬停/触摸显示自定义 tooltip（剧情列表、详情等共用） */

export function showCustomTooltip(event, content, options = {}) {
  const html = options.html
  const allowLinks = options.allowLinks === true

  if (html) {
    if (!String(html).trim()) return
  } else {
    if (!content || !content.trim()) return
    if (
      !allowLinks &&
      content.includes('[') &&
      content.includes('](') &&
      content.includes(')')
    ) {
      return
    }
  }

  const anchor = event.currentTarget || event.target

  const existingTooltip = document.querySelector('.custom-tooltip')
  if (existingTooltip) {
    if (existingTooltip.__owner === anchor) {
      existingTooltip.remove()
      return
    }
    existingTooltip.remove()
  }

  const tooltip = document.createElement('div')
  tooltip.className = html
    ? 'custom-tooltip custom-tooltip--html'
    : 'custom-tooltip'
  if (html) {
    tooltip.innerHTML = html
  } else {
    tooltip.textContent = content
  }
  tooltip.style.position = 'absolute'
  tooltip.style.background = 'rgba(0,0,0,0.85)'
  tooltip.style.color = '#fff'
  tooltip.style.padding = '4px 12px'
  tooltip.style.borderRadius = '3px'
  tooltip.style.fontSize = '0.85rem'
  tooltip.style.lineHeight = '1.5'
  tooltip.style.whiteSpace = html ? 'normal' : 'pre-wrap'
  tooltip.style.zIndex = '9999'
  tooltip.style.maxWidth = '80vw'
  tooltip.style.opacity = '0.85'
  tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'

  const rect = anchor.getBoundingClientRect()
  tooltip.style.left = rect.left + window.scrollX + 'px'
  tooltip.style.top = rect.bottom + window.scrollY + 4 + 'px'

  tooltip.__owner = anchor
  document.body.appendChild(tooltip)

  const removeTooltip = (e) => {
    if (!tooltip.contains(e.target) && e.target !== anchor) {
      tooltip.remove()
      document.removeEventListener('click', removeTooltip, true)
    }
  }
  setTimeout(() => {
    document.addEventListener('click', removeTooltip, true)
  }, 0)
}

export function hideCustomTooltip() {
  const existingTooltip = document.querySelector('.custom-tooltip')
  if (existingTooltip) existingTooltip.remove()
}

export function handleTooltipTouch(event, content, options = {}) {
  event.stopPropagation()
  showCustomTooltip(event, content, options)
}
