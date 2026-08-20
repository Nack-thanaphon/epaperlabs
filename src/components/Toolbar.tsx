import { COLORS, MAX_PEN_SIZE, MIN_PEN_SIZE } from '../constants'
import type { Tool } from '../types'
import {
  ClearIcon,
  DrawIcon,
  EraseIcon,
  LassoIcon,
  RectIcon,
  RedoIcon,
  UndoIcon,
} from './ToolIcons'

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
      <button className={tool === 'pen' ? 'active' : ''} aria-label="Draw" onClick={() => onToolChange('pen')}>
        <DrawIcon />
      </button>
      <button className={tool === 'eraser' ? 'active' : ''} aria-label="Erase" onClick={() => onToolChange('eraser')}>
        <EraseIcon />
      </button>
      <button className={tool === 'lasso' ? 'active' : ''} aria-label="Lasso" onClick={() => onToolChange('lasso')}>
        <LassoIcon />
      </button>
      <button className={tool === 'rect' ? 'active' : ''} aria-label="Rect" onClick={() => onToolChange('rect')}>
        <RectIcon />
      </button>
      <button disabled={!canUndo} aria-label="Undo" onClick={onUndo}>
        <UndoIcon />
      </button>
      <button disabled={!canRedo} aria-label="Redo" onClick={onRedo}>
        <RedoIcon />
      </button>
      <button aria-label="Clear" onClick={onClear}>
        <ClearIcon />
      </button>
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
