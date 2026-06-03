'use client'

import React, { useEffect, useRef, useState } from 'react'
import { NPCWithState, DayStage } from '@/types'
import { T, moodColor as getMoodColor } from '@/lib/theme'

const DICE_BASE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='

interface DetailPanelProps {
  npc: NPCWithState | null
  day: number
  stage: DayStage
  onClose: () => void
  allNpcs?: NPCWithState[]
}

const NPC_GRADIENTS: Record<string, [string, string]> = {
  elena:    ['#a29bfe', '#6c5ce7'],
  mihai:    ['#fd79a8', '#d63031'],
  ana:      ['#00cec9', '#0984e3'],
  bogdan:   ['#00b894', '#55efc4'],
  maria:    ['#fdcb6e', '#e17055'],
  andrei:   ['#e17055', '#d63031'],
  cristina: ['#ffd700', '#fdcb6e'],
  radu:     ['#74b9ff', '#0984e3'],
  iulia:    ['#55efc4', '#00b894'],
  dan:      ['#a29bfe', '#fd79a8'],
}
function npcGradient(id: string): [string, string] {
  return NPC_GRADIENTS[id] || ['#00d4ff', '#0084ff']
}

function getMoodEmoji(mood: number) {
  if (mood > 70) return '😊'
  if (mood >= 40) return '😐'
  return '😔'
}

function getBudgetInfo(budget: number) {
  if (budget < 1500) return { label: 'Buget mic', color: T.bad }
  if (budget <= 6000) return { label: 'Buget mediu', color: T.warn }
  return { label: 'Buget mare', color: T.good }
}

function AnimatedBar({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(value), 60 + delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return (
    <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${w}%`,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: 3,
        transition: 'width 1.4s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: `0 0 6px ${color}55`,
      }} />
    </div>
  )
}

function StatRow({ icon, label, value, color, delay }: { icon: string; label: string; value: number; color: string; delay?: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11 }}>{icon}</span>
          <span style={{ fontSize: 11, color: T.textSoft }}>{label}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(value)}%
        </span>
      </div>
      <AnimatedBar value={value} color={color} delay={delay} />
    </div>
  )
}

export default React.memo(function DetailPanel({ npc, day, stage, onClose, allNpcs = [] }: DetailPanelProps) {
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const prevKeyRef = useRef('')
  const storyEndRef = useRef<HTMLDivElement>(null)
  const typeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!npc) return
    const key = `${npc.id}-${day}-${stage}`
    if (key === prevKeyRef.current) return
    prevKeyRef.current = key

    // Cancel any in-progress fetch or typing animation
    if (abortRef.current) abortRef.current.abort()
    if (typeIntervalRef.current) clearInterval(typeIntervalRef.current)
    abortRef.current = new AbortController()
    setStory('')
    setLoading(true)
    const ctrl = abortRef.current

    ;(async () => {
      try {
        // Simple JSON fetch — no SSE streaming, no complex parsing.
        // Server returns { text: "..." } or { error: "..." }.
        const res = await fetch('/api/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npcId: npc.id, day, stage }),
          signal: ctrl.signal,
        })

        if (!res.ok) {
          setStory('[Eroare la generarea poveștii]')
          return
        }

        const { text, error } = await res.json()
        if (error || !text) {
          setStory(error ?? '[Răspuns gol]')
          return
        }

        // Typing animation — runs entirely client-side, no streaming bugs possible
        let i = 0
        setStory('')
        typeIntervalRef.current = setInterval(() => {
          i++
          setStory(text.slice(0, i))
          if (i >= text.length) {
            if (typeIntervalRef.current) clearInterval(typeIntervalRef.current)
            typeIntervalRef.current = null
          }
        }, 18)

      } catch (e: unknown) {
        if ((e as Error).name !== 'AbortError') {
          setStory('[Eroare de rețea]')
        }
      } finally {
        setLoading(false)
      }
    })()

    return () => {
      ctrl.abort()
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current)
    }
  }, [npc?.id, day, stage])

  // Auto-scroll story
  useEffect(() => {
    storyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [story])

  if (!npc) return null

  const state = npc.currentState
  const [g1, g2] = npcGradient(npc.id)
  const budget = getBudgetInfo(npc.budget_ron)
  const moodColor = getMoodColor(state?.mood ?? 70)
  const firstName = npc.name.split(' ')[0]
  const avatarUrl = `${DICE_BASE}${encodeURIComponent(firstName)}`

  // Resolve friend names
  const friends = npc.friends
    .map((fid) => allNpcs.find((n) => n.id === fid))
    .filter(Boolean) as NPCWithState[]

  const recentEvents = (state?.events ?? []).slice(-10).reverse()

  return (
    <div style={{
      width: 300,
      flexShrink: 0,
      background: T.panelSolid,
      borderLeft: `1px solid ${T.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(91,91,245,0.15) transparent' }}>

        {/* ── Hero: Avatar + Identity ── */}
        <div style={{
          padding: '16px 14px 12px',
          background: `linear-gradient(160deg, ${g1}1f 0%, transparent 65%)`,
          borderBottom: `1px solid ${T.borderSoft}`,
          position: 'relative',
        }}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
              color: T.textFaint, borderRadius: 7,
              width: 26, height: 26, cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
              ;(e.currentTarget as HTMLButtonElement).style.color = T.text
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'
              ;(e.currentTarget as HTMLButtonElement).style.color = T.textFaint
            }}
          >✕</button>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {/* DiceBear Avatar */}
            <div style={{
              width: 68, height: 68, borderRadius: 16, overflow: 'hidden', flexShrink: 0,
              border: `2.5px solid ${g1}`,
              boxShadow: `0 4px 20px ${g1}44`,
              background: '#0d1230',
            }}>
              <img
                src={avatarUrl}
                alt={firstName}
                style={{ width: '100%', height: '100%', display: 'block' }}
                loading="eager"
              />
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, lineHeight: 1.1, marginBottom: 3 }}>
                {npc.name}
              </div>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, marginBottom: 2 }}>
                {npc.profession}
              </div>
              <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6 }}>
                📍 {npc.city} · {npc.age} ani
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 16 }}>{getMoodEmoji(state?.mood ?? 70)}</span>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${state?.mood ?? 70}%`, background: moodColor, borderRadius: 2, transition: 'width 1.5s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Traits + Budget */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
            {npc.traits.map((t) => (
              <span key={t} style={{
                fontSize: 9, padding: '2px 7px', borderRadius: 20,
                background: T.accentSoft, color: T.accent, border: `1px solid ${T.borderAccent}`,
              }}>{t}</span>
            ))}
            <span style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700,
              background: `${budget.color}1f`, color: budget.color, border: `1px solid ${budget.color}55`,
            }}>
              {budget.label} · {npc.budget_ron.toLocaleString('ro-RO')} RON
            </span>
          </div>
        </div>

        {/* ── Current status ── */}
        {state && (
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderSoft}` }}>
            {/* Activity card */}
            <div style={{
              background: T.accentSofter, border: `1px solid ${T.borderAccent}`,
              borderRadius: 9, padding: '8px 10px', marginBottom: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, marginBottom: 2 }}>
                {state.activity}
              </div>
              <div style={{ fontSize: 10, color: T.textFaint }}>📍 {state.location}</div>
            </div>

            <StatRow icon="⚡" label="Energie"    value={state.energy} color={T.accent} delay={0} />
            <StatRow icon="😊" label="Dispoziție" value={state.mood}   color={moodColor} delay={80} />
            <StatRow icon="🍽️" label="Foame"      value={state.hunger} color={T.warn} delay={160} />
            <StatRow icon="👥" label="Social"     value={state.social} color={T.good} delay={240} />
          </div>
        )}

        {/* ── Relationships ── */}
        {friends.length > 0 && (
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderSoft}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Relații
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {friends.map((friend) => {
                const fMood = friend.currentState?.mood ?? 70
                const fColor = getMoodColor(fMood)
                const fFirstName = friend.name.split(' ')[0]
                return (
                  <div key={friend.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', borderRadius: 8,
                    background: T.panelHover, border: `1px solid ${T.border}`,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', overflow: 'hidden',
                      border: `1.5px solid ${fColor}88`, background: '#0d1230', flexShrink: 0,
                    }}>
                      <img src={`${DICE_BASE}${encodeURIComponent(fFirstName)}`} alt={fFirstName}
                        style={{ width: '100%', height: '100%', display: 'block' }} loading="lazy" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T.text, lineHeight: 1 }}>{fFirstName}</div>
                      <div style={{ fontSize: 9, color: T.textFaint, lineHeight: 1.2 }}>{friend.profession}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── AI Story ── */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Povestea lui {firstName}
            </span>
            {loading && (
              <span style={{ display: 'inline-flex', gap: 3 }}>
                {[0, 120, 240].map((d) => (
                  <span key={d} style={{
                    width: 3, height: 3, borderRadius: '50%', background: T.accent,
                    display: 'inline-block',
                    animation: `dpBounce 0.8s ease-in-out ${d}ms infinite`,
                  }} />
                ))}
              </span>
            )}
          </div>

          <div style={{
            background: T.accentSofter, border: `1px solid ${T.border}`,
            borderRadius: '4px 12px 12px 12px', padding: '10px 12px', minHeight: 64,
          }}>
            {story ? (
              <p style={{ fontSize: 12, color: T.text, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
                {story}
                {loading && <span style={{ opacity: 0.5, marginLeft: 1, color: T.accent }}>▌</span>}
              </p>
            ) : loading ? (
              <p style={{ fontSize: 12, color: T.textGhost, fontStyle: 'italic', margin: 0 }}>
                Se generează povestea...
              </p>
            ) : (
              <p style={{ fontSize: 12, color: T.textGhost, fontStyle: 'italic', margin: 0 }}>
                Nicio poveste generată.
              </p>
            )}
            <div ref={storyEndRef} />
          </div>
        </div>

        {/* ── Recent events ── */}
        {recentEvents.length > 0 && (
          <div style={{ padding: '10px 14px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Evenimente recente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {recentEvents.map((evt, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, flexShrink: 0, marginTop: 1, color: evt.type === 'INTERACTION' ? T.good : evt.type === 'MOOD_CHANGE' ? T.warn : T.accent }}>
                    {evt.type === 'INTERACTION' ? '🤝' : evt.type === 'MOOD_CHANGE' ? '💭' : '▸'}
                  </span>
                  <span style={{ fontSize: 11, color: T.textSoft, lineHeight: 1.4 }}>
                    {evt.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes dpBounce {
          0%,100%{transform:translateY(0);} 50%{transform:translateY(-4px);}
        }
      `}</style>
    </div>
  )
})
