import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, ChevronRight, Check, Zap, Users, Trophy, MapPin, Building2, BarChart3 } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════
// BRAND TOKENS — dark theme + orange accent (matches bnchmrkd app)
// ═══════════════════════════════════════════════════════════════════════
const ORANGE = '#f97316'
const ORANGE_GLOW = 'rgba(249,115,22,0.25)'
const BG = '#0a0a0a'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = 'rgba(255,255,255,0.06)'
const CARD_BORDER_SELECTED = 'rgba(249,115,22,0.5)'
const CARD_BG_SELECTED = 'rgba(249,115,22,0.08)'

const TOTAL_STEPS = 8

// ── Popular countries (shown as quick picks before search) ──
const POPULAR_COUNTRIES = [
  'United Arab Emirates', 'United Kingdom', 'United States', 'Kenya',
  'Jamaica', 'Australia', 'Nigeria', 'South Africa', 'Ethiopia', 'Canada',
  'Netherlands', 'France', 'Germany', 'Japan', 'India', 'Brazil',
]

// ── Coaching levels ──
const COACHING_LEVELS = [
  { id: 'grassroots', label: 'Grassroots / School', desc: "Working with beginners and school-age athletes" },
  { id: 'club', label: 'Club / Development', desc: 'Developing junior and intermediate club athletes' },
  { id: 'regional', label: 'Regional / National', desc: 'Coaching nationally competitive athletes' },
  { id: 'elite', label: 'Elite / International', desc: 'Working with Olympic and World Championship-level athletes' },
  { id: 'mix', label: 'Mix', desc: 'Coaching across multiple levels' },
]

// ── Discipline groups ──
const DISCIPLINE_GROUPS = [
  { id: 'Sprints', label: 'Sprints', icon: '⚡', desc: '100m, 200m, 400m' },
  { id: 'Middle Distance', label: 'Middle Distance', icon: '🏃', desc: '800m, 1500m, Mile' },
  { id: 'Long Distance', label: 'Long Distance', icon: '🏃‍♂️', desc: '3000m, 5000m, 10000m, Marathon' },
  { id: 'Hurdles', label: 'Hurdles', icon: '🚧', desc: '100mH, 110mH, 400mH' },
  { id: 'Throws', label: 'Throws', icon: '💪', desc: 'Shot Put, Discus, Javelin, Hammer' },
  { id: 'Jumps', label: 'Jumps', icon: '🦘', desc: 'High Jump, Long Jump, Triple Jump, Pole Vault' },
  { id: 'Multi-Events', label: 'Multi-Events', icon: '🏅', desc: 'Decathlon, Heptathlon' },
  { id: 'Race Walks', label: 'Race Walks', icon: '🚶', desc: '10km, 20km, 35km Walk' },
]

// ── Squad sizes ──
const SQUAD_SIZES = [
  { id: '1-5', label: '1–5', desc: 'Small group or private coaching' },
  { id: '6-15', label: '6–15', desc: 'Typical club squad' },
  { id: '16-30', label: '16–30', desc: 'Large training group' },
  { id: '30+', label: '30+', desc: 'Program or academy-level' },
]


export default function CoachOnboarding({ onComplete }) {
  const { user, createProfile, createCoachProfile } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Collected data
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [country, setCountry] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [organization, setOrganization] = useState('')
  const [coachingLevel, setCoachingLevel] = useState('')
  const [disciplines, setDisciplines] = useState([])
  const [squadSize, setSquadSize] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // ── Navigation ──
  const canProceed = () => {
    switch (step) {
      case 1: return true // welcome — always
      case 2: return firstName.trim().length > 0 && lastName.trim().length > 0
      case 3: return country.trim().length > 0
      case 4: return true // org is optional
      case 5: return coachingLevel.length > 0
      case 6: return disciplines.length > 0
      case 7: return squadSize.length > 0
      case 8: return acceptedTerms
      default: return false
    }
  }

  const next = () => { if (canProceed() && step < TOTAL_STEPS) setStep(step + 1) }
  const back = () => { if (step > 1) setStep(step - 1) }

  const toggleDiscipline = (id) => {
    setDisciplines(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  // ── Submit ──
  const handleFinish = async () => {
    setError(null)
    setLoading(true)
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`

      const { error: profileError } = await createProfile({
        account_type: 'coach',
        full_name: fullName,
        country: country || null,
      })
      if (profileError) throw profileError

      const { error: coachError } = await createCoachProfile({
        organization: organization || null,
        coaching_level: coachingLevel || null,
        disciplines: disciplines.length > 0 ? disciplines : null,
        squad_size: squadSize || null,
      })
      if (coachError) throw coachError

      // Profile created — App.jsx auto-routes to CoachDashboard
    } catch (err) {
      setError(err.message || 'Failed to create profile')
      setLoading(false)
    }
  }

  // ── Progress bar ──
  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  // ── Shared layout wrapper ──
  const Screen = ({ children, showBack = true, ctaLabel = 'Continue', onCta, ctaDisabled }) => (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>
      {/* Progress bar */}
      {step > 1 && (
        <div className="w-full h-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${ORANGE}, #fb923c)` }}
          />
        </div>
      )}

      {/* Back button */}
      {showBack && step > 1 && (
        <div className="px-5 pt-4">
          <button
            onClick={back}
            className="flex items-center gap-1 text-slate-500 hover:text-white transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 max-w-lg mx-auto w-full">
        {children}
      </div>

      {/* CTA button */}
      <div className="px-6 pb-8 sm:pb-10 max-w-lg mx-auto w-full">
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}
        <button
          onClick={onCta || next}
          disabled={ctaDisabled || !canProceed() || loading}
          className="w-full py-4 rounded-2xl text-white font-semibold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canProceed() && !ctaDisabled
              ? `linear-gradient(135deg, #ea580c 0%, ${ORANGE} 50%, #fb923c 100%)`
              : 'rgba(255,255,255,0.06)',
            boxShadow: canProceed() && !ctaDisabled ? `0 4px 20px ${ORANGE_GLOW}` : 'none',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Setting up...</span>
            </div>
          ) : (
            ctaLabel
          )}
        </button>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Welcome
  // ═══════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <Screen showBack={false} ctaLabel="Get started">
        <div className="text-center">
          {/* Logo mark */}
          <div className="mb-8">
            <span className="text-6xl font-bold text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              b<span style={{ color: ORANGE }}>.</span>
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
            Welcome to bnchmrkd.
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-sm mx-auto">
            Context for sports performance. Let's set up your coaching profile.
          </p>
        </div>
      </Screen>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Name
  // ═══════════════════════════════════════════════════════════════════
  if (step === 2) {
    return (
      <Screen ctaLabel="Continue">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
            What's your name?
          </h1>
          <p className="text-slate-400 mb-8">This is how you'll appear to your athletes.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-500 mb-2">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                className="w-full px-4 py-4 rounded-xl text-white text-lg placeholder-slate-600 focus:outline-none transition-colors"
                style={{ background: CARD_BG, border: `1px solid ${firstName ? CARD_BORDER_SELECTED : CARD_BORDER}` }}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-4 rounded-xl text-white text-lg placeholder-slate-600 focus:outline-none transition-colors"
                style={{ background: CARD_BG, border: `1px solid ${lastName ? CARD_BORDER_SELECTED : CARD_BORDER}` }}
                placeholder="Last name"
              />
            </div>
          </div>
        </div>
      </Screen>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Country
  // ═══════════════════════════════════════════════════════════════════
  if (step === 3) {
    const filteredCountries = countrySearch
      ? POPULAR_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()))
      : POPULAR_COUNTRIES

    return (
      <Screen ctaLabel="Continue">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
            Where are you based?
          </h1>
          <p className="text-slate-400 mb-6">Helps us show relevant competition standards.</p>

          <input
            type="text"
            value={countrySearch}
            onChange={(e) => { setCountrySearch(e.target.value); if (!country) setCountry('') }}
            placeholder="Search countries..."
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none mb-4"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
          />

          <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {filteredCountries.map(c => (
              <button
                key={c}
                onClick={() => { setCountry(c); setCountrySearch('') }}
                className="text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: country === c ? CARD_BG_SELECTED : CARD_BG,
                  border: `1px solid ${country === c ? CARD_BORDER_SELECTED : CARD_BORDER}`,
                  color: country === c ? ORANGE : '#94a3b8',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {countrySearch && filteredCountries.length === 0 && (
            <button
              onClick={() => { setCountry(countrySearch); setCountrySearch('') }}
              className="mt-3 w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: CARD_BG_SELECTED,
                border: `1px solid ${CARD_BORDER_SELECTED}`,
                color: ORANGE,
              }}
            >
              Use "{countrySearch}"
            </button>
          )}
        </div>
      </Screen>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: Organization
  // ═══════════════════════════════════════════════════════════════════
  if (step === 4) {
    return (
      <Screen ctaLabel={organization ? 'Continue' : 'Skip'}>
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
            Who do you coach for?
          </h1>
          <p className="text-slate-400 mb-8">Your club, school, federation, or organization.</p>

          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            autoFocus
            className="w-full px-4 py-4 rounded-xl text-white text-lg placeholder-slate-600 focus:outline-none transition-colors"
            style={{ background: CARD_BG, border: `1px solid ${organization ? CARD_BORDER_SELECTED : CARD_BORDER}` }}
            placeholder="e.g. Dubai Athletics Club"
          />

          <button
            onClick={() => { setOrganization(''); next() }}
            className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            I'm an independent coach
          </button>
        </div>
      </Screen>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: Coaching Level
  // ═══════════════════════════════════════════════════════════════════
  if (step === 5) {
    return (
      <Screen ctaLabel="Continue">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
            What level do you coach at?
          </h1>
          <p className="text-slate-400 mb-6">This tailors the benchmarks and standards you see.</p>

          <div className="space-y-3">
            {COACHING_LEVELS.map(level => (
              <button
                key={level.id}
                onClick={() => setCoachingLevel(level.id)}
                className="w-full text-left px-5 py-4 rounded-xl transition-all"
                style={{
                  background: coachingLevel === level.id ? CARD_BG_SELECTED : CARD_BG,
                  border: `1px solid ${coachingLevel === level.id ? CARD_BORDER_SELECTED : CARD_BORDER}`,
                }}
              >
                <div className="font-semibold text-base" style={{ color: coachingLevel === level.id ? ORANGE : '#fff' }}>
                  {level.label}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">{level.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </Screen>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: Disciplines
  // ═══════════════════════════════════════════════════════════════════
  if (step === 6) {
    return (
      <Screen ctaLabel="Continue">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
            What do you coach?
          </h1>
          <p className="text-slate-400 mb-6">Select all that apply.</p>

          <div className="grid grid-cols-2 gap-3">
            {DISCIPLINE_GROUPS.map(group => {
              const selected = disciplines.includes(group.id)
              return (
                <button
                  key={group.id}
                  onClick={() => toggleDiscipline(group.id)}
                  className="text-left px-4 py-4 rounded-xl transition-all relative"
                  style={{
                    background: selected ? CARD_BG_SELECTED : CARD_BG,
                    border: `1px solid ${selected ? CARD_BORDER_SELECTED : CARD_BORDER}`,
                  }}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: ORANGE }}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="text-2xl mb-2">{group.icon}</div>
                  <div className="font-semibold text-sm" style={{ color: selected ? ORANGE : '#fff' }}>
                    {group.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{group.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      </Screen>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 7: Squad Size
  // ═══════════════════════════════════════════════════════════════════
  if (step === 7) {
    return (
      <Screen ctaLabel="Continue">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
            How many athletes do you work with?
          </h1>
          <p className="text-slate-400 mb-6">Helps us tailor your dashboard experience.</p>

          <div className="space-y-3">
            {SQUAD_SIZES.map(size => (
              <button
                key={size.id}
                onClick={() => setSquadSize(size.id)}
                className="w-full text-left px-5 py-4 rounded-xl transition-all"
                style={{
                  background: squadSize === size.id ? CARD_BG_SELECTED : CARD_BG,
                  border: `1px solid ${squadSize === size.id ? CARD_BORDER_SELECTED : CARD_BORDER}`,
                }}
              >
                <div className="font-semibold text-lg" style={{ color: squadSize === size.id ? ORANGE : '#fff' }}>
                  {size.label}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">{size.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </Screen>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 8: Plan Teaser + Terms + Go
  // ═══════════════════════════════════════════════════════════════════
  if (step === 8) {
    return (
      <Screen ctaLabel="Start free" ctaDisabled={!acceptedTerms} onCta={handleFinish}>
        <div>
          {/* Early access badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ background: 'rgba(249,115,22,0.1)', color: ORANGE, border: '1px solid rgba(249,115,22,0.2)' }}
          >
            <Zap className="w-3 h-3" /> Early Access
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
            bnchmrkd. is free while in early access
          </h1>

          <div className="space-y-3 mb-8">
            {[
              { icon: BarChart3, text: 'Unlimited athlete analyses' },
              { icon: Users, text: 'Full squad management' },
              { icon: Trophy, text: 'Olympic & World Championship benchmarks' },
              { icon: MapPin, text: 'All disciplines and events' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)' }}>
                  <Icon className="w-4 h-4" style={{ color: ORANGE }} />
                </div>
                <span className="text-slate-300 text-sm">{text}</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${CARD_BORDER}` }}>
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="text-slate-400 font-medium">Coming later with Pro:</span>{' '}
              API integrations (Strava, Garmin), advanced exports, priority support, and more.
              We'll let you know when it's ready.
            </p>
          </div>

          {/* Terms checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
              style={{
                background: acceptedTerms ? ORANGE : 'transparent',
                border: `2px solid ${acceptedTerms ? ORANGE : 'rgba(255,255,255,0.15)'}`,
              }}
              onClick={() => setAcceptedTerms(!acceptedTerms)}
            >
              {acceptedTerms && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-xs text-slate-400 leading-relaxed">
              I agree to the{' '}
              <a href="/?view=terms" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: ORANGE }}>Terms of Service</a>
              {' '}and{' '}
              <a href="/?view=privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: ORANGE }}>Privacy Policy</a>
            </span>
          </label>
        </div>
      </Screen>
    )
  }

  return null
}
