'use client'

import React, { useMemo } from 'react'
import { NPCWithState } from '@/types'
import { T, moodColor as getMoodColor } from '@/lib/theme'

interface NPCRosterProps {
  npcs: NPCWithState[]
  selectedNpcId: string | null
  activeInteractions: Set<string>
  interactionPairs: Array<[string, string]>
  onSelectNpc: (npc: NPCWithState) => void
}

const DICE_BASE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='

function getEnergyColor(energy: number) {
  if (energy > 60) return T.accent
  if (energy > 30) return T.warn
  return T.bad
}

export const NPCRoster = React.memo(function NPCRoster({
  npcs, selectedNpcId, activeInteractions, interactionPairs, onSelectNpc,
}: NPCRosterProps) {
  // Build lookup map for fast partner name resolution
  const npcById = useMemo(() => {
    const m = new Map<string, NPCWithState>()
    for (const n of npcs) m.set(n.id, n)
    return m
  }, [npcs])

  // Map NPC id → partner first name — O(k) where k = interaction pairs (was O(k*n))
  const partnerMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const [id1, id2] of interactionPairs) {
      const n1 = npcById.get(id1)
      const n2 = npcById.get(id2)
      if (n1 && n2) {
        m[id1] = n2.name.split(' ')[0]
        m[id2] = n1.name.split(' ')[0]
      }
    }
    return m
  }, [interactionPairs, npcById])

  // Sort: interacting first, then selected, then by mood (struggling first = interesting)
  const sorted = useMemo(() => [...npcs].sort((a, b) => {
    const ai = activeInteractions.has(a.id) ? 0 : 1
    const bi = activeInteractions.has(b.id) ? 0 : 1
    if (ai !== bi) return ai - bi
    const as_ = a.id === selectedNpcId ? 0 : 1
    const bs_ = b.id === selectedNpcId ? 0 : 1
    if (as_ !== bs_) return as_ - bs_
    return (a.currentState?.mood ?? 70) - (b.currentState?.mood ?? 70)
  }), [npcs, activeInteractions, selectedNpcId])

  const interactingCount = activeInteractions.size
  const selectedCount = selectedNpcId ? 1 : 0

  return (
    <div style={{
      width: 200,
      flexShrink: 0,
      background: 'rgba(3,5,16,0.75)',
      borderRight: `1px solid rgba(255,255,255,0.07)`,
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: `1px solid ${T.borderSoft}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Personaje
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {interactingCount > 0 && (
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 4,
                background: 'rgba(16,185,129,0.12)', color: T.good,
                border: '1px solid rgba(16,185,129,0.3)',
              }}>
                {interactingCount} activi
              </span>
            )}
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 4,
              background: 'rgba(255,255,255,0.05)', color: T.textFaint,
            }}>
              {npcs.length}
            </span>
          </div>
        </div>
        {interactingCount > 0 && (
          <div style={{ fontSize: 10, color: T.good, marginTop: 3 }}>
            💬 {interactingCount} conversații active
          </div>
        )}
      </div>

      {/* NPC list */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(91,91,245,0.15) transparent' }}>
        {sorted.map((npc) => {
          const mood    = npc.currentState?.mood    ?? 70
          const energy  = npc.currentState?.energy  ?? 70
          const hunger  = npc.currentState?.hunger  ?? 50
          const social  = npc.currentState?.social  ?? 50
          const activity = npc.currentState?.activity ?? '—'
          const location = npc.currentState?.location ?? npc.city
          const moodC   = getMoodColor(mood)
          const energyC = getEnergyColor(energy)
          const isSelected    = npc.id === selectedNpcId
          const isInteracting = activeInteractions.has(npc.id)
          const isStressed    = energy < 30 || mood < 25
          const partner   = partnerMap[npc.id]
          const firstName = npc.name.split(' ')[0]
          const traits    = npc.traits?.slice(0, 2) ?? []

          return (
            <button
              key={npc.id}
              onClick={() => onSelectNpc(npc)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                background: isSelected ? T.accentSoft : isStressed ? 'rgba(239,68,68,0.04)' : 'transparent',
                borderLeft: `3px solid ${isSelected ? T.accent : isInteracting ? T.good : isStressed ? T.bad : 'transparent'}`,
                borderTop: 'none', borderRight: 'none',
                borderBottom: `1px solid ${T.borderSoft}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = T.panelHover
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background =
                  isStressed ? 'rgba(239,68,68,0.04)' : 'transparent'
              }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
                  border: `2px solid ${isInteracting ? T.good : isSelected ? T.accent : isStressed ? T.bad : moodC + '88'}`,
                  boxShadow: isInteracting ? '0 0 12px rgba(16,185,129,0.4)'
                    : isSelected ? '0 0 10px rgba(91,91,245,0.3)'
                    : isStressed ? '0 0 8px rgba(239,68,68,0.3)' : T.shadow,
                  background: '#0d1230',
                  animation: isInteracting ? 'rosterPulse 1.8s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }}>
                  <img
                    src={`${DICE_BASE}${encodeURIComponent(firstName)}`}
                    alt={firstName}
                    width={38} height={38}
                    style={{ display: 'block', width: '100%', height: '100%' }}
                    loading="lazy"
                  />
                </div>
                {/* Mood dot */}
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 9, height: 9, borderRadius: '50%',
                  background: moodC, border: '1.5px solid #0d1230',
                  boxShadow: `0 0 5px ${moodC}`,
                }} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Row 1: name + badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: isSelected ? T.accent : T.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  }}>
                    {firstName}
                  </span>
                  {isStressed && (
                    <span title="Stres ridicat" style={{ fontSize: 9, flexShrink: 0 }}>⚠️</span>
                  )}
                  {isInteracting && partner && (
                    <span style={{
                      fontSize: 7, padding: '1px 4px', borderRadius: 3, flexShrink: 0,
                      background: 'rgba(16,185,129,0.12)', color: T.good,
                      border: '1px solid rgba(16,185,129,0.28)',
                    }}>
                      💬{partner}
                    </span>
                  )}
                </div>

                {/* Row 2: profession + location */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 7.5, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(91,91,245,0.10)', color: T.accent,
                    border: '1px solid rgba(91,91,245,0.20)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80,
                  }}>
                    {npc.profession}
                  </span>
                  <span style={{
                    fontSize: 7.5, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(255,255,255,0.05)', color: T.textFaint,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70,
                  }}>
                    📍{location}
                  </span>
                </div>

                {/* Row 3: activity (1 line) */}
                <div style={{
                  fontSize: 9.5, color: T.textSoft, lineHeight: 1.3, marginBottom: 4,
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  {activity}
                </div>

                {/* Row 4: stat bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Mood */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 7, width: 10, textAlign: 'center', opacity: 0.7 }}>😊</span>
                    <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${mood}%`, background: moodC, borderRadius: 1, transition: 'width 1.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 7, color: moodC, width: 16, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mood}</span>
                  </div>
                  {/* Energy */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 7, width: 10, textAlign: 'center', opacity: 0.7 }}>⚡</span>
                    <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${energy}%`, background: energyC, borderRadius: 1, transition: 'width 1.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 7, color: energyC, width: 16, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{energy}</span>
                  </div>
                  {/* Hunger + Social mini inline */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                    <span style={{ fontSize: 7, color: hunger < 30 ? T.warn : T.textGhost }}>🍽️ {hunger}</span>
                    <span style={{ fontSize: 7, color: social < 25 ? T.warn : T.textGhost }}>👥 {social}</span>
                    {traits.map((t) => (
                      <span key={t} style={{ fontSize: 6.5, color: T.textGhost, background: 'rgba(255,255,255,0.04)', padding: '0 3px', borderRadius: 2, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}

        {npcs.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: T.textGhost, fontSize: 12 }}>
            Se încarcă personajele...
          </div>
        )}
      </div>

      {/* Hint at bottom */}
      {selectedCount === 0 && npcs.length > 0 && (
        <div style={{
          padding: '8px 14px',
          borderTop: `1px solid ${T.borderSoft}`,
          fontSize: 10, color: T.textGhost,
          flexShrink: 0, textAlign: 'center',
        }}>
          Click pe un personaj pentru detalii
        </div>
      )}

      <style>{`
        @keyframes rosterPulse {
          0%,100%{box-shadow:0 0 8px rgba(16,185,129,0.4);}
          50%{box-shadow:0 0 18px rgba(16,185,129,0.7);}
        }
      `}</style>
    </div>
  )
})
