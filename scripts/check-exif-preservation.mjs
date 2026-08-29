import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import exifr from 'exifr'
import sharp from 'sharp'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const { embedExifRaw, extractExifRaw } = await server.ssrLoadModule('/src/utils/JpegExifUtils.ts')
  const original = await fs.readFile(new URL('../public/exhibition/sony.jpg', import.meta.url))
  const orientedSource = await sharp(original)
    .withMetadata({ orientation: 8 })
    .jpeg({ quality: 90 })
    .toBuffer()
  const exifRaw = await extractExifRaw(new Blob([orientedSource], { type: 'image/jpeg' }))

  const targetWidth = 900
  const targetHeight = 1400
  const target = await sharp({
    create: {
      background: '#356c8d',
      channels: 3,
      height: targetHeight,
      width: targetWidth,
    },
  }).jpeg({ quality: 95 }).toBuffer()

  const outputBlob = await embedExifRaw(exifRaw, new Blob([target], { type: 'image/jpeg' }))
  const output = Buffer.from(await outputBlob.arrayBuffer())
  const metadata = await exifr.parse(output, {
    exif: true,
    tiff: true,
    translateValues: false,
  })
  const image = await sharp(output).metadata()

  assert.equal(metadata.Make, 'SONY')
  assert.equal(metadata.Model, 'ILCE-7RM3')
  assert.equal(metadata.Orientation, 1)
  assert.equal(metadata.ExifImageWidth, targetWidth)
  assert.equal(metadata.ExifImageHeight, targetHeight)
  assert.equal(image.width, targetWidth)
  assert.equal(image.height, targetHeight)
  assert.equal(image.orientation, 1)
  console.log('EXIF preservation check passed')
}
finally {
  await server.close()
}
