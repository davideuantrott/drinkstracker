import { addLogEntry } from '../storage.js'
import { calcUnits } from '../bac.js'
import { PRESETS } from '../presets.js'

export function buildPresetGrid() {
  const grid = document.getElementById('preset-grid')
  grid.innerHTML = PRESETS.map((p, i) => `
    <div class="preset-chip" data-i="${i}">
      <div class="preset-chip-icon">${p.icon}</div>
      <div class="preset-chip-name">${p.name}</div>
    </div>`).join('')

  grid.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      grid.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('selected'))
      chip.classList.add('selected')
      const p = PRESETS[chip.dataset.i]
      document.getElementById('f-name').value = p.name
      document.getElementById('f-volume').value = p.vol
      document.getElementById('f-abv').value = p.abv
      _updateUnitsDisplay()
    })
  })
}

export function bindModalEvents() {
  document.getElementById('fab').addEventListener('click', openModal)
  document.getElementById('btn-add-drink').addEventListener('click', _addDrink)
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal)
  document.getElementById('add-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('add-modal')) closeModal()
  })
  document.getElementById('f-volume').addEventListener('input', _updateUnitsDisplay)
  document.getElementById('f-abv').addEventListener('input', _updateUnitsDisplay)
}

export function openModal() {
  document.getElementById('f-name').value = ''
  document.getElementById('f-volume').value = ''
  document.getElementById('f-abv').value = ''
  document.getElementById('f-cost').value = ''
  document.getElementById('f-units-display').value = '—'
  document.getElementById('preset-grid').querySelectorAll('.preset-chip').forEach(c => c.classList.remove('selected'))
  const now = new Date()
  document.getElementById('f-time').value = now.toTimeString().slice(0, 5)
  document.getElementById('add-modal').classList.add('open')
}

export function closeModal() {
  document.getElementById('add-modal').classList.remove('open')
}

export function showMigrationModal(count) {
  const el = document.getElementById('migration-modal')
  document.getElementById('migration-count').textContent = count
  el.classList.add('open')
}

export function bindMigrationEvents(onMigrate, onDiscard) {
  document.getElementById('btn-migrate-yes').addEventListener('click', async () => {
    document.getElementById('migration-modal').classList.remove('open')
    await onMigrate()
  })
  document.getElementById('btn-migrate-no').addEventListener('click', () => {
    document.getElementById('migration-modal').classList.remove('open')
    onDiscard()
  })
}

function _updateUnitsDisplay() {
  const vol = parseFloat(document.getElementById('f-volume').value) || 0
  const abv = parseFloat(document.getElementById('f-abv').value) || 0
  const u = calcUnits(vol, abv)
  document.getElementById('f-units-display').value = u > 0 ? u.toFixed(2) + ' units' : '—'
}

async function _addDrink() {
  const name = document.getElementById('f-name').value.trim() || 'Drink'
  const vol = parseFloat(document.getElementById('f-volume').value)
  const abv = parseFloat(document.getElementById('f-abv').value)
  const cost = parseFloat(document.getElementById('f-cost').value) || 0
  const timeVal = document.getElementById('f-time').value

  if (!vol || !abv) { alert('Please enter volume and ABV.'); return }

  const now = new Date()
  const [h, m] = timeVal.split(':').map(Number)
  now.setHours(h, m, 0, 0)

  const entry = {
    id:        crypto.randomUUID(),
    timestamp: now.getTime(),
    name, volumeMl: vol, abv, cost
  }

  await addLogEntry(entry)
  closeModal()
  window.dispatchEvent(new CustomEvent('at:data-changed'))
}
