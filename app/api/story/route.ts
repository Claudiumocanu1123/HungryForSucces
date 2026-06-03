import { NextRequest, NextResponse } from 'next/server'
import { getDb, persistDb } from '@/lib/db'
import { getRecentEvents, getNewestState } from '@/lib/stateManager'
import { NPC, SimEvent, STAGE_TIMES } from '@/types'

function formatTodayEvents(events: SimEvent[]): string {
  const last5 = events.slice(-5)
  if (last5.length === 0) return 'Zi liniștită până acum.'
  return last5.map((e) => `- ${e.description}`).join('\n')
}

function formatYesterdayActivity(
  finalState: { activity: string } | null,
  allEvents: SimEvent[]
): string {
  if (!finalState) return 'Prima zi.'
  const last2 = allEvents.slice(-2).map((e) => e.description)
  const parts = [finalState.activity, ...last2].filter(Boolean)
  return parts.join('. ') + '.'
}

const STAGE_RO: Record<string, string> = {
  WAKE_UP:   'Dimineață devreme (acasă)',
  MORNING:   'Drum spre serviciu',
  WORK:      'La serviciu',
  LUNCH:     'Pauza de prânz',
  AFTERNOON: 'După-amiaza la serviciu',
  COMMUTE:   'Drum spre casă',
  EVENING:   'Seara',
  NIGHT:     'Noapte (acasă)',
}

export async function POST(req: NextRequest) {
  const { npcId, day, stage } = await req.json()
  const database = await getDb()

  // ── Load NPC ──────────────────────────────────────────────────────────────
  const npcResult = database.exec('SELECT * FROM npcs WHERE id=?', [npcId])
  if (!npcResult[0]?.values[0]) {
    return NextResponse.json({ error: 'NPC not found' }, { status: 404 })
  }
  const cols = npcResult[0].columns
  const row  = npcResult[0].values[0]
  const rawNpc: Record<string, unknown> = {}
  cols.forEach((c, i) => { rawNpc[c] = row[i] })
  const npc: NPC = {
    ...rawNpc,
    traits:  JSON.parse(rawNpc.traits  as string || '[]'),
    friends: JSON.parse(rawNpc.friends as string || '[]'),
  } as NPC

  // ── Serve from cache ──────────────────────────────────────────────────────
  const cached = database.exec(
    'SELECT story_text FROM generated_stories WHERE npc_id=? AND day=? AND stage=?',
    [npcId, day, stage]
  )
  if (cached[0]?.values[0]?.[0]) {
    return NextResponse.json({ text: cached[0].values[0][0] as string })
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const yesterdayResult = database.exec(
    'SELECT final_state, all_events FROM daily_summaries WHERE npc_id=? AND day=?',
    [npcId, day - 1]
  )
  let yesterdayActivity = 'Prima zi.'
  if (yesterdayResult[0]?.values[0]) {
    const finalState = JSON.parse(yesterdayResult[0].values[0][0] as string)
    const allEvents  = JSON.parse(yesterdayResult[0].values[0][1] as string || '[]')
    yesterdayActivity = formatYesterdayActivity(finalState, allEvents)
  }

  const recentEvents   = getRecentEvents(npcId, 5)
  const todayEvents    = formatTodayEvents(recentEvents)
  const currentState   = getNewestState(npcId)
  const simTime        = STAGE_TIMES[stage as keyof typeof STAGE_TIMES] || '??:??'
  const stageRo        = STAGE_RO[stage] ?? stage

  const userPrompt = `Personaj: ${npc.name}, ${npc.age} ani, ${npc.profession}, ${npc.city}.
Trăsături: ${npc.traits.join(', ')}.
Budget lunar: ${npc.budget_ron} RON.

Ziua ${day}, ora ${simTime} — ${stageRo}.

Context de ieri: ${yesterdayActivity}

Azi până acum:
${todayEvents}

Stare actuală: energie ${currentState?.energy ?? 70}%, dispoziție ${currentState?.mood ?? 70}%, foame ${currentState?.hunger ?? 30}%, locație: ${currentState?.location ?? npc.city}.

Naratează în 3-4 propoziții scurte ce face personajul în acest moment.`

  // ── Call OpenRouter (non-streaming) ──────────────────────────────────────
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'LifeSim',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        max_tokens: 200,
        temperature: 0.8,
        stream: false,
        messages: [
          { role: 'system', content: npc.system_prompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ error: `OpenRouter ${response.status}: ${errText}` }, { status: 502 })
    }

    const data = await response.json()
    const text: string = data?.choices?.[0]?.message?.content ?? ''

    if (!text) {
      return NextResponse.json({ error: 'Răspuns gol de la AI' }, { status: 502 })
    }

    // ── Cache it ──────────────────────────────────────────────────────────
    database.run(
      `INSERT OR REPLACE INTO generated_stories (npc_id, day, stage, story_text, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [npcId, day, stage, text, Date.now()]
    )
    persistDb()

    return NextResponse.json({ text })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
