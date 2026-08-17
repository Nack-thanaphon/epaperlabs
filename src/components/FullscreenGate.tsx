interface FullscreenGateProps {
  onExpand: () => void
  compact?: boolean
  sent?: boolean
}

export function FullscreenGate({ onExpand, compact = false, sent = false }: FullscreenGateProps) {
  return (
    <div className={`fullscreenGate ${compact ? 'compactGate' : ''}`}>
      {sent && <p className="sentHint">ส่งแล้ว — ปัดลงหรือแตะ X มุมบนเพื่อดูคำตอบในแชต</p>}
      <button className="openWritingButton" onClick={onExpand}>
        {sent ? 'เขียนต่อ' : 'เปิดเต็มจอเพื่อเขียน'}
      </button>
    </div>
  )
}
