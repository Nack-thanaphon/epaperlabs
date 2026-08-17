interface BottomBarProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
}

export function BottomBar({ canUndo, canRedo, onUndo, onRedo, onClear }: BottomBarProps) {
  return (
    <div className="bottomBar">
      <button className="toolButton" aria-label="ย้อนกลับ" disabled={!canUndo} onClick={onUndo}>↶ <span className="historyLabel">ย้อนกลับ</span></button>
      <button className="toolButton" aria-label="ทำซ้ำ" disabled={!canRedo} onClick={onRedo}>↷ <span className="historyLabel">ทำซ้ำ</span></button>
      <button className="toolButton danger" onClick={onClear}>ล้าง</button>
    </div>
  )
}
