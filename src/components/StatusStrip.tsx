interface StatusStripProps {
  buildVersion: string
  displayMode: string
  hostName: string
  elapsedText: string
  logLine: string
}

export function StatusStrip({
  buildVersion,
  displayMode,
  hostName,
  elapsedText,
  logLine,
}: StatusStripProps) {
  return (
    <div className="statusStrip" aria-live="polite">
      <div>{buildVersion} · {hostName} · {displayMode}</div>
      <div>{elapsedText} · {logLine}</div>
    </div>
  )
}
