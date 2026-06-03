import { NPCWithState, DayStage } from '@/types'

function hashNPC(id: string): [number, number, number] {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = (((h << 5) + h) ^ id.charCodeAt(i)) >>> 0
  return [(h & 0x3ff) / 0x400, ((h >>> 10) & 0x3ff) / 0x400, ((h >>> 20) & 0x3ff) / 0x400]
}

/**
 * Stage-based coordinates for city map view.
 * Uses small offsets (±0.025°  ≈ ±2km) so NPCs spread across the city
 * without leaving the visible map area.
 */
export function getCityStageCoords(npc: NPCWithState, stage: DayStage): [number, number] {
  const [r1, r2, r3] = hashNPC(npc.id)

  // Deterministic "home" position — unique per NPC
  const homeLat = npc.lat + (r1 - 0.5) * 0.028
  const homeLng = npc.lng + (r2 - 0.5) * 0.024

  // Deterministic "work" position — shifted by different hash components
  const workLat = npc.lat + (r2 - 0.5) * 0.032 + 0.006
  const workLng = npc.lng + (r3 - 0.5) * 0.026 + 0.008

  // Restaurant / cafe — another offset
  const restLat = npc.lat + (r3 - 0.5) * 0.018
  const restLng = npc.lng + (r1 - 0.5) * 0.016

  // Evening leisure — slightly different from home
  const evenLat = homeLat + (r2 - 0.5) * 0.01
  const evenLng = homeLng + (r3 - 0.5) * 0.009

  switch (stage) {
    case 'WAKE_UP':
    case 'NIGHT':
      return [homeLat, homeLng]

    case 'MORNING':
      // Leaving home — 30% toward work
      return [
        homeLat * 0.7 + workLat * 0.3,
        homeLng * 0.7 + workLng * 0.3,
      ]

    case 'WORK':
    case 'AFTERNOON':
      return [workLat, workLng]

    case 'LUNCH':
      // Poor NPCs stay home, others go to restaurant
      return npc.budget_ron < 1500
        ? [homeLat, homeLng]
        : [restLat, restLng]

    case 'COMMUTE':
      return [(workLat + homeLat) / 2, (workLng + homeLng) / 2]

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
