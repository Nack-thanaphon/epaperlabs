import type { ReactNode } from 'react'

interface IconProps {
  children: ReactNode
}

function Icon({ children }: IconProps) {
  return (
    <svg
      className="toolIcon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function DrawIcon() {
  return (
    <Icon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  )
}

export function EraseIcon() {
  return (
    <Icon>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 12 5 5" />
    </Icon>
  )
}

export function LassoIcon() {
  return (
    <Icon>
      <path d="M4 15c2-8 7-11 12-9 5 2 6 8 3 11-3 3-8 2-11-1" strokeDasharray="3 3" />
      <circle cx="7" cy="17" r="2.5" />
    </Icon>
  )
}

export function RectIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 3" />
    </Icon>
  )
}

export function UndoIcon() {
  return (
    <Icon>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Icon>
  )
}

export function RedoIcon() {
  return (
    <Icon>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </Icon>
  )
}

export function ClearIcon() {
  return (
    <Icon>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Icon>
  )
}
