'use client'

import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react'
import * as THREE from 'three'
import { NPCWithState } from '@/types'
import { T, moodColor } from '@/lib/theme'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Globe = require('react-globe.gl').default

const IASI_LAT = 47.1585
const IASI_LNG = 27.6014
const INITIAL_ALT = 1.55           // cinematic — globe large but fully visible as sphere
const ZOOM_IN_THRESHOLD = 0.13
const MIN_DISTANCE = 100 * (1 + 0.05)
const MAX_DISTANCE = 100 * (1 + 3.5)

const CLOUDS_IMG = '//unpkg.com/three-globe/example/clouds/clouds.png'
const CLOUDS_ALTITUDE = 0.008
const CLOUDS_ROTATION_SPEED = 0.0015

const BORDERS_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

interface CityMarker {
  id: string; name: string; lat: number; lng: number
  npcCount: number; hasInteraction: boolean; avgMood: number
}

interface GlobeViewProps {
  npcs: NPCWithState[]
  activeInteractions: Set<string>
  onCitySelect: (cityName: string) => void
  timeOfDay?: number
  atmosphereColor?: string
  atmosphereAltitude?: number
  sunIntensity?: number
  ambientIntensity?: number
  nightLightsOpacity?: number
}

const NIGHT_IMG = '//unpkg.com/three-globe/example/img/earth-night.jpg'

export default React.memo(function GlobeView({
  npcs, activeInteractions, onCitySelect,
  timeOfDay = 12,
  atmosphereColor = '#9bb8ff',
  atmosphereAltitude = 0.16,
  sunIntensity = 1,
  ambientIntensity = 0.5,
  nightLightsOpacity = 0,
}: GlobeViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 800, h: 600 })
  const lastInteractionRef = useRef(Date.now())
  const cloudsRef     = useRef<THREE.Mesh | null>(null)
  const nightLightsRef = useRef<THREE.Mesh | null>(null)
  const sunLightRef   = useRef<THREE.DirectionalLight | null>(null)
  const ambLightRef   = useRef<THREE.AmbientLight | null>(null)
  const rafRef = useRef<number | null>(null)
  const enteredRef = useRef(false)

  // Refs for live values inside the animation loop (avoids stale closure)
  const timeOfDayRef         = useRef(timeOfDay)
  const sunIntensityRef      = useRef(sunIntensity)
  const ambIntensityRef      = useRef(ambientIntensity)
  const nightLightsOpacityRef = useRef(nightLightsOpacity)

  // Keep refs in sync with props
  useEffect(() => { timeOfDayRef.current         = timeOfDay },         [timeOfDay])
  useEffect(() => { sunIntensityRef.current       = sunIntensity },      [sunIntensity])
  useEffect(() => { ambIntensityRef.current       = ambientIntensity },  [ambientIntensity])
  useEffect(() => { nightLightsOpacityRef.current = nightLightsOpacity },[nightLightsOpacity])

  // Track container size for proper Globe sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    const { width, height } = el.getBoundingClientRect()
    if (width > 0 && height > 0) setDims({ w: Math.floor(width), h: Math.floor(height) })
    return () => ro.disconnect()
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [borders, setBorders] = useState<any[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(BORDERS_URL, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setBorders(d.features ?? []))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  const handleGlobeReady = useCallback(() => {
    const g = globeRef.current
    if (!g) return

    // Europe centered — Romania visible, good day/night split
    g.pointOfView({ lat: 46, lng: 24, altitude: INITIAL_ALT }, 0)
    const c = g.controls()
    if (c) {
      c.minDistance = MIN_DISTANCE
      c.maxDistance = MAX_DISTANCE
      c.enableDamping = true
      c.dampingFactor = 0.1
      c.autoRotateSpeed = 0.2

      c.addEventListener('start', () => {
        lastInteractionRef.current = Date.now()
        c.autoRotate = false
      })

      c.addEventListener('change', () => {
        if (enteredRef.current) return
        const pov = g.pointOfView()
        if (pov.altitude < ZOOM_IN_THRESHOLD) {
          enteredRef.current = true
          c.autoRotate = false
          onCitySelect('Iași')
        }
      })
    }

    const scene = g.scene()
    const globeRadius = g.getGlobeRadius?.() ?? 100

    // ── Dim react-globe.gl defaults (keep a trace for base) ────────────────
    scene.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.DirectionalLight && !obj.userData.isSim) obj.intensity = 0
      if (obj instanceof THREE.AmbientLight    && !obj.userData.isSim) obj.intensity = 0
    })

    // ── Permanent "starlight" ambient — globe shape always visible ──────────
    // Independent of time; simulates reflected light from stars/galaxy
    const baseAmb = new THREE.AmbientLight(0x1a2a4a, 0.22)
    baseAmb.userData.isSim = true
    scene.add(baseAmb)

    // ── Time-varying sun (directional) ──────────────────────────────────────
    const sun = new THREE.DirectionalLight(0xfff6d8, 5.0)
    sun.userData.isSim = true
    scene.add(sun)
    sunLightRef.current = sun

    // ── Time-varying fill ambient (day gets more light) ─────────────────────
    const amb = new THREE.AmbientLight(0x1a3060, 0.5)
    amb.userData.isSim = true
    scene.add(amb)
    ambLightRef.current = amb

    // ── Rim/back light — opposite the sun, adds edge glow to dark side ──────
    const rimLight = new THREE.DirectionalLight(0x2040a0, 0.30)
    rimLight.userData.isSim = true
    rimLight.position.set(-200, 80, -200)
    scene.add(rimLight)

    const loader = new THREE.TextureLoader()

    // ── City-lights night texture (AdditiveBlending overlay) ────────────────
    loader.load(NIGHT_IMG, (tex) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(globeRadius * 1.001, 64, 32),
        new THREE.MeshBasicMaterial({
          map: tex,
          blending: THREE.AdditiveBlending,
          opacity: nightLightsOpacityRef.current,
          transparent: true,
          depthWrite: false,
        })
      )
      scene.add(mesh)
      nightLightsRef.current = mesh
    })

    // ── Cloud layer ─────────────────────────────────────────────────────────
    loader.load(CLOUDS_IMG, (tex) => {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(globeRadius * (1 + CLOUDS_ALTITUDE), 32, 32),
        new THREE.MeshPhongMaterial({ map: tex, transparent: true, opacity: 0.35, depthWrite: false })
      )
      scene.add(clouds)
      cloudsRef.current = clouds

      // ── Animation loop: clouds + sun position + night lights ─────────────
      let lastFrame = 0
      const animate = (ts: number) => {
        rafRef.current = requestAnimationFrame(animate)
        // Throttle to ~30fps — Three.js scene renders at its own rate
        if (ts - lastFrame < 32) return
        lastFrame = ts

        // Clouds
        if (cloudsRef.current) cloudsRef.current.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180

        // Sun position — orbits globe based on time of day
        if (sunLightRef.current) {
          const tod   = timeOfDayRef.current
          const angle = ((tod / 24) - 0.25) * Math.PI * 2
          const dist  = globeRadius * 12
          sunLightRef.current.position.set(
            Math.cos(angle) * dist,
            Math.sin(tod < 12 ? tod / 12 : (24 - tod) / 12) * dist * 0.6,
            Math.sin(angle) * dist
          )
          // Sun bright during day, near-zero at night
          sunLightRef.current.intensity = Math.max(sunIntensityRef.current, 0) * 4.8
        }

        // Time-varying fill — more light during day, near-zero at night
        if (ambLightRef.current) {
          ambLightRef.current.intensity = ambIntensityRef.current * 0.9
        }

        // Night lights: lerp faster toward target, brighter at night
        if (nightLightsRef.current) {
          const mat = nightLightsRef.current.material as THREE.MeshBasicMaterial
          const target = Math.min(nightLightsOpacityRef.current * 1.2, 1.0)
          mat.opacity += (target - mat.opacity) * 0.08
        }
      }
      rafRef.current = requestAnimationFrame(animate)
    })
  }, [onCitySelect])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      for (const ref of [cloudsRef, nightLightsRef]) {
        const m = ref.current
        if (m) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.parent?.remove(m); ref.current = null }
      }
    }
  }, [])

  // Auto-rotation after 6s idle
  useEffect(() => {
    const h = setInterval(() => {
      const c = globeRef.current?.controls()
      if (!c) return
      const idle = Date.now() - lastInteractionRef.current > 6000
      if (c.autoRotate !== idle) c.autoRotate = idle
    }, 3000)
    return () => clearInterval(h)
  }, [])

  // ── City markers — grouped by city ──
  const cityMarkers: CityMarker[] = useMemo(() => {
    const map = new Map<string, CityMarker>()
    for (const npc of npcs) {
      const cityKey = npc.city
      if (!map.has(cityKey)) {
        map.set(cityKey, {
          id: cityKey, name: cityKey,
          lat: npc.lat, lng: npc.lng,
          npcCount: 0, hasInteraction: false, avgMood: 0,
        })
      }
      const c = map.get(cityKey)!
      c.npcCount++
      c.avgMood += (npc.currentState?.mood ?? 70)
      if (activeInteractions.has(npc.id)) c.hasInteraction = true
    }
    map.forEach((c) => { c.avgMood = c.avgMood / c.npcCount })
    return Array.from(map.values())
  }, [npcs, activeInteractions])

  // Stabilize HTML data — avoid Globe recreating DOM each poll
  const stableHtmlRef = useRef<CityMarker[]>([])
  const prevFp = useRef('')
  const allHtml: CityMarker[] = useMemo(() => {
    const fp = cityMarkers.map((c) => `${c.id}:${c.npcCount}:${c.hasInteraction ? 1 : 0}:${Math.round(c.avgMood)}`).join('|')
    if (fp === prevFp.current) return stableHtmlRef.current
    prevFp.current = fp
    stableHtmlRef.current = cityMarkers
    return cityMarkers
  }, [cityMarkers])

  const ringsData = useMemo(() => cityMarkers.filter((c) => c.hasInteraction), [cityMarkers])

  // Inject radar + city keyframes into document head once
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'globe-marker-kf'
    style.textContent = `
      @keyframes iasiSweep { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
      @keyframes iasiPulse { 0%,100%{opacity:1;box-shadow:0 0 16px #5bf5b4,0 0 36px rgba(91,245,180,0.5);} 50%{opacity:0.55;box-shadow:0 0 8px #5bf5b4,0 0 16px rgba(91,245,180,0.2);} }
      @keyframes iasiRingOut { 0%{transform:scale(1);opacity:0.5;} 100%{transform:scale(2.2);opacity:0;} }
      @keyframes cityPulse { 0%,100%{transform:scale(1);opacity:0.9;} 50%{transform:scale(1.28);opacity:1;} }
      @keyframes cityRingExpand { 0%,100%{transform:scale(1);opacity:0.5;} 50%{transform:scale(1.6);opacity:0;} }
    `
    if (!document.getElementById('globe-marker-kf')) document.head.appendChild(style)
    return () => { document.getElementById('globe-marker-kf')?.remove() }
  }, [])

  const htmlAltitude = useCallback(() => 0.05, [])

  const htmlElement = useCallback((d: object) => {
    const cm = d as CityMarker
    const isIasi = cm.name === 'Iași' || cm.id === 'Iași'
    const mc = moodColor(cm.avgMood)
    const gc = cm.hasInteraction ? '#10b981' : mc
    const el = document.createElement('div')
    el.style.cssText = 'cursor:pointer;pointer-events:auto;'

    if (isIasi) {
      // ── Holographic radar display ────────────────────────────────────────
      const R = 86  // radar diameter px
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
          <div style="position:relative;width:${R}px;height:${R}px;">
            <!-- Outer pulse ring -->
            <div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(91,245,180,0.18);animation:iasiRingOut 2.8s ease-out infinite;pointer-events:none;"></div>
            <!-- Concentric rings -->
            <div style="position:absolute;inset:0;border-radius:50%;border:1px solid rgba(91,245,180,0.20);"></div>
            <div style="position:absolute;inset:10px;border-radius:50%;border:1px solid rgba(91,245,180,0.30);"></div>
            <div style="position:absolute;inset:20px;border-radius:50%;border:1px solid rgba(91,245,180,0.45);"></div>
            <div style="position:absolute;inset:30px;border-radius:50%;border:1px solid rgba(91,245,180,0.65);"></div>
            <div style="position:absolute;inset:38px;border-radius:50%;border:1px solid rgba(91,245,180,0.85);"></div>
            <!-- Crosshair H -->
            <div style="position:absolute;top:50%;left:5px;right:5px;height:1px;background:linear-gradient(90deg,transparent,rgba(91,245,180,0.30),rgba(91,245,180,0.30),transparent);transform:translateY(-50%);pointer-events:none;"></div>
            <!-- Crosshair V -->
            <div style="position:absolute;left:50%;top:5px;bottom:5px;width:1px;background:linear-gradient(180deg,transparent,rgba(91,245,180,0.30),rgba(91,245,180,0.30),transparent);transform:translateX(-50%);pointer-events:none;"></div>
            <!-- Rotating conic sweep -->
            <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none;">
              <div style="width:100%;height:100%;background:conic-gradient(from 0deg,rgba(91,245,180,0) 0%,rgba(91,245,180,0.28) 45%,rgba(91,245,180,0) 60%);animation:iasiSweep 3.5s linear infinite;"></div>
            </div>
            <!-- Data dots on rings -->
            <div style="position:absolute;top:7px;left:50%;width:4px;height:4px;border-radius:50%;background:rgba(91,245,180,0.7);transform:translateX(-50%);box-shadow:0 0 6px rgba(91,245,180,0.8);pointer-events:none;"></div>
            <div style="position:absolute;right:8px;top:38%;width:3px;height:3px;border-radius:50%;background:rgba(91,245,180,0.55);pointer-events:none;"></div>
            <div style="position:absolute;bottom:11px;left:28%;width:3px;height:3px;border-radius:50%;background:rgba(91,245,180,0.45);pointer-events:none;"></div>
            <div style="position:absolute;top:26%;left:10px;width:2px;height:2px;border-radius:50%;background:rgba(91,245,180,0.4);pointer-events:none;"></div>
            <!-- Center dot -->
            <div style="position:absolute;top:50%;left:50%;width:10px;height:10px;border-radius:50%;background:#5bf5b4;transform:translate(-50%,-50%);animation:iasiPulse 1.8s ease-in-out infinite;pointer-events:none;"></div>
            <!-- Coord readout top-left -->
            <div style="position:absolute;top:2px;left:3px;font-family:monospace;font-size:6.5px;color:rgba(91,245,180,0.55);line-height:1.5;letter-spacing:0.02em;pointer-events:none;">
              47.15°N<br>27.60°E
            </div>
            <!-- NPC count top-right -->
            <div style="position:absolute;top:2px;right:3px;font-family:monospace;font-size:6.5px;color:rgba(91,245,180,0.55);text-align:right;line-height:1.5;pointer-events:none;">
              ${cm.npcCount} OBJ<br>LOCK
            </div>
          </div>
          <!-- Label -->
          <div style="background:rgba(5,8,22,0.94);border:1px solid rgba(91,245,180,0.55);color:#fff;font-size:11px;font-weight:700;padding:3px 14px;border-radius:6px;white-space:nowrap;font-family:Inter,sans-serif;box-shadow:0 0 22px rgba(91,245,180,0.12),inset 0 0 16px rgba(91,245,180,0.05);letter-spacing:0.03em;">
            IAȘI &nbsp;<span style="color:rgba(91,245,180,0.65);font-size:9px;font-weight:500;">${cm.npcCount} personaje</span>
          </div>
        </div>`
    } else {
      // ── Enhanced standard city marker ────────────────────────────────────
      const sz = 11 + cm.npcCount * 5
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${gc};box-shadow:0 0 ${sz}px ${gc}bb,0 0 ${sz*2}px ${gc}44;${cm.hasInteraction ? 'animation:cityPulse 2s ease-in-out infinite;' : ''}"></div>
            ${cm.hasInteraction ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:1px solid ${gc}55;animation:cityRingExpand 2.2s ease-out infinite;pointer-events:none;"></div>` : ''}
          </div>
          <div style="background:rgba(5,8,22,0.90);border:1px solid ${gc}55;color:#fff;font-size:10px;font-weight:700;padding:2px 9px;border-radius:6px;white-space:nowrap;font-family:Inter,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.45);letter-spacing:0.01em;">
            ${cm.name}<span style="opacity:0.40;font-size:8.5px;font-weight:500;"> ${cm.npcCount}</span>
          </div>
        </div>`
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      lastInteractionRef.current = Date.now()
      onCitySelect(cm.id)
    })
    return el
  }, [onCitySelect])

  // Polygon accessors — stable, built once
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRomania = (f: any) => {
    const p = f?.properties ?? {}
    return p.ADMIN === 'Romania' || p.NAME === 'Romania' || p.SOVEREIGNT === 'Romania'
  }
  const polygonCapColor = useCallback((f: object) => isRomania(f) ? 'rgba(91,91,245,0.18)' : 'rgba(0,0,0,0)', [])
  const polygonSideColor = useCallback(() => 'rgba(0,0,0,0)', [])
  const polygonStrokeColor = useCallback((f: object) => isRomania(f) ? '#7b7bf8' : 'rgba(255,255,255,0.35)', [])
  const polygonAltitude = useCallback((f: object) => isRomania(f) ? 0.012 : 0.006, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      onMouseMove={() => { lastInteractionRef.current = Date.now() }}
      onTouchStart={() => { lastInteractionRef.current = Date.now() }}
    >
      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(5,8,22,0.80)', border: `1px solid ${T.border}`,
          borderRadius: 20, padding: '6px 18px', fontSize: 11, color: T.textSoft,
          backdropFilter: 'blur(10px)', boxShadow: T.shadow, fontWeight: 500,
        }}>
          🔍 Zoom in sau click pe <b style={{ color: T.accent }}>Iași</b> pentru a intra
        </div>
      </div>

      <Globe
        ref={globeRef}
        onGlobeReady={handleGlobeReady}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"

        polygonsData={borders}
        polygonCapColor={polygonCapColor}
        polygonSideColor={polygonSideColor}
        polygonStrokeColor={polygonStrokeColor}
        polygonAltitude={polygonAltitude}

        htmlElementsData={allHtml}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={htmlAltitude}
        htmlElement={htmlElement}

        ringsData={ringsData}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => 'rgba(16,185,129,0.5)'}
        ringMaxRadius={3}
        ringPropagationSpeed={1.5}
        ringRepeatPeriod={1000}

        atmosphereColor={atmosphereColor}
        atmosphereAltitude={atmosphereAltitude}
        width={dims.w}
        height={dims.h}
      />

    </div>
  )
})
