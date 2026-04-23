import { getLog, getSettings } from '../storage.js'
import { calcUnits } from '../bac.js'
import { drawBACChart, drawWeekChart } from '../charts.js'

export function renderStats() {
  const log = getLog()
  const settings = getSettings()
  const now = Date.now()
  const weekStart = now - 7 * 86400000
  const monthStart = now - 30 * 86400000

  const weekDrinks = log.filter(d => d.timestamp >= weekStart)
  const monthDrinks = log.filter(d => d.timestamp >= monthStart)

  const weekUnits = weekDrinks.reduce((s, d) => s + calcUnits(d.volumeMl, d.abv), 0)
  const monthUnits = monthDrinks.reduce((s, d) => s + calcUnits(d.volumeMl, d.abv), 0)
  const avgDay = weekUnits / 7

  let soberCount = 0
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = dayStart.getTime() + 86400000
    if (!log.some(d => d.timestamp >= dayStart.getTime() && d.timestamp < dayEnd)) soberCount++
  }

  document.getElementById('stat-week-total').textContent = weekUnits.toFixed(1)
  document.getElementById('stat-month-total').textContent = monthUnits.toFixed(1)
  document.getElementById('stat-avg-day').textContent = avgDay.toFixed(1)
  document.getElementById('stat-sober-days').textContent = soberCount

  const goal = parseFloat(settings.weeklyGoal)
  const goalPct = Math.min(100, (weekUnits / goal) * 100)
  document.getElementById('goal-used').textContent = weekUnits.toFixed(1)
  document.getElementById('goal-limit-label').textContent = `of ${goal} units`
  document.getElementById('goal-bar').style.width = goalPct + '%'
  document.getElementById('goal-bar').className = 'goal-bar-fill' + (goalPct >= 100 ? ' over' : '')
  document.getElementById('goal-pct').textContent = Math.round(goalPct) + '% used'

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayDrinks = log.filter(d => d.timestamp >= today.getTime())
  drawBACChart(document.getElementById('bac-chart'), todayDrinks, settings)
  drawWeekChart(document.getElementById('week-chart'), weekDrinks)
}
