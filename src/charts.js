import { calcBACAtTime, calcUnits } from './bac.js'

export function drawBACChart(canvas, todayDrinks, settings) {
  const ctx = canvas.getContext('2d')
  const W = canvas.parentElement.clientWidth - 32
  const H = 120
  canvas.width = W * devicePixelRatio
  canvas.height = H * devicePixelRatio
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const points = []
  const now = Date.now()
  const hoursBack = 12

  for (let i = 0; i <= 60; i++) {
    const t = now - (hoursBack - (hoursBack * i / 60)) * 3600000
    points.push(calcBACAtTime(todayDrinks, t, settings))
  }

  const limit = parseFloat(settings.legalLimit)
  const maxBac = Math.max(...points, limit * 1.2, 0.01)
  const limitY = H - (limit / maxBac) * (H - 20) - 10

  ctx.clearRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 3; i++) {
    const y = 10 + (H - 20) * i / 3
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(251,191,36,0.4)'
  ctx.setLineDash([4, 4])
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, limitY); ctx.lineTo(W, limitY); ctx.stroke()
  ctx.setLineDash([])

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, 'rgba(124,106,247,0.4)')
  grad.addColorStop(1, 'rgba(124,106,247,0)')

  ctx.beginPath()
  ctx.moveTo(0, H)
  points.forEach((v, i) => {
    const x = (i / 60) * W
    const y = H - (v / maxBac) * (H - 20) - 10
    i === 0 ? ctx.lineTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(192,132,252,0.9)'
  ctx.lineWidth = 2
  points.forEach((v, i) => {
    const x = (i / 60) * W
    const y = H - (v / maxBac) * (H - 20) - 10
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
}

export function drawWeekChart(canvas, weekDrinks) {
  const ctx = canvas.getContext('2d')
  const W = canvas.parentElement.clientWidth - 32
  const H = 120
  canvas.width = W * devicePixelRatio
  canvas.height = H * devicePixelRatio
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString('en-GB', { weekday: 'short' })
    const start = d.getTime()
    const end = start + 86400000
    const u = weekDrinks
      .filter(dr => dr.timestamp >= start && dr.timestamp < end)
      .reduce((s, dr) => s + calcUnits(dr.volumeMl, dr.abv), 0)
    days.push({ label, units: u })
  }

  const maxU = Math.max(...days.map(d => d.units), 4)
  const barW = (W - 20) / 7 - 6
  ctx.clearRect(0, 0, W, H)

  days.forEach((day, i) => {
    const x = 10 + i * ((W - 20) / 7)
    const barH = (day.units / maxU) * (H - 28)
    const y = H - barH - 18
    const isToday = i === 6

    const grad = ctx.createLinearGradient(0, y, 0, H - 18)
    grad.addColorStop(0, isToday ? 'rgba(192,132,252,0.9)' : 'rgba(124,106,247,0.5)')
    grad.addColorStop(1, isToday ? 'rgba(124,106,247,0.4)' : 'rgba(124,106,247,0.1)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(x + 2, y, barW, barH, 4)
    ctx.fill()

    ctx.fillStyle = isToday ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'
    ctx.font = `${isToday ? 700 : 400} 9px Syne, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(day.label, x + barW / 2 + 2, H - 4)
  })
}
