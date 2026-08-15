import type { SubmitStatus } from '../types'

interface BottomBarProps {
  status: SubmitStatus
  isSubmitting: boolean
  mutationLocked: boolean
  statusText: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onSubmit: () => void
}

export function BottomBar({ status, isSubmitting, mutationLocked, statusText, canUndo, canRedo, onUndo, onRedo, onClear, onSubmit }: BottomBarProps) {
  return (
    <div className="bottomBar">
      <button className="toolButton" aria-label="ย้อนกลับ" disabled={mutationLocked || !canUndo} onClick={onUndo}>↶ <span className="historyLabel">ย้อนกลับ</span></button>
      <button className="toolButton" aria-label="ทำซ้ำ" disabled={mutationLocked || !canRedo} onClick={onRedo}>↷ <span className="historyLabel">ทำซ้ำ</span></button>
      <button className="toolButton danger" disabled={mutationLocked} onClick={onClear}>ล้าง</button>
      <button className="toolButton primary" disabled={isSubmitting} aria-live="polite" data-status={status} onClick={onSubmit}>{statusText}</button>
    </div>
  )
}
