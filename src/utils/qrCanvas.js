import QRCode from 'qrcode'

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawModule(ctx, x, y, cellSize) {
  const pad = cellSize * 0.06
  const s = cellSize - pad * 2
  ctx.fillRect(x + pad, y + pad, s, s)
}

function createLinearGradient(ctx, x, y, w, h, angleDeg, colorStart, colorEnd) {
  const rad = (angleDeg * Math.PI) / 180
  const cx = x + w / 2
  const cy = y + h / 2
  const len = Math.sqrt(w * w + h * h) / 2
  const x0 = cx - Math.cos(rad) * len
  const y0 = cy - Math.sin(rad) * len
  const x1 = cx + Math.cos(rad) * len
  const y1 = cy + Math.sin(rad) * len
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
  gradient.addColorStop(0, colorStart)
  gradient.addColorStop(1, colorEnd)
  return gradient
}

function wrapTextLines(ctx, text, maxWidth) {
  const lines = []
  for (const paragraph of String(text).split('\n')) {
    if (!paragraph) {
      lines.push('')
      continue
    }
    let line = ''
    for (const char of paragraph) {
      const next = line + char
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line)
        line = char
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines.length ? lines : ['']
}

function measureCaptionBlock(ctx, caption, qrWidth, fontSize, gap) {
  const trimmed = String(caption ?? '').trim()
  if (!trimmed) {
    return { lines: [], height: 0, gap: 0 }
  }

  ctx.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`
  const maxWidth = Math.max(40, qrWidth - 24)
  const lines = wrapTextLines(ctx, trimmed, maxWidth)
  const lineHeight = fontSize * 1.45
  const height = gap + lines.length * lineHeight + 10
  return { lines, height, gap, lineHeight, maxWidth }
}

function drawCaption(ctx, lines, qrWidth, qrHeight, gap, fontSize, color, lineHeight) {
  ctx.fillStyle = color
  ctx.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  let y = qrHeight + gap
  for (const line of lines) {
    ctx.fillText(line, qrWidth / 2, y)
    y += lineHeight
  }
}

function drawFrame(ctx, qrSize, frameStyle, color) {
  const inset = 6
  const lineWidth = 3
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (frameStyle === 'rounded') {
    roundRect(ctx, inset, inset, qrSize - inset * 2, qrSize - inset * 2, 16)
    ctx.stroke()
    return
  }
  if (frameStyle === 'square') {
    ctx.strokeRect(inset, inset, qrSize - inset * 2, qrSize - inset * 2)
  }
}

function resolveForegroundFill(ctx, qrCanvasSize, options) {
  const {
    useGradient,
    darkColor,
    gradientStart,
    gradientEnd,
    gradientAngle
  } = options

  if (useGradient) {
    return createLinearGradient(
      ctx,
      0,
      0,
      qrCanvasSize,
      qrCanvasSize,
      gradientAngle,
      gradientStart,
      gradientEnd
    )
  }
  return darkColor
}

/**
 * 绘制带样式与底部文字的二维码
 * @param {string} text 二维码内容
 * @param {object} options
 */
export async function renderStyledQrDataUrl(text, options = {}) {
  const {
    size = 280,
    margin = 2,
    errorCorrectionLevel = 'M',
    darkColor = '#000000',
    lightColor = '#ffffff',
    useGradient = false,
    gradientStart = '#4a9dd9',
    gradientEnd = '#499e8d',
    gradientAngle = 135,
    frameStyle = 'none',
    caption = '',
    captionColor = '#333333',
    captionFontSize = 16,
    captionGap = 12
  } = options

  const qr = QRCode.create(String(text), { errorCorrectionLevel })
  const moduleCount = qr.modules.size
  const moduleSize = size / (moduleCount + margin * 2)
  const qrCanvasSize = Math.round(moduleSize * (moduleCount + margin * 2))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  const captionInfo = measureCaptionBlock(
    ctx,
    caption,
    qrCanvasSize,
    captionFontSize,
    captionGap
  )

  canvas.width = qrCanvasSize
  canvas.height = qrCanvasSize + captionInfo.height

  ctx.fillStyle = lightColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const fillOptions = {
    useGradient,
    darkColor,
    gradientStart,
    gradientEnd,
    gradientAngle
  }
  ctx.fillStyle = resolveForegroundFill(ctx, qrCanvasSize, fillOptions)

  const offset = margin * moduleSize
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!qr.modules.get(row, col)) continue
      drawModule(
        ctx,
        offset + col * moduleSize,
        offset + row * moduleSize,
        moduleSize
      )
    }
  }

  if (frameStyle !== 'none') {
    const frameColor = useGradient ? gradientStart : darkColor
    drawFrame(ctx, qrCanvasSize, frameStyle, frameColor)
  }

  if (captionInfo.lines.length) {
    drawCaption(
      ctx,
      captionInfo.lines,
      qrCanvasSize,
      qrCanvasSize,
      captionInfo.gap,
      captionFontSize,
      captionColor,
      captionInfo.lineHeight
    )
  }

  return canvas.toDataURL('image/png')
}
