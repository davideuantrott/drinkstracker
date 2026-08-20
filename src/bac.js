function _bacParams(settings) {
  const r = settings.gender === 'female' ? 0.55 : 0.68
  const weightKg = settings.weightUnit === 'lb'
    ? parseFloat(settings.weightKg) * 0.453592
    : parseFloat(settings.weightKg)
  return { r, weightKg }
}

// Pool model: liver metabolises at 0.15‰/h from the combined pool, not per-drink.
// Process drinks in chronological order, drain the pool between each, then drain to target time.
function _poolBAC(drinks, targetMs, r, weightKg) {
  if (drinks.length === 0) return 0
  const sorted = [...drinks].sort((a, b) => a.timestamp - b.timestamp)
  let pool = 0
  let prevMs = sorted[0].timestamp
  for (const d of sorted) {
    pool = Math.max(0, pool - 0.15 * (d.timestamp - prevMs) / 3600000)
    pool += (d.volumeMl * d.abv / 100) * 0.789 / (weightKg * r)
    prevMs = d.timestamp
  }
  return Math.max(0, pool - 0.15 * (targetMs - prevMs) / 3600000)
}

export function calcBACPermille(drinks, settings) {
  const { r, weightKg } = _bacParams(settings)
  return _poolBAC(drinks, Date.now(), r, weightKg)
}

export function calcBACAtTime(drinks, atTime, settings) {
  const { r, weightKg } = _bacParams(settings)
  return _poolBAC(drinks.filter(d => d.timestamp <= atTime), atTime, r, weightKg)
}

// Exact knots of the BAC curve over [tStart, tEnd].
// The pool model is piecewise linear — a vertical step at each drink, then a
// constant 0.15‰/h decay — so a handful of knots reproduces it exactly. Fixed
// sampling would clip every peak by up to (interval × 0.15‰/h), which is what
// made the Now chart disagree with the BAC readout above it.
export function bacCurvePoints(drinks, tStart, tEnd, settings) {
  const { r, weightKg } = _bacParams(settings)
  const sorted = drinks
    .filter(d => d.timestamp <= tEnd)
    .sort((a, b) => a.timestamp - b.timestamp)

  const knots = []
  let pool = 0
  let prevMs = sorted.length ? sorted[0].timestamp : tStart
  knots.push({ t: prevMs, v: 0 })

  for (const d of sorted) {
    const before = Math.max(0, pool - 0.15 * (d.timestamp - prevMs) / 3600000)
    const zeroMs = prevMs + (pool / 0.15) * 3600000
    if (pool > 0 && zeroMs < d.timestamp) knots.push({ t: zeroMs, v: 0 })
    knots.push({ t: d.timestamp, v: before })
    pool = before + (d.volumeMl * d.abv / 100) * 0.789 / (weightKg * r)
    knots.push({ t: d.timestamp, v: pool })
    prevMs = d.timestamp
  }

  const zeroMs = prevMs + (pool / 0.15) * 3600000
  if (pool > 0 && zeroMs < tEnd) knots.push({ t: zeroMs, v: 0 })
  knots.push({ t: tEnd, v: Math.max(0, pool - 0.15 * (tEnd - prevMs) / 3600000) })
  if (knots[0].t > tStart) knots.unshift({ t: tStart, v: 0 })

  return _clipSeries(knots, tStart, tEnd)
}

// Trim a knot list to the visible window, interpolating a knot at tStart so the
// curve enters the chart at the right height.
function _clipSeries(knots, tStart, tEnd) {
  const out = []
  for (let i = 0; i < knots.length; i++) {
    const p = knots[i]
    if (p.t > tEnd) break
    if (p.t < tStart) continue
    const prev = knots[i - 1]
    if (prev && prev.t < tStart) {
      const f = (tStart - prev.t) / (p.t - prev.t)
      out.push({ t: tStart, v: prev.v + (p.v - prev.v) * f })
    }
    out.push(p)
  }
  if (out.length < 2) return [{ t: tStart, v: 0 }, { t: tEnd, v: 0 }]
  return out
}

export function calcUnits(volumeMl, abv) {
  return (volumeMl * abv) / 1000
}

export function approxCalories(volumeMl, abv) {
  return Math.round((volumeMl * abv / 100) * 0.789 * 7)
}

export function formatBAC(permille, bacUnit) {
  switch (bacUnit) {
    case 'percent': return (permille / 10).toFixed(3)
    case 'mg100ml': return Math.round(permille * 100).toString()
    default:        return permille.toFixed(2)
  }
}

export function bacUnitLabel(bacUnit) {
  switch (bacUnit) {
    case 'percent': return '% BAC'
    case 'mg100ml': return 'mg/100ml'
    default:        return '‰ permille'
  }
}

export function getBACColor(permille, legalLimit) {
  if (permille === 0)              return 'var(--green)'
  if (permille < legalLimit * 0.5) return 'var(--green)'
  if (permille < legalLimit)       return 'var(--amber)'
  return 'var(--red)'
}

export function getSoberTime(permille) {
  if (permille <= 0) return ''
  const hrs = permille / 0.15
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  return `Sober in ~${h > 0 ? h + 'h ' : ''}${m}m`
}
