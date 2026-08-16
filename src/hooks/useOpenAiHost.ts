import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createLaunchRecorder,
  formatDiagnosis,
  type DiagnosticSnapshot,
} from '../diagnostics/launchRecorder'

const EMPTY_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 }
const FULLSCREEN_TIMEOUT_MS = 4_000
const BOOTSTRAP_TIMEOUT_MS = 3_500

export function useOpenAiHost() {
  const recorderRef = useRef(createLaunchRecorder())
  const recorder = recorderRef.current
  const [problem, setProblem] = useState('')
  const [writingReady, setWritingReady] = useState(false)
  const [safeArea, setSafeArea] = useState(EMPTY_SAFE_AREA)
  const [launchError, setLaunchError] = useState<DiagnosticSnapshot | null>(null)
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [fullscreenRequested, setFullscreenRequested] = useState(false)
  const fullscreenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearFullscreenTimer = () => {
    if (fullscreenTimerRef.current) {
      clearTimeout(fullscreenTimerRef.current)
      fullscreenTimerRef.current = null
    }
  }

  const requestFullscreen = useCallback(async () => {
    setLaunchError(null)
    setFullscreenRequested(true)
    try {
      if (window.openai?.requestDisplayMode) {
        recorder.record('fullscreen_requested')
        clearFullscreenTimer()
        fullscreenTimerRef.current = setTimeout(() => {
          if (!recorder.has('fullscreen_confirmed')) {
            recorder.record('fullscreen_failed', `Fullscreen request: timeout after ${FULLSCREEN_TIMEOUT_MS} ms`)
            recorder.fail('E04', `fullscreen timeout after ${FULLSCREEN_TIMEOUT_MS} ms`)
            setLaunchError(recorder.snapshot())
          }
        }, FULLSCREEN_TIMEOUT_MS)
        await window.openai.requestDisplayMode({ mode: 'fullscreen' })
        // A resolved request only means the host received it. Enable ink only
        // when the host reports that it really switched to fullscreen.
        if (window.openai.displayMode === 'fullscreen') {
          clearFullscreenTimer()
          recorder.record('fullscreen_confirmed')
          setLaunchError(null)
        }
        setWritingReady(window.openai.displayMode === 'fullscreen')
        return
      }
      await document.documentElement.requestFullscreen?.()
      if (document.fullscreenElement) {
        clearFullscreenTimer()
        recorder.record('fullscreen_confirmed')
        setLaunchError(null)
      }
      setWritingReady(Boolean(document.fullscreenElement))
    } catch (error) {
      clearFullscreenTimer()
      recorder.record('fullscreen_failed', String((error as Error)?.message ?? error))
      recorder.fail('E04', String((error as Error)?.message ?? error))
      setLaunchError(recorder.snapshot())
      setWritingReady(false)
    }
  }, [recorder])

  useEffect(() => {
    recorder.record('javascript_started')
    recorder.record('react_mounted')

    const syncProblem = () => setProblem(window.openai?.toolInput?.problem?.trim() ?? '')
    const syncWritingMode = () => {
      const fullscreen = window.openai
        ? window.openai.displayMode === 'fullscreen'
        : Boolean(document.fullscreenElement)
      if (fullscreen) {
        clearFullscreenTimer()
        recorder.record('fullscreen_confirmed')
        setLaunchError(null)
      }
      setWritingReady(fullscreen)
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
      if (window.openai?.requestDisplayMode) recorder.record('openai_bridge_ready')
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
      clearFullscreenTimer()
    }
  }, [recorder])

  // Bootstrap watchdog: only arm AFTER the user asked for fullscreen. In
  // inline mode the canvas is intentionally absent (compact launcher), so a
  // missing canvas there is not an error — E03 previously fired as a false
  // positive while the widget sat idle in inline mode.
  useEffect(() => {
    if (!fullscreenRequested) return
    const bootstrapTimer = setTimeout(() => {
      if (!recorder.has('canvas_ready')) {
        recorder.fail('E03', 'canvas not ready after fullscreen bootstrap window')
        setLaunchError(recorder.snapshot())
      }
    }, BOOTSTRAP_TIMEOUT_MS)
    return () => clearTimeout(bootstrapTimer)
  }, [fullscreenRequested, recorder])

  const markCanvasReady = useCallback(() => {
    if (!recorder.has('canvas_ready')) recorder.record('canvas_ready')
  }, [recorder])

  const markFirstInk = useCallback(() => {
    if (!recorder.has('first_ink')) recorder.record('first_ink')
  }, [recorder])

  const reportSubmitFailure = useCallback((detail: string) => {
    recorder.record('submit_failed', detail)
    recorder.fail('E07', detail)
  }, [recorder])

  const retryLaunch = useCallback(() => {
    setLaunchError(null)
    setReportState('idle')
    void requestFullscreen()
  }, [requestFullscreen])

  return {
    problem,
    writingReady,
    safeArea,
    requestFullscreen,
    launchError,
    launchErrorLines: launchError ? formatDiagnosis(launchError) : [],
    markCanvasReady,
    markFirstInk,
    reportSubmitFailure,
    retryLaunch,
    reportState,
    setReportState,
    recorder,
  }
}
