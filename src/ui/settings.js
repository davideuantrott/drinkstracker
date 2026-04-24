import { getLog, getSettings, saveSettings, clearAllData } from '../storage.js'
import { isSupabaseEnabled, getUserEmail } from '../auth.js'
import { calcUnits } from '../bac.js'

export async function loadSettingsForm() {
  const s = getSettings()
  document.getElementById('s-gender').value = s.gender
  document.getElementById('s-weight').value = s.weightKg
  document.getElementById('s-weight-unit').value = s.weightUnit
  document.getElementById('s-bac-unit').value = s.bacUnit
  document.getElementById('s-vol-unit').value = s.volUnit
  document.getElementById('s-currency').value = s.currency
  document.getElementById('s-weekly-goal').value = s.weeklyGoal
  document.getElementById('s-legal-limit').value = parseFloat(s.legalLimit).toFixed(2)

  const accountSection = document.getElementById('account-section')
  if (isSupabaseEnabled) {
    accountSection.style.display = 'block'
    const email = await getUserEmail()
    const emailEl = document.getElementById('account-email')
    if (emailEl && email) emailEl.textContent = email
  } else {
    accountSection.style.display = 'none'
  }
}

export function bindSettingsEvents() {
  const ids = ['s-gender', 's-weight', 's-weight-unit', 's-bac-unit', 's-vol-unit', 's-currency', 's-weekly-goal', 's-legal-limit']
  ids.forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const s = {
        gender:     document.getElementById('s-gender').value,
        weightKg:   parseFloat(document.getElementById('s-weight').value) || 75,
        weightUnit: document.getElementById('s-weight-unit').value,
        bacUnit:    document.getElementById('s-bac-unit').value,
        volUnit:    document.getElementById('s-vol-unit').value,
        currency:   document.getElementById('s-currency').value,
        weeklyGoal: parseFloat(document.getElementById('s-weekly-goal').value) || 14,
        legalLimit: parseFloat(document.getElementById('s-legal-limit').value)
      }
      saveSettings(s)
      window.dispatchEvent(new CustomEvent('at:settings-changed'))
    })
  })

  document.getElementById('btn-export').addEventListener('click', _exportCSV)

  document.getElementById('btn-clear').addEventListener('click', async () => {
    if (!confirm('Delete all logged drinks? This cannot be undone.')) return
    await clearAllData()
    window.dispatchEvent(new CustomEvent('at:data-changed'))
  })

  document.getElementById('btn-signout').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('at:signout'))
  })
}

function _exportCSV() {
  const log = getLog()
  const settings = getSettings()
  const rows = [['Date', 'Time', 'Name', 'Volume (ml)', 'ABV %', 'Units', 'Cost']]
  for (const d of log) {
    const dt = new Date(d.timestamp)
    rows.push([
      dt.toLocaleDateString('en-GB'),
      dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      d.name, d.volumeMl, d.abv,
      calcUnits(d.volumeMl, d.abv).toFixed(2),
      d.cost || 0
    ])
  }
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'alcotrack-log.csv'; a.click()
  URL.revokeObjectURL(url)
}
