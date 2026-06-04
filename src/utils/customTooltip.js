/** 悬停/触摸显示自定义 tooltip（剧情列表、详情等共用） */

let activeTooltipCleanup = null

const OPEN_GRACE_MS = 500

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
  tooltip.style.touchAction = 'manipulation'
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

function eventPathIncludes(event, node) {
  if (!event || !node) return false
  if (typeof event.composedPath === 'function') {
    return event.composedPath().includes(node)
  }
  const target = event.target
  return target === node || (target && node.contains(target))
}

function openTooltipLink(link) {
  const href = link.getAttribute('href') || link.href
  if (!href || href === '#') return
  window.open(href, '_blank', 'noopener,noreferrer')
}

function bindInteractiveTooltipLinks(tooltip) {
  tooltip.querySelectorAll('a[href]').forEach((link) => {
    link.style.pointerEvents = 'auto'
    link.style.cursor = 'pointer'
    link.style.touchAction = 'manipulation'

    const onLinkActivate = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation()
      }
      openTooltipLink(link)
    }

    link.addEventListener('click', onLinkActivate)
    link.addEventListener('touchend', onLinkActivate, { passive: false })
  })
}

/** 推荐图标等：点击打开，再点图标或点其它区域关闭；滚动时关闭 */
function bindTapPinnedDismiss(tooltip, anchor, options = {}) {
  const dismissOnScroll = options.dismissOnScroll !== false
  const ignoreUntil = Date.now() + 400
  const openedAt = Date.now()

  const onDocumentClick = (e) => {
    if (Date.now() < ignoreUntil) return
    if (eventPathIncludes(e, anchor)) return
    if (eventPathIncludes(e, tooltip)) return
    hideCustomTooltip()
  }

  const onScroll = (e) => {
    if (!dismissOnScroll) return
    if (Date.now() - openedAt < OPEN_GRACE_MS) return
    if (eventPathIncludes(e, tooltip)) return
    hideCustomTooltip()
  }

  const onWheel = (e) => {
    if (!dismissOnScroll) return
    if (Date.now() - openedAt < OPEN_GRACE_MS) return
    if (eventPathIncludes(e, tooltip)) return
    hideCustomTooltip()
  }

  setTimeout(() => {
    document.addEventListener('click', onDocumentClick, true)
  }, 0)

  if (dismissOnScroll) {
    document.addEventListener('scroll', onScroll, true)
    const useWheelDismiss =
      typeof window !== 'undefined' &&
      !window.matchMedia('(pointer: coarse)').matches
    if (useWheelDismiss) {
      window.addEventListener('wheel', onWheel, { passive: true, capture: true })
    }
    activeTooltipCleanup = () => {
      document.removeEventListener('click', onDocumentClick, true)
      document.removeEventListener('scroll', onScroll, true)
      if (useWheelDismiss) {
        window.removeEventListener('wheel', onWheel, { capture: true })
      }
    }
    return
  }

  activeTooltipCleanup = () => {
    document.removeEventListener('click', onDocumentClick, true)
  }
}

function bindDismiss(tooltip, anchor, options = {}) {
  if (options.tapPinned) {
    bindTapPinnedDismiss(tooltip, anchor, options)
    return
  }

  const dismissOnScroll = options.dismissOnScroll !== false
  const interactive = options.interactive === true
  const openedAt = Date.now()
  const ignoreDismissUntil = openedAt + OPEN_GRACE_MS

  const shouldDismissOutside = (e) => {
    if (Date.now() < ignoreDismissUntil) return false
    if (!e) return true
    if (eventPathIncludes(e, tooltip)) return false
    if (eventPathIncludes(e, anchor)) return false
    return true
  }

  const dismissOutside = (e) => {
    if (!shouldDismissOutside(e)) return
    hideCustomTooltip()
  }

  const reposition = () => {
    if (!document.body.contains(tooltip) || !document.contains(anchor)) {
      hideCustomTooltip()
      return
    }
    positionTooltipNearAnchor(tooltip, anchor)
  }

  const isScrollInsideTooltip = (e) => eventPathIncludes(e, tooltip)

  const onScroll = (e) => {
    if (Date.now() - openedAt < OPEN_GRACE_MS) return
    if (!dismissOnScroll) {
      if (!isScrollInsideTooltip(e)) reposition()
      return
    }
    if (isScrollInsideTooltip(e)) return
    hideCustomTooltip()
  }

  const onWheel = (e) => {
    if (Date.now() - openedAt < OPEN_GRACE_MS) return
    if (!dismissOnScroll) return
    if (isScrollInsideTooltip(e)) return
    hideCustomTooltip()
  }

  if (interactive) {
    bindInteractiveTooltipLinks(tooltip)
  }

  document.addEventListener('scroll', onScroll, true)

  const useWheelDismiss =
    dismissOnScroll &&
    typeof window !== 'undefined' &&
    !window.matchMedia('(pointer: coarse)').matches

  if (useWheelDismiss) {
    window.addEventListener('wheel', onWheel, { passive: true, capture: true })
  }

  window.addEventListener('resize', reposition)
  document.addEventListener('pointerdown', dismissOutside, false)

  activeTooltipCleanup = () => {
    document.removeEventListener('pointerdown', dismissOutside, false)
    document.removeEventListener('scroll', onScroll, true)
    if (useWheelDismiss) {
      window.removeEventListener('wheel', onWheel, { capture: true })
    }
    window.removeEventListener('resize', reposition)
  }
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

  bindDismiss(tooltip, anchor, {
    tapPinned: options.tapPinned === true,
    dismissOnScroll: options.dismissOnScroll !== false,
    interactive: !!(html && allowLinks)
  })
}

/** 推荐图标：仅 PC 鼠标悬停（pointerType 必须为 mouse） */
export function onRecommendTooltipPointerEnter(event, content) {
  if (event.pointerType !== 'mouse') return
  showCustomTooltip(event, content, {
    tapPinned: false,
    dismissOnScroll: true,
    toggleOnSameAnchor: false
  })
}

export function onRecommendTooltipPointerLeave(event) {
  if (event.pointerType !== 'mouse') return
  hideCustomTooltip()
}

/** 推荐图标：点击切换（手机/平板用 click，不用 touchstart） */
export function handleRecommendTooltipClick(event, content) {
  if (!content?.trim()) return

  const anchor = event.currentTarget || event.target
  const existing = document.querySelector('body > .custom-tooltip')

  if (existing?.__owner === anchor) {
    hideCustomTooltip()
    return
  }

  showCustomTooltip(event, content, {
    tapPinned: true,
    dismissOnScroll: true,
    toggleOnSameAnchor: false
  })
}
