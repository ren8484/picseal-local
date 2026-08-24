import type { ChangeEvent, CSSProperties } from 'react'
import type { ExifParamsForm } from './types'
import {
  CloseOutlined,
  CloudDownloadOutlined,
  DownloadOutlined,
  InboxOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  Progress,
  Segmented,
  Select,
  Slider,
  Switch,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useImageHandlers } from './hooks/useImageHandlers'
import { BrandsList } from './utils/BrandUtils'
import { classicPreviewVariables, formatWatermarkDevice } from './utils/ClassicLayout'
import { DefaultPictureExif } from './utils/ImageUtils'
import { softPreviewVariables } from './utils/SoftLayout'
import './styles/App.css'

const exampleBrands = ['apple', 'canon', 'dji', 'fujifilm', 'huawei', 'leica', 'xiaomi', 'nikon', 'sony']
const classicLayoutStyle = classicPreviewVariables()

function App() {
  const [form] = Form.useForm<ExifParamsForm>()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [exifEnable, setExifEnable] = useState(false)
  const [watermarkMode, setWatermarkMode] = useState<'classic' | 'soft'>('classic')
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>('jpeg')
  const [blurAmount, setBlurAmount] = useState(40)
  const [previewAspectRatio, setPreviewAspectRatio] = useState(1)
  const {
    currentId,
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
  } = useImageHandlers(form, DefaultPictureExif)

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files
    if (files)
      void handleAddFiles(files)
    event.target.value = ''
  }

  const updatePreviewAspectRatio = (image: HTMLImageElement): void => {
    if (image.naturalWidth > 0 && image.naturalHeight > 0)
      setPreviewAspectRatio(image.naturalWidth / image.naturalHeight)
  }

  useEffect(() => {
    if (watermarkMode === 'soft' && imgRef.current?.complete)
      updatePreviewAspectRatio(imgRef.current)
  }, [imgRef, imgUrl, watermarkMode])

  const exportStyle = {
    mode: watermarkMode,
    blurAmount,
    format: exportFormat,
  } as const
  const previewLayoutStyle = {
    ...classicLayoutStyle,
    ...softPreviewVariables(previewAspectRatio),
  } as CSSProperties

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <Typography.Text className="eyebrow">LOCAL PHOTO STUDIO</Typography.Text>
          <Typography.Title level={2}>PICSEAL 批量水印</Typography.Title>
          <Typography.Text type="secondary">所有照片只在当前浏览器中处理，不会上传到服务器。</Typography.Text>
        </div>
        <div className="header-actions">
          <input
            ref={uploadInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={onFilesSelected}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => uploadInputRef.current?.click()}>
            批量添加照片
          </Button>
          <Button
            icon={<DownloadOutlined />}
            disabled={!currentId}
            onClick={() => void handleDownload(exifEnable, exportStyle)}
          >
            导出当前 · 全尺寸
          </Button>
          <Button
            icon={<CloudDownloadOutlined />}
            disabled={!photos.length || exportProgress !== null}
            onClick={() => void handleDownloadAll(exifEnable, exportStyle)}
          >
            {exportProgress === null ? `全部打包${photos.length ? ` (${photos.length})` : ''}` : `处理中 ${exportProgress}%`}
          </Button>
        </div>
      </header>

      {exportProgress !== null && <Progress percent={exportProgress} showInfo={false} strokeColor="#2f6fed" />}

      <section className="editor-layout">
        <aside className="batch-panel panel-card">
          <div className="panel-heading">
            <div>
              <Typography.Title level={5}>照片队列</Typography.Title>
              <Typography.Text type="secondary">
                {photos.length}
                {' '}
                张照片
              </Typography.Text>
            </div>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => uploadInputRef.current?.click()} />
          </div>

          {photos.length === 0
            ? (
                <button className="empty-queue" type="button" onClick={() => uploadInputRef.current?.click()}>
                  <InboxOutlined />
                  <span>一次选择多张照片</span>
                  <small>JPG、PNG、WebP</small>
                </button>
              )
            : (
                <div className="photo-list">
                  {photos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className={`photo-item ${photo.id === currentId ? 'active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => showPhoto(photo)}
                      onKeyDown={event => event.key === 'Enter' && showPhoto(photo)}
                    >
                      <img src={photo.url} alt="" />
                      <div className="photo-item-copy">
                        <strong>{String(index + 1).padStart(2, '0')}</strong>
                        <span title={photo.name}>{photo.name}</span>
                      </div>
                      <button
                        className="remove-photo"
                        type="button"
                        aria-label={`移除 ${photo.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRemovePhoto(photo.id)
                        }}
                      >
                        <CloseOutlined />
                      </button>
                    </div>
                  ))}
                </div>
              )}

          <div className="example-section">
            <Typography.Text type="secondary">示例照片</Typography.Text>
            <div className="example-grid">
              {exampleBrands.map(brand => (
                <button key={brand} type="button" onClick={() => void handleExhibitionClick(brand)}>
                  {brand}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="canvas-column">
          <div className="canvas-title-row">
            <div>
              <Typography.Title level={5}>实时预览</Typography.Title>
              <Typography.Text type="secondary">导出结果与此处布局一致</Typography.Text>
            </div>
            <span className="mode-badge">
              {watermarkMode === 'classic' ? '经典 · 白底' : `柔化 · ${blurAmount}px`}
            </span>
          </div>

          <div className="preview" id="preview" style={previewLayoutStyle}>
            {watermarkMode === 'soft'
              ? (
                  <div className="soft-preview-stage">
                    <img
                      className="soft-preview-background"
                      src={imgUrl}
                      alt=""
                      aria-hidden="true"
                      style={{ filter: `blur(${blurAmount}px)` }}
                      onLoad={event => updatePreviewAspectRatio(event.currentTarget)}
                    />
                    <div className="soft-preview-shade" />
                    <img
                      ref={imgRef}
                      className="soft-preview-picture"
                      src={imgUrl}
                      alt="照片预览"
                      onLoad={event => updatePreviewAspectRatio(event.currentTarget)}
                    />
                    <div className="soft-preview-info">
                      <div className="soft-preview-title">
                        {formValue.brand.toUpperCase()}
                        {' '}
                        {formValue.model}
                      </div>
                      <div className="soft-preview-device">{formatWatermarkDevice(formValue.device)}</div>
                    </div>
                  </div>
                )
              : (
                  <>
                    <div className="preview-media">
                      <img ref={imgRef} className="preview-picture" src={imgUrl} alt="照片预览" />
                    </div>
                    <div className="preview-info">
                      <div className="preview-info-left">
                        <div className="preview-info-model">{formValue.model}</div>
                        <div className="preview-info-date">{formValue.date}</div>
                        <div className="preview-info-brand">
                          <img src={formValue.brand_url} alt={formValue.brand} />
                        </div>
                      </div>
                      <div className="preview-info-split" />
                      <div className="preview-info-right">
                        <div className="preview-info-device">{formatWatermarkDevice(formValue.device)}</div>
                      </div>
                    </div>
                  </>
                )}
          </div>
        </section>

        <aside className="inspector panel-card">
          <div className="panel-heading">
            <div>
              <Typography.Title level={5}>样式与参数</Typography.Title>
              <Typography.Text type="secondary">当前照片</Typography.Text>
            </div>
          </div>

          <div className="mode-control">
            <div>
              <strong>质感</strong>
              <span>经典为白底横幅，柔化为暗色模糊画布</span>
            </div>
            <Segmented
              block
              value={watermarkMode}
              options={[
                { label: '经典', value: 'classic' },
                { label: '柔化', value: 'soft' },
              ]}
              onChange={value => setWatermarkMode(value as 'classic' | 'soft')}
            />
          </div>
          <div className={`blur-slider ${watermarkMode === 'soft' ? '' : 'disabled'}`}>
            <Typography.Text type="secondary">模糊强度</Typography.Text>
            <Slider min={4} max={40} value={blurAmount} disabled={watermarkMode !== 'soft'} onChange={setBlurAmount} />
          </div>
          <div className="export-format-control">
            <div>
              <strong>导出格式</strong>
              <span>{exportFormat === 'jpeg' ? '原始像素尺寸，JPEG 最高质量' : 'PNG 真无损，文件会明显增大'}</span>
            </div>
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: 'jpeg', label: '全尺寸 JPEG · 最高质量' },
                { value: 'png', label: '全尺寸 PNG · 无损' },
              ]}
            />
          </div>
          <div className="feature-control compact">
            <div>
              <strong>保留 EXIF</strong>
              <span>{exportFormat === 'jpeg' ? '实验性，仅 JPEG' : 'PNG 不支持写回 EXIF'}</span>
            </div>
            <Switch checked={exifEnable && exportFormat === 'jpeg'} disabled={exportFormat === 'png'} onChange={setExifEnable} />
          </div>

          <Form
            form={form}
            layout="vertical"
            size="small"
            initialValues={formValue}
            onValuesChange={handleFormChange}
          >
            <Form.Item label="横幅大小" name="scale">
              <Slider min={0.5} max={1.2} step={0.1} onChange={handleScaleChange} />
            </Form.Item>
            <Form.Item label="相机型号" name="model"><Input /></Form.Item>
            <Form.Item label="相机品牌" name="brand">
              <Select options={BrandsList.map(brand => ({ label: brand, value: brand.toLowerCase() }))} />
            </Form.Item>
            <Form.Item label="拍摄参数" name="device"><Input /></Form.Item>
            <Form.Item label="拍摄时间" name="date"><Input /></Form.Item>
            <Form.Item label="字体大小" name="fontSize">
              <Select
                onChange={handleFontSizeChange}
                options={[
                  { value: 'small', label: '小' },
                  { value: 'normal', label: '正常' },
                  { value: 'large', label: '大' },
                ]}
              />
            </Form.Item>
            <Form.Item label="字体粗细" name="fontWeight">
              <Select
                onChange={handleFontWeightChange}
                options={[
                  { value: 'normal', label: '正常' },
                  { value: 'bold', label: '加粗' },
                  { value: 'black', label: '黑体' },
                ]}
              />
            </Form.Item>
            <Form.Item label="字体" name="fontFamily">
              <Select
                onChange={handleFontFamilyChange}
                options={[
                  { value: 'default', label: 'Default' },
                  { value: 'misans', label: 'MiSans' },
                  { value: 'caveat', label: 'Caveat' },
                  { value: 'helvetica', label: 'Helvetica Neue' },
                  { value: 'futura', label: 'Futura' },
                  { value: 'avenir', label: 'Avenir' },
                  { value: 'didot', label: 'Didot' },
                ]}
              />
            </Form.Item>
          </Form>
        </aside>
      </section>
    </main>
  )
}

export default App
