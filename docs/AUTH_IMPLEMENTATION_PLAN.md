# BnchMrkd — Auth & User Accounts Implementation Plan

**Date:** April 5, 2026
**Scope:** Add user authentication, dual account types (coach/athlete), and data logging to the existing BnchMrkd platform.

---

## Current State

| Layer | Stack | Location |
|-------|-------|----------|
| Frontend | Vite + React (single JSX app) | `bnchmarkd-app/frontend/src/` |
| Backend | FastAPI + psycopg2 | `bnchmarkd-app/backend/app/` |
| Database | Supabase PostgreSQL | `database/schema.sql` |
| Hosting | Railway (backend), TBD (frontend) | `railway.toml` |
| API Base | `https://web-production-295f1.up.railway.app` | hardcoded in frontend |

The app currently has no authentication. All tools (analysis, explorer, trajectory) are publicly accessible. Elite/historical data (496K+ race results, 2,322 athletes) lives in Supabase PostgreSQL and is served via FastAPI.

---

## What We're Adding

1. **Supabase Auth** — email + Google + Apple sign-in
2. **Dual account types** — Coach and Athlete, with different onboarding and home screens
3. **Coach roster management** — coaches create and manage athlete profiles
4. **Competition & training logging** — both coaches (for roster) and athletes (for themselves)
5. **Physical metrics tracking**
6. **Workout assignment** (coach → roster athletes)
7. **Protected routes** — main tools sit behind login, landing page is public

---

## Architecture Decision: Supabase Client vs FastAPI

You have two options for how the frontend talks to auth and user data:

### Option A: Supabase JS Client Direct (Recommended)
The frontend uses `@supabase/supabase-js` to talk directly to Supabase for:
- Auth (signup, login, session management)
- User data CRUD (profiles, results, sessions — via Supabase's auto-generated REST API)
- Row Level Security (RLS) handles permissions automatically

FastAPI continues to serve the analysis/scraping/elite-data endpoints only.

**Why this is better:** Supabase's JS client handles auth tokens, session refresh, and RLS automatically. You don't need to build auth middleware in FastAPI. Less code, fewer bugs.

### Option B: Everything Through FastAPI
All requests go through FastAPI, which validates the Supabase JWT token and queries the database.

**Why this is worse for you:** You'd need to build JWT validation middleware, auth decorators on every endpoint, and manually handle token refresh. More code for the same result.

**Recommendation: Option A.** Use Supabase JS directly for auth and user data. Keep FastAPI for the analysis engine and elite data queries. This gives you the fastest path to a working auth system.

---

## Implementation Steps

### Step 1: Supabase Auth Setup (30 min)

**In Supabase Dashboard:**
1. Go to Authentication → Providers
2. Enable Email (already available by default)
3. Enable Google OAuth (create OAuth credentials in Google Cloud Console)
4. Enable Apple Sign-In (requires Apple Developer account — can defer to later)
5. Go to Authentication → URL Configuration
6. Set Site URL to your frontend domain
7. Add redirect URLs for local dev (`http://localhost:5173`)

**No code changes yet — just configuration.**

### Step 2: Run Database Migration (15 min)

Run `database/002_user_auth_schema.sql` in the Supabase SQL Editor. This creates:
- `user_profiles` — base table linked to `auth.users`
- `coach_profiles` — coach-specific fields
- `athlete_profiles` — athlete-specific fields
- `roster_athletes` — coach-managed athlete profiles
- `user_competition_results` — logged competition results
- `user_training_sessions` — logged training sessions
- `user_physical_metrics` — physical metric entries
- `workout_templates` — reusable coach workout templates
- `workout_assignments` — assigned workouts
- `user_personal_bests` — materialized view, auto-calculated
- RLS policies for all tables
- PR auto-detection trigger
- Updated_at auto-update triggers

### Step 3: Install Supabase JS Client (5 min)

```bash
cd bnchmarkd-app/frontend
npm install @supabase/supabase-js
```

Create `src/lib/supabase.js`:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Add to `.env` (and `.env.example`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 4: Build Auth Context (1 hr)

Create `src/contexts/AuthContext.jsx`:
```javascript
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user.id)
        else setProfile(null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  const value = {
    user,
    profile,
    loading,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signInWithGoogle: () => supabase.auth.signInWithOAuth({ provider: 'google' }),
    signOut: () => supabase.auth.signOut(),
    refreshProfile: () => user && fetchProfile(user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
```

### Step 5: Build Login/Signup Page (2-3 hrs)

Create `src/components/AuthPage.jsx` with:
- Email + password fields
- Google sign-in button
- Toggle between Login and Sign Up modes
- On first signup → redirect to onboarding

### Step 6: Build Onboarding Flow (3-4 hrs)

Create `src/components/Onboarding.jsx`:

**Screen 1: Account Type Selection**
- "I'm a Coach" / "I'm an Athlete" — two large cards
- Writes `account_type` to `user_profiles`

**Screen 2 (Coach): Coach Profile**
- Name, organization/club, location, events coached
- Writes to `coach_profiles`
- → Redirects to Coach Dashboard

**Screen 2 (Athlete): Athlete Profile**
- Name, DOB, gender, primary events, height, weight
- Optional: enter current PRs
- Writes to `athlete_profiles`
- → Redirects to Athlete Dashboard

### Step 7: Restructure Frontend Routes (2-3 hrs)

Currently the app is a single `BnchMrkdApp` component with `currentView` state. You need to wrap this with auth-aware routing:

```
App.jsx
├── AuthProvider
│   ├── If not logged in:
│   │   ├── Landing page (public — your current landing view)
│   │   └── Login/Signup page
│   │
│   ├── If logged in but no profile:
│   │   └── Onboarding flow
│   │
│   ├── If logged in as ATHLETE:
│   │   ├── Athlete Dashboard (home)
│   │   ├── Competition Log
│   │   ├── Training Log
│   │   ├── Trajectory View (your existing visualization)
│   │   ├── Physical Metrics
│   │   └── Profile/Settings
│   │
│   └── If logged in as COACH:
│       ├── Coach Dashboard (roster overview)
│       ├── Roster Management
│       ├── Athlete Detail (tap from roster → full profile + trajectory)
│       ├── Log Result (for rostered athlete)
│       ├── Workout Templates
│       └── Profile/Settings
```

**Key decision:** Your existing analysis tools (manual entry, URL scrape, quick analysis, athlete explorer) should remain accessible to logged-in users. They become features within the authenticated app, not replaced by the new logging system.

### Step 8: Build Athlete Logging Screens (4-5 hrs)

**Competition Result Form:**
- Event (dropdown from their primary_events)
- Mark/time (smart input — auto-formats based on event type)
- Date
- Competition name
- Location (optional)
- Place (optional)
- Wind (optional, shown only for wind-applicable events)
- Submit → writes to `user_competition_results` via Supabase JS
- PR auto-detection happens in the database trigger

**Training Session Form:**
- Date (default: today)
- Session type (dropdown, contextual to their events)
- Intensity (1-5 slider or tap)
- Notes (optional text)
- Training mark (optional)
- Submit → writes to `user_training_sessions`

**Physical Metrics Form:**
- Height, weight
- Event-specific markers (based on their primary events)
- Submit → writes to `user_physical_metrics`

### Step 9: Build Coach Screens (5-6 hrs)

**Roster View:**
- List of all `roster_athletes` for this coach
- Each row: name, events, current PRs, last activity
- "Add Athlete" button → form to create a new `roster_athletes` entry
- Tap athlete → detail view

**Athlete Detail View (within coach):**
- Full profile info
- Competition history (from `user_competition_results` where `roster_athlete_id` matches)
- Training log
- Trajectory graph (reuse your existing chart component!)
- Elite overlay (reuse existing code!)
- "Log Result" / "Log Session" buttons

**Bulk Log Screen:**
- Select competition (name, date, location)
- List of roster athletes with checkboxes
- Enter marks for each selected athlete
- Submit all at once

**Workout Templates:**
- Create/edit templates (name, description, session type, target marks)
- Assign template to one or more roster athletes
- View assignment status

### Step 10: Connect Trajectory to User Data (2-3 hrs)

Your trajectory visualization already works with the elite data. You need to:
1. Add a new data source: query `user_competition_results` for the logged-in athlete (or a rostered athlete)
2. Transform the data into the same format your chart expects (season_year, age_years, best_time)
3. Plot user data as the primary line, elite data as the overlay

This is mostly about mapping the new table structure to your existing chart data format.

---

## File Structure After Implementation

```
bnchmarkd-app/frontend/src/
├── main.jsx                          (wrap App with AuthProvider)
├── App.jsx                           (auth-aware routing)
├── lib/
│   └── supabase.js                   (Supabase client init)
├── contexts/
│   └── AuthContext.jsx               (auth state management)
├── components/
│   ├── AuthPage.jsx                  (login/signup)
│   ├── Onboarding.jsx                (account type + profile setup)
│   ├── athlete/
│   │   ├── AthleteDashboard.jsx      (home screen)
│   │   ├── CompetitionLog.jsx        (log + history)
│   │   ├── TrainingLog.jsx           (log + calendar)
│   │   ├── PhysicalMetrics.jsx       (log + charts)
│   │   └── TrajectoryView.jsx        (personal + elite overlay)
│   ├── coach/
│   │   ├── CoachDashboard.jsx        (roster overview)
│   │   ├── RosterManagement.jsx      (add/edit/remove athletes)
│   │   ├── AthleteDetail.jsx         (full athlete view)
│   │   ├── BulkLog.jsx              (post-meet batch entry)
│   │   ├── WorkoutTemplates.jsx      (create/manage)
│   │   └── WorkoutAssignments.jsx    (assign/track)
│   └── shared/
│       ├── TrajectoryChart.jsx       (extracted from bnchmarkd-app.jsx)
│       ├── ResultForm.jsx            (reusable competition result form)
│       └── SessionForm.jsx           (reusable training session form)
└── bnchmarkd-app.jsx                 (existing app — analysis tools)
```

---

## Estimated Timeline

| Step | What | Effort |
|------|------|--------|
| 1 | Supabase Auth config | 30 min |
| 2 | Run schema migration | 15 min |
| 3 | Install Supabase JS | 5 min |
| 4 | Auth context | 1 hr |
| 5 | Login/signup page | 2-3 hrs |
| 6 | Onboarding flow | 3-4 hrs |
| 7 | Restructure routes | 2-3 hrs |
| 8 | Athlete logging screens | 4-5 hrs |
| 9 | Coach screens | 5-6 hrs |
| 10 | Connect trajectory to user data | 2-3 hrs |
| **Total** | | **~20-25 hrs** |

---

## Environment Variables Needed

### Frontend (.env)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE=https://web-production-295f1.up.railway.app
```

### Backend (.env) — existing, no changes needed
```
DATABASE_URL=postgresql://...
```

---

## Key Decisions Made

1. **Supabase JS direct for auth + user data.** FastAPI stays for analysis engine only.
2. **Coach-managed athletes are separate entities.** They exist in `roster_athletes`, not `athlete_profiles`. Future linking via `linked_user_id`.
3. **PR auto-detection in database trigger.** No application logic needed — the DB handles it on every insert.
4. **RLS policies enforce data isolation.** Users can only see/edit their own data. No application-level permission checks needed.
5. **Existing analysis tools remain.** They become features within the authenticated app, accessible to both account types.
6. **Materialized view for user PRs.** Auto-calculated, refresh after inserts. No manual PR tracking needed.
