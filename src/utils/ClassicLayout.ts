export const CLASSIC_LAYOUT = {
  bannerHeight: 0.082,
  horizontalPadding: 0.02,
  titleFontSize: 0.018,
  detailFontSize: 0.012,
  dividerHeight: 0.039,
  dividerWidth: 0.002,
  groupGap: 0.014,
  brandPaddingLeft: 0.012,
} as const

export function formatWatermarkDevice(value: string): string {
  return value.trim().split(/\s+/).join('\u00A0\u00A0')
}

export function classicPreviewVariables(): Record<string, string> {
  return {
    '--classic-banner-height': `${CLASSIC_LAYOUT.bannerHeight * 100}cqw`,
    '--classic-horizontal-padding': `${CLASSIC_LAYOUT.horizontalPadding * 100}cqw`,
    '--classic-title-font-size': `${CLASSIC_LAYOUT.titleFontSize * 100}cqw`,
    '--classic-detail-font-size': `${CLASSIC_LAYOUT.detailFontSize * 100}cqw`,
    '--classic-divider-height': `${CLASSIC_LAYOUT.dividerHeight * 100}cqw`,
    '--classic-divider-width': `${CLASSIC_LAYOUT.dividerWidth * 100}cqw`,
    '--classic-group-gap': `${CLASSIC_LAYOUT.groupGap * 100}cqw`,
    '--classic-brand-padding-left': `${CLASSIC_LAYOUT.brandPaddingLeft * 100}cqw`,
  }
}
