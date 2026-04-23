export function calcBACPermille(drinks, settings) {
  const r = settings.gender === 'female' ? 0.55 : 0.68
  const weightKg = settings.weightUnit === 'lb'
    ? parseFloat(settings.weightKg) * 0.453592
    : parseFloat(settings.weightKg)
  const now = Date.now()
  let total = 0
  for (const d of drinks) {
    const hoursElapsed = (now - d.timestamp) / 3600000
    const alcoholGrams = (d.volumeMl * d.abv / 100) * 0.789
    const peakBAC = alcoholGrams / (weightKg * r)
    total += Math.max(0, peakBAC - 0.15 * hoursElapsed)
  }
  return Math.max(0, total)
}

export function calcBACAtTime(drinks, atTime, settings) {
  const r = settings.gender === 'female' ? 0.55 : 0.68
  const weightKg = settings.weightUnit === 'lb'
    ? parseFloat(settings.weightKg) * 0.453592
    : parseFloat(settings.weightKg)
  let total = 0
  for (const d of drinks) {
    if (d.timestamp > atTime) continue
    const hoursElapsed = (atTime - d.timestamp) / 3600000
    const alcoholGrams = (d.volumeMl * d.abv / 100) * 0.789
    const peakBAC = alcoholGrams / (weightKg * r)
    total += Math.max(0, peakBAC - 0.15 * hoursElapsed)
  }
  return Math.max(0, total)
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
