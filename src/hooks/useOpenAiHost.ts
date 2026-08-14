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
    // ChatGPT can inject its bridge after the React app mounts. Retry briefly so
    // iPad starts in a useful writing area instead of a collapsed inline card.
    const syncProblem = () => setProblem(window.openai?.toolInput?.problem?.trim() ?? '')
    syncProblem()
    void requestFullscreen()
    const retries = [350, 1200].map((delay) => window.setTimeout(() => {
      syncProblem()
      void requestFullscreen()
    }, delay))
    return () => retries.forEach(window.clearTimeout)
  }, [requestFullscreen])

  useEffect(() => {
    const syncWritingMode = () => {
      setWritingReady(
        window.openai
          ? window.openai.displayMode === 'fullscreen'
          : Boolean(document.fullscreenElement)
      )
    }
    const onHostGlobals = () => syncWritingMode()
    syncWritingMode()
    window.addEventListener('openai:set_globals', onHostGlobals)
    document.addEventListener('fullscreenchange', syncWritingMode)
    return () => {
      window.removeEventListener('openai:set_globals', onHostGlobals)
      document.removeEventListener('fullscreenchange', syncWritingMode)
    }
  }, [])

  return { problem, writingReady, requestFullscreen }
}
