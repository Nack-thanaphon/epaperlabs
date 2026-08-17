import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createLaunchRecorder,
  type DiagnosticSnapshot,
} from '../diagnostics/launchRecorder'
import { formatElapsed, hostLabel } from '../host/hostLabel'
import { problemKey } from '../persistence/widgetDraft'

const EMPTY_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 }
const BOOTSTRAP_TIMEOUT_MS = 3_500
const FULLSCREEN_WAIT_MS = 800

function readDisplayMode(): string {
  if (window.openai?.displayMode) return window.openai.displayMode
  return document.fullscreenElement ? 'fullscreen' : 'inline'
}

export function useOpenAiHost() {
  const recorderRef = useRef(createLaunchRecorder())
  const recorder = recorderRef.current
  const fullscreenAskedRef = useRef(false)
  const mountedAtRef = useRef(Date.now())
  const [problem, setProblem] = useState(() => window.openai?.toolInput?.problem?.trim() ?? '')
  const [safeArea, setSafeArea] = useState(EMPTY_SAFE_AREA)
  const [displayMode, setDisplayMode] = useState(readDisplayMode)
  const [launchError, setLaunchError] = useState<DiagnosticSnapshot | null>(null)
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [logLine, setLogLine] = useState('boot')
  const [elapsedText, setElapsedText] = useState(() => formatElapsed(0))

  const pushLog = useCallback((line: string) => {
    setLogLine(line)
  }, [])

  const requestFullscreen = useCallback(() => {
    if (fullscreenAskedRef.current) return
    fullscreenAskedRef.current = true
    const bridge = window.openai
    if (!bridge?.requestDisplayMode) {
      pushLog('ไม่มี fullscreen API')
      return
    }
    recorder.record('fullscreen_requested')
    pushLog('ขอเต็มจอ')
    const hung = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('fullscreen wait')), FULLSCREEN_WAIT_MS)
    })
    void Promise.race([bridge.requestDisplayMode({ mode: 'fullscreen' }), hung])
      .then(() => {
        const mode = readDisplayMode()
        setDisplayMode(mode)
        if (mode === 'fullscreen') {
          recorder.record('fullscreen_confirmed')
          pushLog('เต็มจอ')
        } else {
          pushLog('โฮสต์ยัง inline')
        }
      })
      .catch(() => {
        recorder.record('fullscreen_failed')
        pushLog('เต็มจอไม่ตอบ — เขียนในการ์ด')
      })
  }, [pushLog, recorder])

  useEffect(() => {
    recorder.record('javascript_started')
    recorder.record('react_mounted')
    pushLog('mounted')

    const syncProblem = () => setProblem(window.openai?.toolInput?.problem?.trim() ?? '')
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
      if (window.openai) recorder.record('openai_bridge_ready')
      syncProblem()
      syncSafeArea()
      setDisplayMode(readDisplayMode())
    }

    onHostGlobals()
    window.addEventListener('openai:set_globals', onHostGlobals)

    return () => {
      window.removeEventListener('openai:set_globals', onHostGlobals)
    }
  }, [pushLog, recorder])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedText(formatElapsed(Date.now() - mountedAtRef.current))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const bootstrapTimer = setTimeout(() => {
      if (!recorder.has('canvas_ready')) {
        recorder.fail('E03', 'canvas not ready')
        setLaunchError(recorder.snapshot())
        pushLog('E03 canvas')
      }
    }, BOOTSTRAP_TIMEOUT_MS)
    return () => clearTimeout(bootstrapTimer)
  }, [pushLog, recorder])

  const markCanvasReady = useCallback(() => {
    if (!recorder.has('canvas_ready')) {
      recorder.record('canvas_ready')
      pushLog('canvas ready')
    }
  }, [pushLog, recorder])

  const markFirstInk = useCallback(() => {
    if (!recorder.has('first_ink')) recorder.record('first_ink')
  }, [recorder])

  const reportSubmitFailure = useCallback((detail: string) => {
    recorder.record('submit_failed', detail)
    recorder.fail('E07', detail)
    setLaunchError(recorder.snapshot())
    pushLog(`E07 ${detail}`)
  }, [pushLog, recorder])

  const retryLaunch = useCallback(() => {
    recorder.reset()
    recorder.record('javascript_started')
    recorder.record('react_mounted')
    if (window.openai) recorder.record('openai_bridge_ready')
    setLaunchError(null)
    setReportState('idle')
    fullscreenAskedRef.current = false
    pushLog('retry')
  }, [pushLog, recorder])

  return {
    problem,
    exerciseKey: problemKey(problem),
    safeArea,
    displayMode,
    hostName: hostLabel(),
    elapsedText,
    requestFullscreen,
    launchError,
    markCanvasReady,
    markFirstInk,
    reportSubmitFailure,
    retryLaunch,
    reportState,
    setReportState,
    recorder,
    buildVersion: recorder.buildVersion,
    logLine,
    pushLog,
  }
}
