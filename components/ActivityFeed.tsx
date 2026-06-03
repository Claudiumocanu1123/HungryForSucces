'use client'

import { useEffect, useRef, useState } from 'react'

export interface FeedEvent {
  id: string
  time: string
  text: string
  npcId: string
  type: 'INTERACTION' | 'ACTIVITY' | 'MOOD_CHANGE'
}

interface ActivityFeedProps {
  events: FeedEvent[]
  onSelectNpc: (npcId: string) => void
}

const TYPE_DOT: Record<string, string> = {
  INTERACTION: '#00ff88',
  ACTIVITY: '#00d4ff',
  MOOD_CHANGE: '#ffd700',
}

const TYPE_ICON: Record<string, string> = {
  INTERACTION: '🤝',
  ACTIVITY: '▸',
  MOOD_CHANGE: '💭',
}

export default function ActivityFeed({ events, onSelectNpc }: ActivityFeedProps) {
  const [displayed, setDisplayed] = useState<FeedEvent[]>([])
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  const knownRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const fresh = new Set<string>()
    for (const e of events) {
      if (!knownRef.current.has(e.id)) fresh.add(e.id)
    }
    knownRef.current = new Set(events.map((e) => e.id))
    setFreshIds(fresh)
    setDisplayed(events.slice(0, 18))

    if (fresh.size > 0) {
      const t = setTimeout(() => setFreshIds(new Set()), 1200)
      return () => clearTimeout(t)
    }
  }, [events])

  return (
    <div style={{
      position: 'absolute',
      left: 12,
      top: 12,
      width: 230,
      maxHeight: 340,
      background: 'rgba(8,8,24,0.88)',
      border: '1px solid rgba(0,212,255,0.14)',
      borderRadius: 12,
      backdropFilter: 'blur(18px)',
      overflow: 'hidden',
      zIndex: 5,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '7px 12px',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flexShrink: 0,
      }}>
        <span style={{
          width: 6, height: 6,
          borderRadius: '50%',
          background: '#00ff88',
          display: 'inline-block',
          boxShadow: '0 0 6px #00ff88',
          animation: 'feedPulse 2s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#00d4ff',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Activitate Live
        </span>
      </div>

      {/* Event list */}
      <div style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'none' }}>
        {displayed.length === 0 ? (
          <div style={{ padding: '14px 12px', color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' }}>
            Simulare în curs...
          </div>
        ) : (
          displayed.map((evt) => {
            const isFresh = freshIds.has(evt.id)
            return (
              <div
                key={evt.id}
                onClick={() => onSelectNpc(evt.npcId)}
                style={{
                  padding: '5px 10px',
                  display: 'flex',
                  gap: 7,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  borderLeft: isFresh ? `2px solid ${TYPE_DOT[evt.type]}` : '2px solid transparent',
                  background: isFresh ? `${TYPE_DOT[evt.type]}0d` : 'transparent',
                  transition: 'background 0.5s, border-color 0.5s',
                  animation: isFresh ? 'feedSlide 0.3s ease-out' : 'none',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = isFresh
                    ? `${TYPE_DOT[evt.type]}0d`
                    : 'transparent'
                }}
              >
                <span style={{ fontSize: 10, flexShrink: 0, marginTop: 1 }}>
                  {TYPE_ICON[evt.type]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.35)',
                    marginRight: 5,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {evt.time}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.8)',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}>
                    {evt.text}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <style>{`
        @keyframes feedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes feedSlide {
          from { transform: translateX(-8px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
