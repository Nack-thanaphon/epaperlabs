export async function copyPngBlob(blob: Blob): Promise<'copied' | 'shared' | 'downloaded'> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'copied'
    } catch {
      // iPad Chrome often blocks image clipboard writes inside an iframe.
    }
  }

  const file = new File([blob], 'papa-lasso.png', { type: 'image/png' })
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
  link.download = 'papa-lasso.png'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
