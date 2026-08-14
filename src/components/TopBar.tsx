import type { SubmitStatus } from '../types'

interface TopBarProps {
  status: SubmitStatus
  statusText: string
  onExpand: () => void
  onSubmit: () => void
}

export function TopBar({ status, statusText, onExpand, onSubmit }: TopBarProps) {
  return (
    <div className="topBar">
      <div className="brand"><span className="logo">E</span><span>E-PaperLabs</span></div>
      <div className="hint">เขียนได้เฉพาะโหมดเต็มจอ · สองนิ้วซูม/เลื่อน</div>
      <button className="expandButton" onClick={onExpand}>เต็มจอ</button>
      <button className="submitButton" disabled={status === 'submitting'} onClick={onSubmit}>{statusText}</button>
    </div>
  )
}
