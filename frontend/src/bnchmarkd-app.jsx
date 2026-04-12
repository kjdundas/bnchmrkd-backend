import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, ReferenceDot,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
  Activity, Timer, TrendingUp, Target, Award, ChevronRight, Plus, Trash2,
  Link, Upload, BarChart3, Zap, Calendar, ArrowUpRight, AlertTriangle, Users,
  Percent, Layers, BarChart2, CheckCircle2, Circle, Flag, Database, Info, ArrowRight, ChevronLeft,
  Search, User, Globe, Medal, Lock
} from 'lucide-react';
import { analytics } from './lib/analytics';
import PrivacyPolicy from './components/legal/PrivacyPolicy';
import TermsOfService from './components/legal/TermsOfService';

// ── Data stats constants (update when dataset changes) ──
const STATS = { athletes: '5,100+', records: '628K+', events: '26', games: 'Sydney 2000 – Paris 2024' };

export default function BnchMrkdApp({ user, profile, onSignUp, onSignOut, onSetupProfile, onOpenDashboard, incomingAthlete, onIncomingAthleteConsumed }) {
  // Throws discipline detection helpers
  const THROWS_DISCIPLINES = ['Discus Throw', 'Javelin Throw', 'Hammer Throw', 'Shot Put'];
  const THROWS_CODES = ['MDT', 'FDT', 'MJT', 'FJT', 'MHT', 'FHT', 'MSP', 'FSP'];
  const isThrowsDiscipline = (disc) => THROWS_DISCIPLINES.includes(disc) || THROWS_CODES.includes(disc);

  // Distance discipline detection helpers
  const DISTANCE_DISCIPLINES = ['3000m Steeplechase', '5000m', '10000m'];
  const DISTANCE_CODES = ['M3SC', 'F3SC', 'M5K', 'F5K', 'M10K', 'F10K'];
  const isDistanceDiscipline = (disc) => DISTANCE_DISCIPLINES.includes(disc) || DISTANCE_CODES.includes(disc);

  const getUnitLabel = (disc) => isThrowsDiscipline(disc) ? 'Distance (m)' : isDistanceDiscipline(disc) ? 'Time (mm:ss)' : 'Time (s)';

  // Format seconds to mm:ss.ff for distance events, or ss.ff for sprint/hurdle events
  const formatTime = (seconds, disc) => {
    if (seconds == null || isNaN(seconds)) return '—';
    if (isThrowsDiscipline(disc)) return `${Number(seconds).toFixed(2)}m`;
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
    }
    return seconds.toFixed(2);
  };

  // Parse user time input — accepts mm:ss.ff, m:ss.ff, or raw seconds
  // Examples: "8:06.05" → 486.05, "13:13.66" → 793.66, "26:43.14" → 1603.14, "10.85" → 10.85
  const parseTimeInput = (input) => {
    if (input == null) return NaN;
    const str = String(input).trim();
    if (!str) return NaN;
    // Check for mm:ss or m:ss pattern (contains a colon)
    if (str.includes(':')) {
      const parts = str.split(':');
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
  const IMPLEMENT_WEIGHTS = {
    'Shot Put_M': [{min:0,max:13,kg:3,label:'3kg'},{min:14,max:15,kg:4,label:'4kg'},{min:16,max:17,kg:5,label:'5kg'},{min:18,max:19,kg:6,label:'6kg'},{min:20,max:99,kg:7.26,label:'7.26kg (Senior)'}],
    'Shot Put_F': [{min:0,max:13,kg:2,label:'2kg'},{min:14,max:17,kg:3,label:'3kg'},{min:18,max:99,kg:4,label:'4kg (Senior)'}],
    'Discus Throw_M': [{min:0,max:15,kg:1,label:'1kg'},{min:16,max:17,kg:1.5,label:'1.5kg'},{min:18,max:19,kg:1.75,label:'1.75kg'},{min:20,max:99,kg:2,label:'2kg (Senior)'}],
    'Discus Throw_F': [{min:0,max:17,kg:0.75,label:'0.75kg'},{min:18,max:99,kg:1,label:'1kg (Senior)'}],
    'Hammer Throw_M': [{min:0,max:13,kg:3,label:'3kg'},{min:14,max:15,kg:4,label:'4kg'},{min:16,max:17,kg:5,label:'5kg'},{min:18,max:19,kg:6,label:'6kg'},{min:20,max:99,kg:7.26,label:'7.26kg (Senior)'}],
    'Hammer Throw_F': [{min:0,max:13,kg:2,label:'2kg'},{min:14,max:17,kg:3,label:'3kg'},{min:18,max:99,kg:4,label:'4kg (Senior)'}],
    'Javelin Throw_M': [{min:0,max:15,kg:0.6,label:'600g'},{min:16,max:17,kg:0.7,label:'700g'},{min:18,max:99,kg:0.8,label:'800g (Senior)'}],
    'Javelin Throw_F': [{min:0,max:15,kg:0.4,label:'400g'},{min:16,max:17,kg:0.5,label:'500g'},{min:18,max:99,kg:0.6,label:'600g (Senior)'}],
  };
  const getWeightOptions = (discipline, gender) => {
    const key = `${discipline}_${gender === 'Male' ? 'M' : 'F'}`;
    return IMPLEMENT_WEIGHTS[key] || [];
  };
  const getDefaultWeight = (discipline, gender, age) => {
    const opts = getWeightOptions(discipline, gender);
    const ageNum = parseInt(age) || 20;
    const match = opts.find(o => ageNum >= o.min && ageNum <= o.max);
    return match ? match.kg : (opts.length ? opts[opts.length - 1].kg : null);
  };

  const [currentView, setCurrentView] = useState(() => {
    // Deep-link support: ?view=privacy or ?view=terms
    if (typeof window !== 'undefined') {
      const v = new URLSearchParams(window.location.search).get('view');
      if (v === 'privacy' || v === 'terms' || v === 'about') return v;
    }
    return 'landing';
  });
  const [activeTab, setActiveTab] = useState('manual');
  const [disciplineCategory, setDisciplineCategory] = useState('sprints'); // 'sprints' | 'throws' | 'distance'
  const isThrowsMode = disciplineCategory === 'throws';
  const isDistanceMode = disciplineCategory === 'distance';
  const [athleteData, setAthleteData] = useState({
    name: '',
    dateOfBirth: '',
    discipline: '100m',
    gender: 'Male',
    implementWeight: '',  // kg, for throws only
    races: [
      { date: '', time: '', wind: '', competition: '' },
      { date: '', time: '', wind: '', competition: '' },
      { date: '', time: '', wind: '', competition: '' }
    ]
  });
  const [quickAnalysisData, setQuickAnalysisData] = useState({
    discipline: '100m',
    gender: 'Male',
    age: '',
    personalBest: '',
    implementWeight: ''  // kg, for throws only
  });
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);

  // Scraping state
  const [scraping, setScraping] = useState(false);
  const [chartView, setChartView] = useState('time'); // 'time' | 'pctOff' | 'percentileBand' | 'improvementRate'
  const [benchmarkLines, setBenchmarkLines] = useState({ medalist: true, finalist: true, semiFinalist: true, qualifier: true });
  const [trajToggles, setTrajToggles] = useState({ finalist: true, semiFinalist: true, qualifier: false });
  const [dashTab, setDashTab] = useState('overview'); // 'overview' | 'trajectory' | 'benchmarks' | 'insights'
  const [scrapeProgress, setScrapeProgress] = useState({ step: '', message: '', progress: 0 });
  const [multiResults, setMultiResults] = useState(null); // { "100m": analysisResult, "200m": ... }
  const [activeDiscipline, setActiveDiscipline] = useState(null);
  const eventSourceRef = useRef(null);

  // Athlete Explorer state
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerResults, setExplorerResults] = useState([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteProfile, setAthleteProfile] = useState(null);
  const [athleteTrajectory, setAthleteTrajectory] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [explorerDisciplineFilter, setExplorerDisciplineFilter] = useState('all');
  const searchTimeoutRef = useRef(null);

  // Landing page role toggle + active pillar
  const [landingRole, setLandingRole] = useState('athlete');
  const [activePillar, setActivePillar] = useState(0);

  // ── HERO TRAJECTORY SHOWCASE — auto-cycling athlete profiles ──
  const SHOWCASE_ATHLETES = useMemo(() => [
    {
      label: "Men's 100m — Late Developer",
      discipline: '100m', gender: 'M',
      pb: '10.02s', peakAge: '27', trajectory: 'Late Developer', percentile: 92,
      ages: ['18','20','22','24','26','28','30'],
      // y-values: lower = better (inverted for time events)
      points: [[60,158],[112,140],[164,118],[216,88],[268,68],[320,64],[372,72]],
      path: 'M60,158 C88,148 112,136 164,118 S216,88 268,68 S340,62 372,72',
      corridor: 'M60,148 L112,140 L164,130 L216,120 L268,114 L320,118 L372,128',
      projPath: 'M372,72 C390,76 408,82 420,88',
      peakPt: [320,64], peakLabel: 'PEAK 10.02s',
      mqtY: 92,
      bars: [35, 52, 68, 78, 92, 88, 85],
      tags: ['100m','200m','60m'],
      tagLabel: 'Sprint events',
      color: '#f97316',
    },
    {
      label: "Women's 800m — Standard Progression",
      discipline: '800m', gender: 'F',
      pb: '1:58.4', peakAge: '25', trajectory: 'Standard', percentile: 85,
      ages: ['17','19','21','23','25','27','29'],
      points: [[60,162],[112,138],[164,108],[216,82],[268,72],[320,78],[372,90]],
      path: 'M60,162 C88,150 112,132 164,108 S216,82 268,72 S340,76 372,90',
      corridor: 'M60,152 L112,142 L164,130 L216,118 L268,112 L320,116 L372,126',
      projPath: 'M372,90 C390,95 408,100 420,106',
      peakPt: [268,72], peakLabel: 'PEAK 1:58.4',
      mqtY: 88,
      bars: [28, 45, 62, 75, 85, 80, 72],
      tags: ['800m','1500m','400m'],
      tagLabel: 'Middle distance',
      color: '#8b5cf6',
    },
    {
      label: "Men's Discus — Early Peaker",
      discipline: 'DT', gender: 'M',
      pb: '67.2m', peakAge: '23', trajectory: 'Early Peaker', percentile: 78,
      ages: ['18','20','22','24','26','28','30'],
      // for throws, higher = better but we keep same SVG convention (lower y = better)
      points: [[60,150],[112,110],[164,78],[216,68],[268,80],[320,95],[372,112]],
      path: 'M60,150 C88,132 112,108 164,78 S216,68 268,80 S340,92 372,112',
      corridor: 'M60,145 L112,135 L164,122 L216,112 L268,108 L320,114 L372,124',
      projPath: 'M372,112 C390,118 408,124 420,130',
      peakPt: [216,68], peakLabel: 'PEAK 67.2m',
      mqtY: 85,
      bars: [40, 58, 72, 78, 70, 62, 55],
      tags: ['DT','SP','HT'],
      tagLabel: 'Throws events',
      color: '#06b6d4',
    },
    {
      label: "Women's 100mH — Breakthrough",
      discipline: '100mH', gender: 'F',
      pb: '12.68s', peakAge: '26', trajectory: 'Late Developer', percentile: 88,
      ages: ['18','20','22','24','26','28','30'],
      points: [[60,165],[112,148],[164,125],[216,98],[268,72],[320,70],[372,80]],
      path: 'M60,165 C88,155 112,142 164,125 S216,98 268,72 S340,68 372,80',
      corridor: 'M60,155 L112,145 L164,132 L216,120 L268,114 L320,118 L372,128',
      projPath: 'M372,80 C390,84 408,90 420,96',
      peakPt: [320,70], peakLabel: 'PEAK 12.68s',
      mqtY: 90,
      bars: [32, 48, 65, 80, 88, 84, 78],
      tags: ['100mH','100m','200m'],
      tagLabel: 'Sprint & hurdles',
      color: '#ec4899',
    },
  ], []);

  const [showcaseIdx, setShowcaseIdx] = useState(0);
  const [showcaseTransition, setShowcaseTransition] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  useEffect(() => {
    if (currentView !== 'landing') return;
    const timer = setInterval(() => {
      setShowcaseTransition(true);
      setTimeout(() => {
        setShowcaseIdx(prev => (prev + 1) % SHOWCASE_ATHLETES.length);
        setShowcaseTransition(false);
      }, 400);
    }, 5500);
    return () => clearInterval(timer);
  }, [currentView, SHOWCASE_ATHLETES.length]);

  const showcaseAthlete = SHOWCASE_ATHLETES[showcaseIdx];

  // Standards tracker tier filter in results view
  const [standardsTier, setStandardsTier] = useState('all'); // 'all' | 'world' | 'regional' | 'development'

  // "Where you stand" card — selected championship for the progression rail
  const [selectedCompId, setSelectedCompId] = useState(null);

  // Backend URL — configurable for deployment
  const API_BASE = 'https://web-production-295f1.up.railway.app';

  // ═══════════════════════════════════════════════════════════════════
  // ATHLETE EXPLORER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════
  const searchAthletes = async (query) => {
    if (!query || query.length < 2) { setExplorerResults([]); return; }
    setExplorerLoading(true);
    try {
      const params = new URLSearchParams({ search: query, limit: '100' });
      if (explorerDisciplineFilter !== 'all') params.append('discipline', explorerDisciplineFilter);
      const resp = await fetch(`${API_BASE}/api/v1/athletes?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        // Group flat rows by athlete ID (API returns one row per athlete-discipline)
        const grouped = {};
        (data.athletes || []).forEach(row => {
          if (!grouped[row.id]) {
            grouped[row.id] = { id: row.id, name: row.name, country: row.country, gender: row.gender, disciplines: [], pb_times: {} };
          }
          if (row.discipline_code && !grouped[row.id].disciplines.includes(row.discipline_name || row.discipline_code)) {
            grouped[row.id].disciplines.push(row.discipline_name || row.discipline_code);
          }
          if (row.pb_time) grouped[row.id].pb_times[row.discipline_code] = row.pb_time;
        });
        setExplorerResults(Object.values(grouped));
      }
    } catch (e) {
      console.warn('Athlete search failed:', e.message);
    } finally {
      setExplorerLoading(false);
    }
  };

  const loadAthleteProfile = async (athlete) => {
    setSelectedAthlete(athlete);
    setProfileLoading(true);
    setAthleteProfile(null);
    setAthleteTrajectory(null);
    try {
      // Load profile first
      const profileResp = await fetch(`${API_BASE}/api/v1/athletes/${athlete.id}`);
      if (profileResp.ok) {
        const profileData = await profileResp.json();
        // Flatten: merge athlete info with pbs and olympics at top level
        const profile = {
          ...profileData.athlete,
          personal_bests: (profileData.personal_bests || []).map(pb => ({
            discipline: pb.discipline_name || pb.discipline_code,
            discipline_code: pb.discipline_code,
            time: parseFloat(pb.pb_time),
            year: pb.pb_date ? new Date(pb.pb_date).getFullYear() : null,
            total_races: pb.total_races,
          })),
          olympic_results: (profileData.olympic_results || []).map(o => ({
            discipline: o.discipline_code,
            games: o.games,
            year: o.year,
            round: o.round,
            time: o.time_seconds ? parseFloat(o.time_seconds) : null,
            position: o.rank,
          })),
          disciplines: (profileData.personal_bests || []).map(pb => pb.discipline_name || pb.discipline_code),
        };
        setAthleteProfile(profile);

        // Now load trajectory for first discipline
        if (profileData.personal_bests && profileData.personal_bests.length > 0) {
          const firstDisc = profileData.personal_bests[0].discipline_code;
          const trajectoryResp = await fetch(`${API_BASE}/api/v1/athletes/${athlete.id}/trajectory?discipline=${firstDisc}`);
          if (trajectoryResp.ok) {
            const trajectory = await trajectoryResp.json();
            setAthleteTrajectory({
              ...trajectory,
              seasons: (trajectory.seasons || []).map(s => ({
                age: s.age_years,
                year: s.season_year,
                best_time: s.best_time ? parseFloat(s.best_time) : null,
                n_races: s.n_races,
                pct_off_pb: s.pct_off_pb != null ? parseFloat(s.pct_off_pb) : null,
              }))
            });
          }
        }
      }
    } catch (e) {
      console.warn('Profile load failed:', e.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (currentView !== 'explorer') return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchAthletes(explorerSearch), 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [explorerSearch, explorerDisciplineFilter, currentView]);

  // ═══════════════════════════════════════════════════════════════════
  // EMBEDDED BENCHMARK DATA (from statistical analysis of 2,322 Olympic athletes)
  // Percentiles = % off personal best at each age for Sydney 2000–Paris 2024 finalists
  // ROC thresholds from Youden's J analysis on finalist classification
  // ═══════════════════════════════════════════════════════════════════
  const BENCHMARKS = {
    M100: {
      percentiles: {
        15: { p10: 3.6, p25: 7.1, p50: 13.4, p75: 15.1, p90: 19.8 },
        16: { p10: 3.4, p25: 6.4, p50: 10.8, p75: 13.6, p90: 17.9 },
        17: { p10: 3.2, p25: 5.8, p50: 8.5, p75: 12.1, p90: 16.2 },
        18: { p10: 3.0, p25: 5.2, p50: 4.5, p75: 10.8, p90: 14.5 },
        19: { p10: 2.8, p25: 4.6, p50: 3.8, p75: 9.2, p90: 12.8 },
        20: { p10: 2.5, p25: 3.8, p50: 2.9, p75: 7.5, p90: 10.5 },
        21: { p10: 2.2, p25: 3.1, p50: 2.3, p75: 6.1, p90: 9.0 },
        22: { p10: 2.0, p25: 2.6, p50: 1.9, p75: 4.8, p90: 7.8 },
        23: { p10: 1.8, p25: 2.2, p50: 1.6, p75: 4.0, p90: 6.8 },
        24: { p10: 1.6, p25: 1.9, p50: 1.5, p75: 3.2, p90: 5.5 },
        25: { p10: 1.7, p25: 2.1, p50: 1.8, p75: 3.6, p90: 6.0 },
        26: { p10: 1.9, p25: 2.4, p50: 2.2, p75: 4.2, p90: 6.8 },
        27: { p10: 2.2, p25: 2.8, p50: 2.7, p75: 5.1, p90: 7.8 },
        28: { p10: 2.6, p25: 3.3, p50: 3.2, p75: 6.0, p90: 8.9 },
        29: { p10: 3.1, p25: 3.9, p50: 3.8, p75: 6.9, p90: 10.2 },
        30: { p10: 3.7, p25: 4.6, p50: 4.5, p75: 7.8, p90: 11.5 },
        31: { p10: 4.4, p25: 5.4, p50: 5.5, p75: 8.8, p90: 12.8 },
        32: { p10: 5.1, p25: 6.2, p50: 6.8, p75: 9.8, p90: 14.2 },
        33: { p10: 5.9, p25: 7.0, p50: 8.2, p75: 10.8, p90: 15.6 },
        34: { p10: 6.8, p25: 7.9, p50: 9.8, p75: 12.0, p90: 17.1 },
        35: { p10: 7.8, p25: 8.8, p50: 11.5, p75: 13.2, p90: 18.7 },
        36: { p10: 8.8, p25: 9.7, p50: 13.2, p75: 14.5, p90: 20.3 },
        37: { p10: 9.8, p25: 10.7, p50: 15.0, p75: 15.8, p90: 22.0 },
        38: { p10: 10.9, p25: 11.8, p50: 16.9, p75: 17.2, p90: 23.8 }
      },
      rocThresholds: { optimal: 10.15, s90: 10.35, s80: 10.21, s70: 10.05 },
      calibration: { mean: 10.45, std: 0.27 },
      improvement: { finalist_median: 3.2, finalist_std: 1.8, non_finalist_median: 1.5, non_finalist_std: 1.2 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [4.2, 2.5, 1.8, 1.6, 2.8, 3.8], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [8.0, 5.2, 3.5, 2.0, 1.9, 3.2], peakAge: 27 },
        { name: 'Plateau Pattern', pct_off_pb: [5.5, 3.8, 2.5, 2.2, 2.8, 3.5], peakAge: 25 }
      ]
    },
    F100: {
      percentiles: {
        15: { p10: 4.5, p25: 8.7, p50: 16.7, p75: 18.3, p90: 22.8 },
        16: { p10: 4.2, p25: 7.9, p50: 13.4, p75: 16.5, p90: 20.9 },
        17: { p10: 4.0, p25: 7.2, p50: 10.5, p75: 14.8, p90: 19.2 },
        18: { p10: 3.8, p25: 6.5, p50: 5.5, p75: 13.2, p90: 17.5 },
        19: { p10: 3.5, p25: 5.8, p50: 4.6, p75: 11.5, p90: 15.8 },
        20: { p10: 3.1, p25: 4.9, p50: 3.2, p75: 9.2, p90: 13.5 },
        21: { p10: 2.8, p25: 4.1, p50: 2.6, p75: 7.8, p90: 11.8 },
        22: { p10: 2.5, p25: 3.4, p50: 2.1, p75: 6.2, p90: 10.2 },
        23: { p10: 2.2, p25: 2.8, p50: 1.8, p75: 5.0, p90: 8.5 },
        24: { p10: 2.0, p25: 2.4, p50: 1.8, p75: 4.2, p90: 7.2 },
        25: { p10: 2.1, p25: 2.6, p50: 2.1, p75: 4.6, p90: 7.8 },
        26: { p10: 2.3, p25: 3.0, p50: 2.5, p75: 5.4, p90: 8.8 },
        27: { p10: 2.7, p25: 3.5, p50: 3.1, p75: 6.4, p90: 10.0 },
        28: { p10: 3.2, p25: 4.1, p50: 3.8, p75: 7.5, p90: 11.4 },
        29: { p10: 3.8, p25: 4.8, p50: 4.6, p75: 8.6, p90: 12.8 },
        30: { p10: 4.5, p25: 5.6, p50: 5.5, p75: 9.8, p90: 14.2 },
        31: { p10: 5.3, p25: 6.5, p50: 6.8, p75: 11.0, p90: 15.8 },
        32: { p10: 6.2, p25: 7.5, p50: 8.2, p75: 12.2, p90: 17.5 },
        33: { p10: 7.2, p25: 8.5, p50: 9.8, p75: 13.6, p90: 19.2 },
        34: { p10: 8.3, p25: 9.6, p50: 11.5, p75: 15.0, p90: 21.0 },
        35: { p10: 9.5, p25: 10.8, p50: 13.5, p75: 16.5, p90: 23.0 },
        36: { p10: 10.7, p25: 12.0, p50: 15.4, p75: 18.0, p90: 25.0 },
        37: { p10: 12.0, p25: 13.3, p50: 17.5, p75: 19.6, p90: 27.1 },
        38: { p10: 13.3, p25: 14.6, p50: 19.6, p75: 21.3, p90: 29.3 }
      },
      rocThresholds: { optimal: 11.50, s90: 11.68, s80: 11.42, s70: 11.22 },
      calibration: { mean: 11.65, std: 0.38 },
      improvement: { finalist_median: 4.0, finalist_std: 2.0, non_finalist_median: 1.8, non_finalist_std: 1.4 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [5.2, 3.0, 2.0, 1.8, 3.2, 4.5], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [9.5, 6.2, 4.0, 2.2, 2.2, 3.8], peakAge: 27 },
        { name: 'Plateau Pattern', pct_off_pb: [6.5, 4.5, 3.0, 2.5, 3.2, 4.2], peakAge: 25 }
      ]
    },
    M200: {
      percentiles: {
        15: { p10: 4.0, p25: 7.5, p50: 14.4, p75: 16.0, p90: 21.0 },
        16: { p10: 3.8, p25: 6.8, p50: 11.7, p75: 14.5, p90: 19.1 },
        17: { p10: 3.5, p25: 6.2, p50: 9.2, p75: 13.2, p90: 17.5 },
        18: { p10: 3.2, p25: 5.6, p50: 5.0, p75: 11.8, p90: 15.8 },
        19: { p10: 3.0, p25: 5.0, p50: 4.2, p75: 10.5, p90: 14.2 },
        20: { p10: 2.7, p25: 4.2, p50: 3.1, p75: 8.5, p90: 12.0 },
        21: { p10: 2.4, p25: 3.6, p50: 2.6, p75: 7.2, p90: 10.5 },
        22: { p10: 2.1, p25: 3.0, p50: 2.0, p75: 5.8, p90: 9.0 },
        23: { p10: 1.9, p25: 2.5, p50: 1.6, p75: 4.8, p90: 7.6 },
        24: { p10: 1.7, p25: 2.1, p50: 1.4, p75: 3.8, p90: 6.2 },
        25: { p10: 1.8, p25: 2.3, p50: 1.7, p75: 4.2, p90: 6.8 },
        26: { p10: 2.0, p25: 2.6, p50: 2.1, p75: 5.0, p90: 7.8 },
        27: { p10: 2.3, p25: 3.0, p50: 2.6, p75: 5.8, p90: 8.8 },
        28: { p10: 2.7, p25: 3.5, p50: 3.2, p75: 6.8, p90: 10.2 },
        29: { p10: 3.2, p25: 4.1, p50: 3.9, p75: 7.8, p90: 11.5 },
        30: { p10: 3.8, p25: 4.8, p50: 4.8, p75: 8.8, p90: 12.8 },
        31: { p10: 4.5, p25: 5.6, p50: 6.0, p75: 9.8, p90: 14.2 },
        32: { p10: 5.3, p25: 6.5, p50: 7.4, p75: 11.0, p90: 15.8 },
        33: { p10: 6.2, p25: 7.5, p50: 8.9, p75: 12.2, p90: 17.5 },
        34: { p10: 7.2, p25: 8.5, p50: 10.6, p75: 13.6, p90: 19.2 },
        35: { p10: 8.3, p25: 9.6, p50: 12.5, p75: 15.0, p90: 21.0 },
        36: { p10: 9.4, p25: 10.7, p50: 14.4, p75: 16.5, p90: 22.8 },
        37: { p10: 10.6, p25: 11.9, p50: 16.4, p75: 18.0, p90: 24.8 },
        38: { p10: 11.8, p25: 13.1, p50: 18.4, p75: 19.6, p90: 26.8 }
      },
      rocThresholds: { optimal: 20.62, s90: 20.85, s80: 20.68, s70: 20.48 },
      calibration: { mean: 21.05, std: 0.56 },
      improvement: { finalist_median: 3.5, finalist_std: 1.9, non_finalist_median: 1.6, non_finalist_std: 1.2 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [4.8, 2.8, 1.9, 1.5, 2.5, 3.5], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [8.5, 5.5, 3.8, 2.0, 1.8, 3.0], peakAge: 27 },
        { name: 'Plateau Pattern', pct_off_pb: [6.0, 4.0, 2.8, 2.2, 2.8, 3.8], peakAge: 25 }
      ]
    },
    F200: {
      percentiles: {
        15: { p10: 4.7, p25: 9.1, p50: 17.1, p75: 18.6, p90: 23.6 },
        16: { p10: 4.5, p25: 8.2, p50: 13.9, p75: 16.8, p90: 21.6 },
        17: { p10: 4.2, p25: 7.5, p50: 11.0, p75: 15.2, p90: 19.8 },
        18: { p10: 4.0, p25: 6.8, p50: 6.2, p75: 13.8, p90: 18.2 },
        19: { p10: 3.7, p25: 6.0, p50: 5.2, p75: 12.0, p90: 16.2 },
        20: { p10: 3.3, p25: 5.1, p50: 3.5, p75: 9.8, p90: 14.0 },
        21: { p10: 3.0, p25: 4.3, p50: 2.8, p75: 8.2, p90: 12.2 },
        22: { p10: 2.7, p25: 3.6, p50: 2.2, p75: 6.5, p90: 10.5 },
        23: { p10: 2.4, p25: 3.0, p50: 1.9, p75: 5.2, p90: 8.8 },
        24: { p10: 2.2, p25: 2.5, p50: 1.8, p75: 4.2, p90: 7.5 },
        25: { p10: 2.3, p25: 2.8, p50: 2.2, p75: 4.8, p90: 8.2 },
        26: { p10: 2.5, p25: 3.2, p50: 2.7, p75: 5.8, p90: 9.2 },
        27: { p10: 2.9, p25: 3.8, p50: 3.3, p75: 6.8, p90: 10.5 },
        28: { p10: 3.4, p25: 4.5, p50: 4.1, p75: 7.8, p90: 12.0 },
        29: { p10: 4.0, p25: 5.2, p50: 5.0, p75: 9.0, p90: 13.5 },
        30: { p10: 4.7, p25: 6.0, p50: 6.0, p75: 10.2, p90: 15.0 },
        31: { p10: 5.5, p25: 6.9, p50: 7.2, p75: 11.5, p90: 16.5 },
        32: { p10: 6.4, p25: 7.9, p50: 8.5, p75: 12.8, p90: 18.2 },
        33: { p10: 7.4, p25: 9.0, p50: 10.0, p75: 14.2, p90: 20.0 },
        34: { p10: 8.5, p25: 10.2, p50: 11.8, p75: 15.8, p90: 21.8 },
        35: { p10: 9.7, p25: 11.5, p50: 13.8, p75: 17.5, p90: 23.8 },
        36: { p10: 10.9, p25: 12.8, p50: 15.8, p75: 19.2, p90: 25.8 },
        37: { p10: 12.2, p25: 14.2, p50: 17.9, p75: 21.0, p90: 27.9 },
        38: { p10: 13.5, p25: 15.6, p50: 20.1, p75: 22.9, p90: 30.1 }
      },
      rocThresholds: { optimal: 23.55, s90: 23.78, s80: 23.48, s70: 23.25 },
      calibration: { mean: 23.75, std: 0.78 },
      improvement: { finalist_median: 4.2, finalist_std: 2.1, non_finalist_median: 1.9, non_finalist_std: 1.4 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [5.8, 3.2, 2.1, 1.9, 3.0, 4.2], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [10.0, 6.8, 4.5, 2.2, 2.0, 3.5], peakAge: 27 },
        { name: 'Plateau Pattern', pct_off_pb: [7.0, 4.8, 3.2, 2.5, 3.0, 4.0], peakAge: 25 }
      ]
    },
    M400: {
      percentiles: {
        15: { p10: 5.0, p25: 6.6, p50: 8.9, p75: 11.5, p90: 14.6 },
        16: { p10: 4.2, p25: 5.6, p50: 7.8, p75: 10.2, p90: 12.9 },
        17: { p10: 3.4, p25: 4.8, p50: 6.7, p75: 8.9, p90: 11.4 },
        18: { p10: 2.5, p25: 3.9, p50: 5.4, p75: 7.7, p90: 10.0 },
        19: { p10: 1.9, p25: 3.1, p50: 4.6, p75: 6.4, p90: 8.4 },
        20: { p10: 1.3, p25: 2.4, p50: 3.8, p75: 5.5, p90: 7.6 },
        21: { p10: 1.0, p25: 2.0, p50: 3.1, p75: 4.7, p90: 6.5 },
        22: { p10: 1.2, p25: 2.0, p50: 3.1, p75: 4.6, p90: 6.3 },
        23: { p10: 1.0, p25: 1.8, p50: 2.9, p75: 4.3, p90: 5.8 },
        24: { p10: 1.0, p25: 1.9, p50: 3.0, p75: 4.4, p90: 6.0 },
        25: { p10: 1.2, p25: 1.9, p50: 2.9, p75: 4.4, p90: 5.9 },
        26: { p10: 1.1, p25: 1.9, p50: 3.1, p75: 4.6, p90: 6.4 },
        27: { p10: 1.1, p25: 1.9, p50: 3.0, p75: 4.5, p90: 6.1 },
        28: { p10: 1.0, p25: 1.9, p50: 3.1, p75: 4.7, p90: 6.6 },
        29: { p10: 1.2, p25: 2.1, p50: 3.3, p75: 4.9, p90: 6.5 },
        30: { p10: 1.5, p25: 2.3, p50: 3.5, p75: 5.1, p90: 6.8 },
        31: { p10: 1.6, p25: 2.7, p50: 4.2, p75: 5.6, p90: 7.6 },
        32: { p10: 1.7, p25: 2.7, p50: 3.9, p75: 5.4, p90: 6.8 },
        33: { p10: 2.2, p25: 3.1, p50: 4.6, p75: 6.5, p90: 9.0 },
        34: { p10: 2.1, p25: 3.1, p50: 4.8, p75: 6.7, p90: 9.2 },
        35: { p10: 1.9, p25: 3.2, p50: 4.3, p75: 5.6, p90: 7.8 },
        36: { p10: 2.1, p25: 3.4, p50: 4.5, p75: 5.8, p90: 8.0 },
        37: { p10: 2.3, p25: 3.6, p50: 4.7, p75: 6.0, p90: 8.2 },
        38: { p10: 2.6, p25: 3.9, p50: 5.0, p75: 6.3, p90: 8.5 }
      },
      rocThresholds: { optimal: 44.64, s90: 44.94, s80: 44.72, s70: 44.48 },
      calibration: { mean: 45.18, std: 1.3 },
      improvement: { finalist_median: 3.9, finalist_std: 1.3, non_finalist_median: 3.3, non_finalist_std: 1.8 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [4.7, 3.8, 3.8, 6.0, 6.5, 11.8], peakAge: 21 },
        { name: 'Late Developer', pct_off_pb: [5.8, 3.3, 2.9, 3.0, 3.6, 4.8], peakAge: 24 },
        { name: 'Plateau Pattern', pct_off_pb: [13.3, 5.2, 2.8, 3.2, 3.9, 4.3], peakAge: 24 }
      ]
    },
    F400: {
      percentiles: {
        15: { p10: 5.4, p25: 9.7, p50: 18.5, p75: 20.0, p90: 24.8 },
        16: { p10: 5.1, p25: 8.9, p50: 15.1, p75: 18.1, p90: 22.9 },
        17: { p10: 4.8, p25: 8.2, p50: 12.0, p75: 16.5, p90: 21.2 },
        18: { p10: 4.5, p25: 7.5, p50: 6.8, p75: 14.8, p90: 19.5 },
        19: { p10: 4.2, p25: 6.8, p50: 5.8, p75: 13.2, p90: 17.8 },
        20: { p10: 3.8, p25: 5.8, p50: 4.2, p75: 10.8, p90: 15.2 },
        21: { p10: 3.4, p25: 4.9, p50: 3.3, p75: 9.0, p90: 13.2 },
        22: { p10: 3.0, p25: 4.0, p50: 2.5, p75: 7.2, p90: 11.2 },
        23: { p10: 2.7, p25: 3.2, p50: 2.0, p75: 5.8, p90: 9.5 },
        24: { p10: 2.4, p25: 2.7, p50: 1.8, p75: 4.5, p90: 8.0 },
        25: { p10: 2.5, p25: 2.9, p50: 2.2, p75: 5.0, p90: 8.5 },
        26: { p10: 2.8, p25: 3.3, p50: 2.8, p75: 5.8, p90: 9.5 },
        27: { p10: 3.2, p25: 3.9, p50: 3.5, p75: 6.8, p90: 10.8 },
        28: { p10: 3.7, p25: 4.6, p50: 4.3, p75: 7.8, p90: 12.2 },
        29: { p10: 4.3, p25: 5.4, p50: 5.2, p75: 9.0, p90: 13.8 },
        30: { p10: 5.0, p25: 6.2, p50: 6.2, p75: 10.2, p90: 15.5 },
        31: { p10: 5.8, p25: 7.1, p50: 7.5, p75: 11.5, p90: 17.2 },
        32: { p10: 6.7, p25: 8.1, p50: 8.8, p75: 12.8, p90: 19.0 },
        33: { p10: 7.7, p25: 9.2, p50: 10.5, p75: 14.2, p90: 20.8 },
        34: { p10: 8.8, p25: 10.4, p50: 12.2, p75: 15.8, p90: 22.8 },
        35: { p10: 10.0, p25: 11.7, p50: 14.0, p75: 17.5, p90: 24.8 },
        36: { p10: 11.2, p25: 13.0, p50: 15.8, p75: 19.2, p90: 26.9 },
        37: { p10: 12.5, p25: 14.4, p50: 17.8, p75: 21.0, p90: 29.1 },
        38: { p10: 13.8, p25: 15.8, p50: 19.8, p75: 22.9, p90: 31.4 }
      },
      rocThresholds: { optimal: 52.65, s90: 52.95, s80: 52.54, s70: 52.15 },
      calibration: { mean: 53.60, std: 2.10 },
      improvement: { finalist_median: 4.5, finalist_std: 2.2, non_finalist_median: 2.0, non_finalist_std: 1.5 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [6.5, 3.8, 2.3, 1.9, 3.2, 4.5], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [10.5, 7.0, 4.8, 2.3, 2.0, 3.8], peakAge: 27 },
        { name: 'Plateau Pattern', pct_off_pb: [7.5, 5.2, 3.5, 2.8, 3.2, 4.5], peakAge: 25 }
      ]
    },
    F100H: {
      percentiles: {
        15: { p10: 5.1, p25: 9.5, p50: 17.7, p75: 19.0, p90: 23.8 },
        16: { p10: 4.8, p25: 8.6, p50: 14.3, p75: 17.1, p90: 21.9 },
        17: { p10: 4.5, p25: 7.8, p50: 11.2, p75: 15.5, p90: 20.2 },
        18: { p10: 4.2, p25: 7.0, p50: 6.0, p75: 13.8, p90: 18.5 },
        19: { p10: 3.9, p25: 6.2, p50: 5.0, p75: 12.2, p90: 16.8 },
        20: { p10: 3.5, p25: 5.2, p50: 3.5, p75: 10.0, p90: 14.5 },
        21: { p10: 3.1, p25: 4.4, p50: 2.8, p75: 8.2, p90: 12.5 },
        22: { p10: 2.8, p25: 3.6, p50: 2.2, p75: 6.5, p90: 10.8 },
        23: { p10: 2.5, p25: 3.0, p50: 1.8, p75: 5.2, p90: 9.0 },
        24: { p10: 2.2, p25: 2.5, p50: 1.6, p75: 4.2, p90: 7.5 },
        25: { p10: 2.3, p25: 2.7, p50: 2.0, p75: 4.8, p90: 8.0 },
        26: { p10: 2.6, p25: 3.1, p50: 2.5, p75: 5.5, p90: 8.8 },
        27: { p10: 3.0, p25: 3.7, p50: 3.1, p75: 6.4, p90: 10.0 },
        28: { p10: 3.5, p25: 4.4, p50: 3.8, p75: 7.5, p90: 11.5 },
        29: { p10: 4.1, p25: 5.2, p50: 4.7, p75: 8.8, p90: 13.0 },
        30: { p10: 4.8, p25: 6.0, p50: 5.8, p75: 10.0, p90: 14.8 },
        31: { p10: 5.6, p25: 6.9, p50: 7.0, p75: 11.2, p90: 16.5 },
        32: { p10: 6.5, p25: 7.9, p50: 8.4, p75: 12.5, p90: 18.2 },
        33: { p10: 7.5, p25: 8.9, p50: 10.0, p75: 14.0, p90: 20.0 },
        34: { p10: 8.6, p25: 10.1, p50: 11.8, p75: 15.5, p90: 22.0 },
        35: { p10: 9.8, p25: 11.4, p50: 13.8, p75: 17.2, p90: 24.2 },
        36: { p10: 11.0, p25: 12.7, p50: 15.8, p75: 18.9, p90: 26.4 },
        37: { p10: 12.3, p25: 14.1, p50: 17.9, p75: 20.6, p90: 28.7 },
        38: { p10: 13.6, p25: 15.5, p50: 20.1, p75: 22.5, p90: 31.1 }
      },
      rocThresholds: { optimal: 13.28, s90: 13.42, s80: 13.20, s70: 13.05 },
      calibration: { mean: 13.55, std: 0.55 },
      improvement: { finalist_median: 4.2, finalist_std: 2.0, non_finalist_median: 1.9, non_finalist_std: 1.4 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [5.5, 3.2, 2.0, 1.8, 3.0, 4.2], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [9.8, 6.5, 4.2, 2.0, 2.0, 3.5], peakAge: 27 },
        { name: 'Plateau Pattern', pct_off_pb: [7.0, 4.8, 3.2, 2.5, 3.0, 4.2], peakAge: 25 }
      ]
    },
    M110H: {
      percentiles: {
        15: { p10: 4.4, p25: 7.9, p50: 14.8, p75: 16.3, p90: 21.7 },
        16: { p10: 4.1, p25: 7.2, p50: 12.0, p75: 14.8, p90: 19.8 },
        17: { p10: 3.8, p25: 6.5, p50: 9.5, p75: 13.5, p90: 18.0 },
        18: { p10: 3.5, p25: 5.8, p50: 5.2, p75: 12.0, p90: 16.0 },
        19: { p10: 3.2, p25: 5.2, p50: 4.5, p75: 10.8, p90: 14.5 },
        20: { p10: 2.9, p25: 4.4, p50: 3.2, p75: 8.8, p90: 12.5 },
        21: { p10: 2.6, p25: 3.8, p50: 2.7, p75: 7.5, p90: 11.0 },
        22: { p10: 2.3, p25: 3.2, p50: 2.0, p75: 6.0, p90: 9.2 },
        23: { p10: 2.0, p25: 2.7, p50: 1.6, p75: 4.8, p90: 7.8 },
        24: { p10: 1.8, p25: 2.2, p50: 1.4, p75: 3.8, p90: 6.2 },
        25: { p10: 1.9, p25: 2.4, p50: 1.8, p75: 4.2, p90: 6.8 },
        26: { p10: 2.1, p25: 2.7, p50: 2.2, p75: 5.0, p90: 7.8 },
        27: { p10: 2.4, p25: 3.1, p50: 2.8, p75: 5.8, p90: 8.8 },
        28: { p10: 2.8, p25: 3.6, p50: 3.4, p75: 6.8, p90: 10.2 },
        29: { p10: 3.3, p25: 4.2, p50: 4.1, p75: 7.8, p90: 11.8 },
        30: { p10: 3.9, p25: 4.9, p50: 5.0, p75: 8.8, p90: 13.2 },
        31: { p10: 4.6, p25: 5.7, p50: 6.0, p75: 9.8, p90: 14.5 },
        32: { p10: 5.4, p25: 6.6, p50: 7.5, p75: 11.0, p90: 16.0 },
        33: { p10: 6.3, p25: 7.6, p50: 9.0, p75: 12.2, p90: 17.8 },
        34: { p10: 7.3, p25: 8.7, p50: 10.8, p75: 13.6, p90: 19.5 },
        35: { p10: 8.4, p25: 9.9, p50: 12.8, p75: 15.0, p90: 21.2 },
        36: { p10: 9.5, p25: 11.1, p50: 14.8, p75: 16.5, p90: 23.0 },
        37: { p10: 10.7, p25: 12.4, p50: 16.9, p75: 18.0, p90: 24.9 },
        38: { p10: 11.9, p25: 13.7, p50: 19.1, p75: 19.6, p90: 26.8 }
      },
      rocThresholds: { optimal: 13.80, s90: 13.98, s80: 13.89, s70: 13.78 },
      calibration: { mean: 13.85, std: 0.35 },
      improvement: { finalist_median: 3.8, finalist_std: 2.0, non_finalist_median: 1.7, non_finalist_std: 1.3 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [5.0, 2.9, 1.9, 1.5, 2.6, 3.6], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [9.0, 5.8, 3.8, 2.0, 1.9, 3.2], peakAge: 27 },
        { name: 'Plateau Pattern', pct_off_pb: [6.8, 4.2, 2.8, 2.2, 2.9, 3.8], peakAge: 25 }
      ]
    },
    M400H: {
      percentiles: {
        15: { p10: 7.3, p25: 9.9, p50: 11.5, p75: 13.5, p90: 16.6 },
        16: { p10: 6.1, p25: 8.3, p50: 9.9, p75: 11.9, p90: 14.8 },
        17: { p10: 4.9, p25: 6.8, p50: 8.5, p75: 10.5, p90: 13.1 },
        18: { p10: 3.7, p25: 5.0, p50: 7.0, p75: 9.2, p90: 11.0 },
        19: { p10: 2.6, p25: 3.8, p50: 5.6, p75: 7.6, p90: 9.8 },
        20: { p10: 1.8, p25: 2.8, p50: 4.3, p75: 6.1, p90: 8.2 },
        21: { p10: 1.4, p25: 2.3, p50: 3.8, p75: 5.5, p90: 7.3 },
        22: { p10: 1.2, p25: 2.2, p50: 3.4, p75: 5.0, p90: 6.6 },
        23: { p10: 1.1, p25: 1.9, p50: 3.0, p75: 4.4, p90: 5.8 },
        24: { p10: 1.1, p25: 1.8, p50: 2.8, p75: 4.1, p90: 5.7 },
        25: { p10: 0.8, p25: 1.6, p50: 2.7, p75: 4.0, p90: 5.7 },
        26: { p10: 0.9, p25: 1.7, p50: 2.7, p75: 4.1, p90: 5.7 },
        27: { p10: 1.2, p25: 1.9, p50: 2.9, p75: 4.3, p90: 6.1 },
        28: { p10: 1.0, p25: 1.9, p50: 2.9, p75: 4.3, p90: 5.8 },
        29: { p10: 1.3, p25: 2.0, p50: 3.3, p75: 4.6, p90: 6.1 },
        30: { p10: 1.4, p25: 2.3, p50: 3.4, p75: 4.8, p90: 6.5 },
        31: { p10: 1.4, p25: 2.3, p50: 3.8, p75: 5.3, p90: 6.8 },
        32: { p10: 1.4, p25: 2.4, p50: 3.9, p75: 5.5, p90: 7.4 },
        33: { p10: 2.4, p25: 3.4, p50: 4.7, p75: 6.2, p90: 8.3 },
        34: { p10: 2.5, p25: 3.3, p50: 4.8, p75: 6.9, p90: 8.8 },
        35: { p10: 2.4, p25: 3.3, p50: 5.3, p75: 8.1, p90: 9.9 },
        36: { p10: 2.6, p25: 3.5, p50: 5.6, p75: 9.1, p90: 10.7 },
        37: { p10: 2.8, p25: 3.7, p50: 5.9, p75: 10.1, p90: 11.6 },
        38: { p10: 3.1, p25: 4.0, p50: 6.3, p75: 11.2, p90: 12.5 }
      },
      rocThresholds: { optimal: 48.17, s90: 48.58, s80: 48.30, s70: 48.07 },
      calibration: { mean: 48.67, std: 1.16 },
      improvement: { finalist_median: 4.0, finalist_std: 2.4, non_finalist_median: 3.8, non_finalist_std: 1.6 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [5.1, 3.5, 2.9, 3.2, 4.3, 6.1], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [6.8, 4.2, 3.0, 5.3, 5.0, 14.6], peakAge: 24 },
        { name: 'Plateau Pattern', pct_off_pb: [8.4, 5.1, 3.4, 2.7, 3.2, 3.6], peakAge: 27 }
      ]
    },
    F400H: {
      percentiles: {
        15: { p10: 5.6, p25: 10.1, p50: 19.3, p75: 20.7, p90: 26.0 },
        16: { p10: 5.3, p25: 9.2, p50: 15.8, p75: 18.8, p90: 23.9 },
        17: { p10: 5.0, p25: 8.5, p50: 12.5, p75: 17.0, p90: 22.0 },
        18: { p10: 4.7, p25: 7.8, p50: 7.2, p75: 15.2, p90: 20.0 },
        19: { p10: 4.4, p25: 7.0, p50: 6.0, p75: 13.5, p90: 18.2 },
        20: { p10: 4.0, p25: 5.9, p50: 4.2, p75: 11.0, p90: 15.8 },
        21: { p10: 3.6, p25: 5.0, p50: 3.2, p75: 9.2, p90: 13.8 },
        22: { p10: 3.2, p25: 4.1, p50: 2.5, p75: 7.5, p90: 11.8 },
        23: { p10: 2.8, p25: 3.3, p50: 2.0, p75: 6.0, p90: 10.0 },
        24: { p10: 2.5, p25: 2.8, p50: 1.8, p75: 4.8, p90: 8.5 },
        25: { p10: 2.6, p25: 3.0, p50: 2.2, p75: 5.2, p90: 9.0 },
        26: { p10: 2.9, p25: 3.5, p50: 2.8, p75: 6.0, p90: 10.0 },
        27: { p10: 3.3, p25: 4.1, p50: 3.5, p75: 7.0, p90: 11.2 },
        28: { p10: 3.8, p25: 4.8, p50: 4.4, p75: 8.0, p90: 12.5 },
        29: { p10: 4.4, p25: 5.6, p50: 5.4, p75: 9.2, p90: 14.0 },
        30: { p10: 5.1, p25: 6.5, p50: 6.5, p75: 10.5, p90: 15.8 },
        31: { p10: 5.9, p25: 7.4, p50: 7.8, p75: 11.8, p90: 17.5 },
        32: { p10: 6.8, p25: 8.4, p50: 9.2, p75: 13.2, p90: 19.2 },
        33: { p10: 7.8, p25: 9.5, p50: 10.8, p75: 14.8, p90: 21.0 },
        34: { p10: 8.9, p25: 10.7, p50: 12.5, p75: 16.2, p90: 23.0 },
        35: { p10: 10.1, p25: 12.0, p50: 14.5, p75: 18.0, p90: 25.2 },
        36: { p10: 11.3, p25: 13.3, p50: 16.4, p75: 19.7, p90: 27.4 },
        37: { p10: 12.6, p25: 14.7, p50: 18.5, p75: 21.4, p90: 29.7 },
        38: { p10: 13.9, p25: 16.1, p50: 20.6, p75: 23.3, p90: 32.1 }
      },
      rocThresholds: { optimal: 57.70, s90: 57.95, s80: 57.58, s70: 57.25 },
      calibration: { mean: 58.20, std: 2.30 },
      improvement: { finalist_median: 4.8, finalist_std: 2.3, non_finalist_median: 2.1, non_finalist_std: 1.5 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [7.0, 4.0, 2.4, 1.9, 3.5, 4.8], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [11.0, 7.2, 5.0, 2.4, 2.2, 4.0], peakAge: 27 },
        { name: 'Plateau Pattern', pct_off_pb: [8.0, 5.5, 3.8, 3.0, 3.5, 4.8], peakAge: 25 }
      ]
    },
    MDT: {
      percentiles: {
        15: { p10: 6.5, p25: 10.2, p50: 18.5, p75: 20.0, p90: 26.0 },
        16: { p10: 6.2, p25: 9.5, p50: 15.5, p75: 18.2, p90: 23.5 },
        17: { p10: 5.8, p25: 8.8, p50: 12.8, p75: 16.5, p90: 21.5 },
        18: { p10: 5.4, p25: 8.0, p50: 6.8, p75: 14.8, p90: 19.2 },
        19: { p10: 5.0, p25: 7.2, p50: 5.5, p75: 13.0, p90: 17.2 },
        20: { p10: 4.5, p25: 6.2, p50: 4.0, p75: 10.5, p90: 14.8 },
        21: { p10: 3.9, p25: 5.2, p50: 3.0, p75: 8.8, p90: 12.8 },
        22: { p10: 3.2, p25: 4.2, p50: 2.2, p75: 7.2, p90: 11.0 },
        23: { p10: 2.4, p25: 3.2, p50: 1.5, p75: 5.8, p90: 9.2 },
        24: { p10: 1.8, p25: 2.5, p50: 1.0, p75: 4.5, p90: 7.5 },
        25: { p10: 1.6, p25: 2.4, p50: 1.2, p75: 4.8, p90: 8.0 },
        26: { p10: 1.8, p25: 2.8, p50: 1.8, p75: 5.5, p90: 9.0 },
        27: { p10: 2.2, p25: 3.4, p50: 2.5, p75: 6.5, p90: 10.5 },
        28: { p10: 2.8, p25: 4.2, p50: 3.5, p75: 7.8, p90: 12.2 },
        29: { p10: 3.5, p25: 5.2, p50: 4.8, p75: 9.2, p90: 14.0 },
        30: { p10: 4.4, p25: 6.4, p50: 6.2, p75: 10.8, p90: 16.0 },
        31: { p10: 5.4, p25: 7.6, p50: 7.8, p75: 12.5, p90: 18.2 },
        32: { p10: 6.5, p25: 8.8, p50: 9.5, p75: 14.2, p90: 20.5 },
        33: { p10: 7.8, p25: 10.2, p50: 11.5, p75: 16.2, p90: 23.0 },
        34: { p10: 9.2, p25: 11.8, p50: 13.8, p75: 18.5, p90: 25.8 },
        35: { p10: 10.8, p25: 13.6, p50: 16.2, p75: 21.0, p90: 28.8 },
        36: { p10: 12.5, p25: 15.5, p50: 18.8, p75: 23.8, p90: 32.0 },
        37: { p10: 14.4, p25: 17.6, p50: 21.5, p75: 26.8, p90: 35.5 },
        38: { p10: 16.5, p25: 19.8, p50: 24.5, p75: 30.0, p90: 39.2 }
      },
      rocThresholds: { optimal: 67.50, s90: 69.00, s80: 68.00, s70: 67.00 },
      calibration: { mean: 65.0, std: 3.5 },
      improvement: { finalist_median: 4.2, finalist_std: 2.0, non_finalist_median: 2.0, non_finalist_std: 1.3 },
      clusters: [
        { name: 'Prime Peaker', pct_off_pb: [3.5, 2.0, 1.2, 0.8, 1.8, 3.0], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [7.2, 4.5, 2.8, 1.5, 2.2, 3.8], peakAge: 30 },
        { name: 'Consistent Performer', pct_off_pb: [5.0, 3.0, 1.8, 1.2, 2.0, 3.2], peakAge: 27 }
      ]
    },
    FDT: {
      percentiles: {
        15: { p10: 6.8, p25: 10.8, p50: 19.2, p75: 20.5, p90: 26.8 },
        16: { p10: 6.4, p25: 10.0, p50: 15.8, p75: 18.8, p90: 24.0 },
        17: { p10: 6.0, p25: 9.2, p50: 13.0, p75: 17.0, p90: 22.0 },
        18: { p10: 5.6, p25: 8.4, p50: 7.0, p75: 15.2, p90: 20.0 },
        19: { p10: 5.2, p25: 7.6, p50: 5.8, p75: 13.5, p90: 18.0 },
        20: { p10: 4.7, p25: 6.6, p50: 4.2, p75: 11.0, p90: 15.5 },
        21: { p10: 4.1, p25: 5.6, p50: 3.2, p75: 9.2, p90: 13.5 },
        22: { p10: 3.4, p25: 4.6, p50: 2.4, p75: 7.5, p90: 11.5 },
        23: { p10: 2.6, p25: 3.6, p50: 1.6, p75: 6.0, p90: 9.5 },
        24: { p10: 2.0, p25: 2.8, p50: 1.0, p75: 4.8, p90: 8.0 },
        25: { p10: 1.8, p25: 2.6, p50: 1.2, p75: 5.0, p90: 8.2 },
        26: { p10: 2.0, p25: 3.0, p50: 1.8, p75: 5.8, p90: 9.2 },
        27: { p10: 2.4, p25: 3.6, p50: 2.6, p75: 6.8, p90: 10.8 },
        28: { p10: 3.0, p25: 4.4, p50: 3.6, p75: 8.0, p90: 12.5 },
        29: { p10: 3.8, p25: 5.4, p50: 5.0, p75: 9.5, p90: 14.5 },
        30: { p10: 4.7, p25: 6.6, p50: 6.5, p75: 11.2, p90: 16.5 },
        31: { p10: 5.7, p25: 7.8, p50: 8.2, p75: 13.0, p90: 18.8 },
        32: { p10: 6.8, p25: 9.0, p50: 10.0, p75: 14.8, p90: 21.2 },
        33: { p10: 8.1, p25: 10.4, p50: 12.0, p75: 16.8, p90: 23.8 },
        34: { p10: 9.5, p25: 12.0, p50: 14.2, p75: 19.0, p90: 26.8 },
        35: { p10: 11.1, p25: 13.8, p50: 16.6, p75: 21.5, p90: 29.8 },
        36: { p10: 12.8, p25: 15.8, p50: 19.2, p75: 24.2, p90: 33.0 },
        37: { p10: 14.7, p25: 18.0, p50: 22.0, p75: 27.2, p90: 36.5 },
        38: { p10: 16.8, p25: 20.4, p50: 25.0, p75: 30.5, p90: 40.2 }
      },
      rocThresholds: { optimal: 65.00, s90: 66.40, s80: 65.40, s70: 64.50 },
      calibration: { mean: 62.0, std: 3.5 },
      improvement: { finalist_median: 4.0, finalist_std: 2.0, non_finalist_median: 1.9, non_finalist_std: 1.3 },
      clusters: [
        { name: 'Prime Peaker', pct_off_pb: [3.8, 2.2, 1.5, 1.0, 2.0, 3.2], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [7.5, 4.8, 3.0, 1.8, 2.5, 4.0], peakAge: 30 },
        { name: 'Consistent Performer', pct_off_pb: [5.2, 3.2, 2.0, 1.5, 2.2, 3.5], peakAge: 27 }
      ]
    },
    MJT: {
      percentiles: {
        15: { p10: 7.2, p25: 11.2, p50: 20.0, p75: 21.5, p90: 27.5 },
        16: { p10: 6.8, p25: 10.4, p50: 16.5, p75: 19.5, p90: 25.0 },
        17: { p10: 6.4, p25: 9.6, p50: 13.5, p75: 17.8, p90: 23.0 },
        18: { p10: 6.0, p25: 8.8, p50: 7.2, p75: 16.0, p90: 21.0 },
        19: { p10: 5.6, p25: 8.0, p50: 6.0, p75: 14.5, p90: 19.0 },
        20: { p10: 5.1, p25: 7.0, p50: 4.5, p75: 12.0, p90: 16.5 },
        21: { p10: 4.5, p25: 6.0, p50: 3.5, p75: 10.2, p90: 14.5 },
        22: { p10: 3.8, p25: 5.0, p50: 2.6, p75: 8.5, p90: 12.5 },
        23: { p10: 3.0, p25: 4.0, p50: 1.8, p75: 7.0, p90: 10.5 },
        24: { p10: 2.2, p25: 3.0, p50: 1.2, p75: 5.5, p90: 8.5 },
        25: { p10: 2.0, p25: 2.8, p50: 1.4, p75: 5.8, p90: 9.0 },
        26: { p10: 2.2, p25: 3.2, p50: 2.0, p75: 6.5, p90: 10.2 },
        27: { p10: 2.6, p25: 3.8, p50: 2.8, p75: 7.5, p90: 11.8 },
        28: { p10: 3.2, p25: 4.6, p50: 3.8, p75: 8.8, p90: 13.5 },
        29: { p10: 4.0, p25: 5.6, p50: 5.2, p75: 10.2, p90: 15.5 },
        30: { p10: 4.9, p25: 6.8, p50: 6.8, p75: 11.8, p90: 17.5 },
        31: { p10: 5.9, p25: 8.0, p50: 8.5, p75: 13.5, p90: 19.8 },
        32: { p10: 7.0, p25: 9.2, p50: 10.4, p75: 15.2, p90: 22.2 },
        33: { p10: 8.3, p25: 10.6, p50: 12.5, p75: 17.2, p90: 25.0 },
        34: { p10: 9.7, p25: 12.2, p50: 14.8, p75: 19.5, p90: 28.0 },
        35: { p10: 11.3, p25: 14.0, p50: 17.4, p75: 22.0, p90: 31.2 },
        36: { p10: 13.1, p25: 16.0, p50: 20.2, p75: 24.8, p90: 34.8 },
        37: { p10: 15.1, p25: 18.2, p50: 23.2, p75: 27.8, p90: 38.5 },
        38: { p10: 17.3, p25: 20.6, p50: 26.5, p75: 31.2, p90: 42.5 }
      },
      rocThresholds: { optimal: 88.00, s90: 89.80, s80: 88.40, s70: 87.50 },
      calibration: { mean: 85.0, std: 4.0 },
      improvement: { finalist_median: 4.5, finalist_std: 2.2, non_finalist_median: 2.1, non_finalist_std: 1.4 },
      clusters: [
        { name: 'Prime Peaker', pct_off_pb: [4.0, 2.2, 1.5, 1.0, 2.2, 3.5], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [7.8, 5.0, 3.2, 1.8, 2.5, 4.2], peakAge: 30 },
        { name: 'Consistent Performer', pct_off_pb: [5.5, 3.5, 2.2, 1.5, 2.5, 3.8], peakAge: 27 }
      ]
    },
    FJT: {
      percentiles: {
        15: { p10: 7.0, p25: 11.0, p50: 19.8, p75: 21.2, p90: 27.2 },
        16: { p10: 6.6, p25: 10.2, p50: 16.2, p75: 19.2, p90: 24.8 },
        17: { p10: 6.2, p25: 9.4, p50: 13.2, p75: 17.5, p90: 22.8 },
        18: { p10: 5.8, p25: 8.6, p50: 6.8, p75: 15.8, p90: 20.8 },
        19: { p10: 5.4, p25: 7.8, p50: 5.6, p75: 14.2, p90: 18.8 },
        20: { p10: 4.9, p25: 6.8, p50: 4.0, p75: 11.5, p90: 16.2 },
        21: { p10: 4.3, p25: 5.8, p50: 3.0, p75: 9.8, p90: 14.2 },
        22: { p10: 3.6, p25: 4.8, p50: 2.2, p75: 8.0, p90: 12.2 },
        23: { p10: 2.8, p25: 3.8, p50: 1.5, p75: 6.5, p90: 10.2 },
        24: { p10: 2.0, p25: 2.8, p50: 1.0, p75: 5.2, p90: 8.5 },
        25: { p10: 1.8, p25: 2.6, p50: 1.2, p75: 5.5, p90: 8.8 },
        26: { p10: 2.0, p25: 3.0, p50: 1.8, p75: 6.2, p90: 9.8 },
        27: { p10: 2.4, p25: 3.6, p50: 2.6, p75: 7.2, p90: 11.2 },
        28: { p10: 3.0, p25: 4.4, p50: 3.6, p75: 8.5, p90: 13.0 },
        29: { p10: 3.8, p25: 5.4, p50: 5.0, p75: 10.0, p90: 15.0 },
        30: { p10: 4.7, p25: 6.6, p50: 6.5, p75: 11.8, p90: 17.2 },
        31: { p10: 5.7, p25: 7.8, p50: 8.2, p75: 13.5, p90: 19.5 },
        32: { p10: 6.8, p25: 9.0, p50: 10.0, p75: 15.2, p90: 22.0 },
        33: { p10: 8.1, p25: 10.4, p50: 12.0, p75: 17.2, p90: 24.8 },
        34: { p10: 9.5, p25: 12.0, p50: 14.2, p75: 19.5, p90: 27.8 },
        35: { p10: 11.1, p25: 13.8, p50: 16.6, p75: 22.0, p90: 31.0 },
        36: { p10: 12.8, p25: 15.8, p50: 19.2, p75: 24.8, p90: 34.2 },
        37: { p10: 14.7, p25: 18.0, p50: 22.0, p75: 27.8, p90: 37.8 },
        38: { p10: 16.8, p25: 20.4, p50: 25.0, p75: 31.2, p90: 41.5 }
      },
      rocThresholds: { optimal: 65.00, s90: 66.40, s80: 65.40, s70: 64.50 },
      calibration: { mean: 62.0, std: 3.5 },
      improvement: { finalist_median: 4.0, finalist_std: 2.0, non_finalist_median: 1.9, non_finalist_std: 1.3 },
      clusters: [
        { name: 'Prime Peaker', pct_off_pb: [3.8, 2.2, 1.5, 1.0, 2.0, 3.2], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [7.5, 4.8, 3.0, 1.8, 2.5, 4.0], peakAge: 30 },
        { name: 'Consistent Performer', pct_off_pb: [5.2, 3.2, 2.0, 1.5, 2.2, 3.5], peakAge: 27 }
      ]
    },
    MHT: {
      percentiles: {
        15: { p10: 6.2, p25: 9.8, p50: 17.8, p75: 19.2, p90: 25.0 },
        16: { p10: 5.8, p25: 9.0, p50: 14.8, p75: 17.5, p90: 22.8 },
        17: { p10: 5.4, p25: 8.2, p50: 12.2, p75: 16.0, p90: 20.8 },
        18: { p10: 5.0, p25: 7.5, p50: 6.5, p75: 14.2, p90: 18.5 },
        19: { p10: 4.6, p25: 6.8, p50: 5.2, p75: 12.8, p90: 16.5 },
        20: { p10: 4.1, p25: 5.8, p50: 3.8, p75: 10.5, p90: 14.2 },
        21: { p10: 3.5, p25: 4.8, p50: 2.8, p75: 8.8, p90: 12.2 },
        22: { p10: 2.8, p25: 3.8, p50: 2.0, p75: 7.2, p90: 10.5 },
        23: { p10: 2.0, p25: 2.8, p50: 1.2, p75: 5.8, p90: 8.8 },
        24: { p10: 1.2, p25: 1.8, p50: 0.6, p75: 4.5, p90: 7.2 },
        25: { p10: 1.0, p25: 1.8, p50: 0.8, p75: 4.8, p90: 7.8 },
        26: { p10: 1.2, p25: 2.2, p50: 1.4, p75: 5.5, p90: 8.8 },
        27: { p10: 1.6, p25: 2.8, p50: 2.2, p75: 6.5, p90: 10.2 },
        28: { p10: 2.2, p25: 3.6, p50: 3.2, p75: 7.8, p90: 12.0 },
        29: { p10: 2.9, p25: 4.6, p50: 4.5, p75: 9.2, p90: 13.8 },
        30: { p10: 3.8, p25: 5.8, p50: 6.0, p75: 10.8, p90: 15.8 },
        31: { p10: 4.8, p25: 7.0, p50: 7.6, p75: 12.5, p90: 18.0 },
        32: { p10: 5.9, p25: 8.4, p50: 9.4, p75: 14.2, p90: 20.5 },
        33: { p10: 7.2, p25: 9.8, p50: 11.5, p75: 16.2, p90: 23.2 },
        34: { p10: 8.6, p25: 11.4, p50: 13.8, p75: 18.5, p90: 26.2 },
        35: { p10: 10.2, p25: 13.2, p50: 16.4, p75: 21.0, p90: 29.5 },
        36: { p10: 11.9, p25: 15.2, p50: 19.2, p75: 23.8, p90: 33.0 },
        37: { p10: 13.8, p25: 17.4, p50: 22.2, p75: 26.8, p90: 36.8 },
        38: { p10: 15.8, p25: 19.8, p50: 25.5, p75: 30.2, p90: 41.0 }
      },
      rocThresholds: { optimal: 79.00, s90: 80.60, s80: 79.40, s70: 78.50 },
      calibration: { mean: 76.0, std: 3.5 },
      improvement: { finalist_median: 4.0, finalist_std: 2.0, non_finalist_median: 1.9, non_finalist_std: 1.3 },
      clusters: [
        { name: 'Prime Peaker', pct_off_pb: [3.5, 2.0, 1.2, 0.8, 1.8, 3.0], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [7.2, 4.5, 2.8, 1.5, 2.2, 3.8], peakAge: 30 },
        { name: 'Consistent Performer', pct_off_pb: [5.0, 3.0, 1.8, 1.2, 2.0, 3.2], peakAge: 27 }
      ]
    },
    FHT: {
      percentiles: {
        15: { p10: 7.0, p25: 11.0, p50: 19.8, p75: 21.2, p90: 27.2 },
        16: { p10: 6.6, p25: 10.2, p50: 16.2, p75: 19.2, p90: 24.8 },
        17: { p10: 6.2, p25: 9.4, p50: 13.2, p75: 17.5, p90: 22.8 },
        18: { p10: 5.8, p25: 8.6, p50: 6.8, p75: 15.8, p90: 20.8 },
        19: { p10: 5.4, p25: 7.8, p50: 5.6, p75: 14.2, p90: 18.8 },
        20: { p10: 4.9, p25: 6.8, p50: 4.0, p75: 11.5, p90: 16.2 },
        21: { p10: 4.3, p25: 5.8, p50: 3.0, p75: 9.8, p90: 14.2 },
        22: { p10: 3.6, p25: 4.8, p50: 2.2, p75: 8.0, p90: 12.2 },
        23: { p10: 2.8, p25: 3.8, p50: 1.5, p75: 6.5, p90: 10.2 },
        24: { p10: 2.0, p25: 2.8, p50: 1.0, p75: 5.2, p90: 8.5 },
        25: { p10: 1.8, p25: 2.6, p50: 1.2, p75: 5.5, p90: 8.8 },
        26: { p10: 2.0, p25: 3.0, p50: 1.8, p75: 6.2, p90: 9.8 },
        27: { p10: 2.4, p25: 3.6, p50: 2.6, p75: 7.2, p90: 11.2 },
        28: { p10: 3.0, p25: 4.4, p50: 3.6, p75: 8.5, p90: 13.0 },
        29: { p10: 3.8, p25: 5.4, p50: 5.0, p75: 10.0, p90: 15.0 },
        30: { p10: 4.7, p25: 6.6, p50: 6.5, p75: 11.8, p90: 17.2 },
        31: { p10: 5.7, p25: 7.8, p50: 8.2, p75: 13.5, p90: 19.5 },
        32: { p10: 6.8, p25: 9.0, p50: 10.0, p75: 15.2, p90: 22.0 },
        33: { p10: 8.1, p25: 10.4, p50: 12.0, p75: 17.2, p90: 24.8 },
        34: { p10: 9.5, p25: 12.0, p50: 14.2, p75: 19.5, p90: 27.8 },
        35: { p10: 11.1, p25: 13.8, p50: 16.6, p75: 22.0, p90: 31.0 },
        36: { p10: 12.8, p25: 15.8, p50: 19.2, p75: 24.8, p90: 34.2 },
        37: { p10: 14.7, p25: 18.0, p50: 22.0, p75: 27.8, p90: 37.8 },
        38: { p10: 16.8, p25: 20.4, p50: 25.0, p75: 31.2, p90: 41.5 }
      },
      rocThresholds: { optimal: 75.00, s90: 76.50, s80: 75.40, s70: 74.50 },
      calibration: { mean: 72.0, std: 3.5 },
      improvement: { finalist_median: 4.0, finalist_std: 2.0, non_finalist_median: 1.9, non_finalist_std: 1.3 },
      clusters: [
        { name: 'Prime Peaker', pct_off_pb: [3.8, 2.2, 1.5, 1.0, 2.0, 3.2], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [7.5, 4.8, 3.0, 1.8, 2.5, 4.0], peakAge: 30 },
        { name: 'Consistent Performer', pct_off_pb: [5.2, 3.2, 2.0, 1.5, 2.2, 3.5], peakAge: 27 }
      ]
    },
    MSP: {
      percentiles: {
        15: { p10: 8.0, p25: 12.5, p50: 21.5, p75: 23.2, p90: 29.5 },
        16: { p10: 7.5, p25: 11.6, p50: 17.8, p75: 21.0, p90: 26.8 },
        17: { p10: 7.0, p25: 10.8, p50: 14.6, p75: 19.2, p90: 24.5 },
        18: { p10: 6.4, p25: 9.8, p50: 7.8, p75: 17.2, p90: 22.2 },
        19: { p10: 5.8, p25: 8.8, p50: 6.2, p75: 15.2, p90: 20.0 },
        20: { p10: 5.1, p25: 7.6, p50: 4.5, p75: 12.5, p90: 17.5 },
        21: { p10: 4.4, p25: 6.4, p50: 3.3, p75: 10.5, p90: 15.2 },
        22: { p10: 3.6, p25: 5.2, p50: 2.4, p75: 8.5, p90: 13.0 },
        23: { p10: 2.8, p25: 4.0, p50: 1.6, p75: 6.8, p90: 11.0 },
        24: { p10: 2.0, p25: 2.8, p50: 1.0, p75: 5.2, p90: 8.8 },
        25: { p10: 1.8, p25: 2.6, p50: 1.2, p75: 5.5, p90: 9.0 },
        26: { p10: 2.0, p25: 3.0, p50: 1.8, p75: 6.2, p90: 10.0 },
        27: { p10: 2.4, p25: 3.6, p50: 2.6, p75: 7.2, p90: 11.5 },
        28: { p10: 3.0, p25: 4.4, p50: 3.6, p75: 8.5, p90: 13.2 },
        29: { p10: 3.8, p25: 5.4, p50: 5.0, p75: 10.0, p90: 15.2 },
        30: { p10: 4.7, p25: 6.6, p50: 6.5, p75: 11.8, p90: 17.5 },
        31: { p10: 5.7, p25: 7.8, p50: 8.2, p75: 13.5, p90: 20.0 },
        32: { p10: 6.8, p25: 9.0, p50: 10.0, p75: 15.2, p90: 22.5 },
        33: { p10: 8.1, p25: 10.4, p50: 12.0, p75: 17.2, p90: 25.2 },
        34: { p10: 9.5, p25: 12.0, p50: 14.2, p75: 19.5, p90: 28.2 },
        35: { p10: 11.1, p25: 13.8, p50: 16.6, p75: 22.0, p90: 31.5 },
        36: { p10: 12.8, p25: 15.8, p50: 19.2, p75: 24.8, p90: 35.0 },
        37: { p10: 14.7, p25: 18.0, p50: 22.0, p75: 27.8, p90: 38.8 },
        38: { p10: 16.8, p25: 20.4, p50: 25.0, p75: 31.2, p90: 42.8 }
      },
      rocThresholds: { optimal: 21.50, s90: 22.05, s80: 21.65, s70: 21.25 },
      calibration: { mean: 20.0, std: 1.2 },
      improvement: { finalist_median: 3.8, finalist_std: 1.8, non_finalist_median: 1.8, non_finalist_std: 1.2 },
      clusters: [
        { name: 'Prime Peaker', pct_off_pb: [3.5, 2.0, 1.2, 0.8, 1.8, 3.0], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [7.2, 4.5, 2.8, 1.5, 2.2, 3.8], peakAge: 30 },
        { name: 'Consistent Performer', pct_off_pb: [5.0, 3.0, 1.8, 1.2, 2.0, 3.2], peakAge: 27 }
      ]
    },
    FSP: {
      percentiles: {
        15: { p10: 8.2, p25: 12.8, p50: 22.0, p75: 23.5, p90: 30.0 },
        16: { p10: 7.7, p25: 11.9, p50: 18.2, p75: 21.5, p90: 27.5 },
        17: { p10: 7.2, p25: 11.0, p50: 15.0, p75: 19.5, p90: 25.0 },
        18: { p10: 6.6, p25: 10.0, p50: 8.0, p75: 17.5, p90: 22.8 },
        19: { p10: 6.0, p25: 9.0, p50: 6.4, p75: 15.5, p90: 20.5 },
        20: { p10: 5.3, p25: 7.8, p50: 4.6, p75: 12.8, p90: 18.0 },
        21: { p10: 4.6, p25: 6.6, p50: 3.4, p75: 10.8, p90: 15.8 },
        22: { p10: 3.8, p25: 5.4, p50: 2.5, p75: 8.8, p90: 13.5 },
        23: { p10: 3.0, p25: 4.2, p50: 1.7, p75: 7.0, p90: 11.5 },
        24: { p10: 2.2, p25: 3.0, p50: 1.0, p75: 5.5, p90: 9.2 },
        25: { p10: 2.0, p25: 2.8, p50: 1.2, p75: 5.8, p90: 9.5 },
        26: { p10: 2.2, p25: 3.2, p50: 1.8, p75: 6.5, p90: 10.5 },
        27: { p10: 2.6, p25: 3.8, p50: 2.6, p75: 7.5, p90: 12.0 },
        28: { p10: 3.2, p25: 4.6, p50: 3.6, p75: 8.8, p90: 13.8 },
        29: { p10: 4.0, p25: 5.6, p50: 5.0, p75: 10.5, p90: 15.8 },
        30: { p10: 4.9, p25: 6.8, p50: 6.5, p75: 12.2, p90: 18.0 },
        31: { p10: 5.9, p25: 8.0, p50: 8.2, p75: 14.0, p90: 20.5 },
        32: { p10: 7.0, p25: 9.2, p50: 10.0, p75: 15.8, p90: 23.0 },
        33: { p10: 8.3, p25: 10.6, p50: 12.0, p75: 17.8, p90: 25.8 },
        34: { p10: 9.7, p25: 12.2, p50: 14.2, p75: 20.2, p90: 29.0 },
        35: { p10: 11.3, p25: 14.0, p50: 16.6, p75: 22.8, p90: 32.2 },
        36: { p10: 13.1, p25: 16.0, p50: 19.2, p75: 25.5, p90: 35.8 },
        37: { p10: 15.1, p25: 18.2, p50: 22.0, p75: 28.5, p90: 39.5 },
        38: { p10: 17.3, p25: 20.6, p50: 25.0, p75: 31.8, p90: 43.5 }
      },
      rocThresholds: { optimal: 19.50, s90: 20.00, s80: 19.65, s70: 19.25 },
      calibration: { mean: 18.5, std: 1.2 },
      improvement: { finalist_median: 3.6, finalist_std: 1.8, non_finalist_median: 1.7, non_finalist_std: 1.2 },
      clusters: [
        { name: 'Prime Peaker', pct_off_pb: [3.5, 2.0, 1.2, 0.8, 1.8, 3.0], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [7.2, 4.5, 2.8, 1.5, 2.2, 3.8], peakAge: 30 },
        { name: 'Consistent Performer', pct_off_pb: [5.0, 3.0, 1.8, 1.2, 2.0, 3.2], peakAge: 27 }
      ]
    },
    // ── 3000m STEEPLECHASE ──────────────────────────────────────────
    M3SC: {
      percentiles: {
        17: { p10: 2.46, p25: 4.59, p50: 9.28, p75: 11.47, p90: 13.95 },
        18: { p10: 1.50, p25: 4.48, p50: 7.75, p75: 11.20, p90: 12.32 },
        19: { p10: 1.25, p25: 3.33, p50: 5.86, p75: 8.28, p90: 10.07 },
        20: { p10: 0.99, p25: 2.29, p50: 4.48, p75: 6.60, p90: 8.44 },
        21: { p10: 0.26, p25: 1.59, p50: 3.35, p75: 5.17, p90: 6.86 },
        22: { p10: 0.14, p25: 1.17, p50: 2.75, p75: 4.56, p90: 6.13 },
        23: { p10: 0.00, p25: 0.97, p50: 1.92, p75: 3.54, p90: 5.31 },
        24: { p10: 0.00, p25: 1.06, p50: 2.04, p75: 3.57, p90: 5.66 },
        25: { p10: 0.23, p25: 0.73, p50: 1.60, p75: 2.87, p90: 4.83 },
        26: { p10: 0.00, p25: 0.35, p50: 1.33, p75: 2.84, p90: 4.85 },
        27: { p10: 0.00, p25: 0.46, p50: 1.49, p75: 2.65, p90: 4.98 },
        28: { p10: 0.00, p25: 0.49, p50: 1.56, p75: 2.54, p90: 4.91 },
        29: { p10: 0.12, p25: 0.77, p50: 1.69, p75: 2.56, p90: 4.70 },
        30: { p10: 0.09, p25: 0.76, p50: 1.88, p75: 3.20, p90: 6.20 },
        31: { p10: 0.00, p25: 0.62, p50: 1.96, p75: 3.40, p90: 5.36 },
        32: { p10: 0.43, p25: 1.03, p50: 1.76, p75: 3.62, p90: 6.57 },
        33: { p10: 0.24, p25: 1.25, p50: 2.47, p75: 4.60, p90: 8.10 },
        34: { p10: 0.64, p25: 1.67, p50: 3.36, p75: 5.25, p90: 7.31 },
        35: { p10: 1.13, p25: 1.47, p50: 2.88, p75: 5.18, p90: 6.45 }
      },
      rocThresholds: { optimal: 496.91, s90: 496.91, s80: 494.06, s70: 492.08 },
      calibration: { mean: 496.06, std: 12.25 },
      improvement: { finalist_median: -0.2678, finalist_std: 2.3779, non_finalist_median: -0.4789, non_finalist_std: 2.3779 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [3.8, 1.9, 1.3, 2.5, 3.8, 3.9], peakAge: 24 },
        { name: 'Standard', pct_off_pb: [8.5, 5.0, 2.7, 1.7, 1.1, 1.8], peakAge: 28 },
        { name: 'Late Developer', pct_off_pb: [9.8, 7.7, 5.8, 4.6, 2.7, 1.7], peakAge: 29 }
      ]
    },
    F3SC: {
      percentiles: {
        17: { p10: 4.12, p25: 7.33, p50: 11.20, p75: 14.99, p90: 16.15 },
        18: { p10: 4.69, p25: 5.57, p50: 8.19, p75: 12.90, p90: 18.13 },
        19: { p10: 3.47, p25: 4.88, p50: 7.43, p75: 11.27, p90: 15.43 },
        20: { p10: 0.92, p25: 3.73, p50: 6.74, p75: 10.26, p90: 14.65 },
        21: { p10: 0.33, p25: 1.89, p50: 5.23, p75: 9.25, p90: 12.87 },
        22: { p10: 0.05, p25: 1.58, p50: 3.93, p75: 7.35, p90: 10.92 },
        23: { p10: 0.00, p25: 0.89, p50: 2.99, p75: 5.92, p90: 8.88 },
        24: { p10: 0.00, p25: 1.42, p50: 2.86, p75: 5.19, p90: 7.64 },
        25: { p10: 0.00, p25: 0.89, p50: 2.42, p75: 4.20, p90: 6.59 },
        26: { p10: 0.02, p25: 0.71, p50: 1.84, p75: 3.89, p90: 6.43 },
        27: { p10: 0.00, p25: 0.51, p50: 1.76, p75: 3.60, p90: 6.07 },
        28: { p10: 0.00, p25: 0.64, p50: 1.85, p75: 3.71, p90: 6.53 },
        29: { p10: 0.00, p25: 1.12, p50: 2.14, p75: 3.66, p90: 6.05 },
        30: { p10: 0.00, p25: 0.75, p50: 2.20, p75: 4.67, p90: 7.22 },
        31: { p10: 0.00, p25: 0.89, p50: 2.25, p75: 4.04, p90: 6.45 },
        32: { p10: 0.00, p25: 1.03, p50: 2.55, p75: 4.55, p90: 6.94 },
        33: { p10: 0.00, p25: 1.19, p50: 2.11, p75: 5.30, p90: 6.25 },
        34: { p10: 0.00, p25: 0.31, p50: 2.07, p75: 4.78, p90: 5.94 },
        35: { p10: 0.47, p25: 1.85, p50: 2.57, p75: 5.92, p90: 7.94 }
      },
      rocThresholds: { optimal: 566.32, s90: 566.32, s80: 559.27, s70: 556.89 },
      calibration: { mean: 562.09, std: 14.09 },
      improvement: { finalist_median: -0.8339, finalist_std: 3.018, non_finalist_median: -0.7536, non_finalist_std: 3.018 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [8.7, 5.1, 2.3, 2.3, 2.0, 2.4], peakAge: 24 },
        { name: 'Standard', pct_off_pb: [10.8, 15.9, 10.8, 8.9, 6.3, 2.8], peakAge: 22 },
        { name: 'Late Developer', pct_off_pb: [12.5, 9.9, 5.4, 3.2, 2.1, 1.5], peakAge: 29 }
      ]
    },
    // ── 5000m ────────────────────────────────────────────────────────
    M5K: {
      percentiles: {
        17: { p10: 1.10, p25: 2.66, p50: 4.47, p75: 8.29, p90: 14.05 },
        18: { p10: 0.61, p25: 1.49, p50: 4.84, p75: 7.73, p90: 10.72 },
        19: { p10: 0.41, p25: 1.54, p50: 3.53, p75: 6.43, p90: 8.52 },
        20: { p10: 0.00, p25: 1.38, p50: 3.31, p75: 5.91, p90: 8.32 },
        21: { p10: 0.00, p25: 1.23, p50: 3.18, p75: 5.43, p90: 8.37 },
        22: { p10: 0.05, p25: 1.01, p50: 2.80, p75: 4.98, p90: 6.91 },
        23: { p10: 0.00, p25: 0.98, p50: 1.99, p75: 3.52, p90: 6.12 },
        24: { p10: 0.00, p25: 0.95, p50: 2.09, p75: 3.16, p90: 5.30 },
        25: { p10: 0.00, p25: 0.52, p50: 1.41, p75: 2.54, p90: 4.45 },
        26: { p10: 0.00, p25: 0.60, p50: 1.70, p75: 3.05, p90: 5.07 },
        27: { p10: 0.00, p25: 0.65, p50: 1.93, p75: 3.04, p90: 4.59 },
        28: { p10: 0.00, p25: 0.29, p50: 1.93, p75: 3.55, p90: 5.46 },
        29: { p10: 0.00, p25: 0.57, p50: 1.98, p75: 3.93, p90: 5.83 },
        30: { p10: 0.00, p25: 0.42, p50: 1.93, p75: 3.06, p90: 4.12 },
        31: { p10: 0.00, p25: 0.80, p50: 2.28, p75: 3.81, p90: 6.18 },
        32: { p10: 0.00, p25: 1.22, p50: 2.72, p75: 5.55, p90: 7.30 },
        33: { p10: 0.46, p25: 1.58, p50: 3.41, p75: 4.78, p90: 7.13 },
        34: { p10: 0.17, p25: 1.60, p50: 2.86, p75: 5.57, p90: 6.88 },
        35: { p10: 0.41, p25: 0.97, p50: 3.60, p75: 4.10, p90: 8.23 },
        36: { p10: 0.59, p25: 1.62, p50: 2.14, p75: 3.81, p90: 5.70 },
        37: { p10: 0.74, p25: 2.65, p50: 5.25, p75: 6.26, p90: 6.92 }
      },
      rocThresholds: { optimal: 783.87, s90: 795.19, s80: 789.17, s70: 783.53 },
      calibration: { mean: 793.86, std: 36.15 },
      improvement: { finalist_median: -0.3222, finalist_std: 2.9798, non_finalist_median: -0.3241, non_finalist_std: 2.9798 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [4.3, 2.3, 1.6, 2.1, 2.4, 2.6], peakAge: 24 },
        { name: 'Standard', pct_off_pb: [6.6, 6.1, 5.0, 2.2, 1.5, 2.2], peakAge: 22 },
        { name: 'Late Developer', pct_off_pb: [15.0, 6.6, 4.9, 3.0, 2.5, 1.3], peakAge: 29 }
      ]
    },
    F5K: {
      percentiles: {
        17: { p10: 1.35, p25: 3.32, p50: 5.90, p75: 9.55, p90: 13.67 },
        18: { p10: 1.40, p25: 2.82, p50: 6.59, p75: 10.23, p90: 13.90 },
        19: { p10: 0.99, p25: 2.57, p50: 5.66, p75: 8.19, p90: 11.10 },
        20: { p10: 0.14, p25: 1.59, p50: 4.88, p75: 8.47, p90: 11.76 },
        21: { p10: 0.14, p25: 1.67, p50: 4.14, p75: 6.05, p90: 8.89 },
        22: { p10: 0.00, p25: 1.19, p50: 2.88, p75: 6.05, p90: 9.06 },
        23: { p10: 0.00, p25: 0.63, p50: 2.55, p75: 4.85, p90: 7.52 },
        24: { p10: 0.00, p25: 0.85, p50: 2.48, p75: 5.06, p90: 7.29 },
        25: { p10: 0.00, p25: 0.94, p50: 2.31, p75: 3.62, p90: 5.20 },
        26: { p10: 0.00, p25: 0.75, p50: 2.04, p75: 3.25, p90: 5.20 },
        27: { p10: 0.00, p25: 0.95, p50: 2.30, p75: 3.83, p90: 5.79 },
        28: { p10: 0.02, p25: 0.70, p50: 1.72, p75: 3.74, p90: 5.78 },
        29: { p10: 0.00, p25: 0.23, p50: 1.81, p75: 3.31, p90: 6.19 },
        30: { p10: 0.00, p25: 0.08, p50: 1.55, p75: 3.28, p90: 6.47 },
        31: { p10: 0.12, p25: 0.92, p50: 1.88, p75: 3.98, p90: 5.84 },
        32: { p10: 0.00, p25: 0.90, p50: 2.45, p75: 5.71, p90: 8.80 },
        33: { p10: 0.00, p25: 1.00, p50: 2.82, p75: 5.46, p90: 7.65 },
        34: { p10: 0.17, p25: 1.39, p50: 2.29, p75: 4.35, p90: 6.24 },
        35: { p10: 1.07, p25: 2.42, p50: 3.90, p75: 6.86, p90: 8.19 },
        36: { p10: 1.85, p25: 2.42, p50: 4.96, p75: 8.47, p90: 9.61 },
        37: { p10: 1.76, p25: 2.21, p50: 5.16, p75: 8.99, p90: 11.71 },
        38: { p10: 1.60, p25: 3.47, p50: 5.56, p75: 9.09, p90: 11.85 },
        39: { p10: 0.51, p25: 1.93, p50: 6.24, p75: 11.07, p90: 16.58 }
      },
      rocThresholds: { optimal: 894.29, s90: 905.26, s80: 894.29, s70: 886.72 },
      calibration: { mean: 908.46, std: 41.83 },
      improvement: { finalist_median: -0.3845, finalist_std: 3.3219, non_finalist_median: -0.3896, non_finalist_std: 3.3219 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [5.7, 2.2, 2.0, 1.7, 1.8, 3.2], peakAge: 24 },
        { name: 'Standard', pct_off_pb: [8.6, 5.8, 4.5, 3.9, 2.1, 2.3], peakAge: 23 },
        { name: 'Late Developer', pct_off_pb: [11.5, 11.7, 6.4, 3.2, 2.4, 3.4], peakAge: 22 }
      ]
    },
    // ── 10000m ───────────────────────────────────────────────────────
    M10K: {
      percentiles: {
        17: { p10: 1.04, p25: 2.67, p50: 4.11, p75: 6.66, p90: 6.70 },
        18: { p10: 0.85, p25: 1.63, p50: 2.73, p75: 5.07, p90: 8.96 },
        19: { p10: 0.13, p25: 2.06, p50: 3.76, p75: 6.14, p90: 9.66 },
        20: { p10: 0.00, p25: 0.81, p50: 2.03, p75: 4.35, p90: 7.14 },
        21: { p10: 0.00, p25: 0.73, p50: 1.98, p75: 4.74, p90: 6.18 },
        22: { p10: 0.00, p25: 0.28, p50: 1.36, p75: 3.04, p90: 5.42 },
        23: { p10: 0.03, p25: 0.95, p50: 1.89, p75: 3.01, p90: 6.22 },
        24: { p10: 0.00, p25: 0.23, p50: 1.57, p75: 3.19, p90: 4.61 },
        25: { p10: 0.00, p25: 0.35, p50: 1.30, p75: 2.53, p90: 4.98 },
        26: { p10: 0.00, p25: 0.31, p50: 1.58, p75: 2.66, p90: 5.07 },
        27: { p10: 0.00, p25: 0.57, p50: 1.29, p75: 2.64, p90: 3.53 },
        28: { p10: 0.00, p25: 0.71, p50: 1.31, p75: 3.23, p90: 6.21 },
        29: { p10: 0.00, p25: 0.82, p50: 1.52, p75: 3.56, p90: 6.86 },
        30: { p10: 0.00, p25: 0.41, p50: 1.53, p75: 2.91, p90: 3.55 },
        31: { p10: 0.00, p25: 0.23, p50: 1.97, p75: 4.55, p90: 6.38 },
        32: { p10: 0.25, p25: 0.71, p50: 2.16, p75: 4.19, p90: 6.95 },
        33: { p10: 0.69, p25: 1.49, p50: 2.67, p75: 4.87, p90: 6.99 },
        34: { p10: 1.00, p25: 1.71, p50: 3.17, p75: 4.78, p90: 6.06 },
        35: { p10: 1.87, p25: 2.23, p50: 3.59, p75: 4.68, p90: 7.91 },
        36: { p10: 2.57, p25: 3.19, p50: 4.57, p75: 4.77, p90: 9.31 },
        38: { p10: 2.90, p25: 3.32, p50: 3.76, p75: 6.35, p90: 6.97 }
      },
      rocThresholds: { optimal: 1642.44, s90: 1715.75, s80: 1715.75, s70: 1715.75 },
      calibration: { mean: 1639.92, std: 26.66 },
      improvement: { finalist_median: -0.1018, finalist_std: 3.1705, non_finalist_median: 0.1125, non_finalist_std: 3.1705 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [4.2, 2.5, 0.7, 2.8, 4.7, 2.6], peakAge: 24 },
        { name: 'Standard', pct_off_pb: [2.9, 1.7, 1.0, 0.8, 1.6, 2.2], peakAge: 26 },
        { name: 'Late Developer', pct_off_pb: [5.2, 3.9, 3.4, 3.2, 1.0, 1.1], peakAge: 26 }
      ]
    },
    F10K: {
      percentiles: {
        17: { p10: 1.11, p25: 4.19, p50: 9.43, p75: 15.31, p90: 19.02 },
        18: { p10: 0.52, p25: 1.75, p50: 6.25, p75: 7.95, p90: 10.60 },
        19: { p10: 1.07, p25: 2.29, p50: 5.64, p75: 8.58, p90: 13.26 },
        20: { p10: 0.00, p25: 1.54, p50: 3.61, p75: 7.32, p90: 11.45 },
        21: { p10: 0.00, p25: 0.97, p50: 4.02, p75: 6.73, p90: 7.89 },
        22: { p10: 0.73, p25: 1.45, p50: 3.72, p75: 6.08, p90: 7.80 },
        23: { p10: 0.00, p25: 0.62, p50: 2.41, p75: 4.09, p90: 7.27 },
        24: { p10: 0.00, p25: 0.27, p50: 2.06, p75: 4.47, p90: 6.76 },
        25: { p10: 0.00, p25: 0.96, p50: 2.31, p75: 4.80, p90: 6.73 },
        26: { p10: 0.00, p25: 0.60, p50: 1.72, p75: 3.91, p90: 5.67 },
        27: { p10: 0.00, p25: 0.27, p50: 2.13, p75: 3.80, p90: 6.26 },
        28: { p10: 0.00, p25: 0.62, p50: 1.87, p75: 4.08, p90: 6.59 },
        29: { p10: 0.00, p25: 0.23, p50: 1.69, p75: 3.74, p90: 5.72 },
        30: { p10: 0.00, p25: 0.60, p50: 1.60, p75: 4.28, p90: 7.09 },
        31: { p10: 0.00, p25: 0.28, p50: 1.97, p75: 3.80, p90: 5.76 },
        32: { p10: 0.00, p25: 0.99, p50: 2.65, p75: 3.94, p90: 5.31 },
        33: { p10: 0.00, p25: 0.98, p50: 2.30, p75: 4.80, p90: 6.42 },
        34: { p10: 0.00, p25: 1.28, p50: 3.33, p75: 5.66, p90: 7.83 },
        35: { p10: 0.25, p25: 0.78, p50: 3.81, p75: 5.79, p90: 9.34 },
        36: { p10: 0.58, p25: 2.15, p50: 3.68, p75: 6.25, p90: 8.09 },
        37: { p10: 1.61, p25: 2.54, p50: 4.48, p75: 5.93, p90: 6.27 },
        38: { p10: 0.00, p25: 1.05, p50: 3.40, p75: 6.56, p90: 10.78 },
        39: { p10: 2.23, p25: 5.03, p50: 6.95, p75: 10.14, p90: 11.09 },
        40: { p10: 4.02, p25: 4.20, p50: 5.92, p75: 9.08, p90: 13.53 },
        41: { p10: 3.35, p25: 5.16, p50: 7.75, p75: 7.99, p90: 9.37 }
      },
      rocThresholds: { optimal: 1868.89, s90: 2048.79, s80: 1906.94, s70: 1896.54 },
      calibration: { mean: 1863.83, std: 45.31 },
      improvement: { finalist_median: -0.1435, finalist_std: 3.6977, non_finalist_median: -0.062, non_finalist_std: 3.6977 },
      clusters: [
        { name: 'Early Peaker', pct_off_pb: [7.1, 3.1, 1.9, 2.6, 1.6, 1.6], peakAge: 24 },
        { name: 'Standard', pct_off_pb: [8.5, 6.5, 5.5, 2.7, 2.1, 2.1], peakAge: 24 },
        { name: 'Late Developer', pct_off_pb: [7.8, 21.4, 10.3, 4.9, 1.9, 0.0], peakAge: 22 }
      ]
    }

  };

  // ═══════════════════════════════════════════════════════════════════
  // COMPETITION STANDARDS — Per-competition data with tier grouping
  // Sources: Paris 2024 Olympics, World Champs Tokyo 2025, Asian Champs Gumi 2025,
  //          World U20 Lima 2024, NCAA Outdoor 2025, World Records as of Apr 2026
  // Tiers: world (Olympics/Worlds), regional (Asian), development (U20/NCAA)
  // Age groups: senior, u20
  // ═══════════════════════════════════════════════════════════════════
  const COMPETITION_STANDARDS = {
    M100: {
      wr: { mark: 9.58, holder: 'Usain Bolt', year: 2009 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 10.00, gold: 9.784, bronze: 9.81, p8: 9.91, semi: 9.95 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 10.00, gold: 9.77, bronze: 9.89, p8: 10.04, semi: 10.12 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 10.07, bronze: 10.22, p8: 10.45, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 10.19, bronze: 10.26, p8: 10.51, semi: 10.58 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 10.07, bronze: 10.10, p8: 10.24, semi: 10.38 },
      ],
    },
    F100: {
      wr: { mark: 10.49, holder: 'Florence Griffith-Joyner', year: 1988 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 11.07, gold: 10.72, bronze: 10.87, p8: 11.07, semi: 11.10 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 11.07, gold: 10.61, bronze: 10.84, p8: 11.06, semi: 11.08 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 11.37, bronze: 11.54, p8: 11.85, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 11.08, bronze: 11.17, p8: 11.45, semi: 11.55 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 10.87, bronze: 11.02, p8: 11.25, semi: 11.35 },
      ],
    },
    M200: {
      wr: { mark: 19.19, holder: 'Usain Bolt', year: 2009 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 20.16, gold: 19.46, bronze: 19.70, p8: 20.28, semi: 20.42 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 20.16, gold: 19.52, bronze: 19.64, p8: 20.23, semi: 20.55 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 20.12, bronze: 20.40, p8: 20.90, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 20.52, bronze: 20.81, p8: 21.30, semi: 21.55 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 19.84, bronze: 19.96, p8: 20.55, semi: 20.75 },
      ],
    },
    F200: {
      wr: { mark: 21.34, holder: 'Florence Griffith-Joyner', year: 1988 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 22.57, gold: 21.83, bronze: 22.20, p8: 22.72, semi: 22.85 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 22.57, gold: 21.68, bronze: 22.18, p8: 22.78, semi: 22.95 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 22.97, bronze: 23.00, p8: 23.60, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 22.55, bronze: 22.80, p8: 23.40, semi: 23.65 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 21.98, bronze: 22.25, p8: 22.80, semi: 23.00 },
      ],
    },
    M400: {
      wr: { mark: 43.03, holder: 'Wayde van Niekerk', year: 2016 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 45.00, gold: 43.40, bronze: 44.15, p8: 44.77, semi: 44.95 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 45.00, gold: 43.53, bronze: 44.20, p8: 44.77, semi: 44.95 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 45.33, bronze: 45.55, p8: 46.50, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 45.69, bronze: 46.30, p8: 47.10, semi: 47.40 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 44.84, bronze: 45.75, p8: 46.17, semi: 46.50 },
      ],
    },
    F400: {
      wr: { mark: 47.60, holder: 'Marita Koch', year: 1985 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 50.95, gold: 48.17, bronze: 49.15, p8: 50.40, semi: 50.60 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 50.75, gold: 47.78, bronze: 48.19, p8: 49.97, semi: 50.30 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 52.17, bronze: 52.79, p8: 54.20, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 50.55, bronze: 51.85, p8: 52.80, semi: 53.10 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 49.62, bronze: 50.15, p8: 51.20, semi: 51.50 },
      ],
    },
    M110H: {
      wr: { mark: 12.80, holder: 'Aries Merritt', year: 2012 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 13.27, gold: 12.99, bronze: 13.16, p8: 13.50, semi: 13.55 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 13.27, gold: 12.99, bronze: 13.12, p8: 13.42, semi: 13.40 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 13.22, bronze: 13.45, p8: 13.85, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 13.12, bronze: 13.32, p8: 13.68, semi: 13.80 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 13.05, bronze: 13.28, p8: 13.65, semi: 13.80 },
      ],
    },
    F100H: {
      wr: { mark: 12.12, holder: 'Tobi Amusan', year: 2022 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 12.77, gold: 12.33, bronze: 12.43, p8: 12.75, semi: 12.80 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 12.73, gold: 12.24, bronze: 12.34, p8: 12.56, semi: 12.62 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 12.96, bronze: 13.07, p8: 13.40, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 12.82, bronze: 12.96, p8: 13.25, semi: 13.35 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 12.81, bronze: 12.98, p8: 13.20, semi: 13.35 },
      ],
    },
    M400H: {
      wr: { mark: 45.94, holder: 'Karsten Warholm', year: 2021 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 48.70, gold: 46.46, bronze: 47.26, p8: 48.50, semi: 48.70 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 48.70, gold: 46.52, bronze: 47.06, p8: 48.30, semi: 48.60 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 48.00, bronze: 48.80, p8: 50.30, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 49.26, bronze: 49.80, p8: 51.20, semi: 51.60 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 47.49, bronze: 48.66, p8: 50.83, semi: 51.20 },
      ],
    },
    F400H: {
      wr: { mark: 50.37, holder: 'Sydney McLaughlin-Levrone', year: 2024 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 54.85, gold: 50.37, bronze: 52.71, p8: 54.60, semi: 54.90 },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 54.65, gold: 51.54, bronze: 53.00, p8: 56.27, semi: 56.80 },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 55.31, bronze: 56.46, p8: 58.50, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 55.59, bronze: 56.50, p8: 58.20, semi: 58.80 },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 52.46, bronze: 53.50, p8: 55.20, semi: 55.80 },
      ],
    },
    MSP: {
      wr: { mark: 23.56, holder: 'Ryan Crouser', year: 2023 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 21.50, gold: 22.90, bronze: 22.36, p8: 21.70, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 21.50, gold: 22.34, bronze: 21.94, p8: 21.30, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 19.25, bronze: 18.90, p8: 18.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 21.56, bronze: 20.80, p8: 19.80, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 21.95, bronze: 21.50, p8: 20.80, semi: null },
      ],
    },
    FSP: {
      wr: { mark: 22.63, holder: 'Natalya Lisovskaya', year: 1987 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 18.80, gold: 20.28, bronze: 19.72, p8: 18.85, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 18.80, gold: 20.29, bronze: 20.06, p8: 19.40, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 18.26, bronze: 17.90, p8: 17.20, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 18.35, bronze: 17.80, p8: 16.90, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 19.60, bronze: 19.00, p8: 18.30, semi: null },
      ],
    },
    MDT: {
      wr: { mark: 74.08, holder: 'Jürgen Schult', year: 1986 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 66.00, gold: 70.00, bronze: 67.56, p8: 63.90, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 67.50, gold: 70.47, bronze: 66.96, p8: 63.07, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 63.47, bronze: 61.50, p8: 57.80, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 68.50, bronze: 65.20, p8: 61.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 68.80, bronze: 66.50, p8: 63.00, semi: null },
      ],
    },
    FDT: {
      wr: { mark: 76.80, holder: 'Gabriele Reinsch', year: 1988 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 62.00, gold: 69.50, bronze: 65.37, p8: 62.20, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 64.50, gold: 69.48, bronze: 67.20, p8: 63.90, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 61.50, bronze: 59.00, p8: 55.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 64.20, bronze: 61.00, p8: 57.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 65.82, bronze: 63.50, p8: 60.80, semi: null },
      ],
    },
    MJT: {
      wr: { mark: 98.48, holder: 'Jan Železný', year: 1996 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 85.50, gold: 92.97, bronze: 87.17, p8: 82.30, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 85.50, gold: 88.16, bronze: 86.20, p8: 81.00, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 86.40, bronze: 83.75, p8: 79.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 81.50, bronze: 78.00, p8: 73.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 82.00, bronze: 79.00, p8: 74.00, semi: null },
      ],
    },
    FJT: {
      wr: { mark: 72.28, holder: 'Barbora Špotáková', year: 2008 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 62.00, gold: 67.38, bronze: 64.73, p8: 61.50, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 64.00, gold: 65.12, bronze: 63.58, p8: 60.50, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 63.29, bronze: 58.94, p8: 55.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 62.50, bronze: 60.00, p8: 56.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 63.50, bronze: 61.50, p8: 58.00, semi: null },
      ],
    },
    MHT: {
      wr: { mark: 86.74, holder: 'Yuriy Sedykh', year: 1986 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 78.20, gold: 84.12, bronze: 81.79, p8: 78.40, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 78.20, gold: 84.70, bronze: 82.69, p8: 77.15, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 74.50, bronze: 71.50, p8: 67.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 79.50, bronze: 76.00, p8: 72.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 76.50, bronze: 74.00, p8: 70.00, semi: null },
      ],
    },
    FHT: {
      wr: { mark: 82.98, holder: 'Anita Włodarczyk', year: 2016 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 72.50, gold: 76.97, bronze: 74.35, p8: 72.60, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 74.00, gold: 80.51, bronze: 77.10, p8: 71.59, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 72.98, bronze: 64.25, p8: 60.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 72.00, bronze: 68.00, p8: 63.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 74.50, bronze: 72.00, p8: 68.50, semi: null },
      ],
    },
    // ── DISTANCE: 3000m STEEPLECHASE ────────────────────────────────
    M3SC: {
      wr: { mark: 472.11, holder: 'Lamecha Girma', year: 2023 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 495.00, gold: 486.05, bronze: 486.47, p8: 491.72, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 495.00, gold: 513.88, bronze: 514.56, p8: 519.00, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 500.92, bronze: 508.00, p8: 530.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 495.28, bronze: 504.08, p8: 515.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 496.41, bronze: 501.00, p8: 512.00, semi: null },
      ],
    },
    F3SC: {
      wr: { mark: 524.32, holder: 'Beatrice Chepkoech', year: 2018 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 563.00, gold: 532.76, bronze: 535.00, p8: 548.00, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 558.00, gold: 531.59, bronze: 538.86, p8: 550.00, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 550.46, bronze: 552.46, p8: 575.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 552.71, bronze: 560.00, p8: 580.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 538.15, bronze: 555.00, p8: 570.00, semi: null },
      ],
    },
    // ── DISTANCE: 5000m ─────────────────────────────────────────────
    M5K: {
      wr: { mark: 755.36, holder: 'Joshua Cheptegei', year: 2020 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 785.00, gold: 793.66, bronze: 795.13, p8: 798.10, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 781.00, gold: 778.38, bronze: 779.33, p8: 780.79, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 804.77, bronze: 805.06, p8: 825.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 790.00, bronze: 800.00, p8: 830.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 800.59, bronze: 801.00, p8: 815.00, semi: null },
      ],
    },
    F5K: {
      wr: { mark: 840.21, holder: 'Gudaf Tsegay', year: 2023 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 900.00, gold: 868.56, bronze: 871.64, p8: 885.21, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 890.00, gold: 894.36, bronze: 895.42, p8: 901.25, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 920.00, bronze: 935.00, p8: 965.00, semi: null },
        { id: 'u20wc24', label: 'World U20 2024', tier: 'development', ageGroup: 'u20', color: '#A259FF', qual: null, gold: 879.71, bronze: 895.00, p8: 920.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 933.96, bronze: 945.00, p8: 965.00, semi: null },
      ],
    },
    // ── DISTANCE: 10000m ────────────────────────────────────────────
    M10K: {
      wr: { mark: 1571.00, holder: 'Joshua Cheptegei', year: 2020 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 1620.00, gold: 1603.14, bronze: 1603.46, p8: 1610.00, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 1620.00, gold: 1735.77, bronze: 1736.02, p8: 1750.00, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 1695.00, bronze: 1725.00, p8: 1770.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 1680.00, bronze: 1700.00, p8: 1730.00, semi: null },
      ],
    },
    F10K: {
      wr: { mark: 1734.14, holder: 'Beatrice Chebet', year: 2024 },
      competitions: [
        { id: 'oly24', label: 'Olympics 2024', tier: 'world', ageGroup: 'senior', color: '#FFD700', qual: 1840.00, gold: 1843.25, bronze: 1844.12, p8: 1849.98, semi: null },
        { id: 'wch25', label: 'Worlds 2025', tier: 'world', ageGroup: 'senior', color: '#E87D2A', qual: 1820.00, gold: 1837.61, bronze: 1839.65, p8: 1881.67, semi: null },
        { id: 'asian25', label: 'Asian Champs 2025', tier: 'regional', ageGroup: 'senior', color: '#E84545', qual: null, gold: 1890.00, bronze: 1920.00, p8: 1980.00, semi: null },
        { id: 'ncaa25', label: 'NCAA D1 2025', tier: 'development', ageGroup: 'senior', color: '#43C6AC', qual: null, gold: 1877.82, bronze: 1905.00, p8: 1950.00, semi: null },
      ],
    },
  };

  // Helper: flatten competition standards into legacy format for backward compat
  const getStandardsFlat = (eventCode) => {
    const data = COMPETITION_STANDARDS[eventCode];
    if (!data) return [];
    const isThrows = THROWS_CODES.includes(eventCode);
    // Build a flat list sorted hardest → easiest
    const flat = [];
    const comps = data.competitions.sort((a, b) => {
      // Sort by tier priority: world > regional > development
      const tierOrder = { world: 0, regional: 1, development: 2 };
      return (tierOrder[a.tier] || 3) - (tierOrder[b.tier] || 3);
    });
    for (const comp of comps) {
      if (comp.qual !== null) flat.push({ tier: 'QUAL', label: `${comp.label} Entry Std`, time: comp.qual, source: comp.label, color: comp.color, compId: comp.id, compTier: comp.tier, ageGroup: comp.ageGroup });
      flat.push({ tier: 'GOLD', label: `${comp.label} Gold`, time: comp.gold, source: comp.label, color: comp.color, compId: comp.id, compTier: comp.tier, ageGroup: comp.ageGroup });
      flat.push({ tier: 'MEDAL', label: `${comp.label} Bronze`, time: comp.bronze, source: comp.label, color: comp.color, compId: comp.id, compTier: comp.tier, ageGroup: comp.ageGroup });
      flat.push({ tier: 'FINAL', label: `${comp.label} 8th`, time: comp.p8, source: comp.label, color: comp.color, compId: comp.id, compTier: comp.tier, ageGroup: comp.ageGroup });
    }
    // Sort: for track (lower is better), hardest first ascending; for throws, hardest first descending
    flat.sort((a, b) => isThrows ? b.time - a.time : a.time - b.time);
    return flat;
  };


  // SIMILAR_ATHLETES data now served from Supabase via /api/v1/similar-athletes


  // Logistic regression coefficients from our statistical analysis
  const MODEL_COEFS = {
    best_18_20_z: -1.303,
    pct_rank: -0.245,
    improv_z: 0.060,
    consist_z: 0.032,
    races_z: -0.055,
    intercept: 0.0
  };

  // Logistic regression coefficients for throws disciplines
  const THROWS_MODEL_COEFS = {
    best_18_20_z: 1.560,
    pct_rank: -0.875,
    improv_z: 0.060,
    consist_z: 0.032,
    races_z: -0.055,
    intercept: -1.830
  };

  const getEventCode = (discipline, gender) => {
    const genderCode = gender === 'Male' ? 'M' : 'F';
    if (discipline === '100m') return `${genderCode}100`;
    if (discipline === '200m') return `${genderCode}200`;
    if (discipline === '400m') return `${genderCode}400`;
    if (discipline === '100mH') return 'F100H';
    if (discipline === '110mH') return 'M110H';
    if (discipline === '400mH') return `${genderCode}400H`;
    if (discipline === 'Discus Throw') return `${genderCode}DT`;
    if (discipline === 'Javelin Throw') return `${genderCode}JT`;
    if (discipline === 'Hammer Throw') return `${genderCode}HT`;
    if (discipline === 'Shot Put') return `${genderCode}SP`;
    if (discipline === '3000m Steeplechase') return `${genderCode}3SC`;
    if (discipline === '5000m') return `${genderCode}5K`;
    if (discipline === '10000m') return `${genderCode}10K`;
    throw new Error(`Unknown discipline: ${discipline}`);
  };

  // ═══════════════════════════════════════════════════════════════════
  // CHAMPIONSHIP DATA (from Podiums sheet — avg times from 2016/2020/2024)
  // ═══════════════════════════════════════════════════════════════════
  const CHAMPIONSHIP_DATA = {
    M100: { gold: 9.80, silver: 9.84, bronze: 9.87, mqt: 10.00, asianGold: 10.11, u20Gold: 10.10 },
    F100: { gold: 10.68, silver: 10.83, bronze: 10.86, mqt: 11.18, asianGold: 11.25, u20Gold: 11.07 },
    M200: { gold: 19.62, silver: 19.77, bronze: 19.85, mqt: 20.30, asianGold: 20.23, u20Gold: 20.24 },
    F200: { gold: 21.71, silver: 21.92, bronze: 22.01, mqt: 22.64, asianGold: 22.77, u20Gold: 22.41 },
    M400: { gold: 43.61, silver: 44.10, bronze: 44.19, mqt: 45.00, asianGold: 45.06, u20Gold: 45.18 },
    F400: { gold: 48.25, silver: 49.08, bronze: 49.42, mqt: 50.95, asianGold: 52.24, u20Gold: 51.45 },
    M110H: { gold: 13.00, silver: 13.09, bronze: 13.15, mqt: 13.47, asianGold: 13.50, u20Gold: 13.40 },
    F100H: { gold: 12.30, silver: 12.42, bronze: 12.50, mqt: 12.92, asianGold: 13.10, u20Gold: 12.90 },
    M400H: { gold: 46.60, silver: 47.20, bronze: 47.50, mqt: 49.00, asianGold: 50.74, u20Gold: 49.67 },
    F400H: { gold: 51.65, silver: 52.33, bronze: 52.63, mqt: 55.48, asianGold: 56.80, u20Gold: 56.23 },
    MDT: { gold: 68.5, silver: 67.2, bronze: 66.0, mqt: 66.0, asianGold: 64.5, u20Gold: 61.0 },
    FDT: { gold: 66.0, silver: 64.8, bronze: 63.5, mqt: 63.5, asianGold: 61.0, u20Gold: 58.0 },
    MJT: { gold: 89.0, silver: 87.5, bronze: 86.0, mqt: 85.5, asianGold: 83.0, u20Gold: 80.0 },
    FJT: { gold: 66.0, silver: 64.8, bronze: 63.5, mqt: 63.5, asianGold: 61.0, u20Gold: 58.0 },
    MHT: { gold: 80.0, silver: 78.5, bronze: 77.0, mqt: 77.0, asianGold: 74.5, u20Gold: 71.0 },
    FHT: { gold: 76.0, silver: 74.2, bronze: 72.5, mqt: 72.5, asianGold: 69.5, u20Gold: 66.0 },
    MSP: { gold: 22.0, silver: 21.5, bronze: 21.1, mqt: 21.1, asianGold: 20.2, u20Gold: 19.0 },
    FSP: { gold: 20.0, silver: 19.3, bronze: 18.8, mqt: 18.8, asianGold: 17.5, u20Gold: 16.5 },
    // Distance events (times in seconds — averages from 2016/2020/2024 Olympic cycles)
    M3SC: { gold: 490.0, silver: 492.0, bronze: 494.0, mqt: 497.0, asianGold: 505.0, u20Gold: 500.0 },
    F3SC: { gold: 536.0, silver: 540.0, bronze: 544.0, mqt: 560.0, asianGold: 555.0, u20Gold: 558.0 },
    M5K: { gold: 782.0, silver: 785.0, bronze: 788.0, mqt: 793.0, asianGold: 808.0, u20Gold: 795.0 },
    F5K: { gold: 870.0, silver: 876.0, bronze: 882.0, mqt: 900.0, asianGold: 925.0, u20Gold: 885.0 },
    M10K: { gold: 1610.0, silver: 1615.0, bronze: 1620.0, mqt: 1640.0, asianGold: 1700.0, u20Gold: null },
    F10K: { gold: 1845.0, silver: 1855.0, bronze: 1865.0, mqt: 1880.0, asianGold: 1900.0, u20Gold: null },
  };

  const sigmoid = (x) => 1 / (1 + Math.exp(-x));

  // ═══════════════════════════════════════════════════════════════════
  // ENHANCED ANALYSIS ENGINE
  // ═══════════════════════════════════════════════════════════════════
  const runAnalysis = async ({ name, discipline, gender, age, pb, raceHistory, implementWeight = null }) => {
    const eventCode = getEventCode(discipline, gender);
    const benchmarkData = BENCHMARKS[eventCode];
    if (!benchmarkData) throw new Error(`No benchmarks for ${eventCode}`);
    const isThrows = THROWS_CODES.includes(eventCode);
    // Resolve implement weight for throws
    const resolvedWeight = isThrows ? (implementWeight || getDefaultWeight(discipline, gender, age)) : null;
    const genderCode = gender === 'Male' ? 'M' : 'F';
    const seniorWeights = { 'Shot Put_M': 7.26, 'Shot Put_F': 4, 'Discus Throw_M': 2, 'Discus Throw_F': 1, 'Hammer Throw_M': 7.26, 'Hammer Throw_F': 4, 'Javelin Throw_M': 0.8, 'Javelin Throw_F': 0.6 };
    const isSeniorWeight = isThrows && resolvedWeight && Math.abs(resolvedWeight - (seniorWeights[`${discipline}_${genderCode}`] || 0)) < 0.01;

    // ── Build annual best series with absolute times ──
    const annualSeries = raceHistory.map(race => {
      const percentOffPB = isThrows ? ((pb - race.time) / pb) * 100 : ((race.time - pb) / pb) * 100;
      return {
        age: race.age,
        time: parseFloat(race.time.toFixed(2)),
        percentOffPB: parseFloat(percentOffPB.toFixed(2)),
        nRaces: race.nRaces || 1
      };
    }).sort((a, b) => a.age - b.age);

    // ── Compute percentile at current age (interpolated) ──
    const agePercentiles = benchmarkData.percentiles[Math.floor(age)];
    const currentPctOffPB = isThrows ? ((benchmarkData.rocThresholds.optimal - pb) / benchmarkData.rocThresholds.optimal) * 100 : ((pb - benchmarkData.rocThresholds.optimal) / benchmarkData.rocThresholds.optimal) * 100;
    let percentileAtCurrentAge = 50;
    if (agePercentiles) {
      // More precise interpolation between percentile bands
      if (currentPctOffPB <= agePercentiles.p10) percentileAtCurrentAge = 95;
      else if (currentPctOffPB <= agePercentiles.p25) {
        const frac = (currentPctOffPB - agePercentiles.p10) / (agePercentiles.p25 - agePercentiles.p10);
        percentileAtCurrentAge = Math.round(90 - frac * 15);
      }
      else if (currentPctOffPB <= agePercentiles.p50) {
        const frac = (currentPctOffPB - agePercentiles.p25) / (agePercentiles.p50 - agePercentiles.p25);
        percentileAtCurrentAge = Math.round(75 - frac * 25);
      }
      else if (currentPctOffPB <= agePercentiles.p75) {
        const frac = (currentPctOffPB - agePercentiles.p50) / (agePercentiles.p75 - agePercentiles.p50);
        percentileAtCurrentAge = Math.round(50 - frac * 25);
      }
      else if (currentPctOffPB <= agePercentiles.p90) {
        const frac = (currentPctOffPB - agePercentiles.p75) / (agePercentiles.p90 - agePercentiles.p75);
        percentileAtCurrentAge = Math.round(25 - frac * 15);
      }
      else percentileAtCurrentAge = 5;
    }

    // ── Classify trajectory via nearest cluster centroid ──
    let trajectoryType = 'Standard';
    let matchedCluster = benchmarkData.clusters[2]; // default to Plateau
    if (benchmarkData.clusters && annualSeries.length > 0) {
      let minDist = Infinity;
      benchmarkData.clusters.forEach(cluster => {
        let dist = 0;
        cluster.pct_off_pb.forEach((val, idx) => {
          if (idx < annualSeries.length) {
            dist += Math.pow(annualSeries[idx].percentOffPB - val, 2);
          }
        });
        if (dist < minDist) {
          minDist = dist;
          trajectoryType = cluster.name;
          matchedCluster = cluster;
        }
      });
    }

    // ── Compute finalist probability via logistic regression ──
    const pbZ = (pb - benchmarkData.calibration.mean) / benchmarkData.calibration.std;
    const percentileZ = (percentileAtCurrentAge - 50) / 25;
    const coefs = isThrows ? THROWS_MODEL_COEFS : MODEL_COEFS;
    const logit = coefs.intercept +
                  coefs.best_18_20_z * pbZ +
                  coefs.pct_rank * percentileZ;
    const finalistProbability = Math.round(sigmoid(logit) * 100);
    const semiFinalistProbability = Math.min(100, Math.round(sigmoid(logit + 0.5) * 100));
    const qualifierProbability = Math.min(100, Math.round(sigmoid(logit + 1.2) * 100));

    // ── Compute improvement rate ──
    let improvementRate = 0;
    let improvementRatePctPerYear = 0;
    if (annualSeries.length >= 2) {
      const firstTime = annualSeries[0].time;
      const lastTime = annualSeries[annualSeries.length - 1].time;
      const improvement = isThrows ? ((lastTime - firstTime) / firstTime) * 100 : ((firstTime - lastTime) / firstTime) * 100;
      const years = annualSeries[annualSeries.length - 1].age - annualSeries[0].age;
      if (years > 0) {
        improvementRate = improvement / years;
        improvementRatePctPerYear = improvementRate;
      }
    }

    // ── Peak age estimation based on trajectory type ──
    const peakAge = matchedCluster.peakAge || 25;
    const yearsToPeak = Math.max(0, peakAge - age);

    // ── YEAR-BY-YEAR PROJECTION ENGINE ──
    // Projects from current age forward to age 35 using:
    // 1. Athlete's observed improvement rate (pre-peak)
    // 2. Population age-performance curves for shape calibration
    // 3. Trajectory cluster for peak age estimation
    const projections = [];
    const startAge = Math.floor(age);
    const endAge = 35;

    // Get the athlete's current best time to project from
    const currentBest = annualSeries.length > 0
      ? annualSeries[annualSeries.length - 1].time
      : pb;

    // Calculate annual improvement that decays toward peak and reverses after
    for (let projAge = startAge + 1; projAge <= endAge; projAge++) {
      const yearsFromNow = projAge - startAge;

      // Model: improvement slows as we approach peak, then performance declines
      let projectedTime;
      if (projAge <= peakAge) {
        // Pre-peak: apply decaying improvement rate
        const fractionToPeak = yearsToPeak > 0 ? (peakAge - projAge) / yearsToPeak : 0;
        const effectiveRate = improvementRatePctPerYear * fractionToPeak * 0.8;
        // Cumulative improvement
        let cumulativeImprovement = 0;
        for (let y = 1; y <= yearsFromNow && (startAge + y) <= peakAge; y++) {
          const frac = yearsToPeak > 0 ? (peakAge - (startAge + y)) / yearsToPeak : 0;
          cumulativeImprovement += improvementRatePctPerYear * frac * 0.8;
        }
        projectedTime = isThrows ? currentBest * (1 + cumulativeImprovement / 100) : currentBest * (1 - cumulativeImprovement / 100);
      } else {
        // Post-peak: first project to peak, then apply age-related decline
        let cumulativeImprovementToPeak = 0;
        for (let y = 1; (startAge + y) <= peakAge; y++) {
          const frac = yearsToPeak > 0 ? (peakAge - (startAge + y)) / yearsToPeak : 0;
          cumulativeImprovementToPeak += improvementRatePctPerYear * frac * 0.8;
        }
        const peakTime = isThrows ? currentBest * (1 + cumulativeImprovementToPeak / 100) : currentBest * (1 - cumulativeImprovementToPeak / 100);

        // Post-peak decline rate from population curves (~0.3-0.5% per year)
        const yearsPostPeak = projAge - peakAge;
        const declineRate = 0.35 + (yearsPostPeak * 0.05); // accelerating decline
        const cumulativeDecline = yearsPostPeak * declineRate;
        projectedTime = isThrows ? peakTime * (1 - cumulativeDecline / 100) : peakTime * (1 + cumulativeDecline / 100);
      }

      // ── Confidence intervals ──
      // Uncertainty grows with years projected, calibrated by improvement norms
      const improvStd = benchmarkData.improvement.finalist_std;
      const yearFactor = Math.sqrt(yearsFromNow);

      // 50% CI: ±0.674 standard deviations
      const ci50Spread = 0.674 * improvStd * yearFactor * 0.01 * projectedTime;
      // 90% CI: ±1.645 standard deviations
      const ci90Spread = 1.645 * improvStd * yearFactor * 0.01 * projectedTime;

      projections.push({
        age: projAge,
        projectedTime: parseFloat(projectedTime.toFixed(2)),
        ci50Upper: parseFloat((projectedTime + ci50Spread).toFixed(2)),
        ci50Lower: parseFloat((projectedTime - ci50Spread).toFixed(2)),
        ci90Upper: parseFloat((projectedTime + ci90Spread).toFixed(2)),
        ci90Lower: parseFloat((projectedTime - ci90Spread).toFixed(2)),
        yearsFromNow
      });
    }

    // ── Projected peak time ──
    // Peak projection should never be slower than the athlete's actual PB (for sprints) or worse than PB (for throws)
    const projectedFromModel = projections.length > 0
      ? isThrows ? Math.max(...projections.map(p => p.projectedTime)) : Math.min(...projections.map(p => p.projectedTime))
      : pb;
    const projectedPeakTime = isThrows ? Math.max(projectedFromModel, pb) : Math.min(projectedFromModel, pb);
    const projectedPeakAge = projectedPeakTime === pb
      ? age  // Already at peak — PB is the peak
      : (projections.find(p => p.projectedTime === projectedFromModel)?.age || peakAge);

    // ── Build combined chart data (actual + projected) ──
    const chartData = [];

    // Add actual race history
    annualSeries.forEach(race => {
      chartData.push({
        age: race.age,
        actualTime: race.time,
        projectedTime: null,
        ci50Upper: null,
        ci50Lower: null,
        ci90Upper: null,
        ci90Lower: null,
      });
    });

    // Bridge point: last actual point also appears as first projected
    if (annualSeries.length > 0) {
      const lastActual = annualSeries[annualSeries.length - 1];
      // Update last chart point to also have projected values for smooth transition
      const lastChartIdx = chartData.length - 1;
      chartData[lastChartIdx].projectedTime = lastActual.time;
      chartData[lastChartIdx].ci50Upper = lastActual.time;
      chartData[lastChartIdx].ci50Lower = lastActual.time;
      chartData[lastChartIdx].ci90Upper = lastActual.time;
      chartData[lastChartIdx].ci90Lower = lastActual.time;
    }

    // Add projected data
    projections.forEach(proj => {
      // Check if this age already exists in chart data
      const existing = chartData.find(d => d.age === proj.age);
      if (!existing) {
        chartData.push({
          age: proj.age,
          actualTime: null,
          projectedTime: proj.projectedTime,
          ci50Upper: proj.ci50Upper,
          ci50Lower: proj.ci50Lower,
          ci90Upper: proj.ci90Upper,
          ci90Lower: proj.ci90Lower,
        });
      }
    });

    // Sort by age
    chartData.sort((a, b) => a.age - b.age);

    // ── Career phase detection ──
    let careerPhase = 'Development';
    if (age < 20) careerPhase = 'Youth Development';
    else if (age < 23) careerPhase = 'Emerging Senior';
    else if (age < peakAge) careerPhase = 'Pre-Peak Development';
    else if (age <= peakAge + 2) careerPhase = 'Prime Performance';
    else if (age < 32) careerPhase = 'Performance Maintenance';
    else careerPhase = 'Veteran';

    // ── Competition readiness score (0-100) ──
    let readinessScore = 0;
    // Factor 1: How close is PB to finalist threshold (40 points)
    const pbVsFinalist = isThrows ? (pb - benchmarkData.rocThresholds.optimal) / benchmarkData.rocThresholds.optimal * 100 : (benchmarkData.rocThresholds.optimal - pb) / benchmarkData.rocThresholds.optimal * 100;
    readinessScore += Math.min(40, Math.max(0, 40 + pbVsFinalist * 8));
    // Factor 2: Improvement trend (30 points)
    readinessScore += Math.min(30, improvementRate * 10);
    // Factor 3: Percentile ranking (30 points)
    readinessScore += Math.min(30, percentileAtCurrentAge * 0.3);
    readinessScore = Math.round(Math.min(100, Math.max(0, readinessScore)));

    // ── Enhanced recommendations ──
    const recommendations = [];
    const thresholds = benchmarkData.rocThresholds;

    // Trajectory-specific advice
    if (trajectoryType === 'Late Developer') {
      recommendations.push({
        type: 'trajectory',
        title: 'Late Developer Profile',
        text: `Your trajectory matches the "Late Developer" pattern seen in ${Math.round(benchmarkData.clusters[1].pct_off_pb.length > 0 ? 28 : 30)}% of Olympic finalists. Historical data shows athletes with this profile peak around age ${matchedCluster.peakAge}. Continue prioritizing technical refinement and strength development—your best performances are ahead.`
      });
    } else if (trajectoryType === 'Early Peaker') {
      recommendations.push({
        type: 'trajectory',
        title: 'Early Peaker Profile',
        text: `Your trajectory matches the "Early Peaker" pattern. Athletes with this profile typically peak around age ${matchedCluster.peakAge}. Focus on injury prevention, recovery protocols, and training load management to sustain high-level performance through your competitive window.`
      });
    } else {
      recommendations.push({
        type: 'trajectory',
        title: 'Standard Progression Profile',
        text: `Your trajectory shows a steady "Standard" progression pattern with consistent improvements. Athletes with this profile typically peak around age ${matchedCluster.peakAge}. Consider periodically introducing new training stimuli to accelerate breakthrough performances.`
      });
    }

    // Threshold proximity advice
    if (isThrows ? pb >= thresholds.optimal : pb <= thresholds.optimal) {
      const unit = isThrows ? 'm' : 's';
      const text = isThrows
        ? `Your PB of ${pb}${unit} is at or above the Olympic finalist threshold of ${thresholds.optimal}${unit}. You are performing at a level consistent with Olympic finalists. Focus on technical consistency, competition strategy, and peaking for major championships.`
        : `Your PB of ${pb}${unit} is at or below the Olympic finalist threshold of ${thresholds.optimal}${unit}. You are performing at a level consistent with Olympic finalists. Focus on race-day execution, tactical awareness, and peaking for major championships.`;
      recommendations.push({
        type: 'threshold',
        title: 'Finalist Threshold Met',
        text: text
      });
    } else if (isThrows ? pb >= thresholds.s80 : pb <= thresholds.s80) {
      const unit = isThrows ? 'm' : 's';
      const gainNeeded = isThrows ? (thresholds.optimal - pb).toFixed(2) : (pb - thresholds.optimal).toFixed(2);
      const text = isThrows
        ? `Your PB of ${pb}${unit} puts you within the semi-finalist threshold (${thresholds.s80}${unit}). You need to gain ${gainNeeded}${unit} to reach the finalist threshold. At your current improvement rate of ${improvementRate.toFixed(2)}%/year, this could take approximately ${Math.ceil((thresholds.optimal - pb) / (pb * improvementRate / 100))} competitive seasons.`
        : `Your PB of ${pb}${unit} puts you within the semi-finalist threshold (${thresholds.s80}${unit}). You need to improve by ${gainNeeded}${unit} to reach the finalist threshold. At your current improvement rate of ${improvementRate.toFixed(2)}%/year, this could take approximately ${Math.ceil((pb - thresholds.optimal) / (pb * improvementRate / 100))} competitive seasons.`;
      recommendations.push({
        type: 'threshold',
        title: 'Semi-Finalist Range',
        text: text
      });
    } else if (isThrows ? pb >= thresholds.s90 : pb <= thresholds.s90) {
      const unit = isThrows ? 'm' : 's';
      const gainS80 = isThrows ? (thresholds.s80 - pb).toFixed(2) : (pb - thresholds.s80).toFixed(2);
      const gainOptimal = isThrows ? (thresholds.optimal - pb).toFixed(2) : (pb - thresholds.optimal).toFixed(2);
      const text = isThrows
        ? `Your PB of ${pb}${unit} puts you in the Olympic qualifier range (${thresholds.s90}${unit}). You need ${gainS80}${unit} improvement to reach semi-finalist level and ${gainOptimal}${unit} for finalist level. Focus on both physical development and technical refinement.`
        : `Your PB of ${pb}${unit} puts you in the Olympic qualifier range (${thresholds.s90}${unit}). You need ${gainS80}${unit} improvement to reach semi-finalist level and ${gainOptimal}${unit} for finalist level. Focus on both physical development and race strategy optimization.`;
      recommendations.push({
        type: 'threshold',
        title: 'Qualifier Range',
        text: text
      });
    } else {
      const unit = isThrows ? 'm' : 's';
      const distFromThreshold = isThrows ? (pb - thresholds.s90).toFixed(2) : (pb - thresholds.s90).toFixed(2);
      const text = isThrows
        ? `Your PB of ${pb}${unit} is ${distFromThreshold}${unit} below the qualifier identification threshold (${thresholds.s90}${unit}). Focus on consistent training, periodization, and developing technical excellence. Track your progress against the age-performance benchmarks shown in the chart.`
        : `Your PB of ${pb}${unit} is ${distFromThreshold}${unit} above the qualifier identification threshold (${thresholds.s90}${unit}). Focus on consistent training, periodization, and developing a strong aerobic/anaerobic base. Track your progress against the age-performance benchmarks shown in the chart.`;
      recommendations.push({
        type: 'threshold',
        title: 'Building Toward Olympic Standards',
        text: text
      });
    }

    // Improvement rate advice
    if (improvementRate > benchmarkData.improvement.finalist_median) {
      recommendations.push({
        type: 'improvement',
        title: 'Elite Improvement Trajectory',
        text: `Your improvement rate of ${improvementRate.toFixed(2)}%/year exceeds the median finalist improvement rate of ${benchmarkData.improvement.finalist_median}%/year. Maintain this momentum through progressive overload, proper recovery, and competition experience at increasingly higher levels.`
      });
    } else if (improvementRate > benchmarkData.improvement.non_finalist_median) {
      recommendations.push({
        type: 'improvement',
        title: 'Solid Improvement Rate',
        text: `Your improvement rate of ${improvementRate.toFixed(2)}%/year is above the non-finalist median (${benchmarkData.improvement.non_finalist_median}%/year) but below the finalist median (${benchmarkData.improvement.finalist_median}%/year). To accelerate, consider training camp exposure, biomechanical analysis, and targeted strength work.`
      });
    } else if (annualSeries.length >= 2) {
      recommendations.push({
        type: 'improvement',
        title: 'Improvement Rate Below Norms',
        text: `Your improvement rate of ${improvementRate.toFixed(2)}%/year is below typical norms. This may indicate a training plateau, technical limitation, or need for periodization review. Consider working with a biomechanist or adjusting your training structure for the next macrocycle.`
      });
    }

    // Career phase advice
    recommendations.push({
      type: 'phase',
      title: `Career Phase: ${careerPhase}`,
      text: careerPhase === 'Youth Development'
        ? 'Focus on multi-event development, general athleticism, and enjoyment. Avoid over-specialization at this stage.'
        : careerPhase === 'Emerging Senior'
        ? 'Transition to senior competition demands. Build race experience, develop pre-competition routines, and progressively increase training volume.'
        : careerPhase === 'Pre-Peak Development'
        ? `You have approximately ${yearsToPeak} year${yearsToPeak !== 1 ? 's' : ''} until projected peak. This is the critical development window—maximize training quality and competition exposure.`
        : careerPhase === 'Prime Performance'
        ? 'You are in or near your projected peak performance window. Focus on championship preparation, tactical racing, and maintaining fitness while managing training load.'
        : careerPhase === 'Performance Maintenance'
        ? 'Focus on maintaining performance through smart training, injury prevention, and leveraging your competitive experience. Recovery becomes increasingly important.'
        : 'Prioritize recovery, adapt training to changing physiology, and leverage decades of competitive experience. Consider mentoring roles alongside your competitive career.'
    });

    // ── Find similar athletes (from live API) ──
    let similarAthletes = [];
    try {
      const simResp = await fetch(`${API_BASE}/api/v1/similar-athletes?discipline=${eventCode}&pb=${pb}&age=${age}&limit=3`);
      if (simResp.ok) {
        const simData = await simResp.json();
        similarAthletes = (simData.athletes || []).map(a => ({
          name: a.name,
          nationality: a.country || 'N/A',
          pb: parseFloat(a.pb_time),
          peakAge: a.closest_age,
          timeAtSimilarAge: parseFloat(a.time_at_similar_age),
          closestAge: a.closest_age,
          timeDiff: parseFloat(a.time_diff),
          ageDiff: a.age_diff,
          similarity: parseFloat(a.similarity),
          classification: isThrows ? (parseFloat(a.pb_time) >= (thresholds.optimal || 0) ? 'F' : parseFloat(a.pb_time) >= (thresholds.s80 || 0) ? 'SF' : 'Q') : (parseFloat(a.pb_time) <= (thresholds.optimal || 999) ? 'F' : parseFloat(a.pb_time) <= (thresholds.s80 || 999) ? 'SF' : 'Q'),
        }));
      }
    } catch (e) {
      console.warn('Similar athletes API unavailable, skipping:', e.message);
    }

    // ── Build performance standards with met/not-met (from new competition data) ──
    const compData = COMPETITION_STANDARDS[eventCode];
    const standards = compData ? compData.competitions.map(comp => {
      // For backward compat, pick the most meaningful "target" mark: entry standard if available, else p8
      const targetMark = comp.qual || comp.p8;
      return {
        tier: comp.tier === 'world' ? 'E1' : comp.tier === 'regional' ? 'E2' : 'E3',
        label: comp.label,
        time: targetMark,
        source: comp.label,
        color: comp.color,
        met: isThrows ? pb >= targetMark : pb <= targetMark,
        gap: isThrows ? parseFloat((targetMark - pb).toFixed(2)) : parseFloat((pb - targetMark).toFixed(2)),
        compId: comp.id,
        compTier: comp.tier,
        ageGroup: comp.ageGroup,
        gold: comp.gold,
        bronze: comp.bronze,
        p8: comp.p8,
        qual: comp.qual,
        semi: comp.semi,
      };
    }).sort((a, b) => {
      const tierOrder = { world: 0, regional: 1, development: 2 };
      return (tierOrder[a.compTier] || 3) - (tierOrder[b.compTier] || 3);
    }) : [];

    // ── Build chart data for additional views ──
    // % Off PB chart data
    const pctOffPBChartData = annualSeries.map(r => ({
      age: r.age,
      pctOffPB: r.percentOffPB,
      medianPct: benchmarkData.percentiles[r.age]?.p50 || null,
      p25Pct: benchmarkData.percentiles[r.age]?.p25 || null,
      p75Pct: benchmarkData.percentiles[r.age]?.p75 || null,
    }));

    // Percentile band chart data (where athlete sits among population)
    const AGES = [15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38];
    const percentileBandData = AGES.filter(a => benchmarkData.percentiles[a]).map(a => {
      const p = benchmarkData.percentiles[a];
      const userEntry = annualSeries.find(r => r.age === a);
      return {
        age: a,
        p10: p.p10, p25: p.p25, p50: p.p50, p75: p.p75, p90: p.p90,
        userPctOff: userEntry ? userEntry.percentOffPB : null,
      };
    });

    // Improvement rate bar chart data (year-on-year)
    const improvementChartData = [];
    for (let i = 1; i < annualSeries.length; i++) {
      const prev = annualSeries[i - 1];
      const curr = annualSeries[i];
      if (curr.age > prev.age) {
        const yoyImprovement = isThrows
          ? ((curr.time - prev.time) / prev.time) * 100
          : ((prev.time - curr.time) / prev.time) * 100;
        improvementChartData.push({
          label: `${prev.age}-${curr.age}`,
          improvement: parseFloat(yoyImprovement.toFixed(2)),
          positive: yoyImprovement > 0,
        });
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // CORRECTNESS OVERRIDES — replace the legacy outputs above with the
    // age-aware, data-sufficiency-aware results that match the backend
    // analyzer in app/core/analyzer.py. The legacy code paths above had
    // four bugs (see analyzer.py docstring): trajectory always picked
    // the cluster with the lowest age-18 % off PB, percentile was
    // hard-coded P95 whenever the latest race equalled the PB, peak
    // projection echoed the current PB when only one age was logged,
    // and the finalist regression was age-blind.
    // ────────────────────────────────────────────────────────────────────
    const _nDistinctAges = new Set(annualSeries.map(r => r.age)).size;
    const _sufficientForTrajectory = _nDistinctAges >= 3;

    const _expectedTimeAtAge = (a) => {
      let pctOff;
      if (a <= 18) pctOff = 8.0 + Math.max(0, 18 - a) * 1.5;
      else if (a < 25) pctOff = 8.0 * (25 - a) / 7.0;
      else if (a <= 27) pctOff = 0.0;
      else if (a <= 30) pctOff = 0.3 * (a - 27);
      else pctOff = 0.9 + 0.5 * (a - 30);
      return isThrows
        ? benchmarkData.calibration.mean * (1 - pctOff / 100)
        : benchmarkData.calibration.mean * (1 + pctOff / 100);
    };

    const _normCdf = (z) => {
      // Abramowitz & Stegun 26.2.17
      const t = 1 / (1 + 0.2316419 * Math.abs(z));
      const d = 0.3989423 * Math.exp(-z * z / 2);
      let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
      if (z > 0) p = 1 - p;
      return p;
    };

    const _absolutePercentile = (athleteTime, a) => {
      const expected = _expectedTimeAtAge(a);
      const std = Math.max(0.05, benchmarkData.calibration.std) * (1 + 0.02 * Math.abs(a - 25));
      const z = (athleteTime - expected) / std;
      return isThrows
        ? Math.max(0, Math.min(100, 100 * _normCdf(z)))
        : Math.max(0, Math.min(100, 100 * (1 - _normCdf(z))));
    };

    const _correctedPercentile = Math.round(_absolutePercentile(pb, age));

    // Age-aware finalist probability via direct ROC threshold logic.
    const _logitProb = (val, thr, scale) => {
      const gap = isThrows ? (val - thr) : (thr - val);
      return 1 / (1 + Math.exp(-gap / scale));
    };
    const _scale = Math.max(0.05, benchmarkData.calibration.std * 0.5);
    let _finalistProb = _logitProb(pb, benchmarkData.rocThresholds.optimal, _scale);
    let _semiProb = _logitProb(pb, benchmarkData.rocThresholds.s80, _scale);
    let _qualProb = _logitProb(pb, benchmarkData.rocThresholds.s90, _scale);
    if (age > 27) {
      const haircut = Math.max(0.4, 1 - 0.08 * (age - 27));
      _finalistProb *= haircut;
      _semiProb *= haircut;
      _qualProb *= haircut;
    }
    _semiProb = Math.max(_semiProb, _finalistProb);
    _qualProb = Math.max(_qualProb, _semiProb);

    const _correctedFinalist = Math.round(Math.min(1, _finalistProb) * 100);
    const _correctedSemi = Math.round(Math.min(1, _semiProb) * 100);
    const _correctedQual = Math.round(Math.min(1, _qualProb) * 100);

    const _correctedTrajectory = _sufficientForTrajectory ? trajectoryType : 'Insufficient Data';
    const _correctedImprovementRate = _sufficientForTrajectory ? improvementRate : 0;
    const _correctedPeakTime = _sufficientForTrajectory ? projectedPeakTime : pb;
    const _correctedPeakAge = _sufficientForTrajectory ? projectedPeakAge : age;
    const _peakConfidence = _sufficientForTrajectory
      ? Math.max(0.3, 0.85 - (yearsToPeak * 0.05))
      : 0;

    return {
      name,
      discipline,
      gender,
      age,
      personalBest: pb,
      eventCode,
      isThrows,
      careerPBAge: annualSeries.length > 0 ? annualSeries.reduce((best, r) => isThrows ? (r.time > best.time ? r : best) : (r.time < best.time ? r : best), annualSeries[0]).age : age,
      trajectoryType: _correctedTrajectory,
      sufficientData: _sufficientForTrajectory,
      nDistinctAges: _nDistinctAges,
      finalistProbability: _correctedFinalist,
      semiFinalistProbability: _correctedSemi,
      qualifierProbability: _correctedQual,
      percentileAtCurrentAge: _correctedPercentile,
      improvementRate: parseFloat(_correctedImprovementRate.toFixed(2)),
      finalistNorm: benchmarkData.improvement.finalist_median,
      nonFinalistNorm: benchmarkData.improvement.non_finalist_median,
      careerPhase,
      readinessScore,
      peakProjection: {
        time: parseFloat(_correctedPeakTime.toFixed(2)),
        age: _correctedPeakAge,
        confidence: _peakConfidence,
        ciLower: parseFloat((_correctedPeakTime * 0.995).toFixed(2)),
        ciUpper: parseFloat((_correctedPeakTime * 1.005).toFixed(2)),
        yearsToPeak: Math.max(0, _correctedPeakAge - age),
        insufficientData: !_sufficientForTrajectory
      },
      raceHistory: annualSeries,
      projections,
      chartData,
      pctOffPBChartData,
      percentileBandData,
      improvementChartData,
      thresholds: isThrows ? {
        medalist: thresholds.s90,
        finalist: thresholds.s80,
        semiFinalist: thresholds.optimal,
        qualifier: thresholds.s70,
      } : {
        medalist: thresholds.s70,
        finalist: thresholds.optimal,
        semiFinalist: thresholds.s80,
        qualifier: thresholds.s90,
      },
      benchmarks: [
        { label: 'Olympic Finalist Threshold', value: thresholds.optimal, met: isThrows ? pb >= thresholds.optimal : pb <= thresholds.optimal, desc: 'Optimal ROC threshold — Youden\'s J statistic' },
        { label: 'Semi-Finalist Threshold', value: thresholds.s80, met: isThrows ? pb >= thresholds.s80 : pb <= thresholds.s80, desc: '80% sensitivity threshold' },
        { label: 'Qualifier Identification', value: thresholds.s90, met: isThrows ? pb >= thresholds.s90 : pb <= thresholds.s90, desc: '90% sensitivity threshold — captures 90% of eventual finalists' },
      ],
      standards,
      similarAthletes,
      championshipData: CHAMPIONSHIP_DATA[eventCode] || null,
      // Progression matrix: season best at every age
      progressionMatrix: (() => {
        const matrix = {};
        annualSeries.forEach(r => { matrix[r.age] = r.time; });
        return matrix;
      })(),
      // Improvement scenarios: projected times at different improvement rates
      improvementScenarios: (() => {
        const rates = [0, -0.5, -1.0, -1.5, -2.0, -2.5, -3.0];
        const currentBest = annualSeries.length > 0 ? annualSeries[annualSeries.length - 1].time : pb;
        const currentAge = annualSeries.length > 0 ? annualSeries[annualSeries.length - 1].age : age;
        return rates.map(rate => {
          const row = { rate: `${rate}%`, times: {} };
          for (let futAge = currentAge; futAge <= Math.min(currentAge + 10, 38); futAge++) {
            const yearsOut = futAge - currentAge;
            row.times[futAge] = parseFloat((currentBest * Math.pow(1 + rate / 100, yearsOut)).toFixed(2));
          }
          return row;
        });
      })(),
      // Trajectory comparison data: athlete vs finalist/semi-finalist/qualifier median curves
      trajectoryComparison: AGES.filter(a => benchmarkData.percentiles[a]).map(a => {
        const userEntry = annualSeries.find(r => r.age === a);
        const projEntry = projections.find(p => p.age === a);
        return {
          age: a,
          you: userEntry ? parseFloat(userEntry.time.toFixed(2)) : null,
          projected: projEntry ? parseFloat(projEntry.projectedTime.toFixed(2)) : null,
          medalist: parseFloat(((isThrows ? thresholds.s90 : thresholds.s70) * (isThrows ? (1 - benchmarkData.percentiles[a].p50 / 100) : (1 + benchmarkData.percentiles[a].p50 / 100))).toFixed(2)),
          finalist: parseFloat(((isThrows ? thresholds.s80 : thresholds.optimal) * (isThrows ? (1 - benchmarkData.percentiles[a].p50 / 100) : (1 + benchmarkData.percentiles[a].p50 / 100))).toFixed(2)),
          semiFinalist: parseFloat(((isThrows ? thresholds.optimal : thresholds.s80) * (isThrows ? (1 - benchmarkData.percentiles[a].p50 / 100) : (1 + benchmarkData.percentiles[a].p50 / 100))).toFixed(2)),
          qualifier: parseFloat(((isThrows ? thresholds.s70 : thresholds.s90) * (isThrows ? (1 - benchmarkData.percentiles[a].p50 / 100) : (1 + benchmarkData.percentiles[a].p50 / 100))).toFixed(2)),
        };
      }),
      // ROD per season (Rate of Development)
      rodData: (() => {
        const rodArr = [];
        for (let i = 0; i < annualSeries.length; i++) {
          const curr = annualSeries[i];
          const rod = i > 0 ? parseFloat(((isThrowsDiscipline(discipline) ? ((curr.time - annualSeries[i-1].time) / annualSeries[i-1].time) : ((annualSeries[i-1].time - curr.time) / annualSeries[i-1].time)) * 100).toFixed(2)) : 0;
          // RODP: where this ROD sits vs finalist improvement norms (approximate percentile)
          const rodp = rod > 0 ? Math.min(100, parseFloat((50 + (rod - benchmarkData.improvement.finalist_median) / benchmarkData.improvement.finalist_std * 30).toFixed(1))) : 0;
          rodArr.push({ age: curr.age, time: curr.time, rod, rodp: Math.max(0, rodp) });
        }
        return rodArr;
      })(),
      // Seasons best for gauge
      seasonsBest: annualSeries.length > 0 ? annualSeries[annualSeries.length - 1].time : pb,
      // Implement weight info (throws only)
      implementWeight: resolvedWeight,
      isSeniorWeight,
      recommendations
    };
  };

  // ═══════════════════════════════════════════════════════════════════
  // INPUT HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  const handleManualEntry = (field, value, raceIndex = null) => {
    if (raceIndex !== null) {
      const newRaces = [...athleteData.races];
      newRaces[raceIndex][field] = value;
      setAthleteData({ ...athleteData, races: newRaces });
    } else {
      setAthleteData({ ...athleteData, [field]: value });
    }
  };

  const addRaceRow = () => {
    setAthleteData({
      ...athleteData,
      races: [...athleteData.races, { date: '', time: '', wind: '', competition: '' }]
    });
  };

  const removeRaceRow = (index) => {
    const newRaces = athleteData.races.filter((_, i) => i !== index);
    setAthleteData({ ...athleteData, races: newRaces });
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    analytics.analyzerRun({
      discipline: activeTab === 'manual' ? athleteData.discipline : quickAnalysisData.discipline,
      gender: activeTab === 'manual' ? athleteData.gender : quickAnalysisData.gender,
      mode: activeTab,
    });

    try {
      if (activeTab === 'manual') {
        const validRaces = athleteData.races.filter(r => r.date && r.time);
        if (validRaces.length === 0) throw new Error('Please enter at least one race with a date and time.');
        if (!athleteData.dateOfBirth) throw new Error('Please enter a date of birth.');

        const dob = new Date(athleteData.dateOfBirth);
        if (isNaN(dob.getTime())) throw new Error('Date of birth is not a valid date.');
        const today = new Date();
        if (dob > today) throw new Error('Date of birth cannot be in the future.');
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
        if (age < 10 || age > 80) throw new Error(`Age calculated from DOB is ${age} — please check the date.`);

        // Validate race values: each time must parse, be positive, and be within sane bounds.
        const isThrowsCheck = isThrowsDiscipline(athleteData.discipline);
        for (const r of validRaces) {
          const t = parseTimeInput(r.time);
          if (isNaN(t) || t <= 0) throw new Error(`Invalid race time: "${r.time}". Use mm:ss.ff (e.g. 8:06.05) for distance events or seconds for sprints.`);
          if (!isThrowsCheck && t > 10000) throw new Error(`Race time "${r.time}" looks too large for a track event.`);
          if (isThrowsCheck && t > 200) throw new Error(`Throw distance "${r.time}" looks too large — use metres.`);
          const rd = new Date(r.date);
          if (isNaN(rd.getTime())) throw new Error(`Invalid race date: "${r.date}".`);
          if (rd > today) throw new Error(`Race date "${r.date}" is in the future.`);
          if (rd < dob) throw new Error(`Race date "${r.date}" is before the athlete's DOB.`);
        }

        const racesByAge = {};
        validRaces.forEach(race => {
          const raceDate = new Date(race.date);
          let raceAge = raceDate.getFullYear() - dob.getFullYear();
          const racemonthDiff = raceDate.getMonth() - dob.getMonth();
          if (racemonthDiff < 0 || (racemonthDiff === 0 && raceDate.getDate() < dob.getDate())) raceAge--;

          const time = parseTimeInput(race.time);
          if (!racesByAge[raceAge]) racesByAge[raceAge] = { times: [], age: raceAge };
          racesByAge[raceAge].times.push(time);
        });

        const isThrowsDisc = isThrowsDiscipline(athleteData.discipline);
        const raceHistory = Object.values(racesByAge).map(ageData => ({
          age: ageData.age,
          time: isThrowsDisc ? Math.max(...ageData.times) : Math.min(...ageData.times),
          nRaces: ageData.times.length
        })).sort((a, b) => a.age - b.age);

        if (raceHistory.length === 0) throw new Error('No valid races found.');
        const pb = isThrowsDisc ? Math.max(...raceHistory.map(r => r.time)) : Math.min(...raceHistory.map(r => r.time));

        const results = await runAnalysis({
          name: athleteData.name || 'Unknown',
          discipline: athleteData.discipline,
          gender: athleteData.gender,
          age, pb, raceHistory,
          implementWeight: isThrowsDisc ? (athleteData.implementWeight || getDefaultWeight(athleteData.discipline, athleteData.gender, age)) : null
        });

        // Attach raw races for Overview scatter + table
        results._rawRaces = validRaces.map(r => {
          const rd = new Date(r.date);
          const years = rd.getFullYear() - dob.getFullYear();
          const diffMs = rd - new Date(dob.getFullYear() + years, dob.getMonth(), dob.getDate());
          return {
            date: r.date,
            value: parseTimeInput(r.time),
            age: +(years + diffMs / (365.25 * 24 * 3600 * 1000)).toFixed(2),
            competition: r.competition || null,
            wind: r.wind || null,
            implement_weight_kg: null,
          };
        }).filter(r => !isNaN(r.value));

        setAnalysisResults(results);
        setCurrentView('results');

      } else if (activeTab === 'url') {
        throw new Error('URL import requires backend connection. Please use Manual Entry or Quick Analysis.');

      } else if (activeTab === 'quick') {
        if (!quickAnalysisData.age || !quickAnalysisData.personalBest) {
          throw new Error('Please enter both age and personal best time.');
        }

        const age = parseInt(quickAnalysisData.age);
        const pb = parseTimeInput(quickAnalysisData.personalBest);

        // Sanity validation on quick-analysis inputs
        if (isNaN(age) || age < 10 || age > 80) {
          throw new Error('Age must be a number between 10 and 80.');
        }
        if (isNaN(pb) || pb <= 0) {
          throw new Error('Personal best must be a positive number. Use mm:ss.ff (e.g. 8:06.05) for distance events.');
        }
        const isThrowsQ = isThrowsDiscipline(quickAnalysisData.discipline);
        if (!isThrowsQ && pb > 10000) {
          throw new Error('Personal best looks too large for a track event — check the value.');
        }
        if (isThrowsQ && pb > 200) {
          throw new Error('Throw distance looks too large — use metres (e.g. 65.50).');
        }

        const results = await runAnalysis({
          name: 'Quick Analysis',
          discipline: quickAnalysisData.discipline,
          gender: quickAnalysisData.gender,
          age, pb,
          raceHistory: [{ age, time: pb, nRaces: 1 }],
          implementWeight: isThrowsQ ? (quickAnalysisData.implementWeight || getDefaultWeight(quickAnalysisData.discipline, quickAnalysisData.gender, age)) : null
        });

        setAnalysisResults(results);
        setCurrentView('quickResults');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentView('landing');
    setMultiResults(null);
    setActiveDiscipline(null);
  };

  // ═══════════════════════════════════════════════════════════════════
  // URL SCRAPE HANDLER (connects to backend SSE endpoint)
  // ═══════════════════════════════════════════════════════════════════
  const handleScrapeUrl = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a World Athletics profile URL.');
      return;
    }
    if (!urlInput.includes('worldathletics.org')) {
      setError('URL must be from worldathletics.org');
      return;
    }

    setError(null);
    setScraping(true);
    setScrapeProgress({ step: 'connecting', message: 'Connecting to server...', progress: 0 });

    try {
      const response = await fetch(`${API_BASE}/api/v1/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Scraping failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === 'progress') {
                setScrapeProgress(data);
              } else if (eventType === 'complete') {
                // Process scraped data — run analysis on each supported discipline
                await processScrapedData(data);
                setScraping(false);
                return;
              } else if (eventType === 'error') {
                throw new Error(data.message || 'Scraping failed');
              }
            } catch (parseErr) {
              if (parseErr.message !== 'Scraping failed') {
                console.warn('SSE parse error:', parseErr);
              } else {
                throw parseErr;
              }
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setScraping(false);
    }
  };

  const processScrapedData = async (scrapedData) => {
    setScrapeProgress({ step: 'analyzing', message: 'Running analysis on all disciplines...', progress: 0.92 });

    const { athlete_name, gender, dob, disciplines } = scrapedData;

    // Calculate age from DOB
    let age = 25; // fallback
    if (dob) {
      const dobDate = new Date(dob);
      const today = new Date();
      age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
    }

    const genderLabel = gender === 'M' ? 'Male' : 'Female';
    const results = {};

    for (const [discCode, races] of Object.entries(disciplines)) {
      if (races.length === 0) continue;

      // Build race history grouped by age
      const racesByAge = {};
      races.forEach(race => {
        let raceAge = age; // fallback
        if (race.date && dob) {
          const raceDate = new Date(race.date);
          const dobDate = new Date(dob);
          raceAge = raceDate.getFullYear() - dobDate.getFullYear();
          const m = raceDate.getMonth() - dobDate.getMonth();
          if (m < 0 || (m === 0 && raceDate.getDate() < dobDate.getDate())) raceAge--;
        }
        if (!racesByAge[raceAge]) racesByAge[raceAge] = { times: [], age: raceAge };
        racesByAge[raceAge].times.push(race.time);
      });

      const isThrowsDisc = isThrowsDiscipline(discCode);
      const raceHistory = Object.values(racesByAge).map(ageData => ({
        age: ageData.age,
        time: isThrowsDisc ? Math.max(...ageData.times) : Math.min(...ageData.times),
        nRaces: ageData.times.length,
      })).sort((a, b) => a.age - b.age);

      const pb = isThrowsDisc ? Math.max(...raceHistory.map(r => r.time)) : Math.min(...raceHistory.map(r => r.time));

      // Map discipline code to what runAnalysis expects
      let discipline = discCode;
      if (discCode === '100mH') discipline = '100mH';
      else if (discCode === '110mH') discipline = '110mH';
      else if (discCode === '400mH') discipline = '400mH';

      try {
        const analysisResult = await runAnalysis({
          name: athlete_name || 'Unknown',
          discipline,
          gender: genderLabel,
          age,
          pb,
          raceHistory,
        });
        analysisResult._totalRaces = races.length;
        // Attach ALL individual races (not just annual bests) so the Overview
        // scatter plot + table can show full history. Each entry includes a
        // decimal age for precise X-axis positioning.
        analysisResult._rawRaces = races.map(r => {
          let ageAtRace = null;
          if (r.date && dob) {
            const rd = new Date(r.date);
            const db = new Date(dob);
            const years = rd.getFullYear() - db.getFullYear();
            const diffMs = rd - new Date(db.getFullYear() + years, db.getMonth(), db.getDate());
            ageAtRace = +(years + diffMs / (365.25 * 24 * 3600 * 1000)).toFixed(2);
          }
          return {
            date: r.date,
            value: r.time,
            age: ageAtRace,
            competition: r.competition || null,
            wind: r.wind != null ? r.wind : null,
            implement_weight_kg: r.implement_weight_kg != null ? r.implement_weight_kg : null,
          };
        }).filter(r => r.value != null);
        results[discCode] = analysisResult;
      } catch (err) {
        console.error(`Analysis failed for ${discCode} (gender=${genderLabel}, pb=${pb}, races=${raceHistory.length}):`, err.message, err.stack);
        if (!results._failedDisciplines) results._failedDisciplines = {};
        results._failedDisciplines[discCode] = err.message;
      }
    }

    if (Object.keys(results).filter(k => !k.startsWith('_')).length === 0) {
      const foundDiscs = Object.keys(disciplines).join(', ') || 'none';
      const failInfo = results._failedDisciplines ? ' Errors: ' + Object.entries(results._failedDisciplines).map(([k,v]) => `${k}: ${v}`).join('; ') : '';
      setError(`No analyzable disciplines found. Scraped disciplines: ${foundDiscs}. We currently support: 100m (M/F), 200m (M/F), 400m (M/F), 100mH (F), 110mH (M), 400mH (M/F), Discus Throw (M/F), Javelin Throw (M/F), Hammer Throw (M/F), Shot Put (M/F).${failInfo}`);
      setScraping(false);
      return;
    }

    // Track which disciplines were found but couldn't be analyzed
    const failedDiscs = Object.keys(disciplines).filter(d => !results[d]);
    if (failedDiscs.length > 0) {
      results._failedDisciplines = failedDiscs;
    }
    results._scrapedDisciplines = Object.keys(disciplines);

    setMultiResults(results);
    setActiveDiscipline(Object.keys(results).filter(k => !k.startsWith('_'))[0]);
    setAnalysisResults(results[Object.keys(results).filter(k => !k.startsWith('_'))[0]]);
    setScrapeProgress({ step: 'complete', message: 'Analysis complete!', progress: 1.0 });
    setCurrentView('results');
  };

  // ── Handle athlete clicked from CoachDashboard roster ──
  // Roster format: { name, dob, gender, discipline, races: [{date, value, ...}] }
  // processScrapedData expects: { athlete_name, gender, dob, disciplines: { [code]: [{date, time}] } }
  useEffect(() => {
    if (!incomingAthlete) return;
    const athlete = incomingAthlete;
    onIncomingAthleteConsumed?.();

    try {
      const mapRaces = (rs) => (Array.isArray(rs) ? rs : [])
        .filter(r => r && r.value != null && r.date)
        .map(r => ({
          date: r.date,
          time: typeof r.value === 'number' ? r.value : parseFloat(r.value),
          competition: r.competition || null,
          wind: r.wind || null,
          implement_weight_kg: r.implement_weight_kg || null,
        }));

      let disciplinesMap = {};
      if (athlete.disciplines_data && typeof athlete.disciplines_data === 'object') {
        for (const [code, rs] of Object.entries(athlete.disciplines_data)) {
          const mapped = mapRaces(rs);
          if (mapped.length > 0) disciplinesMap[code] = mapped;
        }
      }
      if (Object.keys(disciplinesMap).length === 0) {
        const discKey = athlete.discipline || '100m';
        const mapped = mapRaces(athlete.races);
        if (mapped.length > 0) disciplinesMap[discKey] = mapped;
      }

      if (Object.keys(disciplinesMap).length === 0) {
        setError(`No race data found for ${athlete.name}`);
        return;
      }

      const scrapedShape = {
        athlete_name: athlete.name,
        gender: athlete.gender,
        dob: athlete.dob,
        disciplines: disciplinesMap,
      };

      setScraping(true);
      setError(null);
      setScrapeProgress({ step: 'analyzing', message: `Loading ${athlete.name}...`, progress: 0.5 });
      processScrapedData(scrapedShape).then(() => {
        if (athlete.discipline && disciplinesMap[athlete.discipline]) {
          setActiveDiscipline(athlete.discipline);
        }
      }).finally(() => setScraping(false));
    } catch (err) {
      // Roster athlete load failed — silent, error shown in UI
      setError(`Failed to load ${athlete.name}: ${err.message}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingAthlete]);

  // ═══════════════════════════════════════════════════════════════════
  // LOADING ANIMATION COMPONENT — Track/Stadium Theme
  // ═══════════════════════════════════════════════════════════════════
  const LoadingAnimation = () => {
    const [runnerPos, setRunnerPos] = useState(0);
    const [dotIndex, setDotIndex] = useState(0);

    useEffect(() => {
      const runnerInterval = setInterval(() => {
        setRunnerPos(prev => (prev + 1) % 100);
      }, 50);
      const dotInterval = setInterval(() => {
        setDotIndex(prev => (prev + 1) % 4);
      }, 400);
      return () => {
        clearInterval(runnerInterval);
        clearInterval(dotInterval);
      };
    }, []);

    const dots = '.'.repeat(dotIndex);
    const progressPct = Math.round(scrapeProgress.progress * 100);

    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center">
        {/* Stadium lights effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-orange-500 opacity-5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-10 right-1/3 w-48 h-48 bg-blue-500 opacity-5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-20 left-1/3 w-56 h-56 bg-amber-500 opacity-5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '0.5s'}}></div>
        </div>

        {/* Logo */}
        <div className="mb-8 flex items-center gap-3 z-10">
          <img src="/icon.svg" alt="bnchmrkd icon" className="w-10 h-10" />
          <h1 className="text-4xl font-bold text-white" style={{fontFamily: "'Inter', 'Helvetica Neue', sans-serif"}}>bnchmrkd<span className="text-orange-500">.</span></h1>
        </div>

        {/* Track SVG */}
        <div className="w-full max-w-2xl px-8 mb-8 z-10">
          <svg viewBox="0 0 600 120" className="w-full">
            {/* Track lanes */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map(lane => (
              <g key={lane}>
                <rect x="20" y={10 + lane * 12.5} width="560" height="12" rx="2"
                  fill={lane === 3 ? '#ea580c' : '#334155'} opacity={lane === 3 ? 0.3 : 0.6} />
                <line x1="20" y1={10 + lane * 12.5} x2="580" y2={10 + lane * 12.5}
                  stroke="#475569" strokeWidth="0.5" />
              </g>
            ))}
            {/* Lane lines */}
            <line x1="20" y1="110" x2="580" y2="110" stroke="#475569" strokeWidth="0.5" />

            {/* Start line */}
            <line x1="40" y1="8" x2="40" y2="112" stroke="#fff" strokeWidth="2" opacity="0.5" />
            {/* Finish line */}
            <rect x="555" y="8" width="8" height="104" fill="url(#checkerPattern)" opacity="0.7" />
            <defs>
              <pattern id="checkerPattern" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
                <rect x="0" y="0" width="2" height="2" fill="white" />
                <rect x="2" y="2" width="2" height="2" fill="white" />
                <rect x="2" y="0" width="2" height="2" fill="black" />
                <rect x="0" y="2" width="2" height="2" fill="black" />
              </pattern>
            </defs>

            {/* Runner figure on lane 4 */}
            <g transform={`translate(${40 + (runnerPos / 100) * 510}, ${48})`}>
              {/* Body */}
              <circle r="4" fill="#f97316" />
              {/* Motion trail */}
              <line x1="-12" y1="0" x2="-3" y2="0" stroke="#f97316" strokeWidth="2" opacity="0.4" />
              <line x1="-20" y1="0" x2="-14" y2="0" stroke="#f97316" strokeWidth="1.5" opacity="0.2" />
            </g>

            {/* Progress bar overlay on lane 4 */}
            <rect x="40" y="46" width={Math.max(0, (scrapeProgress.progress) * 515)} height="8" rx="1"
              fill="#f97316" opacity="0.6" />
          </svg>
        </div>

        {/* Progress info */}
        <div className="text-center z-10 max-w-md">
          <p className="text-white text-xl font-semibold mb-2">
            {scrapeProgress.message || 'Preparing...'}{dots}
          </p>
          <p className="text-slate-400 text-sm mb-4">
            {progressPct}% complete
          </p>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {['initializing', 'loading', 'extracting', 'navigating', 'scraping', 'analyzing', 'complete'].map((step, idx) => {
              const isCurrent = scrapeProgress.step === step;
              const isPast = ['initializing', 'loading', 'extracting', 'navigating', 'scraping', 'analyzing', 'complete']
                .indexOf(scrapeProgress.step) > idx;
              return (
                <div key={step} className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isCurrent ? 'bg-orange-500 scale-125 animate-pulse'
                  : isPast ? 'bg-orange-500'
                  : 'bg-slate-600'
                }`} />
              );
            })}
          </div>

          {/* Fun facts while waiting */}
          <div className="bg-slate-800 rounded-lg px-6 py-4 border border-slate-700">
            <p className="text-slate-300 text-sm italic">
              {scrapeProgress.progress < 0.3
                ? '"The 100m final is the most watched event in Olympic history, drawing over 2 billion viewers."'
                : scrapeProgress.progress < 0.5
                ? '"Usain Bolt\'s 9.58s world record has stood since 2009 — over 15 years unchallenged."'
                : scrapeProgress.progress < 0.7
                ? `"Our analysis covers ${STATS.records} career races from ${STATS.athletes} Olympic athletes across 7 Games."`
                : scrapeProgress.progress < 0.9
                ? '"The difference between an Olympic finalist and a semi-finalist is often less than 0.1 seconds."'
                : '"Analysis complete — your results are being prepared..."'
              }
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // HELPER UI FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════
  const getPercentileColor = (p) => p >= 90 ? 'bg-green-500' : p >= 75 ? 'bg-blue-500' : p >= 50 ? 'bg-amber-500' : 'bg-gray-400';
  const getPercentileLabel = (p) => p >= 90 ? 'Elite' : p >= 75 ? 'National' : p >= 50 ? 'Competitive' : 'Developing';

  const getReadinessColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#6b7280';
  };

  // Custom tooltip for trajectory chart
  const TrajectoryTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0 || !analysisResults) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    const disc = analysisResults.discipline;
    const fmtT = (v) => formatTime(v, disc);

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-600 rounded-lg shadow-xl shadow-black/30 p-3 text-sm">
        <p className="font-bold text-white mb-1">Age {label}</p>
        {data.actualTime && (
          <p className="text-orange-400">Actual: {fmtT(data.actualTime)}</p>
        )}
        {data.projectedTime && !data.actualTime && (
          <>
            <p className="text-blue-400">Projected: {fmtT(data.projectedTime)}</p>
            <p className="text-slate-400 text-xs">50% CI: {fmtT(data.ci50Lower)} – {fmtT(data.ci50Upper)}</p>
            <p className="text-slate-400 text-xs">90% CI: {fmtT(data.ci90Lower)} – {fmtT(data.ci90Upper)}</p>
          </>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 overflow-x-hidden">
      {/* Scraping loading overlay */}
      {scraping && <LoadingAnimation />}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* LANDING PAGE                                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'landing' && (
        <div className="min-h-screen" style={{background: 'linear-gradient(165deg, #0a0a0f 0%, #0d1117 30%, #111318 60%, #0a0a0f 100%)'}}>

          {/* ── INJECT GOOGLE FONTS + KEYFRAMES ── */}
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
            @keyframes drawTrajectory { from { stroke-dashoffset: 800; } to { stroke-dashoffset: 0; } }
            @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes fadeSlideRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes pulseGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
            @keyframes countUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            @keyframes trackLines { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
            @keyframes dotPulse { 0%, 100% { r: 3; opacity: 0.6; } 50% { r: 5; opacity: 1; } }
            @keyframes morphIn { from { opacity: 0; transform: scale(0.92) translateY(12px); filter: blur(4px); } to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } }
            @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
            @keyframes orbitDot { 0% { transform: rotate(0deg) translateX(28px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(28px) rotate(-360deg); } }
            @keyframes ringPulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.15); opacity: 0.6; } }
            @keyframes lineReveal { from { stroke-dashoffset: 200; } to { stroke-dashoffset: 0; } }
            @keyframes streakFill { from { width: 0%; } to { width: 100%; } }
            @keyframes sparkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
            @keyframes floatParticle { 0% { opacity: 0; transform: translateY(0) translateX(0); } 15% { opacity: 0.8; } 85% { opacity: 0.6; } 100% { opacity: 0; transform: translateY(-80px) translateX(20px); } }
            @keyframes ribbonReveal { from { opacity: 0; } to { opacity: 0.18; } }
            @keyframes statCount { from { opacity: 0; transform: translateY(8px) scale(0.95); filter: blur(2px); } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
            @keyframes glowPulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.3); } }
            @keyframes indicatorSlide { from { width: 0%; } to { width: 100%; } }
            @keyframes tickerLeft { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            @keyframes tickerRight { from { transform: translateX(-50%); } to { transform: translateX(0); } }
            .showcase-fade { transition: opacity 0.4s ease, transform 0.4s ease, filter 0.4s ease; }
            .showcase-fade-out { opacity: 0; transform: scale(0.97); filter: blur(3px); }
            .showcase-fade-in { opacity: 1; transform: scale(1); filter: blur(0); }
            .trajectory-tooltip { pointer-events: none; position: absolute; background: rgba(10,10,15,0.92); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 8px 12px; backdrop-filter: blur(12px); transition: opacity 0.2s ease, transform 0.15s ease; z-index: 30; }
            .pillar-card { position: relative; cursor: pointer; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
            .pillar-card::before { content: ''; position: absolute; inset: 0; border-radius: 1rem; opacity: 0; transition: opacity 0.5s ease; }
            .pillar-card:hover::before { opacity: 1; }
            .pillar-card-active { transform: translateY(-4px); }
            .pillar-viz { transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
            .role-transition { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
            .landing-font { font-family: 'Instrument Sans', system-ui, sans-serif; }
            .mono-font { font-family: 'DM Mono', 'SF Mono', monospace; }
            .stagger-1 { animation: fadeSlideUp 0.7s ease-out 0.1s both; }
            .stagger-2 { animation: fadeSlideUp 0.7s ease-out 0.25s both; }
            .stagger-3 { animation: fadeSlideUp 0.7s ease-out 0.4s both; }
            .stagger-4 { animation: fadeSlideUp 0.7s ease-out 0.55s both; }
            .stagger-5 { animation: fadeSlideUp 0.7s ease-out 0.7s both; }
            .stagger-6 { animation: fadeSlideUp 0.7s ease-out 0.85s both; }
            .bento-card { backdrop-filter: blur(12px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            .bento-card:hover { transform: translateY(-2px); border-color: rgba(249,115,22,0.3); }
            .cta-primary { background: linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%); transition: all 0.3s ease; }
            .cta-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 40px rgba(249,115,22,0.35); }
            .noise-overlay { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"); }
          `}</style>

          {/* ── ATMOSPHERIC BACKGROUND LAYERS ── */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Noise texture overlay */}
            <div className="absolute inset-0 noise-overlay opacity-40"></div>
            {/* Warm glow — asymmetric, off-centre */}
            <div className="absolute top-[15%] left-[65%] w-[600px] h-[600px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)'}}></div>
            <div className="absolute bottom-[10%] left-[20%] w-[400px] h-[400px] rounded-full blur-[120px]" style={{background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)'}}></div>
            {/* Subtle track lane lines */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.03]" preserveAspectRatio="none">
              {[...Array(8)].map((_, i) => (
                <line key={i} x1="0" y1={`${12 + i * 11}%`} x2="100%" y2={`${12 + i * 11}%`} stroke="#f97316" strokeWidth="0.5" />
              ))}
            </svg>
          </div>

          {/* ── TOP NAV BAR ── */}
          <nav className="relative z-20 stagger-1">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="bnchmrkd" className="w-8 h-8" />
                <span className="text-xl font-bold text-white tracking-tight landing-font">
                  bnchmrkd<span style={{color: '#f97316'}}>.</span>
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <button onClick={() => setCurrentView('about')} className="hidden sm:block text-sm text-slate-500 hover:text-slate-300 transition-colors landing-font font-medium">
                  Methodology
                </button>
                {user ? (
                  <div className="flex items-center gap-2 sm:gap-3">
                    {profile?.account_type === 'coach' && (
                      <button
                        onClick={onOpenDashboard}
                        className="text-sm font-semibold text-black px-3 py-1.5 rounded-lg landing-font"
                        style={{background: '#f97316'}}
                      >
                        Dashboard
                      </button>
                    )}
                    <span className="hidden sm:block text-sm text-slate-400 landing-font">
                      {profile?.full_name || user.email}
                    </span>
                    <button
                      onClick={onSignOut}
                      className="text-sm text-slate-500 hover:text-white transition-colors landing-font font-medium"
                    >
                      Log Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onSignUp}
                    className="text-sm font-semibold text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg landing-font transition-colors hover:text-orange-400"
                    style={{background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)'}}
                  >
                    Log In
                  </button>
                )}
              </div>
            </div>
          </nav>

          {/* ── HERO SECTION ── */}
          <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 pt-8 sm:pt-16 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* LEFT — Copy */}
              <div>
                <h1 className="stagger-3 text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight landing-font mb-6">
                  Put your performance{' '}
                  <span className="hidden sm:inline"><br /></span>
                  in{' '}
                  <span style={{background: 'linear-gradient(135deg, #f97316, #fb923c, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                    Olympic context.
                  </span>
                </h1>

                <p className="stagger-4 text-base sm:text-lg text-slate-400 leading-relaxed max-w-md mb-8 landing-font">
                  Benchmark any track & field athlete against 25 years of Olympic career trajectories. Percentile rankings, peak projections, and finalist probability — all from real competition data.
                </p>

                {/* CTAs */}
                <div className="stagger-5 flex flex-col sm:flex-row gap-3 mb-10">
                  <button
                    onClick={() => setCurrentView('categories')}
                    className="cta-primary flex items-center justify-center gap-2.5 px-7 py-3.5 text-white font-semibold rounded-xl text-[15px] landing-font"
                  >
                    Benchmark an Athlete
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentView('explorer')}
                    className="flex items-center justify-center gap-2.5 px-7 py-3.5 text-slate-300 font-medium rounded-xl text-[15px] landing-font transition-all hover:text-white hover:border-slate-500"
                    style={{background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)'}}
                  >
                    <Search className="w-4 h-4" />
                    Explore Athletes
                  </button>
                </div>

                {/* Data credibility — horizontal, compact */}
                <div className="stagger-6 flex items-center gap-4 sm:gap-8">
                  {[
                    { value: STATS.records, label: 'Records' },
                    { value: STATS.athletes, label: 'Athletes' },
                    { value: STATS.events, label: 'Events' },
                  ].map((stat, i) => (
                    <div key={i} className="flex items-baseline gap-1.5 sm:gap-2">
                      <span className="text-lg sm:text-xl font-bold text-white tabular-nums mono-font">{stat.value}</span>
                      <span className="text-[10px] sm:text-xs text-slate-600 uppercase tracking-widest landing-font font-medium">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — Animated trajectory visualization + bento preview */}
              <div className="stagger-4 relative">
                {/* Main trajectory card */}
                <div className={`bento-card rounded-2xl p-6 relative overflow-hidden showcase-fade ${showcaseTransition ? 'showcase-fade-out' : 'showcase-fade-in'}`} style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>

                  {/* Ambient glow behind chart — colored per athlete */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[200px] rounded-full blur-[80px]" style={{background: `radial-gradient(circle, ${showcaseAthlete.color}15 0%, transparent 70%)`, animation: 'glowPulse 4s ease-in-out infinite'}}></div>
                  </div>

                  {/* Card header */}
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div>
                      <p className="text-xs text-slate-500 mono-font tracking-wide uppercase">Career Trajectory</p>
                      <p className="text-sm font-semibold text-white landing-font mt-0.5">{showcaseAthlete.label}</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{background: 'rgba(34,197,94,0.12)'}}>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span className="text-xs font-medium text-green-400 mono-font">{showcaseAthlete.percentile}th pctl</span>
                    </div>
                  </div>

                  {/* Animated SVG trajectory chart */}
                  <div className="relative">
                    <svg viewBox="0 0 440 200" className="w-full relative z-10" style={{filter: `drop-shadow(0 0 20px ${showcaseAthlete.color}25)`}}>
                      {/* Grid lines */}
                      {[40, 80, 120, 160].map(y => (
                        <line key={y} x1="40" y1={y} x2="420" y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />
                      ))}
                      {/* Age labels */}
                      {showcaseAthlete.ages.map((age, i) => (
                        <text key={`${showcaseIdx}-age-${i}`} x={60 + i * 52} y="195" fill="#475569" fontSize="10" textAnchor="middle" style={{fontFamily: "'DM Mono', monospace"}}>{age}</text>
                      ))}
                      {/* Benchmark corridor (P25-P75) — wide translucent band */}
                      <path d={showcaseAthlete.corridor} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Confidence interval ribbon — gradient fill beneath trajectory */}
                      <path
                        d={`${showcaseAthlete.path} L372,${showcaseAthlete.points[6][1] + 30} L60,${showcaseAthlete.points[0][1] + 30} Z`}
                        fill={`url(#ribbonGrad-${showcaseIdx})`}
                        style={{animation: 'ribbonReveal 1.2s ease-out 1s both'}}
                      />

                      {/* MQT / Finalist threshold */}
                      <line x1="40" y1={showcaseAthlete.mqtY} x2="420" y2={showcaseAthlete.mqtY} stroke="rgba(239,68,68,0.25)" strokeWidth="1" strokeDasharray="6 4" />
                      <text x="425" y={showcaseAthlete.mqtY + 3} fill="rgba(239,68,68,0.5)" fontSize="8" style={{fontFamily: "'DM Mono', monospace"}}>MQT</text>

                      {/* Athlete trajectory — animated draw */}
                      <path
                        key={`traj-${showcaseIdx}`}
                        d={showcaseAthlete.path}
                        fill="none" stroke={`url(#trajGrad-${showcaseIdx})`} strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray="800" style={{animation: 'drawTrajectory 2.5s ease-out 0.3s both'}}
                      />
                      {/* Projection extension — dashed */}
                      <path
                        key={`proj-${showcaseIdx}`}
                        d={showcaseAthlete.projPath}
                        fill="none" stroke={showcaseAthlete.color} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" opacity="0.5"
                        style={{animation: 'fadeSlideUp 0.5s ease-out 2.8s both'}}
                      />

                      {/* Data points with hover interaction */}
                      {showcaseAthlete.points.map(([cx,cy], i) => (
                        <g key={`${showcaseIdx}-pt-${i}`}
                          style={{animation: `fadeSlideUp 0.3s ease-out ${0.8 + i * 0.18}s both`, cursor: 'pointer'}}
                          onMouseEnter={() => setHoveredPoint({ idx: i, cx, cy, age: showcaseAthlete.ages[i] })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          <circle cx={cx} cy={cy} r="16" fill="transparent" />
                          <circle cx={cx} cy={cy} r={hoveredPoint?.idx === i ? 5 : 3} fill={showcaseAthlete.color} style={{transition: 'r 0.15s ease'}} />
                          <circle cx={cx} cy={cy} r={hoveredPoint?.idx === i ? 10 : 6} fill="none" stroke={`${showcaseAthlete.color}4D`} strokeWidth="1" style={{transition: 'r 0.15s ease'}} />
                        </g>
                      ))}

                      {/* Peak marker with pulse */}
                      <g key={`peak-${showcaseIdx}`} style={{animation: 'fadeSlideUp 0.4s ease-out 2.2s both'}}>
                        <circle cx={showcaseAthlete.peakPt[0]} cy={showcaseAthlete.peakPt[1]} r="4" fill={showcaseAthlete.color}>
                          <animate attributeName="r" values="4;7;4" dur="2.5s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={showcaseAthlete.peakPt[0]} cy={showcaseAthlete.peakPt[1]} r="12" fill="none" stroke={`${showcaseAthlete.color}33`} strokeWidth="1">
                          <animate attributeName="r" values="12;20;12" dur="2.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
                        </circle>
                        <text x={showcaseAthlete.peakPt[0]} y={showcaseAthlete.peakPt[1] - 14} fill={showcaseAthlete.color} fontSize="9" textAnchor="middle" fontWeight="600" style={{fontFamily: "'DM Mono', monospace"}}>{showcaseAthlete.peakLabel}</text>
                      </g>

                      {/* Floating particles along trajectory */}
                      {[0.2, 0.45, 0.7].map((t, i) => {
                        const ptIdx = Math.floor(t * (showcaseAthlete.points.length - 1));
                        const [px, py] = showcaseAthlete.points[ptIdx];
                        return (
                          <circle key={`particle-${showcaseIdx}-${i}`} cx={px + (i * 8 - 8)} cy={py} r="1.5" fill={showcaseAthlete.color} opacity="0"
                            style={{animation: `floatParticle ${2.5 + i * 0.5}s ease-out ${2 + i * 1.2}s infinite`}} />
                        );
                      })}

                      {/* Gradient definitions */}
                      <defs>
                        <linearGradient id={`trajGrad-${showcaseIdx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={showcaseAthlete.color} stopOpacity="0.7" />
                          <stop offset="50%" stopColor={showcaseAthlete.color} />
                          <stop offset="100%" stopColor={showcaseAthlete.color} stopOpacity="0.8" />
                        </linearGradient>
                        <linearGradient id={`ribbonGrad-${showcaseIdx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor={showcaseAthlete.color} stopOpacity="0.15" />
                          <stop offset="100%" stopColor={showcaseAthlete.color} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Hover tooltip */}
                    {hoveredPoint && (
                      <div className="trajectory-tooltip" style={{
                        left: `${(hoveredPoint.cx / 440) * 100}%`,
                        top: `${(hoveredPoint.cy / 200) * 100 - 18}%`,
                        transform: 'translate(-50%, -100%)',
                      }}>
                        <p className="text-[10px] text-slate-400 mono-font">Age {hoveredPoint.age}</p>
                        <p className="text-xs font-bold mono-font" style={{color: showcaseAthlete.color}}>Season Best</p>
                      </div>
                    )}
                  </div>

                  {/* Mini stats row below chart — animated counters */}
                  <div className="flex items-center justify-between mt-4 pt-4 relative z-10" style={{borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                    {[
                      { label: 'Personal Best', value: showcaseAthlete.pb, color: showcaseAthlete.color },
                      { label: 'Peak Age', value: showcaseAthlete.peakAge, color: '#3b82f6' },
                      { label: 'Trajectory', value: showcaseAthlete.trajectory, color: '#22c55e' },
                    ].map((item, i) => (
                      <div key={`${showcaseIdx}-stat-${i}`} className="text-center" style={{animation: `statCount 0.4s ease-out ${0.3 + i * 0.12}s both`}}>
                        <p className="text-[10px] text-slate-600 mono-font uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-bold mono-font mt-0.5" style={{color: item.color}}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Cycling indicator dots */}
                  <div className="flex items-center justify-center gap-2 mt-3 relative z-10">
                    {SHOWCASE_ATHLETES.map((_, i) => (
                      <button key={i} onClick={() => { setShowcaseTransition(true); setTimeout(() => { setShowcaseIdx(i); setShowcaseTransition(false); }, 400); }}
                        className="relative w-6 h-1 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.08)'}}>
                        {i === showcaseIdx && (
                          <div className="absolute inset-0 rounded-full" style={{background: showcaseAthlete.color, animation: 'indicatorSlide 5.5s linear both'}}></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Floating mini bento cards */}
                <div className={`grid grid-cols-2 gap-3 mt-3 showcase-fade ${showcaseTransition ? 'showcase-fade-out' : 'showcase-fade-in'}`}>
                  {/* Percentile gauge card */}
                  <div className="bento-card rounded-xl p-4 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <p className="text-[10px] text-slate-600 mono-font uppercase tracking-wider mb-2">Percentile</p>
                    <div className="flex items-end gap-1">
                      {showcaseAthlete.bars.map((h, i) => {
                        const maxIdx = showcaseAthlete.bars.indexOf(Math.max(...showcaseAthlete.bars));
                        return (
                          <div key={`${showcaseIdx}-bar-${i}`} className="flex-1 rounded-sm relative" style={{
                            height: `${h * 0.4}px`,
                            background: i === maxIdx ? `linear-gradient(to top, ${showcaseAthlete.color}CC, ${showcaseAthlete.color})` : 'rgba(148,163,184,0.08)',
                            transformOrigin: 'bottom',
                            animation: `barGrow 0.5s ease-out ${0.1 + i * 0.06}s both`
                          }}>
                            {i === maxIdx && (
                              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{background: showcaseAthlete.color, boxShadow: `0 0 6px ${showcaseAthlete.color}`}}></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-right text-lg font-bold text-white mono-font mt-2">P{showcaseAthlete.percentile}</p>
                  </div>

                  {/* Discipline coverage card */}
                  <div className="bento-card rounded-xl p-4 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <p className="text-[10px] text-slate-600 mono-font uppercase tracking-wider mb-2">Disciplines</p>
                    <div className="flex flex-wrap gap-1.5">
                      {showcaseAthlete.tags.map((d, i) => (
                        <span key={`${showcaseIdx}-tag-${i}`} className="px-2 py-0.5 rounded text-[10px] font-medium mono-font" style={{
                          background: `${showcaseAthlete.color}1A`,
                          color: showcaseAthlete.color,
                          animation: `fadeSlideUp 0.3s ease-out ${0.2 + i * 0.08}s both`
                        }}>{d}</span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 landing-font">{showcaseAthlete.tagLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── WHO ARE YOU? — Interactive Role Selector + Pillars ── */}
          <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-20">
            {/* Animated background glow that shifts with role */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="role-transition absolute top-[20%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[180px]" style={{
                background: landingRole === 'coach'
                  ? 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)',
              }}></div>
            </div>

            <div style={{borderTop: '1px solid rgba(255,255,255,0.04)'}}>

              {/* Section header */}
              <div className="text-center pt-16 mb-6">
                <p className="text-xs mono-font uppercase tracking-[0.25em] mb-4 role-transition" style={{color: landingRole === 'coach' ? '#3b82f6' : '#22c55e'}}>Four pillars. One platform.</p>
                <h2 className="text-2xl sm:text-4xl font-bold text-white landing-font tracking-tight mb-4">
                  How will you use{' '}
                  <span style={{background: 'linear-gradient(135deg, #f97316, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                    bnchmrkd?
                  </span>
                </h2>
              </div>

              {/* Role Toggle — pill style with sliding indicator */}
              <div className="flex justify-center mb-14">
                <div className="relative inline-flex rounded-full p-1" style={{background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  {/* Sliding pill background */}
                  <div className="absolute top-1 bottom-1 rounded-full role-transition" style={{
                    width: 'calc(50% - 4px)',
                    left: landingRole === 'athlete' ? '4px' : 'calc(50% + 0px)',
                    background: landingRole === 'athlete'
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.1))'
                      : 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(59,130,246,0.1))',
                    border: `1px solid ${landingRole === 'athlete' ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    boxShadow: landingRole === 'athlete'
                      ? '0 0 20px rgba(34,197,94,0.15)'
                      : '0 0 20px rgba(59,130,246,0.15)',
                  }}></div>
                  <button
                    onClick={() => setLandingRole('athlete')}
                    className="relative z-10 px-8 py-2.5 rounded-full text-sm font-semibold landing-font transition-colors duration-300"
                    style={{color: landingRole === 'athlete' ? '#4ade80' : '#64748b'}}
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      I'm an Athlete
                    </span>
                  </button>
                  <button
                    onClick={() => setLandingRole('coach')}
                    className="relative z-10 px-8 py-2.5 rounded-full text-sm font-semibold landing-font transition-colors duration-300"
                    style={{color: landingRole === 'coach' ? '#60a5fa' : '#64748b'}}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      I'm a Coach
                    </span>
                  </button>
                </div>
              </div>

              {/* Pillars — 2-row layout: cards on top, expanded detail below */}
              {(() => {
                const pillars = [
                  {
                    word: 'Benchmark',
                    icon: Target,
                    accent: '#f97316',
                    athlete: {
                      headline: 'Know where you stand',
                      desc: `Enter your PB and instantly see how you compare to Olympic athletes at the same age. Based on ${STATS.records} real competition records.`,
                      stat: STATS.records,
                      statLabel: 'data points',
                    },
                    coach: {
                      headline: 'See who\'s on track',
                      desc: 'View each athlete\'s percentile ranking against elite trajectories. Spot who\'s tracking toward elite and who needs a new approach.',
                      stat: STATS.events,
                      statLabel: 'events covered',
                    },
                  },
                  {
                    word: 'Track',
                    icon: Activity,
                    accent: '#3b82f6',
                    athlete: {
                      headline: 'See your progression',
                      desc: 'Log competitions, training sessions, and physical metrics. Every entry builds your personal trajectory curve — a living picture of your development.',
                      stat: '<15s',
                      statLabel: 'to log a session',
                    },
                    coach: {
                      headline: 'Manage your squad',
                      desc: 'Build your roster, log results after meets, and track every metric on one dashboard. Bulk-log an entire competition in minutes.',
                      stat: '3 min',
                      statLabel: 'to log a meet',
                    },
                  },
                  {
                    word: 'Project',
                    icon: TrendingUp,
                    accent: '#22c55e',
                    athlete: {
                      headline: 'See where you could go',
                      desc: 'Overlay your trajectory against elite athletes who were at your level at your age. See the paths they took and where you\'re heading.',
                      stat: '25 yrs',
                      statLabel: 'of Olympic data',
                    },
                    coach: {
                      headline: 'Plan with data',
                      desc: 'Compare any athlete\'s trajectory against historical elites. Use real progression data to set targets and adjust training plans with confidence.',
                      stat: STATS.athletes,
                      statLabel: 'elite careers mapped',
                    },
                  },
                  {
                    word: 'Commit',
                    icon: Award,
                    accent: '#f59e0b',
                    athlete: {
                      headline: 'Build the habit',
                      desc: 'Training streaks, consistency tracking, milestone badges, and session ratings. The app rewards showing up — not just on competition day.',
                      stat: '47',
                      statLabel: 'avg sessions logged',
                    },
                    coach: {
                      headline: 'Keep athletes engaged',
                      desc: 'See who\'s logging consistently and who\'s gone quiet. Assign workouts, track completion, and know who needs a check-in before you ask.',
                      stat: '85%',
                      statLabel: 'logging consistency',
                    },
                  },
                ];

                const ap = pillars[activePillar];
                const apContent = landingRole === 'coach' ? ap.coach : ap.athlete;
                const ApIcon = ap.icon;

                // Mini SVG visualizations for each pillar
                const PillarViz = ({ index, isActive }) => {
                  const w = isActive ? 280 : 64;
                  const h = isActive ? 100 : 48;

                  if (index === 0) {
                    // Benchmark — animated bar chart (percentile bars)
                    const bars = [35, 52, 68, 78, 92, 88, 85];
                    return (
                      <svg width={w} height={h} viewBox={isActive ? "0 0 280 100" : "0 0 64 48"}>
                        {bars.map((val, i) => {
                          const barH = isActive ? val * 0.8 : val * 0.35;
                          const barW = isActive ? 28 : 6;
                          const gap = isActive ? 12 : 3;
                          const x = isActive ? 10 + i * (barW + gap) : 2 + i * (barW + gap);
                          const y = (isActive ? 95 : 45) - barH;
                          return (
                            <rect key={i} x={x} y={y} width={barW} height={barH} rx={isActive ? 4 : 1.5}
                              fill={i === 4 ? ap.accent : 'rgba(148,163,184,0.15)'}
                              style={{transformOrigin: `${x + barW/2}px ${isActive ? 95 : 45}px`, animation: isActive ? `barGrow 0.6s ease-out ${i * 0.06}s both` : 'none'}}
                            />
                          );
                        })}
                        {isActive && <text x="268" y="18" fill={ap.accent} fontSize="14" fontWeight="700" style={{fontFamily: "'DM Mono', monospace"}}>P92</text>}
                      </svg>
                    );
                  }
                  if (index === 1) {
                    // Track — animated line chart (progression)
                    const points = isActive
                      ? [[10,75],[50,65],[95,55],[140,40],[185,32],[230,28],[270,24]]
                      : [[2,38],[12,32],[22,26],[32,20],[42,16],[52,13],[62,11]];
                    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
                    return (
                      <svg width={w} height={h} viewBox={isActive ? "0 0 280 100" : "0 0 64 48"}>
                        {isActive && [25,50,75].map(y => <line key={y} x1="10" y1={y} x2="270" y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />)}
                        <path d={path} fill="none" stroke={pillars[1].accent} strokeWidth={isActive ? 2.5 : 1.5} strokeLinecap="round" strokeLinejoin="round"
                          strokeDasharray="400" style={{animation: isActive ? 'lineReveal 1.2s ease-out 0.2s both' : 'none'}} />
                        {isActive && points.map((p, i) => (
                          <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={pillars[1].accent} style={{animation: `fadeSlideUp 0.3s ease-out ${0.4 + i * 0.08}s both`}} />
                        ))}
                        {!isActive && <circle cx={points[points.length-1][0]} cy={points[points.length-1][1]} r="2" fill={pillars[1].accent} />}
                      </svg>
                    );
                  }
                  if (index === 2) {
                    // Project — trajectory overlay (two paths converging)
                    return (
                      <svg width={w} height={h} viewBox={isActive ? "0 0 280 100" : "0 0 64 48"}>
                        {isActive ? (
                          <>
                            <path d="M10,80 C60,70 110,55 160,40 S230,20 270,15" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="8" strokeLinecap="round" />
                            <path d="M10,85 C70,75 120,60 170,42 S240,22 270,18" fill="none" stroke={pillars[2].accent} strokeWidth="2.5" strokeLinecap="round"
                              strokeDasharray="400" style={{animation: 'lineReveal 1.5s ease-out 0.2s both'}} />
                            <path d="M10,90 C80,82 130,68 180,55 S240,35 270,28" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4"
                              style={{opacity: 0.6, animation: 'lineReveal 1.5s ease-out 0.5s both'}} />
                            <text x="270" y="12" fill={pillars[2].accent} fontSize="9" fontWeight="600" textAnchor="end" style={{fontFamily: "'DM Mono', monospace", animation: 'fadeSlideUp 0.4s ease-out 1.5s both'}}>ELITE PATH</text>
                            <text x="270" y="38" fill="#f97316" fontSize="9" fontWeight="600" textAnchor="end" style={{fontFamily: "'DM Mono', monospace", opacity: 0.7, animation: 'fadeSlideUp 0.4s ease-out 1.7s both'}}>YOUR PATH</text>
                          </>
                        ) : (
                          <>
                            <path d="M2,40 C15,35 28,25 42,18 S55,10 62,8" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="4" strokeLinecap="round" />
                            <path d="M2,42 C18,36 30,28 45,20 S56,12 62,10" fill="none" stroke={pillars[2].accent} strokeWidth="1.5" strokeLinecap="round" />
                          </>
                        )}
                      </svg>
                    );
                  }
                  // Commit — streak/calendar visualization
                  const days = [1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1];
                  if (isActive) {
                    return (
                      <svg width={280} height={100} viewBox="0 0 280 100">
                        <text x="10" y="18" fill="rgba(148,163,184,0.4)" fontSize="9" style={{fontFamily: "'DM Mono', monospace"}}>TRAINING STREAK</text>
                        {days.map((d, i) => {
                          const row = Math.floor(i / 7);
                          const col = i % 7;
                          return (
                            <rect key={i} x={10 + col * 20} y={28 + row * 20} width={14} height={14} rx={3}
                              fill={d ? pillars[3].accent : 'rgba(148,163,184,0.08)'}
                              opacity={d ? 0.15 + (i / days.length) * 0.85 : 1}
                              style={{animation: `fadeSlideUp 0.2s ease-out ${i * 0.03}s both`}}
                            />
                          );
                        })}
                        <text x="170" y="42" fill={pillars[3].accent} fontSize="28" fontWeight="700" style={{fontFamily: "'DM Mono', monospace", animation: 'fadeSlideUp 0.4s ease-out 0.5s both'}}>18</text>
                        <text x="170" y="58" fill="rgba(148,163,184,0.5)" fontSize="10" style={{fontFamily: "'DM Mono', monospace", animation: 'fadeSlideUp 0.4s ease-out 0.6s both'}}>day streak</text>
                        <rect x="170" y="70" width="100" height="6" rx="3" fill="rgba(148,163,184,0.08)" />
                        <rect x="170" y="70" width="0" height="6" rx="3" fill={pillars[3].accent} style={{animation: 'streakFill 1.2s ease-out 0.7s forwards', width: '85%'}} />
                      </svg>
                    );
                  }
                  return (
                    <svg width={64} height={48} viewBox="0 0 64 48">
                      {days.slice(0, 14).map((d, i) => {
                        const row = Math.floor(i / 7);
                        const col = i % 7;
                        return (
                          <rect key={i} x={2 + col * 8.5} y={6 + row * 10} width={6} height={6} rx={1.5}
                            fill={d ? pillars[3].accent : 'rgba(148,163,184,0.08)'}
                            opacity={d ? 0.3 + (i / 14) * 0.7 : 1}
                          />
                        );
                      })}
                      <text x="32" y="42" fill={pillars[3].accent} fontSize="10" fontWeight="700" textAnchor="center" style={{fontFamily: "'DM Mono', monospace"}}>18d</text>
                    </svg>
                  );
                };

                return (
                  <>
                    {/* Pillar selector tabs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                      {pillars.map((pillar, i) => {
                        const Icon = pillar.icon;
                        const isActive = activePillar === i;
                        const content = landingRole === 'coach' ? pillar.coach : pillar.athlete;
                        return (
                          <button
                            key={pillar.word}
                            onClick={() => setActivePillar(i)}
                            className={`pillar-card group relative rounded-2xl text-left overflow-hidden ${isActive ? 'pillar-card-active' : ''}`}
                            style={{
                              background: isActive
                                ? `linear-gradient(145deg, ${pillar.accent}12 0%, ${pillar.accent}06 50%, rgba(255,255,255,0.02) 100%)`
                                : 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                              border: isActive ? `1px solid ${pillar.accent}40` : '1px solid rgba(255,255,255,0.06)',
                              boxShadow: isActive ? `0 8px 40px ${pillar.accent}15, 0 0 0 1px ${pillar.accent}10` : 'none',
                              padding: '1.25rem',
                            }}
                          >
                            {/* Active glow effect */}
                            {isActive && (
                              <div className="absolute top-0 left-0 right-0 h-px" style={{background: `linear-gradient(90deg, transparent, ${pillar.accent}60, transparent)`}}></div>
                            )}

                            {/* Header row: icon + mini viz */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center role-transition" style={{
                                background: isActive ? `${pillar.accent}20` : `${pillar.accent}10`,
                                boxShadow: isActive ? `0 0 20px ${pillar.accent}20` : 'none',
                              }}>
                                <Icon className="w-5 h-5 role-transition" style={{color: isActive ? pillar.accent : `${pillar.accent}90`}} />
                              </div>
                              {/* Mini visualization (hidden on mobile when not active) */}
                              <div className="hidden sm:block opacity-60">
                                <PillarViz index={i} isActive={false} />
                              </div>
                            </div>

                            {/* Pillar name + headline */}
                            <h3 className="text-lg font-bold text-white landing-font tracking-tight mb-0.5">{pillar.word}</h3>
                            <p className="text-xs font-medium landing-font role-transition" style={{color: isActive ? pillar.accent : 'rgba(148,163,184,0.6)'}}>
                              {content.headline}
                            </p>

                            {/* Stat line */}
                            <div className="flex items-baseline gap-1.5 mt-3">
                              <span className="text-base font-bold mono-font role-transition" style={{color: isActive ? pillar.accent : 'rgba(148,163,184,0.4)'}}>{content.stat}</span>
                              <span className="text-[9px] text-slate-600 mono-font uppercase tracking-wider">{content.statLabel}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Expanded detail panel for active pillar */}
                    <div
                      key={`${activePillar}-${landingRole}`}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${ap.accent}08 0%, rgba(255,255,255,0.02) 40%, ${ap.accent}04 100%)`,
                        border: `1px solid ${ap.accent}25`,
                        animation: 'morphIn 0.45s ease-out both',
                      }}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                        {/* Left: content */}
                        <div className="p-8 sm:p-10 flex flex-col justify-center">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background: `${ap.accent}18`, boxShadow: `0 0 30px ${ap.accent}15`}}>
                              <ApIcon className="w-6 h-6" style={{color: ap.accent}} />
                            </div>
                            <div>
                              <h3 className="text-xl sm:text-2xl font-bold text-white landing-font tracking-tight">{ap.word}</h3>
                              <p className="text-sm font-medium landing-font" style={{color: ap.accent}}>{apContent.headline}</p>
                            </div>
                          </div>
                          <p className="text-sm text-slate-400 leading-relaxed landing-font mb-6 max-w-md">{apContent.desc}</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold mono-font" style={{color: ap.accent}}>{apContent.stat}</span>
                            <span className="text-xs text-slate-500 mono-font uppercase tracking-wider">{apContent.statLabel}</span>
                          </div>
                        </div>
                        {/* Right: visualization */}
                        <div className="flex items-center justify-center p-8 sm:p-10" style={{background: `${ap.accent}04`, borderLeft: `1px solid ${ap.accent}10`}}>
                          <div className="pillar-viz">
                            <PillarViz index={activePillar} isActive={true} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* CTA below pillars */}
              <div className="text-center mt-12">
                {user ? (
                  <button
                    onClick={() => setCurrentView('categories')}
                    className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-[15px] font-semibold text-white landing-font transition-all"
                    style={{background: landingRole === 'coach' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)', border: landingRole === 'coach' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(34,197,94,0.3)'}}
                  >
                    {landingRole === 'coach' ? 'Go to Dashboard' : 'Start Tracking'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                    <button
                      onClick={onSignUp}
                      className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-[15px] font-semibold landing-font transition-all"
                      style={{
                        background: landingRole === 'coach' ? '#3b82f6' : '#22c55e',
                        color: landingRole === 'coach' ? '#fff' : '#000',
                        boxShadow: landingRole === 'coach' ? '0 8px 30px rgba(59,130,246,0.3)' : '0 8px 30px rgba(34,197,94,0.3)',
                      }}
                    >
                      {landingRole === 'coach' ? 'Create Coach Account' : 'Create Athlete Account'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentView('categories')}
                      className="inline-flex items-center gap-2 px-6 py-3 text-sm text-slate-400 hover:text-white landing-font font-medium transition-colors"
                    >
                      Or try the free tools first
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── FEATURE STRIP — Analysis capabilities ── */}
          <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-16">
            <div style={{borderTop: '1px solid rgba(255,255,255,0.04)'}}>
              <div className="text-center pt-12 mb-8">
                <p className="text-xs mono-font uppercase tracking-[0.25em] mb-3" style={{color: '#64748b'}}>Under the hood</p>
                <h3 className="text-lg sm:text-xl font-bold text-white landing-font">Built on real statistical analysis</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: TrendingUp, title: 'Trajectory Classification', desc: 'K-means clustering identifies your career pattern — Early Peaker, Late Developer, or Consistent Performer.', accent: '#f97316' },
                  { icon: Target, title: 'Finalist Probability', desc: 'ROC-optimised thresholds compute your statistical likelihood of reaching an Olympic final.', accent: '#3b82f6' },
                  { icon: BarChart3, title: 'Percentile Corridors', desc: 'See where you rank at every age from 15 to 38 against the full Olympic population.', accent: '#22c55e' },
                  { icon: Zap, title: 'Peak Projection', desc: 'Improvement rate modelling projects your ceiling performance and the age you\'ll reach it.', accent: '#f59e0b' },
                ].map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <div key={i} className="group" style={{animation: `fadeSlideUp 0.6s ease-out ${0.9 + i * 0.12}s both`}}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{background: `${feature.accent}12`}}>
                        <Icon className="w-5 h-5" style={{color: feature.accent}} />
                      </div>
                      <h3 className="text-sm font-bold text-white landing-font mb-1.5">{feature.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed landing-font">{feature.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── BOTTOM SOURCE LINE ── */}
          <div className="relative z-10 text-center pb-8 px-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-8 h-px" style={{background: 'rgba(255,255,255,0.08)'}}></div>
              <span className="text-[10px] text-slate-600 mono-font uppercase tracking-[0.2em]">Data Source</span>
              <div className="w-8 h-px" style={{background: 'rgba(255,255,255,0.08)'}}></div>
            </div>
            <p className="text-xs text-slate-600 landing-font">
              World Athletics competition records · Sydney 2000 – Paris 2024
            </p>
            <button onClick={() => setCurrentView('about')} className="text-xs text-slate-600 hover:text-orange-400 transition-colors mt-1 landing-font underline decoration-slate-700 underline-offset-2">
              View methodology
            </button>
            <div className="flex items-center justify-center gap-5 mt-5">
              <a href="https://instagram.com/bnchmrkd.hq" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-slate-500 hover:text-orange-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a href="https://tiktok.com/@bnchmrkd" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-slate-500 hover:text-orange-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.74a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.17z"/>
                </svg>
              </a>
              <a href="https://x.com/bnchmrkd" target="_blank" rel="noopener noreferrer" aria-label="X" className="text-slate-500 hover:text-orange-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <span className="text-slate-700">·</span>
              <a href="mailto:hello@bnchmrkd.org" className="text-[10px] text-slate-500 hover:text-orange-400 transition-colors landing-font">hello@bnchmrkd.org</a>
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-slate-700 landing-font">
              <button onClick={() => setCurrentView('privacy')} className="hover:text-orange-400 transition-colors">Privacy Policy</button>
              <span className="text-slate-800">·</span>
              <button onClick={() => setCurrentView('terms')} className="hover:text-orange-400 transition-colors">Terms of Service</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PRIVACY POLICY                                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'privacy' && (
        <PrivacyPolicy onBack={() => setCurrentView('landing')} />
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TERMS OF SERVICE                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'terms' && (
        <TermsOfService onBack={() => setCurrentView('landing')} />
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ABOUT OUR DATA PAGE                                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'about' && (
        <div className="min-h-screen" style={{background: 'linear-gradient(165deg, #0a0a0f 0%, #0d1117 30%, #111318 60%, #0a0a0f 100%)'}}>
          {/* Atmospheric background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 noise-overlay opacity-40"></div>
            <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)'}}></div>
            <div className="absolute bottom-[20%] left-[15%] w-[400px] h-[400px] rounded-full blur-[120px]" style={{background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)'}}></div>
          </div>

          {/* Header */}
          <nav className="relative z-20 stagger-1" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
            <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
              <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors landing-font">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="bnchmrkd" className="w-7 h-7" />
                <span className="text-lg font-bold text-white tracking-tight landing-font">bnchmrkd<span style={{color: '#f97316'}}>.</span></span>
              </div>
              <div className="w-20"></div>
            </div>
          </nav>

          <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-10 py-8 sm:py-12">
            {/* Page title */}
            <div className="text-center mb-8 sm:mb-14 stagger-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mono-font tracking-wide mb-5" style={{background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa'}}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" style={{animation: 'pulseGlow 2s ease-in-out infinite'}}></span>
                METHODOLOGY
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 landing-font tracking-tight">About Our Data</h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto landing-font leading-relaxed">
                Every insight is grounded in real Olympic data. Here's what powers the analysis.
              </p>
            </div>

            {/* ── Scrolling discipline ticker ── */}
            <div className="stagger-3 mb-14 relative overflow-hidden" style={{maskImage: 'linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)'}}>
              {/* Row 1 — scrolls left */}
              <div className="flex gap-3 mb-3" style={{animation: 'tickerLeft 45s linear infinite', width: 'max-content'}}>
                {[...Array(2)].flatMap((_, rep) => [
                  { disc: '100m', gender: 'M', threshold: '10.15s', accent: '#3b82f6' },
                  { disc: '200m', gender: 'F', threshold: '23.55s', accent: '#ec4899' },
                  { disc: 'Shot Put', gender: 'M', threshold: '21.50m', accent: '#3b82f6' },
                  { disc: '400m Hurdles', gender: 'F', threshold: '57.70s', accent: '#ec4899' },
                  { disc: '3000m SC', gender: 'M', threshold: '8:16.91', accent: '#3b82f6' },
                  { disc: 'Javelin', gender: 'F', threshold: '65.00m', accent: '#ec4899' },
                  { disc: '10000m', gender: 'M', threshold: '27:22.44', accent: '#3b82f6' },
                  { disc: '400m', gender: 'F', threshold: '52.65s', accent: '#ec4899' },
                  { disc: 'Discus', gender: 'M', threshold: '67.50m', accent: '#3b82f6' },
                  { disc: '100m Hurdles', gender: 'F', threshold: '13.28s', accent: '#ec4899' },
                  { disc: '5000m', gender: 'M', threshold: '13:03.87', accent: '#3b82f6' },
                  { disc: 'Hammer', gender: 'F', threshold: '75.00m', accent: '#ec4899' },
                  { disc: '200m', gender: 'M', threshold: '20.62s', accent: '#3b82f6' },
                ].map((item, i) => (
                  <div key={`r1-${rep}-${i}`} className="flex items-center gap-2 px-4 py-2.5 rounded-lg flex-shrink-0" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background: item.accent}}></span>
                    <span className="text-xs font-semibold text-white whitespace-nowrap landing-font">{item.disc}</span>
                    <span className="text-[10px] font-medium mono-font px-1.5 py-0.5 rounded" style={{background: item.gender === 'M' ? 'rgba(59,130,246,0.12)' : 'rgba(236,72,153,0.12)', color: item.accent}}>{item.gender}</span>
                    <span className="text-xs font-bold mono-font whitespace-nowrap" style={{color: '#f97316'}}>{item.threshold}</span>
                  </div>
                )))}
              </div>
              {/* Row 2 — scrolls right */}
              <div className="flex gap-3" style={{animation: 'tickerRight 50s linear infinite', width: 'max-content'}}>
                {[...Array(2)].flatMap((_, rep) => [
                  { disc: '100m', gender: 'F', threshold: '11.50s', accent: '#ec4899' },
                  { disc: '400m', gender: 'M', threshold: '44.64s', accent: '#3b82f6' },
                  { disc: 'Discus', gender: 'F', threshold: '65.00m', accent: '#ec4899' },
                  { disc: '110m Hurdles', gender: 'M', threshold: '13.80s', accent: '#3b82f6' },
                  { disc: '5000m', gender: 'F', threshold: '14:54.29', accent: '#ec4899' },
                  { disc: 'Hammer', gender: 'M', threshold: '79.00m', accent: '#3b82f6' },
                  { disc: '3000m SC', gender: 'F', threshold: '9:26.32', accent: '#ec4899' },
                  { disc: 'Shot Put', gender: 'F', threshold: '19.50m', accent: '#ec4899' },
                  { disc: '400m Hurdles', gender: 'M', threshold: '48.17s', accent: '#3b82f6' },
                  { disc: '10000m', gender: 'F', threshold: '31:08.89', accent: '#ec4899' },
                  { disc: 'Javelin', gender: 'M', threshold: '88.00m', accent: '#3b82f6' },
                  { disc: '100m', gender: 'M', threshold: '10.15s', accent: '#3b82f6' },
                  { disc: '400m', gender: 'F', threshold: '52.65s', accent: '#ec4899' },
                ].map((item, i) => (
                  <div key={`r2-${rep}-${i}`} className="flex items-center gap-2 px-4 py-2.5 rounded-lg flex-shrink-0" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background: item.accent}}></span>
                    <span className="text-xs font-semibold text-white whitespace-nowrap landing-font">{item.disc}</span>
                    <span className="text-[10px] font-medium mono-font px-1.5 py-0.5 rounded" style={{background: item.gender === 'M' ? 'rgba(59,130,246,0.12)' : 'rgba(236,72,153,0.12)', color: item.accent}}>{item.gender}</span>
                    <span className="text-xs font-bold mono-font whitespace-nowrap" style={{color: '#f97316'}}>{item.threshold}</span>
                  </div>
                )))}
              </div>
            </div>

            {/* ── Key stats row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14 stagger-4">
              {[
                { value: STATS.athletes, label: 'Olympic Athletes', sub: STATS.games },
                { value: STATS.records, label: 'Career Results', sub: 'Analysed and classified' },
                { value: STATS.events, label: 'Events', sub: 'Sprints, throws & distance' },
                { value: '7', label: 'Olympic Games', sub: 'Two decades of data' },
              ].map((stat, i) => (
                <div key={i} className="bento-card rounded-xl p-5 text-center" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  <p className="text-2xl sm:text-3xl font-bold mono-font" style={{color: '#f97316'}}>{stat.value}</p>
                  <p className="text-sm font-semibold text-white mt-1 landing-font">{stat.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5 landing-font">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Discipline coverage — categorised ── */}
            <div className="bento-card rounded-2xl p-6 sm:p-8 mb-10 stagger-5" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background: 'rgba(249,115,22,0.1)'}}>
                  <BarChart3 className="w-4 h-4" style={{color: '#f97316'}} />
                </div>
                <h3 className="text-lg font-bold text-white landing-font">Discipline Coverage</h3>
              </div>
              <p className="text-xs text-slate-600 mb-6 landing-font ml-11">Finalist thresholds derived from ROC/AUC analysis with Youden's J optimisation across all {STATS.events} events.</p>

              {/* Category sections */}
              {[
                {
                  category: 'Sprints & Hurdles',
                  accent: '#3b82f6',
                  count: '12 events',
                  rows: [
                    { disc: '100m', gender: 'Male', threshold: '10.15s', mean: '10.45s' },
                    { disc: '100m', gender: 'Female', threshold: '11.50s', mean: '11.65s' },
                    { disc: '200m', gender: 'Male', threshold: '20.62s', mean: '21.05s' },
                    { disc: '200m', gender: 'Female', threshold: '23.55s', mean: '23.75s' },
                    { disc: '400m', gender: 'Male', threshold: '44.64s', mean: '45.18s' },
                    { disc: '400m', gender: 'Female', threshold: '52.65s', mean: '53.60s' },
                    { disc: '100m Hurdles', gender: 'Female', threshold: '13.28s', mean: '13.55s' },
                    { disc: '110m Hurdles', gender: 'Male', threshold: '13.80s', mean: '13.85s' },
                    { disc: '400m Hurdles', gender: 'Male', threshold: '48.17s', mean: '48.67s' },
                    { disc: '400m Hurdles', gender: 'Female', threshold: '57.70s', mean: '58.20s' },
                  ]
                },
                {
                  category: 'Throws',
                  accent: '#22c55e',
                  count: '8 events',
                  rows: [
                    { disc: 'Discus Throw', gender: 'Male', threshold: '67.50m', mean: '65.00m' },
                    { disc: 'Discus Throw', gender: 'Female', threshold: '65.00m', mean: '62.00m' },
                    { disc: 'Javelin Throw', gender: 'Male', threshold: '88.00m', mean: '85.00m' },
                    { disc: 'Javelin Throw', gender: 'Female', threshold: '65.00m', mean: '62.00m' },
                    { disc: 'Hammer Throw', gender: 'Male', threshold: '79.00m', mean: '76.00m' },
                    { disc: 'Hammer Throw', gender: 'Female', threshold: '75.00m', mean: '72.00m' },
                    { disc: 'Shot Put', gender: 'Male', threshold: '21.50m', mean: '20.00m' },
                    { disc: 'Shot Put', gender: 'Female', threshold: '19.50m', mean: '18.50m' },
                  ]
                },
                {
                  category: 'Long Distance',
                  accent: '#f43f5e',
                  count: '6 events',
                  rows: [
                    { disc: '3000m Steeplechase', gender: 'Male', threshold: '8:16.91', mean: '8:16.06' },
                    { disc: '3000m Steeplechase', gender: 'Female', threshold: '9:26.32', mean: '9:22.09' },
                    { disc: '5000m', gender: 'Male', threshold: '13:03.87', mean: '13:13.86' },
                    { disc: '5000m', gender: 'Female', threshold: '14:54.29', mean: '15:08.46' },
                    { disc: '10000m', gender: 'Male', threshold: '27:22.44', mean: '27:19.92' },
                    { disc: '10000m', gender: 'Female', threshold: '31:08.89', mean: '31:03.83' },
                  ]
                },
              ].map((section, si) => (
                <div key={si} className={si > 0 ? 'mt-6' : ''}>
                  {/* Category header */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-1 h-5 rounded-full" style={{background: section.accent}}></div>
                    <span className="text-sm font-bold text-white landing-font">{section.category}</span>
                    <span className="text-[10px] font-medium mono-font px-2 py-0.5 rounded-full" style={{background: `${section.accent}18`, color: section.accent}}>{section.count}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{borderBottom: '1px solid rgba(255,255,255,0.08)'}}>
                          <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs uppercase tracking-wider mono-font">Discipline</th>
                          <th className="text-center py-2.5 px-3 font-medium text-slate-500 text-xs uppercase tracking-wider mono-font">Gender</th>
                          <th className="text-center py-2.5 px-3 font-medium text-slate-500 text-xs uppercase tracking-wider mono-font">Finalist Threshold</th>
                          <th className="hidden sm:table-cell text-center py-2.5 px-3 font-medium text-slate-500 text-xs uppercase tracking-wider mono-font">Pop. Mean</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, i) => (
                          <tr key={i} className="transition-colors hover:bg-white/[0.02]" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
                            <td className="py-2.5 px-3 font-medium text-white landing-font text-sm">{row.disc}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium mono-font" style={{
                                background: row.gender === 'Male' ? 'rgba(59,130,246,0.12)' : 'rgba(236,72,153,0.12)',
                                color: row.gender === 'Male' ? '#60a5fa' : '#f472b6'
                              }}>{row.gender}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold mono-font" style={{color: '#f97316'}}>{row.threshold}</td>
                            <td className="hidden sm:table-cell py-2.5 px-3 text-center text-slate-400 mono-font">{row.mean}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* Methodology cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 stagger-5">
              {[
                {
                  icon: TrendingUp,
                  title: 'Trajectory Classification',
                  text: 'K-means clustering (K=3) on age-normalised % off PB series identifies three career patterns: Early Peaker, Late Developer, and Plateau Pattern. Your trajectory type shapes your projected development curve.',
                  accent: '#f97316'
                },
                {
                  icon: Target,
                  title: 'Finalist Identification',
                  text: 'ROC/AUC analysis with Youden\'s J-optimised thresholds classifies athletes as Olympic finalists, semi-finalists, or qualifiers. Thresholds are computed independently for each discipline and gender.',
                  accent: '#3b82f6'
                },
                {
                  icon: BarChart3,
                  title: 'Age–Performance Curves',
                  text: 'Percentile corridors (P10 through P90) at each age from 15 to 38, computed from season-best performances expressed as % off personal best. Shows where you sit relative to the Olympic population.',
                  accent: '#22c55e'
                },
                {
                  icon: Zap,
                  title: 'Peak Projection',
                  text: 'Improvement rate decay modelling estimates projected peak time and age. Confidence intervals are calibrated from the standard deviation of improvement rates observed in finalists.',
                  accent: '#f59e0b'
                },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="bento-card rounded-xl p-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: `${card.accent}12`}}>
                        <Icon className="w-5 h-5" style={{color: card.accent}} />
                      </div>
                      <h4 className="font-bold text-white landing-font">{card.title}</h4>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed landing-font">{card.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Important disclaimer */}
            <div className="bento-card rounded-xl p-6 mb-10 stagger-6" style={{background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(245,158,11,0.15)'}}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background: 'rgba(245,158,11,0.1)'}}>
                  <Info className="w-4 h-4" style={{color: '#f59e0b'}} />
                </div>
                <div>
                  <h4 className="font-bold text-amber-400 mb-2 landing-font text-sm">A tool, not a verdict</h4>
                  <p className="text-sm text-slate-500 leading-relaxed landing-font">
                    bnchmrkd is designed as a <span className="font-semibold text-white">decision-support tool</span> to be used alongside coaches, sport scientists, and a multi-disciplinary team (MDT). Statistical models provide context, not certainty — every athlete's journey is unique. Projections should inform discussion, not replace expert judgement.
                  </p>
                </div>
              </div>
            </div>

            {/* Data source */}
            <div className="bento-card rounded-xl p-6 mb-12" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)', border: '1px solid rgba(255,255,255,0.04)'}}>
              <p className="text-[10px] text-slate-600 mono-font uppercase tracking-wider mb-2">Data Source</p>
              <p className="text-sm text-slate-500 leading-relaxed landing-font">
                All athlete data is sourced from World Athletics competition records for Olympic Games from Sydney 2000 through Paris 2024. Career race histories, personal bests, and competition classifications are extracted from publicly available results databases.
              </p>
            </div>

            {/* CTA */}
            <div className="text-center stagger-6">
              <button
                onClick={() => setCurrentView('categories')}
                className="cta-primary inline-flex items-center gap-2.5 px-7 py-3.5 text-white font-semibold rounded-xl text-[15px] landing-font"
              >
                Benchmark a Performance
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DISCIPLINE CATEGORY SELECTION                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'categories' && (
        <div className="min-h-screen flex flex-col" style={{background: 'linear-gradient(165deg, #0a0a0f 0%, #0d1117 30%, #111318 60%, #0a0a0f 100%)'}}>
          {/* Atmospheric background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 noise-overlay opacity-40"></div>
            <div className="absolute top-[20%] left-[50%] w-[500px] h-[500px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)'}}></div>
          </div>

          {/* Header */}
          <nav className="relative z-20 stagger-1" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
            <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
              <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors landing-font">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Home</span>
              </button>
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="bnchmrkd" className="w-7 h-7" />
                <span className="text-lg font-bold text-white tracking-tight landing-font">bnchmrkd<span style={{color: '#f97316'}}>.</span></span>
              </div>
              <div className="w-20"></div>
            </div>
          </nav>

          <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="stagger-2 mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mono-font tracking-wide" style={{background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#fb923c'}}>
                SELECT DISCIPLINE
              </span>
            </div>
            <h2 className="stagger-3 text-2xl sm:text-4xl font-bold text-white mb-3 text-center landing-font tracking-tight">Choose your discipline</h2>
            <p className="stagger-3 text-sm sm:text-base text-slate-500 mb-8 sm:mb-10 text-center landing-font">Select an event group to benchmark against Olympic-level data.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 w-full max-w-4xl stagger-4">

              {/* ── SPRINTS & HURDLES (ACTIVE) ── */}
              <button
                onClick={() => { setDisciplineCategory('sprints'); setAthleteData(d => ({...d, discipline: '100m'})); setQuickAnalysisData(d => ({...d, discipline: '100m'})); if (!user) setActiveTab('quick'); setCurrentView('input'); }}
                className="group relative bento-card rounded-xl p-6 text-left cursor-pointer"
                style={{background: 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(249,115,22,0.15)'}}
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.15)'}}>
                  <svg viewBox="0 0 48 48" className="w-7 h-7">
                    <line x1="8" y1="38" x2="18" y2="10" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
                    </line>
                    <line x1="20" y1="38" x2="24" y2="14" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" begin="0.2s" repeatCount="indefinite" />
                    </line>
                    <line x1="32" y1="38" x2="30" y2="18" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
                    </line>
                    <rect x="6" y="22" width="36" height="2.5" rx="1" fill="#f97316" opacity="0.3">
                      <animate attributeName="opacity" values="0.15;0.4;0.15" dur="2s" repeatCount="indefinite" />
                    </rect>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1 landing-font group-hover:text-orange-400 transition-colors">Sprints & Hurdles</h3>
                <p className="text-sm text-slate-500 mb-3 landing-font">100m, 200m, 400m, 100mH, 110mH, 400mH</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mono-font" style={{background: 'rgba(249,115,22,0.15)', color: '#fb923c'}}>
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                    Live
                  </span>
                  <span className="text-xs text-slate-500 mono-font">10 events</span>
                </div>
                <ArrowRight className="absolute top-6 right-6 w-5 h-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
              </button>

              {/* ── THROWS (ACTIVE) ── */}
              <button
                onClick={() => { setDisciplineCategory('throws'); setAthleteData(d => ({...d, discipline: 'Discus Throw'})); setQuickAnalysisData(d => ({...d, discipline: 'Discus Throw'})); if (!user) setActiveTab('quick'); setCurrentView('input'); }}
                className="group relative bento-card rounded-xl p-6 text-left cursor-pointer"
                style={{background: 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(249,115,22,0.15)'}}
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.15)'}}>
                  <svg viewBox="0 0 48 48" className="w-7 h-7">
                    <path d="M10 36 Q 24 8, 40 28" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3">
                      <animate attributeName="stroke-dashoffset" values="0;-14" dur="2s" repeatCount="indefinite" />
                    </path>
                    <circle cx="40" cy="28" r="4" fill="#f97316" opacity="0.5">
                      <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1 landing-font group-hover:text-orange-400 transition-colors">Throws</h3>
                <p className="text-sm text-slate-500 mb-3 landing-font">Shot Put, Discus, Hammer, Javelin</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mono-font" style={{background: 'rgba(249,115,22,0.15)', color: '#fb923c'}}>
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                    Live
                  </span>
                  <span className="text-xs text-slate-500 mono-font">8 events</span>
                </div>
                <ArrowRight className="absolute top-6 right-6 w-5 h-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
              </button>

              {/* ── JUMPS (COMING SOON) ── */}
              <div className="relative bento-card rounded-xl p-6 text-left opacity-60 cursor-not-allowed" style={{background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(16,185,129,0.1)'}}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)'}}>
                  <svg viewBox="0 0 48 48" className="w-7 h-7">
                    <path d="M8 38 Q 24 6, 40 38" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
                      <animate attributeName="d" values="M8 38 Q 24 6, 40 38;M8 38 Q 24 10, 40 38;M8 38 Q 24 6, 40 38" dur="2s" repeatCount="indefinite" />
                    </path>
                    <circle cx="24" cy="12" r="3" fill="#10b981" opacity="0.6">
                      <animate attributeName="cy" values="14;10;14" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-300 mb-1 landing-font">Jumps</h3>
                <p className="text-sm text-slate-500 mb-3 landing-font">High Jump, Long Jump, Triple Jump, Pole Vault</p>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold mono-font" style={{background: 'rgba(16,185,129,0.1)', color: '#34d399'}}>Coming Soon</span>
              </div>

              {/* ── MIDDLE DISTANCE (COMPILING DATA) ── */}
              <div className="relative bento-card rounded-xl p-6 text-left opacity-50 cursor-not-allowed" style={{background: 'linear-gradient(135deg, rgba(168,85,247,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(168,85,247,0.08)'}}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.12)'}}>
                  <svg viewBox="0 0 48 48" className="w-7 h-7">
                    <ellipse cx="24" cy="24" rx="16" ry="10" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="6 4">
                      <animate attributeName="stroke-dashoffset" values="0;-20" dur="3s" repeatCount="indefinite" />
                    </ellipse>
                    <circle cx="8" cy="24" r="2.5" fill="#a855f7" opacity="0.7">
                      <animateMotion dur="3s" repeatCount="indefinite" path="M16,0 A16,10 0 1,1 -0.1,0 A16,10 0 1,1 0.1,0" />
                    </circle>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-300 mb-1 landing-font">Middle Distance</h3>
                <p className="text-sm text-slate-500 mb-3 landing-font">800m, 1500m</p>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold mono-font flex items-center gap-1.5 w-fit" style={{background: 'rgba(168,85,247,0.1)', color: '#c084fc'}}>
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 12" /></svg>
                  Compiling Data
                </span>
              </div>

              {/* ── LONG DISTANCE (ACTIVE) ── */}
              <button
                onClick={() => { setDisciplineCategory('distance'); setAthleteData(d => ({...d, discipline: '3000m Steeplechase'})); setQuickAnalysisData(d => ({...d, discipline: '3000m Steeplechase'})); if (!user) setActiveTab('quick'); setCurrentView('input'); }}
                className="group relative bento-card rounded-xl p-6 text-left cursor-pointer"
                style={{background: 'linear-gradient(135deg, rgba(244,63,94,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(244,63,94,0.15)'}}
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.15)'}}>
                  <svg viewBox="0 0 48 48" className="w-7 h-7">
                    <path d="M6 40 Q 16 20, 24 28 Q 32 36, 42 10" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4">
                      <animate attributeName="stroke-dashoffset" values="0;-18" dur="2.5s" repeatCount="indefinite" />
                    </path>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1 landing-font group-hover:text-rose-400 transition-colors">Long Distance</h3>
                <p className="text-sm text-slate-500 mb-3 landing-font">3000m SC, 5000m, 10,000m</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mono-font" style={{background: 'rgba(244,63,94,0.15)', color: '#fb7185'}}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                    Live
                  </span>
                  <span className="text-xs text-slate-500 mono-font">6 events</span>
                </div>
                <ArrowRight className="absolute top-6 right-6 w-5 h-5 text-slate-600 group-hover:text-rose-400 transition-colors" />
              </button>

              {/* ── COMBINED EVENTS (COMPILING DATA) ── */}
              <div className="relative bento-card rounded-xl p-6 text-left opacity-50 cursor-not-allowed" style={{background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(245,158,11,0.08)'}}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.12)'}}>
                  <svg viewBox="0 0 48 48" className="w-7 h-7">
                    {[{cx:12,cy:14},{cx:24,cy:10},{cx:36,cy:14},{cx:12,cy:26},{cx:24,cy:30},{cx:36,cy:26},{cx:18,cy:38},{cx:30,cy:38}].map((dot, i) => (
                      <circle key={i} cx={dot.cx} cy={dot.cy} r="3" fill="#f59e0b" opacity="0.4">
                        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
                      </circle>
                    ))}
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-300 mb-1 landing-font">Combined Events</h3>
                <p className="text-sm text-slate-500 mb-3 landing-font">Decathlon, Heptathlon</p>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold mono-font flex items-center gap-1.5 w-fit" style={{background: 'rgba(245,158,11,0.1)', color: '#fbbf24'}}>
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 12" /></svg>
                  Compiling Data
                </span>
              </div>

              {/* ── RACE WALKS & ROAD (COMPILING DATA) ── */}
              <div className="relative bento-card rounded-xl p-6 text-left opacity-50 cursor-not-allowed sm:col-span-2 lg:col-span-3" style={{background: 'linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(6,182,212,0.08)'}}>
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.12)'}}>
                    <svg viewBox="0 0 48 48" className="w-7 h-7">
                      <line x1="10" y1="38" x2="16" y2="26" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round">
                        <animate attributeName="x2" values="16;14;16" dur="1s" repeatCount="indefinite" />
                      </line>
                      <line x1="16" y1="26" x2="22" y2="38" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round">
                        <animate attributeName="x2" values="22;24;22" dur="1s" repeatCount="indefinite" />
                      </line>
                      <circle cx="16" cy="18" r="4" fill="none" stroke="#06b6d4" strokeWidth="2" />
                      <path d="M30 38 L42 38" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3">
                        <animate attributeName="stroke-dashoffset" values="0;-12" dur="1.5s" repeatCount="indefinite" />
                      </path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-300 mb-1 landing-font">Race Walks & Road Events</h3>
                    <p className="text-sm text-slate-500 mb-2 landing-font">20km Walk, 35km Walk, Marathon, Half Marathon</p>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold mono-font inline-flex items-center gap-1.5" style={{background: 'rgba(6,182,212,0.1)', color: '#22d3ee'}}>
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 12" /></svg>
                      Compiling Data
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ATHLETE EXPLORER VIEW                                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'explorer' && (
        <div className="min-h-screen flex flex-col" style={{background: 'linear-gradient(165deg, #0a0a0f 0%, #0d1117 30%, #111318 60%, #0a0a0f 100%)'}}>
          {/* Atmospheric background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 noise-overlay opacity-40"></div>
            <div className="absolute top-[15%] left-[60%] w-[500px] h-[500px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)'}}></div>
            <div className="absolute top-[60%] left-[20%] w-[400px] h-[400px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(249,115,22,0.04) 0%, transparent 70%)'}}></div>
          </div>

          {/* Nav */}
          <nav className="relative z-20 stagger-1" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
            <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
              <button onClick={() => { setCurrentView('landing'); setSelectedAthlete(null); setAthleteProfile(null); setAthleteTrajectory(null); setExplorerSearch(''); setExplorerResults([]); }} className="flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors landing-font">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Home</span>
              </button>
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="bnchmrkd" className="w-7 h-7" />
                <span className="text-lg font-bold text-white tracking-tight landing-font">bnchmrkd<span style={{color: '#f97316'}}>.</span></span>
              </div>
              <div className="w-20"></div>
            </div>
          </nav>

          <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-6 sm:px-10 py-8">
            <div className="stagger-2 mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mono-font tracking-wide" style={{background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa'}}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                ATHLETE EXPLORER
              </span>
            </div>
            <h1 className="stagger-2 text-2xl sm:text-4xl font-bold text-white mb-2 landing-font tracking-tight">Search Olympic athletes</h1>
            <p className="stagger-3 text-sm sm:text-base text-slate-500 mb-6 sm:mb-8 landing-font">Browse career trajectories, personal bests, and Olympic results across {STATS.athletes} athletes.</p>

            {/* Search + Filter Bar */}
            <div className="bento-card rounded-xl p-3 sm:p-6 mb-4 sm:mb-6 stagger-3" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={explorerSearch}
                    onChange={(e) => setExplorerSearch(e.target.value)}
                    placeholder={`Search ${STATS.athletes} Olympic athletes...`}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-lg text-white placeholder-slate-500 focus:outline-none landing-font text-base sm:text-lg"
                    style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}
                    autoFocus
                  />
                </div>
                <select
                  value={explorerDisciplineFilter}
                  onChange={(e) => setExplorerDisciplineFilter(e.target.value)}
                  className="px-4 py-3 rounded-lg text-white focus:outline-none landing-font"
                  style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}
                >
                  <option value="all">All Disciplines</option>
                  <optgroup label="Sprints">
                    <option value="100m">100m</option>
                    <option value="200m">200m</option>
                    <option value="400m">400m</option>
                  </optgroup>
                  <optgroup label="Hurdles">
                    <option value="100mH">100m Hurdles</option>
                    <option value="110mH">110m Hurdles</option>
                    <option value="400mH">400m Hurdles</option>
                  </optgroup>
                  <optgroup label="Throws">
                    <option value="Discus Throw">Discus Throw</option>
                    <option value="Javelin Throw">Javelin Throw</option>
                    <option value="Hammer Throw">Hammer Throw</option>
                    <option value="Shot Put">Shot Put</option>
                  </optgroup>
                </select>
              </div>
              {explorerLoading && (
                <div className="mt-3 text-sm text-slate-400 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                  Searching...
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Left: Search Results List */}
              <div className="lg:col-span-1">
                {explorerResults.length > 0 ? (
                  <div className="space-y-2 max-h-[40vh] lg:max-h-[70vh] overflow-y-auto pr-1 sm:pr-2">
                    {explorerResults.map(a => (
                      <button
                        key={a.id}
                        onClick={() => loadAthleteProfile(a)}
                        className={`w-full text-left p-4 rounded-xl transition-all ${
                          selectedAthlete?.id === a.id
                            ? 'shadow-lg'
                            : 'hover:translate-y-[-1px]'
                        }`}
                        style={selectedAthlete?.id === a.id
                          ? {background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)'}
                          : {background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)'}
                        }
                      >
                        <div className="font-semibold text-white text-sm landing-font">{a.name}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 mono-font">
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{a.country || 'N/A'}</span>
                          {a.disciplines && <span className="text-orange-400">{a.disciplines.join(', ')}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : explorerSearch.length >= 2 && !explorerLoading ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p>No athletes found for "{explorerSearch}"</p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p>Start typing to search athletes</p>
                    <p className="text-xs mt-2">Try "Bolt", "McLaughlin", or "Warholm"</p>
                  </div>
                )}
              </div>

              {/* Right: Athlete Profile + Trajectory */}
              <div className="lg:col-span-2">
                {profileLoading ? (
                  <div className="flex items-center justify-center py-24">
                    <div className="text-center">
                      <div className="w-10 h-10 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-slate-400">Loading profile...</p>
                    </div>
                  </div>
                ) : athleteProfile ? (
                  <div className="space-y-6">
                    {/* Profile Header Card */}
                    <div className="bento-card rounded-xl p-4 sm:p-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-white landing-font tracking-tight">{athleteProfile.name}</h2>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm sm:text-base text-slate-500 landing-font">
                            <span className="flex items-center gap-1"><Globe className="w-4 h-4" />{athleteProfile.country || 'Unknown'}</span>
                            {athleteProfile.gender && <span className="flex items-center gap-1"><User className="w-4 h-4" />{athleteProfile.gender}</span>}
                            {athleteProfile.date_of_birth && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{athleteProfile.date_of_birth}</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 sm:justify-end">
                          {athleteProfile.disciplines && athleteProfile.disciplines.map(d => (
                            <span key={d} className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 bg-orange-500/15 text-orange-400 rounded-full text-xs sm:text-sm font-medium">{d}</span>
                          ))}
                        </div>
                      </div>

                      {/* Personal Bests */}
                      {athleteProfile.personal_bests && athleteProfile.personal_bests.length > 0 && (
                        <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                          {athleteProfile.personal_bests.map((pb, i) => (
                            <div key={i} className="rounded-lg p-3 text-center" style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)'}}>
                              <div className="text-xs text-slate-500 uppercase tracking-wider mono-font">{pb.discipline}</div>
                              <div className="text-xl font-bold mt-1 mono-font" style={{color: '#f97316'}}>{typeof pb.time === 'number' ? formatTime(pb.time, pb.discipline || athleteProfile.primary_discipline) : pb.time}</div>
                              {pb.year && <div className="text-xs text-slate-500 mt-1 mono-font">{pb.year}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Olympic Results */}
                      {athleteProfile.olympic_results && athleteProfile.olympic_results.length > 0 && (
                        <div className="mt-6">
                          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 mono-font">
                            <Medal className="w-4 h-4" style={{color: '#f97316'}} />
                            Olympic Results
                          </h3>
                          <div className="space-y-2">
                            {athleteProfile.olympic_results.map((r, i) => (
                              <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg px-3 sm:px-4 py-2 gap-1 sm:gap-0" style={{background: 'rgba(255,255,255,0.02)'}}>
                                <div className="text-sm sm:text-base">
                                  <span className="text-white font-medium">{r.games || r.year}</span>
                                  <span className="text-slate-500 mx-1 sm:mx-2">·</span>
                                  <span className="text-slate-400">{r.discipline}</span>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  {r.time && <span className="text-orange-400 font-mono">{typeof r.time === 'number' ? formatTime(r.time, r.discipline || athleteProfile.primary_discipline) : r.time}</span>}
                                  {r.position && <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    r.position <= 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-300'
                                  }`}>{r.position}{r.position === 1 ? 'st' : r.position === 2 ? 'nd' : r.position === 3 ? 'rd' : 'th'}</span>}
                                  {r.round && <span className="text-xs text-slate-500">{r.round}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Career Trajectory Chart */}
                    {athleteTrajectory && athleteTrajectory.seasons && athleteTrajectory.seasons.length > 0 && (
                      <div className="bento-card rounded-xl p-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 landing-font">
                          <TrendingUp className="w-5 h-5" style={{color: '#f97316'}} />
                          Career Trajectory — {athleteTrajectory.discipline || ''}
                        </h3>
                        <ResponsiveContainer width="100%" height={280}>
                          <ComposedChart data={athleteTrajectory.seasons
                            .filter(s => s.best_time)
                            .sort((a, b) => (a.age || a.year) - (b.age || b.year))
                            .map(s => ({
                              age: s.age || s.year,
                              bestTime: s.best_time,
                              races: s.n_races
                            }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                              dataKey="age"
                              stroke="#94a3b8"
                              tick={{ fill: '#94a3b8', fontSize: 12 }}
                              label={{ value: 'Age', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              tick={{ fill: '#94a3b8', fontSize: 12 }}
                              domain={['auto', 'auto']}
                              reversed={!isThrowsDiscipline(athleteTrajectory.discipline)}
                              tickFormatter={v => formatTime(v, athleteTrajectory.discipline)}
                              label={{ value: getUnitLabel(athleteTrajectory.discipline), angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff' }}
                              formatter={(value, name) => [typeof value === 'number' ? formatTime(value, athleteTrajectory.discipline) : value, name === 'bestTime' ? 'Season Best' : name]}
                              labelFormatter={(label) => `Age ${label}`}
                            />
                            <Legend wrapperStyle={{ color: '#94a3b8' }} />
                            <Line
                              type="monotone"
                              dataKey="bestTime"
                              name="Season Best"
                              stroke="#f97316"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#f97316', stroke: '#f97316' }}
                              activeDot={{ r: 6 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>

                        {/* Discipline Tabs (if multiple) */}
                        {athleteProfile.personal_bests && athleteProfile.personal_bests.length > 1 && (
                          <div className="flex gap-2 mt-4 mb-2">
                            {athleteProfile.personal_bests.map(pb => (
                              <button
                                key={pb.discipline_code}
                                onClick={async () => {
                                  setAthleteTrajectory(null);
                                  try {
                                    const resp = await fetch(`${API_BASE}/api/v1/athletes/${selectedAthlete.id}/trajectory?discipline=${pb.discipline_code}`);
                                    if (resp.ok) {
                                      const data = await resp.json();
                                      setAthleteTrajectory({
                                        ...data,
                                        seasons: (data.seasons || []).map(s => ({ age: s.age_years, year: s.season_year, best_time: s.best_time ? parseFloat(s.best_time) : null, n_races: s.n_races, pct_off_pb: s.pct_off_pb != null ? parseFloat(s.pct_off_pb) : null }))
                                      });
                                    }
                                  } catch (e) { console.warn('Trajectory load failed:', e.message); }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  athleteTrajectory.discipline === pb.discipline_code
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:text-white'
                                }`}
                              >
                                {pb.discipline}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Season Details Table */}
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="mono-font" style={{borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                                <th className="text-left py-2 px-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Age</th>
                                <th className="text-left py-2 px-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Year</th>
                                <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Season Best</th>
                                <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium uppercase tracking-wider">% Off PB</th>
                                <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Races</th>
                              </tr>
                            </thead>
                            <tbody>
                              {athleteTrajectory.seasons
                                .filter(s => s.best_time)
                                .sort((a, b) => (a.age || a.year) - (b.age || b.year))
                                .map((s, i) => (
                                <tr key={i} className="hover:bg-white/[0.02]" style={{borderBottom: '1px solid rgba(255,255,255,0.03)'}}>
                                  <td className="py-2 px-3 text-white font-medium landing-font">{s.age || '–'}</td>
                                  <td className="py-2 px-3 text-slate-500 landing-font">{s.year || '–'}</td>
                                  <td className="py-2 px-3 text-right mono-font" style={{color: '#f97316'}}>{formatTime(s.best_time, athleteTrajectory.discipline)}</td>
                                  <td className="py-2 px-3 text-right text-slate-400 mono-font">{s.pct_off_pb != null ? s.pct_off_pb.toFixed(1) + '%' : '–'}</td>
                                  <td className="py-2 px-3 text-right text-slate-500 mono-font">{s.n_races || '–'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Benchmark This Athlete Button */}
                    {athleteProfile.personal_bests && athleteProfile.personal_bests.length > 0 && (
                      <div className="text-center">
                        <button
                          onClick={() => {
                            const firstPB = athleteProfile.personal_bests[0];
                            setQuickAnalysisData({
                              discipline: firstPB.discipline || '100m',
                              gender: athleteProfile.gender || 'Male',
                              age: athleteProfile.date_of_birth ? String(new Date().getFullYear() - new Date(athleteProfile.date_of_birth).getFullYear()) : '25',
                              personalBest: String(firstPB.time)
                            });
                            setActiveTab('quick');
                            setCurrentView('input');
                          }}
                          className="cta-primary inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all landing-font"
                        >
                          <Target className="w-5 h-5" />
                          Benchmark This Athlete
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-24">
                    <div className="text-center text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="text-lg">Select an athlete to view their profile</p>
                      <p className="text-sm mt-2">Browse career trajectories, personal bests, and Olympic results</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}

      {currentView === 'input' && (
        <div className="min-h-screen flex flex-col" style={{background: 'linear-gradient(165deg, #0a0a0f 0%, #0d1117 30%, #111318 60%, #0a0a0f 100%)'}}>
          {/* Atmospheric background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 noise-overlay opacity-40"></div>
            <div className="absolute top-[30%] left-[70%] w-[450px] h-[450px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)'}}></div>
          </div>

          <nav className="relative z-20 stagger-1" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
            <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
              <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors landing-font">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Home</span>
              </button>
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="bnchmrkd" className="w-7 h-7" />
                <span className="text-lg font-bold text-white tracking-tight landing-font">bnchmrkd<span style={{color: '#f97316'}}>.</span></span>
              </div>
              <div className="w-20"></div>
            </div>
          </nav>

          <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-6 sm:px-10 py-10">
            <div className="flex gap-1 sm:gap-2 mb-6 sm:mb-8 stagger-2 overflow-x-auto" style={{borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
              {[
                { key: 'manual', icon: Upload, label: 'Manual Entry', shortLabel: 'Manual', requiresAuth: true },
                { key: 'url', icon: Link, label: 'Import from URL', shortLabel: 'URL', requiresAuth: true },
                { key: 'quick', icon: Zap, label: 'Quick Analysis', shortLabel: 'Quick', requiresAuth: false },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    if (tab.requiresAuth && !user) {
                      onSignUp();
                    } else {
                      setActiveTab(tab.key);
                    }
                  }}
                  className={`px-3 py-2 sm:px-6 sm:py-3 font-medium border-b-2 transition-colors landing-font whitespace-nowrap text-sm sm:text-base ${
                    activeTab === tab.key
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-slate-500 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <tab.icon className="w-4 h-4" />
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.requiresAuth && !user && (
                      <Lock className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Manual Entry Tab */}
            {activeTab === 'manual' && !user && (
              <div className="bento-card rounded-xl p-8 sm:p-12 text-center" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <Lock className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2 landing-font">Sign up to unlock Manual Entry</h3>
                <p className="text-slate-400 text-sm mb-6 landing-font max-w-md mx-auto">Create a free account to enter your full race history, get trajectory modelling, and rate of development analysis.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={onSignUp} className="px-6 py-3 rounded-lg font-semibold text-black landing-font" style={{background: '#22c55e'}}>
                    Sign Up Free
                  </button>
                  <button onClick={() => setActiveTab('quick')} className="px-6 py-3 rounded-lg font-medium text-slate-400 hover:text-white landing-font" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)'}}>
                    Try Quick Analysis
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'manual' && user && (
              <div className="bento-card rounded-xl p-4 sm:p-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Discipline</label>
                    <select value={athleteData.discipline} onChange={(e) => { handleManualEntry('discipline', e.target.value); analytics.disciplineSelected({ discipline: e.target.value }); }}
                      className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}>
                      {isThrowsMode ? (
                        <>
                          <option value="Discus Throw">Discus Throw</option>
                          <option value="Javelin Throw">Javelin Throw</option>
                          <option value="Hammer Throw">Hammer Throw</option>
                          <option value="Shot Put">Shot Put</option>
                        </>
                      ) : isDistanceMode ? (
                        <optgroup label="Distance">
                          <option value="3000m Steeplechase">3000m Steeplechase</option>
                          <option value="5000m">5000m</option>
                          <option value="10000m">10000m</option>
                        </optgroup>
                      ) : (
                        <>
                          <optgroup label="Sprints">
                            <option value="100m">100m</option>
                            <option value="200m">200m</option>
                            <option value="400m">400m</option>
                          </optgroup>
                          <optgroup label="Hurdles">
                            <option value="110mH">110m Hurdles</option>
                            <option value="100mH">100m Hurdles</option>
                            <option value="400mH">400m Hurdles</option>
                          </optgroup>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Gender</label>
                    <select value={athleteData.gender} onChange={(e) => handleManualEntry('gender', e.target.value)}
                      className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div className={`grid grid-cols-1 ${isThrowsMode ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 sm:gap-6 mb-6 sm:mb-8`}>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Athlete Name</label>
                    <input type="text" placeholder={isThrowsMode ? "e.g., Daniel Stahl" : "e.g., Shelly-Ann Fraser-Pryce"} value={athleteData.name}
                      onChange={(e) => handleManualEntry('name', e.target.value)}
                      className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Date of Birth</label>
                    <input type="date" value={athleteData.dateOfBirth}
                      onChange={(e) => handleManualEntry('dateOfBirth', e.target.value)}
                      className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} />
                  </div>
                  {isThrowsMode && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Implement Weight</label>
                      <select value={athleteData.implementWeight}
                        onChange={(e) => handleManualEntry('implementWeight', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}>
                        {getWeightOptions(athleteData.discipline, athleteData.gender).map(opt => (
                          <option key={opt.kg} value={opt.kg}>{opt.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Select the implement weight used in competitions.</p>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Timer className="w-5 h-5 " style={{color: '#f97316'}} />
                  {isThrowsMode ? 'Competition History' : 'Race History'}
                </h3>

                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{borderBottom: '1px solid rgba(255,255,255,0.08)'}}>
                        <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mono-font">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mono-font">{isThrowsMode ? 'Distance (m)' : isDistanceMode ? 'Time (mm:ss)' : 'Time (s)'}</th>
                        {!isThrowsMode && <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mono-font">Wind (m/s)</th>}
                        <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mono-font">Competition</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mono-font">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {athleteData.races.map((race, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
                          <td className="py-3 px-4"><input type="date" value={race.date} onChange={(e) => handleManualEntry('date', e.target.value, idx)} className="w-full px-2 py-1 text-white rounded text-sm placeholder-slate-500 mono-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} /></td>
                          <td className="py-3 px-4"><input type={isDistanceMode ? "text" : "number"} step={isDistanceMode ? undefined : "0.01"} placeholder={isThrowsMode ? "e.g., 67.48" : isDistanceMode ? "e.g., 8:06.05" : "e.g., 10.85"} value={race.time} onChange={(e) => handleManualEntry('time', e.target.value, idx)} className="w-full px-2 py-1 text-white rounded text-sm placeholder-slate-500 mono-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} /></td>
                          {!isThrowsMode && <td className="py-3 px-4"><input type="number" step="0.1" placeholder="-0.5 to +2.0" value={race.wind} onChange={(e) => handleManualEntry('wind', e.target.value, idx)} className="w-full px-2 py-1 text-white rounded text-sm placeholder-slate-500 mono-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} /></td>}
                          <td className="py-3 px-4"><input type="text" placeholder={isThrowsMode ? "e.g., World Championships" : "e.g., Olympics"} value={race.competition} onChange={(e) => handleManualEntry('competition', e.target.value, idx)} className="w-full px-2 py-1 text-white rounded text-sm placeholder-slate-500 mono-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} /></td>
                          <td className="py-3 px-4 text-center"><button onClick={() => removeRaceRow(idx)} className="text-red-500 hover:text-red-700 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button onClick={addRaceRow} className="flex items-center gap-2 text-slate-300 hover:text-orange-600 transition-colors mb-8 font-medium">
                  <Plus className="w-4 h-4" /> {isThrowsMode ? 'Add Result' : 'Add Race'}
                </button>

                {error && <div className="bg-red-900/30 border border-red-800 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

                <button onClick={handleAnalyze} disabled={loading}
                  className="cta-primary w-full text-white font-bold py-4 rounded-xl hover:shadow-xl hover:shadow-orange-500/25 hover:scale-[1.01] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed landing-font">
                  {loading ? 'Analyzing...' : 'Analyze Performance'}
                </button>
              </div>
            )}

            {/* URL Import Tab */}
            {activeTab === 'url' && !user && (
              <div className="bento-card rounded-xl p-8 sm:p-12 text-center" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <Lock className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2 landing-font">Sign up to unlock URL Import</h3>
                <p className="text-slate-400 text-sm mb-6 landing-font max-w-md mx-auto">Create a free account to import your full career data directly from World Athletics and get detailed trajectory analysis.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={onSignUp} className="px-6 py-3 rounded-lg font-semibold text-black landing-font" style={{background: '#22c55e'}}>
                    Sign Up Free
                  </button>
                  <button onClick={() => setActiveTab('quick')} className="px-6 py-3 rounded-lg font-medium text-slate-400 hover:text-white landing-font" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)'}}>
                    Try Quick Analysis
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'url' && user && (
              <div className="bento-card rounded-xl p-4 sm:p-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">World Athletics Profile URL</label>
                  <input type="text" placeholder="https://worldathletics.org/athletes/..." value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-4 py-3 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Override Discipline (optional)</label>
                  <select className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}>
                    <option value="">Auto-detect</option>
                    {isThrowsMode ? (
                      <optgroup label="Throws">
                        <option value="Discus Throw">Discus Throw</option><option value="Javelin Throw">Javelin Throw</option><option value="Hammer Throw">Hammer Throw</option><option value="Shot Put">Shot Put</option>
                      </optgroup>
                    ) : isDistanceMode ? (
                      <optgroup label="Distance">
                        <option value="3000m Steeplechase">3000m Steeplechase</option><option value="5000m">5000m</option><option value="10000m">10000m</option>
                      </optgroup>
                    ) : (
                      <>
                        <optgroup label="Sprints">
                          <option value="100m">100m</option><option value="200m">200m</option><option value="400m">400m</option>
                        </optgroup>
                        <optgroup label="Hurdles">
                          <option value="110mH">110m Hurdles</option><option value="100mH">100m Hurdles</option><option value="400mH">400m Hurdles</option>
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>
                <p className="text-sm text-slate-400 mb-4 flex items-center gap-2"><ChevronRight className="w-4 h-4" /> {isThrowsMode ? "We'll automatically import your full competition history and analyze all supported throws disciplines" : "We'll automatically import your full competition history and analyze all supported disciplines"}</p>
                <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 mb-8">
                  <p className="text-sm text-blue-300">
                    <span className="font-semibold">Supported disciplines:</span> {isThrowsMode ? 'Discus Throw, Javelin Throw, Hammer Throw, Shot Put.' : '100m, 200m, 400m, 100m Hurdles, 110m Hurdles, 400m Hurdles.'}
                    {' '}All matching results will be automatically analyzed with separate tabs for each.
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Requires the bnchmrkd backend server running on localhost:8000. Scraping takes 15-60 seconds depending on career length.
                  </p>
                </div>
                {error && <div className="bg-red-900/30 border border-red-800 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
                <button onClick={handleScrapeUrl} disabled={scraping}
                  className="cta-primary w-full text-white font-bold py-4 rounded-xl hover:shadow-xl hover:shadow-orange-500/25 hover:scale-[1.01] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed landing-font">
                  {scraping ? 'Scraping...' : 'Import & Analyze'}
                </button>
              </div>
            )}

            {/* Quick Analysis Tab */}
            {activeTab === 'quick' && (
              <div className="bento-card rounded-xl p-4 sm:p-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <p className="text-sm sm:text-base text-slate-400 mb-4 sm:mb-6">{isThrowsMode ? "Don't have full competition data? Get insights with just the essentials." : "Don't have full race data? Get insights with just the essentials."}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Discipline</label>
                    <select value={quickAnalysisData.discipline} onChange={(e) => { setQuickAnalysisData({ ...quickAnalysisData, discipline: e.target.value }); analytics.disciplineSelected({ discipline: e.target.value }); }}
                      className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}>
                      {isThrowsMode ? (
                        <optgroup label="Throws">
                          <option value="Discus Throw">Discus Throw</option><option value="Javelin Throw">Javelin Throw</option><option value="Hammer Throw">Hammer Throw</option><option value="Shot Put">Shot Put</option>
                        </optgroup>
                      ) : isDistanceMode ? (
                        <optgroup label="Distance">
                          <option value="3000m Steeplechase">3000m Steeplechase</option><option value="5000m">5000m</option><option value="10000m">10000m</option>
                        </optgroup>
                      ) : (
                        <>
                          <optgroup label="Sprints">
                            <option value="100m">100m</option><option value="200m">200m</option><option value="400m">400m</option>
                          </optgroup>
                          <optgroup label="Hurdles">
                            <option value="110mH">110m Hurdles</option><option value="100mH">100m Hurdles</option><option value="400mH">400m Hurdles</option>
                          </optgroup>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Gender</label>
                    <select value={quickAnalysisData.gender} onChange={(e) => setQuickAnalysisData({ ...quickAnalysisData, gender: e.target.value })}
                      className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}>
                      <option value="Male">Male</option><option value="Female">Female</option>
                    </select>
                  </div>
                </div>
                <div className={`grid grid-cols-1 ${isThrowsMode ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 sm:gap-6 mb-6 sm:mb-8`}>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Current Age</label>
                    <input type="number" placeholder="e.g., 22" value={quickAnalysisData.age}
                      onChange={(e) => {
                        const newAge = e.target.value;
                        const updates = { ...quickAnalysisData, age: newAge };
                        // Auto-update implement weight when age changes (if throws)
                        if (isThrowsMode && newAge) {
                          updates.implementWeight = getDefaultWeight(quickAnalysisData.discipline, quickAnalysisData.gender, newAge);
                        }
                        setQuickAnalysisData(updates);
                      }}
                      className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Personal Best {isDistanceMode ? '(mm:ss.ff)' : getUnitLabel(quickAnalysisData.discipline)}</label>
                    <input type={isDistanceMode ? "text" : "number"} step={isDistanceMode ? undefined : "0.01"} placeholder={isThrowsMode ? "e.g., 65.50" : isDistanceMode ? "e.g., 8:06.05" : "e.g., 10.85"} value={quickAnalysisData.personalBest}
                      onChange={(e) => setQuickAnalysisData({ ...quickAnalysisData, personalBest: e.target.value })}
                      className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}} />
                  </div>
                  {isThrowsMode && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2 landing-font">Implement Weight</label>
                      <select value={quickAnalysisData.implementWeight}
                        onChange={(e) => setQuickAnalysisData({ ...quickAnalysisData, implementWeight: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/30 placeholder-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}>
                        {getWeightOptions(quickAnalysisData.discipline, quickAnalysisData.gender).map(opt => (
                          <option key={opt.kg} value={opt.kg}>{opt.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Auto-set by age per WA rules. Override if needed.</p>
                    </div>
                  )}
                </div>
                {error && <div className="bg-red-900/30 border border-red-800 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
                <button onClick={handleAnalyze} disabled={loading}
                  className="cta-primary w-full text-white font-bold py-4 rounded-xl hover:shadow-xl hover:shadow-orange-500/25 hover:scale-[1.01] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed landing-font">
                  {loading ? 'Analyzing...' : 'Quick Analyze'}
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* QUICK ANALYSIS RESULTS — snapshot from a single time + age     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'quickResults' && analysisResults && (
        <div className="min-h-screen flex flex-col" style={{background: 'linear-gradient(165deg, #0a0a0f 0%, #0d1117 30%, #111318 60%, #0a0a0f 100%)'}}>
          {/* Atmospheric background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 noise-overlay opacity-40"></div>
            <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)'}}></div>
            <div className="absolute top-[60%] left-[70%] w-[400px] h-[400px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)'}}></div>
          </div>

          {/* Nav */}
          <nav className="relative z-20 stagger-1" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
            <div className="max-w-5xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
              <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors landing-font">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Home</span>
              </button>
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="bnchmrkd" className="w-7 h-7" />
                <span className="text-lg font-bold text-white tracking-tight landing-font">bnchmrkd<span style={{color: '#f97316'}}>.</span></span>
              </div>
              <button onClick={() => setCurrentView('input')} className="text-sm text-slate-500 hover:text-orange-400 transition-colors landing-font">
                Full Analysis &rarr;
              </button>
            </div>
          </nav>

          <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-6 sm:px-10 py-10">

            {/* ── HERO HEADER — PB as anchor (Quick Results) ── */}
            <div className="bento-card rounded-2xl p-5 sm:p-8 mb-4 sm:mb-6 stagger-2" style={{background: 'linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(249,115,22,0.1)'}}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider mono-font" style={{color: '#fb923c'}}>Quick Snapshot</span>
                    <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider mono-font text-slate-500">&middot; {analysisResults.discipline} &middot; {analysisResults.gender} &middot; Age {analysisResults.age}</span>
                    {analysisResults.implementWeight && !analysisResults.isSeniorWeight && (
                      <span className="text-[10px] font-medium text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded mono-font">Youth</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-6xl font-bold mono-font tracking-tight" style={{color: '#f97316'}}>{formatTime(analysisResults.personalBest, analysisResults.discipline)}</span>
                    {!isThrowsDiscipline(analysisResults.discipline) && !isDistanceDiscipline(analysisResults.discipline) && (
                      <span className="text-lg sm:text-2xl font-medium text-slate-500 mono-font">s</span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 landing-font">{analysisResults.careerPhase}</p>
                  {analysisResults.implementWeight && (
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 mono-font">
                      {analysisResults.implementWeight >= 1 ? `${analysisResults.implementWeight}kg` : `${Math.round(analysisResults.implementWeight * 1000)}g`} implement
                    </p>
                  )}
                </div>
                {/* Readiness Ring */}
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle cx="50" cy="50" r="42" fill="none"
                        stroke={getReadinessColor(analysisResults.readinessScore)}
                        strokeWidth="6"
                        strokeDasharray={`${(analysisResults.readinessScore / 100) * 263.9} 263.9`}
                        strokeLinecap="round" transform="rotate(-90 50 50)" />
                      <text x="50" y="47" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#f1f5f9" style={{fontFamily: "'DM Mono', monospace"}}>{analysisResults.readinessScore}</text>
                      <text x="50" y="63" textAnchor="middle" fontSize="9" fill="#64748b" style={{fontFamily: "'Instrument Sans', sans-serif"}}>Readiness</text>
                    </svg>
                  </div>
                  <div className="hidden sm:flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{background: getReadinessColor(analysisResults.readinessScore)}}></div>
                      <span className="text-xs text-slate-400 landing-font">{analysisResults.readinessScore >= 80 ? 'Competition Ready' : analysisResults.readinessScore >= 60 ? 'On Track' : analysisResults.readinessScore >= 40 ? 'Developing' : 'Building'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── YOUTH WEIGHT NOTICE ── */}
            {analysisResults.implementWeight && !analysisResults.isSeniorWeight && (
              <div className="rounded-xl p-3 sm:p-4 mb-4 flex items-start gap-3" style={{background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)'}}>
                <AlertTriangle className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-400/80 leading-relaxed landing-font">
                  Youth implement ({analysisResults.implementWeight >= 1 ? `${analysisResults.implementWeight}kg` : `${Math.round(analysisResults.implementWeight * 1000)}g`}). Benchmarks use senior-weight Olympic data. Comparisons are approximate.
                </p>
              </div>
            )}

            {/* ── SNAPSHOT GRID — Ultrahuman-style status cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-6 sm:mb-8">
              {[
                {
                  label: 'Percentile',
                  value: `P${analysisResults.percentileAtCurrentAge}`,
                  status: analysisResults.percentileAtCurrentAge >= 90 ? 'Elite' : analysisResults.percentileAtCurrentAge >= 75 ? 'National' : analysisResults.percentileAtCurrentAge >= 50 ? 'Competitive' : 'Developing',
                  statusColor: analysisResults.percentileAtCurrentAge >= 90 ? '#10b981' : analysisResults.percentileAtCurrentAge >= 75 ? '#3b82f6' : analysisResults.percentileAtCurrentAge >= 50 ? '#f59e0b' : '#64748b',
                },
                {
                  label: 'Finalist',
                  value: `${analysisResults.finalistProbability}%`,
                  status: analysisResults.finalistProbability >= 60 ? 'Likely' : analysisResults.finalistProbability >= 30 ? 'Possible' : 'Developing',
                  statusColor: analysisResults.finalistProbability >= 60 ? '#10b981' : analysisResults.finalistProbability >= 30 ? '#f59e0b' : '#64748b',
                },
                {
                  label: 'Semi-Final',
                  value: `${analysisResults.semiFinalistProbability}%`,
                  status: analysisResults.semiFinalistProbability >= 60 ? 'Likely' : analysisResults.semiFinalistProbability >= 30 ? 'Possible' : 'Developing',
                  statusColor: analysisResults.semiFinalistProbability >= 60 ? '#10b981' : analysisResults.semiFinalistProbability >= 30 ? '#f59e0b' : '#64748b',
                },
                {
                  label: 'Qualifier',
                  value: `${analysisResults.qualifierProbability}%`,
                  status: analysisResults.qualifierProbability >= 60 ? 'Likely' : analysisResults.qualifierProbability >= 30 ? 'Possible' : 'Developing',
                  statusColor: analysisResults.qualifierProbability >= 60 ? '#10b981' : analysisResults.qualifierProbability >= 30 ? '#f59e0b' : '#64748b',
                },
                {
                  label: 'Standards Met',
                  value: analysisResults.standards ? `${analysisResults.standards.filter(s => s.met).length}/${analysisResults.standards.length}` : '—',
                  status: analysisResults.standards && analysisResults.standards.filter(s => s.met).length === analysisResults.standards.length ? 'All Clear' : analysisResults.standards && analysisResults.standards.filter(s => s.met).length > 0 ? 'In Progress' : 'None Yet',
                  statusColor: analysisResults.standards && analysisResults.standards.filter(s => s.met).length === analysisResults.standards.length ? '#10b981' : analysisResults.standards && analysisResults.standards.filter(s => s.met).length > 0 ? '#f59e0b' : '#64748b',
                },
              ].map((card, i) => (
                <div key={i} className="bento-card rounded-xl p-3 sm:p-4" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider mono-font mb-2">{card.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-white mono-font leading-none mb-1.5">{card.value}</p>
                  <p className="text-[10px] sm:text-xs font-semibold" style={{color: card.statusColor}}>{card.status}</p>
                </div>
              ))}
            </div>

            {/* ── COMPETITION STANDARDS — Where You Stand ── */}
            {analysisResults.standards && analysisResults.standards.length > 0 && (() => {
              const isThrows = isThrowsDiscipline(analysisResults.discipline);
              const unit = isThrows ? 'm' : 's';
              const pb = parseFloat(analysisResults.personalBest);
              const eventCode = getEventCode(analysisResults.discipline, analysisResults.gender);
              const compData = COMPETITION_STANDARDS[eventCode];
              const filteredStandards = standardsTier === 'all'
                ? analysisResults.standards
                : analysisResults.standards.filter(s => s.compTier === standardsTier);
              const metCount = filteredStandards.filter(s => s.met).length;
              const total = filteredStandards.length;

              const tierCounts = {
                all: analysisResults.standards.length,
                world: analysisResults.standards.filter(s => s.compTier === 'world').length,
                regional: analysisResults.standards.filter(s => s.compTier === 'regional').length,
                development: analysisResults.standards.filter(s => s.compTier === 'development').length,
              };

              const fmtMark = (v) => {
                if (v === null || v === undefined) return '—';
                return formatTime(v, analysisResults.discipline);
              };

              return (
                <div className="bento-card rounded-xl p-4 sm:p-6 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>

                  {/* Header + WR */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4" style={{color: '#f97316'}} />
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider landing-font">Competition Standards</h3>
                    </div>
                    {compData?.wr && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.15)'}}>
                        <span className="text-[9px] font-bold text-red-400 mono-font">WR</span>
                        <span className="text-xs font-bold text-red-300 mono-font">{fmtMark(compData.wr.mark)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mb-4 landing-font">Your PB vs gold, bronze, 8th place, and entry standards across competitions</p>

                  {/* Tier filter tabs */}
                  <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
                    {[
                      { key: 'all', label: 'All', color: '#f97316' },
                      { key: 'world', label: 'World', color: '#FFD700', icon: '🏅' },
                      { key: 'regional', label: 'Regional', color: '#E84545', icon: '🌏' },
                      { key: 'development', label: 'Development', color: '#A259FF', icon: '🎓' },
                    ].filter(t => t.key === 'all' || tierCounts[t.key] > 0).map(t => (
                      <button
                        key={t.key}
                        onClick={() => setStandardsTier(t.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold mono-font transition-all flex-shrink-0"
                        style={{
                          background: standardsTier === t.key ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                          border: standardsTier === t.key ? `1px solid ${t.color}40` : '1px solid rgba(255,255,255,0.06)',
                          color: standardsTier === t.key ? t.color : '#64748b',
                        }}
                      >
                        {t.icon && <span className="text-[10px]">{t.icon}</span>}
                        {t.label}
                        <span className="text-[9px] opacity-60">({tierCounts[t.key]})</span>
                      </button>
                    ))}
                  </div>

                  {/* Competition cards */}
                  <div className="space-y-3">
                    {filteredStandards.map((std, idx) => {
                      // Build marks array for the visual gauge
                      const marks = [];
                      if (std.qual) marks.push({ label: 'ENTRY', value: std.qual, color: '#64B5F6' });
                      marks.push({ label: 'GOLD', value: std.gold, color: '#FFD700' });
                      marks.push({ label: 'BRONZE', value: std.bronze, color: '#CD7F32' });
                      marks.push({ label: '8TH', value: std.p8, color: '#78909C' });
                      if (std.semi) marks.push({ label: 'SEMI', value: std.semi, color: '#546E7A' });

                      // Sort marks from hardest to easiest
                      marks.sort((a, b) => isThrows ? b.value - a.value : a.value - b.value);

                      // Calculate gauge range
                      const allVals = marks.map(m => m.value);
                      const minVal = Math.min(...allVals, pb);
                      const maxVal = Math.max(...allVals, pb);
                      const range = maxVal - minVal || 1;
                      const padding = range * 0.1;
                      const gaugeMin = minVal - padding;
                      const gaugeMax = maxVal + padding;
                      const gaugeRange = gaugeMax - gaugeMin;
                      const pbPct = isThrows
                        ? ((pb - gaugeMin) / gaugeRange) * 100
                        : ((gaugeMax - pb) / gaugeRange) * 100;

                      // Determine athlete's position label
                      const beatsMark = (mark) => isThrows ? pb >= mark : pb <= mark;
                      const positionLabel = beatsMark(std.gold) ? 'Gold Level' : beatsMark(std.bronze) ? 'Medal Zone' : beatsMark(std.p8) ? 'Finalist' : std.semi && beatsMark(std.semi) ? 'Semi-Finalist' : std.qual && beatsMark(std.qual) ? 'Qualifier' : 'Below Entry';
                      const positionColor = beatsMark(std.gold) ? '#FFD700' : beatsMark(std.bronze) ? '#CD7F32' : beatsMark(std.p8) ? '#10b981' : '#64748b';

                      return (
                        <div key={idx} className="rounded-xl overflow-hidden" style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${std.color}25`,
                          borderLeft: `3px solid ${std.color}`,
                        }}>
                          {/* Competition header */}
                          <div className="flex items-center justify-between px-4 py-3" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: std.color}}></div>
                              <span className="text-xs sm:text-sm font-semibold text-white landing-font">{std.label}</span>
                              {std.ageGroup === 'u20' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mono-font bg-purple-500/15 text-purple-400">U20</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded mono-font" style={{background: `${positionColor}18`, color: positionColor, border: `1px solid ${positionColor}30`}}>
                                {positionLabel}
                              </span>
                            </div>
                          </div>

                          {/* Visual gauge bar */}
                          <div className="px-4 py-3">
                            <div className="relative h-8 rounded-full mb-2" style={{background: 'rgba(255,255,255,0.04)'}}>
                              {/* Mark indicators */}
                              {marks.map((mark, mi) => {
                                const pct = isThrows
                                  ? ((mark.value - gaugeMin) / gaugeRange) * 100
                                  : ((gaugeMax - mark.value) / gaugeRange) * 100;
                                return (
                                  <div key={mi} className="absolute top-0 bottom-0 flex flex-col items-center" style={{left: `${Math.min(Math.max(pct, 3), 97)}%`, transform: 'translateX(-50%)'}}>
                                    <div className="w-px h-full" style={{background: `${mark.color}50`}}></div>
                                  </div>
                                );
                              })}
                              {/* PB indicator */}
                              <div className="absolute top-0 bottom-0 flex items-center" style={{left: `${Math.min(Math.max(pbPct, 2), 98)}%`, transform: 'translateX(-50%)', zIndex: 10}}>
                                <div className="w-3 h-3 rounded-full border-2" style={{background: '#f97316', borderColor: '#fff', boxShadow: '0 0 8px rgba(249,115,22,0.5)'}}></div>
                              </div>
                            </div>

                            {/* Mark labels below gauge */}
                            <div className="grid gap-1.5" style={{gridTemplateColumns: `repeat(${marks.length}, 1fr)`}}>
                              {marks.map((mark, mi) => (
                                <div key={mi} className="text-center">
                                  <div className="text-[8px] sm:text-[9px] font-bold mono-font mb-0.5" style={{color: mark.color}}>{mark.label}</div>
                                  <div className={`text-[10px] sm:text-xs mono-font ${beatsMark(mark.value) ? 'text-green-400 font-bold' : 'text-slate-500'}`}>
                                    {fmtMark(mark.value)}
                                  </div>
                                  {beatsMark(mark.value) && <span className="text-[8px] text-green-500">✓</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary footer */}
                  <div className="flex items-center justify-between mt-4 pt-3" style={{borderTop: '1px solid rgba(255,255,255,0.04)'}}>
                    <span className="text-[10px] text-slate-600 mono-font">
                      {standardsTier === 'all' ? 'All competitions' : standardsTier === 'world' ? 'Olympics & World Champs' : standardsTier === 'regional' ? 'Continental Championships' : 'U20 & Collegiate'} · {metCount}/{total} entry standards met
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border-2" style={{background: '#f97316', borderColor: '#fff'}}></div>
                      <span className="text-[10px] text-slate-500 mono-font">= Your PB ({formatTime(analysisResults.personalBest, analysisResults.discipline)})</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── CAREER BENCHMARK CHART — population curves with athlete dot ── */}
            {analysisResults.trajectoryComparison && analysisResults.trajectoryComparison.length > 0 && (() => {
              const isThrows = isThrowsDiscipline(analysisResults.discipline);
              const unit = isThrows ? 'm' : 's';
              const rawData = analysisResults.trajectoryComparison;
              const weightOpts = isThrows ? getWeightOptions(analysisResults.discipline, analysisResults.gender) : [];
              const userAge = analysisResults.age;
              const userPB = parseFloat(analysisResults.personalBest);

              // Resolve weight category for a given age
              const getWeightAtAge = (age) => {
                const match = weightOpts.find(o => age >= o.min && age <= o.max);
                return match ? match.label : null;
              };

              // Line config — colors and labels
              const lineConfig = {
                medalist: { color: '#fbbf24', label: 'Medalist', dash: '' },
                finalist: { color: '#10b981', label: 'Finalist', dash: '' },
                semiFinalist: { color: '#3b82f6', label: 'Semi-Finalist', dash: '6 3' },
                qualifier: { color: '#8b5cf6', label: 'Qualifier', dash: '4 2' },
              };

              const classKeys = ['medalist', 'finalist', 'semiFinalist', 'qualifier'];

              // For throws, compute weight transition points
              const weightTransitions = isThrows ? weightOpts.filter((_, i) => i > 0).map((w, i) => ({
                age: w.min, from: weightOpts[i].label, to: w.label,
              })) : [];

              // ── Build chart data with weight-segmented keys for throws ──
              // For throws: each data point gets keys like "medalist_3kg", "medalist_4kg" etc.
              // Only the key matching the age's weight category gets a value; others are null.
              // This creates natural line breaks at weight transitions.
              // For sprints/hurdles: use the original flat keys.
              const weightLabels = isThrows ? [...new Set(weightOpts.map(o => o.label))] : [];

              const data = rawData.map(pt => {
                const row = { age: pt.age, you: pt.you, projected: pt.projected };
                if (isThrows) {
                  const wt = getWeightAtAge(pt.age);
                  classKeys.forEach(ck => {
                    weightLabels.forEach(wl => {
                      row[`${ck}_${wl}`] = wl === wt ? pt[ck] : null;
                    });
                  });
                } else {
                  classKeys.forEach(ck => { row[ck] = pt[ck]; });
                }
                return row;
              });

              // Build the Line components to render
              const renderLines = () => {
                if (!isThrows) {
                  // Sprint / hurdles: one Line per classification
                  return classKeys.filter(ck => benchmarkLines[ck]).map(ck => (
                    <Line key={ck} type="monotone" dataKey={ck}
                      stroke={lineConfig[ck].color} strokeWidth={ck === 'medalist' || ck === 'finalist' ? 2.5 : 2}
                      strokeDasharray={lineConfig[ck].dash} dot={false} name={lineConfig[ck].label} connectNulls />
                  ));
                }
                // Throws: one Line per classification × weight segment
                const lines = [];
                classKeys.filter(ck => benchmarkLines[ck]).forEach(ck => {
                  weightLabels.forEach((wl, wi) => {
                    const key = `${ck}_${wl}`;
                    lines.push(
                      <Line key={key} type="monotone" dataKey={key}
                        stroke={lineConfig[ck].color}
                        strokeWidth={ck === 'medalist' || ck === 'finalist' ? 2.5 : 2}
                        strokeDasharray={lineConfig[ck].dash} dot={false}
                        name={wi === 0 ? lineConfig[ck].label : `${lineConfig[ck].label} (${wl})`}
                        connectNulls={false} />
                    );
                  });
                });
                return lines;
              };

              // Custom tooltip formatter that cleans up segmented key names
              const tooltipFormatter = (v, name) => {
                if (v === null || v === undefined) return ['—', name];
                // Strip weight suffix for cleaner tooltip display
                const cleanName = name.replace(/ \(.*?\)$/, '');
                return [`${v}${unit}`, cleanName];
              };

              return (
                <div className="bento-card rounded-xl p-4 sm:p-6 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" style={{color: '#f97316'}} />
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider landing-font">Career Benchmarks</h3>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 landing-font">
                    Median {isThrows ? 'distances' : 'times'} by Olympic classification at each age. Toggle lines to compare.
                    {isThrows && ' Lines break at implement weight changes — vertical markers show transitions.'}
                  </p>

                  {/* Toggle buttons */}
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
                    {Object.entries(lineConfig).map(([key, cfg]) => (
                      <button key={key}
                        onClick={() => setBenchmarkLines(prev => ({...prev, [key]: !prev[key]}))}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all mono-font"
                        style={{
                          background: benchmarkLines[key] ? `${cfg.color}15` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${benchmarkLines[key] ? `${cfg.color}40` : 'rgba(255,255,255,0.08)'}`,
                          color: benchmarkLines[key] ? cfg.color : '#475569',
                          opacity: benchmarkLines[key] ? 1 : 0.6,
                        }}>
                        <div className="w-2 h-2 rounded-full" style={{background: benchmarkLines[key] ? cfg.color : '#475569'}}></div>
                        {cfg.label}
                      </button>
                    ))}
                  </div>

                  {/* Chart */}
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="age"
                        label={{ value: 'Age (years)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <YAxis
                        label={{ value: isThrows ? 'Distance (m)' : 'Time (s)', angle: -90, position: 'insideLeft', offset: -5, fill: '#64748b', fontSize: 11 }}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        reversed={!isThrows}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#e2e8f0', fontSize: '12px' }}
                        formatter={tooltipFormatter}
                        labelFormatter={(age) => {
                          const w = isThrows ? getWeightAtAge(age) : null;
                          return `Age ${age}${w ? ` (${w})` : ''}`;
                        }}
                        itemSorter={(item) => -item.value}
                      />

                      {/* Weight transition markers for throws */}
                      {isThrows && weightTransitions.map((t, i) => (
                        <ReferenceLine key={`wt-${i}`} x={t.age} stroke="#a78bfa" strokeDasharray="4 2" strokeWidth={1}
                          label={{ value: t.to, position: 'top', fill: '#a78bfa', fontSize: 9 }} />
                      ))}

                      {/* Classification lines (segmented by weight for throws) */}
                      {renderLines()}

                      {/* Athlete dot */}
                      <ReferenceDot x={userAge} y={userPB} r={7} fill="#f97316" stroke="#fff" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 pt-3" style={{borderTop: '1px solid rgba(255,255,255,0.06)'}}>
                    {Object.entries(lineConfig).filter(([key]) => benchmarkLines[key]).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 rounded" style={{background: cfg.color, borderBottom: cfg.dash ? `2px dashed ${cfg.color}` : 'none'}}></div>
                        <span className="text-[10px] text-slate-500 mono-font">{cfg.label}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full border-2" style={{background: '#f97316', borderColor: '#fff'}}></div>
                      <span className="text-[10px] text-slate-500 mono-font">You ({formatTime(analysisResults.personalBest, analysisResults.discipline)})</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── SIMILAR ATHLETES ── */}
            {analysisResults.similarAthletes && analysisResults.similarAthletes.length > 0 && (
              <div className="bento-card rounded-xl p-4 sm:p-6 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4" style={{color: '#f97316'}} />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider landing-font">Similar Athletes</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {analysisResults.similarAthletes.map((athlete, idx) => (
                    <div key={idx} className="relative bg-slate-700/40 rounded-xl border border-slate-700/50 p-3 sm:p-4">
                      <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow">
                        {idx + 1}
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-white">{athlete.name}</h4>
                          <p className="text-xs text-slate-400">{athlete.nationality}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          athlete.classification === 'F' ? 'bg-yellow-900/40 text-yellow-300'
                          : athlete.classification === 'SF' ? 'bg-blue-900/40 text-blue-300'
                          : 'bg-slate-600 text-slate-300'
                        }`}>
                          {athlete.classification === 'F' ? 'Finalist' : athlete.classification === 'SF' ? 'Semi' : 'Qualifier'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-800/80 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-slate-400">PB</p>
                          <p className="text-base font-bold text-white">{athlete.pb}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                        </div>
                        <div className="bg-slate-800/80 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-slate-400">Peak Age</p>
                          <p className="text-base font-bold text-white">{athlete.peakAge}</p>
                        </div>
                      </div>
                      <div className={`rounded-lg p-2 text-center text-xs font-medium ${
                        Math.abs(athlete.timeDiff) < 0.3 ? 'bg-green-900/30 text-green-300' : 'bg-amber-900/30 text-amber-300'
                      }`}>
                        Age {athlete.closestAge}: <span className="font-bold">{formatTime(athlete.timeAtSimilarAge, analysisResults.discipline)}</span>
                        {' '}({Math.abs(athlete.timeDiff) < 0.05 ? 'identical' :
                          `${Math.abs(athlete.timeDiff).toFixed(2)}s ${isThrowsDiscipline(analysisResults.discipline) ? (athlete.timeAtSimilarAge > analysisResults.personalBest ? 'further' : 'shorter') : (athlete.timeAtSimilarAge < analysisResults.personalBest ? 'faster' : 'slower')}`})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── IMPROVEMENT SCENARIOS ── */}
            {analysisResults.improvementScenarios && (
              <div className="bento-card rounded-xl p-4 sm:p-6 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4" style={{color: '#f97316'}} />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider landing-font">Improvement Scenarios</h3>
                </div>
                <p className="text-sm text-slate-400 mb-5">
                  Projected {isThrowsDiscipline(analysisResults.discipline) ? 'distances' : 'times'} at different annual improvement rates from {formatTime(analysisResults.personalBest, analysisResults.discipline)}{!isThrowsDiscipline(analysisResults.discipline) && !isDistanceDiscipline(analysisResults.discipline) ? 's' : ''}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-600">
                        <th className="text-left py-2 px-1.5 sm:py-2.5 sm:px-2 font-semibold text-slate-300 sticky left-0 bg-slate-800/90 text-xs sm:text-sm">Rate</th>
                        {analysisResults.improvementScenarios[0] && Object.keys(analysisResults.improvementScenarios[0].times).map(futAge => (
                          <th key={futAge} className={`text-center py-2.5 px-2 font-semibold min-w-[56px] ${
                            parseInt(futAge) === analysisResults.age ? 'text-orange-400' : 'text-slate-300'
                          }`}>{futAge}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResults.improvementScenarios.map((row, idx) => (
                        <tr key={idx} className={`border-b border-slate-700/50 ${idx === 0 ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'}`}>
                          <td className={`py-2 px-2 font-bold sticky left-0 ${idx === 0 ? 'bg-slate-700/30 text-orange-400' : 'bg-slate-800/90 text-slate-400'}`}>
                            {row.rate}
                          </td>
                          {Object.entries(row.times).map(([futAge, time]) => {
                            const meetsFinalist = isThrowsDiscipline(analysisResults.discipline) ? time >= analysisResults.thresholds.finalist : time <= analysisResults.thresholds.finalist;
                            const meetsMQT = analysisResults.championshipData && (isThrowsDiscipline(analysisResults.discipline) ? time >= analysisResults.championshipData.mqt : time <= analysisResults.championshipData.mqt);
                            return (
                              <td key={futAge} className={`py-2 px-2 text-center text-xs ${
                                parseInt(futAge) === analysisResults.age ? 'font-bold text-orange-300' : ''
                              } ${meetsFinalist ? 'text-green-400 font-bold' : meetsMQT ? 'text-blue-400 font-semibold' : 'text-slate-400'}`}>
                                {formatTime(time, analysisResults.discipline)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5"><span className="font-bold text-green-400">Green</span> = Finalist threshold</div>
                  <div className="flex items-center gap-1.5"><span className="font-bold text-blue-400">Blue</span> = Olympic MQT</div>
                </div>
              </div>
            )}

            {/* ── DISCLAIMER ── */}
            <div className="rounded-xl p-5 mb-8" style={{background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)'}}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{color: '#f59e0b'}} />
                <p className="text-xs text-slate-500 leading-relaxed landing-font">
                  Quick Analysis is based on a single time at a single age. For trajectory modelling, rate of development tracking, and full career analysis, {user ? (
                    <>use the <button onClick={() => { setActiveTab('manual'); setCurrentView('input'); }} className="text-orange-400 hover:underline font-medium">Manual Entry</button> or <button onClick={() => { setActiveTab('url'); setCurrentView('input'); }} className="text-orange-400 hover:underline font-medium">URL Import</button> methods with full race history.</>
                  ) : (
                    <><button onClick={onSignUp} className="text-emerald-400 hover:underline font-medium">sign up for free</button> to access Manual Entry and URL Import with full race history.</>
                  )}
                </p>
              </div>
            </div>

            {/* Back button */}
            <div className="text-center">
              <button onClick={handleBack}
                className="px-8 py-3 text-white font-semibold rounded-xl transition-all hover:translate-y-[-1px] landing-font" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)'}}>
                &larr; Back to Home
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* RESULTS DASHBOARD                                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'results' && analysisResults && (
        <div className="min-h-screen flex flex-col" style={{background: 'linear-gradient(165deg, #0a0a0f 0%, #0d1117 30%, #111318 60%, #0a0a0f 100%)'}}>
          {/* Atmospheric background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 noise-overlay opacity-40"></div>
            <div className="absolute top-[10%] left-[60%] w-[600px] h-[600px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)'}}></div>
            <div className="absolute top-[40%] left-[10%] w-[400px] h-[400px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)'}}></div>
            <div className="absolute top-[70%] left-[50%] w-[500px] h-[500px] rounded-full blur-[150px]" style={{background: 'radial-gradient(circle, rgba(168,85,247,0.03) 0%, transparent 70%)'}}></div>
          </div>

          {/* Nav */}
          <nav className="relative z-20" style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
            <div className="max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="bnchmrkd" className="w-7 h-7" />
                <span className="text-lg font-bold text-white tracking-tight landing-font">bnchmrkd<span style={{color: '#f97316'}}>.</span></span>
              </div>
              <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors landing-font">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Home</span>
              </button>
            </div>
          </nav>

          <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 py-10">
            {/* ── DISCIPLINE TABS (for multi-discipline scrape results) ── */}
            {multiResults && (
              <div className="bento-card rounded-xl p-4 mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-5 h-5 " style={{color: '#f97316'}} />
                  <span className="font-semibold text-white">Disciplines Analyzed</span>
                  <span className="text-xs text-slate-400 ml-2">
                    ({Object.entries(multiResults).filter(([k]) => !k.startsWith('_')).reduce((sum, [, r]) => sum + (r._totalRaces || 0), 0)} races across {Object.keys(multiResults).filter(k => !k.startsWith('_')).length} disciplines)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(multiResults)
                    .filter(([key]) => !key.startsWith('_'))
                    .map(([disc, result]) => (
                    <button
                      key={disc}
                      onClick={() => {
                        setActiveDiscipline(disc);
                        setAnalysisResults(result);
                        setChartView('time');
                      }}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                        activeDiscipline === disc
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {disc}
                      <span className={`ml-2 text-xs ${activeDiscipline === disc ? 'text-orange-100' : 'text-slate-400'}`}>
                        ({result._totalRaces || 0} races)
                      </span>
                    </button>
                  ))}
                  {/* Show disciplines that were found but couldn't be analyzed */}
                  {multiResults._failedDisciplines && multiResults._failedDisciplines.map(disc => (
                    <span key={disc} className="px-4 py-2 rounded-lg text-sm bg-slate-700/50 text-slate-400 border border-dashed border-slate-600">
                      {disc} <span className="text-xs">(no benchmarks for this gender)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── HERO HEADER — PB as anchor ── */}
            <div className="bento-card rounded-2xl p-5 sm:p-8 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(249,115,22,0.1)'}}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider mono-font text-slate-500">{analysisResults.discipline} &middot; {analysisResults.gender} &middot; Age {analysisResults.age}</span>
                    {analysisResults.implementWeight && !analysisResults.isSeniorWeight && (
                      <span className="text-[10px] font-medium text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded mono-font">Youth</span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-2xl font-bold text-white landing-font tracking-tight mb-1">{analysisResults.name}</h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-6xl font-bold mono-font tracking-tight" style={{color: '#f97316'}}>{formatTime(analysisResults.personalBest, analysisResults.discipline)}</span>
                    {!isThrowsDiscipline(analysisResults.discipline) && !isDistanceDiscipline(analysisResults.discipline) && (
                      <span className="text-lg sm:text-2xl font-medium text-slate-500 mono-font">s</span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 landing-font">{analysisResults.careerPhase}</p>
                </div>
                {/* Readiness Ring — compact */}
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle cx="50" cy="50" r="42" fill="none"
                        stroke={getReadinessColor(analysisResults.readinessScore)}
                        strokeWidth="6"
                        strokeDasharray={`${(analysisResults.readinessScore / 100) * 263.9} 263.9`}
                        strokeLinecap="round" transform="rotate(-90 50 50)" />
                      <text x="50" y="47" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#f1f5f9" style={{fontFamily: "'DM Mono', monospace"}}>{analysisResults.readinessScore}</text>
                      <text x="50" y="63" textAnchor="middle" fontSize="9" fill="#64748b" style={{fontFamily: "'Instrument Sans', sans-serif"}}>Readiness</text>
                    </svg>
                  </div>
                  <div className="hidden sm:flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{background: getReadinessColor(analysisResults.readinessScore)}}></div>
                      <span className="text-xs text-slate-400 landing-font">{analysisResults.readinessScore >= 80 ? 'Competition Ready' : analysisResults.readinessScore >= 60 ? 'On Track' : analysisResults.readinessScore >= 40 ? 'Developing' : 'Building'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-xs text-slate-400 landing-font">Peak: Age {analysisResults.peakProjection.age}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SNAPSHOT GRID — 3 tiles: Tier / Trajectory / Standards ── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-8">
              {[
                {
                  label: 'Tier',
                  value: analysisResults.percentileAtCurrentAge >= 90 ? 'Elite' : analysisResults.percentileAtCurrentAge >= 75 ? 'National' : analysisResults.percentileAtCurrentAge >= 50 ? 'Competitive' : 'Developing',
                  status: `Top ${100 - analysisResults.percentileAtCurrentAge}% at age ${analysisResults.age}`,
                  statusColor: analysisResults.percentileAtCurrentAge >= 90 ? '#10b981' : analysisResults.percentileAtCurrentAge >= 75 ? '#3b82f6' : analysisResults.percentileAtCurrentAge >= 50 ? '#f59e0b' : '#64748b',
                },
                {
                  label: 'Trajectory',
                  value: analysisResults.trajectoryType === 'Late Developer' ? 'Climbing' : analysisResults.trajectoryType === 'Early Peaker' ? 'Holding' : 'Plateau',
                  status: analysisResults.trajectoryType === 'Late Developer' ? '↑ Still rising' : analysisResults.trajectoryType === 'Early Peaker' ? '→ Maintain' : '— Steady',
                  statusColor: analysisResults.trajectoryType === 'Late Developer' ? '#3b82f6' : analysisResults.trajectoryType === 'Early Peaker' ? '#f59e0b' : '#a855f7',
                },
                {
                  label: 'Standards',
                  value: analysisResults.standards ? `${analysisResults.standards.filter(s => s.met).length}/${analysisResults.standards.length}` : '—',
                  status: analysisResults.standards && analysisResults.standards.filter(s => s.met).length === analysisResults.standards.length ? 'All Clear' : analysisResults.standards && analysisResults.standards.filter(s => s.met).length > 0 ? 'In Progress' : 'None Yet',
                  statusColor: analysisResults.standards && analysisResults.standards.filter(s => s.met).length === analysisResults.standards.length ? '#10b981' : analysisResults.standards && analysisResults.standards.filter(s => s.met).length > 0 ? '#f59e0b' : '#64748b',
                },
              ].map((card, i) => (
                <div key={i} className="bento-card rounded-xl p-3 sm:p-4" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider mono-font mb-2">{card.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-white mono-font leading-none mb-1.5">{card.value}</p>
                  <p className="text-[10px] sm:text-xs font-semibold" style={{color: card.statusColor}}>{card.status}</p>
                </div>
              ))}
            </div>

            {/* ── DASHBOARD TAB NAVIGATION ── */}
            <div className="flex gap-1 rounded-xl p-1 sm:p-1.5 mb-6 sm:mb-8 overflow-x-auto" style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)'}}>
              {[
                { id: 'overview', label: 'Overview', icon: Target },
                { id: 'trajectory', label: 'Trajectory', icon: TrendingUp },
                { id: 'benchmarks', label: 'Benchmarks', icon: Users },
                { id: 'insights', label: 'Insights', icon: Zap },
              ].map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => { if (tab.id === 'benchmarks') analytics.standardsTabViewed(); setDashTab(tab.id); }}
                    className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 px-2 sm:py-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap landing-font ${
                      dashTab === tab.id
                        ? 'text-white shadow-lg'
                        : 'text-slate-500 hover:text-white'
                    }`}
                    style={dashTab === tab.id ? {background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)', boxShadow: '0 4px 15px rgba(249,115,22,0.25)'} : {}}>
                    <TabIcon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ══════════ OVERVIEW TAB ══════════ */}
            {dashTab === 'overview' && (<>

            {/* ── WHERE YOU STAND — form snapshot + championship progression rail ── */}
            {analysisResults.standards && analysisResults.standards.length > 0 && (() => {
              const isThrows = isThrowsDiscipline(analysisResults.discipline);
              const unit = isThrows ? 'm' : 's';
              const pb = parseFloat(analysisResults.personalBest);
              const races = analysisResults._rawRaces || [];
              const wrInfo = (COMPETITION_STANDARDS[analysisResults.eventCode] || {}).wr || null;

              // ── Form snapshot: PB / SB / Last race ──
              const disc = analysisResults.discipline;
              const fmt = (v) => formatTime(v, disc);
              const better = (a, b) => isThrows ? a > b : a < b;
              const sortedByDate = [...races].filter(r => r.date).sort((a, b) => new Date(b.date) - new Date(a.date));
              const lastRace = sortedByDate[0] || null;
              const currentYear = new Date().getFullYear();
              const seasonRaces = races.filter(r => r.date && new Date(r.date).getFullYear() === currentYear);
              const sb = seasonRaces.length
                ? seasonRaces.reduce((best, r) => (better(r.value, best) ? r.value : best), seasonRaces[0].value)
                : null;
              const pbRace = races.find(r => Math.abs(r.value - pb) < 0.005);
              const pbYear = pbRace && pbRace.date ? new Date(pbRace.date).getFullYear() : null;
              const sbDelta = sb != null ? (isThrows ? (sb - pb) : (sb - pb)) : null; // negative = faster than PB (impossible), positive = slower
              const lastDelta = lastRace && sb != null ? (isThrows ? (lastRace.value - sb) : (lastRace.value - sb)) : null;
              const fmtDelta = (d) => {
                if (d == null) return '';
                const sign = d > 0 ? '+' : '';
                return `${sign}${d.toFixed(2)}${unit}`;
              };
              const deltaColor = (d) => {
                if (d == null || Math.abs(d) < 0.005) return 'text-slate-400';
                const isBetter = isThrows ? d > 0 : d < 0;
                return isBetter ? 'text-emerald-400' : 'text-orange-300';
              };
              const lastDateStr = lastRace && lastRace.date
                ? new Date(lastRace.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '';

              // ── Championship rail: pick selected comp ──
              const standards = analysisResults.standards;
              const defaultComp = (() => {
                // Pick the world-tier comp where the athlete is closest to (but not past) the qualifier — that's "where they're aiming"
                const worldComps = standards.filter(s => s.compTier === 'world');
                const pool = worldComps.length ? worldComps : standards;
                // Find first comp where pb has NOT yet beaten the qualifier (or p8 if no qual)
                const target = pool.find(s => {
                  const mark = s.qual || s.p8;
                  return mark && !(isThrows ? pb >= mark : pb <= mark);
                });
                return target || pool[0];
              })();
              const activeComp = standards.find(s => s.compId === selectedCompId) || defaultComp;

              // Build markers for rail: qual / p8 / bronze / gold / WR
              const allMarkers = [];
              if (activeComp.qual) allMarkers.push({ label: 'Qualifier', value: activeComp.qual, color: '#94a3b8' });
              if (activeComp.p8) allMarkers.push({ label: '8th place', value: activeComp.p8, color: '#3b82f6' });
              if (activeComp.bronze) allMarkers.push({ label: 'Bronze', value: activeComp.bronze, color: '#cd7f32' });
              if (activeComp.gold) allMarkers.push({ label: 'Gold', value: activeComp.gold, color: '#FFD700' });
              if (wrInfo && wrInfo.mark) allMarkers.push({ label: 'WR', value: wrInfo.mark, color: '#f97316' });

              // Rail bounds: from "slowest meaningful mark" to "fastest meaningful mark", padded by PB
              const allVals = [...allMarkers.map(m => m.value), pb];
              const minVal = Math.min(...allVals);
              const maxVal = Math.max(...allVals);
              const padding = (maxVal - minVal) * 0.05 || 0.1;
              const railMin = minVal - padding;
              const railMax = maxVal + padding;
              const railRange = railMax - railMin || 1;
              // For time: lower=better=right side. For throws: higher=better=right side.
              const getPos = (v) => isThrows
                ? ((v - railMin) / railRange) * 100
                : ((railMax - v) / railRange) * 100;

              // Concrete gap line
              const beats = (mark) => isThrows ? pb >= mark : pb <= mark;
              const orderedTargets = [
                activeComp.qual ? { label: 'qualify', value: activeComp.qual } : null,
                activeComp.p8 ? { label: 'reach the final', value: activeComp.p8 } : null,
                activeComp.bronze ? { label: 'medal', value: activeComp.bronze } : null,
                activeComp.gold ? { label: 'win gold', value: activeComp.gold } : null,
              ].filter(Boolean);
              const nextTarget = orderedTargets.find(t => !beats(t.value));
              const gapText = (() => {
                if (!nextTarget) return `Cleared every standard at ${activeComp.label}.`;
                const gap = isThrows ? (nextTarget.value - pb) : (pb - nextTarget.value);
                return `${formatTime(gap, analysisResults.discipline)} away from ${nextTarget.label} at ${activeComp.label}`;
              })();

              return (
                <div className="bento-card rounded-xl p-4 sm:p-6 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  <div className="mb-5">
                    <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5 flex items-center gap-1.5">
                      <Award className="w-3 h-3" />
                      Where you stand
                    </p>
                    <h3 className="landing-font text-xl sm:text-2xl font-semibold text-white tracking-tight mb-1">
                      Form &amp; championship gap
                    </h3>
                    <p className="text-sm text-slate-400">Current form vs lifetime best, and your distance from real championship marks</p>
                  </div>

                  {/* ── Form snapshot row ── */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                    <div className="rounded-xl p-3 sm:p-4" style={{background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)'}}>
                      <p className="mono-font text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-1">Personal Best</p>
                      <p className="mono-font text-2xl sm:text-3xl font-bold text-orange-400 leading-none">{fmt(pb)}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">{pbYear ? `set ${pbYear}` : 'lifetime best'}</p>
                    </div>
                    <div className="rounded-xl p-3 sm:p-4" style={{background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)'}}>
                      <p className="mono-font text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-1">Season Best</p>
                      <p className="mono-font text-2xl sm:text-3xl font-bold text-white leading-none">{sb != null ? fmt(sb) : '—'}</p>
                      <p className={`text-[10px] sm:text-xs mt-1.5 mono-font ${deltaColor(sbDelta)}`}>{sbDelta != null ? `${fmtDelta(sbDelta)} vs PB` : 'no races this year'}</p>
                    </div>
                    <div className="rounded-xl p-3 sm:p-4" style={{background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)'}}>
                      <p className="mono-font text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-1">Last Race</p>
                      <p className="mono-font text-2xl sm:text-3xl font-bold text-white leading-none">{lastRace ? fmt(lastRace.value) : '—'}</p>
                      <p className={`text-[10px] sm:text-xs mt-1.5 mono-font ${deltaColor(lastDelta)}`}>{lastRace ? (lastDelta != null ? `${fmtDelta(lastDelta)} vs SB · ${lastDateStr}` : lastDateStr) : ''}</p>
                    </div>
                  </div>

                  {/* ── Championship selector chips ── */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {standards.slice(0, 6).map(comp => {
                      const isActive = comp.compId === activeComp.compId;
                      return (
                        <button
                          key={comp.compId}
                          onClick={() => setSelectedCompId(comp.compId)}
                          className={`mono-font text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors focus:outline-none focus-visible:outline-none ${
                            isActive
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                              : 'bg-white/[0.03] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-200'
                          }`}
                        >
                          {comp.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Progression rail ── */}
                  <div className="relative h-3 rounded-full mb-12" style={{background: 'rgba(255,255,255,0.06)'}}>
                    {/* Filled portion up to PB */}
                    <div className="absolute top-0 left-0 h-full rounded-full" style={{width: `${Math.min(100, Math.max(2, getPos(pb)))}%`, background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)', transition: 'width 0.6s ease'}}></div>
                    {/* Marker ticks + labels */}
                    {allMarkers.map((m, i) => {
                      const pos = getPos(m.value);
                      const cleared = beats(m.value);
                      return (
                        <div key={i} className="absolute top-0 flex flex-col items-center pointer-events-none" style={{left: `${pos}%`, transform: 'translateX(-50%)'}}>
                          <div className="w-0.5 h-3 rounded-full" style={{background: cleared ? m.color : 'rgba(255,255,255,0.25)'}}></div>
                          <div className="mt-2 text-center whitespace-nowrap">
                            <p className="mono-font text-[10px] font-semibold" style={{color: cleared ? m.color : '#64748b'}}>{m.value}{unit}</p>
                            <p className="landing-font text-[9px] text-slate-500">{m.label}</p>
                          </div>
                        </div>
                      );
                    })}
                    {/* PB marker (above the rail) */}
                    <div className="absolute flex flex-col items-center pointer-events-none" style={{left: `${Math.min(100, Math.max(0, getPos(pb)))}%`, top: '-22px', transform: 'translateX(-50%)'}}>
                      <p className="mono-font text-[9px] font-bold text-orange-400 mb-0.5">PB</p>
                      <div className="w-4 h-4 rounded-full border-2 border-white shadow-lg" style={{background: '#f97316'}}></div>
                    </div>
                  </div>

                  {/* ── Gap caption ── */}
                  <div className="text-center p-3 sm:p-4 rounded-xl" style={{background: nextTarget ? 'rgba(255,255,255,0.02)' : 'rgba(16,185,129,0.06)', border: nextTarget ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(16,185,129,0.2)'}}>
                    <p className={`text-sm sm:text-base landing-font ${nextTarget ? 'text-slate-300' : 'text-emerald-300'}`}>
                      {nextTarget ? (
                        <>
                          <span className="text-orange-400 font-semibold mono-font">{formatTime(isThrows ? (nextTarget.value - pb) : (pb - nextTarget.value), analysisResults.discipline)}</span>
                          {' '}away from{' '}
                          <span className="text-white font-semibold">{nextTarget.label}</span>
                          {' '}at <span className="text-white font-semibold">{activeComp.label}</span>
                        </>
                      ) : gapText}
                    </p>
                    {wrInfo && (
                      <p className="text-[10px] mono-font text-slate-500 mt-1.5">
                        WR: {wrInfo.mark}{unit} — {wrInfo.holder} ({wrInfo.year})
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── COMPETITION STANDARDS (full dashboard version uses same component as quickResults) ── */}
            {analysisResults.standards && analysisResults.standards.length > 0 && (() => {
              const isThrows = isThrowsDiscipline(analysisResults.discipline);
              const unit = isThrows ? 'm' : 's';
              const pb = parseFloat(analysisResults.personalBest);
              const eventCode = getEventCode(analysisResults.discipline, analysisResults.gender);
              const compData = COMPETITION_STANDARDS[eventCode];
              const filteredStandards = standardsTier === 'all'
                ? analysisResults.standards
                : analysisResults.standards.filter(s => s.compTier === standardsTier);
              const metCount = filteredStandards.filter(s => s.met).length;
              const total = filteredStandards.length;
              const fmtMark = (v) => v === null || v === undefined ? '—' : formatTime(v, analysisResults.discipline);
              const beatsMark = (mark) => isThrows ? pb >= mark : pb <= mark;
              const tierCounts = { all: analysisResults.standards.length, world: analysisResults.standards.filter(s => s.compTier === 'world').length, regional: analysisResults.standards.filter(s => s.compTier === 'regional').length, development: analysisResults.standards.filter(s => s.compTier === 'development').length };
              return (
                <div className="bento-card rounded-xl p-4 sm:p-6 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4" style={{color: '#f97316'}} />
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider landing-font">Competition Standards</h3>
                    </div>
                    {compData?.wr && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.15)'}}>
                        <span className="text-[9px] font-bold text-red-400 mono-font">WR</span>
                        <span className="text-xs font-bold text-red-300 mono-font">{fmtMark(compData.wr.mark)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                    {[
                      { key: 'all', label: 'All', color: '#f97316' },
                      { key: 'world', label: 'World', color: '#FFD700', icon: '🏅' },
                      { key: 'regional', label: 'Regional', color: '#E84545', icon: '🌏' },
                      { key: 'development', label: 'Development', color: '#A259FF', icon: '🎓' },
                    ].filter(t => t.key === 'all' || tierCounts[t.key] > 0).map(t => (
                      <button key={t.key} onClick={() => setStandardsTier(t.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold mono-font transition-all flex-shrink-0"
                        style={{
                          background: standardsTier === t.key ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                          border: standardsTier === t.key ? `1px solid ${t.color}40` : '1px solid rgba(255,255,255,0.06)',
                          color: standardsTier === t.key ? t.color : '#64748b',
                        }}
                      >
                        {t.icon && <span className="text-[10px]">{t.icon}</span>}
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {filteredStandards.map((std, idx) => {
                      const positionLabel = beatsMark(std.gold) ? 'Gold Level' : beatsMark(std.bronze) ? 'Medal Zone' : beatsMark(std.p8) ? 'Finalist' : 'Below';
                      const positionColor = beatsMark(std.gold) ? '#FFD700' : beatsMark(std.bronze) ? '#CD7F32' : beatsMark(std.p8) ? '#10b981' : '#64748b';
                      return (
                        <div key={idx} className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${std.color}`}}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-white landing-font">{std.label}</span>
                              {std.ageGroup === 'u20' && <span className="text-[9px] font-bold px-1 py-0.5 rounded mono-font bg-purple-500/15 text-purple-400">U20</span>}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] mono-font text-slate-500">
                              <span><span style={{color: '#FFD700'}}>G</span> {fmtMark(std.gold)}</span>
                              <span><span style={{color: '#CD7F32'}}>B</span> {fmtMark(std.bronze)}</span>
                              <span><span style={{color: '#78909C'}}>8</span> {fmtMark(std.p8)}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded mono-font" style={{background: `${positionColor}18`, color: positionColor}}>{positionLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── PEAK PROJECTION removed from Overview — full version lives in Insights tab ── */}

            {/* ── INSIGHTS — polished recommendation cards ── */}
            {analysisResults.recommendations && analysisResults.recommendations.length > 0 && (() => {
              const PRIORITY_META = {
                high:   { label: 'HIGH',   color: '#ef4444', soft: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.22)',  Icon: AlertTriangle },
                medium: { label: 'FOCUS',  color: '#f59e0b', soft: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.22)', Icon: Zap },
                low:    { label: 'NOTE',   color: '#3b82f6', soft: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.22)', Icon: Info },
              };
              const recs = analysisResults.recommendations;
              // Sort high → medium → low so the most important item sits at the top.
              const order = { high: 0, medium: 1, low: 2 };
              const sorted = [...recs].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
              return (
                <div className="bento-card rounded-2xl p-5 sm:p-7 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  {/* Section header — matches bento pattern */}
                  <div className="mb-5">
                    <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-orange-300 mb-1">Actions</p>
                    <div className="flex items-end justify-between gap-3">
                      <h3 className="landing-font text-lg sm:text-xl font-semibold text-white leading-tight">What to focus on next</h3>
                      <span className="mono-font text-[10px] text-slate-500 tabular-nums pb-1">{sorted.length} item{sorted.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {sorted.map((rec, idx) => {
                      const meta = PRIORITY_META[rec.priority] || PRIORITY_META.low;
                      const IconComp = meta.Icon;
                      return (
                        <div
                          key={idx}
                          className="relative flex gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl overflow-hidden"
                          style={{
                            background: meta.soft,
                            border: `1px solid ${meta.border}`,
                          }}
                        >
                          {/* Left priority accent bar */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-[3px]"
                            style={{ background: `linear-gradient(180deg, ${meta.color} 0%, transparent 100%)` }}
                          />
                          {/* Icon badge */}
                          <div
                            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                            style={{
                              background: `${meta.color}15`,
                              border: `1px solid ${meta.color}33`,
                            }}
                          >
                            <IconComp className="w-4 h-4" style={{ color: meta.color }} />
                          </div>
                          {/* Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm sm:text-base font-semibold text-white landing-font leading-tight">{rec.title}</h4>
                              <span
                                className="mono-font text-[9px] font-bold tracking-[0.14em] px-1.5 py-0.5 rounded"
                                style={{
                                  color: meta.color,
                                  background: `${meta.color}18`,
                                  border: `1px solid ${meta.color}33`,
                                }}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed landing-font">{rec.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── FULL RACE HISTORY: scatter plot + results table ── */}
            {analysisResults._rawRaces && analysisResults._rawRaces.length > 0 && (() => {
              const isThrows = isThrowsDiscipline(analysisResults.discipline);
              const unit = isThrows ? 'm' : 's';
              const races = analysisResults._rawRaces;
              // Only use races that have an age for the scatter
              const scatterRaces = races.filter(r => r.age != null && r.value != null);
              const fmtVal = (v) => v == null ? '—' : formatTime(v, analysisResults.discipline);
              // Table: sort newest → oldest
              const tableRaces = [...races].sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(b.date) - new Date(a.date);
              });
              return (
                <div className="bento-card rounded-xl p-4 sm:p-6 mb-4 sm:mb-6" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" style={{color: '#f97316'}} />
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider landing-font">Full Event History</h3>
                    </div>
                    <span className="text-[10px] text-slate-500 mono-font">{races.length} result{races.length === 1 ? '' : 's'}</span>
                  </div>

                  {/* Scatter plot */}
                  {scatterRaces.length > 0 ? (
                    <div style={{width: '100%', height: 320}} className="mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{top: 10, right: 20, bottom: 30, left: 10}}>
                          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                          <XAxis
                            type="number"
                            dataKey="age"
                            name="Age"
                            domain={['dataMin - 0.5', 'dataMax + 0.5']}
                            tick={{fill: '#94a3b8', fontSize: 11}}
                            label={{value: 'Age (years)', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11}}
                          />
                          <YAxis
                            type="number"
                            dataKey="value"
                            name="Performance"
                            domain={['auto', 'auto']}
                            reversed={!isThrows}
                            tick={{fill: '#94a3b8', fontSize: 11}}
                            tickFormatter={(v) => formatTime(v, analysisResults.discipline)}
                            label={{value: isThrows ? 'Distance (m)' : 'Time (s)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11}}
                          />
                          <Tooltip
                            cursor={{strokeDasharray: '3 3'}}
                            contentStyle={{background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11}}
                            labelStyle={{color: '#f1f5f9'}}
                            formatter={(value, name, props) => {
                              if (name === 'Performance') return [fmtVal(value), 'Mark'];
                              if (name === 'Age') return [value.toFixed(2), 'Age'];
                              return [value, name];
                            }}
                            labelFormatter={() => ''}
                            content={({active, payload}) => {
                              if (!active || !payload || !payload.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div style={{background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11}}>
                                  <div className="text-white font-semibold mono-font">{fmtVal(d.value)}</div>
                                  <div className="text-slate-400 mono-font">Age {d.age?.toFixed(2)}</div>
                                  {d.date && <div className="text-slate-500 mono-font">{d.date}</div>}
                                  {d.competition && <div className="text-slate-500 landing-font" style={{maxWidth: 220}}>{d.competition}</div>}
                                </div>
                              );
                            }}
                          />
                          <Scatter name="Races" data={scatterRaces} fill="#f97316" fillOpacity={0.8} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="mb-6 p-4 rounded-lg text-center text-xs text-slate-500 landing-font" style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)'}}>
                      Scatter plot unavailable — no athlete date of birth on file, can't compute ages.
                    </div>
                  )}

                  {/* Results table */}
                  <div className="overflow-x-auto rounded-lg" style={{border: '1px solid rgba(255,255,255,0.06)'}}>
                    <table className="w-full text-[11px] mono-font">
                      <thead style={{background: 'rgba(255,255,255,0.03)'}}>
                        <tr className="text-slate-400">
                          <th className="text-left py-2 px-3 font-semibold">Date</th>
                          <th className="text-left py-2 px-3 font-semibold">Age</th>
                          <th className="text-left py-2 px-3 font-semibold">Mark</th>
                          {!isThrows && <th className="text-left py-2 px-3 font-semibold">Wind</th>}
                          {isThrows && <th className="text-left py-2 px-3 font-semibold">Implement</th>}
                          <th className="text-left py-2 px-3 font-semibold">Competition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRaces.map((r, i) => (
                          <tr key={i} className="text-slate-300 hover:bg-white/5 transition-colors" style={{borderTop: '1px solid rgba(255,255,255,0.04)'}}>
                            <td className="py-2 px-3">{r.date || '—'}</td>
                            <td className="py-2 px-3 text-slate-500">{r.age != null ? r.age.toFixed(2) : '—'}</td>
                            <td className="py-2 px-3 text-white font-semibold">{fmtVal(r.value)}</td>
                            {!isThrows && <td className="py-2 px-3 text-slate-500">{r.wind != null ? (r.wind > 0 ? '+' : '') + r.wind.toFixed(1) : '—'}</td>}
                            {isThrows && <td className="py-2 px-3 text-slate-500">{r.implement_weight_kg != null ? `${r.implement_weight_kg}kg` : '—'}</td>}
                            <td className="py-2 px-3 text-slate-400 landing-font">{r.competition || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            </>)}

            {/* ══════════ TRAJECTORY TAB ══════════ */}
            {dashTab === 'trajectory' && (<>

            {/* ── PERFORMANCE TRAJECTORY CHART WITH TABBED VIEWS ── */}
            <div className="bento-card rounded-xl p-4 sm:p-8 mb-6 sm:mb-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
              <div className="mb-4 sm:mb-6">
                <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Trajectory
                </p>
                <h3 className="landing-font text-xl sm:text-3xl font-semibold text-white tracking-tight">
                  Performance over time
                </h3>
              </div>

              {/* Chart View Tabs */}
              <div className="flex gap-1 mb-4 sm:mb-6 rounded-lg p-1 overflow-x-auto" style={{background: 'rgba(255,255,255,0.03)'}}>
                {[
                  { id: 'time', label: 'Performance', icon: Timer },
                  { id: 'improvementRate', label: 'Year-on-year', icon: BarChart2 },
                ].map(tab => {
                  const TabIcon = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => setChartView(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap mono-font focus:outline-none focus-visible:outline-none ${
                        chartView === tab.id
                          ? 'text-orange-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      style={chartView === tab.id ? {background: 'rgba(255,255,255,0.05)'} : {}}>
                      <TabIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* VIEW 1: Time vs Age (Original) */}
              {chartView === 'time' && (
                <>
                  <p className="text-sm text-slate-400 mb-4">
                    Absolute {isThrowsDiscipline(analysisResults.discipline) ? 'distances' : 'times'} plotted against age with projections, confidence intervals, and Olympic threshold reference lines
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={analysisResults.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <defs>
                        <linearGradient id="ci90Gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="ci50Gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="age" label={{ value: 'Age (years)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis label={{ value: getUnitLabel(analysisResults.discipline), angle: -90, position: 'insideLeft', offset: -5, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} reversed={!isThrowsDiscipline(analysisResults.discipline)} domain={['auto', 'auto']} tickFormatter={v => formatTime(v, analysisResults.discipline)} />
                      <Tooltip content={<TrajectoryTooltip />} />
                      <Area type="monotone" dataKey="ci90Upper" stroke="none" fill="url(#ci90Gradient)" name="90% CI" connectNulls={false} isAnimationActive={false} />
                      <Area type="monotone" dataKey="ci90Lower" stroke="none" fill="#1e293b" name="" connectNulls={false} isAnimationActive={false} legendType="none" />
                      <Area type="monotone" dataKey="ci50Upper" stroke="none" fill="url(#ci50Gradient)" name="50% CI" connectNulls={false} isAnimationActive={false} />
                      <Area type="monotone" dataKey="ci50Lower" stroke="none" fill="#1e293b" name="" connectNulls={false} isAnimationActive={false} legendType="none" />
                      <ReferenceLine y={analysisResults.thresholds.finalist} stroke="#dc2626" strokeDasharray="8 4" strokeWidth={2} label={{ value: `Finalist (${analysisResults.thresholds.finalist}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'})`, position: 'right', fill: '#dc2626', fontSize: 11 }} />
                      <ReferenceLine y={analysisResults.thresholds.semiFinalist} stroke="#f59e0b" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Semi (${analysisResults.thresholds.semiFinalist}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'})`, position: 'right', fill: '#f59e0b', fontSize: 11 }} />
                      <ReferenceLine y={analysisResults.thresholds.qualifier} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1} label={{ value: `Qualifier (${analysisResults.thresholds.qualifier}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'})`, position: 'right', fill: '#6b7280', fontSize: 11 }} />
                      {/* Weight transition markers for throws — vertical lines at ages where implement weight changes */}
                      {analysisResults.isThrows && (() => {
                        const weightOpts = getWeightOptions(analysisResults.discipline, analysisResults.gender);
                        const transitions = [];
                        for (let i = 0; i < weightOpts.length - 1; i++) {
                          transitions.push({ age: weightOpts[i].max + 1, from: weightOpts[i].label, to: weightOpts[i + 1].label });
                        }
                        return transitions.map((t, idx) => (
                          <ReferenceLine key={`wt-${idx}`} x={t.age} stroke="#a78bfa" strokeDasharray="4 2" strokeWidth={1.5}
                            label={{ value: `${t.to}`, position: 'top', fill: '#a78bfa', fontSize: 10 }} />
                        ));
                      })()}
                      <Line type="monotone" dataKey="projectedTime" stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="8 4" dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }} name="Projected" connectNulls={false} />
                      <Line type="monotone" dataKey="actualTime" stroke="#e8712a" strokeWidth={3} dot={{ fill: '#e8712a', r: 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} name="Actual Performance" connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                    <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-orange-500 rounded"></div><span className="text-slate-400">Your Actual {isThrowsDiscipline(analysisResults.discipline) ? 'Distances' : 'Times'}</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-blue-500 rounded" style={{borderBottom: '2px dashed #3b82f6'}}></div><span className="text-slate-400">Projected {isThrowsDiscipline(analysisResults.discipline) ? 'Distances' : 'Times'}</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-red-600 rounded" style={{borderBottom: '2px dashed #dc2626'}}></div><span className="text-slate-400">Finalist Threshold</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-amber-500 rounded" style={{borderBottom: '2px dashed #f59e0b'}}></div><span className="text-slate-400">Semi-Finalist</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-slate-800/500 rounded" style={{borderBottom: '2px dashed #6b7280'}}></div><span className="text-slate-400">Qualifier</span></div>
                    {analysisResults.isThrows && (
                      <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-purple-400 rounded" style={{borderBottom: '2px dashed #a78bfa'}}></div><span className="text-slate-400">Weight Change</span></div>
                    )}
                  </div>
                </>
              )}

              {/* VIEW 2: % Off PB vs Age */}
              {chartView === 'pctOff' && (
                <>
                  <p className="text-sm text-slate-400 mb-4">
                    Your season-best performance expressed as percentage off personal best, compared to Olympic population norms
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={analysisResults.pctOffPBChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <defs>
                        <linearGradient id="pctBandGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="age" label={{ value: 'Age (years)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis label={{ value: '% Off Personal Best', angle: -90, position: 'insideLeft', offset: -5, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} domain={[0, 'auto']} />
                      <Tooltip formatter={(v, name) => [`${parseFloat(v).toFixed(1)}%`, name]} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#94a3b8' }} />
                      <Area type="monotone" dataKey="p75Pct" stroke="none" fill="url(#pctBandGrad)" name="P25-P75 Band" connectNulls />
                      <Area type="monotone" dataKey="p25Pct" stroke="none" fill="#1e293b" name="" connectNulls legendType="none" />
                      <Line type="monotone" dataKey="medianPct" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="Population Median (P50)" connectNulls />
                      <Line type="monotone" dataKey="pctOffPB" stroke="#e8712a" strokeWidth={3} dot={{ fill: '#e8712a', r: 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} name="Your % Off PB" connectNulls={false} />
                      <ReferenceLine y={0} stroke="#10b981" strokeDasharray="8 4" strokeWidth={2} label={{ value: 'Personal Best', position: 'right', fill: '#10b981', fontSize: 11 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-xs text-slate-400 text-center">
                    Lower values = closer to your personal best. The shaded band shows where 50% of Olympic athletes perform at each age.
                  </div>
                </>
              )}

              {/* VIEW 3: Percentile Band */}
              {chartView === 'percentileBand' && (
                <>
                  <p className="text-sm text-slate-400 mb-4">
                    Population percentile corridor showing where you sit among Olympic-level athletes at each age
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={analysisResults.percentileBandData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <defs>
                        <linearGradient id="p90Band" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e2e8f0" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#e2e8f0" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="p75Band" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="p50Band" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="age" label={{ value: 'Age (years)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis label={{ value: '% Off PB', angle: -90, position: 'insideLeft', offset: -5, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} domain={[0, 'auto']} />
                      <Tooltip formatter={(v, name) => [v !== null ? `${parseFloat(v).toFixed(1)}%` : 'N/A', name]} />
                      <Area type="monotone" dataKey="p90" stroke="#cbd5e1" strokeWidth={1} fill="url(#p90Band)" name="P90 (Bottom 10%)" connectNulls />
                      <Area type="monotone" dataKey="p75" stroke="#93c5fd" strokeWidth={1} fill="url(#p75Band)" name="P75" connectNulls />
                      <Area type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={1} fill="url(#p50Band)" name="P50 (Median)" connectNulls />
                      <Line type="monotone" dataKey="p25" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="P25 (Top 25%)" connectNulls />
                      <Line type="monotone" dataKey="p10" stroke="#1d4ed8" strokeWidth={1.5} strokeDasharray="2 2" dot={false} name="P10 (Top 10%)" connectNulls />
                      <Line type="monotone" dataKey="userPctOff" stroke="#e8712a" strokeWidth={3} dot={{ fill: '#e8712a', r: 6, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} name="Your Position" connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs text-center">
                    <div className="p-2 bg-blue-900 bg-opacity-20 rounded"><span className="font-semibold text-blue-300">P10</span><br/>Top 10%</div>
                    <div className="p-2 bg-blue-700 bg-opacity-20 rounded"><span className="font-semibold text-blue-700">P25</span><br/>Top 25%</div>
                    <div className="p-2 bg-blue-500 bg-opacity-20 rounded"><span className="font-semibold text-blue-500">P50</span><br/>Median</div>
                    <div className="p-2 bg-blue-300 bg-opacity-20 rounded"><span className="font-semibold text-blue-400">P75</span><br/>Bottom 25%</div>
                    <div className="p-2 bg-slate-700 bg-opacity-50 rounded"><span className="font-semibold text-slate-400">P90</span><br/>Bottom 10%</div>
                    <div className="p-2 bg-orange-900/40 rounded"><span className="font-semibold text-orange-600">You</span><br/>Your Position</div>
                  </div>
                </>
              )}

              {/* VIEW 4: Improvement Rate */}
              {chartView === 'improvementRate' && (
                <>
                  <p className="text-sm text-slate-400 mb-4">
                    Year-on-year improvement rate showing momentum between seasons. Positive = faster, negative = slower.
                  </p>
                  {analysisResults.improvementChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={analysisResults.improvementChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" label={{ value: 'Age Period', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                        <YAxis label={{ value: 'Improvement (%)', angle: -90, position: 'insideLeft', offset: -5, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                        <Tooltip formatter={(v) => [`${parseFloat(v).toFixed(2)}%`, 'Improvement']} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }} />
                        <ReferenceLine y={analysisResults.finalistNorm} stroke="#10b981" strokeDasharray="8 4" strokeWidth={1.5} label={{ value: `Finalist Norm (${analysisResults.finalistNorm}%)`, position: 'right', fill: '#10b981', fontSize: 10 }} />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                        <Bar dataKey="improvement" radius={[4, 4, 0, 0]}>
                          {analysisResults.improvementChartData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.improvement > 0 ? '#10b981' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                      Need at least 2 seasons of data to show improvement rates
                    </div>
                  )}
                  <div className="mt-4 flex justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2"><div className="w-4 h-3 bg-emerald-500 rounded"></div><span className="text-slate-400">Improvement ({isThrowsDiscipline(analysisResults.discipline) ? 'further' : 'faster'})</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-3 bg-red-500 rounded"></div><span className="text-slate-400">Regression ({isThrowsDiscipline(analysisResults.discipline) ? 'shorter' : 'slower'})</span></div>
                    <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-emerald-500 rounded" style={{borderBottom: '2px dashed #10b981'}}></div><span className="text-slate-400">Finalist Norm</span></div>
                  </div>
                </>
              )}
            </div>

            {/* ── PROGRESSION MATRIX (in Trajectory tab) ── */}
            {analysisResults.raceHistory && analysisResults.raceHistory.length > 0 && (
              <div className="bento-card rounded-xl p-4 sm:p-8 mb-6 sm:mb-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <div className="mb-5">
                  <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3 h-3" />
                    Career Map
                  </p>
                  <h3 className="landing-font text-xl sm:text-2xl font-semibold text-white tracking-tight mb-1">
                    Progression matrix
                  </h3>
                  <p className="text-sm text-slate-400">Season best at each age — your development at a glance</p>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex gap-1 min-w-max">
                    {(() => {
                      const matrix = analysisResults.progressionMatrix;
                      const ages = Object.keys(matrix).map(Number).sort((a,b) => a - b);
                      const minAge = Math.max(15, ages[0] || 17);
                      const maxAge = Math.min(38, Math.max(ages[ages.length - 1] || 25, analysisResults.age));
                      const allAges = [];
                      for (let a = minAge; a <= maxAge; a++) allAges.push(a);
                      const pbTime = analysisResults.personalBest;
                      return allAges.map(a => {
                        const time = matrix[a];
                        const isPB = time && Math.abs(time - pbTime) < 0.005;
                        const isCurrent = a === analysisResults.age;
                        return (
                          <div key={a} className={`flex flex-col items-center rounded-lg px-3 py-2 min-w-[56px] border-2 transition-all ${
                            isPB ? 'bg-orange-500 border-orange-500 text-white'
                            : isCurrent ? 'bg-blue-500 border-blue-500 text-white'
                            : time ? 'bg-slate-700/60 border-slate-700 text-white'
                            : 'bg-slate-700/50 border-slate-700/50 text-slate-300'
                          }`}>
                            <span className={`text-xs font-semibold mb-1 ${isPB || isCurrent ? 'text-white text-opacity-80' : 'text-slate-400'}`}>{a}</span>
                            <span className={`text-sm font-bold ${!time ? 'text-slate-300' : ''}`}>
                              {time ? formatTime(time, analysisResults.discipline) : '—'}
                            </span>
                            {isPB && <span className="text-[10px] mt-0.5 font-bold">PB</span>}
                            {isCurrent && !isPB && <span className="text-[10px] mt-0.5 opacity-80">NOW</span>}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-500"></div> Personal Best</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500"></div> Current Age</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-700/60 border border-slate-700"></div> Recorded Season</div>
                </div>
              </div>
            )}

            {/* ── ROD / RODP (in Trajectory tab) ── */}
            {analysisResults.rodData && analysisResults.rodData.length > 1 && (
              <div className="bento-card rounded-xl p-4 sm:p-8 mb-6 sm:mb-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <div className="mb-5">
                  <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" />
                    Momentum
                  </p>
                  <h3 className="landing-font text-xl sm:text-2xl font-semibold text-white tracking-tight mb-1">
                    Rate of development
                  </h3>
                  <p className="text-sm text-slate-400">Year-on-year improvement rate and where it ranks vs Olympic finalists</p>
                </div>
                {(() => {
                  const chartData = analysisResults.rodData.slice(1).map(row => ({
                    age: row.age,
                    rod: row.rod,
                    rodp: row.rodp,
                  }));
                  return (
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer>
                        <BarChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="age" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Age', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }} />
                          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Improvement %', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                            formatter={(val, name) => [`${val > 0 ? '+' : ''}${val}%`, 'YoY improvement']}
                            labelFormatter={(age) => `Age ${age}`}
                          />
                          <ReferenceLine y={analysisResults.finalistNorm} stroke="#10b981" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Finalist norm (${analysisResults.finalistNorm}%)`, position: 'right', fill: '#10b981', fontSize: 10 }} />
                          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                          <Bar dataKey="rod" radius={[4, 4, 0, 0]}>
                            {chartData.map((row, idx) => (
                              <Cell key={idx} fill={row.rodp >= 75 ? '#10b981' : row.rodp >= 50 ? '#3b82f6' : row.rodp >= 25 ? '#f59e0b' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
                <div className="mt-4 flex flex-wrap gap-3 text-[11px] mono-font text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{background:'#10b981'}}></span>Elite (75+)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{background:'#3b82f6'}}></span>Above avg (50+)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{background:'#f59e0b'}}></span>Average (25+)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{background:'#ef4444'}}></span>Below avg</span>
                </div>
              </div>
            )}

            </>)}

            {/* ══════════ BENCHMARKS TAB ══════════ */}
            {dashTab === 'benchmarks' && (<>

            {/* ── PERCENTILE RANKING (in Benchmarks tab) ── */}
            <div className="bento-card rounded-xl p-4 sm:p-8 mb-6 sm:mb-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
              <div className="mb-6">
                <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3 h-3" />
                  Standing
                </p>
                <h3 className="landing-font text-xl sm:text-2xl font-semibold text-white tracking-tight">
                  Where you rank
                </h3>
              </div>
              <div className="mb-6">
                <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden mb-2">
                  <div className={`h-full ${getPercentileColor(analysisResults.percentileAtCurrentAge)} transition-all`}
                    style={{ width: `${analysisResults.percentileAtCurrentAge}%` }} />
                </div>
                <p className="text-center font-bold text-white">
                  Top {100 - analysisResults.percentileAtCurrentAge}% among Olympic-level athletes at age {analysisResults.age}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                {[
                  { label: 'Elite', range: 'Top 10%', bg: 'bg-green-900/30', text: 'text-green-300', sub: 'text-green-700' },
                  { label: 'National', range: 'Top 25%', bg: 'bg-blue-900/30', text: 'text-blue-300', sub: 'text-blue-700' },
                  { label: 'Competitive', range: 'Top 50%', bg: 'bg-amber-900/30', text: 'text-amber-300', sub: 'text-amber-700' },
                  { label: 'Developing', range: 'Below 50%', bg: 'bg-slate-800/50', text: 'text-white', sub: 'text-slate-300' },
                ].map((tier, i) => (
                  <div key={i} className={`p-2 ${tier.bg} rounded`}>
                    <p className={`font-semibold ${tier.text}`}>{tier.label}</p>
                    <p className={tier.sub}>{tier.range}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CAREER TRAJECTORY VS BENCHMARKS (in Benchmarks tab) ── */}
            <div className="bento-card rounded-xl p-4 sm:p-8 mb-6 sm:mb-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
              <div className="mb-4">
                <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Benchmark Curve
                </p>
                <h3 className="landing-font text-xl sm:text-2xl font-semibold text-white tracking-tight">
                  You vs Olympic medians
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { key: 'finalist', label: 'Finalists', color: '#10b981' },
                  { key: 'semiFinalist', label: 'Semi-Finalists', color: '#f59e0b' },
                  { key: 'qualifier', label: 'Qualifiers', color: '#94a3b8' },
                ].map(t => (
                  <button key={t.key} onClick={() => setTrajToggles(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                    className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium border transition-all ${
                      trajToggles[t.key]
                        ? 'border-transparent text-white'
                        : 'border-slate-600 text-slate-400 bg-transparent hover:border-slate-500'
                    }`}
                    style={trajToggles[t.key] ? { backgroundColor: t.color + '33', borderColor: t.color, color: t.color } : {}}
                  >
                    {trajToggles[t.key] ? '\u2713 ' : ''}{t.label}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={analysisResults.trajectoryComparison} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="age" tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 11, fill: '#64748b' }} />
                  <YAxis reversed={!isThrowsDiscipline(analysisResults.discipline)} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={['auto', 'auto']} label={{ value: getUnitLabel(analysisResults.discipline), angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} tickFormatter={v => formatTime(v, analysisResults.discipline)} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                    formatter={(v, dataKey) => {
                      if (v == null) return null;
                      const labels = { you: 'You', finalist: 'Finalist Median', semiFinalist: 'Semi-Finalist Median', qualifier: 'Qualifier Median' };
                      return [formatTime(parseFloat(v), analysisResults.discipline), labels[dataKey] || dataKey];
                    }}
                    labelFormatter={(l) => `Age ${l}`} />
                  {trajToggles.qualifier && <Line type="monotone" dataKey="qualifier" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="6 3" name="Qualifier Median" />}
                  {trajToggles.semiFinalist && <Line type="monotone" dataKey="semiFinalist" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 3" name="Semi-Finalist Median" />}
                  {trajToggles.finalist && <Line type="monotone" dataKey="finalist" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="6 3" name="Finalist Median" />}
                  <Line type="monotone" dataKey="you" stroke="#e8712a" strokeWidth={3} dot={{ r: 5, fill: '#e8712a', stroke: '#fff', strokeWidth: 1 }} activeDot={{ r: 7, fill: '#f97316' }} name="You" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className={`mt-4 p-3 rounded text-sm ${
                analysisResults.improvementRate >= analysisResults.finalistNorm
                  ? 'bg-green-900/30 border border-green-800 text-green-300'
                  : analysisResults.improvementRate >= analysisResults.nonFinalistNorm
                  ? 'bg-amber-900/30 border border-amber-800 text-amber-300'
                  : 'bg-red-900/30 border border-red-800 text-red-300'
              }`}>
                <span className="font-semibold">Improvement rate: {analysisResults.improvementRate}%/year</span>
                <span className="text-slate-400"> — Finalist norm: {analysisResults.finalistNorm}%/yr | Non-finalist: {analysisResults.nonFinalistNorm}%/yr</span>
              </div>
            </div>

            {/* ── SIMILAR ATHLETES (in Benchmarks tab) ── */}
            {analysisResults.similarAthletes && analysisResults.similarAthletes.length > 0 && (
              <div className="bento-card rounded-xl p-4 sm:p-8 mb-6 sm:mb-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <div className="mb-6">
                  <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    Career Twins
                  </p>
                  <h3 className="landing-font text-xl sm:text-2xl font-semibold text-white tracking-tight mb-1">
                    Similar athletes
                  </h3>
                  <p className="text-sm text-slate-400">Olympic athletes who recorded similar marks at a comparable age — see how their careers developed</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {analysisResults.similarAthletes.map((athlete, idx) => (
                    <div key={idx} className="relative bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-xl border border-slate-700 p-4 sm:p-5 hover:shadow-md transition-shadow">
                      <div className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow">{idx + 1}</div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-white text-base">{athlete.name}</h4>
                          <p className="text-xs text-slate-400 flex items-center gap-1"><Flag className="w-3 h-3" />{athlete.nationality}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          athlete.classification === 'F' ? 'bg-yellow-900/40 text-yellow-300'
                          : athlete.classification === 'SF' ? 'bg-blue-900/40 text-blue-300'
                          : 'bg-slate-700/60 text-slate-400'
                        }`}>
                          {athlete.classification === 'F' ? 'Finalist' : athlete.classification === 'SF' ? 'Semi' : 'Qualifier'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-slate-800/90 rounded-lg p-2.5 border border-slate-700/50 text-center">
                          <p className="text-xs text-slate-400 mb-0.5">Personal Best</p>
                          <p className="text-lg font-bold text-white">{athlete.pb}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                        </div>
                        <div className="bg-slate-800/90 rounded-lg p-2.5 border border-slate-700/50 text-center">
                          <p className="text-xs text-slate-400 mb-0.5">Peak Age</p>
                          <p className="text-lg font-bold text-white">{athlete.peakAge}</p>
                        </div>
                      </div>
                      <div className={`rounded-lg p-2.5 text-center text-xs font-medium ${
                        Math.abs(athlete.timeDiff) < 0.3 ? 'bg-green-900/30 text-green-700 border border-green-900/50'
                        : 'bg-amber-900/30 text-amber-700 border border-amber-900/50'
                      }`}>
                        At age {athlete.closestAge}: <span className="font-bold">{formatTime(athlete.timeAtSimilarAge, analysisResults.discipline)}</span>
                        {' '}({athlete.timeDiff < 0.05 ? 'virtually identical' : `${Math.abs(athlete.timeDiff).toFixed(2)}s ${isThrowsDiscipline(analysisResults.discipline) ? (athlete.timeAtSimilarAge > analysisResults.personalBest ? 'further' : 'shorter') : (athlete.timeAtSimilarAge < analysisResults.personalBest ? 'faster' : 'slower')}`})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </>)}

            {/* ══════════ INSIGHTS TAB ══════════ */}
            {dashTab === 'insights' && (<>

            {/* ── PEAK PROJECTION (in Insights tab) ── */}
            <div className="bento-card rounded-xl p-4 sm:p-8 mb-6 sm:mb-8" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
              <div className="mb-6">
                <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Forecast
                </p>
                <h3 className="landing-font text-xl sm:text-2xl font-semibold text-white tracking-tight">
                  Peak performance projection
                </h3>
              </div>
              {(() => {
                const isThrows = isThrowsDiscipline(analysisResults.discipline);
                const unit = isThrows ? 'm' : 's';
                const yrs = analysisResults.peakProjection.yearsToPeak;
                const conf = analysisResults.peakProjection.confidence;
                const confLabel = conf >= 0.7 ? 'high' : conf >= 0.5 ? 'moderate' : 'low';
                const whenStr = yrs > 0 ? `${yrs} year${yrs !== 1 ? 's' : ''} from now` : 'right now';
                return (
                  <div className="p-5 sm:p-6 rounded-xl" style={{background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.15)'}}>
                    <p className="landing-font text-base sm:text-lg text-slate-200 leading-relaxed">
                      You're projected to peak at{' '}
                      <span className="mono-font text-2xl sm:text-3xl font-bold text-orange-400">{analysisResults.peakProjection.time}{unit}</span>
                      {' '}at age{' '}
                      <span className="mono-font text-2xl sm:text-3xl font-bold text-white">{analysisResults.peakProjection.age}</span>
                      {' '}— {whenStr}, with {confLabel} confidence.
                    </p>
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs mono-font uppercase tracking-wider text-slate-500 hover:text-slate-300">Show confidence details</summary>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg" style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)'}}>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mono-font mb-1">50% CI</p>
                          <p className="mono-font text-white">{analysisResults.peakProjection.ciLower}{unit} – {analysisResults.peakProjection.ciUpper}{unit}</p>
                        </div>
                        <div className="p-3 rounded-lg" style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)'}}>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mono-font mb-1">Confidence</p>
                          <p className="mono-font text-white">{Math.round(conf * 100)}%</p>
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })()}
            </div>

            {/* Year-by-Year Projected Times — removed (false-precision wall of numbers, headline lives in Peak Projection above) */}
            {/* Improvement Scenarios — removed (dense table that didn't earn its space) */}

            {/* ── METHODOLOGY (in Insights tab) ── */}
            <div className="rounded-xl p-6 mb-8" style={{background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)'}}>
              <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-2 landing-font">
                <AlertTriangle className="w-4 h-4" style={{color: '#f59e0b'}} />
                Methodology
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Analysis powered by statistical models built from {'>'}{STATS.athletes} Olympic athletes and {'>'}{STATS.records} career race results
                spanning Sydney 2000 through Paris 2024. Finalist identification uses ROC/AUC analysis with Youden's J-optimized
                thresholds. Trajectory classification uses K-means clustering (K=3) on age-normalized % off PB series.
                Peak projections model improvement rate decay toward estimated peak age with post-peak decline calibrated from
                population age-performance curves. Confidence intervals are calibrated using the standard deviation of improvement
                rates observed in finalists. Competition probability estimates use logistic regression on z-scored PB and percentile rank features.
              </p>
            </div>

            </>)}

            <div className="text-center mb-12">
              <button onClick={handleBack}
                className="px-8 py-3 text-white font-semibold rounded-xl transition-all hover:translate-y-[-1px] landing-font" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)'}}>
                &larr; Analyze Another Athlete
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
