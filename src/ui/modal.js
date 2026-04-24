import { addLogEntry, deleteLogEntry, getCustomDrinks, saveCustomDrink, deleteCustomDrink } from '../storage.js'
import { calcUnits } from '../bac.js'
import { PRESETS, getPresetIcon } from '../presets.js'
import DRINKS_LIBRARY from '../drinks-library.json'

let _presetSelected = false
let _editId = null
let _selectedIcon = null

function _localDateStr(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function _setIcon(emoji) {
  _selectedIcon = emoji || null
  document.querySelectorAll('#f-icon-row .emoji-btn').forEach(btn => {
    btn.classList.toggle('selected', !!emoji && btn.dataset.emoji === emoji)
  })
}

function _iconForCategory(category) {
  const c = (category || '').toLowerCase()
  if (c === 'wine') return '🍷'
  if (c === 'spirits') return '🥃'
  if (c === 'rtd') return '🍹'
  if (c === 'prosecco' || c === 'sparkling') return '🥂'
  return '🍺'
}

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
      _setIcon(p.icon)
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
      _setIcon(c.icon || '🥤')
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
  document.getElementById('f-library-search').addEventListener('input', _onLibrarySearch)
  document.getElementById('f-icon-row').addEventListener('click', e => {
    const btn = e.target.closest('.emoji-btn')
    if (btn) _setIcon(btn.dataset.emoji)
  })
}

function _onLibrarySearch() {
  const q = document.getElementById('f-library-search').value.trim().toLowerCase()
  const resultsEl = document.getElementById('library-results')
  const quickSelectEl = document.getElementById('quick-select-section')

  if (!q) {
    resultsEl.innerHTML = ''
    resultsEl.style.display = 'none'
    quickSelectEl.style.display = ''
    return
  }

  const matches = DRINKS_LIBRARY.filter(d => d.name.toLowerCase().includes(q)).slice(0, 8)
  quickSelectEl.style.display = 'none'
  resultsEl.style.display = 'block'

  if (matches.length === 0) {
    resultsEl.innerHTML = '<p class="library-no-results">No matches — fill in manually below</p>'
    return
  }

  resultsEl.innerHTML = matches.map((d, i) => `
    <button class="library-result" data-i="${i}">
      <span class="library-result-name">${d.name}</span>
      <span class="library-result-meta">${d.volumeMl} ml · ${d.abv}%</span>
    </button>`).join('')

  resultsEl.querySelectorAll('.library-result').forEach((btn, i) => {
    btn.addEventListener('click', () => _selectLibraryEntry(matches[i]))
  })
}

function _selectLibraryEntry(drink) {
  document.getElementById('f-name').value = drink.name
  document.getElementById('f-volume').value = drink.volumeMl
  document.getElementById('f-abv').value = drink.abv
  _setIcon(_iconForCategory(drink.category))
  _presetSelected = true
  _updateUnitsDisplay()
  _resetLibrarySearch()
  _clearSelections()
  document.getElementById('f-cost').focus()
}

function _resetLibrarySearch() {
  document.getElementById('f-library-search').value = ''
  const resultsEl = document.getElementById('library-results')
  resultsEl.innerHTML = ''
  resultsEl.style.display = 'none'
  document.getElementById('quick-select-section').style.display = ''
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
  _setIcon(null)
  _resetLibrarySearch()
  const now = new Date()
  document.getElementById('f-date').value = _localDateStr(now)
  document.getElementById('f-date').max = _localDateStr(now)
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
  _setIcon(drink.icon || null)
  _resetLibrarySearch()
  const t = new Date(drink.timestamp)
  const today = new Date()
  document.getElementById('f-date').value = _localDateStr(t)
  document.getElementById('f-date').max = _localDateStr(today)
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

  const dateVal = document.getElementById('f-date').value
  const [year, month, day] = dateVal.split('-').map(Number)
  const [h, m] = timeVal.split(':').map(Number)
  const now = new Date(year, month - 1, day, h, m, 0, 0)

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
    name, volumeMl: vol, abv, cost,
    icon: _selectedIcon || getPresetIcon(name)
  }

  await addLogEntry(entry)
  document.getElementById('btn-add-drink').textContent = 'Log Drink'
  closeModal()
  window.dispatchEvent(new CustomEvent('at:data-changed'))
}
