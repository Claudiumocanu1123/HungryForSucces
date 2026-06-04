'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NPCWithState, DayStage, STAGES, STAGE_TIMES } from '@/types'
import { stageProgressToHour, computeTheme } from '@/lib/dayTheme'

// ── Constants ─────────────────────────────────────────────────────────────────
const STAGE_DURATION_MS = 20_000

const STAGE_META: Record<DayStage, { icon: string; label: string }> = {
  WAKE_UP:   { icon: '🌅', label: 'WAKE UP'   },
  MORNING:   { icon: '☕', label: 'MORNING'   },
  WORK:      { icon: '💼', label: 'WORK'      },
  LUNCH:     { icon: '🍽️', label: 'LUNCH'     },
  AFTERNOON: { icon: '⚡', label: 'AFTERNOON' },
  COMMUTE:   { icon: '🚗', label: 'COMMUTE'   },
  EVENING:   { icon: '🌆', label: 'EVENING'   },
  NIGHT:     { icon: '🌙', label: 'NIGHT'     },
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface TopNavProps {
  day: number
  stage: DayStage
  stageIndex: number
  startedAt: number
  npcs: NPCWithState[]
  simPaused?: boolean
  viewMode: { mode: 'globe' } | { mode: 'city'; cityName: string }
  onToggleSim: () => void
  onClearStories: () => void
  onOpenSettings: () => void
  onAddNpc: () => void
  onBackToGlobe?: () => void
}

// ── Tick state ────────────────────────────────────────────────────────────────
interface TickState {
  progress: number
  countdown: number
  timeStr: string
  accentColor: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TopNav({
  day, stage, stageIndex, startedAt, npcs,
  simPaused, viewMode,
  onToggleSim, onClearStories, onOpenSettings, onAddNpc, onBackToGlobe,
}: TopNavProps) {
  const inCity = viewMode.mode === 'city'

  const [tick, setTick] = useState<TickState>({
    progress: 0, countdown: STAGE_DURATION_MS / 1000,
    timeStr: '06:00', accentColor: '#7b7bf8',
  })

  useEffect(() => {
    const update = () => {
      const elapsed  = Date.now() - startedAt
      const progress = Math.min(elapsed / STAGE_DURATION_MS, 1)
      const tod      = stageProgressToHour(stageIndex, progress)
      const theme    = computeTheme(tod)
      setTick({
        progress,
        countdown: Math.max(0, Math.ceil((STAGE_DURATION_MS - elapsed) / 1000)),
        timeStr: theme.timeStr,
        accentColor: theme.accentColor,
      })
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [startedAt, stageIndex])

  const { progress, countdown, timeStr, accentColor } = tick
  const isDaytime = (() => {
    const elapsed = Date.now() - startedAt
    const prog    = Math.min(elapsed / STAGE_DURATION_MS, 1)
    const tod     = stageProgressToHour(stageIndex, prog)
    return tod >= 6 && tod < 20
  })()

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" as const }}
      className="flex items-center gap-3 px-4 shrink-0 relative z-50"
      style={{
        height: 52,
        background: 'rgba(2,4,14,0.82)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* ── Left: Logo + breadcrumb ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Logo */}
        <span className="text-[17px] font-extrabold tracking-tight select-none"
          style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}66` }}>
          Life<span className="text-white">Sim</span>
        </span>

        {/* Breadcrumb */}
        <AnimatePresence mode="wait">
          {inCity ? (
            <motion.div key="city-crumb"
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-1.5 text-[10px]">
              <button onClick={onBackToGlobe}
                className="text-white/40 hover:text-white/70 transition-colors cursor-pointer">Glob</button>
              <span className="text-white/20">›</span>
              <span className="text-white/50">Iași</span>
              <span className="text-white/20">›</span>
              <span className="font-semibold" style={{ color: accentColor }}>
                {viewMode.mode === 'city' ? viewMode.cityName : 'Iași'}
              </span>
            </motion.div>
          ) : (
            <motion.div key="globe-crumb"
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <span className="text-[10px] text-white/45">Simulare activă · Iași</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Separator */}
        <div className="w-px h-4 bg-white/10 shrink-0" />

        {/* People chip */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)' }}>
          <span>👥</span>
          <span>{npcs.length} persoane</span>
        </div>
      </div>

      {/* ── Center: Stage timeline ── */}
      <div className="flex-1 flex items-center justify-center gap-1 min-w-0 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}>
        {STAGES.map((s, idx) => {
          const isCurrent = s === stage
          const isPast    = idx < stageIndex
          const meta      = STAGE_META[s]

          return (
            <div key={s} className="flex items-center gap-1 shrink-0">
              {/* Connector line */}
              {idx > 0 && (
                <div className="w-3 h-px shrink-0"
                  style={{ background: isPast ? `${accentColor}66` : 'rgba(255,255,255,0.08)' }} />
              )}

              {/* Stage pill */}
              <motion.div
                layout
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex flex-col items-center gap-0.5 rounded-lg cursor-default select-none"
                style={{
                  padding: isCurrent ? '4px 10px' : '4px 7px',
                  background: isCurrent
                    ? `${accentColor}1a`
                    : isPast ? 'rgba(91,91,245,0.07)' : 'transparent',
                  border: isCurrent
                    ? `1px solid ${accentColor}55`
                    : isPast ? '1px solid rgba(91,91,245,0.18)' : '1px solid transparent',
                  boxShadow: isCurrent ? `0 2px 12px ${accentColor}22` : 'none',
                  transition: 'all 0.35s ease',
                }}
              >
                <span className="text-[11px] leading-none">{meta.icon}</span>
                <span className="text-[7px] font-bold leading-none"
                  style={{
                    color: isCurrent ? accentColor : isPast ? 'rgba(91,91,245,0.55)' : 'rgba(255,255,255,0.25)',
                    letterSpacing: '0.04em',
                  }}>
                  {meta.label}
                </span>

                {/* Progress bar under current */}
                {isCurrent && (
                  <div className="w-full rounded-sm overflow-hidden" style={{ height: 2, minWidth: 28, background: 'rgba(255,255,255,0.08)' }}>
                    <motion.div
                      className="h-full rounded-sm"
                      style={{ background: `linear-gradient(90deg, ${accentColor}, #8b5cf6)` }}
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ duration: 0.5, ease: 'linear' }}
                    />
                  </div>
                )}

                <span className="text-[7px] leading-none"
                  style={{ color: isCurrent ? `${accentColor}99` : 'rgba(255,255,255,0.14)' }}>
                  {STAGE_TIMES[s]}
                </span>
              </motion.div>
            </div>
          )
        })}
      </div>

      {/* ── Right: Time, day, controls ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Countdown */}
        <AnimatePresence>
          {countdown <= 8 && (
            <motion.div key="countdown"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-end"
              style={{ minWidth: 36 }}>
              <span className="text-[8px] text-white/30 leading-none">URMEAZĂ</span>
              <span className="text-[13px] font-bold tabular-nums leading-none"
                style={{ color: countdown <= 3 ? '#ef4444' : accentColor }}>
                {countdown}s
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Time display */}
        <div className="flex flex-col items-center px-2.5 py-1 rounded-lg shrink-0"
          style={{
            background: `${accentColor}12`,
            border: `1px solid ${accentColor}30`,
            transition: 'background 2s, border-color 2s',
          }}>
          <span className="text-[8px] leading-none text-white/30">ORA</span>
          <span className="text-[14px] font-extrabold tabular-nums leading-tight"
            style={{ color: accentColor, transition: 'color 2s' }}>
            {timeStr}
          </span>
        </div>

        {/* Day badge */}
        <div className="px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0"
          style={{ background: 'rgba(91,91,245,0.14)', border: '1px solid rgba(91,91,245,0.35)' }}>
          <span className="text-[10px] font-bold text-white/80">ZIUA</span>
          <span className="text-[13px] font-extrabold tabular-nums" style={{ color: accentColor }}>
            {day}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-white/10" />

        {/* Toggle sim */}
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={onToggleSim}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
          style={simPaused ? {
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.40)', color: '#10b981',
          } : {
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444',
          }}
        >
          {simPaused ? '▶ START' : '■ STOP'}
        </motion.button>

        {/* Icon buttons */}
        {[
          { icon: '🗑️', title: 'Șterge cache povești', onClick: onClearStories },
          { icon: '⚙️', title: 'Setări',               onClick: onOpenSettings },
        ].map(({ icon, title, onClick }) => (
          <motion.button key={icon}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={onClick}
            title={title}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            {icon}
          </motion.button>
        ))}

        {/* + NPC */}
        <motion.button
          whileHover={{ scale: 1.04, boxShadow: `0 4px 20px ${accentColor}44` }}
          whileTap={{ scale: 0.96 }}
          onClick={onAddNpc}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
          style={{
            background: `${accentColor}1a`,
            border: `1px solid ${accentColor}55`,
            color: accentColor,
          }}
        >
          + NPC
        </motion.button>

        {/* User chip */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
            style={{ background: `${accentColor}22`, border: `1px solid ${accentColor}44` }}>
            👤
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-white/70 leading-none">Admin</span>
            <span className="text-[7px] text-white/30 leading-none">Administrator</span>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
