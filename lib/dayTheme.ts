/**
 * Cinematic day/night cycle theme system.
 * Maps a continuous time-of-day (0–24h float) to a full visual theme.
 */

type RGB = [number, number, number]

function hex(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ]
}

function toRgb([r, g, b]: RGB): string {
  return `rgb(${r},${g},${b})`
}

// ── Public theme interface ────────────────────────────────────────────────────

export interface DayTheme {
  /** CSS gradient for the full-page background */
  skyGradient: string
  /** Tinted panel background */
  panelBg: string
  /** Tinted panel border */
  panelBorder: string
  /** Header bar background */
  headerBg: string
  /** Primary accent color */
  accentColor: string
  /** Globe atmosphere hex color */
  atmosphereColor: string
  /** Globe atmosphere thickness */
  atmosphereAltitude: number
  /** Three.js sun intensity 0–1 */
  sunIntensity: number
  /** Three.js ambient intensity 0–1 */
  ambientIntensity: number
  /** Stars overlay opacity 0–1 */
  starsOpacity: number
  /** Ambient particle opacity (dusk/night) 0–1 */
  particleOpacity: number
  /** City-lights texture opacity 0–1 (night glow on globe) */
  nightLightsOpacity: number
  /** Current named phase */
  phase: 'night' | 'dawn' | 'morning' | 'day' | 'afternoon' | 'sunset' | 'dusk' | 'evening'
  /** Formatted "HH:MM" */
  timeStr: string
}

// ── Keyframes ─────────────────────────────────────────────────────────────────

interface KF {
  h: number          // hour (0–24, duplicates at 24 = midnight wrap)
  skyT: RGB          // sky top color
  skyB: RGB          // sky bottom / horizon color
  acc: RGB           // accent color
  atm: RGB           // globe atmosphere color
  atmA: number       // atmosphere altitude
  sun: number        // sun intensity 0–1
  amb: number        // ambient intensity 0–1
  stars: number      // stars opacity
  ptcl: number       // particle opacity
  night: number      // night-lights opacity
  phase: DayTheme['phase']
}

// prettier-ignore
const FRAMES: KF[] = [
  // Atmosphere altitude bumped up for cinematic space view (0.22–0.38)
  // h      skyT              skyB              acc               atm               atmA  sun   amb   stars ptcl  night  phase
  { h:  0,  skyT:hex('#010208'), skyB:hex('#030614'), acc:hex('#3838c8'), atm:hex('#2030c8'), atmA:0.22, sun:0,    amb:0.06, stars:1.00, ptcl:0.65, night:0.98, phase:'night'     },
  { h:  4.5,skyT:hex('#020310'), skyB:hex('#060520'), acc:hex('#3838c8'), atm:hex('#2030c8'), atmA:0.22, sun:0,    amb:0.06, stars:1.00, ptcl:0.60, night:0.95, phase:'night'     },
  { h:  5.5,skyT:hex('#0a0418'), skyB:hex('#200a30'), acc:hex('#4428b0'), atm:hex('#2820b8'), atmA:0.26, sun:0.02, amb:0.07, stars:0.75, ptcl:0.55, night:0.80, phase:'dawn'      },
  { h:  6,  skyT:hex('#1c0808'), skyB:hex('#8a2c08'), acc:hex('#c85010'), atm:hex('#ff7030'), atmA:0.34, sun:0.20, amb:0.12, stars:0.25, ptcl:0.70, night:0.45, phase:'dawn'      },
  { h:  6.8,skyT:hex('#1e1008'), skyB:hex('#b85818'), acc:hex('#e08818'), atm:hex('#ffb050'), atmA:0.36, sun:0.45, amb:0.18, stars:0.04, ptcl:0.45, night:0.18, phase:'dawn'      },
  { h:  8,  skyT:hex('#0c1830'), skyB:hex('#1c4060'), acc:hex('#c89018'), atm:hex('#ffc860'), atmA:0.30, sun:0.80, amb:0.28, stars:0,    ptcl:0.08, night:0.02, phase:'morning'   },
  { h:  9.5,skyT:hex('#050e1c'), skyB:hex('#0c2438'), acc:hex('#7878f8'), atm:hex('#a8d0ff'), atmA:0.28, sun:0.96, amb:0.38, stars:0,    ptcl:0,    night:0,    phase:'morning'   },
  { h: 12,  skyT:hex('#040c1c'), skyB:hex('#0c2240'), acc:hex('#7878f8'), atm:hex('#b0d8ff'), atmA:0.28, sun:1.00, amb:0.44, stars:0,    ptcl:0,    night:0,    phase:'day'       },
  { h: 15,  skyT:hex('#050e20'), skyB:hex('#102845'), acc:hex('#7878f8'), atm:hex('#a0ccff'), atmA:0.27, sun:0.93, amb:0.40, stars:0,    ptcl:0,    night:0,    phase:'afternoon' },
  { h: 17,  skyT:hex('#0a1020'), skyB:hex('#1a3050'), acc:hex('#7878f8'), atm:hex('#90b8f0'), atmA:0.26, sun:0.74, amb:0.30, stars:0,    ptcl:0.06, night:0,    phase:'afternoon' },
  { h: 17.8,skyT:hex('#200808'), skyB:hex('#c05015'), acc:hex('#e07020'), atm:hex('#ff8040'), atmA:0.35, sun:0.40, amb:0.18, stars:0.10, ptcl:0.42, night:0.10, phase:'sunset'    },
  { h: 18.8,skyT:hex('#220608'), skyB:hex('#800808'), acc:hex('#c02808'), atm:hex('#e03020'), atmA:0.32, sun:0.10, amb:0.10, stars:0.35, ptcl:0.62, night:0.42, phase:'sunset'    },
  { h: 19.8,skyT:hex('#100620'), skyB:hex('#480830'), acc:hex('#7025cc'), atm:hex('#7820c8'), atmA:0.28, sun:0,    amb:0.07, stars:0.72, ptcl:0.72, night:0.68, phase:'dusk'      },
  { h: 21,  skyT:hex('#060818'), skyB:hex('#0c1030'), acc:hex('#4848d0'), atm:hex('#3050c8'), atmA:0.24, sun:0,    amb:0.06, stars:0.95, ptcl:0.48, night:0.90, phase:'evening'   },
  { h: 23,  skyT:hex('#020408'), skyB:hex('#050810'), acc:hex('#3838c8'), atm:hex('#2030c8'), atmA:0.22, sun:0,    amb:0.06, stars:1.00, ptcl:0.62, night:0.97, phase:'night'     },
  { h: 24,  skyT:hex('#010208'), skyB:hex('#030614'), acc:hex('#3838c8'), atm:hex('#2030c8'), atmA:0.22, sun:0,    amb:0.06, stars:1.00, ptcl:0.65, night:0.98, phase:'night'     },
]

// ── Core computation ──────────────────────────────────────────────────────────

export function computeTheme(rawHour: number): DayTheme {
  const t = ((rawHour % 24) + 24) % 24

  // Find surrounding keyframes
  let hi = FRAMES.findIndex((f) => f.h > t)
  if (hi < 0) hi = FRAMES.length - 1
  const f0 = FRAMES[Math.max(hi - 1, 0)]
  const f1 = FRAMES[hi]

  const span  = f1.h - f0.h
  const alpha = span > 0 ? (t - f0.h) / span : 0

  const sl = (a: number, b: number) => lerp(a, b, alpha)
  const sr = (a: RGB, b: RGB) => lerpRGB(a, b, alpha)

  const skyT = sr(f0.skyT, f1.skyT)
  const skyB = sr(f0.skyB, f1.skyB)
  const acc  = sr(f0.acc,  f1.acc)
  const atm  = sr(f0.atm,  f1.atm)

  const sunInt  = sl(f0.sun,   f1.sun)
  const ambInt  = sl(f0.amb,   f1.amb)
  const atmAlt  = sl(f0.atmA,  f1.atmA)
  const stars   = sl(f0.stars, f1.stars)
  const ptcl    = sl(f0.ptcl,  f1.ptcl)
  const nlights = sl(f0.night, f1.night)
  const phase   = alpha < 0.5 ? f0.phase : f1.phase

  // Format HH:MM
  const hh = Math.floor(t)
  const mm = Math.floor((t - hh) * 60)
  const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`

  // Sky uses a radial gradient — top of screen fades to horizon
  const skyGradient = [
    `radial-gradient(ellipse at 50% -5%,`,
    `${toRgb(skyT)} 0%,`,
    `${toRgb(skyB)} 65%`,
    `)`,
  ].join(' ')

  // Panel tinted very subtly from sky palette
  const pr = Math.min(skyB[0] + 4, 22)
  const pg = Math.min(skyB[1] + 3, 16)
  const pb = Math.min(skyB[2] + 8, 32)
  const panelBg     = `rgba(${pr},${pg},${pb},0.90)`
  const panelBorder = `rgba(${acc[0]},${acc[1]},${acc[2]},0.20)`
  const hr = Math.min(skyT[0] + 3, 14)
  const hg = Math.min(skyT[1] + 2, 11)
  const hb = Math.min(skyT[2] + 6, 24)
  const headerBg    = `rgba(${hr},${hg},${hb},0.88)`

  return {
    skyGradient,
    panelBg,
    panelBorder,
    headerBg,
    accentColor: toRgb(acc),
    atmosphereColor: toRgb(atm),
    atmosphereAltitude: atmAlt,
    sunIntensity: sunInt,
    ambientIntensity: ambInt,
    starsOpacity: stars,
    particleOpacity: ptcl,
    nightLightsOpacity: nlights,
    phase,
    timeStr,
  }
}

// ── Stage → hour mapping ──────────────────────────────────────────────────────
// Each pair is [stageStartHour, nextStageStartHour]
export const STAGE_HOUR_RANGES: [number, number][] = [
  [6, 8],   // WAKE_UP
  [8, 10],  // MORNING
  [10, 13], // WORK
  [13, 15], // LUNCH
  [15, 18], // AFTERNOON
  [18, 20], // COMMUTE
  [20, 23], // EVENING
  [23, 30], // NIGHT → wraps (30 % 24 = 6 next day)
]

export function stageProgressToHour(stageIndex: number, progress: number): number {
  const [h0, h1] = STAGE_HOUR_RANGES[Math.min(stageIndex, 7)]
  return (h0 + (h1 - h0) * progress) % 24
}
