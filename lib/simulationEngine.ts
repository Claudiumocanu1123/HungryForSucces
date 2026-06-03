import { NPC, NPCState, SimEvent, DayStage, STAGES } from '@/types'
import { getDb, persistDb } from './db'
import { getAllNPCs } from './seed'
import {
  pushState, getNewestState, clearNPCStates,
  getLastDayStates, setInitialState,
} from './stateManager'

const STAGE_LOCATIONS: Record<DayStage, (npc: NPC) => string> = {
  WAKE_UP: (npc) => `acasă în ${npc.city}`,
  MORNING: (npc) => `acasă în ${npc.city}`,
  WORK: (npc) => `la locul de muncă în ${npc.city}`,
  LUNCH: (npc) => {
    if (npc.budget_ron < 1500) return 'acasă'
    if (npc.budget_ron > 6000) return 'restaurant'
    return Math.random() > 0.5 ? 'restaurant' : 'acasă'
  },
  AFTERNOON: (npc) => `la locul de muncă în ${npc.city}`,
  COMMUTE: (npc) => `în drum spre casă în ${npc.city}`,
  EVENING: (npc) => {
    if (npc.budget_ron < 1500) return `acasă în ${npc.city}`
    if (npc.budget_ron > 6000) return `în oraș în ${npc.city}`
    return `acasă în ${npc.city}`
  },
  NIGHT: (npc) => `acasă în ${npc.city}`,
}

const STAGE_ACTIVITIES: Record<DayStage, (npc: NPC) => string> = {
  WAKE_UP: () => 'Se trezește și începe dimineața',
  MORNING: (npc) => npc.budget_ron > 6000
    ? 'Se pregătește relaxat pentru ziua care urmează'
    : 'Se pregătește pentru o nouă zi de muncă',
  WORK: (npc) => `Lucrează ca ${npc.profession}`,
  LUNCH: (npc) => {
    if (npc.budget_ron < 1500) return 'Mănâncă acasă, economisind bani'
    if (npc.budget_ron > 6000) return 'Ia prânzul la un restaurant'
    return 'Ia pauza de prânz'
  },
  AFTERNOON: (npc) => `Continuă activitățile de ${npc.profession}`,
  COMMUTE: () => 'Se întoarce spre casă după o zi lungă',
  EVENING: (npc) => {
    if (npc.budget_ron < 1500) return 'Seara acasă, economisind resursele'
    if (npc.budget_ron > 6000) return 'Seară activă în oraș cu activități sociale'
    return 'Seară relaxantă acasă'
  },
  NIGHT: () => 'Se pregătește să doarmă',
}

function clamp(val: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, val))
}

function applyStageStats(
  prev: NPCState,
  stage: DayStage,
  npc: NPC,
): { energy: number; hunger: number; mood: number; social: number; events: SimEvent[] } {
  let { energy, hunger, mood, social } = prev
  const events: SimEvent[] = []

  switch (stage) {
    case 'WAKE_UP':
      hunger = clamp(hunger + 20)
      energy = clamp(energy - 5)
      break
    case 'MORNING':
      hunger = clamp(hunger + 10)
      energy = clamp(energy - 5)
      if (npc.budget_ron > 6000) {
        mood = clamp(mood + 10)
        events.push({ type: 'MOOD_CHANGE', description: 'Siguranță financiară — dimineață pozitivă' })
      }
      break
    case 'WORK':
      energy = clamp(energy - 20)
      hunger = clamp(hunger + 20)
      if (npc.budget_ron < 1500) {
        mood = clamp(mood - 15)
        events.push({ type: 'MOOD_CHANGE', description: 'Stres financiar — griji legate de bani la muncă' })
      } else {
        mood = clamp(mood - 5)
      }
      social = clamp(social + 10)
      break
    case 'LUNCH':
      energy = clamp(energy + 10)
      hunger = clamp(hunger - 40)
      mood = clamp(mood + 5)
      break
    case 'AFTERNOON':
      energy = clamp(energy - 15)
      hunger = clamp(hunger + 15)
      break
    case 'COMMUTE':
      energy = clamp(energy - 10)
      hunger = clamp(hunger + 10)
      mood = clamp(mood - 5)
      break
    case 'EVENING':
      hunger = clamp(hunger - 20)
      energy = clamp(energy + 5)
      if (npc.budget_ron < 1500) {
        mood = clamp(mood - 5)
        social = clamp(social - 10)
        events.push({ type: 'ACTIVITY', description: 'Stă acasă din lipsă de resurse financiare' })
      } else if (npc.budget_ron > 6000) {
        mood = clamp(mood + 15)
        social = clamp(social + 20)
        events.push({ type: 'ACTIVITY', description: 'Seară activă în oraș cu activități sociale' })
      } else {
        social = clamp(social + 5)
      }
      break
    case 'NIGHT':
      energy = clamp(energy - 5)
      hunger = clamp(hunger + 10)
      break
  }

  return { energy, hunger, mood, social, events }
}

function tryGenerateInteraction(
  npc: NPC,
  stage: DayStage,
  allNPCs: NPC[],
  currentDay: number,
): SimEvent | null {
  if (npc.friends.length === 0) return null
  if (Math.random() > 0.3) return null

  const friendId = npc.friends[Math.floor(Math.random() * npc.friends.length)]
  const friend = allNPCs.find((n) => n.id === friendId)
  if (!friend) return null

  const sameCity = friend.city === npc.city
  const interactionType = sameCity
    ? ['întâlnire', 'cafea împreună', 'prânz împreună'][Math.floor(Math.random() * 3)]
    : ['apel telefonic', 'mesaj', 'video call'][Math.floor(Math.random() * 3)]

  const description = sameCity
    ? `S-a ${interactionType} cu ${friend.name} în ${npc.city}`
    : `A avut un ${interactionType} cu ${friend.name} din ${friend.city}`

  return {
    type: 'INTERACTION',
    description,
    involvedNPCs: [npc.id, friend.id],
  }
}

export async function computeNextState(
  npc: NPC,
  stage: DayStage,
  day: number,
  allNPCs: NPC[],
): Promise<NPCState> {
  const prev = getNewestState(npc.id)

  let baseEnergy = npc.base_energy
  let baseMood = 70
  let baseHunger = 30
  let baseSocial = npc.base_social

  if (!prev) {
    if (stage === 'WAKE_UP' && day === 1) {
      return {
        npcId: npc.id,
        stage,
        day,
        energy: baseEnergy,
        hunger: baseHunger,
        mood: baseMood,
        social: baseSocial,
        location: STAGE_LOCATIONS[stage](npc),
        activity: STAGE_ACTIVITIES[stage](npc),
        events: [],
      }
    }
  }

  const stats = prev
    ? applyStageStats(prev, stage, npc)
    : { energy: baseEnergy, hunger: baseHunger, mood: baseMood, social: baseSocial, events: [] }

  const interaction = tryGenerateInteraction(npc, stage, allNPCs, day)
  if (interaction) {
    stats.events.push(interaction)
    stats.social = clamp(stats.social + 10)
    stats.mood = clamp(stats.mood + 5)
  }

  stats.events.push({
    type: 'ACTIVITY',
    description: STAGE_ACTIVITIES[stage](npc),
  })

  return {
    npcId: npc.id,
    stage,
    day,
    energy: stats.energy,
    hunger: stats.hunger,
    mood: stats.mood,
    social: stats.social,
    location: STAGE_LOCATIONS[stage](npc),
    activity: STAGE_ACTIVITIES[stage](npc),
    events: stats.events,
  }
}

export async function saveDailySummary(npcId: string, day: number) {
  const database = await getDb()
  const states = getLastDayStates(npcId)
  if (states.length === 0) return

  const finalState = states[states.length - 1]
  const allEvents = states.flatMap((s) => s.events)

  database.run(
    `INSERT OR REPLACE INTO daily_summaries (npc_id, day, final_state, all_events, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [npcId, day, JSON.stringify(finalState), JSON.stringify(allEvents), Date.now()]
  )
  persistDb()
}

export async function loadYesterdayState(
  npc: NPC,
  yesterday: number,
): Promise<NPCState | null> {
  const database = await getDb()
  const result = database.exec(
    `SELECT final_state FROM daily_summaries WHERE npc_id = ? AND day = ?`,
    [npc.id, yesterday]
  )
  if (!result[0]?.values[0]?.[0]) return null
  return JSON.parse(result[0].values[0][0] as string) as NPCState
}

export async function initializeNewDay(
  npc: NPC,
  day: number,
  allNPCs: NPC[],
): Promise<NPCState> {
  clearNPCStates(npc.id)

  const yesterday = await loadYesterdayState(npc, day - 1)

  let energy: number
  let hunger: number
  let mood: number
  let social: number

  if (yesterday) {
    energy = clamp(yesterday.energy + 40)
    hunger = 60
    mood = clamp(yesterday.mood + 20)
    social = npc.base_social
    if (npc.budget_ron > 6000) mood = clamp(mood + 5)
  } else {
    energy = npc.base_energy
    hunger = 30
    mood = 70
    social = npc.base_social
  }

  const state: NPCState = {
    npcId: npc.id,
    stage: 'WAKE_UP',
    day,
    energy,
    hunger,
    mood,
    social,
    location: STAGE_LOCATIONS.WAKE_UP(npc),
    activity: STAGE_ACTIVITIES.WAKE_UP(npc),
    events: [],
  }

  setInitialState(state)
  return state
}

export async function advanceAllNPCsToStage(
  stage: DayStage,
  day: number,
): Promise<void> {
  const database = await getDb()
  const npcs = getAllNPCs(database)

  for (const npc of npcs) {
    const state = await computeNextState(npc, stage, day, npcs)
    if (stage === 'WAKE_UP') {
      setInitialState(state)
    } else {
      pushState(state)
    }

    if (stage === 'NIGHT') {
      await saveDailySummary(npc.id, day)
    }
  }
}

export async function startFreshDay(day: number): Promise<void> {
  const database = await getDb()
  const npcs = getAllNPCs(database)
  for (const npc of npcs) {
    await initializeNewDay(npc, day, npcs)
  }
}
