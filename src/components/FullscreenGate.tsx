interface FullscreenGateProps {
  onExpand: () => void
  compact?: boolean
  sent?: boolean
}

export function FullscreenGate({ onExpand, compact = false, sent = false }: FullscreenGateProps) {
  return (
    <div className={`fullscreenGate ${compact ? 'compactGate' : ''}`}>
      {sent && <p className="sentHint">ส่งแล้ว — ดูคำตอบในแชต</p>}
      <button className="openWritingButton" onClick={onExpand}>
        {sent ? 'ตอบข้อถัดไป' : 'ตอบคำถาม'}
      </button>
    </div>
  )
}
