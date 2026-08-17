import { COPY_MAX_BYTES } from '../constants'

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Image encode failed')),
      type,
      quality
    )
  })
}

function scaleCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const next = document.createElement('canvas')
  next.width = Math.max(1, Math.round(source.width * scale))
  next.height = Math.max(1, Math.round(source.height * scale))
  const ctx = next.getContext('2d')
  if (!ctx) throw new Error('No canvas context')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, next.width, next.height)
  ctx.drawImage(source, 0, 0, next.width, next.height)
  return next
}

export async function encodeCopyBlob(
  canvas: HTMLCanvasElement,
  maxBytes = COPY_MAX_BYTES
): Promise<Blob> {
  let current = canvas
  let quality = 0.82

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const blob = await canvasToBlob(current, 'image/jpeg', quality)
    if (blob.size <= maxBytes) return blob
    if (quality > 0.55) {
      quality = Math.max(0.55, quality - 0.12)
      continue
    }
    current = scaleCanvas(current, 0.75)
    quality = 0.78
  }

  const last = await canvasToBlob(current, 'image/jpeg', 0.5)
  if (last.size <= maxBytes) return last
  throw new Error('Copy image is still over 700KB')
}

export async function copyImageBlob(blob: Blob): Promise<'copied' | 'shared' | 'downloaded'> {
  const type = blob.type || 'image/jpeg'
  const extension = type === 'image/png' ? 'png' : 'jpg'

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
      return 'copied'
    } catch {
      // iPad Chrome often blocks image clipboard writes.
    }
  }

  const file = new File([blob], `papa-lasso.${extension}`, { type })
  const canShareFiles = typeof navigator.canShare === 'function'
    ? navigator.canShare({ files: [file] })
    : Boolean(navigator.share)
  if (navigator.share && canShareFiles) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `papa-lasso.${extension}`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
