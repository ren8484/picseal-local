import type { ExifParamsForm } from '../types'
import exifr from 'exifr'
import moment from 'moment'
import { getBrandUrl } from './BrandUtils'

type ExifRecord = Record<string, unknown>

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function normalizeBrand(make: string): string {
  const normalized = make.toLowerCase()
  const brands: Array<[string, string]> = [
    ['apple', 'apple'],
    ['canon', 'canon'],
    ['dji', 'dji'],
    ['fujifilm', 'fujifilm'],
    ['huawei', 'huawei'],
    ['leica', 'leica'],
    ['xiaomi', 'xiaomi'],
    ['nikon', 'nikon corporation'],
    ['sony', 'sony'],
    ['panasonic', 'panasonic'],
    ['ricoh', 'ricoh'],
    ['olympus', 'olympus'],
    ['arashi vision', 'arashi vision'],
    ['insta360', 'arashi vision'],
  ]
  return brands.find(([needle]) => normalized.includes(needle))?.[1] ?? '未收录'
}

export function formatOfficialModel(value: unknown, brand: string): string {
  const model = asText(value).replace(/[",]/g, '').trim().replace(/\s+/g, ' ')
  if (brand !== 'sony')
    return model

  if (/^ILCE-/i.test(model))
    return model.replace(/^ILCE-/i, 'ILCE-').toUpperCase()

  const alphaModel = model.match(/^(?:α|a)(\d[a-z\d-]*)$/i)
  return alphaModel ? `ILCE-${alphaModel[1].toUpperCase()}` : model
}

function formatExposure(value: unknown): string {
  if (typeof value !== 'number' || value <= 0)
    return asText(value)
  if (value < 1)
    return `1/${Math.round(1 / value)}`
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatDate(value: unknown): string {
  if (value instanceof Date)
    return moment(value).format('YYYY-MM-DD HH:mm')
  const text = asText(value)
  return text ? moment(text).format('YYYY-MM-DD HH:mm') : ''
}

export async function readPhotoExif(file: Blob): Promise<Partial<ExifParamsForm>> {
  const data = await exifr.parse(file, {
    exif: true,
    gps: false,
    ifd0: true,
    translateKeys: true,
    translateValues: true,
  }) as ExifRecord | undefined

  if (!data)
    return {}

  const make = asText(data.Make)
  const brand = normalizeBrand(make)
  const model = formatOfficialModel(data.Model, brand)
  const focalLength = asText(data.FocalLength)
  const aperture = asText(data.FNumber)
  const exposure = formatExposure(data.ExposureTime)
  const iso = asText(data.ISO ?? data.PhotographicSensitivity)

  return {
    model: model || 'PICSEAL',
    date: formatDate(data.DateTimeOriginal ?? data.CreateDate),
    device: [
      focalLength ? `${focalLength.replace(/\s+/g, '')}mm` : '',
      aperture ? `f/${aperture}` : '',
      exposure ? `${exposure}s` : '',
      iso ? `ISO${iso}` : '',
    ].filter(Boolean).join(' '),
    brand,
    brand_url: getBrandUrl(brand),
  }
}
