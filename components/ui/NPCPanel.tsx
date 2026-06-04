'use client'

import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NPCWithState } from '@/types'
import { moodColor } from '@/lib/theme'

// ── NPC accent palette ────────────────────────────────────────────────────────
const NPC_ACCENTS: Record<string, string> = {
  elena: '#a29bfe', mihai: '#fd79a8', ana: '#00cec9',
  bogdan: '#00b894', maria: '#fdcb6e', andrei: '#e17055',
  cristina: '#ffd700', radu: '#74b9ff', iulia: '#55efc4', dan: '#b2bec3',
}
const npcAccent = (id: string) => NPC_ACCENTS[id] ?? '#7b7bf8'

const DICE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='

const STAGE_LABEL: Record<string, string> = {
  WAKE_UP: 'Acasă', MORNING: 'Dimineață', WORK: 'La serviciu',
  LUNCH: 'Prânz', AFTERNOON: 'Activitate', COMMUTE: 'Navetă',
  EVENING: 'Seară', NIGHT: 'Noapte',
}

// ── Animation variants ────────────────────────────────────────────────────────
const panelVariants = {
  hidden: { x: -24, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
}

const listVariants = {
  visible: { transition: { staggerChildren: 0.045 } },
}

const cardVariants = {
  hidden:  { x: -12, opacity: 0 },
  visible: { x: 0,  opacity: 1, transition: { duration: 0.32, ease: "easeOut" as const } },
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface NPCPanelProps {
  npcs: NPCWithState[]
  selectedId: string | null
  activeInteractions: Set<string>
  interactionPairs: Array<[string, string]>
  onSelect: (npc: NPCWithState) => void
}

// ── Stat bar ─────────────────────────────────────────────────────────────────
function StatBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] text-white/30 w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[8px] tabular-nums w-5 text-right shrink-0" style={{ color }}>
        {value}%
      </span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NPCPanel({
  npcs, selectedId, activeInteractions, interactionPairs, onSelect,
}: NPCPanelProps) {
  // Build partner name map
  const npcById = useMemo(() => {
    const m = new Map<string, NPCWithState>()
    for (const n of npcs) m.set(n.id, n)
    return m
  }, [npcs])

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

  const sorted = useMemo(() => [...npcs].sort((a, b) => {
    const ai = activeInteractions.has(a.id) ? 0 : 1
    const bi = activeInteractions.has(b.id) ? 0 : 1
    if (ai !== bi) return ai - bi
    const as_ = a.id === selectedId ? 0 : 1
    const bs_ = b.id === selectedId ? 0 : 1
    if (as_ !== bs_) return as_ - bs_
    return (a.currentState?.mood ?? 70) - (b.currentState?.mood ?? 70)
  }), [npcs, activeInteractions, selectedId])

  const activeCount = activeInteractions.size

  return (
    <motion.aside
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 224,
        background: 'rgba(3,5,20,0.78)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>
            PERSOANE
          </span>
          {activeCount > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="text-[8px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.30)' }}>
              {activeCount} activi
            </motion.span>
          )}
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
          style={{ background: 'rgba(91,91,245,0.12)', color: '#7b7bf8', border: '1px solid rgba(91,91,245,0.25)' }}>
          {npcs.length}/10
        </span>
      </div>

      {/* NPC list */}
      <motion.div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {sorted.map((npc) => {
            const ac         = npcAccent(npc.id)
            const mood       = npc.currentState?.mood   ?? 70
            const energy     = npc.currentState?.energy ?? 70
            const isSelected = npc.id === selectedId
            const isActive   = activeInteractions.has(npc.id)
            const isStressed = energy < 30 || mood < 25
            const partner    = partnerMap[npc.id]
            const firstName  = npc.name.split(' ')[0]
            const stageLabel = STAGE_LABEL[npc.currentState?.stage ?? 'WAKE_UP'] ?? ''
            const moodC      = moodColor(mood)
            const energyC    = energy > 60 ? '#10b981' : energy > 30 ? '#f59e0b' : '#ef4444'

            return (
              <motion.div
                key={npc.id}
                variants={cardVariants}
                layout
                whileHover={{ backgroundColor: isSelected ? undefined : 'rgba(255,255,255,0.025)' }}
                onClick={() => onSelect(npc)}
                className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer relative"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: `2.5px solid ${isSelected ? ac : isActive ? '#10b981' : isStressed ? '#ef4444' : 'transparent'}`,
                  background: isSelected ? `${ac}10` : 'transparent',
                  transition: 'border-left-color 0.2s, background 0.2s',
                }}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <motion.div
                    animate={isActive ? {
                      boxShadow: [`0 0 0 0 rgba(16,185,129,0)`, `0 0 0 4px rgba(16,185,129,0.25)`, `0 0 0 0 rgba(16,185,129,0)`],
                    } : {}}
                    transition={{ repeat: Infinity, duration: 1.8 }}
                    className="rounded-full overflow-hidden"
                    style={{
                      width: 38, height: 38,
                      border: `2px solid ${isActive ? '#10b981' : isSelected ? ac : isStressed ? '#ef4444' : ac + '66'}`,
                    }}
                  >
                    <img
                      src={`${DICE}${encodeURIComponent(firstName)}`}
                      alt={firstName}
                      width={38} height={38}
                      style={{ display: 'block', borderRadius: '50%' }}
                      loading="lazy"
                    />
                  </motion.div>
                  {/* Status dot */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                    style={{ background: moodC, border: '1.5px solid #030514', boxShadow: `0 0 5px ${moodC}` }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Name row */}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-bold truncate flex-1"
                      style={{ color: isSelected ? ac : '#fff' }}>
                      {firstName}
                    </span>
                    {isStressed && <span className="text-[9px]">⚠️</span>}
                    {isActive && partner && (
                      <span className="text-[7px] px-1 py-0.5 rounded shrink-0 font-bold"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                        💬 {partner}
                      </span>
                    )}
                  </div>

                  {/* Stage label */}
                  <div className="text-[8px] mb-1.5 font-medium" style={{ color: ac + 'bb' }}>
                    • {stageLabel}
                  </div>

                  {/* Bars */}
                  <div className="flex flex-col gap-1">
                    <StatBar value={energy} color={energyC} label="Energie" />
                    <StatBar value={mood}   color={moodC}   label="Fericire" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {npcs.length === 0 && (
          <div className="p-5 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Se încarcă personajele...
          </div>
        )}
      </motion.div>

      {/* Footer hint */}
      {selectedId === null && npcs.length > 0 && (
        <div className="px-4 py-2 text-center text-[9px] shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.22)' }}>
          Click pe un personaj pentru detalii
        </div>
      )}
    </motion.aside>
  )
}
