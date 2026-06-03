export type DayStage =
  | 'WAKE_UP'
  | 'MORNING'
  | 'WORK'
  | 'LUNCH'
  | 'AFTERNOON'
  | 'COMMUTE'
  | 'EVENING'
  | 'NIGHT'

export interface SimEvent {
  type: 'INTERACTION' | 'ACTIVITY' | 'MOOD_CHANGE'
  description: string
  involvedNPCs?: string[]
}

export interface NPCState {
  npcId: string
  stage: DayStage
  day: number
  energy: number
  hunger: number
  mood: number
  social: number
  location: string
  activity: string
  events: SimEvent[]
}

export interface NPC {
  id: string
  name: string
  profession: string
  age: number
  city: string
  lat: number
  lng: number
  traits: string[]
  friends: string[]
  base_energy: number
  base_social: number
  budget_ron: number
  system_prompt: string
}

export interface NPCWithState extends NPC {
  currentState?: NPCState
}

export const STAGES: DayStage[] = [
  'WAKE_UP', 'MORNING', 'WORK', 'LUNCH',
  'AFTERNOON', 'COMMUTE', 'EVENING', 'NIGHT'
]

export const STAGE_TIMES: Record<DayStage, string> = {
  WAKE_UP: '06:00',
  MORNING: '08:00',
  WORK: '10:00',
  LUNCH: '13:00',
  AFTERNOON: '15:00',
  COMMUTE: '18:00',
  EVENING: '20:00',
  NIGHT: '23:00',
}
