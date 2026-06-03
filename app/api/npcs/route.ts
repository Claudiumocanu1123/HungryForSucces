import { NextRequest, NextResponse } from 'next/server'
import { getDb, persistDb } from '@/lib/db'
import { getAllNPCs } from '@/lib/seed'
import { getAllCurrentStates } from '@/lib/stateManager'
import { initSimulation } from '@/lib/simulationClock'

let initialized = false

export async function GET() {
  if (!initialized) {
    initialized = true
    await initSimulation()
  }

  const database = await getDb()
  const npcs = getAllNPCs(database)
  const states = getAllCurrentStates()

  const result = npcs.map((npc) => ({
    ...npc,
    currentState: states.get(npc.id),
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const database = await getDb()

  const {
    id, name, profession, age, city, lat, lng,
    traits, friends, base_energy = 75, base_social = 50,
    budget_ron = 3000, system_prompt,
  } = body

  const npcId = id || name.toLowerCase().replace(/\s+/g, '_')

  database.run(
    `INSERT INTO npcs (id, name, profession, age, city, lat, lng, traits, friends, base_energy, base_social, budget_ron, system_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      npcId, name, profession, age, city, lat, lng,
      JSON.stringify(traits), JSON.stringify(friends),
      base_energy, base_social, budget_ron, system_prompt,
    ]
  )
  persistDb()

  return NextResponse.json({ success: true, id: npcId })
}
