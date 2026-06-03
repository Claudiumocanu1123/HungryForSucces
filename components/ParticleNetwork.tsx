'use client'

import { useEffect, useRef } from 'react'

// Land-biased colors (greens, yellows, warm tones)
const COLORS = [
  'rgba(134,239,172,',
  'rgba(253,230,138,',
  'rgba(196,181,253,',
  'rgba(167,243,208,',
  'rgba(147,197,253,',
]

const COUNT = 320
const ASSEMBLE_MS = 2800

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

interface Dot {
  startPhi: number; startTheta: number
  targetPhi: number; targetTheta: number
  r: number; color: string
  pulsePhase: number; pulseSpeed: number
}

export default function ParticleNetwork({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const cx = width / 2, cy = height / 2
    const R  = Math.min(width, height) * 0.42

    // All dots start scattered randomly on the sphere surface
    const dots: Dot[] = Array.from({ length: COUNT }, () => {
      const phi   = Math.acos(1 - 2 * Math.random())
      const theta = Math.random() * Math.PI * 2
      return {
        startPhi: phi, startTheta: theta,
        targetPhi: phi, targetTheta: theta,  // overwritten after image loads
        r: 0.9 + Math.random() * 1.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.016 + Math.random() * 0.022,
      }
    })

    let rotY        = 0
    let assembleStart = -1
    let assembled   = false

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      rotY += 0.0018

      const elapsed  = assembleStart < 0 ? 0 : performance.now() - assembleStart
      const progress = assembled ? 1 : (assembleStart < 0 ? 0 : Math.min(1, elapsed / ASSEMBLE_MS))
      if (progress >= 1 && assembleStart >= 0) assembled = true
      const eased = easeInOutCubic(progress)

      type Proj = { x: number; y: number; z: number; r: number; op: number; color: string }

      const proj: Proj[] = dots.map(d => {
        d.pulsePhase += d.pulseSpeed

        // Interpolate from random start → land target on sphere
        const phi   = d.startPhi   + (d.targetPhi   - d.startPhi)   * eased
        const theta = d.startTheta + (d.targetTheta - d.startTheta) * eased

        const t  = theta + rotY
        const x3 =  R * Math.sin(phi) * Math.cos(t)
        const y3 = -R * Math.cos(phi)
        const z3 =  R * Math.sin(phi) * Math.sin(t)
        const depth = z3 / R  // -1 back … +1 front

        const pulse  = 0.85 + 0.15 * Math.sin(d.pulsePhase)
        const opBase = 0.28 + 0.62 * ((depth + 1) / 2)

        return {
          x: cx + x3, y: cy + y3, z: depth,
          r: d.r * pulse * (0.55 + 0.45 * ((depth + 1) / 2)),
          op: opBase * pulse,
          color: d.color,
        }
      })

      proj.sort((a, b) => a.z - b.z)

      // ── Atmosphere glow (grows as globe assembles) ──────────────────────────
      const atmGrd = ctx.createRadialGradient(cx, cy, R * 0.78, cx, cy, R * 1.35)
      atmGrd.addColorStop(0,   `rgba(59,130,246,${(0.14 * eased).toFixed(3)})`)
      atmGrd.addColorStop(0.5, `rgba(96,165,250,${(0.06 * eased).toFixed(3)})`)
      atmGrd.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2)
      ctx.fillStyle = atmGrd
      ctx.fill()

      // ── Faint ocean sphere ──────────────────────────────────────────────────
      if (eased > 0.1) {
        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(59,130,246,${(0.18 * eased).toFixed(3)})`
        ctx.lineWidth   = 1.2
        ctx.stroke()

        // Inner ocean fill (very subtle)
        const oceanGrd = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.25, 0, cx, cy, R)
        oceanGrd.addColorStop(0, `rgba(30,58,138,${(0.18 * eased).toFixed(3)})`)
        oceanGrd.addColorStop(1, `rgba(15,23,42,${(0.25 * eased).toFixed(3)})`)
        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
        ctx.fillStyle = oceanGrd
        ctx.fill()
      }

      // ── Connection lines between nearby land dots ───────────────────────────
      if (eased > 0.45) {
        const connAlpha = (eased - 0.45) / 0.55
        const CONNECT   = R * 0.21
        for (let i = 0; i < proj.length; i++) {
          if (proj[i].z < 0) continue
          for (let j = i + 1; j < proj.length; j++) {
            if (proj[j].z < 0) continue
            const dx   = proj[i].x - proj[j].x
            const dy   = proj[i].y - proj[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > CONNECT) continue
            const a = (1 - dist / CONNECT) * 0.14 * connAlpha * Math.min(proj[i].z + 1, proj[j].z + 1)
            ctx.beginPath()
            ctx.moveTo(proj[i].x, proj[i].y)
            ctx.lineTo(proj[j].x, proj[j].y)
            ctx.strokeStyle = `rgba(147,197,253,${a.toFixed(3)})`
            ctx.lineWidth   = 0.55
            ctx.stroke()
          }
        }
      }

      // ── Dots ────────────────────────────────────────────────────────────────
      for (const p of proj) {
        // Glow halo for front-facing dots
        if (p.z > 0.05) {
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4.5)
          grd.addColorStop(0, `${p.color}${(p.op * 0.45).toFixed(3)})`)
          grd.addColorStop(1, `${p.color}0)`)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 4.5, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0.4, p.r), 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${p.op.toFixed(3)})`
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    // ── Sample land pixels from Earth texture ──────────────────────────────
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const W = 360, H = 180
      const off  = document.createElement('canvas')
      off.width  = W; off.height = H
      const octx = off.getContext('2d')!
      octx.drawImage(img, 0, 0, W, H)
      const { data } = octx.getImageData(0, 0, W, H)

      // Collect land pixel positions (skip poles & pure ocean/black)
      const land: Array<{ phi: number; theta: number }> = []
      for (let y = 4; y < H - 4; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const isOcean = b > r + 22 && b > g + 8 && b > 45
          const isDark  = r < 12 && g < 12 && b < 12
          if (isOcean || isDark) continue
          land.push({
            phi:   (y / H) * Math.PI,
            theta: (x / W) * Math.PI * 2,
          })
        }
      }

      if (land.length < 10) return  // image unusable, stay random

      // Assign each dot a random land target, take the short arc in theta
      dots.forEach(d => {
        const pt = land[Math.floor(Math.random() * land.length)]
        d.targetPhi = pt.phi
        let diff = pt.theta - d.startTheta
        while (diff >  Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        d.targetTheta = d.startTheta + diff
      })

      assembleStart = performance.now()
    }
    img.onerror = () => {
      // Fallback: keep existing random positions, no assembly animation
    }
    img.src = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'

    return () => cancelAnimationFrame(rafRef.current)
  }, [width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
}
