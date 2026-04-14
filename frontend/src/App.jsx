import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import AuthPage from './components/auth/AuthPage'
import Onboarding from './components/auth/Onboarding'
import CoachDashboard from './components/coach/CoachDashboard'
import AthleteDashboard from './components/athlete/AthleteDashboard'
import MatrixPreview from './components/MatrixPreview'
import BnchMrkdApp from './bnchmarkd-app'

export default function App() {
  const { user, profile, loading, signOut } = useAuth()

  // Localhost-only preview route for the Performance Matrix design.
  // Bypasses all auth + auto-routing so we can iterate on the component
  // without touching production user flow.
  if (typeof window !== 'undefined') {
    const previewView = new URLSearchParams(window.location.search).get('view')
    if (previewView === 'matrix') {
      return <MatrixPreview />
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

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // User clicked "Sign Up" / "Log In" from the app → show auth page
  if (showAuth && !user) {
    return <AuthPage onBack={() => setShowAuth(false)} />
  }

  // User explicitly opened onboarding
  if (showOnboarding && user && !profile) {
    return <Onboarding onSkip={() => setShowOnboarding(false)} />
  }

  // Coach dashboard — gated to coach accounts only
  if (showDashboard && user && profile?.account_type === 'coach') {
    return (
      <CoachDashboard
        user={user}
        profile={profile}
        onBack={() => setShowDashboard(false)}
        onViewAthlete={(athlete) => {
          setIncomingAthlete(athlete)
          setShowDashboard(false)
        }}
      />
    )
  }

  // Athlete dashboard — gated to athlete accounts only
  if (showAthleteDashboard && user && profile?.account_type === 'athlete') {
    return (
      <AthleteDashboard
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
      />
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
