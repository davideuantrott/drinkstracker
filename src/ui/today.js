import { getLog, getSettings, deleteLogEntry } from '../storage.js'
import { calcBACPermille, calcUnits, approxCalories, formatBAC, bacUnitLabel, getSoberTime } from '../bac.js'
import { getPresetIcon } from '../presets.js'

export function renderToday() {
  const log = getLog()
  const settings = getSettings()

  const start = new Date(); start.setHours(0, 0, 0, 0)
  const todayDrinks = log.filter(d => d.timestamp >= start.getTime())

  const bac = calcBACPermille(todayDrinks, settings)
  const units = todayDrinks.reduce((s, d) => s + calcUnits(d.volumeMl, d.abv), 0)
  const cals = todayDrinks.reduce((s, d) => s + approxCalories(d.volumeMl, d.abv), 0)
  const limit = parseFloat(settings.legalLimit)
  const maxBar = limit * 2.5

  document.getElementById('bac-display').textContent = formatBAC(bac, settings.bacUnit)
  document.getElementById('bac-unit-label').textContent = bacUnitLabel(settings.bacUnit)
  document.getElementById('today-units').textContent = units.toFixed(1)
  document.getElementById('today-drinks').textContent = todayDrinks.length
  document.getElementById('today-cal').textContent = cals

  const pct = Math.min(100, (bac / maxBar) * 100)
  document.getElementById('bac-bar-fill').style.width = pct + '%'
  const legalPct = (limit / maxBar) * 100
  document.getElementById('bac-legal-marker').style.left = legalPct + '%'
  document.getElementById('bac-legal-label').style.left = legalPct + '%'

  const statusEl = document.getElementById('bac-status')
  if (bac === 0) {
    statusEl.textContent = '— Sober —'
    statusEl.className = 'bac-status bac-safe'
  } else if (bac < limit * 0.5) {
    statusEl.textContent = 'Below legal limit'
    statusEl.className = 'bac-status bac-safe'
  } else if (bac < limit) {
    statusEl.textContent = 'Approaching limit'
    statusEl.className = 'bac-status bac-caution'
  } else {
    statusEl.textContent = 'Over legal limit'
    statusEl.className = 'bac-status bac-danger'
  }

  document.getElementById('bac-sober-time').textContent = getSoberTime(bac)

  const listEl = document.getElementById('today-log-list')
  if (todayDrinks.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🍺</div>Tap + to log a drink</div>`
    return
  }

  listEl.innerHTML = [...todayDrinks].reverse().map(d => {
    const t = new Date(d.timestamp)
    const timeStr = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const u = calcUnits(d.volumeMl, d.abv).toFixed(1)
    const costStr = d.cost > 0 ? ` · ${settings.currency}${parseFloat(d.cost).toFixed(2)}` : ''
    return `
      <div class="drink-entry">
        <div class="drink-entry-icon">${getPresetIcon(d.name)}</div>
        <div class="drink-entry-info">
          <div class="drink-entry-name">${d.name}</div>
          <div class="drink-entry-meta">${d.volumeMl}ml · ${d.abv}% · ${timeStr}${costStr}</div>
        </div>
        <div class="drink-entry-units">${u}</div>
        <button class="drink-entry-del" data-id="${d.id}" aria-label="Delete">✕</button>
      </div>`
  }).join('')

  listEl.querySelectorAll('.drink-entry-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id
      await deleteLogEntry(id)
      renderToday()
      window.dispatchEvent(new CustomEvent('at:data-changed'))
    })
  })
}
