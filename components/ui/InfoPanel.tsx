'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { NPCWithState, DayStage, STAGE_TIMES, STAGES } from '@/types'
import { FeedEvent } from '@/components/WorldFeed'

// ── NPC accent palette ────────────────────────────────────────────────────────
const NPC_ACCENTS: Record<string, string> = {
  elena: '#a29bfe', mihai: '#fd79a8', ana: '#00cec9',
  bogdan: '#00b894', maria: '#fdcb6e', andrei: '#e17055',
  cristina: '#ffd700', radu: '#74b9ff', iulia: '#55efc4', dan: '#b2bec3',
}
const npcAccent = (id: string) => NPC_ACCENTS[id] ?? '#7b7bf8'

// ── Weather data by hour ──────────────────────────────────────────────────────
function getWeather(hour: number) {
  if (hour < 6)  return { icon: '🌙', desc: 'Cer senin',       temp: 12, hum: 55, wind: 8,  pres: 1016 }
  if (hour < 9)  return { icon: '🌤️', desc: 'Parțial înnorat', temp: 15, hum: 60, wind: 10, pres: 1015 }
  if (hour < 13) return { icon: '☀️',  desc: 'Însorit',         temp: 20, hum: 45, wind: 12, pres: 1013 }
  if (hour < 17) return { icon: '☀️',  desc: 'Însorit',         temp: 24, hum: 40, wind: 14, pres: 1012 }
  if (hour < 20) return { icon: '🌅', desc: 'Însorit',         temp: 20, hum: 50, wind: 11, pres: 1013 }
  return           { icon: '🌙', desc: 'Cer senin',       temp: 15, hum: 58, wind: 7,  pres: 1015 }
}

const EVENT_ICONS: Record<string, string> = {
  INTERACTION: '🤝', ACTIVITY: '⚡', MOOD_CHANGE: '😊',
}

// ── Animation variants ────────────────────────────────────────────────────────
const panelVariants = {
  hidden:  { x: 24, opacity: 0 },
  visible: { x: 0,  opacity: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
}

const listVariants = {
  visible: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden:  { x: 12, opacity: 0 },
  visible: { x: 0,  opacity: 1, transition: { duration: 0.28, ease: "easeOut" as const } },
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface InfoPanelProps {
  npcs: NPCWithState[]
  events: FeedEvent[]
  activeInteractions: Set<string>
  day: number
  stage: DayStage
  stageIndex: number
  startedAt: number
  timeOfDay: number
  onSelectNpc: (id: string) => void
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ children, badge }: { children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[9px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.32)' }}>
        {children}
      </span>
      {badge}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InfoPanel({
  npcs, events, activeInteractions, day, stage, stageIndex, startedAt, timeOfDay, onSelectNpc,
}: InfoPanelProps) {
  const weather = useMemo(() => getWeather(timeOfDay), [timeOfDay])

  // Notifications: stressed NPCs + active interactions
  const notifs = useMemo(() => {
    const list: { icon: string; text: string; color: string }[] = []
    for (const n of npcs) {
      const e = n.currentState?.energy ?? 70
      const m = n.currentState?.mood   ?? 70
      const first = n.name.split(' ')[0]
      if (e < 25) list.push({ icon: '⚡', text: `${first} are energie critică`, color: '#ef4444' })
      else if (m < 25) list.push({ icon: '😞', text: `${first} se simte rău`, color: '#ef4444' })
    }
    if (activeInteractions.size > 0)
      list.push({ icon: '💬', text: `${activeInteractions.size} conversații active`, color: '#10b981' })
    return list.slice(0, 5)
  }, [npcs, activeInteractions])

  // Build sorted feed (same logic as page.tsx)
  const stageOrder: Record<string, number> = {}
  STAGES.forEach((s, i) => { stageOrder[s] = i })

  const feedItems = useMemo(() => {
    return events.slice(0, 7)
  }, [events])

  return (
    <motion.aside
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col shrink-0 overflow-y-auto"
      style={{
        width: 214,
        background: 'rgba(3,5,20,0.78)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        scrollbarWidth: 'none',
      }}
    >
      {/* ── Weather ── */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SectionLabel>VREMEA</SectionLabel>
        <div className="flex items-center gap-3 mb-3">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
            className="text-[28px] leading-none">
            {weather.icon}
          </motion.span>
          <div>
            <div className="text-[22px] font-extrabold text-white leading-tight">
              {weather.temp}°C
            </div>
            <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {weather.desc}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Umiditate', value: `${weather.hum}%` },
            { label: 'Vânt',     value: `${weather.wind} km/h` },
            { label: 'Presiune', value: `${weather.pres} hPa` },
          ].map(({ label, value }) => (
            <motion.div
              key={label}
              variants={itemVariants}
              className="text-center rounded-lg py-1.5 px-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-[7px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</div>
              <div className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.60)' }}>{value}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Events ── */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SectionLabel>
          EVENIMENTE <span style={{ color: '#7b7bf8' }}>ZIUA {day}</span>
        </SectionLabel>

        <motion.div
          className="flex flex-col gap-0.5"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {feedItems.map((ev) => {
            const npc = npcs.find((n) => n.id === ev.npcId)
            const ac  = npc ? npcAccent(npc.id) : '#7b7bf8'
            return (
              <motion.div
                key={ev.id}
                variants={itemVariants}
                whileHover={{ x: 3, transition: { duration: 0.15 } }}
                onClick={() => onSelectNpc(ev.npcId)}
                className="flex items-start gap-2 py-1.5 cursor-pointer rounded-lg px-1.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
              >
                {/* Icon bubble */}
                <div className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[10px]"
                  style={{ background: `${ac}22`, border: `1px solid ${ac}33` }}>
                  {EVENT_ICONS[ev.type] ?? '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] mb-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {ev.time}
                  </div>
                  <div className="text-[9px] leading-snug line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {ev.text}
                  </div>
                </div>
              </motion.div>
            )
          })}
          {feedItems.length === 0 && (
            <div className="text-center py-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              Nicio activitate încă
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Notifications ── */}
      <div className="px-3 py-3">
        <SectionLabel
          badge={
            notifs.length > 0 ? (
              <motion.span
                key={notifs.length}
                initial={{ scale: 1.4 }} animate={{ scale: 1 }}
                className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(239,68,68,0.18)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}>
                {notifs.length}
              </motion.span>
            ) : null
          }
        >
          NOTIFICĂRI
        </SectionLabel>

        {notifs.length === 0 ? (
          <div className="text-center py-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
            Totul e în regulă ✓
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-1"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {notifs.map((n, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="flex items-start gap-2 py-1.5 px-2 rounded-lg"
                style={{
                  background: n.color === '#ef4444'
                    ? 'rgba(239,68,68,0.06)'
                    : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${n.color}22`,
                }}>
                <span className="text-[11px] shrink-0 mt-0.5">{n.icon}</span>
                <span className="text-[9px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {n.text}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.aside>
  )
}
