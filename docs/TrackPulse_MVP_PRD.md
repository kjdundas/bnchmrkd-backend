# TrackPulse — MVP Product Requirements Document

**Version:** 2.0
**Date:** April 5, 2026
**Author:** Keenan Dundas
**Status:** Draft

---

## 1. Problem Statement

Track and field athletes at every level — from school-age beginners to post-collegiate competitors — have no dedicated platform that helps them understand where they are in their development and where they're headed. Existing tools like Athletic.net serve primarily as results databases tied to the US high school and college ecosystem, dependent on meet directors uploading data. Athletes outside the US (particularly in the UAE, Gulf, and broader international markets) have no equivalent at all.

Coaches face a parallel problem. They manage athlete data in spreadsheets, WhatsApp groups, and handwritten notes. There is no centralized tool where a coach can maintain a roster, log results and training for their athletes, assign workouts, and visualize each athlete's trajectory — let alone compare trajectories across a squad.

The cost of not solving this: athletes train blind, coaches miss early signals of talent or overtraining, and an entire generation of international athletes remains invisible to the global athletics community.

---

## 2. Product Vision

TrackPulse is the performance platform for track and field — a mobile app with two distinct experiences. Athletes log their own training and competition data, visualize their personal trajectory over time, and overlay it against historical elite progressions. Coaches manage rosters of athletes, log data on their behalf, assign workouts, and monitor their squad's development through trajectory dashboards. Every interaction feeds a dataset that powers increasingly accurate trajectory predictions.

**In one sentence:** The app that shows athletes and coaches not just where they've been, but where they're going.

---

## 3. Goals

1. **Build a daily-use habit among athletes.** Target: 40% of registered athletes log at least one entry per week within the first 3 months.

2. **Become the default performance tracker for UAE-based athletes and coaches.** Target: 500 active users (athletes + coaches) in the UAE within 6 months of launch.

3. **Collect enough athlete data to power meaningful trajectory predictions.** Target: 10,000 logged competition results within the first year.

4. **Demonstrate trajectory visualization as the core differentiator.** Target: 70% of users who view their first trajectory overlay return within 7 days.

5. **Prove coach adoption as a growth channel.** Target: each active coach brings an average of 15 athletes onto the platform (via roster creation).

---

## 4. Non-Goals (v1)

1. **Social features, discovery, and feed.** Deferred due to UAE privacy law considerations. No athlete-to-athlete following, no activity feed, no public profiles or social discovery. Will be designed and added in a future version once the legal framework is clear.

2. **Coach-athlete account linking.** Coaches manage standalone rosters. Athletes manage their own independent accounts. The two do not connect in v1. A future version will allow athletes to "claim" their profile from a coach's roster via invite code.

3. **Premium/paid tier.** Focus is on growth and engagement, not monetization. Freemium structure will be introduced in v2 once the user base and feature set justify it.

4. **Meet management or results upload by officials.** Unlike Athletic.net, we are not building infrastructure for meet directors.

5. **Wearable or device integrations.** No Garmin/Apple Watch/Strava sync in v1. Manual entry keeps the scope tight.

6. **Peer comparison analytics.** Requires a critical mass of users. The data model should support it, but the feature is deferred.

---

## 5. Target Users

### Primary: The Coach
Coaches managing groups of 5-60 athletes at school, club, or federation level. They need a centralized place to track their athletes' competition results, training, and physical development. They currently rely on spreadsheets, notebooks, and memory. They range from volunteer school coaches to professional club coaches.

### Primary: The Committed Athlete
Athletes aged 14-28 who train regularly and compete in track and field events (sprints, distance, jumps, throws, multi-events). They are serious about improvement, track their marks informally (notes, spreadsheets, memory), and are motivated by seeing progress over time.

### Secondary: The Aspiring Athlete
Younger or newer athletes (ages 12-16) who are discovering the sport. These athletes may initially be managed entirely by their coach's roster and may later create their own accounts.

### Geographic Focus
Launch market is the UAE (Dubai, Abu Dhabi, Sharjah) and Gulf region, expanding to South Asia, East Africa, and eventually global.

---

## 6. User Stories

### Account Type Selection

- As a new user, I want to choose whether I'm signing up as a coach or an athlete so that the app gives me the right experience from the start.
- As a user, I want to sign up with email or social login (Google, Apple) so that account creation is fast and familiar.

### Coach: Onboarding and Profile

- As a coach, I want to create my profile (name, club/school, location, events I coach) in under 2 minutes so that I can get started quickly.
- As a coach, I want to see a clean dashboard as my home screen so that I have an overview of my roster at a glance.

### Coach: Roster Management

- As a coach, I want to add an athlete to my roster by entering their basic info (name, date of birth, gender, events, height, weight) so that I can start tracking them immediately without them needing an account.
- As a coach, I want to view my full roster as a list with key stats visible (events, current PRs, last activity date) so that I can quickly assess my squad.
- As a coach, I want to tap on any athlete in my roster to see their full profile, competition history, training log, and trajectory so that I can drill into individual performance.
- As a coach, I want to edit or remove an athlete from my roster so that I can keep my roster current as athletes join and leave the squad.
- As a coach, I want to sort and filter my roster by event group, age, or recent activity so that I can focus on subsets of my athletes.

### Coach: Logging for Athletes

- As a coach, I want to log a competition result for any athlete on my roster (event, mark/time, date, competition name) so that I maintain complete records.
- As a coach, I want to log a training session for an athlete (date, session type, intensity, notes, optional mark) so that I track training alongside competition.
- As a coach, I want to bulk-log a competition result for multiple athletes at once (e.g., after a meet where 10 athletes competed) so that post-meet data entry is efficient.
- As a coach, I want to log physical metrics (height, weight) for an athlete so that I track their physical development over time.

### Coach: Workout Assignment

- As a coach, I want to assign a workout to one or more athletes (description, target marks/paces, session type) so that athletes know what to do in training.
- As a coach, I want to view which athletes have completed assigned workouts and how they rated the session so that I can monitor adherence.
- As a coach, I want to create workout templates that I can reuse and assign repeatedly so that I don't re-enter common sessions.

### Coach: Trajectory and Dashboard

- As a coach, I want to see each athlete's trajectory graph (performance over time) on their profile so that I can visualize their development.
- As a coach, I want to overlay an athlete's trajectory against historical elite progressions so that I can contextualize their development and set goals.
- As a coach, I want to see a dashboard that shows all my athletes' trajectories side-by-side or overlaid so that I can compare development across the squad.
- As a coach, I want to see highlights on my dashboard (new PRs this week, athletes on training streaks, athletes who haven't logged recently) so that I can act on the most important signals.

### Athlete: Onboarding and Profile

- As an athlete, I want to create my profile (name, date of birth, gender, events, club/school, location, height, weight) in under 2 minutes so that I can start using the app quickly.
- As an athlete, I want to select my primary events from a comprehensive list so that the app tailors my experience to my discipline.
- As an athlete, I want to enter my current personal records during signup so that I immediately see my trajectory position.

### Athlete: Competition Logging

- As an athlete, I want to log a competition result (event, mark/time, date, competition name) in under 30 seconds so that logging never feels like a chore.
- As an athlete, I want to see my competition history as a chronological list with filtering by event and season so that I have a clear record.
- As an athlete, I want the app to auto-detect and flag personal records so that PRs are highlighted without manual effort.
- As an athlete, I want to edit or delete a logged result in case I entered something incorrectly.

### Athlete: Training Logging

- As an athlete, I want to log a training session with minimal fields (date, session type, intensity 1-5, optional notes) so that daily logging takes under 15 seconds.
- As an athlete, I want to choose a session type from a list relevant to my events (speed work, endurance, strength, technical, recovery, rest day) so that my training patterns are captured.
- As an athlete, I want to optionally log a key training mark (e.g., time trial, practice throw) so that training performance is captured alongside competition.
- As an athlete, I want to see my training consistency visualized (streak counter, sessions per week, calendar view) so that I'm motivated to keep logging.

### Athlete: Physical Metrics

- As an athlete, I want to log my height and weight periodically so that I can track changes over time.
- As an athlete, I want to optionally log 2-3 sport-specific fitness markers so that I track physical development alongside performance.
- As an athlete, I want to see my physical metrics charted over time so that I can spot trends.

### Athlete: Trajectory Visualization

- As an athlete, I want to see my performance plotted as a trajectory graph (mark vs. time) so that I can visualize my progression.
- As an athlete, I want to overlay my trajectory against historical elite athlete progressions at the same age/career stage so that I have context for my development.
- As an athlete, I want to select which elite athletes to compare against so that the comparison feels relevant.
- As an athlete, I want both competition results and training marks on the trajectory so that I understand the full picture.
- As an athlete, I want the graph to update immediately when I log a new result so that I get instant feedback.

---

## 7. Requirements

### Must-Have (P0)

**7.1 Dual Account System**
- Account type selection at signup: "I'm a Coach" or "I'm an Athlete"
- Each type leads to a different onboarding flow and home screen
- Account creation via email or social login (Google, Apple)
- Acceptance criteria:
  - [ ] Account type selection appears as the first step after login method
  - [ ] Coach and athlete flows are completely separate experiences
  - [ ] Users cannot switch account type after creation (must create a new account)
  - [ ] Both account types support email, Google, and Apple sign-in

**7.2 Coach Profile and Onboarding**
- Profile fields: name, club/school/organization, location (country + city), events coached (multi-select), profile photo
- Onboarding completes in under 2 minutes
- Home screen is the roster dashboard
- Acceptance criteria:
  - [ ] Coach can complete profile setup in under 2 minutes
  - [ ] Dashboard is the default landing screen after onboarding
  - [ ] Profile can be edited after creation

**7.3 Roster Management**
- Coach creates athlete profiles within their account: name, date of birth, gender, events, height, weight, notes
- Roster list view with key info visible (events, current PRs, last activity)
- Tap athlete to view full profile detail
- Edit and remove athletes
- Sort/filter by event group, age, or recent activity
- No limit on roster size
- Acceptance criteria:
  - [ ] Adding an athlete takes under 60 seconds
  - [ ] Roster list loads within 1 second regardless of size
  - [ ] Filtering correctly narrows the list
  - [ ] Removing an athlete requires confirmation dialog
  - [ ] Athlete profiles are private to the coach (not visible to other users)

**7.4 Coach Logging (Competition, Training, Physical)**
- Log competition results for any rostered athlete: event, mark/time, date, competition name, location, place (optional)
- Log training sessions for any rostered athlete: date, session type, intensity, notes, optional mark
- Log physical metrics for any rostered athlete: height, weight, event-specific markers
- Bulk competition logging: select multiple athletes, enter the same competition details, then input individual marks
- Auto-detect PRs
- Acceptance criteria:
  - [ ] Logging a single competition result takes under 30 seconds
  - [ ] Bulk logging for 10 athletes at the same meet takes under 3 minutes
  - [ ] PRs are auto-detected and flagged across all logging methods
  - [ ] All logged data appears immediately in the athlete's profile

**7.5 Workout Assignment**
- Coach creates a workout: description/instructions, target marks or paces (optional), session type, assigned date
- Assign to one or multiple athletes
- Reusable workout templates: save, name, and re-assign
- Athletes on the roster have a "pending workouts" view
- Acceptance criteria:
  - [ ] Workout can be assigned to multiple athletes in one action
  - [ ] Templates can be saved and loaded
  - [ ] Assigned workouts appear in chronological order on the athlete's detail view
  - [ ] Coach can see assignment status (assigned, completed) per athlete

**7.6 Coach Dashboard**
- Overview screen showing: total roster count, recent activity summary, new PRs this period, athletes with training streaks, athletes with no recent activity (flagged)
- Trajectory comparison view: overlay multiple athletes' trajectories on one graph
- Filterable by event group
- Acceptance criteria:
  - [ ] Dashboard loads within 2 seconds
  - [ ] Trajectory comparison supports at least 5 athletes simultaneously
  - [ ] "No recent activity" flag triggers after 7 days of no logged data
  - [ ] Dashboard data is real-time (reflects latest logged entries)

**7.7 Athlete Profile and Onboarding**
- Profile fields: name, date of birth, gender, primary events (multi-select), club/school (optional), location (country + city), height, weight
- Event selection from comprehensive World Athletics event list
- Enter current PRs during onboarding
- Profile photo upload
- Acceptance criteria:
  - [ ] Signup-to-first-log flow completes in under 2 minutes
  - [ ] All standard track and field events are available
  - [ ] PR entry is optional but prompted during onboarding
  - [ ] Profile can be edited after creation

**7.8 Athlete Competition Logging**
- Log: event, mark/time, date, competition name (free text), location, place/position (optional)
- Auto-detect PR and flag it
- Edit and delete entries
- Chronological history with filtering by event and season
- Acceptance criteria:
  - [ ] Logging a result takes under 30 seconds
  - [ ] System correctly identifies new PRs
  - [ ] Results display in reverse chronological order
  - [ ] Filtering by event shows only results in that event

**7.9 Athlete Training Logging**
- Log: date, session type (event-relevant list), intensity (1-5), optional notes, optional key mark
- Session types contextual to the athlete's event group
- Calendar/streak view showing consistency
- Acceptance criteria:
  - [ ] Logging a session takes under 15 seconds
  - [ ] Session types adapt based on primary events
  - [ ] Streak counter accurately tracks consecutive training days/weeks
  - [ ] Calendar shows sessions with color-coded intensity

**7.10 Athlete Physical Metrics**
- Log height, weight, and up to 3 event-specific fitness markers
- Chart metrics over time
- Fitness markers change based on event group
- Acceptance criteria:
  - [ ] Metrics log in under 15 seconds
  - [ ] Charts render correctly with sparse data
  - [ ] Event-specific markers match the athlete's primary events

**7.11 Trajectory Visualization — Personal Trend (Both Account Types)**
- Line graph: performance marks over time per event
- X-axis: date (or age). Y-axis: performance mark
- Competition results and training marks visually distinguished
- Real-time updates when new data is logged
- Available to both coaches (per rostered athlete) and athletes (own data)
- Acceptance criteria:
  - [ ] Graph renders correctly for all event types (time-based and distance/height-based)
  - [ ] Competition and training marks are visually distinct
  - [ ] Interactive: tap a point to see details
  - [ ] Handles sparse data gracefully

**7.12 Trajectory Visualization — Elite Overlay (Both Account Types)**
- Overlay historical elite trajectories from scraped Olympic/World Athletics dataset
- Select elite trajectories by name or browse by event
- Age-aligned comparison
- Toggle overlays on/off
- Acceptance criteria:
  - [ ] Historical data available for all events in the scraping pipeline
  - [ ] Age-alignment correctly maps current athlete to elite's career at same age
  - [ ] At least 3 elite trajectories can be overlaid simultaneously
  - [ ] Clear legend distinguishes athlete data from elite overlays

### Nice-to-Have (P1)

**7.13 Push Notifications**
- Training reminder notifications (configurable frequency)
- Coach notifications when an athlete hits a PR
- Weekly summary ("You logged 4 sessions this week, your trajectory moved X")

**7.14 Achievements and Badges**
- Auto-earned from data: "First Competition Logged," "10-Session Streak," "New PR," "Century Club (100 sessions)"
- Displayed on athlete profile
- Motivational milestone celebrations

**7.15 Data Export**
- Export competition and training history as CSV
- Export trajectory graph as shareable image
- Coach can export roster data and athlete reports

### Future Considerations (P2)

**7.16 Coach-Athlete Account Linking**
- Athlete creates their own account and "claims" their profile from a coach's roster via invite code
- Linked accounts share data bidirectionally: athlete sees what coach logged, coach sees what athlete self-logged
- Athletes can unlink at any time and retain all their data

**7.17 Social Features**
- Athlete-to-athlete discovery, following, activity feed
- Public/private profile controls
- Will require thorough UAE privacy law review before implementation

**7.18 Predictive Trajectory Modeling**
- Project future performance using aggregate user data + historical elite data
- Requires critical mass of user data

**7.19 Premium Tier (Freemium Model)**
- Free: full logging, personal trajectory, basic elite overlays
- Premium: advanced analytics, unlimited comparisons, exportable recruiting reports

**7.20 Wearable Integration**
- Sync with Garmin, Apple Watch, Strava

---

## 8. Technical Considerations

### Platform
- **React Native + Expo** for iOS and Android from a single codebase
- Leverages existing React/Next.js knowledge
- Expo Go for development testing without App Store submission
- TestFlight (iOS) and internal testing track (Android) for beta distribution

### Backend
- API-first architecture (REST or GraphQL) to support future web dashboard
- PostgreSQL for structured athlete and performance data
- Historical elite dataset served as a read-only reference layer
- Authentication via Firebase Auth or Supabase Auth (email + Google + Apple sign-in)
- Cloud hosting: Supabase (includes auth + database + storage) or AWS/GCP

### Data Model (Core Entities)

```
User
├── id, email, auth_provider, account_type (coach | athlete), created_at

CoachProfile
├── user_id (FK → User), name, club_school, location, events_coached, photo_url

AthleteProfile
├── user_id (FK → User, nullable for coach-managed), name, dob, gender
├── events[], club_school, location, height, weight, photo_url

RosterEntry
├── coach_id (FK → CoachProfile), athlete_profile_id (FK → AthleteProfile)
├── added_at, notes

CompetitionResult
├── athlete_profile_id (FK), event, mark, date, competition_name
├── location, place, is_pr, logged_by (coach_id or athlete user_id)

TrainingSession
├── athlete_profile_id (FK), date, session_type, intensity (1-5)
├── notes, mark (optional), logged_by

PhysicalMetric
├── athlete_profile_id (FK), date, metric_type, value

WorkoutTemplate
├── coach_id (FK), name, description, session_type, target_marks

WorkoutAssignment
├── template_id (FK), athlete_profile_id (FK), assigned_date
├── status (assigned | completed), completion_date

EliteTrajectory (read-only reference)
├── athlete_name, event, mark, date, age_at_mark, competition
```

### Key Design Principles
- **Data entry must be frictionless.** Every input screen should target under 30 seconds.
- **Instant feedback.** Every logged entry immediately reflects in trajectory graphs.
- **Privacy by default.** All data is private to the account that created it. No cross-account visibility in v1.
- **Offline-capable.** Athletes and coaches should be able to log sessions without connectivity; data syncs when back online.
- **Coach-managed athletes are standalone.** They exist only within the coach's account until account linking is built in v2.

---

## 9. Success Metrics

### Leading Indicators (1-4 weeks post-launch)
| Metric | Target | Stretch | Measurement |
|---|---|---|---|
| Signup completion rate | 70% of started signups complete profile | 85% | Funnel analytics |
| Day 1 retention | 50% of signups log at least one entry on day 1 | 65% | Event tracking |
| Weekly active loggers | 40% of registered users log 1+ entry/week | 55% | Weekly cohort query |
| Coach roster size | Average 10 athletes per coach | 20 athletes | Database query |
| Time to first trajectory view | 80% view trajectory within first session | 90% | Event tracking |

### Lagging Indicators (1-6 months post-launch)
| Metric | Target | Stretch | Measurement |
|---|---|---|---|
| Monthly active users (UAE) | 500 within 6 months | 1,000 | MAU dashboard |
| Logged competition results | 10,000 within 12 months | 25,000 | Database count |
| 30-day retention | 35% of signups active at day 30 | 50% | Cohort analysis |
| Active coaches | 30 coaches within 6 months | 60 coaches | User count |
| Total registered users | 2,000 within 12 months | 5,000 | User count |

---

## 10. Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| Which elite athlete trajectories do we have complete age-aligned data for? Need to audit the scraped dataset for coverage gaps. | Keenan (Data) | Yes — determines which events have full elite overlay on launch |
| How do we handle events where marks are wind-assisted or altitude-adjusted? Do we normalize, flag, or ignore? | Engineering | No — can launch with raw marks and add normalization later |
| UAE data protection law (PDPL) requirements for storing athlete data, particularly for minors under 18. Do we need parental consent flows? | Legal | Yes — must resolve before launch |
| Should the app support Arabic language and RTL layout at launch, or is English-only acceptable for UAE market? | Product/Design | Semi-blocking — English widely used in UAE athletics, but Arabic signals local commitment |
| Data pipeline architecture from scraping project into the mobile app's backend. | Engineering | Yes — core feature depends on it |
| When coach creates athlete profiles, what is the minimum required data vs. optional? Should DOB be mandatory (trajectory alignment) or optional (privacy)? | Product | Yes — affects onboarding UX |

---

## 11. Timeline Considerations

### Phase 1: Foundation (Weeks 1-6)
- Set up React Native/Expo project
- Build dual authentication system (coach vs. athlete account type)
- Build coach onboarding and roster management
- Build athlete onboarding and profile
- Design and implement the database schema
- Integrate historical elite data into backend

### Phase 2: Logging (Weeks 7-10)
- Competition result logging (coach and athlete flows)
- Training session logging (coach and athlete flows)
- Bulk logging for coaches
- Physical metrics logging
- PR auto-detection

### Phase 3: Trajectory and Visualization (Weeks 11-14)
- Personal trajectory graph (both account types)
- Elite overlay comparison
- Coach dashboard with multi-athlete trajectory comparison
- Connect logging to real-time graph updates

### Phase 4: Coach Tools (Weeks 15-17)
- Workout assignment and templates
- Workout completion tracking
- Dashboard highlights (PRs, streaks, inactivity flags)

### Phase 5: Polish and Beta (Weeks 18-21)
- Push notifications
- Achievements/badges
- Performance optimization and offline support
- Beta testing via Expo Go and TestFlight
- Bug fixes and UX iteration from beta feedback

### Phase 6: Launch (Week 22+)
- App Store and Google Play submission
- UAE-focused launch campaign (clubs, schools, federations)
- Monitor success metrics and iterate

---

## 12. Competitive Positioning

| Feature | Athletic.net | TrackPulse |
|---|---|---|
| Athlete-entered data | No (meet directors upload) | Yes (athletes own their data) |
| Coach roster management | Basic (tied to meet system) | Full standalone roster with logging and dashboard |
| Trajectory visualization | No | Core feature for both coaches and athletes |
| Elite career comparison | No | Yes (historical Olympic/World Athletics data) |
| Workout assignment | No | Yes (with reusable templates) |
| Coach dashboard | No | Multi-athlete trajectory comparison and highlights |
| Bulk competition logging | No | Yes (post-meet batch entry) |
| International coverage | Minimal (US-centric) | UAE-first, designed for global |
| Training log | Mileage-only (distance runners) | All event groups, session types, intensity |
| Physical metrics | No | Height, weight, event-specific fitness markers |
| Field events support | Results only | Full logging, trajectory, and training |
| Mobile app | Yes (AthleticAPP) | Native mobile-first (React Native/Expo) |
| Cost | Free + $8-10/mo premium | Free at launch |

---

*This document is a living spec. Update as decisions are made on open questions and as beta feedback reshapes priorities.*
