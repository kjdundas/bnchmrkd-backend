import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  ChevronLeft, Check, Zap, Users, Trophy, MapPin, BarChart3,
  Timer, Route, Fence, Target, ArrowUpRight, Layers, Footprints,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════
// BRAND TOKENS
// ═══════════════════════════════════════════════════════════════════════
const ORANGE = '#f97316'
const ORANGE_GLOW = 'rgba(249,115,22,0.25)'
const BG = '#0a0a0a'
const CARD_BORDER = 'rgba(255,255,255,0.06)'
const CARD_BORDER_SELECTED = 'rgba(249,115,22,0.5)'
const CARD_BG_SELECTED = 'rgba(249,115,22,0.08)'

const TOTAL_STEPS = 8

const POPULAR_COUNTRIES = [
  'United Arab Emirates', 'United Kingdom', 'United States', 'Kenya',
  'Jamaica', 'Australia', 'Nigeria', 'South Africa', 'Ethiopia', 'Canada',
  'Netherlands', 'France', 'Germany', 'Japan', 'India', 'Brazil',
]

const COACHING_LEVELS = [
  { id: 'grassroots', label: 'Grassroots / School', desc: 'Working with beginners and school-age athletes' },
  { id: 'club', label: 'Club / Development', desc: 'Developing junior and intermediate club athletes' },
  { id: 'regional', label: 'Regional / National', desc: 'Coaching nationally competitive athletes' },
  { id: 'elite', label: 'Elite / International', desc: 'Olympic and World Championship-level athletes' },
  { id: 'mix', label: 'Mix', desc: 'Coaching across multiple levels' },
]

const DISCIPLINE_GROUPS = [
  { id: 'Sprints', label: 'Sprints', Icon: Zap, desc: '100m, 200m, 400m' },
  { id: 'Middle Distance', label: 'Middle Distance', Icon: Timer, desc: '800m, 1500m, Mile' },
  { id: 'Long Distance', label: 'Long Distance', Icon: Route, desc: '3000m, 5000m, 10000m, Marathon' },
  { id: 'Hurdles', label: 'Hurdles', Icon: Fence, desc: '100mH, 110mH, 400mH' },
  { id: 'Throws', label: 'Throws', Icon: Target, desc: 'Shot Put, Discus, Javelin, Hammer' },
  { id: 'Jumps', label: 'Jumps', Icon: ArrowUpRight, desc: 'High Jump, Long Jump, Triple Jump, Pole Vault' },
  { id: 'Multi-Events', label: 'Multi-Events', Icon: Layers, desc: 'Decathlon, Heptathlon' },
  { id: 'Race Walks', label: 'Race Walks', Icon: Footprints, desc: '10km, 20km, 35km Walk' },
]

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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [country, setCountry] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [organization, setOrganization] = useState('')
  const [coachingLevel, setCoachingLevel] = useState('')
  const [disciplines, setDisciplines] = useState([])
  const [squadSize, setSquadSize] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // Focus refs
  const firstNameRef = useRef(null)
  const countrySearchRef = useRef(null)
  const orgRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 2 && firstNameRef.current) firstNameRef.current.focus()
      if (step === 3 && countrySearchRef.current) countrySearchRef.current.focus()
      if (step === 4 && orgRef.current) orgRef.current.focus()
    }, 150)
    return () => clearTimeout(t)
  }, [step])

  const canProceed = () => {
    switch (step) {
      case 1: return true
      case 2: return firstName.trim().length > 0 && lastName.trim().length > 0
      case 3: return country.trim().length > 0
      case 4: return true
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
    setDisciplines(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

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
    } catch (err) {
      setError(err.message || 'Failed to create profile')
      setLoading(false)
    }
  }

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100
  const proceed = canProceed()

  // ── Determine CTA label and action per step ──
  let ctaLabel = 'Continue'
  let ctaAction = next
  let ctaDisabled = !proceed
  if (step === 1) ctaLabel = 'Get started'
  if (step === 4 && !organization) ctaLabel = 'Skip'
  if (step === 8) { ctaLabel = 'Start free'; ctaAction = handleFinish; ctaDisabled = !acceptedTerms }

  // ═══════════════════════════════════════════════════════════════════
  // Render step content (NOT a component — plain JSX to avoid remount)
  // ═══════════════════════════════════════════════════════════════════
  let content = null

  // STEP 1: Welcome
  if (step === 1) {
    content = (
      <div className="text-center">
        <div className="mb-10 relative inline-block">
          <div className="absolute inset-0 blur-3xl opacity-20 rounded-full" style={{ background: ORANGE, transform: 'scale(2)' }} />
          <span className="relative text-7xl font-bold text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em' }}>
            b<span style={{ color: ORANGE }}>.</span>
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight" style={{ letterSpacing: '-0.02em' }}>
          Welcome to bnchmrkd.
        </h1>
        <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-xs mx-auto">
          Context for sports performance.
        </p>
        <p className="text-slate-600 text-sm mt-2">Let's set up your coaching profile.</p>
      </div>
    )
  }

  // STEP 2: Name
  if (step === 2) {
    content = (
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight" style={{ letterSpacing: '-0.02em' }}>
          What's your name?
        </h1>
        <p className="text-slate-500 mb-8">This is how you'll appear to your athletes.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">First name</label>
            <input
              ref={firstNameRef}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-4 rounded-xl text-white text-lg placeholder-slate-700 focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${firstName ? CARD_BORDER_SELECTED : CARD_BORDER}`,
              }}
              placeholder="First name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">Last name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-4 rounded-xl text-white text-lg placeholder-slate-700 focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${lastName ? CARD_BORDER_SELECTED : CARD_BORDER}`,
              }}
              placeholder="Last name"
            />
          </div>
        </div>
      </div>
    )
  }

  // STEP 3: Country
  if (step === 3) {
    const filteredCountries = countrySearch
      ? POPULAR_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()))
      : POPULAR_COUNTRIES

    content = (
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight" style={{ letterSpacing: '-0.02em' }}>
          Where are you based?
        </h1>
        <p className="text-slate-500 mb-6">Helps us show relevant competition standards.</p>
        <input
          ref={countrySearchRef}
          type="text"
          value={countrySearch}
          onChange={(e) => { setCountrySearch(e.target.value); if (!country) setCountry('') }}
          placeholder="Search countries..."
          className="w-full px-4 py-3.5 rounded-xl text-white placeholder-slate-700 focus:outline-none mb-4 text-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${CARD_BORDER}` }}
        />
        <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1 -mr-1">
          {filteredCountries.map(c => (
            <button
              key={c}
              onClick={() => { setCountry(c); setCountrySearch('') }}
              className="text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: country === c ? CARD_BG_SELECTED : 'rgba(255,255,255,0.02)',
                border: `1px solid ${country === c ? CARD_BORDER_SELECTED : CARD_BORDER}`,
                color: country === c ? ORANGE : '#64748b',
              }}
            >
              {c}
            </button>
          ))}
        </div>
        {countrySearch && filteredCountries.length === 0 && (
          <button
            onClick={() => { setCountry(countrySearch); setCountrySearch('') }}
            className="mt-3 w-full text-left px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background: CARD_BG_SELECTED, border: `1px solid ${CARD_BORDER_SELECTED}`, color: ORANGE }}
          >
            Use "{countrySearch}"
          </button>
        )}
      </div>
    )
  }

  // STEP 4: Organization
  if (step === 4) {
    content = (
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight" style={{ letterSpacing: '-0.02em' }}>
          Who do you coach for?
        </h1>
        <p className="text-slate-500 mb-8">Your club, school, federation, or organization.</p>
        <input
          ref={orgRef}
          type="text"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          className="w-full px-4 py-4 rounded-xl text-white text-lg placeholder-slate-700 focus:outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${organization ? CARD_BORDER_SELECTED : CARD_BORDER}`,
          }}
          placeholder="e.g. Dubai Athletics Club"
        />
        <button
          onClick={() => { setOrganization(''); next() }}
          className="mt-5 text-sm text-slate-600 hover:text-slate-400 transition-colors"
        >
          I'm an independent coach
        </button>
      </div>
    )
  }

  // STEP 5: Coaching Level
  if (step === 5) {
    content = (
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight" style={{ letterSpacing: '-0.02em' }}>
          What level do you coach at?
        </h1>
        <p className="text-slate-500 mb-6">This tailors the benchmarks and standards you see.</p>
        <div className="space-y-2.5">
          {COACHING_LEVELS.map(level => {
            const selected = coachingLevel === level.id
            return (
              <button
                key={level.id}
                onClick={() => setCoachingLevel(level.id)}
                className="w-full text-left px-5 py-4 rounded-xl transition-all"
                style={{
                  background: selected ? CARD_BG_SELECTED : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selected ? CARD_BORDER_SELECTED : CARD_BORDER}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[15px]" style={{ color: selected ? '#fff' : '#cbd5e1' }}>
                      {level.label}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">{level.desc}</div>
                  </div>
                  {selected && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ml-3" style={{ background: ORANGE }}>
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // STEP 6: Disciplines
  if (step === 6) {
    content = (
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight" style={{ letterSpacing: '-0.02em' }}>
          What do you coach?
        </h1>
        <p className="text-slate-500 mb-6">Select all that apply.</p>
        <div className="grid grid-cols-2 gap-3">
          {DISCIPLINE_GROUPS.map(group => {
            const selected = disciplines.includes(group.id)
            const GroupIcon = group.Icon
            return (
              <button
                key={group.id}
                onClick={() => toggleDiscipline(group.id)}
                className="text-left px-4 py-4 rounded-xl transition-all relative"
                style={{
                  background: selected ? CARD_BG_SELECTED : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selected ? CARD_BORDER_SELECTED : CARD_BORDER}`,
                }}
              >
                {selected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: ORANGE }}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                  style={{
                    background: selected ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selected ? 'rgba(249,115,22,0.2)' : CARD_BORDER}`,
                  }}
                >
                  <GroupIcon style={{ color: selected ? ORANGE : '#64748b', width: 18, height: 18 }} />
                </div>
                <div className="font-semibold text-sm" style={{ color: selected ? '#fff' : '#cbd5e1' }}>
                  {group.label}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">{group.desc}</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // STEP 7: Squad Size
  if (step === 7) {
    content = (
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight" style={{ letterSpacing: '-0.02em' }}>
          How many athletes do you work with?
        </h1>
        <p className="text-slate-500 mb-6">Helps us tailor your dashboard experience.</p>
        <div className="space-y-2.5">
          {SQUAD_SIZES.map(size => {
            const selected = squadSize === size.id
            return (
              <button
                key={size.id}
                onClick={() => setSquadSize(size.id)}
                className="w-full text-left px-5 py-4 rounded-xl transition-all"
                style={{
                  background: selected ? CARD_BG_SELECTED : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selected ? CARD_BORDER_SELECTED : CARD_BORDER}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg" style={{ color: selected ? '#fff' : '#cbd5e1' }}>
                      {size.label}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">{size.desc}</div>
                  </div>
                  {selected && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ml-3" style={{ background: ORANGE }}>
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // STEP 8: Plan Teaser + Terms
  if (step === 8) {
    content = (
      <div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: 'rgba(249,115,22,0.08)', color: ORANGE, border: '1px solid rgba(249,115,22,0.15)' }}
        >
          <Zap className="w-3 h-3" /> Early Access
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
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
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.12)' }}
              >
                <Icon className="w-4 h-4" style={{ color: ORANGE }} />
              </div>
              <span className="text-slate-300 text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${CARD_BORDER}` }}>
          <p className="text-xs text-slate-600 leading-relaxed">
            <span className="text-slate-500 font-medium">Coming later with Pro: </span>
            API integrations (Strava, Garmin), advanced exports, priority support, and more.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <button
            type="button"
            onClick={() => setAcceptedTerms(!acceptedTerms)}
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
            style={{
              background: acceptedTerms ? ORANGE : 'transparent',
              border: `2px solid ${acceptedTerms ? ORANGE : 'rgba(255,255,255,0.12)'}`,
              boxShadow: acceptedTerms ? `0 0 8px ${ORANGE_GLOW}` : 'none',
            }}
          >
            {acceptedTerms && <Check className="w-3 h-3 text-white" />}
          </button>
          <span className="text-xs text-slate-500 leading-relaxed">
            I agree to the{' '}
            <a href="/?view=terms" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline" style={{ color: ORANGE }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/?view=privacy" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline" style={{ color: ORANGE }}>Privacy Policy</a>
          </span>
        </label>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // SINGLE STABLE LAYOUT — never remounts between steps
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>
      {/* Progress bar */}
      {step > 1 && (
        <div className="w-full h-0.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${ORANGE}, #fb923c)` }}
          />
        </div>
      )}

      {/* Back button */}
      {step > 1 && (
        <div className="px-5 pt-5">
          <button
            onClick={back}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${CARD_BORDER}` }}
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 max-w-lg mx-auto w-full">
        {content}
      </div>

      {/* CTA */}
      <div className="px-6 pb-8 sm:pb-10 max-w-lg mx-auto w-full">
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            {error}
          </div>
        )}
        <button
          onClick={ctaAction}
          disabled={ctaDisabled || loading}
          className="w-full py-4 rounded-2xl text-white font-semibold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: !ctaDisabled && !loading
              ? `linear-gradient(135deg, #ea580c 0%, ${ORANGE} 50%, #fb923c 100%)`
              : 'rgba(255,255,255,0.04)',
            boxShadow: !ctaDisabled && !loading ? `0 4px 24px ${ORANGE_GLOW}` : 'none',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Setting up...</span>
            </div>
          ) : ctaLabel}
        </button>
      </div>
    </div>
  )
}
