import type { BatchPhoto } from '../types'
import { CLASSIC_LAYOUT, formatWatermarkDevice } from './ClassicLayout'
import { SOFT_LAYOUT, softFontRatios } from './SoftLayout'

export interface ExportStyle {
  mode: 'classic' | 'soft'
  blurAmount: number
  format: 'jpeg' | 'png'
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load image: ${source}`))
    image.src = source
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas export failed')),
      type,
      type === 'image/jpeg' ? 1 : undefined,
    )
  })
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  overscan = 1,
): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * overscan
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function drawBlurredBackground(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  blurAmount: number,
): void {
  const backdrop = document.createElement('canvas')
  const backdropScale = Math.min(1, 1200 / Math.max(width, height))
  backdrop.width = Math.max(1, Math.round(width * backdropScale))
  backdrop.height = Math.max(1, Math.round(height * backdropScale))
  const backdropContext = backdrop.getContext('2d')
  if (!backdropContext)
    throw new Error('Canvas is unavailable')

  backdropContext.filter = `blur(${Math.max(4, blurAmount * backdrop.width / 800)}px)`
  drawCover(backdropContext, image, backdrop.width, backdrop.height, 1.12)
  context.drawImage(backdrop, 0, 0, width, height)
  context.fillStyle = 'rgba(5, 10, 18, 0.08)'
  context.fillRect(0, 0, width, height)
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

function fontFamily(value: string): string {
  const sans = 'Inter, "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif'
  const families: Record<string, string> = {
    default: sans,
    misans: `MiSans, ${sans}`,
    caveat: 'Caveat, cursive',
    helvetica: '"Helvetica Neue", Arial, sans-serif',
    futura: 'Futura, "Trebuchet MS", Arial, sans-serif',
    avenir: 'Avenir, "Segoe UI", sans-serif',
    didot: 'Didot, "Times New Roman", serif',
  }
  return families[value] ?? families.default
}

function fontWeight(value: string): number {
  return value === 'black' ? 900 : value === 'normal' ? 400 : 700
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth)
    return text
  let result = text
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth)
    result = result.slice(0, -1)
  return `${result}…`
}

async function drawWatermark(
  context: CanvasRenderingContext2D,
  photo: BatchPhoto,
  width: number,
  mediaHeight: number,
  bannerHeight: number,
): Promise<void> {
  const value = photo.formValue
  const layoutScale = value.scale
  const padding = Math.round(width * CLASSIC_LAYOUT.horizontalPadding * layoutScale)
  const titleScale = value.fontSize === 'large' ? 1.15 : value.fontSize === 'small' ? 0.85 : 1
  const titleSize = Math.max(18, Math.round(width * CLASSIC_LAYOUT.titleFontSize * layoutScale * titleScale))
  const detailSize = Math.max(13, Math.round(width * CLASSIC_LAYOUT.detailFontSize * layoutScale * titleScale))
  const family = fontFamily(value.fontFamily)
  const weight = fontWeight(value.fontWeight)
  const groupGap = Math.round(width * CLASSIC_LAYOUT.groupGap)
  const dividerWidth = Math.max(2, Math.round(width * CLASSIC_LAYOUT.dividerWidth))

  context.fillStyle = '#fff'
  context.fillRect(0, mediaHeight, width, bannerHeight)
  context.textBaseline = 'middle'
  context.font = `${weight} ${titleSize}px ${family}`

  const deviceText = formatWatermarkDevice(value.device || '')
  const deviceWidth = context.measureText(deviceText).width
  const rightTextHeadroom = Math.max(2, titleSize * 0.04)
  const rightTextWidth = Math.min(
    Math.ceil(deviceWidth + rightTextHeadroom),
    width - padding * 2 - groupGap * 2 - dividerWidth - titleSize * 4,
  )
  const rightX = Math.floor(width - padding - rightTextWidth)
  const dividerX = Math.round(rightX - groupGap - dividerWidth)

  let logo: HTMLImageElement | null = null
  try {
    logo = await loadImage(new URL(value.brand_url, window.location.href).href)
  }
  catch {
    // A missing logo should not block photo export.
  }

  const logoHeight = Math.round(width * CLASSIC_LAYOUT.dividerHeight * layoutScale)
  const logoWidth = logo ? Math.round(logoHeight * logo.naturalWidth / logo.naturalHeight) : 0
  const logoRight = dividerX - groupGap
  const leftTextWidth = Math.max(80, logoRight - logoWidth - padding * 2)
  const safeRightTextWidth = Math.max(80, width - rightX - padding)
  const titleLineHeight = titleSize * 1.32
  const detailLineHeight = detailSize * 1.3

  const textPositions = (detail: string): [number, number] => detail
    ? [
        mediaHeight + bannerHeight / 2 - detailLineHeight / 2,
        mediaHeight + bannerHeight / 2 + titleLineHeight / 2,
      ]
    : [mediaHeight + bannerHeight / 2, mediaHeight + bannerHeight / 2]
  const [leftTitleY, leftDetailY] = textPositions(value.date)
  const rightTitleY = mediaHeight + bannerHeight / 2

  context.fillStyle = '#202632'
  context.font = `${weight} ${titleSize}px ${family}`
  context.fillText(fitText(context, value.model || 'PICSEAL', leftTextWidth), padding, leftTitleY)
  context.font = `${weight} ${titleSize}px ${family}`
  context.fillText(fitText(context, deviceText, safeRightTextWidth), rightX, rightTitleY)

  context.fillStyle = '#8b95a7'
  context.font = `400 ${detailSize}px ${family}`
  context.fillText(fitText(context, value.date || '', leftTextWidth), padding, leftDetailY)

  if (logo) {
    context.drawImage(
      logo,
      logoRight - logoWidth,
      mediaHeight + (bannerHeight - logoHeight) / 2,
      logoWidth,
      logoHeight,
    )
  }

  context.strokeStyle = '#dde1e8'
  context.lineWidth = dividerWidth
  context.beginPath()
  context.moveTo(dividerX + dividerWidth / 2, mediaHeight + (bannerHeight - logoHeight) / 2)
  context.lineTo(dividerX + dividerWidth / 2, mediaHeight + (bannerHeight + logoHeight) / 2)
  context.stroke()
}

function drawSoftLayout(
  context: CanvasRenderingContext2D,
  photo: BatchPhoto,
  image: HTMLImageElement,
  width: number,
  height: number,
  blurAmount: number,
): void {
  const value = photo.formValue
  const family = fontFamily(value.fontFamily)
  const weight = fontWeight(value.fontWeight)
  const fontScale = value.fontSize === 'large' ? 1.15 : value.fontSize === 'small' ? 0.85 : 1

  drawBlurredBackground(context, image, width, height, blurAmount)
  context.fillStyle = 'rgba(0, 10, 5, 0.48)'
  context.fillRect(0, 0, width, height)

  const pictureX = Math.round(width * SOFT_LAYOUT.pictureX)
  const pictureY = Math.round(height * SOFT_LAYOUT.pictureY)
  const pictureWidth = Math.round(width * SOFT_LAYOUT.pictureWidth)
  const pictureHeight = Math.round(height * SOFT_LAYOUT.pictureHeight)
  const radius = Math.round(Math.min(width, height) * SOFT_LAYOUT.pictureRadius)

  context.save()
  context.fillStyle = '#07120d'
  context.shadowColor = 'rgba(0, 0, 0, 0.34)'
  context.shadowBlur = Math.round(Math.min(width, height) * SOFT_LAYOUT.shadowBlur)
  context.shadowOffsetY = Math.round(Math.min(width, height) * SOFT_LAYOUT.shadowOffsetY)
  roundedRectPath(context, pictureX, pictureY, pictureWidth, pictureHeight, radius)
  context.fill()
  context.restore()

  context.save()
  roundedRectPath(context, pictureX, pictureY, pictureWidth, pictureHeight, radius)
  context.clip()
  context.drawImage(image, pictureX, pictureY, pictureWidth, pictureHeight)
  context.restore()

  const softFonts = softFontRatios(width / height)
  const titleSize = Math.max(24, Math.round(width * softFonts.title * fontScale))
  const detailSize = Math.max(16, Math.round(width * softFonts.detail * fontScale))
  const title = `${value.brand.trim().toUpperCase()} ${value.model.trim()}`.trim()
  const deviceText = formatWatermarkDevice(value.device || '')

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#fff'
  context.font = `${weight} ${titleSize}px ${family}`
  context.fillText(fitText(context, title || 'PICSEAL', width * SOFT_LAYOUT.maxTextWidth), width / 2, height * SOFT_LAYOUT.titleY)

  context.fillStyle = 'rgba(255, 255, 255, 0.66)'
  context.font = `400 ${detailSize}px ${family}`
  context.fillText(fitText(context, deviceText, width * SOFT_LAYOUT.maxTextWidth), width / 2, height * SOFT_LAYOUT.detailY)
}

export async function renderPhotoCanvas(photo: BatchPhoto, style: ExportStyle): Promise<Blob> {
  const image = await loadImage(photo.url)
  const mediaWidth = image.naturalWidth
  const mediaHeight = image.naturalHeight
  const bannerHeight = style.mode === 'classic'
    ? Math.max(82, Math.round(mediaWidth * CLASSIC_LAYOUT.bannerHeight * photo.formValue.scale))
    : 0

  const canvas = document.createElement('canvas')
  canvas.width = mediaWidth
  canvas.height = mediaHeight + bannerHeight
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('Canvas is unavailable')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  if (style.mode === 'soft') {
    drawSoftLayout(context, photo, image, mediaWidth, mediaHeight, style.blurAmount)
  }
  else {
    context.drawImage(image, 0, 0, mediaWidth, mediaHeight)
    await drawWatermark(context, photo, mediaWidth, mediaHeight, bannerHeight)
  }

  const outputType = style.format === 'png' ? 'image/png' : 'image/jpeg'
  return canvasToBlob(canvas, outputType)
}
