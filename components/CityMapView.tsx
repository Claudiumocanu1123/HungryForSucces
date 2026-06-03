'use client'

import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import dynamic from 'next/dynamic'
import { NPCWithState, DayStage } from '@/types'
import { getCityStageCoords, CITY_MAP_CONFIG } from '@/lib/cityCoords'
import { T } from '@/lib/theme'
import DetailPanel from './DetailPanel'

const BACK_ZOOM_THRESHOLD = 11
const DICE_BASE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='
const IASI_LAT = 47.1585
const IASI_LNG = 27.6014

// Mini globe — loaded client-only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GlobeMini = dynamic(() => import('react-globe.gl').then((m) => m.default as any), { ssr: false })

const NPC_ACCENTS: Record<string, string> = {
  elena: '#a29bfe', mihai: '#fd79a8', ana: '#00cec9',
  bogdan: '#00b894', maria: '#fdcb6e', andrei: '#e17055',
  cristina: '#ffd700', radu: '#74b9ff', iulia: '#55efc4', dan: '#b2bec3',
}
function accent(id: string) { return NPC_ACCENTS[id] || '#7b7bf8' }

function moodColor(mood: number) {
  if (mood > 70) return '#10b981'
  if (mood >= 40) return '#f59e0b'
  return '#ef4444'
}

// ── NPC marker with avatar + name + profession ────────────────────────────────
function createNPCIcon(npc: NPCWithState, isInteracting: boolean, isSelected: boolean): L.DivIcon {
  const mood     = npc.currentState?.mood ?? 70
  const mc       = moodColor(mood)
  const bc       = isSelected ? '#ffffff' : isInteracting ? '#10b981' : mc
  const ac       = accent(npc.id)
  const firstName = npc.name.split(' ')[0]
  const profession = npc.profession || ''
  const energy   = npc.currentState?.energy ?? 70
  const sz       = isSelected ? 46 : 40

  const energyColor = energy > 50 ? '#10b981' : energy > 25 ? '#f59e0b' : '#ef4444'
  const energyW = Math.round(energy * 0.7)  // bar width in px (max ~49px)

  return L.divIcon({
    html: `
      <div class="npc-map-marker ${isInteracting ? 'interacting' : ''} ${isSelected ? 'selected' : ''}" style="--mc:${bc};">
        <div class="npc-avatar-ring" style="width:${sz}px;height:${sz}px;border-color:${bc};${isInteracting ? 'box-shadow:0 0 14px ' + bc + '88;' : ''}">
          <img src="${DICE_BASE}${encodeURIComponent(firstName)}"
               width="${sz}" height="${sz}" style="border-radius:50%;"
               onerror="this.style.display='none';this.parentNode.innerHTML='<div style=\\'width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.floor(sz * 0.42)}px;font-weight:900;color:#fff;background:${ac};\\'>'+\`${npc.name[0]}\`+'</div>'"
          />
        </div>
        <div class="npc-info-card" style="border-color:${bc}44;${isSelected ? 'background:rgba(3,5,18,0.97);' : ''}">
          <div class="npc-name" style="color:${isSelected ? '#fff' : bc};">${firstName}</div>
          <div class="npc-profession" style="color:${ac};">${profession}</div>
          <div class="npc-energy-bar">
            <div class="npc-energy-fill" style="width:${energyW}px;background:${energyColor};"></div>
          </div>
        </div>
        ${isInteracting ? '<div class="npc-chat-badge">💬</div>' : ''}
      </div>`,
    className: 'npc-map-icon',
    iconSize: [sz + 70, sz + 28],
    iconAnchor: [Math.floor((sz + 70) / 2), sz + 14],
    popupAnchor: [0, -(sz + 16)],
  })
}

// ── NPCMapMarker (imperative Leaflet) ─────────────────────────────────────────
interface NPCMarkerProps {
  npc: NPCWithState; stage: DayStage
  isInteracting: boolean; isSelected: boolean
  onSelect: (npc: NPCWithState) => void
}
function NPCMapMarker({ npc, stage, isInteracting, isSelected, onSelect }: NPCMarkerProps) {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)
  const posRef = useRef(getCityStageCoords(npc, stage))

  useEffect(() => {
    const pos = posRef.current
    const icon = createNPCIcon(npc, isInteracting, isSelected)
    const marker = L.marker(pos, { icon, zIndexOffset: isSelected ? 1000 : isInteracting ? 500 : 0 })
    marker.addTo(map)
    marker.on('click', () => onSelect(npc))
    markerRef.current = marker
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = marker.getElement()
      if (el) el.style.transition = 'transform 3s cubic-bezier(0.25,0.46,0.45,0.94)'
    }))
    return () => { marker.off(); marker.remove(); markerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const newPos = getCityStageCoords(npc, stage)
  useEffect(() => {
    if (!markerRef.current) return
    posRef.current = newPos; markerRef.current.setLatLng(newPos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPos[0], newPos[1]])

  useEffect(() => {
    if (!markerRef.current) return
    markerRef.current.setIcon(createNPCIcon(npc, isInteracting, isSelected))
    markerRef.current.setZIndexOffset(isSelected ? 1000 : isInteracting ? 500 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInteracting, isSelected, npc.currentState?.mood, npc.currentState?.energy])

  return null
}

// ── Interaction polyline ──────────────────────────────────────────────────────
interface InteractionLineProps { pos1: [number,number]; pos2: [number,number]; color: string }
function InteractionLine({ pos1, pos2, color }: InteractionLineProps) {
  return (
    <Polyline positions={[pos1, pos2]}
      pathOptions={{ color, weight: 2.5, opacity: 0.75, dashArray: '6 4', className: 'interaction-line' }}
    />
  )
}

// ── All-NPC connection network (thin, subtle) ─────────────────────────────────
interface ConnectionNetworkProps { positions: { pos: [number,number]; id: string }[] }
function ConnectionNetwork({ positions }: ConnectionNetworkProps) {
  const pairs = useMemo(() => {
    const lines: { key: string; p1: [number,number]; p2: [number,number] }[] = []
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        lines.push({ key: `${i}-${j}`, p1: positions[i].pos, p2: positions[j].pos })
      }
    }
    return lines
  }, [positions])
  return (
    <>
      {pairs.map((l) => (
        <Polyline key={l.key} positions={[l.p1, l.p2]}
          pathOptions={{ color: 'rgba(123,123,248,0.18)', weight: 1, opacity: 1 }}
        />
      ))}
    </>
  )
}

// ── Map helpers ───────────────────────────────────────────────────────────────
function MapFitter({ cityName }: { cityName: string }) {
  const map = useMap()
  useEffect(() => {
    const cfg = CITY_MAP_CONFIG[cityName]
    if (cfg) map.setView(cfg.center, cfg.zoom, { animate: true, duration: 0.8 })
  }, [cityName, map])
  return null
}

function ZoomWatcher({ onBack }: { onBack: () => void }) {
  const firedRef = useRef(false)
  useMapEvents({ zoomend: (e) => {
    if (firedRef.current) return
    if (e.target.getZoom() <= BACK_ZOOM_THRESHOLD) { firedRef.current = true; onBack() }
  }})
  return null
}

// ── Mini Globe (bottom-right overlay) ────────────────────────────────────────
function MiniGlobe({ cityName: _cityName }: { cityName: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null)

  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    setTimeout(() => {
      g.pointOfView({ lat: IASI_LAT, lng: IASI_LNG, altitude: 1.8 }, 0)
      const c = g.controls()
      if (c) { c.enableZoom = false; c.enablePan = false; c.autoRotate = true; c.autoRotateSpeed = 0.5 }
    }, 300)
  }, [])

  const focusPoint = useMemo(() => [{ lat: IASI_LAT, lng: IASI_LNG, label: 'Focus' }], [])

  const htmlEl = useCallback((d: object) => {
    const el = document.createElement('div')
    el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="width:9px;height:9px;border-radius:50%;background:#10b981;box-shadow:0 0 14px #10b981;animation:miniGlobePulse 1.5s ease-in-out infinite;"></div><div style="font-size:8px;color:#10b981;font-family:monospace;background:rgba(0,0,0,0.75);padding:1px 4px;border-radius:3px;">${(d as {label:string}).label}</div></div>`
    return el
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const GlobeMiniAny = GlobeMini as any
  return (
    <GlobeMiniAny
      ref={globeRef}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      backgroundColor="rgba(0,0,0,0)"
      atmosphereColor="#4488dd"
      atmosphereAltitude={0.18}
      htmlElementsData={focusPoint}
      htmlLat="lat" htmlLng="lng" htmlAltitude={0.03}
      htmlElement={htmlEl}
      width={220} height={190}
    />
  )
}

// ── Stage labels ──────────────────────────────────────────────────────────────
const STAGE_LOCATION_LABEL: Record<string, string> = {
  WAKE_UP: '🏠 Acasă', MORNING: '🌅 Se pregătesc', WORK: '🏢 La serviciu',
  LUNCH: '🍽️ Pauza de prânz', AFTERNOON: '⚡ Activitate',
  COMMUTE: '🚗 Navetă', EVENING: '🌆 Seara', NIGHT: '🌙 Noapte',
}

const CITY_EMOJI: Record<string, string> = {
  'București': '🏛️', 'Cluj-Napoca': '⛰️', 'Iași': '🎓',
  'Timișoara': '🏭', 'Brașov': '🏔️',
}

// ── CityMapViewProps ──────────────────────────────────────────────────────────
interface CityMapViewProps {
  cityName: string; npcs: NPCWithState[]; allNpcs: NPCWithState[]
  stage: DayStage; day: number
  activeInteractions: Set<string>; interactionPairs: Array<[string, string]>
  selectedNpcId: string | null
  onSelectNpc: (npc: NPCWithState) => void; onCloseDetail: () => void
  onCityChange: (cityName: string) => void; onBack: () => void
  simPaused?: boolean; onToggleSim?: () => void
}

// ── CityMapView ───────────────────────────────────────────────────────────────
export default function CityMapView({
  cityName, npcs, allNpcs, stage, day,
  activeInteractions, interactionPairs,
  selectedNpcId, onSelectNpc, onCloseDetail, onCityChange, onBack,
  simPaused, onToggleSim,
}: CityMapViewProps) {
  const cityNpcs = useMemo(() => npcs.filter((n) => n.city === cityName), [npcs, cityName])
  const cfg = CITY_MAP_CONFIG[cityName] || { center: [45.9432, 24.9668] as [number,number], zoom: 13 }

  // Interaction lines
  const cityInteractionLines = useMemo(() => interactionPairs
    .map(([id1, id2]) => {
      const n1 = cityNpcs.find((n) => n.id === id1)
      const n2 = cityNpcs.find((n) => n.id === id2)
      if (!n1 || !n2) return null
      return {
        key: `${id1}-${id2}`,
        pos1: getCityStageCoords(n1, stage),
        pos2: getCityStageCoords(n2, stage),
        color: accent(id1),
      }
    })
    .filter(Boolean) as { key: string; pos1: [number,number]; pos2: [number,number]; color: string }[],
    [interactionPairs, cityNpcs, stage]
  )

  // Network positions for all NPCs (subtle background lines)
  const networkPositions = useMemo(() =>
    cityNpcs.map((n) => ({ id: n.id, pos: getCityStageCoords(n, stage) })),
    [cityNpcs, stage]
  )

  const selectedNpc = cityNpcs.find((n) => n.id === selectedNpcId) ?? null

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Dark map ── */}
      <MapContainer
        center={cfg.center} zoom={cfg.zoom}
        style={{ flex: 1, width: '100%' }}
        zoomControl={false} attributionControl={false}
      >
        {/* Dark premium tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd" maxZoom={19}
        />

        <MapFitter cityName={cityName} />
        <ZoomWatcher onBack={onBack} />

        {/* Subtle NPC network lines */}
        {cityNpcs.length > 1 && <ConnectionNetwork positions={networkPositions} />}

        {/* Active interaction lines — colored per NPC pair */}
        {cityInteractionLines.map((l) => (
          <InteractionLine key={l.key} pos1={l.pos1} pos2={l.pos2} color={l.color} />
        ))}

        {/* NPC markers */}
        {cityNpcs.map((npc) => (
          <NPCMapMarker key={npc.id} npc={npc} stage={stage}
            isInteracting={activeInteractions.has(npc.id)}
            isSelected={selectedNpcId === npc.id}
            onSelect={onSelectNpc}
          />
        ))}
      </MapContainer>

      {/* ── Mini Globe (bottom-right) ── */}
      <div style={{
        position: 'absolute', bottom: 52, right: selectedNpc ? 330 : 12,
        zIndex: 800, width: 220, height: 190,
        background: 'rgba(2,4,14,0.82)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14, overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        transition: 'right 0.3s',
      }}>
        <MiniGlobe cityName={cityName} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(2,4,14,0.9))',
          padding: '4px 8px 5px',
          fontSize: 9, color: 'rgba(16,185,129,0.8)',
          fontFamily: 'monospace', letterSpacing: '0.05em', textAlign: 'center',
        }}>
          ● Focus: {cityName} (Active Simulation)
        </div>
      </div>

      {/* ── Header overlay — dark premium ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: selectedNpc ? 320 : 0,
        zIndex: 900,
        background: 'rgba(2,4,14,0.88)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 14px', height: 50,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>
        {/* Breadcrumb: Glob › City */}
        <button onClick={onBack} style={{
          background: 'rgba(91,91,245,0.12)', border: '1px solid rgba(91,91,245,0.30)',
          color: '#7b7bf8', borderRadius: 8, padding: '4px 11px',
          cursor: 'pointer', fontSize: 11, fontWeight: 600,
          fontFamily: 'Inter,sans-serif', marginRight: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          ← Glob
        </button>

        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginRight: 6 }}>›</span>

        {/* City label — only Iași */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <span style={{
            padding: '4px 12px', borderRadius: 7,
            background: 'rgba(91,91,245,0.18)',
            border: '1px solid rgba(91,91,245,0.40)',
            color: '#7b7bf8', fontSize: 11, fontWeight: 700,
            fontFamily: 'Inter,sans-serif',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            🎓 Iași
            <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 5, background: 'rgba(91,91,245,0.25)', color: '#a0a8f8' }}>
              {cityNpcs.length} personaje
            </span>
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#7b7bf8', fontWeight: 700 }}>Ziua {day}</span>
            <span>·</span>
            <span>{STAGE_LOCATION_LABEL[stage] || stage}</span>
            {cityNpcs.filter((n) => activeInteractions.has(n.id)).length > 0 && (
              <>
                <span>·</span>
                <span style={{ color: '#10b981' }}>⚡ {cityNpcs.filter((n) => activeInteractions.has(n.id)).length} activi</span>
              </>
            )}
          </span>
        </div>

        {/* Start / Stop simulation */}
        {onToggleSim && (
          <button
            onClick={onToggleSim}
            style={{
              flexShrink: 0,
              background: simPaused ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${simPaused ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.40)'}`,
              color: simPaused ? '#10b981' : '#ef4444',
              borderRadius: 9, padding: '4px 13px',
              cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'Inter,sans-serif',
            }}
          >
            {simPaused ? '▶ START' : '■ STOP'}
          </button>
        )}
      </div>

      {/* ── Bottom status bar ── */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 900, pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(2,4,14,0.88)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '5px 16px',
          fontSize: 11, color: 'rgba(255,255,255,0.45)',
          backdropFilter: 'blur(12px)', boxShadow: T.shadow,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: '#7b7bf8', fontWeight: 600 }}>{CITY_EMOJI[cityName]} {cityName}</span>
          <span>·</span>
          <span>{cityNpcs.length} personaje</span>
          {activeInteractions.size > 0 && (
            <>
              <span>·</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
                {cityNpcs.filter((n) => activeInteractions.has(n.id)).length} interacțiuni active
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── NPC detail panel ── */}
      {selectedNpc && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, zIndex: 900,
          background: 'rgba(3,5,18,0.95)', backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          overflowY: 'auto', scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(91,91,245,0.2) transparent',
        }}>
          <DetailPanel npc={selectedNpc} day={day} stage={stage} allNpcs={allNpcs} onClose={onCloseDetail} />
        </div>
      )}

      {/* ── CSS for markers + animations ── */}
      <style>{`
        .npc-map-icon { background: transparent !important; border: none !important; }
        .npc-map-marker { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; }
        .npc-avatar-ring {
          border-radius: 50%; overflow: hidden; border: 2.5px solid;
          box-shadow: 0 2px 12px rgba(0,0,0,0.5);
          background: #0d1230;
          transition: transform 0.15s;
        }
        .npc-map-marker:hover .npc-avatar-ring { transform: scale(1.08); }
        .npc-map-marker.selected .npc-avatar-ring { transform: scale(1.12); }
        .npc-map-marker.interacting .npc-avatar-ring { animation: markerPulse 1.8s ease-in-out infinite; }
        .npc-info-card {
          background: rgba(3,5,18,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 7px; padding: 3px 8px 4px;
          min-width: 68px; max-width: 110px;
          text-align: center;
        }
        .npc-name { font-family: Inter,sans-serif; font-size: 11px; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .npc-profession { font-family: Inter,sans-serif; font-size: 8.5px; opacity: 0.75; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .npc-energy-bar { height: 2px; background: rgba(255,255,255,0.08); border-radius: 1px; margin-top: 3px; }
        .npc-energy-fill { height: 100%; border-radius: 1px; transition: width 1.5s ease; }
        .npc-chat-badge { position: absolute; top: -4px; right: -4px; font-size: 11px; background: rgba(16,185,129,0.2); border-radius: 50%; padding: 1px; }
        .interaction-line { animation: lineFlow 1.5s linear infinite; }
        @keyframes markerPulse { 0%,100%{box-shadow:0 0 8px var(--mc);} 50%{box-shadow:0 0 20px var(--mc);} }
        @keyframes lineFlow { to { stroke-dashoffset: -20; } }
        @keyframes miniGlobePulse { 0%,100%{opacity:1;box-shadow:0 0 10px #10b981;} 50%{opacity:0.5;box-shadow:0 0 4px #10b981;} }
      `}</style>
    </div>
  )
}
