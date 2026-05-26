/** 悬停/触摸显示自定义 tooltip（剧情列表、详情等共用） */

let activeTooltipCleanup = null

function detachTooltipListeners() {
  if (activeTooltipCleanup) {
    activeTooltipCleanup()
    activeTooltipCleanup = null
  }
}

export function hideCustomTooltip() {
  document.querySelectorAll('body > .custom-tooltip').forEach((el) => el.remove())
  detachTooltipListeners()
}

function applyTooltipBaseStyle(tooltip, html) {
  tooltip.style.background = 'rgba(0,0,0,0.85)'
  tooltip.style.color = '#fff'
  tooltip.style.padding = html ? '4px 14px' : '4px 12px'
  tooltip.style.borderRadius = '3px'
  tooltip.style.fontSize = '0.85rem'
  tooltip.style.lineHeight = '1.5'
  tooltip.style.whiteSpace = html ? 'normal' : 'pre-wrap'
  tooltip.style.zIndex = '9999'
  tooltip.style.maxWidth = html ? 'min(92vw, 420px)' : '80vw'
  tooltip.style.opacity = '0.85'
  tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
  tooltip.style.pointerEvents = 'auto'
  tooltip.style.position = 'fixed'
  tooltip.style.transform = 'none'
  tooltip.style.margin = '0'
}

/** 按锚点当前视口位置放置（fixed，每次调用都重新测量） */
export function positionTooltipNearAnchor(tooltip, anchor) {
  if (!tooltip || !anchor || !document.contains(anchor)) return

  const rect = anchor.getBoundingClientRect()
  const margin = 8
  const gap = 4

  if (!tooltip.isConnected) {
    document.body.appendChild(tooltip)
  }

  tooltip.style.visibility = 'hidden'
  tooltip.style.left = '0'
  tooltip.style.top = '0'

  const tw = tooltip.offsetWidth
  const th = tooltip.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = rect.left
  let top = rect.bottom + gap

  if (left + tw > vw - margin) left = vw - tw - margin
  if (left < margin) left = margin

  if (top + th > vh - margin) {
    const above = rect.top - gap - th
    top = above >= margin ? above : Math.max(margin, vh - th - margin)
  }

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
  tooltip.style.visibility = 'visible'
}

function bindDismiss(tooltip, anchor) {
  const ignoreDismissUntil = Date.now() + 320

  const isInsideTooltip = (target) => target && tooltip.contains(target)

  const shouldDismiss = (e) => {
    if (Date.now() < ignoreDismissUntil) return false
    if (!e) return true
    if (isInsideTooltip(e.target)) return false
    if (e.target === anchor || anchor.contains(e.target)) return false
    return true
  }

  const dismiss = (e) => {
    if (!shouldDismiss(e)) return
    hideCustomTooltip()
  }

  const reposition = () => {
    if (!document.body.contains(tooltip) || !document.contains(anchor)) {
      hideCustomTooltip()
      return
    }
    positionTooltipNearAnchor(tooltip, anchor)
  }

  const onScroll = (e) => {
    if (e?.target && tooltip.contains(e.target)) return
    reposition()
  }

  tooltip.addEventListener('click', (e) => {
    const link = e.target.closest('a')
    if (link?.href) e.stopPropagation()
  })

  document.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', reposition)

  activeTooltipCleanup = () => {
    document.removeEventListener('click', dismiss, true)
    document.removeEventListener('touchend', dismiss, true)
    document.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', reposition)
  }

  setTimeout(() => {
    document.addEventListener('click', dismiss, true)
    document.addEventListener('touchend', dismiss, true)
  }, 320)
}

export function showCustomTooltip(event, content, options = {}) {
  const html = options.html
  const allowLinks = options.allowLinks === true
  const toggleOnSameAnchor = options.toggleOnSameAnchor !== false

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

  const existing = document.querySelector('body > .custom-tooltip')
  if (existing) {
    if (existing.__owner === anchor && toggleOnSameAnchor) {
      hideCustomTooltip()
      return
    }
    hideCustomTooltip()
  }

  const tooltip = document.createElement('div')
  tooltip.className = html
    ? 'custom-tooltip custom-tooltip--html'
    : 'custom-tooltip'
  if (html) {
    tooltip.innerHTML = html
    tooltip.style.maxHeight = 'min(60vh, 60dvh)'
    tooltip.style.overflowY = 'auto'
    tooltip.style.webkitOverflowScrolling = 'touch'
  } else {
    tooltip.textContent = content
  }

  applyTooltipBaseStyle(tooltip, !!html)
  tooltip.__owner = anchor
  document.body.appendChild(tooltip)

  const place = () => positionTooltipNearAnchor(tooltip, anchor)
  requestAnimationFrame(() => {
    requestAnimationFrame(place)
  })

  bindDismiss(tooltip, anchor)
}

export function handleTooltipTouch(event, content, options = {}) {
  event.stopPropagation()
  showCustomTooltip(event, content, options)
}
