const SOS = 0xFFDA
const APP1 = 0xFFE1
const EXIF = 0x45786966
const JPEG = 0xFFD8
const ORIENTATION = 0x0112
const IMAGE_WIDTH = 0x0100
const IMAGE_HEIGHT = 0x0101
const EXIF_IFD_POINTER = 0x8769
const EXIF_IMAGE_WIDTH = 0xA002
const EXIF_IMAGE_HEIGHT = 0xA003
const TYPE_SHORT = 3
const TYPE_LONG = 4

const SOF_MARKERS = new Set([
  0xFFC0,
  0xFFC1,
  0xFFC2,
  0xFFC3,
  0xFFC5,
  0xFFC6,
  0xFFC7,
  0xFFC9,
  0xFFCA,
  0xFFCB,
  0xFFCD,
  0xFFCE,
  0xFFCF,
])

interface JpegDimensions {
  height: number
  width: number
}

function isExifSegment(view: DataView, offset: number): boolean {
  return offset + 10 <= view.byteLength
    && view.getUint16(offset) === APP1
    && view.getUint32(offset + 4) === EXIF
    && view.getUint16(offset + 8) === 0
}

function segmentSize(view: DataView, offset: number): number {
  if (offset + 4 > view.byteLength)
    throw new Error('Invalid JPEG segment')
  const size = view.getUint16(offset + 2)
  if (size < 2 || offset + 2 + size > view.byteLength)
    throw new Error('Invalid JPEG segment size')
  return 2 + size
}

export async function extractExifRaw(raw: Blob): Promise<Blob> {
  const buffer = await raw.arrayBuffer()
  const view = new DataView(buffer)
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG)
    throw new Error('not a valid jpeg')

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    if (marker === SOS)
      break
    const size = segmentSize(view, offset)
    if (isExifSegment(view, offset))
      return raw.slice(offset, offset + size)
    offset += size
  }
  return new Blob()
}

function readJpegDimensions(bytes: Uint8Array): JpegDimensions {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG)
    throw new Error('not a valid jpeg')

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    if (marker === SOS)
      break
    const size = segmentSize(view, offset)
    if (SOF_MARKERS.has(marker)) {
      if (offset + 9 > view.byteLength)
        throw new Error('Invalid JPEG dimensions')
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      }
    }
    offset += size
  }
  throw new Error('JPEG dimensions not found')
}

function writeEntryNumber(
  view: DataView,
  entryOffset: number,
  value: number,
  littleEndian: boolean,
): void {
  const type = view.getUint16(entryOffset + 2, littleEndian)
  const count = view.getUint32(entryOffset + 4, littleEndian)
  if (count !== 1)
    return
  if (type === TYPE_SHORT)
    view.setUint16(entryOffset + 8, Math.min(0xFFFF, value), littleEndian)
  else if (type === TYPE_LONG)
    view.setUint32(entryOffset + 8, value, littleEndian)
}

function visitIfd(
  view: DataView,
  tiffOffset: number,
  relativeOffset: number,
  littleEndian: boolean,
  visitor: (tag: number, entryOffset: number) => void,
): void {
  const ifdOffset = tiffOffset + relativeOffset
  if (relativeOffset <= 0 || ifdOffset + 2 > view.byteLength)
    return
  const entryCount = view.getUint16(ifdOffset, littleEndian)
  const entriesEnd = ifdOffset + 2 + entryCount * 12
  if (entriesEnd > view.byteLength)
    return

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12
    visitor(view.getUint16(entryOffset, littleEndian), entryOffset)
  }
}

function normalizeExifSegment(
  exifBytes: Uint8Array,
  dimensions: JpegDimensions,
): Uint8Array {
  const normalized = exifBytes.slice()
  const view = new DataView(normalized.buffer, normalized.byteOffset, normalized.byteLength)
  if (!isExifSegment(view, 0) || view.byteLength < 18)
    return normalized

  const tiffOffset = 10
  const byteOrder = view.getUint16(tiffOffset)
  if (byteOrder !== 0x4949 && byteOrder !== 0x4D4D)
    return normalized
  const littleEndian = byteOrder === 0x4949
  if (view.getUint16(tiffOffset + 2, littleEndian) !== 42)
    return normalized

  const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian)
  let exifIfdOffset = 0
  visitIfd(view, tiffOffset, firstIfdOffset, littleEndian, (tag, entryOffset) => {
    if (tag === ORIENTATION)
      writeEntryNumber(view, entryOffset, 1, littleEndian)
    else if (tag === IMAGE_WIDTH)
      writeEntryNumber(view, entryOffset, dimensions.width, littleEndian)
    else if (tag === IMAGE_HEIGHT)
      writeEntryNumber(view, entryOffset, dimensions.height, littleEndian)
    else if (tag === EXIF_IFD_POINTER)
      exifIfdOffset = view.getUint32(entryOffset + 8, littleEndian)
  })

  visitIfd(view, tiffOffset, exifIfdOffset, littleEndian, (tag, entryOffset) => {
    if (tag === EXIF_IMAGE_WIDTH)
      writeEntryNumber(view, entryOffset, dimensions.width, littleEndian)
    else if (tag === EXIF_IMAGE_HEIGHT)
      writeEntryNumber(view, entryOffset, dimensions.height, littleEndian)
  })
  return normalized
}

function stripExifSegments(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG)
    throw new Error('not a valid jpeg')

  const chunks: Uint8Array[] = [bytes.slice(0, 2)]
  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    if (marker === SOS) {
      chunks.push(bytes.slice(offset))
      break
    }
    const size = segmentSize(view, offset)
    if (!isExifSegment(view, offset))
      chunks.push(bytes.slice(offset, offset + size))
    offset += size
  }

  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const result = new Uint8Array(length)
  let writeOffset = 0
  for (const chunk of chunks) {
    result.set(chunk, writeOffset)
    writeOffset += chunk.byteLength
  }
  return result
}

export async function embedExifRaw(exifRaw: Blob, targetImg: Blob): Promise<Blob> {
  if (!exifRaw.size)
    return targetImg

  const [exifBuffer, targetBuffer] = await Promise.all([
    exifRaw.arrayBuffer(),
    targetImg.arrayBuffer(),
  ])
  const targetBytes = new Uint8Array(targetBuffer)
  const dimensions = readJpegDimensions(targetBytes)
  const exifBytes = normalizeExifSegment(new Uint8Array(exifBuffer), dimensions)
  const cleanTarget = stripExifSegments(targetBytes)

  return new Blob([
    cleanTarget.slice(0, 2),
    exifBytes,
    cleanTarget.slice(2),
  ], { type: 'image/jpeg' })
}
