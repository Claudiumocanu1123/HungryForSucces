'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { NPCWithState, DayStage, STAGE_TIMES, STAGES } from '@/types'
import { T, moodColor } from '@/lib/theme'

const STAGE_DURATION_MS = 20_000  // keep in sync with simulationClock.ts

export interface FeedEvent {
  id: string
  time: string
  text: string
  npcId: string
  type: 'INTERACTION' | 'ACTIVITY' | 'MOOD_CHANGE'
}

interface WorldFeedProps {
  events: FeedEvent[]
  day: number
  stage: DayStage
  stageIndex: number
  startedAt: number
  npcs: NPCWithState[]
  onSelectNpc: (npcId: string) => void
}

const TYPE_COLOR: Record<string, string> = {
  INTERACTION: T.good,
  ACTIVITY: T.accent,
  MOOD_CHANGE: T.warn,
}
const TYPE_ICON: Record<string, string> = {
  INTERACTION: '🤝',
  ACTIVITY: '▸',
  MOOD_CHANGE: '💭',
}

const DICE_BASE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='

// Generate day headlines from recent events
function buildHeadlines(events: FeedEvent[], npcIds: Set<string>): string[] {
  const lines: string[] = []
  let interactions = 0, moods = 0
  for (const e of events) {
    if (lines.length >= 4) break
    if (e.type === 'INTERACTION' && interactions < 3 && npcIds.has(e.npcId)) {
      lines.push(e.text); interactions++
    } else if (e.type === 'MOOD_CHANGE' && moods < 2) {
      lines.push(e.text); moods++
    }
  }
  return lines
}

export const WorldFeed = React.memo(function WorldFeed({
  events, day, stage, stageIndex, startedAt, npcs, onSelectNpc,
}: WorldFeedProps) {
  // Stage countdown — 1000ms interval is sufficient for a seconds display
  const [secondsLeft, setSecondsLeft] = useState(STAGE_DURATION_MS / 1000)
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, Math.ceil((STAGE_DURATION_MS - (Date.now() - startedAt)) / 1000))
      setSecondsLeft(remaining)
    }
    update()
    const t = setInterval(update, 1000)
    const onVisibility = () => { if (!document.hidden) update() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisibility) }
  }, [startedAt])

  const nextStage = STAGES[Math.min(stageIndex + 1, STAGES.length - 1)]
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  const knownRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const fresh = new Set<string>()
    for (const e of events) {
      if (!knownRef.current.has(e.id)) fresh.add(e.id)
    }
    // Rebuild known set in-place to avoid allocation when nothing changed
    knownRef.current = new Set(events.map((e) => e.id))
    if (fresh.size > 0) {
      setFreshIds(fresh)
      const t = setTimeout(() => setFreshIds(prev => prev.size > 0 ? new Set() : prev), 1400)
      return () => clearTimeout(t)
    }
  }, [events])

  // NPC lookup map for fast access in render
  const npcMap = useMemo(() => {
    const m = new Map<string, NPCWithState>()
    for (const n of npcs) m.set(n.id, n)
    return m
  }, [npcs])

  // Pass Set of known NPC ids — avoids passing full npcs array into buildHeadlines
  const npcIds = useMemo(() => new Set(npcs.map(n => n.id)), [npcs])
  const headlines = useMemo(() => buildHeadlines(events, npcIds), [events, npcIds])

  // Aggregate health metrics in a single pass
  const sysHealth = useMemo(() => {
    if (!npcs.length) return null
    let moodSum = 0, energySum = 0, stressed = 0, hungry = 0, count = 0
    for (const n of npcs) {
      const st = n.currentState
      if (!st) continue
      moodSum   += st.mood
      energySum += st.energy
      if (st.energy < 30 || st.mood < 25) stressed++
      if (st.hunger < 25) hungry++
      count++
    }
    let interactionCount = 0
    for (const e of events) { if (e.type === 'INTERACTION') interactionCount++ }
    return {
      avgMood:   Math.round(moodSum   / Math.max(count, 1)),
      avgEnergy: Math.round(energySum / Math.max(count, 1)),
      stressed, hungry, interactionCount,
    }
  }, [npcs, events])

  // Top 4 NPCs by "interestingness" score
  const spotlightNPCs = useMemo(() => {
    if (npcs.length <= 4) return npcs
    const scored = npcs.map(n => ({
      npc: n,
      score: n.currentState ? (100 - (n.currentState.mood + n.currentState.energy) / 2) : 50,
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 4).map(s => s.npc)
  }, [npcs])

  return (
    <div style={{
      width: 260,
      flexShrink: 0,
      background: 'rgba(3,5,16,0.75)',
      borderLeft: `1px solid rgba(255,255,255,0.07)`,
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── System Health Widget ── */}
      {sysHealth && (
        <div style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${T.borderSoft}`,
          flexShrink: 0,
          background: 'rgba(91,91,245,0.04)',
        }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            ◉ Stare Populație
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {/* Avg Mood */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 7, color: T.textGhost, marginBottom: 2 }}>MOOd MED.</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: sysHealth.avgMood > 60 ? T.good : sysHealth.avgMood > 35 ? T.warn : T.bad, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {sysHealth.avgMood}
              </div>
              <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, marginTop: 3 }}>
                <div style={{ height: '100%', width: `${sysHealth.avgMood}%`, background: sysHealth.avgMood > 60 ? T.good : sysHealth.avgMood > 35 ? T.warn : T.bad, borderRadius: 1 }} />
              </div>
            </div>
            {/* Avg Energy */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 7, color: T.textGhost, marginBottom: 2 }}>ENERGIE</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: sysHealth.avgEnergy > 50 ? T.accent : T.warn, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {sysHealth.avgEnergy}
              </div>
              <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, marginTop: 3 }}>
                <div style={{ height: '100%', width: `${sysHealth.avgEnergy}%`, background: sysHealth.avgEnergy > 50 ? T.accent : T.warn, borderRadius: 1 }} />
              </div>
            </div>
            {/* Alerts */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 6px', border: `1px solid ${sysHealth.stressed > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
              <div style={{ fontSize: 7, color: T.textGhost, marginBottom: 2 }}>ALERTE</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: sysHealth.stressed > 0 ? T.bad : T.textFaint, lineHeight: 1 }}>
                {sysHealth.stressed > 0 ? `⚠️ ${sysHealth.stressed}` : '✓ OK'}
              </div>
              <div style={{ fontSize: 7, color: T.textGhost, marginTop: 3 }}>
                {sysHealth.interactionCount} activ
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stage countdown + micro-notifications ── */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${T.borderSoft}`,
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        {/* Countdown chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: secondsLeft <= 8 ? 'rgba(239,68,68,0.10)' : 'rgba(91,91,245,0.08)',
          border: `1px solid ${secondsLeft <= 8 ? 'rgba(239,68,68,0.35)' : 'rgba(91,91,245,0.25)'}`,
          borderRadius: 8, padding: '5px 9px',
        }}>
          <span style={{ fontSize: 14 }}>⏱️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: '0.05em' }}>URMEAZĂ</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nextStage.replace('_', ' ')} · {STAGE_TIMES[nextStage]}
            </div>
          </div>
          <div style={{
            fontSize: 14, fontWeight: 800,
            color: secondsLeft <= 8 ? T.bad : secondsLeft <= 15 ? T.warn : T.accent,
            fontVariantNumeric: 'tabular-nums', transition: 'color 0.3s',
          }}>
            {secondsLeft}s
          </div>
        </div>

        {/* Micro-notification chips from events */}
        {events.slice(0, 3).map((evt) => {
          const npc = npcMap.get(evt.npcId)  // O(1)
          const color = TYPE_COLOR[evt.type]
          const icon  = TYPE_ICON[evt.type]
          return (
            <div key={evt.id} onClick={() => onSelectNpc(evt.npcId)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: `${color}0d`, border: `1px solid ${color}30`,
              borderRadius: 7, padding: '4px 8px', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${color}18` }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${color}0d` }}
            >
              <span style={{ fontSize: 11 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color }}>
                  {npc?.name.split(' ')[0] ?? '?'}
                </span>
                <span style={{ fontSize: 9, color: T.textSoft, marginLeft: 4 }}>
                  {evt.text.length > 38 ? evt.text.slice(0, 38) + '…' : evt.text}
                </span>
              </div>
              <span style={{ fontSize: 8, color: T.textGhost, flexShrink: 0 }}>{evt.time}</span>
            </div>
          )
        })}
      </div>

      {/* ── Day Summary ── */}
      <div style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${T.borderSoft}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{ fontSize: 13 }}>📰</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, lineHeight: 1 }}>
              ZIUA {day}
            </div>
            <div style={{ fontSize: 8.5, color: T.textFaint, letterSpacing: '0.05em', marginTop: 1 }}>
              {STAGE_TIMES[stage]} · {stage.replace('_', ' ')}
            </div>
          </div>
        </div>

        {headlines.length === 0 ? (
          <div style={{ fontSize: 10, color: T.textGhost, fontStyle: 'italic' }}>
            Simularea se inițializează...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {headlines.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                <span style={{ color: T.accent, fontSize: 9, marginTop: 2, flexShrink: 0 }}>▸</span>
                <span style={{ fontSize: 10, color: T.textSoft, lineHeight: 1.4 }}>{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Spotlight NPCs ── */}
      {spotlightNPCs.length > 0 && (
        <div style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${T.borderSoft}`,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            În atenție acum
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {spotlightNPCs.map((npc) => {
              const mood   = npc.currentState?.mood   ?? 70
              const energy = npc.currentState?.energy ?? 70
              const mc     = moodColor(mood)
              const ec     = energy > 50 ? T.accent : energy > 25 ? T.warn : T.bad
              const firstName  = npc.name.split(' ')[0]
              const activity   = npc.currentState?.activity ?? '—'
              const isStressed = energy < 30 || mood < 25
              return (
                <button
                  key={npc.id}
                  onClick={() => onSelectNpc(npc.id)}
                  style={{
                    background: T.panelHover,
                    border: `1px solid ${isStressed ? T.bad + '44' : T.border}`,
                    borderRadius: 9, padding: '6px 7px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 3, cursor: 'pointer', textAlign: 'center',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = T.accentSoft }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = T.panelHover }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                      border: `2px solid ${mc}88`, background: '#0d1230',
                    }}>
                      <img src={`${DICE_BASE}${encodeURIComponent(firstName)}`} alt={firstName}
                        style={{ width: '100%', height: '100%', display: 'block' }} loading="lazy" />
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: mc, border: '1.5px solid #0d1230' }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.text, lineHeight: 1 }}>{firstName}</div>
                  <div style={{ fontSize: 8, color: T.textFaint, lineHeight: 1, marginBottom: 1 }}>{npc.profession}</div>
                  {/* Mini bars */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 6.5, opacity: 0.6 }}>😊</span>
                      <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }}>
                        <div style={{ height: '100%', width: `${mood}%`, background: mc, borderRadius: 1 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 6.5, opacity: 0.6 }}>⚡</span>
                      <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }}>
                        <div style={{ height: '100%', width: `${energy}%`, background: ec, borderRadius: 1 }} />
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 8.5, color: T.textSoft, lineHeight: 1.3,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                    textAlign: 'left', width: '100%',
                  }}>
                    {activity}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Live feed ── */}
      <div style={{
        padding: '7px 14px 5px',
        borderBottom: `1px solid ${T.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: T.good, display: 'inline-block',
          boxShadow: `0 0 6px ${T.good}`, animation: 'wfPulse 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Activitate Live
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(91,91,245,0.12) transparent' }}>
        {events.length === 0 && (
          <div style={{ padding: '16px 14px', color: T.textGhost, fontSize: 11, textAlign: 'center', fontStyle: 'italic' }}>
            Niciun eveniment încă
          </div>
        )}
        {events.slice(0, 30).map((evt) => {
          const isFresh = freshIds.has(evt.id)
          const color   = TYPE_COLOR[evt.type]
          const npc     = npcMap.get(evt.npcId)
          const firstName = npc?.name.split(' ')[0] ?? '?'
          return (
            <div
              key={evt.id}
              onClick={() => onSelectNpc(evt.npcId)}
              style={{
                padding: '5px 10px',
                display: 'flex', gap: 6, alignItems: 'flex-start',
                borderBottom: `1px solid ${T.borderSoft}`,
                borderLeft: isFresh ? `2px solid ${color}` : '2px solid transparent',
                background: isFresh ? `${color}10` : 'transparent',
                cursor: 'pointer',
                transition: 'border-color 0.5s, background 0.5s',
                animation: isFresh ? 'wfSlide 0.3s ease-out' : 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = T.panelHover }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = isFresh ? `${color}10` : 'transparent' }}
            >
              {/* Type icon badge */}
              <div style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: 5, marginTop: 1,
                background: `${color}20`, border: `1px solid ${color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 9 }}>{TYPE_ICON[evt.type]}</span>
              </div>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color, flexShrink: 0 }}>{firstName}</span>
                  <span style={{ fontSize: 8, color: T.textGhost, fontVariantNumeric: 'tabular-nums' }}>{evt.time}</span>
                  {isFresh && (
                    <span style={{ fontSize: 7, color, background: `${color}20`, padding: '0 3px', borderRadius: 3, flexShrink: 0 }}>NOU</span>
                  )}
                </div>
                <span style={{ fontSize: 10, color: T.textSoft, lineHeight: 1.35 }}>
                  {evt.text}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes wfPulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes wfSlide { from{transform:translateX(-6px);opacity:0;} to{transform:translateX(0);opacity:1;} }
      `}</style>
    </div>
  )
})
