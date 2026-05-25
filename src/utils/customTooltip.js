/** 悬停/触摸显示自定义 tooltip（剧情列表、详情等共用） */

export function showCustomTooltip(event, content) {
  if (!content || !content.trim()) return
  if (content.includes('[') && content.includes('](') && content.includes(')')) {
    return
  }

  const existingTooltip = document.querySelector('.custom-tooltip')
  if (existingTooltip) {
    if (existingTooltip.__owner === event.target) {
      existingTooltip.remove()
      return
    }
    existingTooltip.remove()
  }

  const tooltip = document.createElement('div')
  tooltip.className = 'custom-tooltip'
  tooltip.textContent = content
  tooltip.style.position = 'absolute'
  tooltip.style.background = 'rgba(0,0,0,0.85)'
  tooltip.style.color = '#fff'
  tooltip.style.padding = '4px 12px'
  tooltip.style.borderRadius = '3px'
  tooltip.style.fontSize = '0.85rem'
  tooltip.style.lineHeight = '1.5'
  tooltip.style.whiteSpace = 'pre-wrap'
  tooltip.style.zIndex = '9999'
  tooltip.style.maxWidth = '80vw'
  tooltip.style.opacity = '0.85'
  tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'

  const rect = event.target.getBoundingClientRect()
  tooltip.style.left = rect.left + window.scrollX + 'px'
  tooltip.style.top = rect.bottom + window.scrollY + 4 + 'px'

  tooltip.__owner = event.target
  document.body.appendChild(tooltip)

  const removeTooltip = (e) => {
    if (!tooltip.contains(e.target) && e.target !== event.target) {
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

export function handleTooltipTouch(event, content) {
  event.stopPropagation()
  showCustomTooltip(event, content)
}
