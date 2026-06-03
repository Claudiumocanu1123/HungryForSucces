/**
 * Deep Space theme — matching the landing page atmosphere.
 * Single source of truth for colors across the visualization layer.
 */
export const T = {
  // Surfaces
  bg: '#050816',
  bgGradient: 'radial-gradient(ellipse at 50% -10%, #0a0f2c 0%, #050816 65%)',
  panel: 'rgba(255,255,255,0.05)',
  panelSolid: '#0d1230',
  panelHover: 'rgba(91,91,245,0.08)',

  // Borders & dividers
  border: 'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.05)',
  borderAccent: 'rgba(91,91,245,0.35)',

  // Text
  text: '#ffffff',
  textSoft: 'rgba(255,255,255,0.58)',
  textFaint: 'rgba(255,255,255,0.36)',
  textGhost: 'rgba(255,255,255,0.22)',

  // Accent (indigo / violet)
  accent: '#7b7bf8',
  accentSoft: 'rgba(91,91,245,0.14)',
  accentSofter: 'rgba(91,91,245,0.07)',
  accent2: '#8b5cf6',

  // Mood / status
  good: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
  gold: '#d4a017',

  // Shadows
  shadow: '0 4px 18px rgba(0,0,0,0.45)',
  shadowLg: '0 12px 40px rgba(0,0,0,0.65)',
  shadowAccent: '0 6px 24px rgba(91,91,245,0.28)',
} as const

export function moodColor(mood: number): string {
  if (mood > 70) return T.good
  if (mood >= 40) return T.warn
  return T.bad
}
