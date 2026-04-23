import { getLog, getSettings } from '../storage.js'
import { calcUnits } from '../bac.js'
import { getPresetIcon } from '../presets.js'

export function renderLog() {
  const log = getLog()
  const settings = getSettings()
  const el = document.getElementById('history-list')

  if (log.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding-top:60px;"><div class="empty-icon">📋</div>No drinks logged yet</div>`
    return
  }

  const groups = {}
  for (const d of [...log].reverse()) {
    const day = new Date(d.timestamp).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    })
    if (!groups[day]) groups[day] = []
    groups[day].push(d)
  }

  el.innerHTML = Object.entries(groups).map(([day, drinks]) => {
    const units = drinks.reduce((s, d) => s + calcUnits(d.volumeMl, d.abv), 0)
    const items = drinks.map(d => {
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
        </div>`
    }).join('')
    return `
      <div class="day-group-header">
        <div class="day-group-date">${day}</div>
        <div class="day-group-summary">${units.toFixed(1)} units</div>
      </div>
      <div style="padding:0 16px;">${items}</div>`
  }).join('')
}
