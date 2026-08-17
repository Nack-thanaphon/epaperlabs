export function hostLabel(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  if (/CriOS/i.test(userAgent) || (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent))) {
    return 'Chrome'
  }
  if (/FxiOS|Firefox\//i.test(userAgent)) return 'Firefox'
  if (/ChatGPT/i.test(userAgent)) return 'แอป ChatGPT'
  return 'Safari/แอป'
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `ประมวลผล ${seconds}s`
}
