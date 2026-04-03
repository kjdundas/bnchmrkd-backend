import React, { useState, useEffect, useRef } from 'react';
import {
  ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine
} from 'recharts';
import {
  Activity, Timer, TrendingUp, Target, Award, ChevronRight, Plus, Trash2,
  Link, Upload, BarChart3, Zap, Calendar, ArrowUpRight, AlertTriangle, Users,
  Percent, Layers, BarChart2, CheckCircle2, Circle, Flag, Database, Info, ArrowRight, ChevronLeft,
  Search, User, Globe, Medal
} from 'lucide-react';

export default function BnchMrkdApp() {
  // Throws discipline detection helpers
  const THROWS_DISCIPLINES = ['Discus Throw', 'Javelin Throw', 'Hammer Throw', 'Shot Put'];
  const THROWS_CODES = ['MDT', 'FDT', 'MJT', 'FJT', 'MHT', 'FHT', 'MSP', 'FSP'];
  const isThrowsDiscipline = (disc) => THROWS_DISCIPLINES.includes(disc) || THROWS_CODES.includes(disc);
  const getUnitLabel = (disc) => isThrowsDiscipline(disc) ? 'Distance (m)' : 'Time (s)';

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

  const [currentView, setCurrentView] = useState('landing');
  const [activeTab, setActiveTab] = useState('manual');
  const [disciplineCategory, setDisciplineCategory] = useState('sprints'); // 'sprints' | 'throws'
  const isThrowsMode = disciplineCategory === 'throws';
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
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // PERFORMANCE STANDARDS (from S&H Performance Benchmarks)
  // ═══════════════════════════════════════════════════════════════════
  const PERFORMANCE_STANDARDS = {
    M100: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 9.87, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 10.07, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 10.26, source: 'Avg medal from 18/21/24 U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 10.42, source: 'Avg finalist from 23/25 Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 10.56, source: 'Entry standard 18/21/24', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 11.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    F100: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 10.84, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 11.18, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 11.30, source: 'Avg medal from 18/21/24 U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 11.74, source: 'Avg finalist from 23/25 Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 11.83, source: 'Entry standard 18/21/24', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 12.40, source: 'Development benchmark', color: '#94a3b8' },
    ],
    M200: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 19.85, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 20.30, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 20.59, source: 'Avg medal from 18/21/24 U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 21.10, source: 'Avg finalist from 23/25 Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 21.36, source: 'Entry standard 18/21/24', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 22.20, source: 'Development benchmark', color: '#94a3b8' },
    ],
    F200: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 22.07, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 22.86, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 23.03, source: 'Avg medal from 18/21/24 U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 23.82, source: 'Avg finalist from 23/25 Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 24.32, source: 'Entry standard 18/21/24', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 25.90, source: 'Development benchmark', color: '#94a3b8' },
    ],
    M400: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 43.92, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 45.10, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 46.04, source: 'Avg medal from 18/21/24 U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 46.42, source: 'Avg finalist from 23/25 Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 47.56, source: 'Entry standard 18/21/24', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 50.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    F400: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 49.43, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 51.43, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 52.00, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E3', label: 'Asian Finalist', time: 54.58, source: 'Avg finalist from 23/25 Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 54.62, source: 'Entry standard 21/24', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 57.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    F100H: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 12.50, source: 'Estimated from Olympic data', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 12.92, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 13.10, source: 'Estimated from U20 WC data', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 13.40, source: 'Estimated from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 13.60, source: 'Estimated entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 14.50, source: 'Development benchmark', color: '#94a3b8' },
    ],
    M110H: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 13.10, source: 'Estimated from Olympic data', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 13.47, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 13.60, source: 'Estimated from U20 WC data', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 13.85, source: 'Estimated from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 14.00, source: 'Estimated entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 14.80, source: 'Development benchmark', color: '#94a3b8' },
    ],
    M400H: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 47.30, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 49.00, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 49.67, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 50.74, source: 'Avg finalist from 23/25 Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 53.10, source: 'Entry standard 18/24', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 56.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    F400H: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 52.63, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 55.48, source: '2024 minimum qualifying time', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 57.03, source: 'Avg medal from 21/22/24 U20 WC', color: '#8b5cf6' },
      { tier: 'E3', label: 'Asian Finalist', time: 57.66, source: 'Avg finalist from 25 Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 60.80, source: 'Entry standard 18/24', color: '#6366f1' },
      { tier: 'T1', label: 'Level 9 (U20)', time: 65.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    MDT: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 68.50, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 66.00, source: '2024 minimum qualifying distance', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 61.00, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 59.00, source: 'Avg finalist from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 57.00, source: 'Entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Development Standard', time: 52.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    FDT: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 66.00, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 63.50, source: '2024 minimum qualifying distance', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 58.00, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 56.00, source: 'Avg finalist from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 53.00, source: 'Entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Development Standard', time: 48.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    MJT: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 89.00, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 85.50, source: '2024 minimum qualifying distance', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 80.00, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 77.00, source: 'Avg finalist from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 74.00, source: 'Entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Development Standard', time: 68.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    FJT: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 66.00, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 63.50, source: '2024 minimum qualifying distance', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 58.00, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 56.00, source: 'Avg finalist from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 53.00, source: 'Entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Development Standard', time: 48.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    MHT: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 80.00, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 77.00, source: '2024 minimum qualifying distance', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 71.00, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 68.00, source: 'Avg finalist from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 65.00, source: 'Entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Development Standard', time: 58.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    FHT: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 76.00, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 72.50, source: '2024 minimum qualifying distance', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 66.00, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 63.00, source: 'Avg finalist from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 60.00, source: 'Entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Development Standard', time: 54.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
    MSP: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 22.00, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 21.10, source: '2024 minimum qualifying distance', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 19.50, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 18.80, source: 'Avg finalist from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 18.00, source: 'Entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Development Standard', time: 16.50, source: 'Development benchmark', color: '#94a3b8' },
    ],
    FSP: [
      { tier: 'E1', label: 'Olympic Medal Zone', time: 20.00, source: 'Avg medal from Rio/Tokyo/Paris', color: '#fbbf24' },
      { tier: 'E1', label: 'Olympic MQT', time: 18.80, source: '2024 minimum qualifying distance', color: '#dc2626' },
      { tier: 'E1', label: 'U20 WC Medal Zone', time: 17.00, source: 'Avg medal from U20 WC', color: '#8b5cf6' },
      { tier: 'E2', label: 'Asian Finalist', time: 16.50, source: 'Avg finalist from Asian Champs', color: '#3b82f6' },
      { tier: 'E3', label: 'U20 Worlds Qualifying', time: 15.50, source: 'Entry standard', color: '#6366f1' },
      { tier: 'T1', label: 'Development Standard', time: 14.00, source: 'Development benchmark', color: '#94a3b8' },
    ],
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

    // ── Build performance standards with met/not-met ──
    const standards = (PERFORMANCE_STANDARDS[eventCode] || []).map(std => ({
      ...std,
      met: isThrows ? pb >= std.time : pb <= std.time,
      gap: isThrows ? parseFloat((std.time - pb).toFixed(2)) : parseFloat((pb - std.time).toFixed(2)),
    }));

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

    return {
      name,
      discipline,
      gender,
      age,
      personalBest: pb,
      eventCode,
      isThrows,
      careerPBAge: annualSeries.length > 0 ? annualSeries.reduce((best, r) => isThrows ? (r.time > best.time ? r : best) : (r.time < best.time ? r : best), annualSeries[0]).age : age,
      trajectoryType,
      finalistProbability,
      semiFinalistProbability,
      qualifierProbability,
      percentileAtCurrentAge,
      improvementRate: parseFloat(improvementRate.toFixed(2)),
      finalistNorm: benchmarkData.improvement.finalist_median,
      nonFinalistNorm: benchmarkData.improvement.non_finalist_median,
      careerPhase,
      readinessScore,
      peakProjection: {
        time: parseFloat(projectedPeakTime.toFixed(2)),
        age: projectedPeakAge,
        confidence: Math.max(0.3, 0.85 - (yearsToPeak * 0.05)),
        ciLower: projections.length > 0
          ? parseFloat((projectedPeakTime - 0.674 * benchmarkData.improvement.finalist_std * Math.sqrt(yearsToPeak || 1) * 0.01 * projectedPeakTime).toFixed(2))
          : parseFloat((pb * 0.99).toFixed(2)),
        ciUpper: projections.length > 0
          ? parseFloat((projectedPeakTime + 0.674 * benchmarkData.improvement.finalist_std * Math.sqrt(yearsToPeak || 1) * 0.01 * projectedPeakTime).toFixed(2))
          : parseFloat((pb * 1.01).toFixed(2)),
        yearsToPeak
      },
      raceHistory: annualSeries,
      projections,
      chartData,
      pctOffPBChartData,
      percentileBandData,
      improvementChartData,
      thresholds: {
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
          finalist: parseFloat((thresholds.optimal * (isThrowsDiscipline(analysisResults.discipline) ? (1 - benchmarkData.percentiles[a].p50 / 100) : (1 + benchmarkData.percentiles[a].p50 / 100))).toFixed(2)),
          semiFinalist: parseFloat((thresholds.s80 * (isThrowsDiscipline(analysisResults.discipline) ? (1 - benchmarkData.percentiles[a].p50 / 100) : (1 + benchmarkData.percentiles[a].p50 / 100))).toFixed(2)),
          qualifier: parseFloat((thresholds.s90 * (isThrowsDiscipline(analysisResults.discipline) ? (1 - benchmarkData.percentiles[a].p50 / 100) : (1 + benchmarkData.percentiles[a].p50 / 100))).toFixed(2)),
        };
      }),
      // ROD per season (Rate of Development)
      rodData: (() => {
        const rodArr = [];
        for (let i = 0; i < annualSeries.length; i++) {
          const curr = annualSeries[i];
          const rod = i > 0 ? parseFloat(((isThrowsDiscipline(analysisResults.discipline) ? ((curr.time - annualSeries[i-1].time) / annualSeries[i-1].time) : ((annualSeries[i-1].time - curr.time) / annualSeries[i-1].time)) * 100).toFixed(2)) : 0;
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

    try {
      if (activeTab === 'manual') {
        const validRaces = athleteData.races.filter(r => r.date && r.time);
        if (validRaces.length === 0) throw new Error('Please enter at least one race with a date and time.');
        if (!athleteData.dateOfBirth) throw new Error('Please enter a date of birth.');

        const dob = new Date(athleteData.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;

        const racesByAge = {};
        validRaces.forEach(race => {
          const raceDate = new Date(race.date);
          let raceAge = raceDate.getFullYear() - dob.getFullYear();
          const racemonthDiff = raceDate.getMonth() - dob.getMonth();
          if (racemonthDiff < 0 || (racemonthDiff === 0 && raceDate.getDate() < dob.getDate())) raceAge--;

          const time = parseFloat(race.time);
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

        setAnalysisResults(results);
        setCurrentView('results');

      } else if (activeTab === 'url') {
        throw new Error('URL import requires backend connection. Please use Manual Entry or Quick Analysis.');

      } else if (activeTab === 'quick') {
        if (!quickAnalysisData.age || !quickAnalysisData.personalBest) {
          throw new Error('Please enter both age and personal best time.');
        }

        const age = parseInt(quickAnalysisData.age);
        const pb = parseFloat(quickAnalysisData.personalBest);

        const isThrowsQuick = isThrowsDiscipline(quickAnalysisData.discipline);
        const results = await runAnalysis({
          name: 'Quick Analysis',
          discipline: quickAnalysisData.discipline,
          gender: quickAnalysisData.gender,
          age, pb,
          raceHistory: [{ age, time: pb, nRaces: 1 }],
          implementWeight: isThrowsQuick ? (quickAnalysisData.implementWeight || getDefaultWeight(quickAnalysisData.discipline, quickAnalysisData.gender, age)) : null
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
                ? '"Our analysis covers 311,000+ career races from 2,322 Olympic athletes across 7 Games."'
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
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-600 rounded-lg shadow-xl shadow-black/30 p-3 text-sm">
        <p className="font-bold text-white mb-1">Age {label}</p>
        {data.actualTime && (
          <p className="text-orange-400">Actual: {data.actualTime.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
        )}
        {data.projectedTime && !data.actualTime && (
          <>
            <p className="text-blue-400">Projected: {data.projectedTime.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
            <p className="text-slate-400 text-xs">50% CI: {data.ci50Lower?.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'} – {data.ci50Upper?.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
            <p className="text-slate-400 text-xs">90% CI: {data.ci90Lower?.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'} – {data.ci90Upper?.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
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
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentView('about')} className="text-sm text-slate-500 hover:text-slate-300 transition-colors landing-font font-medium">
                  Methodology
                </button>
                <button
                  onClick={() => setCurrentView('categories')}
                  className="text-sm font-semibold text-white px-4 py-2 rounded-lg landing-font"
                  style={{background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.25)'}}
                >
                  Get Started
                </button>
              </div>
            </div>
          </nav>

          {/* ── HERO SECTION ── */}
          <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 pt-8 sm:pt-16 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* LEFT — Copy */}
              <div>
                <div className="stagger-2 mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mono-font tracking-wide" style={{background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#fb923c'}}>
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" style={{animation: 'pulseGlow 2s ease-in-out infinite'}}></span>
                    SYDNEY 2000 — PARIS 2024
                  </span>
                </div>

                <h1 className="stagger-3 text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight landing-font mb-6">
                  Where does your<br />
                  athlete sit against<br />
                  <span style={{background: 'linear-gradient(135deg, #f97316, #fb923c, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                    Olympic careers?
                  </span>
                </h1>

                <p className="stagger-4 text-lg text-slate-400 leading-relaxed max-w-md mb-8 landing-font">
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
                <div className="stagger-6 flex items-center gap-8">
                  {[
                    { value: '496K+', label: 'Records' },
                    { value: '3,442', label: 'Athletes' },
                    { value: '18', label: 'Events' },
                  ].map((stat, i) => (
                    <div key={i} className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-white tabular-nums mono-font">{stat.value}</span>
                      <span className="text-xs text-slate-600 uppercase tracking-widest landing-font font-medium">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — Animated trajectory visualization + bento preview */}
              <div className="stagger-4 relative">
                {/* Main trajectory card */}
                <div className="bento-card rounded-2xl p-6 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                  {/* Card header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mono-font tracking-wide uppercase">Career Trajectory</p>
                      <p className="text-sm font-semibold text-white landing-font mt-0.5">Men's 100m — Olympic Finalist</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{background: 'rgba(34,197,94,0.12)'}}>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span className="text-xs font-medium text-green-400 mono-font">92nd pctl</span>
                    </div>
                  </div>

                  {/* Animated SVG trajectory chart */}
                  <svg viewBox="0 0 440 200" className="w-full" style={{filter: 'drop-shadow(0 0 20px rgba(249,115,22,0.15))'}}>
                    {/* Grid lines */}
                    {[40, 80, 120, 160].map(y => (
                      <line key={y} x1="40" y1={y} x2="420" y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />
                    ))}
                    {/* Age labels */}
                    {['18', '20', '22', '24', '26', '28', '30'].map((age, i) => (
                      <text key={age} x={60 + i * 52} y="195" fill="#475569" fontSize="10" textAnchor="middle" style={{fontFamily: "'DM Mono', monospace"}}>{age}</text>
                    ))}
                    {/* Benchmark corridor (P25-P75) */}
                    <path d="M60,145 L112,138 L164,128 L216,118 L268,112 L320,115 L372,125" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Finalist threshold */}
                    <line x1="40" y1="95" x2="420" y2="95" stroke="rgba(239,68,68,0.25)" strokeWidth="1" strokeDasharray="6 4" />
                    <text x="425" y="98" fill="rgba(239,68,68,0.5)" fontSize="8" style={{fontFamily: "'DM Mono', monospace"}}>MQT</text>
                    {/* Athlete trajectory — animated */}
                    <path
                      d="M60,155 C90,148 112,135 164,115 S240,78 268,70 S330,68 372,75"
                      fill="none" stroke="url(#trajectoryGrad)" strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray="800" style={{animation: 'drawTrajectory 2.5s ease-out 0.8s both'}}
                    />
                    {/* Projection extension — dashed */}
                    <path
                      d="M372,75 C390,78 408,82 420,86"
                      fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" opacity="0.5"
                      style={{animation: 'fadeSlideUp 0.5s ease-out 3s both'}}
                    />
                    {/* Data points */}
                    {[[60,155],[112,135],[164,115],[216,90],[268,70],[320,68],[372,75]].map(([cx,cy], i) => (
                      <g key={i} style={{animation: `fadeSlideUp 0.3s ease-out ${1.2 + i * 0.2}s both`}}>
                        <circle cx={cx} cy={cy} r="3" fill="#f97316" />
                        <circle cx={cx} cy={cy} r="6" fill="none" stroke="rgba(249,115,22,0.3)" strokeWidth="1" />
                      </g>
                    ))}
                    {/* Peak marker */}
                    <g style={{animation: 'fadeSlideUp 0.4s ease-out 2.6s both'}}>
                      <circle cx="320" cy="68" r="4" fill="#f97316">
                        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="320" cy="68" r="10" fill="none" stroke="rgba(249,115,22,0.2)" strokeWidth="1">
                        <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <text x="320" y="58" fill="#f97316" fontSize="9" textAnchor="middle" fontWeight="600" style={{fontFamily: "'DM Mono', monospace"}}>PEAK 10.02s</text>
                    </g>
                    {/* Gradient definition */}
                    <defs>
                      <linearGradient id="trajectoryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ea580c" />
                        <stop offset="50%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#fb923c" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Mini stats row below chart */}
                  <div className="flex items-center justify-between mt-4 pt-4" style={{borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                    {[
                      { label: 'PB', value: '10.02s', color: '#f97316' },
                      { label: 'Peak Age', value: '26', color: '#3b82f6' },
                      { label: 'Trajectory', value: 'Late Developer', color: '#22c55e' },
                    ].map((item, i) => (
                      <div key={i} className="text-center">
                        <p className="text-[10px] text-slate-600 mono-font uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-bold mono-font mt-0.5" style={{color: item.color}}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating mini bento cards */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {/* Percentile gauge card */}
                  <div className="bento-card rounded-xl p-4 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <p className="text-[10px] text-slate-600 mono-font uppercase tracking-wider mb-2">Percentile</p>
                    <div className="flex items-end gap-1">
                      {[35, 52, 68, 78, 92, 88, 85].map((h, i) => (
                        <div key={i} className="flex-1 rounded-sm" style={{
                          height: `${h * 0.4}px`,
                          background: i === 4 ? 'linear-gradient(to top, #ea580c, #f97316)' : 'rgba(148,163,184,0.1)',
                          animation: `fadeSlideUp 0.3s ease-out ${1.5 + i * 0.1}s both`
                        }}></div>
                      ))}
                    </div>
                    <p className="text-right text-lg font-bold text-white mono-font mt-2">P92</p>
                  </div>

                  {/* Discipline coverage card */}
                  <div className="bento-card rounded-xl p-4 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <p className="text-[10px] text-slate-600 mono-font uppercase tracking-wider mb-2">Disciplines</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['100m', '200m', '400m', '110mH', 'SP', 'DT', 'HT', 'JT'].map((d, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium mono-font" style={{
                          background: i >= 4 ? 'rgba(59,130,246,0.12)' : 'rgba(249,115,22,0.12)',
                          color: i >= 4 ? '#60a5fa' : '#fb923c',
                          animation: `fadeSlideUp 0.3s ease-out ${1.8 + i * 0.08}s both`
                        }}>{d}</span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 landing-font">Sprints, hurdles & throws</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── FEATURE STRIP — What you get ── */}
          <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-16">
            <div className="stagger-6" style={{borderTop: '1px solid rgba(255,255,255,0.04)'}}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-12">
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
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ABOUT OUR DATA PAGE                                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'about' && (
        <div className="min-h-screen">
          {/* Header */}
          <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50 shadow-lg shadow-black/20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2 text-slate-300 hover:text-orange-400 transition-colors">
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">Back</span>
              </button>
              <div className="flex items-center gap-2">
                <img src="/icon.svg" alt="bnchmrkd icon" className="w-7 h-7" />
                <span className="text-lg font-bold text-white" style={{fontFamily: "'Inter', 'Helvetica Neue', sans-serif"}}>bnchmrkd<span className="text-orange-500">.</span></span>
              </div>
              <div className="w-20"></div>
            </div>
          </header>

          <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Page title */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-3">About Our Data</h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Every insight in bnchmrkd is grounded in real Olympic data. Here's what powers the analysis.
              </p>
            </div>

            {/* Key stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {[
                { value: '3,442', label: 'Olympic Athletes', sub: 'Sydney 2000 – Paris 2024' },
                { value: '496K+', label: 'Career Races', sub: 'Analysed and classified' },
                { value: '18', label: 'Disciplines', sub: 'Sprints, hurdles & throws' },
                { value: '7', label: 'Olympic Games', sub: 'Two decades of data' },
              ].map((stat, i) => (
                <div key={i} className="bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 p-5 text-center">
                  <p className="text-3xl font-bold text-orange-400">{stat.value}</p>
                  <p className="text-sm font-semibold text-white mt-1">{stat.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Discipline coverage table */}
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 p-8 mb-10">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                Discipline Coverage
              </h3>
              <p className="text-sm text-slate-400 mb-6">Finalist thresholds derived from ROC/AUC analysis with Youden's J optimisation on each population.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-600">
                      <th className="text-left py-3 px-3 font-semibold text-slate-300">Discipline</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-300">Gender</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-300">Finalist Threshold</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-300">Population Mean</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-300">Age Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { disc: '100m', gender: 'Male', code: 'M100', threshold: '10.15s', mean: '10.45s' },
                      { disc: '100m', gender: 'Female', code: 'F100', threshold: '11.50s', mean: '11.65s' },
                      { disc: '200m', gender: 'Male', code: 'M200', threshold: '20.62s', mean: '21.05s' },
                      { disc: '200m', gender: 'Female', code: 'F200', threshold: '23.55s', mean: '23.75s' },
                      { disc: '400m', gender: 'Male', code: 'M400', threshold: '44.64s', mean: '45.18s' },
                      { disc: '400m', gender: 'Female', code: 'F400', threshold: '52.65s', mean: '53.60s' },
                      { disc: '100m Hurdles', gender: 'Female', code: 'F100H', threshold: '13.28s', mean: '13.55s' },
                      { disc: '110m Hurdles', gender: 'Male', code: 'M110H', threshold: '13.80s', mean: '13.85s' },
                      { disc: '400m Hurdles', gender: 'Male', code: 'M400H', threshold: '48.17s', mean: '48.67s' },
                      { disc: '400m Hurdles', gender: 'Female', code: 'F400H', threshold: '57.70s', mean: '58.20s' },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700 transition-colors">
                        <td className="py-3 px-3 font-medium text-white">{row.disc}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${row.gender === 'Male' ? 'bg-blue-900/40 text-blue-300' : 'bg-pink-900/40 text-pink-300'}`}>
                            {row.gender}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-orange-400">{row.threshold}</td>
                        <td className="py-3 px-3 text-center text-slate-300">{row.mean}</td>
                        <td className="py-3 px-3 text-center text-slate-400">17 – 35</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Methodology cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              {[
                {
                  icon: TrendingUp,
                  title: 'Trajectory Classification',
                  text: 'K-means clustering (K=3) on age-normalised % off PB series identifies three career patterns: Early Peaker, Late Developer, and Plateau Pattern. Your trajectory type shapes your projected development curve.'
                },
                {
                  icon: Target,
                  title: 'Finalist Identification',
                  text: 'ROC/AUC analysis with Youden\'s J-optimised thresholds classifies athletes as Olympic finalists, semi-finalists, or qualifiers. Thresholds are computed independently for each discipline and gender.'
                },
                {
                  icon: BarChart3,
                  title: 'Age–Performance Curves',
                  text: 'Percentile corridors (P10 through P90) at each age from 15 to 38, computed from season-best performances expressed as % off personal best. Shows where you sit relative to the Olympic population.'
                },
                {
                  icon: Zap,
                  title: 'Peak Projection',
                  text: 'Improvement rate decay modelling estimates projected peak time and age. Confidence intervals are calibrated from the standard deviation of improvement rates observed in finalists.'
                },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-orange-400" />
                      </div>
                      <h4 className="font-bold text-white">{card.title}</h4>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{card.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Important disclaimer */}
            <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-6 mb-10">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-300 mb-2">A tool, not a verdict</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    bnchmrkd is designed as a <span className="font-semibold text-white">decision-support tool</span> to be used alongside coaches, sport scientists, and a multi-disciplinary team (MDT). Statistical models provide context, not certainty — every athlete's journey is unique. Projections should inform discussion, not replace expert judgement. Benchmarks reflect historical Olympic data and may not account for evolving competition standards, rule changes, or individual circumstances.
                  </p>
                </div>
              </div>
            </div>

            {/* Data source */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6 mb-10">
              <h4 className="font-semibold text-slate-300 mb-2">Data Source</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                All athlete data is sourced from World Athletics competition records for Olympic Games from Sydney 2000 through Paris 2024. Career race histories, personal bests, and competition classifications are extracted from publicly available results databases. No personal or private athlete information is used.
              </p>
            </div>

            {/* CTA to go benchmark */}
            <div className="text-center">
              <button
                onClick={() => setCurrentView('categories')}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-orange-500/25 hover:scale-[1.02] transition-all shadow-lg shadow-orange-500/20 text-lg"
              >
                Benchmark a Performance
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DISCIPLINE CATEGORY SELECTION                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {currentView === 'categories' && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50 shadow-lg shadow-black/20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2 text-slate-300 hover:text-orange-400 transition-colors">
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">Home</span>
              </button>
              <div className="flex items-center gap-2">
                <img src="/icon.svg" alt="bnchmrkd icon" className="w-7 h-7" />
                <span className="text-lg font-bold text-white" style={{fontFamily: "'Inter', 'Helvetica Neue', sans-serif"}}>bnchmrkd<span className="text-orange-500">.</span></span>
              </div>
              <div className="w-20"></div>
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center">Choose your discipline</h2>
            <p className="text-slate-400 mb-10 text-center">Select an event group to benchmark against Olympic-level data.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">

              {/* ── SPRINTS & HURDLES (ACTIVE) ── */}
              <button
                onClick={() => { setDisciplineCategory('sprints'); setAthleteData(d => ({...d, discipline: '100m'})); setQuickAnalysisData(d => ({...d, discipline: '100m'})); setCurrentView('input'); }}
                className="group relative bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 text-left hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 hover:scale-[1.02] transition-all cursor-pointer"
              >
                {/* Animated sprint lines */}
                <div className="w-14 h-14 rounded-xl bg-orange-500/15 flex items-center justify-center mb-4 relative overflow-hidden">
                  <svg viewBox="0 0 48 48" className="w-8 h-8">
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
                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">Sprints & Hurdles</h3>
                <p className="text-sm text-slate-400 mb-3">100m, 200m, 400m, 100mH, 110mH, 400mH</p>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400">Live</span>
                  <span className="text-xs text-slate-400">10 event/gender combinations</span>
                </div>
                <ArrowRight className="absolute top-6 right-6 w-5 h-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
              </button>

              {/* ── THROWS (ACTIVE) ── */}
              <button
                onClick={() => { setDisciplineCategory('throws'); setAthleteData(d => ({...d, discipline: 'Discus Throw'})); setQuickAnalysisData(d => ({...d, discipline: 'Discus Throw'})); setCurrentView('input'); }}
                className="group relative bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 text-left hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 hover:scale-[1.02] transition-all cursor-pointer"
              >
                {/* Animated throw arc */}
                <div className="w-14 h-14 rounded-xl bg-orange-500/15 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 48 48" className="w-8 h-8">
                    <path d="M10 36 Q 24 8, 40 28" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3">
                      <animate attributeName="stroke-dashoffset" values="0;-14" dur="2s" repeatCount="indefinite" />
                    </path>
                    <circle cx="40" cy="28" r="4" fill="#f97316" opacity="0.5">
                      <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">Throws</h3>
                <p className="text-sm text-slate-400 mb-3">Shot Put, Discus, Hammer, Javelin</p>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400">Live</span>
                  <span className="text-xs text-slate-400">8 event/gender combinations</span>
                </div>
                <ArrowRight className="absolute top-6 right-6 w-5 h-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
              </button>

              {/* ── JUMPS (COMING SOON) ── */}
              <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-6 text-left opacity-60 cursor-not-allowed">
                {/* Animated jump arc */}
                <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 48 48" className="w-8 h-8">
                    <path d="M8 38 Q 24 6, 40 38" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
                      <animate attributeName="d" values="M8 38 Q 24 6, 40 38;M8 38 Q 24 10, 40 38;M8 38 Q 24 6, 40 38" dur="2s" repeatCount="indefinite" />
                    </path>
                    <circle cx="24" cy="12" r="3" fill="#10b981" opacity="0.6">
                      <animate attributeName="cy" values="14;10;14" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-300 mb-1">Jumps</h3>
                <p className="text-sm text-slate-500 mb-3">High Jump, Long Jump, Triple Jump, Pole Vault</p>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400">Coming Soon</span>
              </div>

              {/* ── MIDDLE DISTANCE (COMPILING DATA) ── */}
              <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-6 text-left opacity-50 cursor-not-allowed">
                {/* Animated pulsing track oval */}
                <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 48 48" className="w-8 h-8">
                    <ellipse cx="24" cy="24" rx="16" ry="10" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="6 4">
                      <animate attributeName="stroke-dashoffset" values="0;-20" dur="3s" repeatCount="indefinite" />
                    </ellipse>
                    <circle cx="8" cy="24" r="2.5" fill="#a855f7" opacity="0.7">
                      <animateMotion dur="3s" repeatCount="indefinite" path="M16,0 A16,10 0 1,1 -0.1,0 A16,10 0 1,1 0.1,0" />
                    </circle>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-300 mb-1">Middle Distance</h3>
                <p className="text-sm text-slate-500 mb-3">800m, 1500m</p>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 flex items-center gap-1.5 w-fit">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 12" /></svg>
                  Compiling Data
                </span>
              </div>

              {/* ── LONG DISTANCE (COMPILING DATA) ── */}
              <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-6 text-left opacity-50 cursor-not-allowed">
                {/* Animated winding road */}
                <div className="w-14 h-14 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 48 48" className="w-8 h-8">
                    <path d="M6 40 Q 16 20, 24 28 Q 32 36, 42 10" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4">
                      <animate attributeName="stroke-dashoffset" values="0;-18" dur="2.5s" repeatCount="indefinite" />
                    </path>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-300 mb-1">Long Distance</h3>
                <p className="text-sm text-slate-500 mb-3">3000m, 5000m, 10,000m, Steeplechase</p>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 flex items-center gap-1.5 w-fit">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 12" /></svg>
                  Compiling Data
                </span>
              </div>

              {/* ── COMBINED EVENTS (COMPILING DATA) ── */}
              <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-6 text-left opacity-50 cursor-not-allowed">
                {/* Animated multi-dot pattern */}
                <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 48 48" className="w-8 h-8">
                    {[{cx:12,cy:14},{cx:24,cy:10},{cx:36,cy:14},{cx:12,cy:26},{cx:24,cy:30},{cx:36,cy:26},{cx:18,cy:38},{cx:30,cy:38}].map((dot, i) => (
                      <circle key={i} cx={dot.cx} cy={dot.cy} r="3" fill="#f59e0b" opacity="0.4">
                        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
                      </circle>
                    ))}
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-300 mb-1">Combined Events</h3>
                <p className="text-sm text-slate-500 mb-3">Decathlon, Heptathlon</p>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 flex items-center gap-1.5 w-fit">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 12" /></svg>
                  Compiling Data
                </span>
              </div>

              {/* ── RACE WALKS & ROAD (COMPILING DATA) ── */}
              <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-6 text-left opacity-50 cursor-not-allowed sm:col-span-2 lg:col-span-3">
                <div className="flex items-center gap-6">
                  {/* Animated walking steps */}
                  <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 48 48" className="w-8 h-8">
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
                    <h3 className="text-lg font-bold text-slate-300 mb-1">Race Walks & Road Events</h3>
                    <p className="text-sm text-slate-500 mb-2">20km Walk, 35km Walk, Marathon, Half Marathon</p>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-400 inline-flex items-center gap-1.5">
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
        <div className="min-h-screen">
          {/* Ambient glow */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/8 rounded-full blur-3xl"></div>
          </div>

          <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-8">
              <button onClick={() => { setCurrentView('landing'); setSelectedAthlete(null); setAthleteProfile(null); setAthleteTrajectory(null); setExplorerSearch(''); setExplorerResults([]); }} className="flex items-center gap-2 text-slate-300 hover:text-orange-400 transition-colors">
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Athlete Explorer<span className="text-orange-500">.</span>
              </h1>
              <div className="w-10 sm:w-20"></div>
            </div>

            {/* Search + Filter Bar */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-3 sm:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={explorerSearch}
                    onChange={(e) => setExplorerSearch(e.target.value)}
                    placeholder="Search 2,322 Olympic athletes..."
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25 text-base sm:text-lg"
                    autoFocus
                  />
                </div>
                <select
                  value={explorerDisciplineFilter}
                  onChange={(e) => setExplorerDisciplineFilter(e.target.value)}
                  className="px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-orange-500/50"
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
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          selectedAthlete?.id === a.id
                            ? 'bg-orange-500/15 border-orange-500/50 shadow-lg shadow-orange-500/10'
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/40 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-semibold text-white text-sm">{a.name}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
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
                    <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-white">{athleteProfile.name}</h2>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm sm:text-base text-slate-400">
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
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {athleteProfile.personal_bests.map((pb, i) => (
                            <div key={i} className="bg-slate-900/50 rounded-lg p-3 text-center">
                              <div className="text-xs text-slate-500 uppercase tracking-wider">{pb.discipline}</div>
                              <div className="text-xl font-bold text-orange-400 mt-1">{typeof pb.time === 'number' ? pb.time.toFixed(2) : pb.time}{isThrowsDiscipline(pb.discipline || athleteProfile.primary_discipline) ? 'm' : 's'}</div>
                              {pb.year && <div className="text-xs text-slate-500 mt-1">{pb.year}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Olympic Results */}
                      {athleteProfile.olympic_results && athleteProfile.olympic_results.length > 0 && (
                        <div className="mt-6">
                          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Medal className="w-4 h-4 text-orange-400" />
                            Olympic Results
                          </h3>
                          <div className="space-y-2">
                            {athleteProfile.olympic_results.map((r, i) => (
                              <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-900/40 rounded-lg px-3 sm:px-4 py-2 gap-1 sm:gap-0">
                                <div className="text-sm sm:text-base">
                                  <span className="text-white font-medium">{r.games || r.year}</span>
                                  <span className="text-slate-500 mx-1 sm:mx-2">·</span>
                                  <span className="text-slate-400">{r.discipline}</span>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  {r.time && <span className="text-orange-400 font-mono">{typeof r.time === 'number' ? r.time.toFixed(2) : r.time}{isThrowsDiscipline(r.discipline || athleteProfile.primary_discipline) ? 'm' : 's'}</span>}
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
                      <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-orange-400" />
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
                              label={{ value: getUnitLabel(athleteTrajectory.discipline), angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff' }}
                              formatter={(value, name) => [typeof value === 'number' ? value.toFixed(2) + (isThrowsDiscipline(athleteTrajectory.discipline) ? 'm' : 's') : value, name === 'bestTime' ? 'Season Best' : name]}
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
                              <tr className="text-slate-400 border-b border-slate-700">
                                <th className="text-left py-2 px-3">Age</th>
                                <th className="text-left py-2 px-3">Year</th>
                                <th className="text-right py-2 px-3">Season Best</th>
                                <th className="text-right py-2 px-3">% Off PB</th>
                                <th className="text-right py-2 px-3">Races</th>
                              </tr>
                            </thead>
                            <tbody>
                              {athleteTrajectory.seasons
                                .filter(s => s.best_time)
                                .sort((a, b) => (a.age || a.year) - (b.age || b.year))
                                .map((s, i) => (
                                <tr key={i} className="border-b border-slate-800 hover:bg-slate-700/30">
                                  <td className="py-2 px-3 text-white font-medium">{s.age || '–'}</td>
                                  <td className="py-2 px-3 text-slate-400">{s.year || '–'}</td>
                                  <td className="py-2 px-3 text-right text-orange-400 font-mono">{s.best_time.toFixed(2)}</td>
                                  <td className="py-2 px-3 text-right text-slate-400 font-mono">{s.pct_off_pb != null ? s.pct_off_pb.toFixed(1) + '%' : '–'}</td>
                                  <td className="py-2 px-3 text-right text-slate-500">{s.n_races || '–'}</td>
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
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all"
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
        <div className="min-h-screen">
          <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50 shadow-lg shadow-black/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2 text-slate-300 hover:text-orange-400 transition-colors">
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">Home</span>
              </button>
              <div className="flex items-center gap-3">
                <img src="/icon.svg" alt="bnchmrkd icon" className="w-7 h-7" />
                <h1 className="text-xl font-bold text-white" style={{fontFamily: "'Inter', 'Helvetica Neue', sans-serif"}}>bnchmrkd<span className="text-orange-500">.</span></h1>
              </div>
              <div className="w-20"></div>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex gap-2 mb-8 border-b border-slate-700">
              {[
                { key: 'manual', icon: Upload, label: 'Manual Entry' },
                { key: 'url', icon: Link, label: 'Import from URL' },
                { key: 'quick', icon: Zap, label: 'Quick Analysis' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </div>
                </button>
              ))}
            </div>

            {/* Manual Entry Tab */}
            {activeTab === 'manual' && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Discipline</label>
                    <select value={athleteData.discipline} onChange={(e) => handleManualEntry('discipline', e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500">
                      {isThrowsMode ? (
                        <>
                          <option value="Discus Throw">Discus Throw</option>
                          <option value="Javelin Throw">Javelin Throw</option>
                          <option value="Hammer Throw">Hammer Throw</option>
                          <option value="Shot Put">Shot Put</option>
                        </>
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
                    <label className="block text-sm font-semibold text-white mb-2">Gender</label>
                    <select value={athleteData.gender} onChange={(e) => handleManualEntry('gender', e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div className={`grid grid-cols-1 ${isThrowsMode ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-6 mb-8`}>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Athlete Name</label>
                    <input type="text" placeholder={isThrowsMode ? "e.g., Daniel Stahl" : "e.g., Shelly-Ann Fraser-Pryce"} value={athleteData.name}
                      onChange={(e) => handleManualEntry('name', e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Date of Birth</label>
                    <input type="date" value={athleteData.dateOfBirth}
                      onChange={(e) => handleManualEntry('dateOfBirth', e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500" />
                  </div>
                  {isThrowsMode && (
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">Implement Weight</label>
                      <select value={athleteData.implementWeight}
                        onChange={(e) => handleManualEntry('implementWeight', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500">
                        {getWeightOptions(athleteData.discipline, athleteData.gender).map(opt => (
                          <option key={opt.kg} value={opt.kg}>{opt.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Select the implement weight used in competitions.</p>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Timer className="w-5 h-5 text-orange-500" />
                  {isThrowsMode ? 'Competition History' : 'Race History'}
                </h3>

                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="text-left py-3 px-4 font-semibold text-white">Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-white">{isThrowsMode ? 'Distance (m)' : 'Time (s)'}</th>
                        {!isThrowsMode && <th className="text-left py-3 px-4 font-semibold text-white">Wind (m/s)</th>}
                        <th className="text-left py-3 px-4 font-semibold text-white">Competition</th>
                        <th className="text-center py-3 px-4 font-semibold text-white">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {athleteData.races.map((race, idx) => (
                        <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700">
                          <td className="py-3 px-4"><input type="date" value={race.date} onChange={(e) => handleManualEntry('date', e.target.value, idx)} className="w-full px-2 py-1 bg-slate-900 text-white border border-slate-600 rounded text-sm placeholder-slate-500" /></td>
                          <td className="py-3 px-4"><input type="number" step="0.01" placeholder={isThrowsMode ? "e.g., 67.48" : "e.g., 10.85"} value={race.time} onChange={(e) => handleManualEntry('time', e.target.value, idx)} className="w-full px-2 py-1 bg-slate-900 text-white border border-slate-600 rounded text-sm placeholder-slate-500" /></td>
                          {!isThrowsMode && <td className="py-3 px-4"><input type="number" step="0.1" placeholder="-0.5 to +2.0" value={race.wind} onChange={(e) => handleManualEntry('wind', e.target.value, idx)} className="w-full px-2 py-1 bg-slate-900 text-white border border-slate-600 rounded text-sm placeholder-slate-500" /></td>}
                          <td className="py-3 px-4"><input type="text" placeholder={isThrowsMode ? "e.g., World Championships" : "e.g., Olympics"} value={race.competition} onChange={(e) => handleManualEntry('competition', e.target.value, idx)} className="w-full px-2 py-1 bg-slate-900 text-white border border-slate-600 rounded text-sm placeholder-slate-500" /></td>
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
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-lg hover:shadow-xl hover:shadow-orange-500/25 hover:scale-[1.01] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20">
                  {loading ? 'Analyzing...' : 'Analyze Performance'}
                </button>
              </div>
            )}

            {/* URL Import Tab */}
            {activeTab === 'url' && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-8">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-white mb-2">World Athletics Profile URL</label>
                  <input type="text" placeholder="https://worldathletics.org/athletes/..." value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500" />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-white mb-2">Override Discipline (optional)</label>
                  <select className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500">
                    <option value="">Auto-detect</option>
                    {isThrowsMode ? (
                      <optgroup label="Throws">
                        <option value="Discus Throw">Discus Throw</option><option value="Javelin Throw">Javelin Throw</option><option value="Hammer Throw">Hammer Throw</option><option value="Shot Put">Shot Put</option>
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
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-lg hover:shadow-xl hover:shadow-orange-500/25 hover:scale-[1.01] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20">
                  {scraping ? 'Scraping...' : 'Import & Analyze'}
                </button>
              </div>
            )}

            {/* Quick Analysis Tab */}
            {activeTab === 'quick' && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-8">
                <p className="text-slate-400 mb-6">{isThrowsMode ? "Don't have full competition data? Get insights with just the essentials." : "Don't have full race data? Get insights with just the essentials."}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Discipline</label>
                    <select value={quickAnalysisData.discipline} onChange={(e) => setQuickAnalysisData({ ...quickAnalysisData, discipline: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500">
                      {isThrowsMode ? (
                        <optgroup label="Throws">
                          <option value="Discus Throw">Discus Throw</option><option value="Javelin Throw">Javelin Throw</option><option value="Hammer Throw">Hammer Throw</option><option value="Shot Put">Shot Put</option>
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
                    <label className="block text-sm font-semibold text-white mb-2">Gender</label>
                    <select value={quickAnalysisData.gender} onChange={(e) => setQuickAnalysisData({ ...quickAnalysisData, gender: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500">
                      <option value="Male">Male</option><option value="Female">Female</option>
                    </select>
                  </div>
                </div>
                <div className={`grid grid-cols-1 ${isThrowsMode ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-6 mb-8`}>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Current Age</label>
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
                      className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Personal Best {getUnitLabel(quickAnalysisData.discipline)}</label>
                    <input type="number" step="0.01" placeholder={isThrowsMode ? "e.g., 65.50" : "e.g., 10.85"} value={quickAnalysisData.personalBest}
                      onChange={(e) => setQuickAnalysisData({ ...quickAnalysisData, personalBest: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500" />
                  </div>
                  {isThrowsMode && (
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">Implement Weight</label>
                      <select value={quickAnalysisData.implementWeight}
                        onChange={(e) => setQuickAnalysisData({ ...quickAnalysisData, implementWeight: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500">
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
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-lg hover:shadow-xl hover:shadow-orange-500/25 hover:scale-[1.01] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20">
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
        <div className="min-h-screen">
          {/* Header */}
          <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 shadow-lg shadow-black/20 sticky top-0 z-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <button onClick={handleBack} className="flex items-center gap-2 text-slate-300 hover:text-orange-400 transition-colors">
                <ChevronLeft className="w-5 h-5" />
                Home
              </button>
              <div className="flex items-center gap-2">
                <img src="/icon.svg" alt="bnchmrkd icon" className="w-7 h-7" />
                <span className="text-lg font-bold text-white" style={{fontFamily: "'Inter', 'Helvetica Neue', sans-serif"}}>bnchmrkd<span className="text-orange-500">.</span></span>
              </div>
              <button onClick={() => setCurrentView('input')} className="text-sm text-slate-400 hover:text-orange-400 transition-colors">
                Full Analysis &rarr;
              </button>
            </div>
          </header>

          <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

            {/* ── SNAPSHOT HEADER ── */}
            <div className="bg-slate-800/90 rounded-2xl border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
                <div>
                  <p className="text-xs sm:text-sm text-orange-400 font-semibold mb-1 uppercase tracking-wider">Quick Snapshot</p>
                  <h2 className="text-xl sm:text-3xl font-bold text-white mb-1">
                    {analysisResults.discipline} &bull; {analysisResults.gender} &bull; Age {analysisResults.age}
                    {analysisResults.implementWeight && (
                      <span className="ml-2 text-sm font-medium text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded-full">
                        {analysisResults.implementWeight >= 1 ? `${analysisResults.implementWeight}kg` : `${Math.round(analysisResults.implementWeight * 1000)}g`}
                        {analysisResults.isSeniorWeight ? '' : ' (Youth)'}
                      </span>
                    )}
                  </h2>
                  <p className="text-slate-400">{analysisResults.careerPhase}</p>
                </div>
                <div className="flex items-center gap-6">
                  {/* PB */}
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Personal Best</p>
                    <p className="text-3xl font-bold text-orange-400">{analysisResults.personalBest}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                  </div>
                  {/* Readiness gauge */}
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#334155" strokeWidth="6" />
                      <circle cx="50" cy="50" r="42" fill="none"
                        stroke={analysisResults.readinessScore >= 80 ? '#10b981' : analysisResults.readinessScore >= 60 ? '#3b82f6' : analysisResults.readinessScore >= 40 ? '#f59e0b' : '#6b7280'}
                        strokeWidth="6"
                        strokeDasharray={`${(analysisResults.readinessScore / 100) * 263.9} 263.9`}
                        strokeLinecap="round" transform="rotate(-90 50 50)" />
                      <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#f1f5f9">{analysisResults.readinessScore}</text>
                      <text x="50" y="62" textAnchor="middle" fontSize="9" fill="#94a3b8">Readiness</text>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* ── YOUTH WEIGHT NOTICE ── */}
            {analysisResults.implementWeight && !analysisResults.isSeniorWeight && (
              <div className="bg-purple-900/30 border border-purple-700/50 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-purple-300">Youth Implement Weight Detected</p>
                  <p className="text-xs text-purple-400/80 mt-1">
                    You're using a {analysisResults.implementWeight >= 1 ? `${analysisResults.implementWeight}kg` : `${Math.round(analysisResults.implementWeight * 1000)}g`} implement.
                    Benchmark curves are based on senior-weight Olympic data ({(() => {
                      const g = analysisResults.gender === 'Male' ? 'M' : 'F';
                      const sw = { 'Shot Put_M': '7.26kg', 'Shot Put_F': '4kg', 'Discus Throw_M': '2kg', 'Discus Throw_F': '1kg', 'Hammer Throw_M': '7.26kg', 'Hammer Throw_F': '4kg', 'Javelin Throw_M': '800g', 'Javelin Throw_F': '600g' };
                      return sw[`${analysisResults.discipline}_${g}`] || 'senior weight';
                    })()}).
                    Direct distance comparisons should account for this difference. Weight transition ages are shown as purple markers on trajectory charts.
                  </p>
                </div>
              </div>
            )}

            {/* ── PERCENTILE + COMPETITIVE OUTLOOK (side by side) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Percentile */}
              <div className="bg-slate-800/90 rounded-2xl border border-slate-700/50 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  Percentile Ranking
                </h3>
                <div className="mb-4">
                  <div className="w-full bg-slate-700 rounded-full h-5 overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all ${
                      analysisResults.percentileAtCurrentAge >= 90 ? 'bg-green-500' : analysisResults.percentileAtCurrentAge >= 75 ? 'bg-blue-500' : analysisResults.percentileAtCurrentAge >= 50 ? 'bg-amber-500' : 'bg-slate-500'
                    }`} style={{ width: `${analysisResults.percentileAtCurrentAge}%` }} />
                  </div>
                  <p className="text-center text-sm text-white font-semibold">
                    Top {100 - analysisResults.percentileAtCurrentAge}% among Olympic-level athletes at age {analysisResults.age}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    { label: 'Elite', range: 'Top 10%', active: analysisResults.percentileAtCurrentAge >= 90 },
                    { label: 'National', range: 'Top 25%', active: analysisResults.percentileAtCurrentAge >= 75 && analysisResults.percentileAtCurrentAge < 90 },
                    { label: 'Competitive', range: 'Top 50%', active: analysisResults.percentileAtCurrentAge >= 50 && analysisResults.percentileAtCurrentAge < 75 },
                    { label: 'Developing', range: 'Below 50%', active: analysisResults.percentileAtCurrentAge < 50 },
                  ].map((tier, i) => (
                    <div key={i} className={`p-2 rounded-lg border ${tier.active ? 'bg-orange-500/20 border-orange-500/50 text-white' : 'bg-slate-700/30 border-slate-700/50 text-slate-400'}`}>
                      <p className="font-semibold">{tier.label}</p>
                      <p className="opacity-70">{tier.range}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Competitive Outlook */}
              <div className="bg-slate-800/90 rounded-2xl border border-slate-700/50 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-orange-500" />
                  Competitive Outlook
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Olympic Final', value: analysisResults.finalistProbability, color: '#ef4444' },
                    { label: 'Olympic Semi-Final', value: analysisResults.semiFinalistProbability, color: '#f59e0b' },
                    { label: 'Olympic Qualifier', value: analysisResults.qualifierProbability, color: '#3b82f6' },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-slate-300">{item.label}</span>
                        <span className="text-sm font-bold text-white">{Math.min(100, item.value)}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, item.value)}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── PERFORMANCE STANDARDS CHECKLIST ── */}
            {analysisResults.standards && analysisResults.standards.length > 0 && (
              <div className="bg-slate-800/90 rounded-2xl border border-slate-700/50 backdrop-blur-sm p-6 mb-8">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-orange-500" />
                  Performance Standards
                </h3>
                <p className="text-sm text-slate-400 mb-5">
                  Where does {analysisResults.personalBest}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'} sit against key competition benchmarks?
                </p>
                <div className="space-y-2.5">
                  {analysisResults.standards.map((std, idx) => {
                    // Next target = the easiest unmet standard (last unmet one in the list, since ordered hard→easy)
                    const lastUnmetIdx = analysisResults.standards.map((s, i) => !s.met ? i : -1).filter(i => i >= 0).pop();
                    const isNext = idx === lastUnmetIdx;
                    return (
                      <div key={idx} className={`relative flex items-center gap-4 p-3.5 rounded-xl border transition-all ${
                        std.met
                          ? 'bg-green-900/20 border-green-800/50'
                          : isNext
                          ? 'bg-orange-900/20 border-orange-700/50'
                          : 'bg-slate-700/30 border-slate-700/50'
                      }`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          std.met ? 'bg-green-500' : isNext ? 'bg-orange-500' : 'bg-slate-600'
                        }`}>
                          {std.met ? (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          ) : (
                            <Circle className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              std.tier === 'E1' ? 'bg-yellow-900/40 text-yellow-300'
                              : std.tier === 'E2' ? 'bg-blue-900/40 text-blue-300'
                              : std.tier === 'E3' ? 'bg-purple-900/40 text-purple-300'
                              : 'bg-slate-700/60 text-slate-400'
                            }`}>{std.tier}</span>
                            <span className={`text-sm font-semibold ${std.met ? 'text-green-300' : 'text-white'}`}>{std.label}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className="text-sm font-bold text-white">{std.time}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</span>
                          <span className={`block text-xs font-semibold ${
                            std.met ? 'text-green-400' : isNext ? 'text-orange-400' : 'text-slate-500'
                          }`}>
                            {isThrowsDiscipline(analysisResults.discipline) ? (std.met ? `${Math.abs(std.gap).toFixed(2)}m over` : `${Math.abs(std.gap).toFixed(2)}m to gain`) : (std.met ? `${Math.abs(std.gap).toFixed(2)}s under` : `${Math.abs(std.gap).toFixed(2)}s to go`)}
                          </span>
                        </div>
                        {isNext && (
                          <div className="absolute -right-1 -top-1 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full shadow">
                            NEXT
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SIMILAR ATHLETES ── */}
            {analysisResults.similarAthletes && analysisResults.similarAthletes.length > 0 && (
              <div className="bg-slate-800/90 rounded-2xl border border-slate-700/50 backdrop-blur-sm p-6 mb-8">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" />
                  Similar Athletes
                </h3>
                <p className="text-sm text-slate-400 mb-5">
                  Olympic athletes who recorded a similar time at a comparable age
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisResults.similarAthletes.map((athlete, idx) => (
                    <div key={idx} className="relative bg-slate-700/40 rounded-xl border border-slate-700/50 p-4">
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
                        Age {athlete.closestAge}: <span className="font-bold">{athlete.timeAtSimilarAge}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</span>
                        {' '}({Math.abs(athlete.timeDiff) < 0.05 ? 'identical' :
                          `${Math.abs(athlete.timeDiff).toFixed(2)}${isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'} ${isThrowsDiscipline(analysisResults.discipline) ? (athlete.timeAtSimilarAge > analysisResults.personalBest ? 'further' : 'shorter') : (athlete.timeAtSimilarAge < analysisResults.personalBest ? 'faster' : 'slower')}`})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CHAMPIONSHIP DATA ── */}
            {analysisResults.championshipData && (
              <div className="bg-slate-800/90 rounded-2xl border border-slate-700/50 backdrop-blur-sm p-6 mb-8">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-orange-500" />
                  Championship Benchmarks
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Olympic Gold', time: analysisResults.championshipData.gold, color: 'text-yellow-400', ring: 'ring-yellow-500/30' },
                    { label: 'Olympic Silver', time: analysisResults.championshipData.silver, color: 'text-gray-300', ring: 'ring-gray-400/30' },
                    { label: 'Olympic Bronze', time: analysisResults.championshipData.bronze, color: 'text-amber-500', ring: 'ring-amber-500/30' },
                    { label: 'Olympic MQT', time: analysisResults.championshipData.mqt, color: 'text-red-400', ring: 'ring-red-500/30' },
                    { label: 'Asian Champs Gold', time: analysisResults.championshipData.asianGold, color: 'text-blue-400', ring: 'ring-blue-500/30' },
                    { label: 'World U20 Gold', time: analysisResults.championshipData.u20Gold, color: 'text-purple-400', ring: 'ring-purple-500/30' },
                  ].map((item, idx) => {
                    const gap = isThrowsDiscipline(analysisResults.discipline) ? (item.time - analysisResults.personalBest) : (analysisResults.personalBest - item.time);
                    const met = isThrowsDiscipline(analysisResults.discipline) ? (gap >= 0) : (gap <= 0);
                    return (
                      <div key={idx} className={`rounded-xl p-3 text-center border ${met ? 'bg-green-900/15 border-green-800/40' : 'bg-slate-700/30 border-slate-700/50'}`}>
                        <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                        <p className={`text-lg font-bold ${item.color}`}>{item.time}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                        <p className={`text-xs font-semibold mt-0.5 ${met ? 'text-green-400' : 'text-slate-500'}`}>
                          {isThrowsDiscipline(analysisResults.discipline) ? (met ? `${Math.abs(gap).toFixed(2)}m over` : `${Math.abs(gap).toFixed(2)}m to gain`) : (met ? `${Math.abs(gap).toFixed(2)}s under` : `${Math.abs(gap).toFixed(2)}s to go`)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── IMPROVEMENT SCENARIOS ── */}
            {analysisResults.improvementScenarios && (
              <div className="bg-slate-800/90 rounded-2xl border border-slate-700/50 backdrop-blur-sm p-6 mb-8">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  What If? Improvement Scenarios
                </h3>
                <p className="text-sm text-slate-400 mb-5">
                  Projected {isThrowsDiscipline(analysisResults.discipline) ? 'distances' : 'times'} at different annual improvement rates from {analysisResults.personalBest}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-600">
                        <th className="text-left py-2.5 px-2 font-semibold text-slate-300 sticky left-0 bg-slate-800/90">Rate</th>
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
                                {time.toFixed(2)}
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
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 mb-8">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Quick Analysis is based on a single time at a single age. For trajectory modelling, rate of development tracking, and full career analysis, use the <button onClick={() => setCurrentView('input')} className="text-orange-400 hover:underline font-medium">Manual Entry</button> or <button onClick={() => setCurrentView('input')} className="text-orange-400 hover:underline font-medium">URL Import</button> methods with full race history.
                </p>
              </div>
            </div>

            {/* Back button */}
            <div className="text-center">
              <button onClick={handleBack}
                className="px-8 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors">
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
        <div className="min-h-screen">
          <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 shadow-lg shadow-black/20 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/icon.svg" alt="bnchmrkd icon" className="w-9 h-9" />
                <h1 className="text-2xl font-bold text-white" style={{fontFamily: "'Inter', 'Helvetica Neue', sans-serif"}}>bnchmrkd<span className="text-orange-500">.</span></h1>
              </div>
              <button onClick={handleBack} className="flex items-center gap-2 text-slate-300 hover:text-orange-400 font-medium transition-colors">
                <ChevronLeft className="w-5 h-5" />
                Home
              </button>
            </div>
          </header>

          {/* Ambient glow decorations */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl"></div>
            <div className="absolute top-1/3 -left-20 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl"></div>
          </div>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
            {/* ── DISCIPLINE TABS (for multi-discipline scrape results) ── */}
            {multiResults && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-5 h-5 text-orange-500" />
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

            {/* ── SUMMARY HEADER ── */}
            <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
                <div className="md:col-span-2">
                  <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2">{analysisResults.name}</h2>
                  <p className="text-sm sm:text-base text-slate-400 mb-4">
                    {analysisResults.discipline} &bull; {analysisResults.gender} &bull; Age {analysisResults.age} &bull; {analysisResults.careerPhase}
                    {analysisResults.implementWeight && (
                      <span className="ml-2 text-xs font-medium text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded-full inline-block">
                        {analysisResults.implementWeight >= 1 ? `${analysisResults.implementWeight}kg` : `${Math.round(analysisResults.implementWeight * 1000)}g`}
                        {analysisResults.isSeniorWeight ? '' : ' (Youth)'}
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Personal Best</p>
                      <p className="text-xl sm:text-2xl font-bold text-orange-600">{analysisResults.personalBest}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Trajectory</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold text-white ${
                        analysisResults.trajectoryType === 'Late Developer' ? 'bg-blue-500'
                        : analysisResults.trajectoryType === 'Early Peaker' ? 'bg-amber-500'
                        : 'bg-purple-500'
                      }`}>{analysisResults.trajectoryType}</span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Percentile</p>
                      <p className="text-2xl font-bold text-white">P{analysisResults.percentileAtCurrentAge}</p>
                      <p className="text-xs text-slate-400">{getPercentileLabel(analysisResults.percentileAtCurrentAge)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Projected Peak</p>
                      <p className="text-2xl font-bold text-white">{analysisResults.peakProjection.time}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                      <p className="text-xs text-slate-400">at age {analysisResults.peakProjection.age}</p>
                    </div>
                  </div>
                </div>

                {/* Readiness Gauge */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-36 h-36 mb-3">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#334155" strokeWidth="8" />
                      <circle cx="50" cy="50" r="45" fill="none"
                        stroke={getReadinessColor(analysisResults.readinessScore)}
                        strokeWidth="8"
                        strokeDasharray={`${(analysisResults.readinessScore / 100) * 282.7} 282.7`}
                        strokeLinecap="round" transform="rotate(-90 50 50)" />
                      <text x="50" y="46" textAnchor="middle" className="text-2xl font-bold" fill="#f1f5f9">
                        {analysisResults.readinessScore}
                      </text>
                      <text x="50" y="60" textAnchor="middle" className="text-xs" fill="#94a3b8">
                        Readiness
                      </text>
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400 text-center">Competition Readiness Score</p>
                </div>
              </div>
            </div>

            {/* ── DASHBOARD TAB NAVIGATION ── */}
            <div className="flex gap-1 bg-slate-800/90 rounded-xl border border-slate-700/50 p-1.5 mb-6 sm:mb-8 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: Target },
                { id: 'trajectory', label: 'Trajectory', icon: TrendingUp },
                { id: 'benchmarks', label: 'Benchmarks', icon: Users },
                { id: 'insights', label: 'Insights', icon: Zap },
              ].map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setDashTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                      dashTab === tab.id
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}>
                    <TabIcon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ══════════ OVERVIEW TAB ══════════ */}
            {dashTab === 'overview' && (<>

            {/* ── COMPETITIVE OUTLOOK ── */}
            {analysisResults.benchmarks && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Award className="w-5 h-5 text-orange-500" />
                  Competitive Outlook
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Finalist', prob: analysisResults.finalistProbability, color: 'green', threshold: analysisResults.thresholds.finalist },
                    { label: 'Semi-Finalist', prob: analysisResults.semiFinalistProbability, color: 'amber', threshold: analysisResults.thresholds.semiFinalist },
                    { label: 'Qualifier', prob: analysisResults.qualifierProbability, color: 'blue', threshold: analysisResults.thresholds.qualifier },
                  ].map((item, idx) => (
                    <div key={idx} className={`text-center p-5 rounded-xl border-2 ${
                      item.prob >= 60 ? `bg-${item.color}-900/30 border-${item.color}-700`
                      : item.prob >= 30 ? 'bg-slate-700/50 border-slate-600'
                      : 'bg-slate-800/50 border-slate-700/30'
                    }`}>
                      <p className="text-sm text-slate-400 mb-2">{item.label} Probability</p>
                      <p className={`text-4xl font-bold ${
                        item.prob >= 60 ? `text-${item.color}-400` : item.prob >= 30 ? 'text-white' : 'text-slate-500'
                      }`}>{item.prob}%</p>
                      <p className="text-xs text-slate-500 mt-1">Threshold: {item.threshold}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PERFORMANCE STANDARDS (in Overview) ── */}
            {analysisResults.standards && analysisResults.standards.length > 0 && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-orange-500" />
                  Performance Standards
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Competition qualification standards and benchmark targets for {analysisResults.discipline} ({analysisResults.gender})
                </p>
                <div className="space-y-3">
                  {analysisResults.standards.map((std, idx) => {
                    const lastUnmetIdx = analysisResults.standards.map((s, i) => !s.met ? i : -1).filter(i => i >= 0).pop();
                    const isNext = idx === lastUnmetIdx;
                    return (
                      <div key={idx} className={`relative flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 transition-all ${
                        std.met ? 'bg-green-900/30 border-green-800'
                        : isNext ? 'bg-orange-900/30 border-orange-300 shadow-sm'
                        : 'bg-slate-700/50 border-slate-700'
                      }`}>
                        <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                          std.met ? 'bg-green-500' : isNext ? 'bg-orange-400' : 'bg-slate-600'
                        }`}>
                          {std.met ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Circle className="w-5 h-5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              std.tier === 'E1' ? 'bg-yellow-900/40 text-yellow-300'
                              : std.tier === 'E2' ? 'bg-blue-900/40 text-blue-300'
                              : std.tier === 'E3' ? 'bg-purple-900/40 text-purple-300'
                              : 'bg-slate-700/60 text-slate-400'
                            }`}>{std.tier}</span>
                            <h4 className={`font-semibold truncate ${std.met ? 'text-green-300' : 'text-white'}`}>{std.label}</h4>
                          </div>
                          <p className="text-xs text-slate-400">{std.source}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-lg font-bold text-white">{std.time}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                          {std.met
                            ? <p className="text-xs font-semibold text-green-600">{Math.abs(std.gap).toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm over' : 's under'}</p>
                            : <p className={`text-xs font-semibold ${isNext ? 'text-orange-600' : 'text-slate-400'}`}>{Math.abs(std.gap).toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm to gain' : 's to go'}</p>
                          }
                        </div>
                        {isNext && (
                          <div className="absolute -right-1 -top-1 px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full shadow">NEXT TARGET</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">Standards Met: {analysisResults.standards.filter(s => s.met).length} / {analysisResults.standards.length}</span>
                    <div className="flex gap-1">
                      {analysisResults.standards.map((s, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full ${s.met ? 'bg-green-500' : 'bg-slate-600'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── RECOMMENDATIONS (in Overview) ── */}
            {analysisResults.recommendations && analysisResults.recommendations.length > 0 && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  Recommendations
                </h3>
                <div className="space-y-4">
                  {analysisResults.recommendations.map((rec, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border-l-4 ${
                      rec.priority === 'high' ? 'border-l-red-500 bg-red-900/20' :
                      rec.priority === 'medium' ? 'border-l-amber-500 bg-amber-900/20' :
                      'border-l-blue-500 bg-blue-900/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                          rec.priority === 'high' ? 'bg-red-900/40 text-red-300' :
                          rec.priority === 'medium' ? 'bg-amber-900/40 text-amber-300' :
                          'bg-blue-900/40 text-blue-300'
                        }`}>{rec.priority}</span>
                        <h4 className="font-semibold text-white">{rec.title}</h4>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{rec.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </>)}

            {/* ══════════ TRAJECTORY TAB ══════════ */}
            {dashTab === 'trajectory' && (<>

            {/* ── PERFORMANCE TRAJECTORY CHART WITH TABBED VIEWS ── */}
            <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                  Performance Trajectory
                </h3>
              </div>

              {/* Chart View Tabs */}
              <div className="flex gap-1 mb-4 sm:mb-6 bg-slate-700/60 rounded-lg p-1 overflow-x-auto">
                {[
                  { id: 'time', label: 'Time', icon: Timer },
                  { id: 'pctOff', label: '% Off PB', icon: Percent },
                  { id: 'percentileBand', label: 'Percentile', icon: Layers },
                  { id: 'improvementRate', label: 'Improvement', icon: BarChart2 },
                ].map(tab => {
                  const TabIcon = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => setChartView(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                        chartView === tab.id
                          ? 'bg-slate-800/90 text-orange-600 shadow-sm'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}>
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
                      <YAxis label={{ value: getUnitLabel(analysisResults.discipline), angle: -90, position: 'insideLeft', offset: -5, fill: '#94a3b8' }} tick={{ fontSize: 12, fill: '#94a3b8' }} reversed={!isThrowsDiscipline(analysisResults.discipline)} domain={['auto', 'auto']} />
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
                  <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2 text-xs text-center">
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
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-orange-500" />
                  Progression Matrix
                </h3>
                <p className="text-sm text-slate-400 mb-5">Season best at each age — your career development at a glance</p>
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
                              {time ? time.toFixed(2) : '—'}
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
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  Rate of Development
                </h3>
                <p className="text-sm text-slate-400 mb-5">Year-on-year improvement rate (ROD) and where it ranks vs Olympic finalists (RODP)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-600">
                        <th className="text-left py-3 px-3 font-semibold text-white">Age</th>
                        <th className="text-center py-3 px-3 font-semibold text-white">Season Best</th>
                        <th className="text-center py-3 px-3 font-semibold text-white">ROD</th>
                        <th className="text-center py-3 px-3 font-semibold text-white">RODP</th>
                        <th className="text-left py-3 px-3 font-semibold text-white">Development</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResults.rodData.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700">
                          <td className="py-2.5 px-3 font-medium text-white">
                            {row.age}
                            {(isThrowsDiscipline(analysisResults.discipline) ? row.time >= analysisResults.personalBest - 0.005 : row.time <= analysisResults.personalBest + 0.005) && (
                              <span className="ml-1.5 text-[10px] bg-orange-900/40 text-orange-700 px-1.5 py-0.5 rounded font-bold">PB</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-white">{row.time.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</td>
                          <td className={`py-2.5 px-3 text-center font-bold ${
                            idx === 0 ? 'text-slate-300' : row.rod > 0 ? 'text-green-600' : row.rod < 0 ? 'text-red-500' : 'text-slate-400'
                          }`}>
                            {idx === 0 ? '—' : `${row.rod > 0 ? '+' : ''}${row.rod}%`}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {idx === 0 ? (
                              <span className="text-slate-300">—</span>
                            ) : (
                              <div className="flex items-center gap-2 justify-center">
                                <div className="w-16 bg-slate-700 rounded-full h-2 overflow-hidden">
                                  <div className={`h-full rounded-full ${
                                    row.rodp >= 75 ? 'bg-green-500' : row.rodp >= 50 ? 'bg-blue-500' : row.rodp >= 25 ? 'bg-amber-500' : 'bg-red-400'
                                  }`} style={{ width: `${Math.min(100, row.rodp)}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-slate-400 w-12 text-right">{row.rodp.toFixed(0)}%</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {idx === 0 ? (
                              <span className="text-xs text-slate-400">Baseline</span>
                            ) : (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                row.rodp >= 75 ? 'bg-green-900/40 text-green-700'
                                : row.rodp >= 50 ? 'bg-blue-900/40 text-blue-700'
                                : row.rodp >= 25 ? 'bg-amber-900/40 text-amber-700'
                                : 'bg-red-900/40 text-red-600'
                              }`}>
                                {row.rodp >= 75 ? 'Elite' : row.rodp >= 50 ? 'Above Avg' : row.rodp >= 25 ? 'Average' : 'Below Avg'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            </>)}

            {/* ══════════ BENCHMARKS TAB ══════════ */}
            {dashTab === 'benchmarks' && (<>

            {/* ── PERCENTILE RANKING (in Benchmarks tab) ── */}
            <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-500" />
                Percentile Ranking
              </h3>
              <div className="mb-6">
                <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden mb-2">
                  <div className={`h-full ${getPercentileColor(analysisResults.percentileAtCurrentAge)} transition-all`}
                    style={{ width: `${analysisResults.percentileAtCurrentAge}%` }} />
                </div>
                <p className="text-center font-bold text-white">
                  Top {100 - analysisResults.percentileAtCurrentAge}% among Olympic-level athletes at age {analysisResults.age}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
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
            <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Career Trajectory vs Benchmarks
              </h3>
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
                  <YAxis reversed={!isThrowsDiscipline(analysisResults.discipline)} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={['auto', 'auto']} label={{ value: getUnitLabel(analysisResults.discipline), angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} tickFormatter={v => v.toFixed(1)} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                    formatter={(v, dataKey) => {
                      if (v == null) return null;
                      const labels = { you: 'You', finalist: 'Finalist Median', semiFinalist: 'Semi-Finalist Median', qualifier: 'Qualifier Median' };
                      const unit = isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's';
                      return [`${parseFloat(v).toFixed(2)}${unit}`, labels[dataKey] || dataKey];
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
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" />
                  Similar Athletes
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Olympic athletes who recorded similar times at a comparable age — see how their careers developed
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisResults.similarAthletes.map((athlete, idx) => (
                    <div key={idx} className="relative bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-xl border border-slate-700 p-5 hover:shadow-md transition-shadow">
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
                        At age {athlete.closestAge}: <span className="font-bold">{athlete.timeAtSimilarAge}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</span>
                        {' '}({athlete.timeDiff < 0.05 ? 'virtually identical' : `${Math.abs(athlete.timeDiff).toFixed(2)}${isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'} ${isThrowsDiscipline(analysisResults.discipline) ? (athlete.timeAtSimilarAge > analysisResults.personalBest ? 'further' : 'shorter') : (athlete.timeAtSimilarAge < analysisResults.personalBest ? 'faster' : 'slower')}`})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CHAMPIONSHIP DATA (in Benchmarks tab) ── */}
            {analysisResults.championshipData && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-orange-500" />
                  Championship Data
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Olympic Gold', time: analysisResults.championshipData.gold, color: 'bg-yellow-400' },
                    { label: 'Olympic Silver', time: analysisResults.championshipData.silver, color: 'bg-gray-400' },
                    { label: 'Olympic Bronze', time: analysisResults.championshipData.bronze, color: 'bg-amber-600' },
                    { label: 'Olympic MQT', time: analysisResults.championshipData.mqt, color: 'bg-red-500' },
                    { label: 'Asian Champs Gold', time: analysisResults.championshipData.asianGold, color: 'bg-blue-500' },
                    { label: 'World U20 Gold', time: analysisResults.championshipData.u20Gold, color: 'bg-purple-500' },
                  ].map((item, idx) => {
                    const gap = isThrowsDiscipline(analysisResults.discipline) ? (item.time - analysisResults.personalBest) : (analysisResults.personalBest - item.time);
                    const met = isThrowsDiscipline(analysisResults.discipline) ? (gap >= 0) : (gap <= 0);
                    return (
                      <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-700">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${item.color}`}></div>
                          <span className="text-sm font-medium text-slate-300">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-white">{item.time}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            met ? 'bg-green-900/40 text-green-700' : 'bg-slate-700/60 text-slate-400'
                          }`}>
                            {isThrowsDiscipline(analysisResults.discipline) ? (met ? `${Math.abs(gap).toFixed(2)}m over` : `${Math.abs(gap).toFixed(2)}m to gain`) : (met ? `${Math.abs(gap).toFixed(2)}s under` : `${Math.abs(gap).toFixed(2)}s to go`)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            </>)}

            {/* ══════════ INSIGHTS TAB ══════════ */}
            {dashTab === 'insights' && (<>

            {/* ── PEAK PROJECTION (in Insights tab) ── */}
            <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Peak Performance Projection
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Projected Peak Time</p>
                  <p className="text-3xl font-bold text-orange-600">{analysisResults.peakProjection.time}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</p>
                </div>
                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Projected Peak Age</p>
                  <p className="text-3xl font-bold text-white">{analysisResults.peakProjection.age}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {analysisResults.peakProjection.yearsToPeak > 0
                      ? `${analysisResults.peakProjection.yearsToPeak} year${analysisResults.peakProjection.yearsToPeak !== 1 ? 's' : ''} away`
                      : 'At or past peak'}
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">50% Confidence Interval</p>
                  <p className="text-xl font-bold text-white">
                    {analysisResults.peakProjection.ciLower}s – {analysisResults.peakProjection.ciUpper}s
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Projection Confidence</p>
                  <p className="text-3xl font-bold text-white">
                    {Math.round(analysisResults.peakProjection.confidence * 100)}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {analysisResults.peakProjection.confidence >= 0.7 ? 'High' : analysisResults.peakProjection.confidence >= 0.5 ? 'Moderate' : 'Low'} confidence
                  </p>
                </div>
              </div>
            </div>

            {/* ── YEAR-BY-YEAR PROJECTED TIMES (in Insights tab) ── */}
            {analysisResults.projections && analysisResults.projections.length > 0 && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  Year-by-Year Projected Times
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Based on your {analysisResults.improvementRate}%/year improvement rate, {analysisResults.trajectoryType.toLowerCase()} trajectory pattern, and population age-performance curves
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-600">
                        <th className="text-left py-3 px-4 font-semibold text-white">Age</th>
                        <th className="text-center py-3 px-4 font-semibold text-white">Projected Time</th>
                        <th className="text-center py-3 px-4 font-semibold text-white">50% CI</th>
                        <th className="text-center py-3 px-4 font-semibold text-white">90% CI</th>
                        <th className="text-center py-3 px-4 font-semibold text-white">vs Finalist</th>
                        <th className="text-center py-3 px-4 font-semibold text-white">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResults.projections.map((proj, idx) => {
                        const gap = isThrowsDiscipline(analysisResults.discipline) ? (analysisResults.thresholds.finalist - proj.projectedTime) : (proj.projectedTime - analysisResults.thresholds.finalist);
                        const meetsFinalist = isThrowsDiscipline(analysisResults.discipline) ? (proj.projectedTime >= analysisResults.thresholds.finalist) : (proj.projectedTime <= analysisResults.thresholds.finalist);
                        const meetsSemi = isThrowsDiscipline(analysisResults.discipline) ? (proj.projectedTime >= analysisResults.thresholds.semiFinalist) : (proj.projectedTime <= analysisResults.thresholds.semiFinalist);
                        const meetsQualifier = isThrowsDiscipline(analysisResults.discipline) ? (proj.projectedTime >= analysisResults.thresholds.qualifier) : (proj.projectedTime <= analysisResults.thresholds.qualifier);

                        return (
                          <tr key={idx} className={`border-b border-slate-700/50 ${proj.age === analysisResults.peakProjection.age ? 'bg-orange-900/30' : 'hover:bg-slate-700'}`}>
                            <td className="py-3 px-4 font-medium text-white">
                              {proj.age}
                              {proj.age === analysisResults.peakProjection.age && (
                                <span className="ml-2 text-xs text-orange-600 font-semibold">PEAK</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-white">{proj.projectedTime.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</td>
                            <td className="py-3 px-4 text-center text-slate-400">{proj.ci50Lower.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'} – {proj.ci50Upper.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</td>
                            <td className="py-3 px-4 text-center text-slate-400">{proj.ci90Lower.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'} – {proj.ci90Upper.toFixed(2)}{isThrowsDiscipline(analysisResults.discipline) ? 'm' : 's'}</td>
                            <td className={`py-3 px-4 text-center font-semibold ${meetsFinalist ? 'text-green-600' : 'text-red-500'}`}>
                              {isThrowsDiscipline(analysisResults.discipline) ? (meetsFinalist ? `${Math.abs(gap).toFixed(2)}m over` : `${Math.abs(gap).toFixed(2)}m to gain`) : (meetsFinalist ? `${Math.abs(gap).toFixed(2)}s under` : `${Math.abs(gap).toFixed(2)}s to go`)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {meetsFinalist ? (
                                <span className="inline-block px-2 py-1 bg-green-900/40 text-green-300 rounded text-xs font-semibold">Finalist</span>
                              ) : meetsSemi ? (
                                <span className="inline-block px-2 py-1 bg-amber-900/40 text-amber-300 rounded text-xs font-semibold">Semi</span>
                              ) : meetsQualifier ? (
                                <span className="inline-block px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs font-semibold">Qualifier</span>
                              ) : (
                                <span className="inline-block px-2 py-1 bg-slate-700/60 text-slate-400 rounded text-xs font-semibold">Developing</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── IMPROVEMENT SCENARIOS (in Insights tab) ── */}
            {analysisResults.improvementScenarios && (
              <div className="bg-slate-800/90 rounded-xl shadow-lg shadow-black/10 border border-slate-700/50 backdrop-blur-sm p-4 sm:p-8 mb-6 sm:mb-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  Performance Improvement Scenarios
                </h3>
                <p className="text-sm text-slate-400 mb-5">Projected times at different annual improvement rates from your current season best</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-600">
                        <th className="text-left py-3 px-2 font-semibold text-white sticky left-0 bg-slate-800/90">Rate</th>
                        {analysisResults.improvementScenarios[0] && Object.keys(analysisResults.improvementScenarios[0].times).map(futAge => (
                          <th key={futAge} className={`text-center py-3 px-2 font-semibold min-w-[60px] ${
                            parseInt(futAge) === analysisResults.age ? 'text-blue-600 bg-blue-900/30' : 'text-white'
                          }`}>{futAge}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResults.improvementScenarios.map((row, idx) => (
                        <tr key={idx} className={`border-b border-slate-700/50 ${idx === 0 ? 'bg-slate-700/50 font-semibold' : 'hover:bg-slate-700'}`}>
                          <td className={`py-2 px-2 font-bold sticky left-0 ${idx === 0 ? 'bg-slate-700/50 text-orange-600' : 'bg-slate-800/90 text-slate-400'}`}>
                            {row.rate}
                          </td>
                          {Object.entries(row.times).map(([futAge, time]) => {
                            const meetsFinalist = isThrowsDiscipline(analysisResults.discipline) ? time >= analysisResults.thresholds.finalist : time <= analysisResults.thresholds.finalist;
                            const meetsMQT = analysisResults.championshipData && (isThrowsDiscipline(analysisResults.discipline) ? time >= analysisResults.championshipData.mqt : time <= analysisResults.championshipData.mqt);
                            return (
                              <td key={futAge} className={`py-2 px-2 text-center text-xs ${
                                parseInt(futAge) === analysisResults.age ? 'bg-blue-900/30 font-bold' : ''
                              } ${meetsFinalist ? 'text-green-700 font-bold' : meetsMQT ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                                {time.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5"><span className="font-bold text-green-700">Green</span> = Finalist threshold met</div>
                  <div className="flex items-center gap-1.5"><span className="font-bold text-blue-700">Blue</span> = Olympic MQT met</div>
                </div>
              </div>
            )}

            {/* ── METHODOLOGY (in Insights tab) ── */}
            <div className="bg-slate-700/50 rounded-xl border border-slate-700 p-6 mb-8">
              <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-400" />
                Methodology
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Analysis powered by statistical models built from {'>'}2,300 Olympic athletes and {'>'}311,000 career race results
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
                className="px-8 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors">
                &larr; Analyze Another Athlete
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
