'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Globe, { GlobeMethods } from 'react-globe.gl'
import * as THREE from 'three'

const ROMANIA_LAT = 45.9432
const ROMANIA_LNG = 24.9668
const BORDERS_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoFeat = { properties: Record<string, any> }

interface LandingGlobeProps { width: number; height: number; cinematic?: boolean }

export default function LandingGlobe({ width, height, cinematic = true }: LandingGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [borders, setBorders] = useState<{ features: GeoFeat[] } | null>(null)
  const cloudsRef = useRef<THREE.Mesh | null>(null)
  const rafRef = useRef<number>(0)
  const readyRef = useRef(false)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(BORDERS_URL, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setBorders)
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  const handleGlobeReady = useCallback(() => {
    const gl = globeRef.current
    if (!gl || readyRef.current) return
    readyRef.current = true

    // Force WebGL renderer to be fully transparent — fixes the "square box" artifact.
    // globe.gl creates its renderer with alpha:true, so setClearAlpha(0) works reliably.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderer = (gl as any).renderer?.()
      if (renderer) {
        renderer.setClearColor(0x000000, 0)
      }
    } catch { /* ignore */ }

    if (cinematic) {
      // Cinematic entrance: start far out, slightly off-center
      gl.pointOfView({ lat: 28, lng: 5, altitude: 2.8 }, 0)
      // Slow zoom to Romania over 2.4s — "entering a living world"
      setTimeout(() => {
        gl.pointOfView({ lat: ROMANIA_LAT, lng: ROMANIA_LNG, altitude: 0.52 }, 2400)
      }, 350)
    } else {
      // Mini decorative globe — start directly at Romania
      gl.pointOfView({ lat: ROMANIA_LAT, lng: ROMANIA_LNG, altitude: 0.85 }, 0)
    }

    const controls = gl.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.35
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableRotate = false

    // Cloud layer
    new THREE.TextureLoader().load(
      '//unpkg.com/three-globe/example/clouds/clouds.png',
      (tex) => {
        const geo = new THREE.SphereGeometry(100 * 1.005, 32, 32)
        const mat = new THREE.MeshPhongMaterial({ map: tex, transparent: true, opacity: 0.20 })
        const mesh = new THREE.Mesh(geo, mat)
        cloudsRef.current = mesh
        gl.scene().add(mesh)
        const tick = () => {
          if (cloudsRef.current) cloudsRef.current.rotation.y += 0.00022
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
    )
  }, [])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (cloudsRef.current) {
        cloudsRef.current.geometry.dispose()
        ;(cloudsRef.current.material as THREE.MeshPhongMaterial).map?.dispose()
        ;(cloudsRef.current.material as THREE.MeshPhongMaterial).dispose()
      }
    }
  }, [])

  const isRom = useCallback((feat: object) => {
    const p = (feat as GeoFeat).properties
    return p.ADMIN === 'Romania' || p.NAME === 'Romania' || p.SOVEREIGNT === 'Romania'
  }, [])

  const capColor   = useCallback((f: object) => isRom(f) ? 'rgba(91,91,245,0.22)' : 'rgba(200,215,240,0.04)', [isRom])
  const sideColor  = useCallback((f: object) => isRom(f) ? 'rgba(91,91,245,0.60)' : 'rgba(180,205,225,0.07)', [isRom])
  const strokeColor= useCallback((f: object) => isRom(f) ? '#7b7bf8'              : 'rgba(180,205,225,0.22)', [isRom])
  const polyAlt    = useCallback((f: object) => isRom(f) ? 0.009                  : 0.001,                   [isRom])

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      atmosphereColor="#b0c8ff"
      atmosphereAltitude={0.30}
      backgroundColor="rgba(0,0,0,0)"
      polygonsData={borders?.features ?? []}
      polygonCapColor={capColor}
      polygonSideColor={sideColor}
      polygonStrokeColor={strokeColor}
      polygonAltitude={polyAlt}
      onGlobeReady={handleGlobeReady}
    />
  )
}
