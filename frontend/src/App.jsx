import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import AuthPage from './components/auth/AuthPage'
import Onboarding from './components/auth/Onboarding'
import CoachDashboard from './components/coach/CoachDashboard'
import BnchMrkdApp from './bnchmarkd-app'

export default function App() {
  const { user, profile, loading, signOut } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)

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

  // Coach dashboard — auth-gated, separate section
  if (showDashboard && user) {
    return (
      <CoachDashboard
        user={user}
        profile={profile}
        onBack={() => setShowDashboard(false)}
        onViewAthlete={(athlete) => {
          // TODO: Navigate to analysis view with athlete data pre-filled
          setShowDashboard(false)
        }}
      />
    )
  }

  // Main app — always accessible, landing page first
  return (
    <BnchMrkdApp
      user={user}
      profile={profile}
      onSignUp={() => setShowAuth(true)}
      onSignOut={signOut}
      onSetupProfile={() => setShowOnboarding(true)}
      onOpenDashboard={() => setShowDashboard(true)}
    />
  )
}
