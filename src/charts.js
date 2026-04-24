import { calcBACAtTime, calcUnits } from './bac.js'

// ── Now-tab live BAC chart ───────────────────────────────────────────────────

export function drawNowBACChart(canvas, drinks, settings, panOffsetMs = 0) {
  const ctx = canvas.getContext('2d')
  const W = canvas.parentElement.clientWidth
  const H = 160
  canvas.width = W * devicePixelRatio
  canvas.height = H * devicePixelRatio
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const now = Date.now()
  const limit = parseFloat(settings.legalLimit)

  // Clamp pan to 3-day max
  panOffsetMs = Math.max(0, Math.min(panOffsetMs, 3 * 24 * 3600000))

  const firstTs = drinks.length
    ? drinks.reduce((m, d) => Math.min(m, d.timestamp), Infinity)
    : now
  const currentBAC = calcBACAtTime(drinks, now, settings)
  const soberMs = currentBAC > 0 ? now + (currentBAC / 0.15) * 3600000 : now

  // Natural window then shift backwards by panOffsetMs
  const naturalTStart = Math.min(firstTs, now - 4 * 3600000)
  const naturalTEnd = Math.max(soberMs + 20 * 60000, now + 60 * 60000)
  const tStart = naturalTStart - panOffsetMs
  const tEnd = naturalTEnd - panOffsetMs

  const N = 120
  const pts = []
  for (let i = 0; i <= N; i++) {
    const t = tStart + (tEnd - tStart) * (i / N)
    pts.push({ t, v: calcBACAtTime(drinks, t, settings) })
  }

  const maxV = Math.max(...pts.map(p => p.v), limit * 1.3, 0.01)

  const PL = 6, PR = 6, PT = 12, PB = 22
  const cW = W - PL - PR
  const cH = H - PT - PB

  const toX = t => PL + ((t - tStart) / (tEnd - tStart)) * cW
  const toY = v => PT + cH - (v / maxV) * cH

  ctx.clearRect(0, 0, W, H)

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = PT + (cH * i) / 4
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke()
  }

  // Legal limit line
  const limitY = toY(limit)
  ctx.save()
  ctx.strokeStyle = 'rgba(251,191,36,0.55)'
  ctx.setLineDash([5, 4])
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PL, limitY); ctx.lineTo(W - PR, limitY); ctx.stroke()
  ctx.restore()
  ctx.fillStyle = 'rgba(251,191,36,0.75)'
  ctx.font = '700 9px Poppins,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('LIMIT', PL + 4, limitY - 3)

  // Colored fill — vertical gradient keyed to BAC level
  const limitFrac = Math.max(0, Math.min(1, 1 - limit / maxV))
  const halfFrac  = Math.max(0, Math.min(1, 1 - (limit * 0.5) / maxV))
  const grad = ctx.createLinearGradient(0, PT, 0, PT + cH)
  grad.addColorStop(0,          'rgba(248,113,113,0.75)')
  grad.addColorStop(limitFrac,  'rgba(251,191,36,0.65)')
  grad.addColorStop(halfFrac,   'rgba(52,211,153,0.55)')
  grad.addColorStop(1,          'rgba(52,211,153,0.08)')

  ctx.beginPath()
  ctx.moveTo(toX(pts[0].t), PT + cH)
  pts.forEach(p => ctx.lineTo(toX(p.t), toY(p.v)))
  ctx.lineTo(toX(pts[N].t), PT + cH)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Curve
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 1.5
  pts.forEach((p, i) => {
    i === 0 ? ctx.moveTo(toX(p.t), toY(p.v)) : ctx.lineTo(toX(p.t), toY(p.v))
  })
  ctx.stroke()

  // Current-time marker (only draw when visible)
  const nowX = toX(now)
  if (nowX >= PL && nowX <= W - PR) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(nowX, PT); ctx.lineTo(nowX, PT + cH); ctx.stroke()
    ctx.restore()
  }

  // Sober-time annotation
  if (currentBAC > 0) {
    const soberX = toX(soberMs)
    if (soberX > PL && soberX < W - PR) {
      const soberStr = new Date(soberMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      ctx.fillStyle = 'rgba(52,211,153,0.9)'
      ctx.font = '600 9px Poppins,sans-serif'
      ctx.textAlign = soberX > W * 0.6 ? 'right' : 'left'
      const offset = soberX > W * 0.6 ? -4 : 4
      ctx.fillText('Sober ' + soberStr, soberX + offset, PT + cH - 4)
    }
  }

  // X-axis time labels
  ctx.fillStyle = 'rgba(168,192,232,0.65)'
  ctx.font = '9px "Roboto Mono",monospace'
  ctx.textAlign = 'center'
  const totalHours = (tEnd - tStart) / 3600000
  const step = totalHours <= 6 ? 1 : totalHours <= 12 ? 2 : 4
  const anchor = new Date(tStart)
  anchor.setMinutes(0, 0, 0)
  anchor.setHours(anchor.getHours() + 1)
  for (let t = anchor.getTime(); t <= tEnd; t += step * 3600000) {
    const x = toX(t)
    if (x < PL + 22 || x > W - PR - 22) continue
    const d = new Date(t)
    ctx.fillText(d.getHours().toString().padStart(2, '0') + ':00', x, H - 5)
  }

  // Pan indicator: show date in top-right when scrolled back
  if (panOffsetMs > 0) {
    const viewMid = new Date((tStart + tEnd) / 2)
    const dayStr = viewMid.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    ctx.fillStyle = 'rgba(168,192,232,0.75)'
    ctx.font = '600 9px Poppins,sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('‹ ' + dayStr + ' ›', W - PR, PT + 10)
  }

  return cW > 0 ? (tEnd - tStart) / cW : 1
}

// ── Stats DAILY: BAC trend today (used in stats tab) ────────────────────────

export function drawDailyBACChart(canvas, todayDrinks, settings) {
  const ctx = canvas.getContext('2d')
  const W = canvas.parentElement.clientWidth
  const H = 180
  canvas.width = W * devicePixelRatio
  canvas.height = H * devicePixelRatio
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const now = Date.now()
  const limit = parseFloat(settings.legalLimit)
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const tStart = dayStart.getTime()
  const tEnd = now + 2 * 3600000

  const N = 120
  const pts = []
  for (let i = 0; i <= N; i++) {
    const t = tStart + (tEnd - tStart) * (i / N)
    pts.push({ t, v: calcBACAtTime(todayDrinks, t, settings) })
  }

  const maxV = Math.max(...pts.map(p => p.v), limit * 1.3, 0.01)
  const PL = 6, PR = 6, PT = 12, PB = 22
  const cW = W - PL - PR, cH = H - PT - PB
  const toX = t => PL + ((t - tStart) / (tEnd - tStart)) * cW
  const toY = v => PT + cH - (v / maxV) * cH

  ctx.clearRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = PT + (cH * i) / 4
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke()
  }

  const limitY = toY(limit)
  ctx.save()
  ctx.strokeStyle = 'rgba(251,191,36,0.55)'
  ctx.setLineDash([5, 4])
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PL, limitY); ctx.lineTo(W - PR, limitY); ctx.stroke()
  ctx.restore()
  ctx.fillStyle = 'rgba(251,191,36,0.75)'
  ctx.font = '700 9px Poppins,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('LIMIT', PL + 4, limitY - 3)

  const limitFrac = Math.max(0, Math.min(1, 1 - limit / maxV))
  const halfFrac  = Math.max(0, Math.min(1, 1 - (limit * 0.5) / maxV))
  const grad = ctx.createLinearGradient(0, PT, 0, PT + cH)
  grad.addColorStop(0,         'rgba(248,113,113,0.75)')
  grad.addColorStop(limitFrac, 'rgba(251,191,36,0.65)')
  grad.addColorStop(halfFrac,  'rgba(52,211,153,0.55)')
  grad.addColorStop(1,         'rgba(52,211,153,0.08)')

  ctx.beginPath()
  ctx.moveTo(toX(pts[0].t), PT + cH)
  pts.forEach(p => ctx.lineTo(toX(p.t), toY(p.v)))
  ctx.lineTo(toX(pts[N].t), PT + cH)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 1.5
  pts.forEach((p, i) => {
    i === 0 ? ctx.moveTo(toX(p.t), toY(p.v)) : ctx.lineTo(toX(p.t), toY(p.v))
  })
  ctx.stroke()

  const nowX = toX(now)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.setLineDash([3, 3])
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(nowX, PT); ctx.lineTo(nowX, PT + cH); ctx.stroke()
  ctx.restore()

  ctx.fillStyle = 'rgba(168,192,232,0.65)'
  ctx.font = '9px "Roboto Mono",monospace'
  ctx.textAlign = 'center'
  for (let h = 0; h <= 24; h += 3) {
    const t = tStart + h * 3600000
    if (t > tEnd) break
    const x = toX(t)
    if (x < PL + 18 || x > W - PR - 18) continue
    ctx.fillText(h.toString().padStart(2, '0') + ':00', x, H - 5)
  }
}

// ── Stats WEEKLY: 7-day bars + 7-day rolling avg ─────────────────────────────

export function drawWeeklyChart(canvas, log) {
  const ctx = canvas.getContext('2d')
  const W = canvas.parentElement.clientWidth
  const H = 180
  canvas.width = W * devicePixelRatio
  canvas.height = H * devicePixelRatio
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const days = _buildDays(log, 7)
  _drawBarChart(ctx, W, H, days, 7, true)
}

// ── Stats MONTHLY: 30-day bars + 30-day rolling avg ──────────────────────────

export function drawMonthlyChart(canvas, log) {
  const ctx = canvas.getContext('2d')
  const W = canvas.parentElement.clientWidth
  const H = 180
  canvas.width = W * devicePixelRatio
  canvas.height = H * devicePixelRatio
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const days = _buildDays(log, 30)
  _drawBarChart(ctx, W, H, days, 30, false)
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function _buildDays(log, n) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
    const start = d.getTime()
    const end = start + 86400000
    const units = log
      .filter(dr => dr.timestamp >= start && dr.timestamp < end)
      .reduce((s, dr) => s + calcUnits(dr.volumeMl, dr.abv), 0)
    days.push({ date: d, units })
  }
  return days
}

function _drawBarChart(ctx, W, H, days, n, showDayLabels) {
  const PL = 4, PR = 4, PT = 12, PB = 22
  const cW = W - PL - PR, cH = H - PT - PB

  const maxU = Math.max(...days.map(d => d.units), 4)
  const barSlot = cW / n
  const barW = Math.max(2, barSlot - (n > 14 ? 2 : 4))

  ctx.clearRect(0, 0, W, H)

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = PT + (cH * i) / 4
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke()
  }

  // Bars
  days.forEach((day, i) => {
    const isToday = i === days.length - 1
    const x = PL + i * barSlot + (barSlot - barW) / 2
    const barH = (day.units / maxU) * cH
    const y = PT + cH - barH

    const grad = ctx.createLinearGradient(0, y, 0, PT + cH)
    if (isToday) {
      grad.addColorStop(0, 'rgba(255,77,125,0.9)')
      grad.addColorStop(1, 'rgba(255,144,64,0.4)')
    } else {
      grad.addColorStop(0, 'rgba(124,106,247,0.65)')
      grad.addColorStop(1, 'rgba(124,106,247,0.1)')
    }
    ctx.fillStyle = grad
    ctx.beginPath()
    if (barH > 0) { ctx.roundRect(x, y, barW, barH, Math.min(3, barW / 2)); ctx.fill() }

    // X-axis labels
    if (showDayLabels) {
      ctx.fillStyle = isToday ? 'rgba(255,255,255,0.8)' : 'rgba(168,192,232,0.5)'
      ctx.font = `${isToday ? 700 : 400} 9px Poppins,sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(day.date.toLocaleDateString('en-GB', { weekday: 'short' }), x + barW / 2, H - 5)
    } else if (n <= 31) {
      // Show date labels every ~5 days
      if (i % 5 === 0 || i === days.length - 1) {
        ctx.fillStyle = isToday ? 'rgba(255,255,255,0.8)' : 'rgba(168,192,232,0.45)'
        ctx.font = '9px "Roboto Mono",monospace'
        ctx.textAlign = 'center'
        ctx.fillText(day.date.getDate().toString(), x + barW / 2, H - 5)
      }
    }
  })

  // Rolling average line
  const avgWindow = n === 7 ? 7 : 30
  const avgPts = days.map((_, i) => {
    const slice = days.slice(Math.max(0, i - avgWindow + 1), i + 1)
    return slice.reduce((s, d) => s + d.units, 0) / slice.length
  })

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,204,0,0.8)'
  ctx.lineWidth = 1.5
  avgPts.forEach((v, i) => {
    const x = PL + i * barSlot + barSlot / 2
    const y = PT + cH - (v / maxU) * cH
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()

  // Legend
  ctx.fillStyle = 'rgba(255,204,0,0.8)'
  ctx.fillRect(W - PR - 54, PT + 2, 10, 2)
  ctx.font = '9px Poppins,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(avgWindow + '-day avg', W - PR - 42, PT + 6)
}

// ── Legacy export (keeps old stats.js working during transition) ──────────────

export function drawBACChart(canvas, todayDrinks, settings) {
  drawDailyBACChart(canvas, todayDrinks, settings)
}

export function drawWeekChart(canvas, weekDrinks) {
  drawWeeklyChart(canvas, weekDrinks)
}
