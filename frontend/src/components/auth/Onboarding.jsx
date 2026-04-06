import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { User, Users, ChevronRight, ChevronLeft, MapPin, Calendar, Ruler, Weight, Trophy } from 'lucide-react'

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
        })
        if (athleteError) throw athleteError
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

  // Step 2: Profile Details
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
                placeholder="e.g. UAE"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Dubai"
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
              placeholder={accountType === 'coach' ? 'e.g. Ultimate Athletics Dubai' : 'e.g. Dubai International Academy'}
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

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleComplete}
            disabled={loading || !fullName || !gender || (accountType === 'athlete' && primaryEvents.length === 0)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
