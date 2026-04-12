import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { User, Users, ChevronRight, ChevronLeft, MapPin, Calendar, Ruler, Weight, Trophy, Link as LinkIcon } from 'lucide-react'
import CoachOnboarding from './CoachOnboarding'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://web-production-295f1.up.railway.app'

// Discipline helpers (mirror AthleteDashboard / CoachDashboard)
const THROWS_KEYS = ['discus', 'shot', 'javelin', 'hammer']
const isThrowsDiscipline = (d) => d && THROWS_KEYS.some(t => d.toLowerCase().includes(t))
const formatMark = (value, discipline) => {
  if (value == null) return null
  if (isThrowsDiscipline(discipline)) return `${Number(value).toFixed(2)}m`
  const v = Number(value)
  const mins = Math.floor(v / 60)
  const secs = (v % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}

// All discipline options grouped by category
const DISCIPLINE_OPTIONS = [
  { code: 'M100', name: '100m', gender: 'M', category: 'Sprints' },
  { code: 'F100', name: '100m', gender: 'F', category: 'Sprints' },
  { code: 'M200', name: '200m', gender: 'M', category: 'Sprints' },
  { code: 'F200', name: '200m', gender: 'F', category: 'Sprints' },
  { code: 'M400', name: '400m', gender: 'M', category: 'Sprints' },
  { code: 'F400', name: '400m', gender: 'F', category: 'Sprints' },
  { code: 'M110H', name: '110m Hurdles', gender: 'M', category: 'Hurdles' },
  { code: 'F100H', name: '100m Hurdles', gender: 'F', category: 'Hurdles' },
  { code: 'M400H', name: '400m Hurdles', gender: 'M', category: 'Hurdles' },
  { code: 'F400H', name: '400m Hurdles', gender: 'F', category: 'Hurdles' },
  { code: 'MDT', name: 'Discus Throw', gender: 'M', category: 'Throws' },
  { code: 'FDT', name: 'Discus Throw', gender: 'F', category: 'Throws' },
  { code: 'MJT', name: 'Javelin Throw', gender: 'M', category: 'Throws' },
  { code: 'FJT', name: 'Javelin Throw', gender: 'F', category: 'Throws' },
  { code: 'MHT', name: 'Hammer Throw', gender: 'M', category: 'Throws' },
  { code: 'FHT', name: 'Hammer Throw', gender: 'F', category: 'Throws' },
  { code: 'MSP', name: 'Shot Put', gender: 'M', category: 'Throws' },
  { code: 'FSP', name: 'Shot Put', gender: 'F', category: 'Throws' },
]

export default function Onboarding({ onSkip }) {
  const { user, createProfile, createCoachProfile, createAthleteProfile } = useAuth()
  const [step, setStep] = useState(1) // 1: account type, 2: profile details
  const [accountType, setAccountType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Shared fields
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [clubSchool, setClubSchool] = useState('')

  // Coach fields
  const [organization, setOrganization] = useState('')
  const [eventsCoached, setEventsCoached] = useState([])

  // Athlete fields
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [primaryEvents, setPrimaryEvents] = useState([])
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [worldAthleticsUrl, setWorldAthleticsUrl] = useState('')
  const [scrapeProgress, setScrapeProgress] = useState('')

  // Consent
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [parentalConsent, setParentalConsent] = useState(false)

  // Age helper for minor detection
  const getAge = (dobStr) => {
    if (!dobStr) return null
    const dob = new Date(dobStr)
    if (isNaN(dob.getTime())) return null
    const diffMs = Date.now() - dob.getTime()
    return Math.floor(diffMs / (365.25 * 24 * 3600 * 1000))
  }
  const athleteAge = accountType === 'athlete' ? getAge(dateOfBirth) : null
  const isMinor = athleteAge !== null && athleteAge < 18
  const isUnder13 = athleteAge !== null && athleteAge < 13

  const filteredDisciplines = gender
    ? DISCIPLINE_OPTIONS.filter(d => d.gender === gender)
    : DISCIPLINE_OPTIONS

  const toggleEvent = (code, setter, current) => {
    setter(current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code]
    )
  }

  const handleComplete = async () => {
    setError(null)
    setLoading(true)

    try {
      // 1. Create base user_profiles record
      const { error: profileError } = await createProfile({
        account_type: accountType,
        full_name: fullName,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        club_school: clubSchool || null,
        country: country || null,
        city: city || null,
      })

      if (profileError) throw profileError

      // 2. Create type-specific profile
      if (accountType === 'coach') {
        const { error: coachError } = await createCoachProfile({
          organization: organization || null,
          events_coached: eventsCoached.length > 0 ? eventsCoached : null,
        })
        if (coachError) throw coachError
      } else {
        const { error: athleteError } = await createAthleteProfile({
          primary_events: primaryEvents,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          world_athletics_url: worldAthleticsUrl || null,
        })
        if (athleteError) throw athleteError

        // ── Optional: scrape World Athletics profile right now ──
        // We don't block onboarding completion if this fails; the athlete
        // can refresh from their dashboard later.
        if (worldAthleticsUrl && worldAthleticsUrl.includes('worldathletics.org')) {
          try {
            setScrapeProgress('Pulling your results from World Athletics — this can take up to a minute...')
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), 90000)
            const res = await fetch(`${API_BASE}/api/v1/analyze/url`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: worldAthleticsUrl }),
              signal: ctrl.signal,
            })
            clearTimeout(timer)
            if (res.ok) {
              const result = await res.json()
              if (result.success) {
                const scraped = result.data?._scraped || {}
                const races = scraped.races || []
                const isThrows = isThrowsDiscipline(scraped.discipline)
                let pbVal = null
                for (const r of races) {
                  if (r.value == null) continue
                  if (pbVal == null || (isThrows ? r.value > pbVal : r.value < pbVal)) pbVal = r.value
                }
                const sorted = races
                  .filter(r => r.date && r.value != null)
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                const last = sorted[0]

                // Patch the athlete_profiles row with the scraped data
                const url = import.meta.env.VITE_SUPABASE_URL
                const key = import.meta.env.VITE_SUPABASE_ANON_KEY
                const projectRef = url.replace('https://', '').split('.')[0]
                const tokenRaw = localStorage.getItem(`sb-${projectRef}-auth-token`)
                const token = tokenRaw ? JSON.parse(tokenRaw)?.access_token : null
                if (token) {
                  await fetch(`${url}/rest/v1/athlete_profiles?id=eq.${user.id}`, {
                    method: 'PATCH',
                    headers: {
                      'apikey': key,
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                      'Prefer': 'return=minimal',
                    },
                    body: JSON.stringify({
                      nationality: scraped.nationality || null,
                      discipline: scraped.discipline || null,
                      disciplines: scraped.supported_disciplines || null,
                      pb_value: pbVal,
                      pb_display: pbVal ? formatMark(pbVal, scraped.discipline) : null,
                      last_result_value: last?.value || null,
                      last_result_display: last?.value ? formatMark(last.value, scraped.discipline) : null,
                      last_result_date: last?.date || null,
                      races,
                      disciplines_data: scraped.disciplines_data || {},
                      analysis_data: result.data,
                      last_synced_at: new Date().toISOString(),
                    }),
                  })
                }
              }
            }
          } catch (scrapeErr) {
            // Non-fatal — log but don't block onboarding
            console.warn('[onboarding] WA scrape failed:', scrapeErr)
          } finally {
            setScrapeProgress('')
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to create profile')
      setLoading(false)
    }
  }

  // Step 1: Account Type Selection
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to bnchmrkd.</h1>
            <p className="text-gray-400">How will you be using the platform?</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Coach Card */}
            <button
              onClick={() => { setAccountType('coach'); setStep(2) }}
              className="bg-gray-900 border-2 border-gray-800 hover:border-emerald-500 rounded-2xl p-6 text-left transition-all group"
            >
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">I'm a Coach</h3>
              <p className="text-sm text-gray-400">
                Manage your roster, log results for athletes, assign workouts, and track trajectories across your squad.
              </p>
            </button>

            {/* Athlete Card */}
            <button
              onClick={() => { setAccountType('athlete'); setStep(2) }}
              className="bg-gray-900 border-2 border-gray-800 hover:border-emerald-500 rounded-2xl p-6 text-left transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500/30 transition-colors">
                <User className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">I'm an Athlete</h3>
              <p className="text-sm text-gray-400">
                Track your performance, log competitions and training, and see your trajectory compared to elite athletes.
              </p>
            </button>
          </div>

          {onSkip && (
            <button
              onClick={onSkip}
              className="mt-6 w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip for now — set up later
            </button>
          )}
        </div>
      </div>
    )
  }

  // Coach flow → full Strava-style onboarding
  if (accountType === 'coach') {
    return <CoachOnboarding onComplete={() => {}} />
  }

  // Step 2: Athlete Profile Details
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setStep(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">
              {accountType === 'coach' ? 'Set up your coach profile' : 'Set up your athlete profile'}
            </h2>
            <p className="text-gray-400 text-sm">This takes about a minute.</p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Full Name *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Gender *</label>
            <div className="flex gap-3">
              <button
                onClick={() => { setGender('M'); setPrimaryEvents([]); setEventsCoached([]) }}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  gender === 'M'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                }`}
              >
                Male
              </button>
              <button
                onClick={() => { setGender('F'); setPrimaryEvents([]); setEventsCoached([]) }}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  gender === 'F'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                }`}
              >
                Female
              </button>
            </div>
          </div>

          {/* Date of Birth (athlete only) */}
          {accountType === 'athlete' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date of Birth *</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          )}

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Club / School */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {accountType === 'coach' ? 'Organization / Club' : 'Club / School'}
            </label>
            <input
              type="text"
              value={accountType === 'coach' ? organization : clubSchool}
              onChange={(e) => accountType === 'coach' ? setOrganization(e.target.value) : setClubSchool(e.target.value)}
              placeholder={accountType === 'coach' ? 'Organisation name' : 'Club or school name'}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Events Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {accountType === 'coach' ? 'Events You Coach' : 'Your Primary Events *'}
            </label>
            {!gender ? (
              <p className="text-gray-500 text-sm">Select gender first to see events.</p>
            ) : (
              <div className="space-y-3">
                {['Sprints', 'Hurdles', 'Throws'].map(category => {
                  const events = filteredDisciplines.filter(d => d.category === category)
                  if (events.length === 0) return null
                  const selectedEvents = accountType === 'coach' ? eventsCoached : primaryEvents
                  const setEvents = accountType === 'coach' ? setEventsCoached : setPrimaryEvents
                  return (
                    <div key={category}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{category}</p>
                      <div className="flex flex-wrap gap-2">
                        {events.map(d => (
                          <button
                            key={d.code}
                            onClick={() => toggleEvent(d.code, setEvents, selectedEvents)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              selectedEvents.includes(d.code)
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                            }`}
                          >
                            {d.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Physical Metrics (athlete only) */}
          {accountType === 'athlete' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="175"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="70"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* World Athletics URL (athlete only — optional, populates dashboard) */}
          {accountType === 'athlete' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" />
                World Athletics Profile URL
                <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={worldAthleticsUrl}
                onChange={(e) => setWorldAthleticsUrl(e.target.value)}
                placeholder="https://worldathletics.org/athletes/..."
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                If you have a World Athletics profile, paste the URL here and we'll pull your full career
                trajectory automatically. You can also add this later from your dashboard.
              </p>
            </div>
          )}

          {/* Under-13 block */}
          {isUnder13 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm font-semibold">We cannot create accounts for users under 13.</p>
              <p className="text-red-400/80 text-xs mt-1">
                bnchmrkd. is not directed at children under 13. Please have a parent or coach create an account instead.
              </p>
            </div>
          )}

          {/* Minor (13–17) parental consent notice */}
          {isMinor && !isUnder13 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
              <p className="text-amber-400 text-sm font-semibold">You are under 18.</p>
              <p className="text-amber-400/90 text-xs">
                To use bnchmrkd., a parent or legal guardian must review and accept the Terms of Service and Privacy
                Policy on your behalf.
              </p>
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={parentalConsent}
                  onChange={(e) => setParentalConsent(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span className="text-[11px] text-amber-300 leading-relaxed">
                  I confirm that I am the parent or legal guardian of this athlete and I consent to their use of
                  bnchmrkd. on the terms described in the Privacy Policy and Terms of Service.
                </span>
              </label>
            </div>
          )}

          {/* Terms & Privacy consent (required for everyone) */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 accent-emerald-500"
            />
            <span className="text-[11px] text-gray-400 leading-relaxed">
              I have read and agree to the{' '}
              <a href="/?view=terms" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">Terms of Service</a>
              {' '}and{' '}
              <a href="/?view=privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">Privacy Policy</a>.
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleComplete}
            disabled={
              loading ||
              !fullName ||
              !gender ||
              (accountType === 'athlete' && primaryEvents.length === 0) ||
              !acceptedTerms ||
              isUnder13 ||
              (isMinor && !parentalConsent)
            }
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {scrapeProgress && <span className="text-xs text-white/80">{scrapeProgress}</span>}
              </>
            ) : (
              <>
                Complete Setup
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
