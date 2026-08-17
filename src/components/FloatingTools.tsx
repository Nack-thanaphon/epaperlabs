import { COLORS, SIZE_LABELS, SIZES } from '../constants'
import type { Tool } from '../types'

interface FloatingToolsProps {
  tool: Tool
  color: string
  size: number
  onToolChange: (tool: Tool) => void
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
}

export function FloatingTools({
  tool,
  color,
  size,
  onToolChange,
  onColorChange,
  onSizeChange,
}: FloatingToolsProps) {
  return (
    <div className="floatingTools" aria-label="Drawing tools">
      <button className={`modeButton ${tool === 'pen' ? 'active' : ''}`} aria-label="ปากกา" onClick={() => onToolChange('pen')}>✎</button>
      <button className={`modeButton ${tool === 'eraser' ? 'active' : ''}`} aria-label="ลบ" onClick={() => onToolChange('eraser')}>⌫</button>
      <button className={`modeButton ${tool === 'lasso' ? 'active' : ''}`} aria-label="ลasso คัดลอกเป็นรูป" onClick={() => onToolChange('lasso')}>◌</button>
      <button className={`modeButton ${tool === 'pan' ? 'active' : ''}`} aria-label="เลื่อน" onClick={() => onToolChange('pan')}>✥</button>
      <span className="separator" />
      {COLORS.map((swatch) => (
        <button
          key={swatch}
          className={`swatch ${color === swatch ? 'active' : ''}`}
          style={{ background: swatch }}
          onClick={() => {
            onColorChange(swatch)
            onToolChange('pen')
          }}
          aria-label={`Color ${swatch}`}
        />
      ))}
      <span className="separator" />
      {SIZES.map((value) => (
        <button key={value} className={size === value ? 'active' : ''} onClick={() => onSizeChange(value)}>
          {SIZE_LABELS[value]}
        </button>
      ))}
    </div>
  )
}
