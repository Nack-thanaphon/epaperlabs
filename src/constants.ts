import type { SubmitStatus } from './types'

export const COLORS = ['#111827', '#2563eb', '#dc2626']
export const SIZES = [4, 7, 11]
export const SIZE_LABELS: Record<number, string> = { 4: 'S', 7: 'M', 11: 'L' }
export const PAPER_WIDTH = 2400
export const PAPER_HEIGHT = 1600
export const GRID_STEP = 80
export const MIN_SCALE = 0.3
export const MAX_SCALE = 3

export const STATUS_TEXT: Record<SubmitStatus, string> = {
  idle: 'Submit',
  submitting: 'Submitting…',
  submitted: 'Submitted ✓',
  error: 'Try again',
  empty: 'Write first',
}
