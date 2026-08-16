import { describe, expect, it } from 'vitest'
import {
  createLaunchRecorder,
  formatDiagnosis,
  DIAGNOSIS_LABELS,
} from './launchRecorder'

describe('createLaunchRecorder', () => {
  it('derives E01 when javascript never started', () => {
    const recorder = createLaunchRecorder()
    expect(recorder.snapshot().code).toBe('E01')
  })

  it('derives E02 when bridge never became ready', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('react_mounted')
    recorder.record('canvas_ready')
    expect(recorder.snapshot().code).toBe('E02')
  })

  it('derives E03 when canvas never became ready', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('openai_bridge_ready')
    expect(recorder.snapshot().code).toBe('E03')
  })

  it('derives E04 after explicit fullscreen failure', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('openai_bridge_ready')
    recorder.record('canvas_ready')
    recorder.record('fullscreen_requested')
    recorder.record('fullscreen_failed', 'timeout after 4000 ms')
    recorder.fail('E04', 'timeout after 4000 ms')
    expect(recorder.snapshot().code).toBe('E04')
  })

  it('derives E05 when fullscreen was requested but never confirmed', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('openai_bridge_ready')
    recorder.record('canvas_ready')
    recorder.record('fullscreen_requested')
    expect(recorder.snapshot().code).toBe('E05')
  })

  it('reports no code on a fully successful launch', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('openai_bridge_ready')
    recorder.record('canvas_ready')
    recorder.record('fullscreen_requested')
    recorder.record('fullscreen_confirmed')
    expect(recorder.snapshot().code).toBeNull()
  })

  it('computes canvasReadyMs and fullscreenActivationMs from the timeline', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('canvas_ready')
    recorder.record('fullscreen_requested')
    recorder.record('fullscreen_confirmed')
    const snapshot = recorder.snapshot()
    expect(snapshot.metrics.canvasReadyMs).toBeGreaterThanOrEqual(0)
    expect(snapshot.metrics.fullscreenActivationMs).toBeGreaterThanOrEqual(0)
    expect(snapshot.metrics.firstInkLatencyMs).toBeNull()
  })

  it('records first ink only once and computes latency', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('openai_bridge_ready')
    recorder.record('canvas_ready')
    recorder.record('fullscreen_requested')
    recorder.record('fullscreen_confirmed')
    recorder.record('first_ink')
    recorder.record('first_ink')
    expect(recorder.snapshot().events.filter((e) => e.name === 'first_ink')).toHaveLength(1)
    expect(recorder.snapshot().metrics.firstInkLatencyMs).toBeGreaterThanOrEqual(0)
  })

  it('keeps a stable incident id per recorder instance', () => {
    const recorder = createLaunchRecorder()
    const first = recorder.getIncidentId()
    expect(recorder.getIncidentId()).toBe(first)
    expect(first).toMatch(/^PAPA-/)
  })

  it('forced code wins over derived code', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('openai_bridge_ready')
    recorder.record('canvas_ready')
    recorder.fail('E06', 'stale asset hash')
    expect(recorder.snapshot().code).toBe('E06')
  })

  it('submit failure maps to E07', () => {
    const recorder = createLaunchRecorder()
    recorder.record('submit_failed', 'uploading timeout')
    recorder.fail('E07', 'uploading timeout')
    expect(recorder.snapshot().code).toBe('E07')
  })
})

describe('formatDiagnosis', () => {
  it('renders code label and metric lines', () => {
    const recorder = createLaunchRecorder()
    recorder.record('javascript_started')
    recorder.record('openai_bridge_ready')
    recorder.record('fullscreen_requested')
    recorder.fail('E05', 'host still inline')
    const lines = formatDiagnosis(recorder.snapshot())
    expect(lines[0]).toContain('E05')
    expect(lines[0]).toContain(DIAGNOSIS_LABELS.E05)
    expect(lines.join('\n')).toContain('Canvas ready')
    expect(lines.join('\n')).toContain('Display mode')
  })
})
