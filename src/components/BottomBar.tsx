import type { SubmitStatus } from '../types'

interface BottomBarProps {
  status: SubmitStatus
  statusText: string
  onExpand: () => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onSubmit: () => void
}

export function BottomBar({ status, statusText, onExpand, onUndo, onRedo, onClear, onSubmit }: BottomBarProps) {
  return (
    <div className="bottomBar">
      <button className="expandButton" onClick={onExpand}>เต็มจอ</button>
      <button className="toolButton" onClick={onUndo}>↶ ย้อนกลับ</button>
      <button className="toolButton" onClick={onRedo}>↷ ทำซ้ำ</button>
      <button className="toolButton danger" onClick={onClear}>ล้าง</button>
      <button className="toolButton primary" disabled={status === 'submitting'} onClick={onSubmit}>{statusText}</button>
    </div>
  )
}
