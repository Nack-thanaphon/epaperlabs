import type { SubmitStatus } from '../types'

interface BottomBarProps {
  status: SubmitStatus
  statusText: string
  onExpand: () => void
  onUndo: () => void
  onClear: () => void
  onSubmit: () => void
}

export function BottomBar({ status, statusText, onExpand, onUndo, onClear, onSubmit }: BottomBarProps) {
  return (
    <div className="bottomBar">
      <button className="expandButton" onClick={onExpand}>เต็มจอ</button>
      <button className="toolButton" onClick={onUndo}>↶ ย้อนกลับ</button>
      <button className="toolButton danger" onClick={onClear}>ล้าง</button>
      <button className="toolButton primary" disabled={status === 'submitting'} onClick={onSubmit}>{statusText}</button>
    </div>
  )
}
