import { useCallback, useEffect, useState } from 'react'

export function useOpenAiHost() {
  const [problem, setProblem] = useState('')
  const [writingReady, setWritingReady] = useState(false)

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
    // ChatGPT can inject its bridge after the React app mounts.
    const syncProblem = () => setProblem(window.openai?.toolInput?.problem?.trim() ?? '')
    syncProblem()
  }, [requestFullscreen])

  useEffect(() => {
    const syncProblem = () => setProblem(window.openai?.toolInput?.problem?.trim() ?? '')
    const syncWritingMode = () => {
      setWritingReady(
        window.openai
          ? window.openai.displayMode === 'fullscreen'
          : Boolean(document.fullscreenElement)
      )
    }
    const onHostGlobals = () => {
      // The host can publish tool input after the widget has mounted.
      // Keep the problem and fullscreen gate in sync from the same update.
      syncProblem()
      syncWritingMode()
    }
    onHostGlobals()
    window.addEventListener('openai:set_globals', onHostGlobals)
    document.addEventListener('fullscreenchange', syncWritingMode)
    return () => {
      window.removeEventListener('openai:set_globals', onHostGlobals)
      document.removeEventListener('fullscreenchange', syncWritingMode)
    }
  }, [])

  return { problem, writingReady, requestFullscreen }
}
