// Pure discipline/formatting helpers, lifted verbatim out of bnchmarkd-app.jsx
// so they can be shared with lazily-loaded chart components (keeps recharts out
// of the initial bundle). No component state — safe to import anywhere.

export const THROWS_DISCIPLINES = ['Discus Throw', 'Javelin Throw', 'Hammer Throw', 'Shot Put'];
export const THROWS_CODES = ['MDT', 'FDT', 'MJT', 'FJT', 'MHT', 'FHT', 'MSP', 'FSP'];
export const isThrowsDiscipline = (disc) => THROWS_DISCIPLINES.includes(disc) || THROWS_CODES.includes(disc);

// Jumps discipline detection helpers (treated as higher-is-better field events like throws)
export const JUMPS_DISCIPLINES = ['High Jump', 'Long Jump', 'Triple Jump', 'Pole Vault'];
export const JUMPS_CODES = ['MHJ', 'FHJ', 'MLJ', 'FLJ', 'MTJ', 'FTJ', 'MPV', 'FPV'];
export const isJumpsDiscipline = (disc) => JUMPS_DISCIPLINES.includes(disc) || JUMPS_CODES.includes(disc);

// Higher-is-better field event (throws + jumps)
export const isFieldEvent = (disc) => isThrowsDiscipline(disc) || isJumpsDiscipline(disc);

// Distance discipline detection helpers
export const DISTANCE_DISCIPLINES = ['800m', '1500m', '3000m Steeplechase', '5000m', '10000m', 'Marathon'];
export const DISTANCE_CODES = ['M800', 'F800', 'M1500', 'F1500', 'M3SC', 'F3SC', 'M5K', 'F5K', 'M10K', 'F10K', 'MMAR', 'FMAR'];
export const isDistanceDiscipline = (disc) => DISTANCE_DISCIPLINES.includes(disc) || DISTANCE_CODES.includes(disc);

// Hurdle discipline detection helpers
export const HURDLE_DISCIPLINES = ['110mH', '100mH', '400mH', '110m Hurdles', '100m Hurdles', '400m Hurdles'];
export const isHurdleDiscipline = (disc) => HURDLE_DISCIPLINES.includes(disc);

export const isMarathon = (disc) => disc === 'Marathon' || disc === 'MMAR' || disc === 'FMAR';
export const getUnitLabel = (disc) => isFieldEvent(disc) ? 'Distance (m)' : isMarathon(disc) ? 'Time (h:mm:ss)' : isDistanceDiscipline(disc) ? 'Time (mm:ss)' : 'Time (s)';

// Normalise shorthand discipline codes to full names used in improvementCurves.js
// e.g. '110mH' → '110m Hurdles', '100mH' → '100m Hurdles', '400mH' → '400m Hurdles'
export const normalizeDisciplineName = (disc) => {
  const map = { '110mH': '110m Hurdles', '100mH': '100m Hurdles', '400mH': '400m Hurdles' };
  return map[disc] || disc;
};

// Format seconds to h:mm:ss for marathon, mm:ss.ff for other distance events, or ss.ff for sprint/hurdle events
export const formatTime = (seconds, disc) => {
  if (seconds == null || isNaN(seconds)) return '—';
  if (isFieldEvent(disc)) return `${Number(seconds).toFixed(2)}m`;
  if (isMarathon(disc) || seconds >= 3600) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${String(mins).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
  }
  return seconds.toFixed(2);
};

// Parse user time input — accepts h:mm:ss.ff, mm:ss.ff, m:ss.ff, or raw seconds
// Examples: "2:09:52" → 7792, "8:06.05" → 486.05, "13:13.66" → 793.66, "26:43.14" → 1603.14, "10.85" → 10.85
export const parseTimeInput = (input) => {
  if (input == null) return NaN;
  const str = String(input).trim();
  if (!str) return NaN;
  // Check for time pattern (contains a colon)
  if (str.includes(':')) {
    const parts = str.split(':');
    if (parts.length === 3) {
      // h:mm:ss (marathon)
      const hrs = parseFloat(parts[0]);
      const mins = parseFloat(parts[1]);
      const secs = parseFloat(parts[2]);
      if (isNaN(hrs) || isNaN(mins) || isNaN(secs) || hrs < 0 || mins < 0 || mins >= 60 || secs < 0 || secs >= 60) return NaN;
      return hrs * 3600 + mins * 60 + secs;
    }
    if (parts.length !== 2) return NaN;
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) return NaN;
    return mins * 60 + secs;
  }
  // Otherwise treat as raw seconds (or metres for throws)
  return parseFloat(str);
};

// Implement weight specifications per WA age group rules
export const IMPLEMENT_WEIGHTS = {
  'Shot Put_M': [{min:0,max:13,kg:3,label:'3kg'},{min:14,max:15,kg:4,label:'4kg'},{min:16,max:17,kg:5,label:'5kg'},{min:18,max:19,kg:6,label:'6kg'},{min:20,max:99,kg:7.26,label:'7.26kg (Senior)'}],
  'Shot Put_F': [{min:0,max:13,kg:2,label:'2kg'},{min:14,max:17,kg:3,label:'3kg'},{min:18,max:99,kg:4,label:'4kg (Senior)'}],
  'Discus Throw_M': [{min:0,max:15,kg:1,label:'1kg'},{min:16,max:17,kg:1.5,label:'1.5kg'},{min:18,max:19,kg:1.75,label:'1.75kg'},{min:20,max:99,kg:2,label:'2kg (Senior)'}],
  'Discus Throw_F': [{min:0,max:17,kg:0.75,label:'0.75kg'},{min:18,max:99,kg:1,label:'1kg (Senior)'}],
  'Hammer Throw_M': [{min:0,max:13,kg:3,label:'3kg'},{min:14,max:15,kg:4,label:'4kg'},{min:16,max:17,kg:5,label:'5kg'},{min:18,max:19,kg:6,label:'6kg'},{min:20,max:99,kg:7.26,label:'7.26kg (Senior)'}],
  'Hammer Throw_F': [{min:0,max:13,kg:2,label:'2kg'},{min:14,max:17,kg:3,label:'3kg'},{min:18,max:99,kg:4,label:'4kg (Senior)'}],
  'Javelin Throw_M': [{min:0,max:15,kg:0.6,label:'600g'},{min:16,max:17,kg:0.7,label:'700g'},{min:18,max:99,kg:0.8,label:'800g (Senior)'}],
  'Javelin Throw_F': [{min:0,max:15,kg:0.4,label:'400g'},{min:16,max:17,kg:0.5,label:'500g'},{min:18,max:99,kg:0.6,label:'600g (Senior)'}],
};
export const getWeightOptions = (discipline, gender) => {
  const key = `${discipline}_${gender === 'Male' ? 'M' : 'F'}`;
  return IMPLEMENT_WEIGHTS[key] || [];
};
export const getDefaultWeight = (discipline, gender, age) => {
  const opts = getWeightOptions(discipline, gender);
  const ageNum = parseInt(age) || 20;
  const match = opts.find(o => ageNum >= o.min && ageNum <= o.max);
  return match ? match.kg : (opts.length ? opts[opts.length - 1].kg : null);
};
