'use client'

import { NPCWithState } from '@/types'

interface BottomBarProps {
  npcs: NPCWithState[]
  selectedNpcId: string | null
  activeInteractions: Set<string>
  onSelectNpc: (npc: NPCWithState) => void
  onAddNpc: () => void
}

function getMoodColor(mood: number): string {
  if (mood > 70) return '#00ff88'
  if (mood >= 40) return '#ffd700'
  return '#ff4444'
}

function getMoodEmoji(mood: number): string {
  if (mood > 70) return '😊'
  if (mood >= 40) return '😐'
  return '😔'
}

export default function BottomBar({
  npcs,
  selectedNpcId,
  activeInteractions,
  onSelectNpc,
  onAddNpc,
}: BottomBarProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 overflow-x-auto"
      style={{
        background: 'rgba(8,8,24,0.9)',
        borderTop: '1px solid rgba(0,212,255,0.15)',
        backdropFilter: 'blur(12px)',
        scrollbarWidth: 'thin',
        scrollbarColor: '#00d4ff44 transparent',
      }}
    >
      <button
        onClick={onAddNpc}
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all hover:scale-110"
        style={{
          background: 'rgba(0,212,255,0.15)',
          border: '1px solid rgba(0,212,255,0.4)',
          color: '#00d4ff',
        }}
        title="Adaugă NPC"
      >
        +
      </button>

      {npcs.map((npc) => {
        const mood = npc.currentState?.mood ?? 70
        const energy = npc.currentState?.energy ?? 70
        const color = getMoodColor(mood)
        const isSelected = selectedNpcId === npc.id
        const isInteracting = activeInteractions.has(npc.id)

        return (
          <button
            key={npc.id}
            onClick={() => onSelectNpc(npc)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:scale-105 relative"
            style={{
              background: isSelected ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
              border: isSelected
                ? '1px solid rgba(0,212,255,0.6)'
                : '1px solid rgba(255,255,255,0.1)',
              minWidth: 'max-content',
            }}
          >
            {isInteracting && (
              <span
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping"
                style={{ background: 'white', opacity: 0.8 }}
              />
            )}
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            />
            <span className="text-xs font-medium text-white whitespace-nowrap">
              {npc.name.split(' ')[0]}
            </span>
            <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">
              · {npc.profession}
            </span>
            <span className="text-xs text-gray-400 whitespace-nowrap hidden md:block">
              · {npc.city.split('-')[0]}
            </span>
            <span className="text-xs whitespace-nowrap" style={{ color: '#00d4ff' }}>
              ⚡{energy}%
            </span>
            <span className="text-sm">{getMoodEmoji(mood)}</span>
          </button>
        )
      })}
    </div>
  )
}
