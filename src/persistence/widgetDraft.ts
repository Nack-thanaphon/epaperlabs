import { MAX_DRAFT_BYTES } from '../constants'
import type { Stroke } from '../types'

export const DRAFT_SOURCE = 'papa-handwriting-board'
export const BLANK_PROBLEM_KEY = 'blank'

export function problemKey(problem: string) {
  return problem.trim() || BLANK_PROBLEM_KEY
}

interface DraftPayload {
  v: 1 | 2
  problemKey?: string
  strokes: Stroke[]
}

interface PrivateContent {
  source?: string
  papaDraft?: unknown
  [key: string]: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseStrokes(raw: unknown): Stroke[] | null {
  if (!Array.isArray(raw)) return null
  const strokes: Stroke[] = []
  for (const item of raw) {
    const stroke = asRecord(item)
    if (!stroke || typeof stroke.id !== 'string' || !Array.isArray(stroke.points)) return null
    if (typeof stroke.color !== 'string' || !isFiniteNumber(stroke.size)) return null
    const points = []
    for (const point of stroke.points) {
      const p = asRecord(point)
      if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return null
      points.push({
        x: p.x,
        y: p.y,
        pressure: isFiniteNumber(p.pressure) ? p.pressure : 0.5,
      })
    }
    strokes.push({ id: stroke.id, color: stroke.color, size: stroke.size, points })
  }
  return strokes
}

export function parseDraft(raw: unknown): { problemKey: string | null; strokes: Stroke[] } | null {
  const payload = asRecord(raw)
  if (!payload || (payload.v !== 1 && payload.v !== 2)) return null
  const strokes = parseStrokes(payload.strokes)
  if (!strokes) return null
  return {
    problemKey: typeof payload.problemKey === 'string' ? payload.problemKey : null,
    strokes,
  }
}

export function buildDraftPayload(strokes: Stroke[], key = BLANK_PROBLEM_KEY): DraftPayload | null {
  const payload: DraftPayload = { v: 2, problemKey: key, strokes }
  if (JSON.stringify(payload).length > MAX_DRAFT_BYTES) return null
  return payload
}

function currentWidgetState() {
  return window.openai?.widgetState ?? {}
}

function currentPrivateContent(): PrivateContent {
  return asRecord(currentWidgetState().privateContent) ?? {}
}

export function readHostDraft(key: string): Stroke[] | null {
  const parsed = parseDraft(currentPrivateContent().papaDraft)
  if (!parsed) return null
  if (parsed.problemKey && parsed.problemKey !== key) return null
  if (!parsed.problemKey && key !== BLANK_PROBLEM_KEY) return null
  return parsed.strokes
}

export async function writeHostDraft(strokes: Stroke[], key: string): Promise<void> {
  const setWidgetState = window.openai?.setWidgetState
  if (!setWidgetState) return
  const papaDraft = buildDraftPayload(strokes, key)
  if (!papaDraft && strokes.length > 0) return
  const state = currentWidgetState()
  await setWidgetState({
    ...state,
    privateContent: {
      ...currentPrivateContent(),
      source: DRAFT_SOURCE,
      papaDraft: papaDraft ?? undefined,
    },
  })
}

export async function clearHostDraft(): Promise<void> {
  const setWidgetState = window.openai?.setWidgetState
  if (!setWidgetState) return
  const privateContent = { ...currentPrivateContent() }
  delete privateContent.papaDraft
  const state = currentWidgetState()
  await setWidgetState({
    ...state,
    privateContent,
  })
}
