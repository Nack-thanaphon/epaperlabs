import { useCallback, useEffect, useState } from 'react'

const EMPTY_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 }

export function useOpenAiHost() {
  const [problem, setProblem] = useState('')
  const [writingReady, setWritingReady] = useState(false)
  const [safeArea, setSafeArea] = useState(EMPTY_SAFE_AREA)

  const requestFullscreen = useCallback(async () => {
    try {
      if (window.openai?.requestDisplayMode) {
        await window.openai.requestDisplayMode({ mode: 'fullscreen' })
        // A resolved request only means the host received it. Enable ink only
        // when the host reports that it really switched to fullscreen.
        setWritingReady(window.openai.displayMode === 'fullscreen')
        return
      }
      await document.documentElement.requestFullscreen?.()
      setWritingReady(Boolean(document.fullscreenElement))
    } catch {
      setWritingReady(false)
    }
  }, [])

  useEffect(() => {
    const syncProblem = () => setProblem(window.openai?.toolInput?.problem?.trim() ?? '')
    const syncWritingMode = () => {
      setWritingReady(
        window.openai
          ? window.openai.displayMode === 'fullscreen'
          : Boolean(document.fullscreenElement)
      )
    }
    const syncSafeArea = () => {
      const area = window.openai?.safeArea
      const insets = area?.insets ?? area
      setSafeArea({
        top: insets?.top ?? 0,
        right: insets?.right ?? 0,
        bottom: insets?.bottom ?? 0,
        left: insets?.left ?? 0,
      })
    }
    const onHostGlobals = () => {
      // ChatGPT can publish tool input, display mode, and safe-area insets after mount.
      syncProblem()
      syncWritingMode()
      syncSafeArea()
    }

    onHostGlobals()
    window.addEventListener('openai:set_globals', onHostGlobals)
    document.addEventListener('fullscreenchange', syncWritingMode)
    return () => {
      window.removeEventListener('openai:set_globals', onHostGlobals)
      document.removeEventListener('fullscreenchange', syncWritingMode)
    }
  }, [])

  return { problem, writingReady, safeArea, requestFullscreen }
}
