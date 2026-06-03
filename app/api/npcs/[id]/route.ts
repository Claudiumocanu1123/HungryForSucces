import { NextRequest, NextResponse } from 'next/server'
import { getDb, persistDb } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const database = await getDb()

  const {
    name, profession, age, city, lat, lng,
    traits, friends, base_energy, base_social, budget_ron, system_prompt,
  } = body

  database.run(
    `UPDATE npcs SET name=?, profession=?, age=?, city=?, lat=?, lng=?,
     traits=?, friends=?, base_energy=?, base_social=?, budget_ron=?, system_prompt=?
     WHERE id=?`,
    [
      name, profession, age, city, lat, lng,
      JSON.stringify(traits), JSON.stringify(friends),
      base_energy, base_social, budget_ron, system_prompt,
      params.id,
    ]
  )
  persistDb()

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const database = await getDb()
  database.run('DELETE FROM npcs WHERE id=?', [params.id])
  persistDb()
  return NextResponse.json({ success: true })
}
