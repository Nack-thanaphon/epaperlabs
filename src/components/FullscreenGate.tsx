interface FullscreenGateProps {
  onExpand: () => void
  compact?: boolean
}

export function FullscreenGate({ onExpand, compact = false }: FullscreenGateProps) {
  return (
    <div className={`fullscreenGate ${compact ? 'compactGate' : ''}`}>
      <button className="openWritingButton" onClick={onExpand}>เปิดเต็มจอเพื่อเขียน</button>
    </div>
  )
}
