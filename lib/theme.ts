export const colors = {
  bg: '#09090b',
  card: '#0f0f11',
  elevated: '#18181b',
  border: '#27272a',
  input: '#1c1c1f',
  text: '#fafafa',
  textMuted: '#71717a',
  textDim: '#52525b',
  blue: '#3b82f6',
  blueLight: '#60a5fa',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  white: '#ffffff',
} as const

export const COLOR_DOT: Record<string, string> = {
  slate: '#94a3b8', red: '#f87171', orange: '#fb923c', amber: '#fbbf24',
  lime: '#a3e635', green: '#4ade80', emerald: '#34d399', teal: '#2dd4bf',
  cyan: '#22d3ee', sky: '#38bdf8', blue: '#60a5fa', indigo: '#818cf8',
  violet: '#a78bfa', purple: '#c084fc', pink: '#f472b6', rose: '#fb7185',
}

export const COLOR_BORDER: Record<string, string> = {
  slate: '#64748b', red: '#ef4444', orange: '#f97316', amber: '#f59e0b',
  lime: '#84cc16', green: '#22c55e', emerald: '#10b981', teal: '#14b8a6',
  cyan: '#06b6d4', sky: '#0ea5e9', blue: '#3b82f6', indigo: '#6366f1',
  violet: '#8b5cf6', purple: '#a855f7', pink: '#ec4899', rose: '#f43f5e',
}

export const COLOR_BUBBLE: Record<string, string> = {
  slate: '#1e2430', red: '#2a1515', orange: '#2a1a0e', amber: '#2a1f0a',
  lime: '#1a2210', green: '#122212', emerald: '#0f201a', teal: '#0f1f1e',
  cyan: '#0e1f22', sky: '#0e1d27', blue: '#111b2e', indigo: '#181525',
  violet: '#1c1428', purple: '#1e1228', pink: '#251224', rose: '#251118',
}

// Very subtle tinted bubble backgrounds — base #1c1c1e nudged ~10% toward the claw color.
// Feels like the bubble picks up a hint of the claw color without being loud.
export const BUBBLE_TINT: Record<string, string> = {
  slate:   '#1e2026',
  red:     '#25191c',
  orange:  '#251c17',
  amber:   '#241e16',
  lime:    '#1d2318',
  green:   '#18251b',
  emerald: '#17241f',
  teal:    '#172422',
  cyan:    '#172426',
  sky:     '#172229',
  blue:    '#1a2030',
  indigo:  '#1f1e2e',
  violet:  '#221c2d',
  purple:  '#241b2d',
  pink:    '#261b25',
  rose:    '#271a20',
}
