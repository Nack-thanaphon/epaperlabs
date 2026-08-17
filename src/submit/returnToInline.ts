const INLINE_WAIT_MS = 2_500
const INLINE_POLL_MS = 50

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Leave ChatGPT fullscreen without requestClose — that call blanks the iframe on iPad. */
export async function returnToInlineMode() {
  const bridge = window.openai
  if (bridge?.requestDisplayMode) {
    await bridge.requestDisplayMode({ mode: 'inline' })
    const deadline = Date.now() + INLINE_WAIT_MS
    while (Date.now() < deadline) {
      if (bridge.displayMode !== 'fullscreen') return
      await sleep(INLINE_POLL_MS)
    }
    return
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen?.()
  }
}
