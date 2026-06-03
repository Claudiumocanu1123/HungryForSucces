'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { NPCWithState, DayStage, STAGES } from '@/types'
import { T } from '@/lib/theme'
import { FeedEvent } from './WorldFeed'
import DetailPanel from './DetailPanel'

const STAGE_DURATION_MS = 22_000
const DICE_BASE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='
const IASI_LAT = 47.1585
const IASI_LNG = 27.6014

const CityMapCore = dynamic(() => import('./CityMapView'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, background: '#030612', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>Se încarcă harta Iași...</div>
    </div>
  ),
})

const GlobeMini = dynamic(() => import('react-globe.gl').then((m) => m.default as any), { ssr: false })

const NPC_ACCENTS: Record<string, string> = {
  elena: '#a29bfe', mihai: '#fd79a8', ana: '#00cec9',
  bogdan: '#00b894', maria: '#fdcb6e', andrei: '#e17055',
  cristina: '#ffd700', radu: '#74b9ff', iulia: '#55efc4', dan: '#b2bec3',
}
function accent(id: string) { return NPC_ACCENTS[id] || '#7b7bf8' }

const STAGE_LABEL: Record<string, string> = {
  WAKE_UP: 'Trezire', MORNING: 'Dimineață', WORK: 'Muncă', LUNCH: 'Prânz',
  AFTERNOON: 'Activitate', COMMUTE: 'Navetă', EVENING: 'Seară', NIGHT: 'Noapte',
}

// ── Day/Night Arc ──────────────────────────────────────────────────────────────
function DayNightArc({ timeOfDay, mapWidth }: { timeOfDay: number; mapWidth: number }) {
  const W = Math.max(mapWidth, 200)
  const H = 148

  // Quadratic bezier: (0,H) → (W/2, -18) → (W, H)
  function bez(t: number): [number, number] {
    const mt = 1 - t
    return [
      mt * mt * 0 + 2 * mt * t * (W / 2) + t * t * W,
      mt * mt * H + 2 * mt * t * (-18) + t * t * H,
    ]
  }

  const DAY_START = 5, DAY_END = 19.5
  const isDaytime = timeOfDay >= DAY_START && timeOfDay < DAY_END
  const sunT = Math.max(0, Math.min(1, (timeOfDay - DAY_START) / (DAY_END - DAY_START)))
  const [sx, sy] = bez(sunT)
  const sunElev = isDaytime ? Math.sin(sunT * Math.PI) : 0

  const moonHour = (timeOfDay + 12) % 24
  const isMoonArc = moonHour >= DAY_START && moonHour < DAY_END
  const moonT = Math.max(0, Math.min(1, (moonHour - DAY_START) / (DAY_END - DAY_START)))
  const [mx, my] = bez(moonT)

  return (
    <>
      {/* Warm sun glow on map */}
      {sunElev > 0.05 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
          background: `radial-gradient(ellipse 55% 32% at ${(sx / W) * 100}% -4%, rgba(255,150,0,${sunElev * 0.17}), transparent 68%)`,
          transition: 'background 6s ease',
        }} />
      )}
      {/* Night overlay */}
      {!isDaytime && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
          background: 'rgba(4,7,30,0.42)',
          transition: 'background 6s ease',
        }} />
      )}

      <svg
        width={W} height={H}
        style={{
          position: 'absolute', top: 0, left: 0, zIndex: 6,
          pointerEvents: 'none', overflow: 'visible',
        }}
      >
        <defs>
          <radialGradient id="cd-sun-g" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF8C0" />
            <stop offset="28%" stopColor="#FFD050" />
            <stop offset="62%" stopColor="#FFA020" />
            <stop offset="100%" stopColor="#FF5500" stopOpacity="0" />
          </radialGradient>
          <filter id="cd-sun-f" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="cd-moon-f" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Dashed arc line */}
        <path
          d={`M 0 ${H} Q ${W / 2} -18 ${W} ${H}`}
          fill="none" stroke="rgba(110,155,255,0.22)" strokeWidth="1.5" strokeDasharray="5 6"
        />
        {/* Horizon baseline */}
        <line x1={8} y1={H} x2={W - 8} y2={H} stroke="rgba(100,140,255,0.12)" strokeWidth="1" />

        {/* Sun */}
        {isDaytime && sy < H + 50 && (
          <g filter="url(#cd-sun-f)">
            <circle cx={sx} cy={sy} r={54} fill="rgba(255,130,0,0.06)" />
            <circle cx={sx} cy={sy} r={40} fill="rgba(255,155,0,0.10)" />
            <circle cx={sx} cy={sy} r={28} fill="rgba(255,178,10,0.18)" />
            <circle cx={sx} cy={sy} r={20} fill="rgba(255,195,30,0.26)" />
            <circle cx={sx} cy={sy} r={15} fill="url(#cd-sun-g)" />
            <circle cx={sx} cy={sy} r={12} fill="#FFD055" opacity="0.92" />
            <circle cx={sx - 5} cy={sy - 5} r={4.5} fill="rgba(255,255,215,0.58)" />
          </g>
        )}

        {/* Moon */}
        {isMoonArc && my < H + 50 && (
          <g filter="url(#cd-moon-f)">
            <circle cx={mx} cy={my} r={26} fill="rgba(180,205,255,0.07)" />
            <circle cx={mx} cy={my} r={18} fill="rgba(205,220,255,0.13)" />
            <circle cx={mx} cy={my} r={13} fill="#D6E6FF" opacity="0.88" />
            {/* Crescent shadow */}
            <circle cx={mx + 4.5} cy={my + 0.5} r={10.5} fill="rgba(5,9,38,0.78)" />
            <circle cx={mx - 3.5} cy={my - 3.5} r={2.5} fill="rgba(255,255,255,0.42)" />
          </g>
        )}

        {/* Sun/moon horizon reference dots when below horizon */}
        {!isDaytime && (
          <circle cx={sx < 0 ? 10 : sx > W ? W - 10 : sx} cy={H} r={5} fill="#FFD055" opacity="0.22" />
        )}
        {!isMoonArc && (
          <circle cx={mx < 0 ? 10 : mx > W ? W - 10 : mx} cy={H} r={4} fill="#D6E6FF" opacity="0.18" />
        )}
      </svg>
    </>
  )
}

// ── Mini Globe widget ──────────────────────────────────────────────────────────
function FeedMiniGlobe() {
  const gRef = useRef<any>(null)
  const focusPt = useMemo(() => [{ lat: IASI_LAT, lng: IASI_LNG }], [])

  useEffect(() => {
    const g = gRef.current
    if (!g) return
    const t = setTimeout(() => {
      g.pointOfView({ lat: IASI_LAT, lng: IASI_LNG, altitude: 1.6 }, 0)
      const c = g.controls()
      if (c) { c.enableZoom = false; c.enablePan = false; c.autoRotate = true; c.autoRotateSpeed = 0.4 }
    }, 400)
    return () => clearTimeout(t)
  }, [])

  const htmlEl = useCallback((d: object) => {
    const el = document.createElement('div')
    el.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 12px #10b981;animation:fmgPulse 1.6s ease-in-out infinite;"></div>`
    return el
  }, [])

  const GlobeMiniAny = GlobeMini as any
  return (
    <GlobeMiniAny
      ref={gRef}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      backgroundColor="rgba(0,0,0,0)"
      atmosphereColor="#3366cc"
      atmosphereAltitude={0.14}
      htmlElementsData={focusPt}
      htmlLat="lat" htmlLng="lng" htmlAltitude={0.02}
      htmlElement={htmlEl}
      width={260} height={160}
    />
  )
}

// ── Events Feed Panel ──────────────────────────────────────────────────────────
type FeedTab = 'Ostiro' | 'Event' | 'Activise' | 'Personală'

function EventsFeedPanel({
  events, npcs, day, stage, stageIndex, startedAt,
  activeInteractions, selectedNpcId, onSelectNpc,
  simPaused, onToggleSim,
}: {
  events: FeedEvent[]; npcs: NPCWithState[]; day: number; stage: DayStage
  stageIndex: number; startedAt: number
  activeInteractions: Set<string>; selectedNpcId: string | null
  onSelectNpc: (id: string) => void
  simPaused?: boolean; onToggleSim?: () => void
}) {
  const [tab, setTab] = useState<FeedTab>('Event')
  const [countdown, setCountdown] = useState(22)

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setCountdown(Math.max(0, Math.ceil((STAGE_DURATION_MS - elapsed) / 1000)))
    }, 500)
    return () => clearInterval(iv)
  }, [startedAt])

  const activeNpcs = npcs.filter((n) => activeInteractions.has(n.id))
  const nextStage = STAGES[Math.min(stageIndex + 1, STAGES.length - 1)]
  const TABS: FeedTab[] = ['Ostiro', 'Event', 'Activise', 'Personală']

  const TYPE_COLOR: Record<string, string> = {
    INTERACTION: '#10b981', ACTIVITY: '#7b7bf8', MOOD_CHANGE: '#f59e0b',
    WORK: '#7b7bf8', SOCIAL: '#10b981', REST: '#f59e0b',
  }

  const selectedNpc = npcs.find((n) => n.id === selectedNpcId) ?? null

  return (
    <div style={{
      width: 282, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(3,5,18,0.90)',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(18px)',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '8px 14px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Events feed</span>
            <span style={{
              fontSize: 8, padding: '1px 6px', borderRadius: 8,
              background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.28)',
              color: '#10b981', fontWeight: 700, letterSpacing: '0.04em',
            }}>LIVE</span>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', cursor: 'default' }}>→</span>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 9px', borderRadius: '6px 6px 0 0',
              background: tab === t ? 'rgba(91,91,245,0.18)' : 'transparent',
              border: 'none', borderBottom: tab === t ? '2px solid #7b7bf8' : '2px solid transparent',
              color: tab === t ? '#7b7bf8' : 'rgba(255,255,255,0.32)',
              fontSize: 10, fontWeight: tab === t ? 700 : 400, cursor: 'pointer',
              fontFamily: 'Inter,sans-serif', transition: 'all 0.12s',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Stage countdown */}
      <div style={{
        margin: '8px 10px 0',
        background: 'rgba(91,91,245,0.07)',
        border: '1px solid rgba(91,91,245,0.18)',
        borderRadius: 10, padding: '7px 11px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.07em' }}>STAGE CURENT</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7b7bf8', marginTop: 2 }}>
            {STAGE_LABEL[stage] || stage}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
            Următor: <span style={{ color: 'rgba(123,123,248,0.65)' }}>{STAGE_LABEL[nextStage] || nextStage}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.07em' }}>NEXT IN</div>
          <div style={{
            fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
            color: countdown <= 5 ? '#ef4444' : countdown <= 10 ? '#f59e0b' : '#7b7bf8',
          }}>
            {countdown}<span style={{ fontSize: 10, fontWeight: 500 }}>s</span>
          </div>
        </div>
      </div>

      {/* Content by tab */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(91,91,245,0.15) transparent' }}>
        {(tab === 'Event' || tab === 'Ostiro') && (
          <>
            {events.slice(0, 22).map((ev) => {
              const npc = npcs.find((n) => n.id === ev.npcId)
              if (!npc) return null
              const firstName = npc.name.split(' ')[0]
              const ac = accent(npc.id)
              const isActive = activeInteractions.has(npc.id)
              const tc = TYPE_COLOR[ev.type] || '#7b7bf8'
              const isSelected = selectedNpcId === npc.id
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectNpc(npc.id)}
                  style={{
                    padding: '7px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.033)',
                    display: 'flex', alignItems: 'flex-start', gap: 9,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(91,91,245,0.08)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)' }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                    border: `2px solid ${isActive ? '#10b981' : ac}55`,
                    boxShadow: isActive ? `0 0 10px rgba(16,185,129,0.35)` : `0 0 6px ${ac}33`,
                  }}>
                    <img
                      src={`${DICE_BASE}${encodeURIComponent(firstName)}`}
                      width={30} height={30}
                      style={{ display: 'block', borderRadius: '50%' }}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement
                        img.style.display = 'none'
                        const d = document.createElement('div')
                        d.style.cssText = `width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;background:${ac};`
                        d.textContent = npc.name[0]
                        img.parentNode?.appendChild(d)
                      }}
                    />
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{firstName}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>{ev.time}</span>
                    </div>
                    <div style={{
                      fontSize: 10, color: 'rgba(255,255,255,0.44)', marginTop: 1,
                      lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ev.text}
                    </div>
                    <span style={{
                      display: 'inline-block', marginTop: 3, fontSize: 8, padding: '1px 5px', borderRadius: 4,
                      background: `${tc}16`, color: tc, border: `1px solid ${tc}28`,
                      fontWeight: 600, letterSpacing: '0.04em',
                    }}>
                      {ev.type}
                    </span>
                  </div>
                </div>
              )
            })}
            {events.length === 0 && (
              <div style={{ padding: '28px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 12 }}>
                Așteptând evenimente...
              </div>
            )}
          </>
        )}

        {tab === 'Activise' && (
          <div style={{ padding: '6px 8px' }}>
            {activeNpcs.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                Nicio interacțiune activă
              </div>
            )}
            {activeNpcs.map((npc) => {
              const ac = accent(npc.id)
              const mood = npc.currentState?.mood ?? 70
              const energy = npc.currentState?.energy ?? 70
              return (
                <div
                  key={npc.id}
                  onClick={() => onSelectNpc(npc.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 9, marginBottom: 5,
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    border: `2px solid ${ac}`, boxShadow: `0 0 10px ${ac}44`,
                  }}>
                    <img src={`${DICE_BASE}${encodeURIComponent(npc.name.split(' ')[0])}`}
                      width={32} height={32} style={{ display: 'block', borderRadius: '50%' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{npc.name.split(' ')[0]}</div>
                    <div style={{ fontSize: 9, color: ac, opacity: 0.8 }}>{npc.profession}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                      <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }}>
                        <div style={{ height: '100%', width: `${mood}%`, background: '#10b981', borderRadius: 1 }} />
                      </div>
                      <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }}>
                        <div style={{ height: '100%', width: `${energy}%`, background: '#f59e0b', borderRadius: 1 }} />
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 14 }}>💬</span>
                </div>
              )
            })}
            {npcs.filter((n) => !activeInteractions.has(n.id)).map((npc) => {
              const ac = accent(npc.id)
              return (
                <div
                  key={npc.id}
                  onClick={() => onSelectNpc(npc.id)}
                  style={{
                    padding: '6px 10px', borderRadius: 8, marginBottom: 4,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: 0.75,
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    border: `1.5px solid ${ac}55`,
                  }}>
                    <img src={`${DICE_BASE}${encodeURIComponent(npc.name.split(' ')[0])}`}
                      width={26} height={26} style={{ display: 'block', borderRadius: '50%' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{npc.name.split(' ')[0]}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{npc.profession}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'Personală' && selectedNpc && (
          <div style={{ padding: '0' }}>
            <DetailPanel npc={selectedNpc} day={day} stage={stage} allNpcs={npcs} onClose={() => onSelectNpc(selectedNpc.id)} />
          </div>
        )}
        {tab === 'Personală' && !selectedNpc && (
          <div style={{ padding: '28px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.20)', fontSize: 12 }}>
            Selectează un personaj din hartă
          </div>
        )}
      </div>

      {/* Mini globe section */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(2,4,14,0.60)',
        overflow: 'hidden',
      }}>
        {/* Globe info bar */}
        <div style={{
          padding: '7px 12px 4px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.05em' }}>GLOBAL FOCUS</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 5px #10b981' }} />
              Iași, RO
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', textAlign: 'right' }}>
            <div>47.16°N</div>
            <div>27.60°E</div>
          </div>
        </div>
        {/* Globe render */}
        <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
          <FeedMiniGlobe />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(2,4,14,0.8))',
            height: 30, pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, fontWeight: 600, color: '#10b981',
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)',
          borderRadius: 7, padding: '3px 9px',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 5px #10b981' }} />
          {activeNpcs.length} activi
        </div>
        {onToggleSim && (
          <button onClick={onToggleSim} style={{
            background: simPaused ? 'rgba(16,185,129,0.15)' : 'rgba(91,91,245,0.20)',
            border: `1px solid ${simPaused ? 'rgba(16,185,129,0.50)' : 'rgba(91,91,245,0.55)'}`,
            color: simPaused ? '#10b981' : '#7b7bf8',
            borderRadius: 9, padding: '4px 14px',
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.05em', fontFamily: 'Inter,sans-serif',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {simPaused ? '▶ Start' : 'Observarea →'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── CityDashboard ──────────────────────────────────────────────────────────────
const TABS = ['Ostiro', 'Event', 'Activise', 'Personală'] as const
type Tab = typeof TABS[number]

export interface CityDashboardProps {
  npcs: NPCWithState[]
  day: number
  stage: DayStage
  stageIndex: number
  startedAt: number
  progress: number
  timeOfDay: number
  activeInteractions: Set<string>
  interactionPairs: Array<[string, string]>
  events: FeedEvent[]
  simPaused?: boolean
  onToggleSim?: () => void
  onViewGlobe?: () => void
  onOpenModal?: () => void
}

export default function CityDashboard({
  npcs, day, stage, stageIndex, startedAt, progress, timeOfDay,
  activeInteractions, interactionPairs, events,
  simPaused, onToggleSim, onViewGlobe, onOpenModal,
}: CityDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Ostiro')
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null)
  const mapAreaRef = useRef<HTMLDivElement>(null)
  const [mapWidth, setMapWidth] = useState(700)

  useEffect(() => {
    const el = mapAreaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setMapWidth(Math.floor(entries[0].contentRect.width))
    })
    ro.observe(el)
    setMapWidth(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  const handleSelectNpc = useCallback((npc: NPCWithState) => {
    setSelectedNpcId((prev) => (prev === npc.id ? null : npc.id))
    setActiveTab('Personală')
  }, [])
  const handleCloseDetail = useCallback(() => setSelectedNpcId(null), [])
  const handleSelectById = useCallback((id: string) => {
    setSelectedNpcId((prev) => (prev === id ? null : id))
    setActiveTab('Personală')
  }, [])
  const handleNoop = useCallback(() => {}, [])

  const cityNpcs = useMemo(() => npcs.filter((n) => n.city === 'Iași'), [npcs])
  const isDaytime = timeOfDay >= 5 && timeOfDay < 19.5
  const timeStr = `${String(Math.floor(timeOfDay)).padStart(2, '0')}:${String(Math.floor((timeOfDay % 1) * 60)).padStart(2, '0')}`

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: '#030612', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* ── Header ── */}
      <header style={{
        height: 46, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 14px',
        background: 'rgba(3,5,18,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        position: 'relative', zIndex: 20, gap: 0,
      }}>
        {/* Hamburger */}
        <button style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)',
          fontSize: 16, cursor: 'pointer', padding: '4px 6px 4px 2px', lineHeight: 1, flexShrink: 0,
        }}>≡</button>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 8px', flexShrink: 0 }} />

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? 'rgba(91,91,245,0.16)' : 'none',
                border: activeTab === tab ? '1px solid rgba(91,91,245,0.38)' : '1px solid transparent',
                color: activeTab === tab ? '#7b7bf8' : 'rgba(255,255,255,0.38)',
                borderRadius: 7, padding: '4px 10px',
                cursor: 'pointer', fontSize: 11, fontWeight: activeTab === tab ? 700 : 400,
                fontFamily: 'Inter,sans-serif', transition: 'all 0.13s',
              }}
            >{tab}</button>
          ))}
        </div>

        {/* Center logo */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>🌍</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.015em' }}>LifeSim</span>
        </div>

        {/* Right controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Time chip */}
          <div style={{
            fontSize: 11, fontWeight: 600,
            color: isDaytime ? '#FFC050' : '#7ba0ff',
            background: isDaytime ? 'rgba(255,180,0,0.10)' : 'rgba(120,160,255,0.10)',
            border: `1px solid ${isDaytime ? 'rgba(255,180,0,0.25)' : 'rgba(120,160,255,0.25)'}`,
            borderRadius: 7, padding: '3px 9px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 10 }}>{isDaytime ? '☀️' : '🌙'}</span>
            {timeStr}
          </div>
          {/* Day badge */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#7b7bf8',
            background: 'rgba(91,91,245,0.12)', border: '1px solid rgba(91,91,245,0.30)',
            borderRadius: 7, padding: '3px 9px',
          }}>Ziua {day}</div>
          {/* Globe toggle */}
          {onViewGlobe && (
            <button onClick={onViewGlobe} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.50)', borderRadius: 8, padding: '4px 11px',
              cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'Inter,sans-serif',
            }}>← Glob</button>
          )}
          {/* Start/Stop */}
          {onToggleSim && (
            <button onClick={onToggleSim} style={{
              background: simPaused ? 'rgba(16,185,129,0.15)' : 'rgba(91,91,245,0.20)',
              border: `1px solid ${simPaused ? 'rgba(16,185,129,0.50)' : 'rgba(91,91,245,0.55)'}`,
              color: simPaused ? '#10b981' : '#7b7bf8',
              borderRadius: 9, padding: '4px 13px',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.04em', fontFamily: 'Inter,sans-serif',
            }}>
              {simPaused ? '▶ Începe' : 'Observarea →'}
            </button>
          )}
          {/* Add NPC */}
          {onOpenModal && (
            <button onClick={onOpenModal} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.45)', borderRadius: 8, padding: '4px 9px',
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
            }}>+ NPC</button>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Map area ── */}
        <div ref={mapAreaRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Day/night arc overlay (absolute, sits above map) */}
          <DayNightArc timeOfDay={timeOfDay} mapWidth={mapWidth} />

          {/* City Map */}
          <CityMapCore
            cityName="Iași"
            npcs={npcs}
            allNpcs={npcs}
            stage={stage}
            day={day}
            activeInteractions={activeInteractions}
            interactionPairs={interactionPairs}
            selectedNpcId={selectedNpcId}
            onSelectNpc={handleSelectNpc}
            onCloseDetail={handleCloseDetail}
            onCityChange={handleNoop}
            onBack={onViewGlobe || handleNoop}
            simPaused={simPaused}
            onToggleSim={onToggleSim}
          />

          {/* Stage progress stripe */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.04)', zIndex: 10 }}>
            <div style={{
              height: '100%', width: `${progress * 100}%`,
              background: 'linear-gradient(90deg, #5b5bf5, #7b7bf8)',
              transition: 'width 1s linear',
            }} />
          </div>
        </div>

        {/* ── Events feed panel ── */}
        <EventsFeedPanel
          events={events}
          npcs={npcs}
          day={day}
          stage={stage}
          stageIndex={stageIndex}
          startedAt={startedAt}
          activeInteractions={activeInteractions}
          selectedNpcId={selectedNpcId}
          onSelectNpc={handleSelectById}
          simPaused={simPaused}
          onToggleSim={onToggleSim}
        />
      </div>

      {/* ── Bottom status bar ── */}
      <div style={{
        height: 36, flexShrink: 0,
        background: 'rgba(3,5,18,0.92)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 10,
        fontSize: 10, color: 'rgba(255,255,255,0.38)',
        position: 'relative', zIndex: 10,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>📍</span>
          <span style={{ color: '#7b7bf8', fontWeight: 700 }}>Iași</span>
        </span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>{cityNpcs.length} personaje</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>{STAGE_LABEL[stage] || stage}</span>
        {activeInteractions.size > 0 && (
          <>
            <span style={{ opacity: 0.3 }}>·</span>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 5px #10b981' }} />
              {cityNpcs.filter((n) => activeInteractions.has(n.id)).length} interacțiuni active
            </span>
          </>
        )}

        {/* NPC color dots */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
          {npcs.map((npc) => {
            const ac = accent(npc.id)
            const isActive = activeInteractions.has(npc.id)
            const isSelected = selectedNpcId === npc.id
            return (
              <div
                key={npc.id}
                onClick={() => handleSelectById(npc.id)}
                title={`${npc.name} — ${npc.profession}`}
                style={{
                  width: isSelected ? 12 : 9,
                  height: isSelected ? 12 : 9,
                  borderRadius: '50%',
                  background: ac,
                  cursor: 'pointer',
                  border: isSelected ? `2px solid #fff` : isActive ? `1.5px solid #10b981` : '1.5px solid transparent',
                  boxShadow: isActive ? `0 0 7px ${ac}` : isSelected ? `0 0 8px #fff6` : 'none',
                  transition: 'all 0.2s',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes fmgPulse { 0%,100%{opacity:1;box-shadow:0 0 10px #10b981;} 50%{opacity:0.5;box-shadow:0 0 4px #10b981;} }
      `}</style>
    </div>
  )
}
