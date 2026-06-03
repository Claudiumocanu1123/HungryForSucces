'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { NPCWithState, DayStage } from '@/types'
import { FeedEvent } from './WorldFeed'

const IasiCityView = dynamic(() => import('./IasiCityView'), {
  ssr: false,
  loading: () => (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#030612', color: 'rgba(255,255,255,0.35)', fontSize: 13,
      flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 40, animation: 'spin 2s linear infinite' }}>🌍</div>
      <div>Se încarcă Iași...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ),
})

export interface CityViewProps {
  initialCity: string
  allNpcs: NPCWithState[]
  day: number
  stage: DayStage
  stageIndex: number
  startedAt: number
  progress: number
  timeOfDay: number
  activeInteractions: Set<string>
  interactionPairs: Array<[string, string]>
  events: FeedEvent[]
  onBack: () => void
  simPaused?: boolean
  onToggleSim?: () => void
}

export default function CityView({
  allNpcs, day, stage, stageIndex, startedAt, progress, timeOfDay,
  activeInteractions, interactionPairs, events, onBack, simPaused, onToggleSim,
}: CityViewProps) {
  return (
    <IasiCityView
      npcs={allNpcs}
      day={day}
      stage={stage}
      stageIndex={stageIndex}
      startedAt={startedAt}
      progress={progress}
      timeOfDay={timeOfDay}
      activeInteractions={activeInteractions}
      interactionPairs={interactionPairs}
      events={events}
      onBack={onBack}
      simPaused={simPaused}
      onToggleSim={onToggleSim}
    />
  )
}
