interface StatusStripProps {
  buildVersion: string
  displayMode: string
  hostName: string
  elapsedText: string
  status: string
  logLine: string
}

export function StatusStrip({
  buildVersion,
  displayMode,
  hostName,
  elapsedText,
  status,
  logLine,
}: StatusStripProps) {
  return (
    <div className="statusStrip" aria-live="polite">
      <div>{buildVersion} · {hostName} · {displayMode}</div>
      <div>{elapsedText} · {status} · {logLine}</div>
    </div>
  )
}
