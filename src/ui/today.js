import { getLog, getSettings, addLogEntry, deleteLogEntry } from '../storage.js'
import { calcBACPermille, peakAhead, soberAt, belowLimitAt, calcUnits, approxCalories, formatBAC, bacUnitLabel, formatDuration } from '../bac.js'
import { getPresetIcon } from '../presets.js'
import { drawNowBACChart } from '../charts.js'

// Chart pan state — persists across re-renders
let _panOffsetMs = 0
let _msPerPx = null
let _touchStartX = null
let _touchStartY = null
let _panAtStart = 0
let _isPanning = false
let _panSetup = false

export function renderToday() {
  const log = getLog()
  const settings = getSettings()

  // Today's drinks (since midnight) — used for stats display and the drink list
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const todayDrinks = log.filter(d => d.timestamp >= start.getTime())

  // BAC drinks: look back 4 days so pre-midnight drinking carries over and the
  // hero number is computed from exactly the same set the chart draws
  const bacCutoff = Date.now() - 4 * 24 * 3600000
  const bacDrinks = log.filter(d => d.timestamp >= bacCutoff)

  const bac = calcBACPermille(bacDrinks, settings)
  // A drink logged minutes ago is still absorbing, so the current reading can be
  // well below where it is heading — the verdict has to use the pending peak.
  const peak = peakAhead(bacDrinks, settings)
  const rising = peak.v > bac + 0.005
  const verdict = Math.max(bac, peak.v)
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

  document.getElementById('bac-rising').textContent = rising
    ? `↑ Still absorbing — peaks at ${formatBAC(peak.v, settings.bacUnit)} in ~${formatDuration(peak.t - Date.now())}`
    : ''

  const statusEl = document.getElementById('bac-status')
  if (verdict === 0) {
    statusEl.textContent = '— Sober —'
    statusEl.className = 'bac-status bac-safe'
  } else if (bac < limit && peak.v >= limit) {
    statusEl.textContent = 'Heading over legal limit'
    statusEl.className = 'bac-status bac-danger'
  } else if (bac >= limit) {
    statusEl.textContent = 'Over legal limit'
    statusEl.className = 'bac-status bac-danger'
  } else if (verdict < limit * 0.5) {
    statusEl.textContent = 'Below legal limit'
    statusEl.className = 'bac-status bac-safe'
  } else {
    statusEl.textContent = 'Approaching limit'
    statusEl.className = 'bac-status bac-caution'
  }

  const now = Date.now()
  const belowT = belowLimitAt(bacDrinks, settings, limit, now)
  const soberT = soberAt(bacDrinks, settings, now)
  const timings = []
  if (belowT) timings.push(`Under ${formatBAC(limit, settings.bacUnit)} in ~${formatDuration(belowT - now)}`)
  if (soberT) timings.push(`${timings.length ? 'sober' : 'Sober'} in ~${formatDuration(soberT - now)}`)
  document.getElementById('bac-sober-time').textContent = timings.join(' · ')

  // Draw live BAC chart; the 4-day drink set lets panning reach past days
  const chartCanvas = document.getElementById('now-bac-chart')
  if (chartCanvas.parentElement.clientWidth > 0) {
    _msPerPx = drawNowBACChart(chartCanvas, bacDrinks, settings, _panOffsetMs)
    if (!_panSetup) {
      _panSetup = true
      _setupChartPan(chartCanvas)
    }
  }

  // Quick-add chips (last 3 unique drink types from full log)
  _renderQuickAdd(log, settings)

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
        <div class="drink-entry-icon">${d.icon || getPresetIcon(d.name)}</div>
        <div class="drink-entry-info">
          <div class="drink-entry-name">${d.name}</div>
          <div class="drink-entry-meta">${d.volumeMl}ml · ${d.abv}% · ${timeStr}${costStr}</div>
        </div>
        <div class="drink-entry-units">${u}</div>
        <button class="drink-entry-edit" data-id="${d.id}" aria-label="Edit">✏</button>
        <button class="drink-entry-del" data-id="${d.id}" aria-label="Delete">✕</button>
      </div>`
  }).join('')

  listEl.querySelectorAll('.drink-entry-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id
      const drink = getLog().find(d => d.id === id)
      if (drink) window.dispatchEvent(new CustomEvent('at:edit-drink', { detail: drink }))
    })
  })

  listEl.querySelectorAll('.drink-entry-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id
      await deleteLogEntry(id)
      renderToday()
      window.dispatchEvent(new CustomEvent('at:data-changed'))
    })
  })
}

function _setupChartPan(canvas) {
  canvas.addEventListener('touchstart', e => {
    _touchStartX = e.touches[0].clientX
    _touchStartY = e.touches[0].clientY
    _panAtStart = _panOffsetMs
    _isPanning = false
  }, { passive: true })

  canvas.addEventListener('touchmove', e => {
    if (_touchStartX === null) return
    const dx = e.touches[0].clientX - _touchStartX
    const dy = e.touches[0].clientY - _touchStartY

    if (!_isPanning) {
      if (Math.abs(dx) > Math.abs(dy) + 8) {
        _isPanning = true
      } else if (Math.abs(dy) > 8) {
        return // vertical — allow page scroll
      } else {
        return // undecided
      }
    }

    e.preventDefault()

    if (_msPerPx !== null) {
      const MAX_BACK = 3 * 24 * 3600000
      _panOffsetMs = Math.max(0, Math.min(MAX_BACK, _panAtStart + dx * _msPerPx))
      const log = getLog()
      const settings = getSettings()
      const chartDrinks = log.filter(d => d.timestamp >= Date.now() - 4 * 24 * 3600000)
      _msPerPx = drawNowBACChart(canvas, chartDrinks, settings, _panOffsetMs)
    }
  }, { passive: false })

  canvas.addEventListener('touchend', () => {
    _touchStartX = null
    _isPanning = false
  }, { passive: true })
}

function _renderQuickAdd(log, settings) {
  const section = document.getElementById('quick-add-section')
  const row = document.getElementById('quick-add-row')

  const seen = new Set()
  const recents = []
  for (let i = log.length - 1; i >= 0 && recents.length < 3; i--) {
    const d = log[i]
    const key = `${d.name}|${d.volumeMl}|${d.abv}`
    if (!seen.has(key)) {
      seen.add(key)
      recents.push(d)
    }
  }

  if (recents.length === 0) {
    section.style.display = 'none'
    return
  }

  section.style.display = 'block'
  row.innerHTML = recents.map((d, i) => `
    <button class="quick-chip" data-qi="${i}">
      <span class="quick-chip-icon">${getPresetIcon(d.name)}</span>
      <span class="quick-chip-name">${d.name}</span>
      <span class="quick-chip-meta">${d.volumeMl}ml · ${d.abv}%</span>
    </button>`).join('')

  row.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      const d = recents[parseInt(btn.dataset.qi)]
      const entry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        name: d.name,
        volumeMl: d.volumeMl,
        abv: d.abv,
        cost: d.cost || 0
      }
      await addLogEntry(entry)
      renderToday()
      window.dispatchEvent(new CustomEvent('at:data-changed'))
    })
  })
}
