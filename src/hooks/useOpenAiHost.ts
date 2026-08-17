import { useCallback, useEffect, useRef, useState } from 'react'
import { WRITING_EXIT_DEBOUNCE_MS } from '../constants'
import {
  createLaunchRecorder,
  formatDiagnosis,
  type DiagnosticSnapshot,
} from '../diagnostics/launchRecorder'
import { problemKey } from '../persistence/widgetDraft'

const EMPTY_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 }
const BOOTSTRAP_TIMEOUT_MS = 3_500

export function useOpenAiHost() {
  const recorderRef = useRef(createLaunchRecorder())
  const recorder = recorderRef.current
  const [problem, setProblem] = useState(() => window.openai?.toolInput?.problem?.trim() ?? '')
  const [writingReady, setWritingReady] = useState(false)
  const [safeArea, setSafeArea] = useState(EMPTY_SAFE_AREA)
  const [launchError, setLaunchError] = useState<DiagnosticSnapshot | null>(null)
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const writingExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressFullscreenRef = useRef(false)
  const dismissedKeysRef = useRef(new Set<string>())
  const userWantsWritingRef = useRef(false)

  const clearWritingExitTimer = () => {
    if (writingExitTimerRef.current) {
      clearTimeout(writingExitTimerRef.current)
      writingExitTimerRef.current = null
    }
  }

  const applyWritingReady = (fullscreen: boolean) => {
    if (fullscreen) {
      if (suppressFullscreenRef.current) return
      userWantsWritingRef.current = true
      clearWritingExitTimer()
      setWritingReady(true)
      return
    }
    if (userWantsWritingRef.current) return
    if (writingExitTimerRef.current) return
    writingExitTimerRef.current = setTimeout(() => {
      writingExitTimerRef.current = null
      setWritingReady(false)
    }, WRITING_EXIT_DEBOUNCE_MS)
  }

  const requestFullscreen = useCallback(async () => {
    suppressFullscreenRef.current = false
    userWantsWritingRef.current = true
    setLaunchError(null)
    setWritingReady(true)
    try {
      if (window.openai?.requestDisplayMode) {
        recorder.record('fullscreen_requested')
        await window.openai.requestDisplayMode({ mode: 'fullscreen' })
        if (window.openai.displayMode === 'fullscreen') {
          recorder.record('fullscreen_confirmed')
        }
        return
      }
      await document.documentElement.requestFullscreen?.()
      if (document.fullscreenElement) recorder.record('fullscreen_confirmed')
    } catch {
      // Host declined fullscreen; keep the writing surface in the card.
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
        recorder.record('fullscreen_confirmed')
        setLaunchError(null)
      }
      applyWritingReady(fullscreen)
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
      clearWritingExitTimer()
    }
  }, [recorder])

  useEffect(() => {
    if (!writingReady) return
    const bootstrapTimer = setTimeout(() => {
      if (!recorder.has('canvas_ready')) {
        recorder.fail('E03', 'canvas not ready after fullscreen confirmed')
        setLaunchError(recorder.snapshot())
      }
    }, BOOTSTRAP_TIMEOUT_MS)
    return () => clearTimeout(bootstrapTimer)
  }, [writingReady, recorder])

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
    recorder.reset()
    recorder.record('javascript_started')
    recorder.record('react_mounted')
    if (window.openai?.requestDisplayMode) recorder.record('openai_bridge_ready')
    setLaunchError(null)
    setReportState('idle')
    dismissedKeysRef.current.delete(problemKey(problem))
    void requestFullscreen()
  }, [problem, recorder, requestFullscreen])

  const markCollapsed = useCallback(() => {
    dismissedKeysRef.current.add(problemKey(problem))
    suppressFullscreenRef.current = true
    userWantsWritingRef.current = false
    clearWritingExitTimer()
    setWritingReady(false)
  }, [problem])

  return {
    problem,
    exerciseKey: problemKey(problem),
    writingReady,
    safeArea,
    requestFullscreen,
    launchError,
    launchErrorLines: launchError ? formatDiagnosis(launchError) : [],
    markCanvasReady,
    markFirstInk,
    reportSubmitFailure,
    retryLaunch,
    markCollapsed,
    reportState,
    setReportState,
    recorder,
  }
}
