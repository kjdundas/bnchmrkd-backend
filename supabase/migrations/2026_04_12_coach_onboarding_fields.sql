-- Add coaching_level and squad_size to coach_profiles for onboarding flow
ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS coaching_level TEXT,
  ADD COLUMN IF NOT EXISTS squad_size TEXT,
  ADD COLUMN IF NOT EXISTS disciplines TEXT[];

-- coaching_level: 'grassroots', 'club', 'regional', 'elite', 'mix'
-- squad_size: '1-5', '6-15', '16-30', '30+'
-- disciplines: broad event groups e.g. {'Sprints', 'Throws', 'Jumps'}
