import { DayStage, STAGES } from '@/types'
import { advanceAllNPCsToStage, startFreshDay } from './simulationEngine'
import { getDb } from './db'
import { seedNPCs } from './seed'

const STAGE_DURATION_MS = 20_000
const MAX_DAYS = 7

export interface SimulationState {
  day: number
  stage: DayStage
  stageIndex: number
  progress: number
  startedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __simState: SimulationState | undefined
  // eslint-disable-next-line no-var
  var __simTimer: ReturnType<typeof setInterval> | undefined
  // eslint-disable-next-line no-var
  var __simInitialized: boolean | undefined
  // eslint-disable-next-line no-var
  var __simPaused: boolean | undefined
}

export function pauseSimulation() {
  global.__simPaused = true
  if (global.__simTimer) { clearInterval(global.__simTimer); global.__simTimer = undefined }
}

export function resumeSimulation() {
  if (!global.__simPaused) return
  global.__simPaused = false
  global.__simTimer = setInterval(() => { tick().catch(console.error) }, 1000)
}

export function isSimulationPaused() { return global.__simPaused === true }

export function getSimulationState(): SimulationState {
  if (!global.__simState) {
    global.__simState = {
      day: 1,
      stage: 'WAKE_UP',
      stageIndex: 0,
      progress: 0,
      startedAt: Date.now(),
    }
  }
  const elapsed = Date.now() - global.__simState.startedAt
  global.__simState.progress = Math.min(elapsed / STAGE_DURATION_MS, 1)
  return global.__simState
}

async function tick() {
  const state = getSimulationState()
  const now = Date.now()
  const elapsed = now - state.startedAt

  if (elapsed < STAGE_DURATION_MS) return

  const nextStageIndex = state.stageIndex + 1

  if (nextStageIndex >= STAGES.length) {
    const nextDay = state.day >= MAX_DAYS ? 1 : state.day + 1
    global.__simState = {
      day: nextDay,
      stage: 'WAKE_UP',
      stageIndex: 0,
      progress: 0,
      startedAt: Date.now(),
    }
    await startFreshDay(nextDay)
  } else {
    const nextStage = STAGES[nextStageIndex]
    global.__simState = {
      day: state.day,
      stage: nextStage,
      stageIndex: nextStageIndex,
      progress: 0,
      startedAt: Date.now(),
    }
    await advanceAllNPCsToStage(nextStage, state.day)
  }
}

export async function initSimulation() {
  if (global.__simInitialized) return
  global.__simInitialized = true

  await getDb()
  await seedNPCs()

  const state = getSimulationState()
  await startFreshDay(state.day)

  if (global.__simTimer) clearInterval(global.__simTimer)
  global.__simTimer = setInterval(() => {
    tick().catch(console.error)
  }, 1000)
}
