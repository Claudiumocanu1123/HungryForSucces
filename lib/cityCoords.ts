import { NPCWithState, DayStage } from '@/types'

// ── Hash helper ────────────────────────────────────────────────────────────────
function hashNPC(id: string): [number, number, number, number] {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = (((h << 5) + h) ^ id.charCodeAt(i)) >>> 0
  return [
    (h & 0xff) / 0xff,
    ((h >>> 8) & 0xff) / 0xff,
    ((h >>> 16) & 0xff) / 0xff,
    ((h >>> 24) & 0xff) / 0xff,
  ]
}

// ── Real Iași districts for HOME positions ─────────────────────────────────────
// All within IMG_BOUNDS: lat [47.120–47.200], lng [27.553–27.650]
const HOMES: [number, number][] = [
  [47.171, 27.560],  // 0 — Copou (deal universitar, nord-vest)
  [47.163, 27.641],  // 1 — Alexandru cel Bun (est)
  [47.148, 27.612],  // 2 — Tătărași (cartier muncitoresc)
  [47.139, 27.596],  // 3 — Nicolina (sud)
  [47.154, 27.585],  // 4 — Podu Roș / centru
  [47.132, 27.576],  // 5 — Mărțișor (sud-vest)
  [47.134, 27.594],  // 6 — CUG (sud-est)
  [47.174, 27.607],  // 7 — Păcurari (nord)
  [47.144, 27.566],  // 8 — Galata (vest)
  [47.165, 27.572],  // 9 — Fundație (Copou jos)
]

// ── Real Iași work locations ───────────────────────────────────────────────────
const WORKS: [number, number][] = [
  [47.161, 27.584],  // 0 — Centru / birouri Palat
  [47.147, 27.626],  // 1 — Industrial est (Fortus)
  [47.168, 27.557],  // 2 — Universitate / Copou
  [47.164, 27.574],  // 3 — Spital / medical
  [47.157, 27.594],  // 4 — Podu Roș comercial
  [47.152, 27.591],  // 5 — Palas / mall offices
  [47.142, 27.580],  // 6 — Zona industrială Nicolina
]

// ── Lunch / restaurant spots ───────────────────────────────────────────────────
const LUNCHES: [number, number][] = [
  [47.153, 27.590],  // Palas food court
  [47.166, 27.564],  // Copou parc cafe
  [47.158, 27.587],  // Restaurant Centru
  [47.149, 27.605],  // Tătărași fast-food
  [47.161, 27.595],  // Bulevardul Independenței
]

// ── Evening/leisure spots ──────────────────────────────────────────────────────
const EVENINGS: [number, number][] = [
  [47.167, 27.562],  // Parcul Copou (tei)
  [47.157, 27.589],  // Centru vechi / Unirii
  [47.153, 27.592],  // Palas — seara
  [47.147, 27.607],  // Mall zona est
]

/**
 * Stage-based coordinates for city map view.
 * Each NPC is assigned to real Iași districts based on a deterministic hash,
 * ensuring NPCs are spread across the entire panoramic image rather than
 * clustering near the city center.
 */
export function getCityStageCoords(npc: NPCWithState, stage: DayStage): [number, number] {
  const [r1, r2, r3, r4] = hashNPC(npc.id)

  // ── Home: pick one of 10 real districts, add micro-jitter within ~150m ──
  const homeIdx  = Math.floor(r1 * HOMES.length)
  const [bLat, bLng] = HOMES[homeIdx]
  const homeLat  = bLat + (r2 - 0.5) * 0.003   // ±~165m
  const homeLng  = bLng + (r3 - 0.5) * 0.003

  // ── Work: different district from home ────────────────────────────────────
  const workIdx  = Math.floor(r3 * WORKS.length)
  const [wLat, wLng] = WORKS[workIdx]
  const workLat  = wLat + (r4 - 0.5) * 0.002
  const workLng  = wLng + (r1 - 0.5) * 0.002

  // ── Lunch spot ────────────────────────────────────────────────────────────
  const lunchIdx = Math.floor(r2 * LUNCHES.length)
  const [lLat, lLng] = LUNCHES[lunchIdx]
  const restLat  = lLat + (r1 - 0.5) * 0.0015
  const restLng  = lLng + (r4 - 0.5) * 0.0015

  // ── Evening leisure ───────────────────────────────────────────────────────
  const evenIdx  = Math.floor(r4 * EVENINGS.length)
  const [eLat, eLng] = EVENINGS[evenIdx]
  const evenLat  = eLat + (r2 - 0.5) * 0.002
  const evenLng  = eLng + (r3 - 0.5) * 0.002

  switch (stage) {
    case 'WAKE_UP':
    case 'NIGHT':
      return [homeLat, homeLng]

    case 'MORNING':
      // En route — 30% toward work
      return [
        homeLat * 0.7 + workLat * 0.3,
        homeLng * 0.7 + workLng * 0.3,
      ]

    case 'WORK':
    case 'AFTERNOON':
      return [workLat, workLng]

    case 'LUNCH':
      // Frugal NPCs eat near home/work; others go to a restaurant
      return npc.budget_ron < 1500
        ? [workLat + (restLat - workLat) * 0.3, workLng + (restLng - workLng) * 0.3]
        : [restLat, restLng]

    case 'COMMUTE':
      // Midpoint of return journey
      return [
        (workLat + homeLat) / 2,
        (workLng + homeLng) / 2,
      ]

    case 'EVENING':
      return npc.budget_ron < 1500
        ? [homeLat, homeLng]
        : [evenLat, evenLng]

    default:
      return [homeLat, homeLng]
  }
}

export const CITY_MAP_CONFIG: Record<string, { center: [number, number]; zoom: number }> = {
  'București':   { center: [44.4268, 26.1025], zoom: 13 },
  'Cluj-Napoca': { center: [46.7712, 23.6236], zoom: 14 },
  'Iași':        { center: [47.1585, 27.6014], zoom: 14 },
  'Timișoara':   { center: [45.7489, 21.2087], zoom: 14 },
  'Brașov':      { center: [45.6579, 25.6012], zoom: 14 },
}
