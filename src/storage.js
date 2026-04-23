import { supabase, isSupabaseEnabled } from './auth.js'

const LOG_KEY = 'at-log'
const SETTINGS_KEY = 'at-settings'
const QUEUE_KEY = 'at-sync-queue'
const MIGRATED_KEY = 'at-migrated'
const CUSTOMS_KEY = 'at-customs'

export const DEFAULT_SETTINGS = {
  gender: 'male',
  weightKg: 75,
  weightUnit: 'kg',
  bacUnit: 'permille',
  volUnit: 'ml',
  currency: '£',
  weeklyGoal: 14,
  legalLimit: 0.80
}

let _log = []
let _settings = { ...DEFAULT_SETTINGS }
let _customs = []
let _syncStatus = 'synced'
let _syncListeners = []

// ── Public state accessors ──────────────────────────────────────────────────

export function getLog() { return _log }
export function getSettings() { return _settings }
export function getSyncStatus() { return _syncStatus }

export function onSyncStatusChange(fn) {
  _syncListeners.push(fn)
  return () => { _syncListeners = _syncListeners.filter(f => f !== fn) }
}

// ── Init ────────────────────────────────────────────────────────────────────

export async function initStorage() {
  _settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || { ...DEFAULT_SETTINGS }
  _log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
  _customs = JSON.parse(localStorage.getItem(CUSTOMS_KEY) || '[]')
  _migrateIds()
}

// ── Write operations ────────────────────────────────────────────────────────

export async function addLogEntry(entry) {
  _log.push(entry)
  _persistLog()
  _syncEntry('upsert', entry)
}

export async function deleteLogEntry(id) {
  _log = _log.filter(d => d.id !== id)
  _persistLog()
  _syncEntry('delete', { id })
}

export async function saveSettings(s) {
  _settings = s
  _persistSettings()
  _syncSettings()
}

export async function clearAllData() {
  _log = []
  _settings = { ...DEFAULT_SETTINGS }
  _customs = []
  _persistLog()
  _persistSettings()
  _persistCustoms()
  if (!isSupabaseEnabled || !supabase) return
  const session = await supabase.auth.getSession()
  const userId = session.data.session?.user?.id
  if (!userId) return
  await supabase.from('drink_log').delete().eq('user_id', userId)
  await supabase.from('user_settings').delete().eq('user_id', userId)
  await supabase.from('user_customs').delete().eq('user_id', userId)
}

export function clearLocalCache() {
  _log = []
  _settings = { ...DEFAULT_SETTINGS }
  _customs = []
  localStorage.removeItem(LOG_KEY)
  localStorage.removeItem(SETTINGS_KEY)
  localStorage.removeItem(QUEUE_KEY)
  localStorage.removeItem(MIGRATED_KEY)
  localStorage.removeItem(CUSTOMS_KEY)
}

// ── Supabase pull (called after login) ─────────────────────────────────────

export async function pullFromSupabase() {
  if (!isSupabaseEnabled || !supabase) return { hadLocalData: false }
  const session = await supabase.auth.getSession()
  const userId = session.data.session?.user?.id
  if (!userId) return { hadLocalData: false }

  const localCount = _log.length

  try {
    const { data: drinks, error: drinksErr } = await supabase
      .from('drink_log')
      .select('*')
      .order('logged_at', { ascending: true })
    if (drinksErr) throw drinksErr

    const { data: settingsRow } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (settingsRow) {
      _settings = {
        gender:     settingsRow.gender      || _settings.gender,
        weightKg:   settingsRow.weight_kg   || _settings.weightKg,
        weightUnit: settingsRow.weight_unit || _settings.weightUnit,
        bacUnit:    settingsRow.bac_unit    || _settings.bacUnit,
        volUnit:    settingsRow.vol_unit    || _settings.volUnit,
        currency:   settingsRow.currency    || _settings.currency,
        weeklyGoal: settingsRow.weekly_goal || _settings.weeklyGoal,
        legalLimit: settingsRow.legal_limit || _settings.legalLimit
      }
      _persistSettings()
    }

    // Merge custom drink presets
    const { data: cloudCustomsRaw } = await supabase.from('user_customs').select('*')
    if (cloudCustomsRaw) {
      const cloudCustoms = cloudCustomsRaw.map(row => ({
        id:   row.id,
        name: row.name,
        vol:  parseFloat(row.vol),
        abv:  parseFloat(row.abv),
        icon: row.icon || '🥤'
      }))
      const cloudCustomIds = new Set(cloudCustoms.map(c => c.id))
      const localOnlyCustoms = _customs.filter(c => !cloudCustomIds.has(c.id))
      _customs = [...cloudCustoms, ...localOnlyCustoms]
      _persistCustoms()
      // Push local-only customs up to cloud
      for (const c of localOnlyCustoms) {
        _syncCustom('upsert', c)
      }
    }

    if (!drinks || drinks.length === 0) {
      return { hadLocalData: localCount > 0 }
    }

    const cloudLog = drinks.map(row => ({
      id:        row.id,
      timestamp: new Date(row.logged_at).getTime(),
      name:      row.name,
      volumeMl:  parseFloat(row.volume_ml),
      abv:       parseFloat(row.abv),
      cost:      parseFloat(row.cost) || 0
    }))

    const cloudIds = new Set(cloudLog.map(d => d.id))
    const localOnly = _log.filter(d => !cloudIds.has(d.id))
    _log = [...cloudLog, ...localOnly].sort((a, b) => a.timestamp - b.timestamp)
    _persistLog()
    _setSyncStatus('synced')

    // Push any local-only entries that aren't in the cloud
    if (localOnly.length > 0) {
      for (const entry of localOnly) {
        _syncEntry('upsert', entry)
      }
    }

    return { hadLocalData: false }
  } catch (err) {
    console.error('Pull error:', err)
    _setSyncStatus('error')
    return { hadLocalData: false }
  }
}

// ── Migration: push all local drinks to cloud ───────────────────────────────

export async function migrateLocalToCloud() {
  if (!isSupabaseEnabled || !supabase || _log.length === 0) return
  const session = await supabase.auth.getSession()
  const userId = session.data.session?.user?.id
  if (!userId) return

  _setSyncStatus('pending')
  try {
    const rows = _log.map(d => ({
      id:         d.id,
      user_id:    userId,
      logged_at:  new Date(d.timestamp).toISOString(),
      name:       d.name,
      volume_ml:  d.volumeMl,
      abv:        d.abv,
      cost:       d.cost || 0
    }))
    const { error } = await supabase.from('drink_log').upsert(rows)
    if (error) throw error

    await _syncSettingsNow(userId)
    localStorage.setItem(MIGRATED_KEY, 'true')
    _setSyncStatus('synced')
  } catch (err) {
    console.error('Migration error:', err)
    _setSyncStatus('error')
  }
}

export function hasMigrated() {
  return localStorage.getItem(MIGRATED_KEY) === 'true'
}

// ── Custom drinks ───────────────────────────────────────────────────────────

export function getCustomDrinks() {
  return _customs
}

export function saveCustomDrink(drink) {
  const exists = _customs.some(c => c.name === drink.name && c.vol === drink.vol && c.abv === drink.abv)
  if (exists) return
  const entry = { ...drink, id: crypto.randomUUID() }
  _customs.push(entry)
  _persistCustoms()
  _syncCustom('upsert', entry)
}

export function deleteCustomDrink(id) {
  _customs = _customs.filter(c => c.id !== id)
  _persistCustoms()
  _syncCustom('delete', { id })
}

// ── Offline queue ───────────────────────────────────────────────────────────

export async function processQueue() {
  if (!isSupabaseEnabled || !supabase || !navigator.onLine) return
  const q = _getQueue()
  if (q.length === 0) return

  const session = await supabase.auth.getSession()
  const userId = session.data.session?.user?.id
  if (!userId) return

  const failed = []
  for (const op of q) {
    try {
      if (op.action === 'upsert') {
        const { error } = await supabase.from('drink_log').upsert({
          id: op.id, user_id: userId,
          logged_at: new Date(op.timestamp).toISOString(),
          name: op.name, volume_ml: op.volumeMl, abv: op.abv, cost: op.cost || 0
        })
        if (error) throw error
      } else if (op.action === 'delete') {
        const { error } = await supabase.from('drink_log').delete().eq('id', op.id)
        if (error) throw error
      }
    } catch {
      failed.push(op)
    }
  }
  _setQueue(failed)
  _setSyncStatus(failed.length > 0 ? 'error' : 'synced')
}

window.addEventListener('online', processQueue)

// ── Private helpers ─────────────────────────────────────────────────────────

function _persistLog() {
  localStorage.setItem(LOG_KEY, JSON.stringify(_log))
}

function _persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings))
}

function _persistCustoms() {
  localStorage.setItem(CUSTOMS_KEY, JSON.stringify(_customs))
}

async function _syncCustom(action, custom) {
  if (!isSupabaseEnabled || !supabase) return
  try {
    const session = await supabase.auth.getSession()
    const userId = session.data.session?.user?.id
    if (!userId) return
    if (action === 'upsert') {
      await supabase.from('user_customs').upsert({
        id: custom.id, user_id: userId,
        name: custom.name, vol: custom.vol, abv: custom.abv, icon: custom.icon || '🥤'
      })
    } else if (action === 'delete') {
      await supabase.from('user_customs').delete().eq('id', custom.id)
    }
  } catch (err) {
    console.error('Custom sync error:', err)
  }
}

function _setSyncStatus(s) {
  _syncStatus = s
  _syncListeners.forEach(fn => fn(s))
}

function _isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function _migrateIds() {
  let changed = false
  _log = _log.map(entry => {
    if (!_isUUID(entry.id)) {
      changed = true
      return { ...entry, id: crypto.randomUUID() }
    }
    return entry
  })
  if (changed) _persistLog()
}

function _getQueue() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
}

function _setQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

function _enqueue(op) {
  const q = _getQueue().filter(item => !(item.action === op.action && item.id === op.id))
  q.push(op)
  _setQueue(q)
}

async function _syncEntry(action, entry) {
  if (!isSupabaseEnabled || !supabase) return
  if (!navigator.onLine) {
    _enqueue({ action, ...entry })
    _setSyncStatus('pending')
    return
  }
  _setSyncStatus('pending')
  try {
    const session = await supabase.auth.getSession()
    const userId = session.data.session?.user?.id
    if (!userId) { _setSyncStatus('error'); return }

    if (action === 'upsert') {
      const { error } = await supabase.from('drink_log').upsert({
        id: entry.id, user_id: userId,
        logged_at: new Date(entry.timestamp).toISOString(),
        name: entry.name, volume_ml: entry.volumeMl, abv: entry.abv, cost: entry.cost || 0
      })
      if (error) throw error
    } else if (action === 'delete') {
      const { error } = await supabase.from('drink_log').delete().eq('id', entry.id)
      if (error) throw error
    }
    _setSyncStatus('synced')
  } catch (err) {
    console.error('Sync error:', err)
    _enqueue({ action, ...entry })
    _setSyncStatus('error')
  }
}

async function _syncSettings() {
  if (!isSupabaseEnabled || !supabase) return
  const session = await supabase.auth.getSession()
  const userId = session.data.session?.user?.id
  if (!userId) return
  await _syncSettingsNow(userId)
}

async function _syncSettingsNow(userId) {
  _setSyncStatus('pending')
  try {
    const { error } = await supabase.from('user_settings').upsert({
      user_id:     userId,
      gender:      _settings.gender,
      weight_kg:   _settings.weightKg,
      weight_unit: _settings.weightUnit,
      bac_unit:    _settings.bacUnit,
      vol_unit:    _settings.volUnit,
      currency:    _settings.currency,
      weekly_goal: _settings.weeklyGoal,
      legal_limit: _settings.legalLimit
    })
    if (error) throw error
    _setSyncStatus('synced')
  } catch (err) {
    console.error('Settings sync error:', err)
    _setSyncStatus('error')
  }
}
