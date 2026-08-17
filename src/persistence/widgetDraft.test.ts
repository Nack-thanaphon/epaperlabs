import { describe, expect, it } from 'vitest'
import { MAX_DRAFT_BYTES } from '../constants'
import { BLANK_PROBLEM_KEY, buildDraftPayload, parseDraft } from './widgetDraft'
import type { Stroke } from '../types'

const stroke: Stroke = {
  id: 's1',
  color: '#111827',
  size: 7,
  points: [{ x: 10, y: 20, pressure: 0.6 }],
}

describe('widgetDraft', () => {
  it('round-trips valid strokes with a problem key', () => {
    const payload = buildDraftPayload([stroke], 'x^2')
    expect(parseDraft(payload)).toEqual({ problemKey: 'x^2', strokes: [stroke] })
  })

  it('rejects corrupt payloads', () => {
    expect(parseDraft({ v: 1, strokes: [{ id: 1 }] })).toBeNull()
    expect(parseDraft({ v: 9, strokes: [] })).toBeNull()
    expect(parseDraft(null)).toBeNull()
  })

  it('keeps v1 drafts only for blank paper', () => {
    const payload = { v: 1 as const, strokes: [stroke] }
    expect(parseDraft(payload)).toEqual({ problemKey: null, strokes: [stroke] })
    expect(BLANK_PROBLEM_KEY).toBe('blank')
  })

  it('refuses oversized drafts', () => {
    const huge: Stroke = {
      id: 'huge',
      color: '#111827',
      size: 7,
      points: Array.from({ length: MAX_DRAFT_BYTES }, (_, i) => ({ x: i, y: i, pressure: 0.5 })),
    }
    expect(buildDraftPayload([huge])).toBeNull()
  })
})
