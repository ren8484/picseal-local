export const SOFT_LAYOUT = {
  pictureX: 0.11,
  pictureY: 0.07,
  pictureWidth: 0.78,
  pictureHeight: 0.78,
  pictureRadius: 0.018,
  shadowBlur: 0.025,
  shadowOffsetY: 0.012,
  titleY: 0.9,
  detailY: 0.955,
  titleWidthRatio: 0.04,
  titleHeightRatio: 0.055,
  detailWidthRatio: 0.024,
  detailHeightRatio: 0.033,
  maxTextWidth: 0.86,
} as const

export function softFontRatios(aspectRatio: number): { detail: number, title: number } {
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1
  return {
    title: Math.min(SOFT_LAYOUT.titleWidthRatio, SOFT_LAYOUT.titleHeightRatio / safeAspectRatio),
    detail: Math.min(SOFT_LAYOUT.detailWidthRatio, SOFT_LAYOUT.detailHeightRatio / safeAspectRatio),
  }
}

export function softPreviewVariables(aspectRatio: number): Record<string, string> {
  const fonts = softFontRatios(aspectRatio)
  const shortestSideRatio = Math.min(1, 1 / Math.max(aspectRatio, Number.EPSILON))

  return {
    '--soft-picture-x': `${SOFT_LAYOUT.pictureX * 100}%`,
    '--soft-picture-y': `${SOFT_LAYOUT.pictureY * 100}%`,
    '--soft-picture-width': `${SOFT_LAYOUT.pictureWidth * 100}%`,
    '--soft-picture-height': `${SOFT_LAYOUT.pictureHeight * 100}%`,
    '--soft-picture-radius': `${SOFT_LAYOUT.pictureRadius * shortestSideRatio * 100}cqw`,
    '--soft-shadow-blur': `${SOFT_LAYOUT.shadowBlur * shortestSideRatio * 100}cqw`,
    '--soft-shadow-offset-y': `${SOFT_LAYOUT.shadowOffsetY * shortestSideRatio * 100}cqw`,
    '--soft-title-y': `${SOFT_LAYOUT.titleY * 100}%`,
    '--soft-detail-y': `${SOFT_LAYOUT.detailY * 100}%`,
    '--soft-title-font-size': `${fonts.title * 100}cqw`,
    '--soft-detail-font-size': `${fonts.detail * 100}cqw`,
    '--soft-text-inset': `${(1 - SOFT_LAYOUT.maxTextWidth) * 50}%`,
  }
}
