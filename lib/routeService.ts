'use client'

// ── Route cache (client-side, session-scoped) ─────────────────────────────────
const _cache = new Map<string, [number, number][]>()

function key(a: [number, number], b: [number, number]): string {
  return `${a[0].toFixed(4)},${a[1].toFixed(4)}→${b[0].toFixed(4)},${b[1].toFixed(4)}`
}

// ── Approximate city route (instant fallback) ─────────────────────────────────
// Adds a subtle L-shaped / zigzag path to simulate city blocks
function approxRoute(a: [number, number], b: [number, number]): [number, number][] {
  const N = 32
  const pts: [number, number][] = []
  const dlat = b[0] - a[0]
  const dlng = b[1] - a[1]

  for (let i = 0; i <= N; i++) {
    const t = i / N
    // Bezier-like curve: go along lat first, then lng (simulates turning at corners)
    const lt = t < 0.5 ? t * 2 : 1
    const ln = t < 0.5 ? 0 : (t - 0.5) * 2
    // Small perpendicular wave adds road-like wiggle
    const wave = Math.sin(t * Math.PI * 4) * 0.00015
    pts.push([
      a[0] + dlat * lt + wave,
      a[1] + dlng * ln + wave * 0.6,
    ])
  }
  return pts
}

// ── OSRM fetch with approx fallback ──────────────────────────────────────────
export async function fetchRoute(
  a: [number, number],
  b: [number, number]
): Promise<[number, number][]> {
  const k = key(a, b)
  if (_cache.has(k)) return _cache.get(k)!

  // Immediately store approx so callers don't wait for network
  const approx = approxRoute(a, b)
  _cache.set(k, approx)

  try {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 6000)
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(tid)
    const d = await res.json()
    const coords: [number, number][] | undefined = d?.routes?.[0]?.geometry?.coordinates
    if (coords?.length && coords.length > 2) {
      const route = coords.map(([lng, lat]) => [lat, lng] as [number, number])
      // Snap endpoints to exact requested coords (OSRM snaps to nearest road)
      route[0] = a
      route[route.length - 1] = b
      _cache.set(k, route)   // upgrade cache with real route
      return route
    }
  } catch { /* use approx */ }

  return approx
}

// Reverse a route (for return trips)
export function reverseRoute(r: [number, number][]): [number, number][] {
  return [...r].reverse()
}

// ── Get position at fraction t (0→1) along route, distance-weighted ──────────
export function posOnRoute(route: [number, number][], t: number): [number, number] {
  if (!route.length) return [47.1585, 27.6014]
  if (t <= 0) return route[0]
  if (t >= 1) return route[route.length - 1]

  // Compute segment lengths
  let total = 0
  const lens: number[] = []
  for (let i = 1; i < route.length; i++) {
    const d = Math.hypot(
      route[i][0] - route[i - 1][0],
      (route[i][1] - route[i - 1][1]) * 0.65  // lng correction for lat 47°
    )
    lens.push(d)
    total += d
  }
  if (total === 0) return route[0]

  const target = total * t
  let acc = 0
  for (let i = 0; i < lens.length; i++) {
    if (acc + lens[i] >= target) {
      const s = lens[i] > 0 ? (target - acc) / lens[i] : 0
      return [
        route[i][0] + (route[i + 1][0] - route[i][0]) * s,
        route[i][1] + (route[i + 1][1] - route[i][1]) * s,
      ]
    }
    acc += lens[i]
  }
  return route[route.length - 1]
}

// ── Route length in km ────────────────────────────────────────────────────────
export function routeLengthKm(route: [number, number][]): number {
  const R = 6371
  let d = 0
  for (let i = 1; i < route.length; i++) {
    const lat1 = (route[i - 1][0] * Math.PI) / 180
    const lat2 = (route[i][0] * Math.PI) / 180
    const dlat = lat2 - lat1
    const dlng = ((route[i][1] - route[i - 1][1]) * Math.PI) / 180
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2
    d += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return d
}
