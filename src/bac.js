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
