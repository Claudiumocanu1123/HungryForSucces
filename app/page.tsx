'use client'

import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { NPC, NPCWithState, DayStage, STAGE_TIMES, STAGES } from '@/types'
import DetailPanel from '@/components/DetailPanel'
import NPCModal from '@/components/NPCModal'
import LandingPage from '@/components/LandingPage'
import { FeedEvent } from '@/components/WorldFeed'
import CityView from '@/components/CityView'
import { T } from '@/lib/theme'
import { useDayTime } from '@/lib/useDayTime'
import SkyBackground from '@/components/SkyBackground'
import TopNav from '@/components/ui/TopNav'
import NPCPanel from '@/components/ui/NPCPanel'
import InfoPanel from '@/components/ui/InfoPanel'

const GlobeView = dynamic(() => import('@/components/GlobeView'), { ssr: false })

const INTRO_KEY = 'lifesim_intro_done'

interface SimState {
  day: number
  stage: DayStage
  stageIndex: number
  progress: number
  startedAt: number
  paused?: boolean
}

type ViewMode =
  | { mode: 'globe' }
  | { mode: 'city'; cityName: string }

export default function HomePage() {
  const [introDone, setIntroDone] = useState<boolean>(false)
  const [npcs, setNpcs] = useState<NPCWithState[]>([])
  const [simState, setSimState] = useState<SimState>({
    day: 1, stage: 'WAKE_UP', stageIndex: 0, progress: 0, startedAt: Date.now(),
  })
  const [viewMode, setViewMode] = useState<ViewMode>({ mode: 'globe' })
  const [globeSelectedNpc, setGlobeSelectedNpc] = useState<NPCWithState | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingNpc, setEditingNpc] = useState<NPC | null>(null)
  const [activeInteractions, setActiveInteractions] = useState<Set<string>>(new Set())
  const [interactionPairs, setInteractionPairs] = useState<Array<[string, string]>>([])
  const [activityFeed, setActivityFeed] = useState<FeedEvent[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { timeOfDay, theme } = useDayTime({
    stageIndex: simState.stageIndex,
    startedAt:  simState.startedAt,
  })

  const fetchAll = useCallback(async () => {
    try {
      const [simRes, npcsRes] = await Promise.all([
        fetch('/api/simulation'),
        fetch('/api/npcs'),
      ])
      if (simRes.ok) setSimState(await simRes.json())
      if (npcsRes.ok) {
        const n: NPCWithState[] = await npcsRes.json()
        setNpcs(n)

        const interacting = new Set<string>()
        const pairsSeen = new Set<string>()
        const pairs: Array<[string, string]> = []
        for (const npc of n) {
          for (const evt of npc.currentState?.events ?? []) {
            if (evt.type === 'INTERACTION' && evt.involvedNPCs) {
              evt.involvedNPCs.forEach((id) => interacting.add(id))
              if (evt.involvedNPCs.length >= 2) {
                const sorted = [...evt.involvedNPCs].sort()
                const key = sorted.join('|')
                if (!pairsSeen.has(key)) { pairsSeen.add(key); pairs.push([sorted[0], sorted[1]]) }
              }
            }
          }
        }
        setActiveInteractions(interacting)
        setInteractionPairs(pairs)

        // Build feed
        const stageOrder: Record<string, number> = {}
        STAGES.forEach((s, i) => { stageOrder[s] = i })
        const feedMap = new Map<string, FeedEvent>()
        for (const npc of n) {
          const st = npc.currentState
          if (!st) continue
          for (const evt of st.events) {
            const id = `${npc.id}-${st.stage}-${evt.type}-${evt.description.slice(0, 28)}`
            feedMap.set(id, { id, time: STAGE_TIMES[st.stage], text: evt.description, npcId: npc.id, type: evt.type })
          }
        }
        const feed = Array.from(feedMap.values()).sort((a, b) => {
          const nA = n.find((x) => x.id === a.npcId); const nB = n.find((x) => x.id === b.npcId)
          const sA = stageOrder[nA?.currentState?.stage ?? 'WAKE_UP'] ?? 0
          const sB = stageOrder[nB?.currentState?.stage ?? 'WAKE_UP'] ?? 0
          return sB - sA
        })
        setActivityFeed(feed.slice(0, 25))

        setGlobeSelectedNpc((prev) => prev ? (n.find((x) => x.id === prev.id) ?? null) : null)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!introDone) return
    fetchAll()
    pollRef.current = setInterval(fetchAll, 3500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll, introDone])

  const handleCitySelect = useCallback((cityName: string) => {
    setViewMode({ mode: 'city', cityName })
    setGlobeSelectedNpc(null)
  }, [])
  const handleBackToGlobe = useCallback(() => setViewMode({ mode: 'globe' }), [])
  const handleSelectNpc = useCallback((npc: NPCWithState) => setGlobeSelectedNpc(npc), [])
  const handleCloseDetail = useCallback(() => setGlobeSelectedNpc(null), [])
  const handleSelectNpcById = useCallback((id: string) => {
    const found = npcs.find((n) => n.id === id)
    if (found) setGlobeSelectedNpc(found)
  }, [npcs])
  const handleOpenModal = useCallback((npc?: NPC) => { setEditingNpc(npc ?? null); setShowModal(true) }, [])
  const handleSaveNpc = useCallback(async (data: Partial<NPC> & { id?: string }) => {
    if (data.id && npcs.find((n) => n.id === data.id)) {
      await fetch(`/api/npcs/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    } else {
      await fetch('/api/npcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    }
    setShowModal(false)
    await fetchAll()
  }, [npcs, fetchAll])

  const handleLandingStart = useCallback(() => {
    try { localStorage.setItem(INTRO_KEY, '1') } catch {}
    setIntroDone(true)
  }, [])

  if (!introDone) {
    return <LandingPage onStart={handleLandingStart} />
  }

  const inCityMode = viewMode.mode === 'city'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: '#010208',
      position: 'relative',
    }}>
      {/* Space starfield canvas — behind everything */}
      <SkyBackground timeOfDay={timeOfDay} theme={theme} spaceMode={true} />

      {/* ── Unified top nav ── */}
      <TopNav
        day={simState.day}
        stage={simState.stage}
        stageIndex={simState.stageIndex}
        startedAt={simState.startedAt}
        npcs={npcs}
        simPaused={simState.paused}
        viewMode={viewMode}
        onToggleSim={async () => {
          const action = simState.paused ? 'resume' : 'pause'
          await fetch('/api/simulation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
          await fetchAll()
        }}
        onClearStories={async () => {
          await fetch('/api/simulation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clearStories' }) })
        }}
        onOpenSettings={() => { try { localStorage.removeItem(INTRO_KEY) } catch {} setIntroDone(false) }}
        onAddNpc={() => handleOpenModal()}
        onBackToGlobe={inCityMode ? handleBackToGlobe : undefined}
      />

      {/* ── Main content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 2 }}>

        {inCityMode ? (
          <CityView
            initialCity={viewMode.cityName}
            allNpcs={npcs}
            day={simState.day}
            stage={simState.stage}
            stageIndex={simState.stageIndex}
            startedAt={simState.startedAt}
            progress={simState.progress}
            timeOfDay={timeOfDay}
            activeInteractions={activeInteractions}
            interactionPairs={interactionPairs}
            events={activityFeed}
            onBack={handleBackToGlobe}
            simPaused={simState.paused}
            onToggleSim={async () => {
              const action = simState.paused ? 'resume' : 'pause'
              await fetch('/api/simulation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
              await fetchAll()
            }}
          />
        ) : (
          <>
            {/* Left: NPC Panel */}
            <NPCPanel
              npcs={npcs}
              selectedId={globeSelectedNpc?.id ?? null}
              activeInteractions={activeInteractions}
              interactionPairs={interactionPairs}
              onSelect={handleSelectNpc}
            />

            {/* Center: Globe */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <GlobeView
                npcs={npcs}
                activeInteractions={activeInteractions}
                onCitySelect={handleCitySelect}
                timeOfDay={timeOfDay}
                atmosphereColor={theme.atmosphereColor}
                atmosphereAltitude={theme.atmosphereAltitude}
                sunIntensity={theme.sunIntensity}
                ambientIntensity={theme.ambientIntensity}
                nightLightsOpacity={theme.nightLightsOpacity}
              />
              {/* Stage progress stripe */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{
                  height: '100%', width: `${simState.progress * 100}%`,
                  background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`,
                  transition: 'width 1s linear',
                }} />
              </div>
            </div>

            {/* Right: InfoPanel or DetailPanel */}
            {globeSelectedNpc ? (
              <DetailPanel
                npc={globeSelectedNpc}
                day={simState.day}
                stage={simState.stage}
                onClose={handleCloseDetail}
                allNpcs={npcs}
              />
            ) : (
              <InfoPanel
                npcs={npcs}
                events={activityFeed}
                activeInteractions={activeInteractions}
                day={simState.day}
                stage={simState.stage}
                stageIndex={simState.stageIndex}
                startedAt={simState.startedAt}
                timeOfDay={timeOfDay}
                onSelectNpc={handleSelectNpcById}
              />
            )}
          </>
        )}
      </div>

      {showModal && (
        <NPCModal
          npc={editingNpc}
          existingNPCs={npcs}
          onSave={handleSaveNpc}
          onClose={() => setShowModal(false)}
        />
      )}

    </div>
  )
}
