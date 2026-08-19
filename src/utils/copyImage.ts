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

function asPngBlob(blob: Blob): Blob {
  return blob.type === 'image/png' ? blob : blob.slice(0, blob.size, 'image/png')
}

export async function encodeCopyBlob(
  canvas: HTMLCanvasElement,
  maxBytes = COPY_MAX_BYTES
): Promise<Blob> {
  let current = canvas

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const blob = await canvasToBlob(current, 'image/png')
    if (blob.size <= maxBytes) return blob
    current = scaleCanvas(current, 0.75)
  }

  const last = await canvasToBlob(current, 'image/png')
  if (last.size <= maxBytes) return last
  throw new Error('Copy image is still over 700KB')
}

async function shareOrDownload(blob: Blob): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], 'paperboard-lasso.png', { type: 'image/png' })
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
  link.download = 'paperboard-lasso.png'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

export async function copyImage(
  makeBlob: () => Blob | Promise<Blob>
): Promise<'copied' | 'shared' | 'downloaded'> {
  const blobPromise = Promise.resolve(makeBlob()).then(asPngBlob)

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobPromise }),
      ])
      return 'copied'
    } catch {
      try {
        const blob = await blobPromise
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
        return 'copied'
      } catch {
        // iPad may still block image clipboard writes; fall through.
      }
    }
  }

  return shareOrDownload(await blobPromise)
}

export async function copyImageBlob(blob: Blob): Promise<'copied' | 'shared' | 'downloaded'> {
  return copyImage(() => blob)
}
