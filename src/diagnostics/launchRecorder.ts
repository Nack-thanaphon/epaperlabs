export type DiagnosticCode =
  | 'E01' // JavaScript/widget did not start
  | 'E02' // window.openai bridge missing
  | 'E03' // Canvas initialization failed
  | 'E04' // Fullscreen request timed out
  | 'E05' // Host still reports inline
  | 'E06' // Asset or cache version mismatch
  | 'E07' // Submit/export/upload failed

export type TimelineEventName =
  | 'tool_called'
  | 'widget_html_received'
  | 'javascript_started'
  | 'react_mounted'
  | 'openai_bridge_ready'
  | 'canvas_ready'
  | 'fullscreen_requested'
  | 'fullscreen_confirmed'
  | 'fullscreen_failed'
  | 'first_ink'
  | 'submit_failed'

export interface TimelineEvent {
  name: TimelineEventName
  t: number // ms since navigation start
  detail?: string
}

export interface DiagnosticSnapshot {
  incidentId: string
  code: DiagnosticCode | null
  events: TimelineEvent[]
  metrics: {
    canvasReadyMs: number | null
    fullscreenActivationMs: number | null
    firstInkLatencyMs: number | null
  }
  context: {
    buildVersion: string
    resourceUri: string
    displayMode: string
    bridgeReady: boolean
    userAgent: string
  }
}

const BUILD_VERSION = 'papa-v16-board'
const RESOURCE_URI = 'ui://papa/papa-v16-board.html'

function now(): number {
  return Math.round(
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now()
  )
}

function makeIncidentId(): string {
  return `PAPA-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`
}

/**
 * Single source of truth for launch diagnostics. Records a timeline of
 * launch milestones, derives error codes, and builds report payloads.
 *
 * The recorder is intentionally framework-free so it can be imported from
 * plain JS tests (node:test) as well as from React.
 */
export function createLaunchRecorder() {
  const events: TimelineEvent[] = []
  const seen = new Set<TimelineEventName>()
  let incidentId: string | null = null
  let forcedCode: DiagnosticCode | null = null

  const record = (name: TimelineEventName, detail?: string): number => {
    const t = now()
    // Keep the first occurrence of each milestone; only host-driven state
    // transitions (fullscreen_*, submit_failed) may legitimately repeat.
    if (seen.has(name) && !name.startsWith('fullscreen_') && name !== 'submit_failed') {
      return t
    }
    seen.add(name)
    events.push({ name, t, detail })
    return t
  }

  const elapsedSince = (name: TimelineEventName): number | null => {
    const start = events.find((event) => event.name === name)
    if (!start) return null
    return now() - start.t
  }

  const metric = (from: TimelineEventName, to: TimelineEventName): number | null => {
    const a = events.find((event) => event.name === from)
    const b = events.find((event) => event.name === to)
    if (!a || !b) return null
    return Math.round(b.t - a.t)
  }

  const fail = (code: DiagnosticCode, detail?: string) => {
    forcedCode = code
    if (!incidentId) incidentId = makeIncidentId()
    if (detail) console.warn(`[PAPA ${code}] ${detail}`)
  }

  const getIncidentId = () => {
    if (!incidentId) incidentId = makeIncidentId()
    return incidentId
  }

  const deriveCode = (): DiagnosticCode | null => {
    if (forcedCode) return forcedCode
    const has = (name: TimelineEventName) => seen.has(name)
    if (!has('javascript_started')) return 'E01'
    if (!has('canvas_ready')) return 'E03'
    return null
  }

  const snapshot = (): DiagnosticSnapshot => ({
    incidentId: getIncidentId(),
    code: deriveCode(),
    events: [...events],
    metrics: {
      canvasReadyMs: metric('javascript_started', 'canvas_ready'),
      fullscreenActivationMs: metric('fullscreen_requested', 'fullscreen_confirmed'),
      firstInkLatencyMs: metric('canvas_ready', 'first_ink'),
    },
    context: {
      buildVersion: BUILD_VERSION,
      resourceUri: RESOURCE_URI,
      displayMode:
        typeof window !== 'undefined' && window.openai
          ? String(window.openai.displayMode ?? 'unknown')
          : typeof document !== 'undefined' && document.fullscreenElement
            ? 'fullscreen'
            : 'inline',
      bridgeReady:
        typeof window !== 'undefined' &&
        Boolean(window.openai?.requestDisplayMode),
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    },
  })

  return {
    record,
    elapsedSince,
    fail,
    getIncidentId,
    snapshot,
    has: (name: TimelineEventName) => seen.has(name),
    reset: () => {
      events.length = 0
      seen.clear()
      incidentId = null
      forcedCode = null
    },
    get buildVersion() {
      return BUILD_VERSION
    },
  }
}

export type LaunchRecorder = ReturnType<typeof createLaunchRecorder>

export const DIAGNOSIS_LABELS: Record<DiagnosticCode, string> = {
  E01: 'สคริปต์ของกระดาษไม่เริ่มทำงาน',
  E02: 'ยังไม่เชื่อมต่อกับ ChatGPT',
  E03: 'พื้นที่เขียนเตรียมไม่สำเร็จ',
  E04: 'ขอเปิดเต็มจอแล้วไม่ตอบสนอง',
  E05: 'ChatGPT ยังไม่สลับเป็นเต็มจอ',
  E06: 'เวอร์ชันไฟล์ไม่ตรงกัน (cache)',
  E07: 'ส่งงานไม่สำเร็จ',
}

/** human-readable summary used by the debug panel + report body */
export function formatDiagnosis(snapshot: DiagnosticSnapshot): string[] {
  const lines: string[] = []
  if (snapshot.code) {
    lines.push(`${snapshot.incidentId} · ${snapshot.code}: ${DIAGNOSIS_LABELS[snapshot.code]}`)
  } else {
    lines.push(`${snapshot.incidentId} · ไม่พบรหัสข้อผิดพลาด`)
  }
  const m = snapshot.metrics
  lines.push(`Canvas ready: ${m.canvasReadyMs ?? '—'} ms`)
  lines.push(`Fullscreen activation: ${m.fullscreenActivationMs ?? '—'} ms`)
  lines.push(`First ink: ${m.firstInkLatencyMs ?? '—'} ms`)
  lines.push(`Display mode: ${snapshot.context.displayMode}`)
  lines.push(`Bridge: ${snapshot.context.bridgeReady ? 'ready' : 'missing'}`)
  lines.push(`Build: ${snapshot.context.buildVersion}`)
  const failed = snapshot.events.find((e) => e.name === 'fullscreen_failed')
  if (failed?.detail) lines.push(failed.detail)
  return lines
}
