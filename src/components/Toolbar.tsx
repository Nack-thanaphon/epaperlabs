import { COLORS, MAX_PEN_SIZE, MIN_PEN_SIZE } from '../constants'
import type { Tool } from '../types'

interface ToolbarProps {
  tool: Tool
  color: string
  size: number
  canUndo: boolean
  canRedo: boolean
  hint: string
  zoomPercent: number
  onToolChange: (tool: Tool) => void
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
}

export function Toolbar({
  tool,
  color,
  size,
  canUndo,
  canRedo,
  hint,
  zoomPercent,
  onToolChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onRedo,
  onClear,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      <button className={tool === 'pen' ? 'active' : ''} onClick={() => onToolChange('pen')}>Draw</button>
      <button className={tool === 'eraser' ? 'active' : ''} onClick={() => onToolChange('eraser')}>Erase</button>
      <button className={tool === 'lasso' ? 'active' : ''} onClick={() => onToolChange('lasso')}>Lasso</button>
      <button className={tool === 'rect' ? 'active' : ''} onClick={() => onToolChange('rect')}>Rect</button>
      <button disabled={!canUndo} onClick={onUndo}>Undo</button>
      <button disabled={!canRedo} onClick={onRedo}>Redo</button>
      <button onClick={onClear}>Clear</button>
      <label className="sizeControl">
        Size
        <input
          type="range"
          min={MIN_PEN_SIZE}
          max={MAX_PEN_SIZE}
          value={size}
          onChange={(event) => onSizeChange(Number(event.target.value))}
        />
      </label>
      <div className="swatches">
        {COLORS.map((swatch) => (
          <button
            key={swatch}
            className={`swatch ${color === swatch ? 'active' : ''}`}
            style={{ background: swatch }}
            aria-label={`Color ${swatch}`}
            onClick={() => {
              onColorChange(swatch)
              onToolChange('pen')
            }}
          />
        ))}
      </div>
      <span className="zoomLabel" aria-label="Zoom">{zoomPercent}%</span>
      {hint && <span className="lassoHint">{hint}</span>}
    </div>
  )
}
