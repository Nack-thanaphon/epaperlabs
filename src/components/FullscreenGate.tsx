interface FullscreenGateProps {
  onExpand: () => void
}

export function FullscreenGate({ onExpand }: FullscreenGateProps) {
  return (
    <div className="fullscreenGate">
      <button className="openWritingButton" onClick={onExpand}>เปิดเต็มจอเพื่อเขียน</button>
    </div>
  )
}
