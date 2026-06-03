import { NPCState, SimEvent, DayStage } from '@/types'

declare global {
  // eslint-disable-next-line no-var
  var __stateMap: Map<string, NPCState[]> | undefined
}

function getStateMap(): Map<string, NPCState[]> {
  if (!global.__stateMap) {
    global.__stateMap = new Map()
  }
  return global.__stateMap
}

export function getNewestState(npcId: string): NPCState | undefined {
  const states = getStateMap().get(npcId)
  if (!states || states.length === 0) return undefined
  return states[states.length - 1]
}

export function getAllCurrentStates(): Map<string, NPCState> {
  const result = new Map<string, NPCState>()
  const entries = Array.from(getStateMap().entries())
  for (const [id, states] of entries) {
    if (states.length > 0) {
      result.set(id, states[states.length - 1])
    }
  }
  return result
}

// Keep only last 16 states per NPC (covers ~6 min at 22s/stage)
// Without this cap the map grows indefinitely → server memory leak
const MAX_HISTORY = 16

export function pushState(state: NPCState) {
  const map = getStateMap()
  if (!map.has(state.npcId)) map.set(state.npcId, [])
  const arr = map.get(state.npcId)!
  arr.push(state)
  if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY)
}

export function getRecentEvents(npcId: string, count = 5): SimEvent[] {
  const states = getStateMap().get(npcId) || []
  const all: SimEvent[] = states.flatMap((s) => s.events)
  return all.slice(-count)
}

export function clearNPCStates(npcId: string) {
  getStateMap().set(npcId, [])
}

export function getLastDayStates(npcId: string): NPCState[] {
  return getStateMap().get(npcId) || []
}

export function setInitialState(state: NPCState) {
  const map = getStateMap()
  map.set(state.npcId, [state])
}

export function getActiveInteractions(): Set<string> {
  const interacting = new Set<string>()
  const values = Array.from(getStateMap().values())
  for (const states of values) {
    const latest = states[states.length - 1]
    if (!latest) continue
    for (const evt of latest.events) {
      if (evt.type === 'INTERACTION' && evt.involvedNPCs) {
        evt.involvedNPCs.forEach((npcId: string) => interacting.add(npcId))
      }
    }
  }
  return interacting
}

export function getStageHistory(npcId: string): DayStage[] {
  return (getStateMap().get(npcId) || []).map((s) => s.stage)
}
