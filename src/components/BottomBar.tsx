import type { SubmitStatus } from '../types'

interface BottomBarProps {
  status: SubmitStatus
  isSubmitting: boolean
  statusText: string
  onExpand: () => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onSubmit: () => void
}

export function BottomBar({ status, isSubmitting, statusText, onExpand, onUndo, onRedo, onClear, onSubmit }: BottomBarProps) {
  return (
    <div className="bottomBar">
      <button className="expandButton" onClick={onExpand}>เต็มจอ</button>
      <button className="toolButton" onClick={onUndo}>↶ ย้อนกลับ</button>
      <button className="toolButton" onClick={onRedo}>↷ ทำซ้ำ</button>
      <button className="toolButton danger" onClick={onClear}>ล้าง</button>
      <button className="toolButton primary" disabled={isSubmitting} aria-live="polite" data-status={status} onClick={onSubmit}>{statusText}</button>
    </div>
  )
}
