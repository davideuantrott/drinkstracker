import { addLogEntry, deleteLogEntry, getCustomDrinks, saveCustomDrink, deleteCustomDrink } from '../storage.js'
import { calcUnits } from '../bac.js'
import { PRESETS } from '../presets.js'

let _presetSelected = false
let _editId = null // ID of drink being edited, null when adding new

export function buildPresetGrid() {
  const grid = document.getElementById('preset-grid')
  grid.innerHTML = PRESETS.map((p, i) => `
    <div class="preset-chip" data-i="${i}">
      <div class="preset-chip-icon">${p.icon}</div>
      <div class="preset-chip-name">${p.name}</div>
    </div>`).join('')

  grid.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      _clearSelections()
      chip.classList.add('selected')
      _presetSelected = true
      const p = PRESETS[chip.dataset.i]
      document.getElementById('f-name').value = p.name
      document.getElementById('f-volume').value = p.vol
      document.getElementById('f-abv').value = p.abv
      _updateUnitsDisplay()
    })
  })

  _buildSavedGrid()
}

function _buildSavedGrid() {
  const customs = getCustomDrinks()
  const section = document.getElementById('saved-section')
  const grid = document.getElementById('saved-grid')

  if (customs.length === 0) {
    section.style.display = 'none'
    return
  }

  section.style.display = 'block'
  grid.innerHTML = customs.map(c => `
    <div class="preset-chip" data-custom-id="${c.id}">
      <button class="custom-chip-del" data-del-id="${c.id}" aria-label="Remove">×</button>
      <div class="preset-chip-icon">${c.icon || '🥤'}</div>
      <div class="preset-chip-name">${c.name}</div>
    </div>`).join('')

  grid.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.classList.contains('custom-chip-del')) return
      _clearSelections()
      chip.classList.add('selected')
      _presetSelected = true
      const id = chip.dataset.customId
      const c = getCustomDrinks().find(x => x.id === id)
      if (!c) return
      document.getElementById('f-name').value = c.name
      document.getElementById('f-volume').value = c.vol
      document.getElementById('f-abv').value = c.abv
      _updateUnitsDisplay()
    })
  })

  grid.querySelectorAll('.custom-chip-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      deleteCustomDrink(btn.dataset.delId)
      _buildSavedGrid()
    })
  })
}

function _clearSelections() {
  document.querySelectorAll('#preset-grid .preset-chip, #saved-grid .preset-chip')
    .forEach(c => c.classList.remove('selected'))
  _presetSelected = false
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
  _editId = null
  _presetSelected = false
  document.getElementById('f-name').value = ''
  document.getElementById('f-volume').value = ''
  document.getElementById('f-abv').value = ''
  document.getElementById('f-cost').value = ''
  document.getElementById('f-units-display').value = '—'
  document.getElementById('btn-add-drink').textContent = 'Log Drink'
  _clearSelections()
  const now = new Date()
  document.getElementById('f-time').value = now.toTimeString().slice(0, 5)
  document.getElementById('add-modal').classList.add('open')
  _buildSavedGrid()
}

export function openEditModal(drink) {
  _editId = drink.id
  _presetSelected = true // don't auto-save as custom when editing
  document.getElementById('f-name').value = drink.name
  document.getElementById('f-volume').value = drink.volumeMl
  document.getElementById('f-abv').value = drink.abv
  document.getElementById('f-cost').value = drink.cost || ''
  document.getElementById('btn-add-drink').textContent = 'Save Changes'
  _updateUnitsDisplay()
  _clearSelections()
  const t = new Date(drink.timestamp)
  document.getElementById('f-time').value = t.toTimeString().slice(0, 5)
  document.getElementById('add-modal').classList.add('open')
  _buildSavedGrid()
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

  if (_editId) {
    // Edit mode: replace the existing entry
    await deleteLogEntry(_editId)
    _editId = null
  } else if (!_presetSelected) {
    saveCustomDrink({ name, vol, abv, icon: '🥤' })
  }

  const entry = {
    id:        crypto.randomUUID(),
    timestamp: now.getTime(),
    name, volumeMl: vol, abv, cost
  }

  await addLogEntry(entry)
  document.getElementById('btn-add-drink').textContent = 'Log Drink'
  closeModal()
  window.dispatchEvent(new CustomEvent('at:data-changed'))
}
