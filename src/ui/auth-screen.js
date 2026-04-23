import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../auth.js'

export function initAuthScreen() {
  document.getElementById('auth-screen').innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">
        <div class="auth-logo-icon">🍺</div>
        <div class="auth-logo-name">AlcoTrack</div>
        <div class="auth-logo-sub">Track your drinking</div>
      </div>

      <button class="btn-google" id="btn-google">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div class="auth-divider"><span>or</span></div>

      <div id="auth-error" class="auth-error" style="display:none"></div>

      <div class="form-group">
        <input type="email" class="form-input" id="auth-email" placeholder="Email address" autocomplete="email">
      </div>
      <div class="form-group">
        <input type="password" class="form-input" id="auth-password" placeholder="Password" autocomplete="current-password">
      </div>

      <button class="btn-primary" id="btn-signin">Sign In</button>

      <div class="auth-toggle">
        <span id="auth-toggle-text">Don't have an account?</span>
        <button class="auth-toggle-btn" id="btn-toggle-mode">Sign Up</button>
      </div>

      <p class="auth-disclaimer">
        BAC estimates are approximations only.<br>Never use this app to determine fitness to drive.
      </p>
    </div>`

  let isSignUp = false

  document.getElementById('btn-google').addEventListener('click', async () => {
    _setError('')
    await signInWithGoogle()
  })

  document.getElementById('btn-toggle-mode').addEventListener('click', () => {
    isSignUp = !isSignUp
    document.getElementById('btn-signin').textContent = isSignUp ? 'Create Account' : 'Sign In'
    document.getElementById('auth-toggle-text').textContent = isSignUp ? 'Already have an account?' : "Don't have an account?"
    document.getElementById('btn-toggle-mode').textContent = isSignUp ? 'Sign In' : 'Sign Up'
    document.getElementById('auth-password').autocomplete = isSignUp ? 'new-password' : 'current-password'
    _setError('')
  })

  document.getElementById('btn-signin').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim()
    const password = document.getElementById('auth-password').value
    if (!email || !password) { _setError('Please enter your email and password.'); return }

    const btn = document.getElementById('btn-signin')
    btn.disabled = true
    btn.textContent = '...'
    _setError('')

    const fn = isSignUp ? signUpWithEmail : signInWithEmail
    const { error } = await fn(email, password)
    btn.disabled = false
    btn.textContent = isSignUp ? 'Create Account' : 'Sign In'

    if (error) {
      _setError(_friendlyError(error.message))
    } else if (isSignUp) {
      _setError('Check your email to confirm your account, then sign in.')
    }
  })

  document.getElementById('auth-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('auth-password').focus()
  })
  document.getElementById('auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-signin').click()
  })
}

export function showAuthScreen() {
  document.getElementById('loading-screen').style.display = 'none'
  document.getElementById('auth-screen').style.display = 'flex'
  document.getElementById('app').style.display = 'none'
}

export function hideAuthScreen() {
  document.getElementById('loading-screen').style.display = 'none'
  document.getElementById('auth-screen').style.display = 'none'
  document.getElementById('app').style.display = 'flex'
}

function _setError(msg) {
  const el = document.getElementById('auth-error')
  if (!el) return
  el.textContent = msg
  el.style.display = msg ? 'block' : 'none'
}

function _friendlyError(msg) {
  if (msg.includes('Invalid login')) return 'Incorrect email or password.'
  if (msg.includes('Email not confirmed')) return 'Please confirm your email first.'
  if (msg.includes('already registered')) return 'An account with this email already exists.'
  if (msg.includes('Password should')) return 'Password must be at least 6 characters.'
  return msg
}
