import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from './contexts/AuthContext'
import { callRpc } from './lib/supabaseRest'
import BnchMrkdApp from './bnchmarkd-app'

// Post-login / secondary views are lazy-loaded so they (and heavy deps like
// recharts in AthleteDashboard) stay out of the initial landing bundle.
const AuthPage = lazy(() => import('./components/auth/AuthPage'))
const Onboarding = lazy(() => import('./components/auth/Onboarding'))
const CoachDashboard = lazy(() => import('./components/coach/CoachDashboard'))
const AthleteDashboard = lazy(() => import('./components/athlete/AthleteDashboard'))
const MatrixPreview = lazy(() => import('./components/MatrixPreview'))

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}

// Detect a stored Supabase session synchronously so we only block first paint
// on auth for RETURNING signed-in users. Fresh visitors skip the spinner.
function hasStoredSession() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL || ''
    const ref = url.replace('https://', '').split('.')[0]
    return !!localStorage.getItem(`sb-${ref}-auth-token`)
  } catch {
    return false
  }
}

export default function App() {
  const { user, profile, loading, signOut } = useAuth()

  // Localhost-only preview route for the Performance Matrix design.
  // Bypasses all auth + auto-routing so we can iterate on the component
  // without touching production user flow.
  if (typeof window !== 'undefined') {
    const previewView = new URLSearchParams(window.location.search).get('view')
    if (previewView === 'matrix') {
      return <Suspense fallback={<FullScreenSpinner />}><MatrixPreview /></Suspense>
    }
  }

  const [showAuth, setShowAuth] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showAthleteDashboard, setShowAthleteDashboard] = useState(false)
  const [incomingAthlete, setIncomingAthlete] = useState(null)
  const [autoRouted, setAutoRouted] = useState(false)
  const [athleteTrajectoryMode, setAthleteTrajectoryMode] = useState(false)

  // Auto-route coaches and athletes to their respective dashboards after login
  // — but not if they've deep-linked to a legal page (?view=privacy/terms/about)
  useEffect(() => {
    const deepLink = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('view')
      : null
    const isLegalDeepLink = deepLink === 'privacy' || deepLink === 'terms' || deepLink === 'about'
    if (user && !isLegalDeepLink) {
      // Onboarding just completed → profile now exists, route to dashboard
      if (showOnboarding && profile) {
        setShowOnboarding(false)
        if (profile.account_type === 'coach') setShowDashboard(true)
        else if (profile.account_type === 'athlete') setShowAthleteDashboard(true)
        setAutoRouted(true)
        return
      }
      if (!autoRouted) {
        if (!profile) {
          setShowOnboarding(true)
          setAutoRouted(true)
        } else if (profile.account_type === 'coach') {
          setShowDashboard(true)
          setAutoRouted(true)
        } else if (profile.account_type === 'athlete') {
          setShowAthleteDashboard(true)
          setAutoRouted(true)
        }
      }
    }
    if (!user) { setAutoRouted(false); setShowOnboarding(false) }
  }, [user, profile, autoRouted, showOnboarding])

  // A9: capture a share-link invite token (?invite=...) so it survives sign-up.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = new URLSearchParams(window.location.search).get('invite')
    if (token) {
      try { localStorage.setItem('bnchmrkd:invite_token', token) } catch { /* ignore */ }
    }
  }, [])

  // A9: once a signed-in athlete is present, attach their account to the invite.
  // The link stays pending → they still explicitly approve it from their dashboard.
  useEffect(() => {
    if (!user || !profile || profile.account_type !== 'athlete') return
    let token = null
    try { token = localStorage.getItem('bnchmrkd:invite_token') } catch { /* ignore */ }
    if (!token) return
    callRpc('claim_invite', { p_token: token })
      .catch(() => { /* non-fatal */ })
      .finally(() => { try { localStorage.removeItem('bnchmrkd:invite_token') } catch { /* ignore */ } })
  }, [user, profile])

  // Only block first paint on auth for returning signed-in users. Fresh
  // visitors (no stored session) go straight to the landing page.
  if (loading && hasStoredSession()) {
    return <FullScreenSpinner />
  }

  // User clicked "Sign Up" / "Log In" from the app → show auth page
  if (showAuth && !user) {
    return <Suspense fallback={<FullScreenSpinner />}><AuthPage onBack={() => setShowAuth(false)} /></Suspense>
  }

  // User explicitly opened onboarding
  if (showOnboarding && user && !profile) {
    return <Suspense fallback={<FullScreenSpinner />}><Onboarding onSkip={() => setShowOnboarding(false)} /></Suspense>
  }

  // Coach dashboard — gated to coach accounts only
  if (showDashboard && user && profile?.account_type === 'coach') {
    return (
      <Suspense fallback={<FullScreenSpinner />}><CoachDashboard
        user={user}
        profile={profile}
        onBack={() => setShowDashboard(false)}
        onViewAthlete={(athlete) => {
          setIncomingAthlete(athlete)
          setShowDashboard(false)
        }}
      /></Suspense>
    )
  }

  // Athlete dashboard — gated to athlete accounts only
  if (showAthleteDashboard && user && profile?.account_type === 'athlete') {
    return (
      <Suspense fallback={<FullScreenSpinner />}><AthleteDashboard
        user={user}
        profile={profile}
        onSignOut={async () => {
          await signOut()
          setShowAthleteDashboard(false)
        }}
        onViewTrajectory={(athletePayload) => {
          setIncomingAthlete(athletePayload)
          setAthleteTrajectoryMode(true)
          setShowAthleteDashboard(false)
        }}
      /></Suspense>
    )
  }

  // Main app — always accessible, landing page first
  return (
    <>
      <BnchMrkdApp
        user={user}
        profile={profile}
        onSignUp={() => setShowAuth(true)}
        onSignOut={signOut}
        onSetupProfile={() => setShowOnboarding(true)}
        onOpenDashboard={() => setShowDashboard(true)}
        incomingAthlete={incomingAthlete}
        onIncomingAthleteConsumed={() => setIncomingAthlete(null)}
      />
      {athleteTrajectoryMode && profile?.account_type === 'athlete' && (
        <button
          onClick={() => {
            setAthleteTrajectoryMode(false)
            setIncomingAthlete(null)
            setShowAthleteDashboard(true)
          }}
          className="fixed top-4 left-4 z-[200] flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/30 text-sm font-medium transition-all"
        >
          ← My Dashboard
        </button>
      )}
    </>
  )
}
