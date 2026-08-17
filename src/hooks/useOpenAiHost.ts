import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [safeArea, setSafeArea] = useState(EMPTY_SAFE_AREA)
  const [launchError, setLaunchError] = useState<DiagnosticSnapshot | null>(null)
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [logLine, setLogLine] = useState('boot')

  const pushLog = useCallback((line: string) => {
    setLogLine(line)
  }, [])

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
    }

    onHostGlobals()
    window.addEventListener('openai:set_globals', onHostGlobals)

    return () => {
      window.removeEventListener('openai:set_globals', onHostGlobals)
    }
  }, [pushLog, recorder])

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
    pushLog('retry')
  }, [pushLog, recorder])

  return {
    problem,
    exerciseKey: problemKey(problem),
    safeArea,
    launchError,
    launchErrorLines: launchError ? formatDiagnosis(launchError) : [],
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
