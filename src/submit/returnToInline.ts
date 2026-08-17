const INLINE_WAIT_MS = 800

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Leave ChatGPT fullscreen without requestClose — that call blanks the iframe on iPad. */
export async function returnToInlineMode() {
  const bridge = window.openai
  if (bridge?.requestDisplayMode) {
    await Promise.race([
      bridge.requestDisplayMode({ mode: 'inline' }),
      sleep(INLINE_WAIT_MS),
    ])
    return
  }
  if (document.fullscreenElement) {
    await Promise.race([
      document.exitFullscreen?.() ?? Promise.resolve(),
      sleep(INLINE_WAIT_MS),
    ])
  }
}
