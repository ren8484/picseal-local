import type { FormInstance } from 'antd'
import type { BatchPhoto, ExifParamsForm } from '../types'
import type { ExportStyle } from '../utils/CanvasRenderer'
import { message } from 'antd'
import JSZip from 'jszip'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getBrandUrl } from '../utils/BrandUtils'
import { renderPhotoCanvas } from '../utils/CanvasRenderer'
import { readPhotoExif } from '../utils/ExifUtils'
import { getRandomImage } from '../utils/ImageUtils'
import { embedExifRaw, extractExifRaw } from '../utils/JpegExifUtils'

type FontPreferences = Pick<ExifParamsForm, 'fontSize' | 'fontWeight' | 'fontFamily'>

const FONT_PREFERENCES_KEY = 'picseal-font-preferences-v1'
const FONT_SIZE_VALUES = new Set(['small', 'normal', 'large'])
const FONT_WEIGHT_VALUES = new Set(['normal', 'bold', 'black'])
const FONT_FAMILY_VALUES = new Set(['default', 'misans', 'caveat', 'helvetica', 'futura', 'avenir', 'didot'])

const FONT_SIZE_MAP: Record<string, string> = {
  small: 'var(--font-size-small)',
  normal: 'var(--font-size-normal)',
  large: 'var(--font-size-large)',
}

const FONT_WEIGHT_MAP: Record<string, string> = {
  normal: 'var(--font-weight-normal)',
  bold: 'var(--font-weight-bold)',
  black: 'var(--font-weight-black)',
}

const FONT_FAMILY_MAP: Record<string, string> = {
  default: 'var(--font-family-default)',
  caveat: 'var(--font-family-caveat)',
  misans: 'var(--font-family-misans)',
  helvetica: 'var(--font-family-helvetica)',
  futura: 'var(--font-family-futura)',
  avenir: 'var(--font-family-avenir)',
  didot: 'var(--font-family-didot)',
}

function readFontPreferences(): Partial<FontPreferences> {
  try {
    const raw = window.localStorage.getItem(FONT_PREFERENCES_KEY)
    if (!raw)
      return {}
    const stored = JSON.parse(raw) as Partial<FontPreferences>
    return {
      ...(stored.fontSize && FONT_SIZE_VALUES.has(stored.fontSize) ? { fontSize: stored.fontSize } : {}),
      ...(stored.fontWeight && FONT_WEIGHT_VALUES.has(stored.fontWeight) ? { fontWeight: stored.fontWeight } : {}),
      ...(stored.fontFamily && FONT_FAMILY_VALUES.has(stored.fontFamily) ? { fontFamily: stored.fontFamily } : {}),
    }
  }
  catch {
    return {}
  }
}

function writeFontPreferences(preferences: FontPreferences): void {
  try {
    window.localStorage.setItem(FONT_PREFERENCES_KEY, JSON.stringify(preferences))
  }
  catch {
    // The editor still works when browser storage is unavailable.
  }
}

function applyFontPreferences(preferences: FontPreferences): void {
  document.documentElement.style.setProperty('--current-font-size', FONT_SIZE_MAP[preferences.fontSize] ?? FONT_SIZE_MAP.normal)
  document.documentElement.style.setProperty('--current-font-weight', FONT_WEIGHT_MAP[preferences.fontWeight] ?? FONT_WEIGHT_MAP.bold)
  document.documentElement.style.setProperty('--current-font-family', FONT_FAMILY_MAP[preferences.fontFamily] ?? FONT_FAMILY_MAP.default)
}

function safeBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'photo'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function momentStamp(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
}

function createPhotoId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return `${Date.now()}-${globalThis.crypto.randomUUID()}`

  const randomPart = Math.random().toString(36).slice(2)
  return `${Date.now()}-${randomPart}`
}

export function useImageHandlers(form: FormInstance<ExifParamsForm>, initialFormValue: ExifParamsForm) {
  const [preferenceDefaults] = useState<ExifParamsForm>(() => ({
    ...initialFormValue,
    ...readFontPreferences(),
  }))
  const fontPreferencesRef = useRef<FontPreferences>({
    fontSize: preferenceDefaults.fontSize,
    fontWeight: preferenceDefaults.fontWeight,
    fontFamily: preferenceDefaults.fontFamily,
  })
  const [formValue, setFormValue] = useState<ExifParamsForm>(preferenceDefaults)
  const [imgUrl, setImgUrl] = useState<string>(getRandomImage())
  const [photos, setPhotos] = useState<BatchPhoto[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    applyFontPreferences(fontPreferencesRef.current)
  }, [])

  const currentPhoto = useMemo(
    () => photos.find(photo => photo.id === currentId) ?? null,
    [currentId, photos],
  )

  const showPhoto = (photo: BatchPhoto): void => {
    setCurrentId(photo.id)
    setImgUrl(photo.url)
    setFormValue(photo.formValue)
    form.setFieldsValue(photo.formValue)
  }

  const createPhoto = async (file: File): Promise<BatchPhoto> => {
    let parsedExif: Partial<ExifParamsForm> = {}
    try {
      parsedExif = await readPhotoExif(file)
    }
    catch (error) {
      console.warn(`EXIF parse failed for ${file.name}:`, error)
    }

    let exifBlob: Blob | null = null
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      try {
        exifBlob = await extractExifRaw(file)
      }
      catch (error) {
        console.warn(`Raw EXIF extraction failed for ${file.name}:`, error)
      }
    }

    const nextFormValue: ExifParamsForm = {
      ...initialFormValue,
      ...fontPreferencesRef.current,
      ...parsedExif,
      brand_url: getBrandUrl(parsedExif.brand ?? initialFormValue.brand),
    }

    return {
      id: createPhotoId(),
      file,
      name: file.name,
      type: file.type || 'image/jpeg',
      url: URL.createObjectURL(file),
      exifBlob,
      formValue: nextFormValue,
    }
  }

  const handleAddFiles = async (fileList: FileList | File[]): Promise<void> => {
    const files = Array.from(fileList).filter(file => file.type.startsWith('image/'))
    if (!files.length) {
      message.warning('请选择图片文件')
      return
    }

    const key = 'picseal-import'
    message.loading({ content: `正在读取 ${files.length} 张照片…`, key, duration: 0 })
    try {
      const addedPhotos = await Promise.all(files.map(createPhoto))
      setPhotos(previous => [...previous, ...addedPhotos])
      showPhoto(addedPhotos[0])
      message.success({ content: `已加入 ${addedPhotos.length} 张照片`, key })
    }
    catch (error) {
      console.error('Import failed:', error)
      message.error({ content: '导入失败，请检查图片格式', key })
    }
  }

  const handleRemovePhoto = (id: string): void => {
    const removedIndex = photos.findIndex(photo => photo.id === id)
    const removed = photos[removedIndex]
    if (!removed)
      return

    URL.revokeObjectURL(removed.url)
    const remaining = photos.filter(photo => photo.id !== id)
    setPhotos(remaining)
    if (currentId === id) {
      const replacement = remaining[Math.min(removedIndex, remaining.length - 1)]
      if (replacement)
        showPhoto(replacement)
      else
        setCurrentId(null)
    }
  }

  const renderPhoto = async (photo: BatchPhoto, exifEnable: boolean, style: ExportStyle): Promise<Blob> => {
    const rendered = await renderPhotoCanvas(photo, style)
    if (style.format === 'jpeg' && exifEnable && photo.exifBlob && (photo.type === 'image/jpeg' || photo.type === 'image/jpg'))
      return embedExifRaw(photo.exifBlob, rendered)
    return rendered
  }

  const handleDownload = async (exifEnable: boolean, style: ExportStyle): Promise<void> => {
    if (!currentPhoto) {
      message.warning('请先上传一张照片')
      return
    }

    const key = 'picseal-export'
    message.loading({ content: '正在生成照片…', key, duration: 0 })
    try {
      const blob = await renderPhoto(currentPhoto, exifEnable, style)
      const extension = style.format === 'png' ? 'png' : 'jpg'
      downloadBlob(blob, `${safeBaseName(currentPhoto.name)}_picseal.${extension}`)
      message.success({ content: style.format === 'png' ? '无损 PNG 已导出' : '全尺寸 JPEG 已导出', key })
    }
    catch (error) {
      console.error('Download error:', error)
      message.error({ content: '导出失败，请重试', key })
    }
  }

  const handleDownloadAll = async (exifEnable: boolean, style: ExportStyle): Promise<void> => {
    if (!photos.length) {
      message.warning('请先上传照片')
      return
    }

    const zip = new JSZip()
    setExportProgress(0)
    try {
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index]
        const blob = await renderPhoto(photo, exifEnable, style)
        const extension = style.format === 'png' ? 'png' : 'jpg'
        zip.file(`${String(index + 1).padStart(2, '0')}_${safeBaseName(photo.name)}_picseal.${extension}`, blob)
        setExportProgress(Math.round(((index + 1) / photos.length) * 100))
      }

      const archive = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
      downloadBlob(archive, `picseal_${momentStamp()}.zip`)
      message.success(`已打包 ${photos.length} 张照片`)
    }
    catch (error) {
      console.error('Batch export error:', error)
      message.error('批量导出失败，请重试')
    }
    finally {
      setExportProgress(null)
    }
  }

  const handleFormChange = (_: Partial<ExifParamsForm>, values: ExifParamsForm): void => {
    const updated = { ...values, brand_url: getBrandUrl(values.brand) }
    setFormValue(updated)
    if (currentId) {
      setPhotos(previous => previous.map(photo => (
        photo.id === currentId ? { ...photo, formValue: updated } : photo
      )))
    }
  }

  const handleScaleChange = (scale: number): void => {
    document.documentElement.style.setProperty('--banner-scale', String(scale))
  }

  const handleFontSizeChange = (fontSize: string): void => {
    const next = { ...fontPreferencesRef.current, fontSize }
    fontPreferencesRef.current = next
    applyFontPreferences(next)
    writeFontPreferences(next)
  }

  const handleFontWeightChange = (fontWeight: string): void => {
    const next = { ...fontPreferencesRef.current, fontWeight }
    fontPreferencesRef.current = next
    applyFontPreferences(next)
    writeFontPreferences(next)
  }

  const handleFontFamilyChange = (fontFamily: string): void => {
    const next = { ...fontPreferencesRef.current, fontFamily }
    fontPreferencesRef.current = next
    applyFontPreferences(next)
    writeFontPreferences(next)
  }

  const handleExhibitionClick = async (brand: string): Promise<void> => {
    const imageUrl = `./exhibition/${brand.toLowerCase()}.jpg`
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const parsedExif = await readPhotoExif(blob)
      const updated = {
        ...initialFormValue,
        ...fontPreferencesRef.current,
        ...parsedExif,
        brand_url: getBrandUrl(parsedExif.brand ?? initialFormValue.brand),
      }
      setCurrentId(null)
      setImgUrl(imageUrl)
      setFormValue(updated)
      form.setFieldsValue(updated)
    }
    catch (error) {
      console.error('Example image failed:', error)
      message.error('示例图片加载失败')
    }
  }

  return {
    currentId,
    currentPhoto,
    exportProgress,
    formValue,
    handleAddFiles,
    handleDownload,
    handleDownloadAll,
    handleExhibitionClick,
    handleFontFamilyChange,
    handleFontSizeChange,
    handleFontWeightChange,
    handleFormChange,
    handleRemovePhoto,
    handleScaleChange,
    imgRef,
    imgUrl,
    photos,
    showPhoto,
  }
}
