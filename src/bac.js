// ── BAC model ────────────────────────────────────────────────────────────────
//
// Deliberately conservative: every parameter below is set at the cautious end of
// its published range, so the number shown is a high estimate rather than a
// central one. Stacked, they read roughly 20% higher than a textbook Widmark
// calculation, and alcohol clears roughly 50% slower.
//
//   r (Widmark factor)  Widmark's means are 0.68 male / 0.55 female with SDs of
//                       0.085 / 0.055. We use one SD *below* the mean: a lower r
//                       means a smaller volume of distribution, so a higher BAC
//                       for the same drink. Covers ~84% of people.
//   blood density       Widmark's r was derived with BAC per unit mass of blood
//                       (g/kg). Legal limits are per unit volume (mg/100 ml), so
//                       the conversion needs blood's specific gravity. 1.055 is
//                       the high end of the quoted range.
//   elimination         Population range is ~0.10–0.20‰/h. We use the slow end,
//                       which both holds BAC higher during a session and pushes
//                       the sober estimate later.
//   absorption          A drink is logged at the last sip, so some absorption has
//                       already happened — but not all. Each drink ramps in
//                       linearly over 30 min rather than landing instantly.
//
// None of this models food, drinking speed, medication, illness or tolerance,
// and individual variation remains large. The output is an estimate, never a
// fitness-to-drive decision.

const R_FACTOR = { male: 0.68 - 0.085, female: 0.55 - 0.055 }
const BLOOD_DENSITY = 1.055
const ELIM_PER_H = 0.10
const ELIM_PER_MS = ELIM_PER_H / 3600000
export const ABSORB_MS = 30 * 60000

function _bacParams(settings) {
  const r = R_FACTOR[settings.gender === 'female' ? 'female' : 'male']
  const weightKg = settings.weightUnit === 'lb'
    ? parseFloat(settings.weightKg) * 0.453592
    : parseFloat(settings.weightKg)
  return { r, weightKg }
}

// Each drink becomes a dose absorbed linearly between t0 and t1.
function _doses(drinks, settings) {
  const { r, weightKg } = _bacParams(settings)
  if (!(weightKg > 0)) return []
  return drinks
    .filter(d => d.volumeMl > 0 && d.abv > 0)
    .map(d => ({
      t0: d.timestamp,
      t1: d.timestamp + ABSORB_MS,
      dose: (d.volumeMl * d.abv / 100) * 0.789 * BLOOD_DENSITY / (weightKg * r)
    }))
    .sort((a, b) => a.t0 - b.t0)
}

// The exact knots of the BAC curve: absorption ramps in, elimination drains at a
// constant rate whenever there is anything left. Both are piecewise linear, so
// the whole curve is described by a handful of points — no sampling, no clipped
// peaks. Everything else in this module reads off this one curve.
function _curve(drinks, settings) {
  const doses = _doses(drinks, settings)
  if (!doses.length) return []

  const bounds = [...new Set(doses.flatMap(d => [d.t0, d.t1]))].sort((a, b) => a - b)
  const knots = [{ t: bounds[0], v: 0 }]
  let v = 0

  for (let i = 0; i < bounds.length - 1; i++) {
    const t = bounds[i], tNext = bounds[i + 1]
    // Breakpoints sit at every ramp start and end, so within this interval each
    // dose is either absorbing throughout or not at all.
    let inflow = 0
    for (const d of doses) if (d.t0 <= t && d.t1 >= tNext) inflow += d.dose / (d.t1 - d.t0)

    const outflow = (v > 0 || inflow > 0) ? ELIM_PER_MS : 0
    const slope = inflow - outflow
    let next = v + slope * (tNext - t)

    if (next < 0) {
      if (v > 0) knots.push({ t: t + v / -slope, v: 0 })  // hit zero part-way through
      next = 0
    }
    knots.push({ t: tNext, v: next })
    v = next
  }

  if (v > 0) knots.push({ t: bounds[bounds.length - 1] + v / ELIM_PER_MS, v: 0 })
  return knots
}

function _evalCurve(knots, t) {
  if (!knots.length || t <= knots[0].t) return 0
  const last = knots[knots.length - 1]
  if (t >= last.t) return last.v
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1], b = knots[i]
    if (t <= b.t) {
      const span = b.t - a.t
      return span === 0 ? b.v : a.v + (b.v - a.v) * ((t - a.t) / span)
    }
  }
  return last.v
}

export function calcBACPermille(drinks, settings) {
  return _evalCurve(_curve(drinks, settings), Date.now())
}

export function calcBACAtTime(drinks, atTime, settings) {
  return _evalCurve(_curve(drinks, settings), atTime)
}

// Highest BAC still to come — a drink logged minutes ago is only part absorbed,
// so the current reading can be well below where it is heading.
export function peakAhead(drinks, settings, fromT = Date.now()) {
  const knots = _curve(drinks, settings)
  let best = { t: fromT, v: _evalCurve(knots, fromT) }
  for (const k of knots) if (k.t > fromT && k.v > best.v) best = { t: k.t, v: k.v }
  return best
}

// When the curve drops to zero for good (null if it already has).
export function soberAt(drinks, settings, fromT = Date.now()) {
  const knots = _curve(drinks, settings)
  if (!knots.length) return null
  const last = knots[knots.length - 1]
  return last.t > fromT && _evalCurve(knots, fromT) > 0 ? last.t : null
}

// When the curve drops below `limit` for good (null if it is already below and
// staying there). Uses the last crossing, so a pending peak is accounted for.
export function belowLimitAt(drinks, settings, limit, fromT = Date.now()) {
  const knots = _curve(drinks, settings)
  if (!knots.length) return null
  let crossing = null
  let prev = { t: fromT, v: _evalCurve(knots, fromT) }
  for (const k of knots) {
    if (k.t <= fromT) continue
    // Only a downward crossing counts, and a later one supersedes an earlier
    // one — so a peak still to come pushes the answer out rather than being
    // missed.
    if (prev.v > limit && k.v <= limit) {
      crossing = prev.t + (k.t - prev.t) * ((prev.v - limit) / (prev.v - k.v))
    }
    prev = k
  }
  return crossing
}

// Knots of the curve clipped to [tStart, tEnd], with interpolated endpoints so a
// chart can draw the window exactly.
export function bacCurvePoints(drinks, tStart, tEnd, settings) {
  const knots = _curve(drinks, settings)
  const out = [{ t: tStart, v: _evalCurve(knots, tStart) }]
  for (const k of knots) if (k.t > tStart && k.t < tEnd) out.push(k)
  out.push({ t: tEnd, v: _evalCurve(knots, tEnd) })
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

export function formatDuration(ms) {
  const mins = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
