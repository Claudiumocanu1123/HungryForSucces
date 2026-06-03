import { NextResponse } from 'next/server'
import { initSimulation, getSimulationState, pauseSimulation, resumeSimulation, isSimulationPaused } from '@/lib/simulationClock'

let initialized = false

export async function GET() {
  if (!initialized) {
    initialized = true
    await initSimulation()
  }
  const state = getSimulationState()
  return NextResponse.json({ ...state, paused: isSimulationPaused() })
}

export async function POST(req: Request) {
  const { action } = await req.json()
  if (action === 'pause') pauseSimulation()
  else if (action === 'resume') { if (!initialized) { initialized = true; await initSimulation() } resumeSimulation() }
  else if (action === 'clearStories') {
    // Clear cached stories so they regenerate with the fixed SSE parser
    const { getDb, persistDb } = await import('@/lib/db')
    const database = await getDb()
    database.run('DELETE FROM generated_stories')
    database.run('DELETE FROM llm_queue')
    persistDb()
  }
  return NextResponse.json({ paused: isSimulationPaused() })
}
