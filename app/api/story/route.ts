import { NextRequest, NextResponse } from 'next/server'
import { getDb, persistDb } from '@/lib/db'
import { getRecentEvents, getNewestState } from '@/lib/stateManager'
import { NPC, SimEvent, STAGE_TIMES } from '@/types'

// ── Request deduplication ─────────────────────────────────────────────────────
// If two users click on Elena at the same time, only ONE LLM call is made.
// The second request awaits the same Promise and gets the same result.
const pendingRequests = new Map<string, Promise<string>>()

function requestKey(npcId: string, day: number, stage: string) {
  return `${npcId}:${day}:${stage}`
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Core LLM call — extracted so it can be shared by deduplication ────────────
async function generateStory(npc: NPC, userPrompt: string): Promise<string> {
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
    throw new Error(`OpenRouter ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('Răspuns gol de la AI')
  return text
}

// ── POST /api/story ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { npcId, day, stage } = await req.json()
  const database = await getDb()

  // ── 1. Load NPC ─────────────────────────────────────────────────────────────
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

  // ── 2. Serve from DB cache (same story for all users) ───────────────────────
  const cached = database.exec(
    'SELECT story_text FROM generated_stories WHERE npc_id=? AND day=? AND stage=?',
    [npcId, day, stage]
  )
  if (cached[0]?.values[0]?.[0]) {
    return NextResponse.json({ text: cached[0].values[0][0] as string, cached: true })
  }

  // ── 3. Build prompt ─────────────────────────────────────────────────────────
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

  const recentEvents = getRecentEvents(npcId, 5)
  const todayEvents  = formatTodayEvents(recentEvents)
  const currentState = getNewestState(npcId)
  const simTime      = STAGE_TIMES[stage as keyof typeof STAGE_TIMES] || '??:??'
  const stageRo      = STAGE_RO[stage] ?? stage

  const userPrompt = `Personaj: ${npc.name}, ${npc.age} ani, ${npc.profession}, ${npc.city}.
Trăsături: ${npc.traits.join(', ')}.
Budget lunar: ${npc.budget_ron} RON.

Ziua ${day}, ora ${simTime} — ${stageRo}.

Context de ieri: ${yesterdayActivity}

Azi până acum:
${todayEvents}

Stare actuală: energie ${currentState?.energy ?? 70}%, dispoziție ${currentState?.mood ?? 70}%, foame ${currentState?.hunger ?? 30}%, locație: ${currentState?.location ?? npc.city}.

Naratează în 3-4 propoziții scurte ce face personajul în acest moment.`

  // ── 4. Deduplication: if same request already in flight, await it ───────────
  const key = requestKey(npcId, day, stage)

  if (pendingRequests.has(key)) {
    // Another user already triggered this exact request — wait for it
    try {
      const text = await pendingRequests.get(key)!
      return NextResponse.json({ text, deduplicated: true })
    } catch {
      // The original request failed — fall through to try again
    }
  }

  // ── 5. Mark as pending in DB queue ─────────────────────────────────────────
  try {
    database.run(
      `INSERT OR IGNORE INTO llm_queue (npc_id, day, stage, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      [npcId, day, stage, Date.now()]
    )
  } catch { /* ignore duplicate key */ }

  // ── 6. Launch LLM call and register promise for deduplication ───────────────
  const promise = generateStory(npc, userPrompt)
    .then(async (text) => {
      // Cache result in DB
      database.run(
        `INSERT OR REPLACE INTO generated_stories (npc_id, day, stage, story_text, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [npcId, day, stage, text, Date.now()]
      )
      // Mark queue entry as done
      database.run(
        `UPDATE llm_queue SET status='done' WHERE npc_id=? AND day=? AND stage=?`,
        [npcId, day, stage]
      )
      persistDb()
      return text
    })
    .catch((err) => {
      // Mark queue entry as failed
      database.run(
        `UPDATE llm_queue SET status='failed' WHERE npc_id=? AND day=? AND stage=?`,
        [npcId, day, stage]
      )
      throw err
    })
    .finally(() => {
      // Always remove from pending map when done
      pendingRequests.delete(key)
    })

  pendingRequests.set(key, promise)

  // ── 7. Await and return ─────────────────────────────────────────────────────
  try {
    const text = await promise
    return NextResponse.json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Fallback text so user never sees a raw error
    const fallback = `${npc.name} continuă ziua în ${npc.city}. (Detalii temporar indisponibile.)`
    return NextResponse.json({ text: fallback, error: msg })
  }
}
