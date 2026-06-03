'use client'

import React from 'react'
import { NPCWithState } from '@/types'

const DICE_BASE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='

const NPC_ACCENTS: Record<string, string> = {
  elena: '#a29bfe', mihai: '#fd79a8', ana: '#00cec9',
  bogdan: '#00b894', maria: '#fdcb6e', andrei: '#e17055',
  cristina: '#ffd700', radu: '#74b9ff', iulia: '#55efc4', dan: '#b2bec3',
}
function accent(id: string) { return NPC_ACCENTS[id] || '#00d4ff' }

function moodColor(mood: number) {
  if (mood > 70) return '#00ff88'
  if (mood >= 40) return '#ffd700'
  return '#ff4444'
}

interface NPCCardProps {
  npc: NPCWithState
  isSelected: boolean
  isInteracting: boolean
  partnerName?: string
  onSelect: () => void
}

export default React.memo(function NPCCard({
  npc, isSelected, isInteracting, partnerName, onSelect,
}: NPCCardProps) {
  const s = npc.currentState
  const mood = s?.mood ?? 70
  const energy = s?.energy ?? 70
  const hunger = s?.hunger ?? 30
  const mc = moodColor(mood)
  const ac = accent(npc.id)
  const firstName = npc.name.split(' ')[0]

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      style={{
        position: 'relative',
        background: isSelected
          ? 'rgba(0,212,255,0.08)'
          : 'rgba(10, 10, 28, 0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${isSelected ? 'rgba(0,212,255,0.6)' : isInteracting ? 'rgba(0,255,136,0.45)' : mc + '33'}`,
        borderRadius: 20,
        padding: '20px 16px 16px',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.3s',
        boxShadow: isSelected
          ? `0 0 24px rgba(0,212,255,0.2), 0 8px 32px rgba(0,0,0,0.5)`
          : isInteracting
          ? `0 0 28px rgba(0,255,136,0.18), 0 8px 32px rgba(0,0,0,0.4)`
          : '0 4px 20px rgba(0,0,0,0.35)',
        userSelect: 'none',
        outline: 'none',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-4px)'
        el.style.boxShadow = `0 0 28px ${mc}22, 0 14px 40px rgba(0,0,0,0.55)`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = isSelected
          ? `0 0 24px rgba(0,212,255,0.2), 0 8px 32px rgba(0,0,0,0.5)`
          : isInteracting
          ? `0 0 28px rgba(0,255,136,0.18), 0 8px 32px rgba(0,0,0,0.4)`
          : '0 4px 20px rgba(0,0,0,0.35)'
      }}
    >
      {/* Accent gradient top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: `radial-gradient(ellipse at 50% -10%, ${ac}18 0%, transparent 70%)`,
        pointerEvents: 'none',
        borderRadius: '20px 20px 0 0',
      }} />

      {/* Interaction pulse border */}
      {isInteracting && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 20,
          border: '1px solid rgba(0,255,136,0.6)',
          animation: 'cardInteractPulse 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Avatar centered */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'relative', width: 76, height: 76 }}>
          {/* Mood glow ring */}
          <div style={{
            position: 'absolute',
            inset: -5,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${mc}18 0%, transparent 70%)`,
            border: `2px solid ${mc}66`,
            boxShadow: `0 0 18px ${mc}44, 0 0 8px ${mc}22`,
            animation: isInteracting ? 'moodRingPulse 1.8s ease-in-out infinite' : 'none',
          }} />
          <div style={{
            width: 76, height: 76, borderRadius: '50%',
            overflow: 'hidden', background: 'rgba(18,18,42,1)',
            position: 'relative',
          }}>
            <img
              src={`${DICE_BASE}${encodeURIComponent(firstName)}`}
              alt={firstName}
              width={76} height={76}
              style={{ display: 'block', width: '100%', height: '100%' }}
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget
                img.style.display = 'none'
                const fallback = img.parentElement
                if (fallback) {
                  fallback.style.background = `linear-gradient(135deg, ${ac}66, ${ac}33)`
                  fallback.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:${ac};font-family:Inter,sans-serif;">${npc.name[0]}</div>`
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Name + Profession */}
      <div style={{ textAlign: 'center', marginBottom: 10, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 3 }}>
          {npc.name}
        </div>
        <div style={{
          fontSize: 10, color: ac, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          {npc.profession}
        </div>
      </div>

      {/* Current activity */}
      {s && (
        <div style={{
          background: 'rgba(0,212,255,0.05)',
          border: '1px solid rgba(0,212,255,0.1)',
          borderRadius: 10, padding: '7px 10px',
          marginBottom: 10, position: 'relative', zIndex: 1,
        }}>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.78)',
            lineHeight: 1.35, textAlign: 'center',
          }}>
            {s.activity}
          </div>
          <div style={{
            fontSize: 9, color: 'rgba(255,255,255,0.32)',
            marginTop: 4, textAlign: 'center',
          }}>
            📍 {s.location}
          </div>
        </div>
      )}

      {/* Stats */}
      {s && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative', zIndex: 1 }}>
          {[
            { icon: '😊', val: mood, col: mc, label: 'Mood' },
            { icon: '⚡', val: energy, col: '#00d4ff', label: 'Energie' },
            { icon: '🍽️', val: hunger, col: '#ff9944', label: 'Foame' },
          ].map(({ icon, val, col }) => (
            <div key={icon} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, width: 14, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
              <div style={{
                flex: 1, height: 4, background: 'rgba(255,255,255,0.06)',
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${val}%`,
                  background: `linear-gradient(90deg, ${col}77, ${col})`,
                  borderRadius: 2, transition: 'width 1.3s ease',
                  boxShadow: `0 0 5px ${col}44`,
                }} />
              </div>
              <span style={{
                fontSize: 9, color: 'rgba(255,255,255,0.3)',
                width: 22, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
              }}>
                {Math.round(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Interaction badge */}
      {isInteracting && (
        <div style={{
          marginTop: 10, padding: '5px 10px', borderRadius: 8,
          background: 'rgba(0,255,136,0.09)', border: '1px solid rgba(0,255,136,0.28)',
          display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
          position: 'relative', zIndex: 1,
        }}>
          <span style={{ fontSize: 12 }}>💬</span>
          <span style={{ fontSize: 10, color: '#00ff88', fontWeight: 700 }}>
            {partnerName ? `Vorbind cu ${partnerName}` : 'Conversație activă'}
          </span>
        </div>
      )}

      <style>{`
        @keyframes cardInteractPulse {
          0%,100%{opacity:0.6;transform:scale(1);}
          50%{opacity:1;transform:scale(1.01);}
        }
        @keyframes moodRingPulse {
          0%,100%{opacity:0.6;}
          50%{opacity:1;}
        }
      `}</style>
    </div>
  )
})
