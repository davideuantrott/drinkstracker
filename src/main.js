import './style.css'
import { isSupabaseEnabled, onAuthChange, getSession, signOut } from './auth.js'
import { initStorage, pullFromSupabase, migrateLocalToCloud, hasMigrated, processQueue, clearLocalCache, getLog, onSyncStatusChange } from './storage.js'
import { initAuthScreen, showAuthScreen, hideAuthScreen } from './ui/auth-screen.js'
import { loadSettingsForm, bindSettingsEvents } from './ui/settings.js'
import { buildPresetGrid, bindModalEvents, showMigrationModal, bindMigrationEvents } from './ui/modal.js'
import { renderToday } from './ui/today.js'
import { renderLog } from './ui/log.js'
import { renderStats } from './ui/stats.js'

let currentPage = 'today'

async function boot() {
  await initStorage()

  buildPresetGrid()
  bindModalEvents()
  bindSettingsEvents()
  await loadSettingsForm()
  _bindNav()
  renderToday()

  _bindGlobalEvents()

  if (isSupabaseEnabled) {
    initAuthScreen()
    _initSyncDot()

    onAuthChange(async (event, session) => {
      if (session) {
        hideAuthScreen()
        await _onSignedIn()
      } else {
        clearLocalCache()
        showAuthScreen()
      }
    })

    const session = await getSession()
    if (!session) {
      showAuthScreen()
    } else {
      hideAuthScreen()
      await _onSignedIn()
    }
  } else {
    hideAuthScreen()
  }
}

async function _onSignedIn() {
  await loadSettingsForm()
  const { hadLocalData } = await pullFromSupabase()
  renderToday()

  if (hadLocalData && !hasMigrated()) {
    const count = getLog().length
    showMigrationModal(count)
    bindMigrationEvents(
      async () => { await migrateLocalToCloud(); renderToday() },
      () => {}
    )
  }

  processQueue()
}

function _bindNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page
      currentPage = page
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
      document.getElementById('page-' + page).classList.add('active')

      if (page === 'log')   renderLog()
      if (page === 'stats') renderStats()
      if (page === 'today') renderToday()

      document.getElementById('fab').style.display = page === 'today' ? 'flex' : 'none'
    })
  })
}

function _bindGlobalEvents() {
  window.addEventListener('at:data-changed', () => {
    if (currentPage === 'today') renderToday()
    if (currentPage === 'stats') renderStats()
    if (currentPage === 'log')   renderLog()
  })

  window.addEventListener('at:settings-changed', () => {
    renderToday()
    if (currentPage === 'stats') renderStats()
  })

  window.addEventListener('at:signout', async () => {
    await signOut()
    clearLocalCache()
    showAuthScreen()
    currentPage = 'today'
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
    document.querySelector('[data-page="today"]').classList.add('active')
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
    document.getElementById('page-today').classList.add('active')
    document.getElementById('fab').style.display = 'flex'
    renderToday()
  })

  setInterval(() => { if (currentPage === 'today') renderToday() }, 60000)
}

function _initSyncDot() {
  const dot = document.getElementById('sync-dot')
  onSyncStatusChange(status => {
    dot.className = 'sync-dot sync-dot--' + status
    dot.title = { synced: 'Synced', pending: 'Syncing…', error: 'Sync error — tap to retry', offline: 'Offline' }[status] || ''
  })
  dot.addEventListener('click', () => {
    if (dot.className.includes('error')) processQueue()
  })
}

boot()
