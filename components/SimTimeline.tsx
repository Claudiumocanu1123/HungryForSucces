'use client'

import { useEffect, useState } from 'react'
import { DayStage, STAGES, STAGE_TIMES } from '@/types'
import { T } from '@/lib/theme'
import { stageProgressToHour, computeTheme } from '@/lib/dayTheme'

const STAGE_DURATION_MS = 20_000  // keep in sync with simulationClock.ts

// Pre-computed stage display names
const STAGE_LABELS: Record<string, string> = {
  WAKE_UP:'WAKE UP', MORNING:'MORNING', WORK:'WORK', LUNCH:'LUNCH',
  AFTERNOON:'AFTERNOON', COMMUTE:'COMMUTE', EVENING:'EVENING', NIGHT:'NIGHT',
}

const STAGE_ICONS: Record<DayStage, string> = {
  WAKE_UP: '🌅',
  MORNING: '☕',
  WORK: '💼',
  LUNCH: '🍽️',
  AFTERNOON: '⚡',
  COMMUTE: '🚗',
  EVENING: '🌆',
  NIGHT: '🌙',
}

interface SimTimelineProps {
  day: number
  stage: DayStage
  stageIndex: number
  startedAt: number
}

interface TickState { countdown: number; progress: number; timeStr: string; accentColor: string }

export default function SimTimeline({ day, stage, stageIndex, startedAt }: SimTimelineProps) {
  const [tick, setTick] = useState<TickState>({
    countdown: STAGE_DURATION_MS / 1000,
    progress: 0,
    timeStr: '06:00',
    accentColor: T.accent,
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
    // Pause when tab is hidden
    const onVisibility = () => {
      if (document.hidden) clearInterval(t)
      else update()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisibility) }
  }, [startedAt, stageIndex])

  const { countdown, progress, timeStr, accentColor } = tick

  return (
    <div
      style={{
        background: 'rgba(2,4,14,0.72)',
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(20px)',
        padding: '6px 16px',
        position: 'relative',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Day badge */}
        <div style={{
          flexShrink: 0,
          background: T.accentSoft,
          border: `1px solid ${T.borderAccent}`,
          borderRadius: 8,
          padding: '3px 10px',
          color: T.accent,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}>
          ZIUA {day}
        </div>

        {/* Simulated clock */}
        <div style={{
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: `${accentColor.replace('rgb', 'rgba').replace(')', ',0.10)')}`,
          border: `1px solid ${accentColor.replace('rgb', 'rgba').replace(')', ',0.30)')}`,
          borderRadius: 8, padding: '2px 10px',
          transition: 'border-color 3s ease, background 3s ease',
        }}>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', lineHeight: 1 }}>ORA</span>
          <span style={{
            fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            color: accentColor, letterSpacing: '0.04em', lineHeight: 1.1,
            transition: 'color 3s ease',
          }}>
            {timeStr}
          </span>
        </div>

        {/* Stage pills */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flex: 1,
          overflowX: 'auto',
          minWidth: 0,
          scrollbarWidth: 'none',
        }}>
          {STAGES.map((s, idx) => {
            const isCurrent = s === stage
            const isPast = idx < stageIndex
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                {idx > 0 && (
                  <div style={{
                    width: 12,
                    height: 1,
                    background: isPast
                      ? T.borderAccent
                      : isCurrent ? 'rgba(91,91,245,0.3)' : 'rgba(255,255,255,0.08)',
                    flexShrink: 0,
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: isCurrent ? '4px 9px' : '4px 7px',
                  borderRadius: 7,
                  background: isCurrent
                    ? T.accentSoft
                    : isPast ? T.accentSofter : 'transparent',
                  border: isCurrent
                    ? `1px solid ${T.borderAccent}`
                    : isPast ? '1px solid rgba(91,91,245,0.18)' : '1px solid transparent',
                  transition: 'all 0.4s ease',
                  boxShadow: isCurrent ? '0 2px 10px rgba(91,91,245,0.15)' : 'none',
                }}>
                  <span style={{ fontSize: 11, lineHeight: 1 }}>{STAGE_ICONS[s]}</span>
                  <span style={{
                    fontSize: 8,
                    fontWeight: isCurrent ? 700 : 400,
                    color: isCurrent ? T.accent : isPast ? 'rgba(91,91,245,0.6)' : T.textFaint,
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}>
                    {STAGE_LABELS[s]}
                  </span>
                  {isCurrent && (
                    <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, minWidth: 30 }}>
                      <div style={{
                        height: '100%',
                        width: `${progress * 100}%`,
                        background: `linear-gradient(90deg, ${accentColor}, ${T.accent2})`,
                        borderRadius: 1,
                        transition: 'width 0.4s linear, background 3s ease',
                      }} />
                    </div>
                  )}
                  <span style={{
                    fontSize: 7,
                    color: isCurrent ? 'rgba(91,91,245,0.7)' : T.textGhost,
                    lineHeight: 1,
                  }}>
                    {STAGE_TIMES[s]}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Countdown */}
        <div style={{
          flexShrink: 0,
          fontSize: 11,
          whiteSpace: 'nowrap',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1,
        }}>
          <span style={{ color: T.textFaint, fontSize: 9, letterSpacing: '0.05em' }}>
            NEXT STAGE IN
          </span>
          <span style={{
            color: countdown <= 5 ? T.bad : T.accent,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 0.3s',
          }}>
            {countdown}s
          </span>
        </div>
      </div>
    </div>
  )
}
