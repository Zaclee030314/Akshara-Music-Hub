import React, { useState, useEffect } from 'react';
import { Subject, GradeLevel, ViewState, UserStats, Question, Syllabus, CustomQuest } from './types';
import { geminiService } from './services/geminiService';
import { GameSession } from './components/GameSession';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudyPlanGenerator } from './components/StudyPlanGenerator';
import { StudyProgress } from './components/StudyProgress';

const API_BASE = '/api';
import { BookOpen, Trophy, Star, Sparkles, Loader2, ArrowLeft, RefreshCw, ScrollText, CheckCircle2, Zap, Brain, Rocket, Lock, LogIn, Mail, GraduationCap, Coins, Gift, LogOut, User as UserIcon, ShieldCheck, Coffee, Plus, Target, Trash2, Save, HelpCircle, Calendar, Home, ArrowRight, ChevronRight } from 'lucide-react';
import { useAuth } from './contexts/useAuth';
import { PaymentForm } from './components/PaymentForm';
import { LoginModal } from './components/LoginModal';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import { Hero } from './components/Hero';
import { Benefits } from './components/Benefits';
import { HowItWorks } from './components/HowItWorks';
import { Testimonials } from './components/Testimonials';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';
import { PromotionBanner } from './components/PromotionBanner';
import { SyllabusExplorer } from './components/SyllabusExplorer';
import RewardsShop from './components/RewardsShop';
import { PastYearSelector } from './components/PastYearSelector';
import { FeaturedPapers } from './components/FeaturedPapers';
import { DataAnalysis } from './components/DataAnalysis';
import { StudentClassrooms } from './components/StudentClassrooms';
import { ClassroomManager } from './components/ClassroomManager';
import { Leaderboard } from './components/Leaderboard';

const INITIAL_STATS: UserStats = {
  xp: 0,
  level: 1,
  streak: 0,
  badges: [],
  completedQuizzes: 0,
  isSubscribed: false,
  leaderboardRank: 0,
  coins: 0
};

// Expanded Subject List for Malaysian Context
const SUBJECTS = [
  { id: Subject.BAHASA_MELAYU, icon: <span className="text-2xl font-bold">BM</span>, color: 'bg-yellow-100' },
  { id: Subject.ENGLISH, icon: <span className="text-2xl font-bold">BI</span>, color: 'bg-indigo-100' },
  { id: Subject.MATH, icon: <span className="text-2xl">➗</span>, color: 'bg-blue-100' },
  { id: Subject.SCIENCE, icon: <span className="text-2xl">🧬</span>, color: 'bg-green-100' },
  { id: Subject.SEJARAH, icon: <span className="text-2xl">🏛️</span>, color: 'bg-orange-100' },
  { id: Subject.GEOGRAPHY, icon: <span className="text-2xl">🌍</span>, color: 'bg-emerald-100' },
  { id: Subject.PENDIDIKAN_ISLAM, icon: <span className="text-2xl">🕌</span>, color: 'bg-green-50' },
  { id: Subject.PENDIDIKAN_MORAL, icon: <span className="text-2xl">🤝</span>, color: 'bg-pink-100' },
  { id: Subject.RBT, icon: <span className="text-2xl">🛠️</span>, color: 'bg-gray-100' },
  { id: Subject.ADD_MATH, icon: <span className="text-2xl">∫dx</span>, color: 'bg-red-100' },
  { id: Subject.PHYSICS, icon: <span className="text-2xl">⚛️</span>, color: 'bg-purple-100' },
  { id: Subject.CHEMISTRY, icon: <span className="text-2xl">🧪</span>, color: 'bg-lime-100' },
  { id: Subject.BIOLOGY, icon: <span className="text-2xl">🦠</span>, color: 'bg-teal-100' },
  { id: Subject.ECONOMICS, icon: <span className="text-2xl">📈</span>, color: 'bg-cyan-100' },
  { id: Subject.BUSINESS, icon: <span className="text-2xl">💼</span>, color: 'bg-amber-100' },
  { id: Subject.COMPUTER_SCIENCE, icon: <span className="text-2xl">💻</span>, color: 'bg-slate-200' },
];

import { useNavigate, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  const { user, login, signup, verifyCode, resendCode, logout, subscribe, cancelSubscription, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize stats from localStorage or default
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('quest_stats');
    return saved ? JSON.parse(saved) : INITIAL_STATS;
  });

  // Check for Subscription Success in URL
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('success') === 'true') {
      const sessionId = query.get('session_id');
      const interval = query.get('interval') || 'month';

      if (sessionId && user && !user.isSubscribed) {
        const verifySubscription = async () => {
          try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch(`/api/subscription/verify-session?session_id=${sessionId}&interval=${interval}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success) {
                alert("🎉 Subscription Active! Thank you for upgrading to Pro!");
                // Remove query params
                window.history.replaceState({}, document.title, window.location.pathname);
                // Reload user (simple way) or update context
                window.location.reload();
              }
            }
          } catch (e) {
            console.error("Verification failed", e);
          }
        };
        verifySubscription();
      }
    } else if (query.get('canceled') === 'true') {
      alert("Subscription canceled.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [user]);

  // Setup State
  const [selectedSyllabus, setSelectedSyllabus] = useState<Syllabus | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Custom Quest State
  const [customQuests, setCustomQuests] = useState<CustomQuest[]>([]);
  const [selectedCustomQuest, setSelectedCustomQuest] = useState<CustomQuest | null>(null);
  const [gameMode, setGameMode] = useState<'AI' | 'CUSTOM' | 'PAST_YEAR'>('AI');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  // Game State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingGame, setLoadingGame] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentInterval, setPaymentInterval] = useState<'month' | 'year'>('month');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ prevLevel: number; newLevel: number; xpGained: number } | null>(null);
  const [currencyConfig, setCurrencyConfig] = useState({ code: 'MYR', symbol: 'RM', amount: 9.9, amountAll: 14.9 });
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [showPromo, setShowPromo] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedPlanLevel, setSelectedPlanLevel] = useState<'single' | 'all'>('single');
  const [selectedSubscriptionSyllabus, setSelectedSubscriptionSyllabus] = useState<Syllabus | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [currentStudyPlan, setCurrentStudyPlan] = useState<any | null>(null);
  const [loadingStudyPlan, setLoadingStudyPlan] = useState(false);
  const [mustAutoStart, setMustAutoStart] = useState(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);

  // Deep Linking / Quick Start Effect
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const mode = query.get('mode');
    const subject = query.get('subject') as Subject;
    const grade = query.get('grade') as GradeLevel;
    const syllabus = query.get('syllabus') as Syllabus;
    const year = query.get('year');
    const topic = query.get('topic');
    const autoStart = query.get('autoStart') === 'true';

    if (mode === 'past_year' || mode === 'AI' || mode === 'custom') {
      console.log("🔗 Deep link detected:", { mode, subject, grade, syllabus, year, topic, autoStart });

      if (syllabus && Object.values(Syllabus).includes(syllabus)) setSelectedSyllabus(syllabus);
      if (grade && Object.values(GradeLevel).includes(grade)) setSelectedGrade(grade);
      if (subject && Object.values(Subject).includes(subject)) setSelectedSubject(subject);

      if (mode === 'past_year') {
        setGameMode('PAST_YEAR');
        if (year) setSelectedYear(year);
        if (autoStart) setMustAutoStart(true);
        navigate('/practice');
      } else if (mode === 'AI') {
        setGameMode('AI');
        if (topic) setSelectedTopic(topic);
        if (autoStart) setMustAutoStart(true);
        navigate('/practice');
      } else if (mode === 'custom') {
        setGameMode('CUSTOM');
        const qId = query.get('questId');
        const aId = query.get('assignmentId');
        if (aId) setActiveAssignmentId(aId);
        
        if (qId) {
          fetch('/api/quests').then(res => res.json()).then(data => {
            const q = data.find((x: any) => x.id === qId);
            if (q) {
                setSelectedCustomQuest(q);
                if (autoStart) setMustAutoStart(true);
            }
          });
        }
        navigate('/practice');
      }

      // Clear URL params to avoid re-triggering on reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.search]);

  // Handle Auto-Start triggering
  useEffect(() => {
    if (mustAutoStart && location.pathname === '/practice') {
      // Check if required fields are ready based on mode
      const isReady = 
        (gameMode === 'AI' && selectedSubject && selectedGrade && selectedSyllabus && selectedTopic) ||
        (gameMode === 'PAST_YEAR' && selectedSubject && selectedGrade && selectedSyllabus && selectedYear) ||
        (gameMode === 'CUSTOM' && selectedCustomQuest);

      if (isReady) {
        console.log("🚀 Auto-starting game...");
        setMustAutoStart(false);
        handleStartGame();
      }
    }
  }, [mustAutoStart, location.pathname, selectedSubject, selectedGrade, selectedSyllabus, selectedTopic, selectedYear, gameMode]);

  // Sync stats from Server User
  useEffect(() => {
    if (user) {
      setStats(prev => {
        const syncedXp = (user as any).xp !== undefined ? (user as any).xp : prev.xp;
        // Level is derived from XP (1000 XP per level); the DB has no level column,
        // so recompute it here to avoid showing a stale localStorage level.
        const derivedLevel = Math.floor(Math.max(0, syncedXp) / 1000) + 1;
        return {
          ...prev,
          xp: syncedXp,
          coins: (user as any).coins !== undefined ? (user as any).coins : prev.coins,
          completedQuizzes: user.completedQuizzes !== undefined ? user.completedQuizzes : prev.completedQuizzes,
          questsPlayed: user.questsPlayed !== undefined ? user.questsPlayed : prev.questsPlayed,
          level: derivedLevel
        };
      });
    }
  }, [user]);

  // Load active session on mount
  useEffect(() => {
    const saved = localStorage.getItem('quest_active_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.questions && parsed.questions.length > 0) {
          setActiveSession(parsed);
        }
      } catch (e) {
        console.error("Failed to parse active session", e);
      }
    }
  }, []);

  // Load study plan on mount/login
  useEffect(() => {
    if (user && location.pathname === '/dashboard') {
      const fetchStudyPlan = async () => {
        setLoadingStudyPlan(true);
        try {
          const token = localStorage.getItem('quest_token');
          const res = await fetch('/api/study-plans/current', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setCurrentStudyPlan(data);
          }
        } catch (e) {
          console.error("Failed to load study plan", e);
        } finally {
          setLoadingStudyPlan(false);
        }
      };
      fetchStudyPlan();
    }
  }, [user, location.pathname]);

  // Geolocation Effect
  useEffect(() => {
    const detectCountry = async () => {
      // --- TESTING OVERRIDE: Set to 'SG', 'US', 'MY', or null to use real IP ---
      const testRegion: string | null = null;
      // -------------------------------------------------------------------------

      const applyCountry = (code: string) => {
        setDetectedCountry(code);
        if (code === 'SG') {
          setCurrencyConfig({ code: 'SGD', symbol: 'S$', amount: 9.9, amountAll: 14.9 });
        } else if (code === 'MY') {
          setCurrencyConfig({ code: 'MYR', symbol: 'RM', amount: 9.9, amountAll: 14.9 });
        } else {
          setCurrencyConfig({ code: 'USD', symbol: '$', amount: 9.9, amountAll: 14.9 });
        }
      };

      if (testRegion) {
        console.log("Using testing override:", testRegion);
        applyCountry(testRegion);
        return;
      }

      try {
        console.log("Fetching geolocation...");
        const res = await fetch('/api/geolocation');
        if (!res.ok) throw new Error("API response not ok");
        const data = await res.json();
        const code = data.countryCode;
        console.log("Detected Country:", code);
        applyCountry(code);
      } catch (error) {
        console.error("Geolocation failed:", error);
        // Default to MY (most users)
        applyCountry('MY');
      }
    };
    detectCountry();
  }, []);

  // Load custom quests whenever view changes (e.g. coming back from dashboard)
  // Load custom quests whenever view changes (e.g. coming back from dashboard)
  useEffect(() => {
    const fetchQuests = async () => {
      try {
        const res = await fetch('/api/quests');
        if (res.ok) {
          const data = await res.json();
          setCustomQuests(data);
        }
      } catch (error) {
        console.error("Failed to load quests", error);
      }
    };
    fetchQuests();
  }, [location.pathname]);

  // Returns syllabuses available for the detected country
  const getSyllabusesByCountry = (country: string | null): Syllabus[] => {
    if (country === 'MY') {
      // Malaysia: show everything
      return Object.values(Syllabus);
    } else if (country === 'SG') {
      // Singapore: MOE Singapore, IGCSE, IB – no KSSM or UEC
      return [Syllabus.MOE_SINGAPORE, Syllabus.IGCSE, Syllabus.IB];
    } else {
      // International / undetected: IGCSE and IB only
      return [Syllabus.IGCSE, Syllabus.IB, Syllabus.MOE_SINGAPORE];
    }
  };

  // Auto-select best-fit default syllabus based on detected country
  useEffect(() => {
    if (location.pathname === '/practice' && !selectedSyllabus) {
      const available = getSyllabusesByCountry(detectedCountry);
      setSelectedSyllabus(available[0]);
    }
  }, [location.pathname, selectedSyllabus, detectedCountry]);

  // Reset grade if invalid for current syllabus
  useEffect(() => {
    if (selectedSyllabus && selectedGrade) {
      const available = getGradesBySyllabus(selectedSyllabus);
      const allValues = [...available.primary, ...available.secondary, ...(available.advanced || [])];
      if (!allValues.includes(selectedGrade)) {
        setSelectedGrade(null);
        setSelectedSubject(null);
      }
    }
  }, [selectedSyllabus]);

  // Reset subject if not available for current grade
  useEffect(() => {
    if (selectedGrade && selectedSubject) {
      const available = getSubjectsByGrade(selectedGrade, selectedSyllabus);
      if (!available.some(s => s.id === selectedSubject)) {
        setSelectedSubject(null);
      }
    }
  }, [selectedGrade]);

  const getGradesBySyllabus = (syll: Syllabus) => {
    const all = Object.values(GradeLevel);
    switch (syll) {
      case Syllabus.IGCSE:
        return {
          primary: all.filter(g => ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'].includes(g)),
          secondary: all.filter(g => ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'].includes(g)),
          advanced: all.filter(g => ['Year 12', 'Year 13'].includes(g))
        };
      case Syllabus.MOE_SINGAPORE:
        return {
          primary: all.filter(g => g.startsWith('Standard')), // Singapore P1-P6 maps well to Standard 1-6
          secondary: all.filter(g => g.startsWith('Secondary'))
        };
      case Syllabus.IB:
        return {
          primary: all.filter(g => g.startsWith('Year') && parseInt(g.split(' ')[1]) <= 6),
          secondary: all.filter(g => g.startsWith('Year') && parseInt(g.split(' ')[1]) > 6 && parseInt(g.split(' ')[1]) <= 11),
          advanced: all.filter(g => ['Year 12', 'Year 13'].includes(g)) // IB also uses Year 12-13
        };
      case Syllabus.UEC:
        // UEC: Chinese independent schools — Junior Middle (Form 1-3) + Senior Middle (Form 4-6)
        return {
          primary: all.filter(g => [GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3].includes(g as GradeLevel)),
          secondary: all.filter(g => [GradeLevel.FORM_4, GradeLevel.FORM_5, GradeLevel.FORM_6].includes(g as GradeLevel))
        };
      case Syllabus.KSSR_KSSM:
      default:
        return {
          primary: all.filter(g => g.startsWith('Standard')),
          secondary: all.filter(g => g.startsWith('Form'))
        };
    }
  };

  // Returns only the subjects available for a given grade level (and syllabus context)
  const getSubjectsByGrade = (grade: GradeLevel | null, syllabus: Syllabus | null) => {
    if (!grade) return SUBJECTS;

    // ─── UEC (Unified Examination Certificate) ─────────────────────────────────
    // UEC Junior Middle: Form 1-3
    if (syllabus === Syllabus.UEC &&
      (grade === GradeLevel.FORM_1 || grade === GradeLevel.FORM_2 || grade === GradeLevel.FORM_3)) {
      return SUBJECTS.filter(s => [
        Subject.BAHASA_MELAYU,
        Subject.ENGLISH,
        Subject.MATH,
        Subject.SCIENCE,
        Subject.SEJARAH,
        Subject.GEOGRAPHY,
        Subject.PENDIDIKAN_MORAL,
        Subject.COMPUTER_SCIENCE,
      ].includes(s.id as Subject));
    }
    // UEC Senior Middle: Form 4-5
    if (syllabus === Syllabus.UEC &&
      (grade === GradeLevel.FORM_4 || grade === GradeLevel.FORM_5)) {
      return SUBJECTS.filter(s => [
        Subject.BAHASA_MELAYU,
        Subject.ENGLISH,
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.GEOGRAPHY,
        Subject.SEJARAH,
        Subject.ECONOMICS,
        Subject.BUSINESS,
        Subject.PENDIDIKAN_MORAL,
        Subject.COMPUTER_SCIENCE,
      ].includes(s.id as Subject));
    }
    // UEC Senior Middle: Form 6
    if (syllabus === Syllabus.UEC && grade === GradeLevel.FORM_6) {
      return SUBJECTS.filter(s => [
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.ECONOMICS,
        Subject.BUSINESS,
        Subject.ENGLISH,
        Subject.BAHASA_MELAYU,
        Subject.COMPUTER_SCIENCE,
        Subject.GEOGRAPHY,
        Subject.SEJARAH
      ].includes(s.id as Subject));
    }

    // ─── IB (International Baccalaureate) ──────────────────────────────────────
    // IB PYP: Year 1-6
    if (syllabus === Syllabus.IB &&
      [GradeLevel.YEAR_1, GradeLevel.YEAR_2, GradeLevel.YEAR_3,
      GradeLevel.YEAR_4, GradeLevel.YEAR_5, GradeLevel.YEAR_6].includes(grade)) {
      return SUBJECTS.filter(s => [
        Subject.ENGLISH,
        Subject.MATH,
        Subject.SCIENCE,
      ].includes(s.id as Subject));
    }
    // IB MYP: Year 7-11
    if (syllabus === Syllabus.IB &&
      [GradeLevel.YEAR_7, GradeLevel.YEAR_8, GradeLevel.YEAR_9,
      GradeLevel.YEAR_10, GradeLevel.YEAR_11].includes(grade)) {
      return SUBJECTS.filter(s => [
        Subject.ENGLISH,
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.SCIENCE,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.GEOGRAPHY,
        Subject.SEJARAH,
        Subject.ECONOMICS,
        Subject.COMPUTER_SCIENCE,
      ].includes(s.id as Subject));
    }
    // IB DP: Year 12-13
    if (syllabus === Syllabus.IB &&
      (grade === GradeLevel.YEAR_12 || grade === GradeLevel.YEAR_13)) {
      return SUBJECTS.filter(s => [
        Subject.ENGLISH,
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.GEOGRAPHY,
        Subject.ECONOMICS,
        Subject.BUSINESS,
        Subject.COMPUTER_SCIENCE,
      ].includes(s.id as Subject));
    }

    // ─── Malaysian KSSR (Primary: Standard 1-6) ─────────────────────────────────
    if (grade === GradeLevel.STD_1 || grade === GradeLevel.STD_2 || grade === GradeLevel.STD_3) {
      return SUBJECTS.filter(s => [
        Subject.BAHASA_MELAYU,
        Subject.ENGLISH,
        Subject.MATH,
        Subject.SCIENCE,
        Subject.PENDIDIKAN_ISLAM,
        Subject.PENDIDIKAN_MORAL,
      ].includes(s.id as Subject));
    }
    if (grade === GradeLevel.STD_4 || grade === GradeLevel.STD_5 || grade === GradeLevel.STD_6) {
      return SUBJECTS.filter(s => [
        Subject.BAHASA_MELAYU,
        Subject.ENGLISH,
        Subject.MATH,
        Subject.SCIENCE,
        Subject.SEJARAH,
        Subject.RBT,
        Subject.PENDIDIKAN_ISLAM,
        Subject.PENDIDIKAN_MORAL,
      ].includes(s.id as Subject));
    }

    // ─── Malaysian KSSM (Secondary: Form 1-3) ───────────────────────────────────
    if (grade === GradeLevel.FORM_1 || grade === GradeLevel.FORM_2 || grade === GradeLevel.FORM_3) {
      return SUBJECTS.filter(s => [
        Subject.BAHASA_MELAYU,
        Subject.ENGLISH,
        Subject.MATH,
        Subject.SCIENCE,
        Subject.SEJARAH,
        Subject.GEOGRAPHY,
        Subject.RBT,
        Subject.PENDIDIKAN_ISLAM,
        Subject.PENDIDIKAN_MORAL,
        Subject.COMPUTER_SCIENCE,
      ].includes(s.id as Subject));
    }

    // ─── Malaysian KSSM (Secondary: Form 4-5) ───────────────────────────────────
    if (grade === GradeLevel.FORM_4 || grade === GradeLevel.FORM_5) {
      return SUBJECTS.filter(s => [
        Subject.BAHASA_MELAYU,
        Subject.ENGLISH,
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.SEJARAH,
        Subject.GEOGRAPHY,
        Subject.PENDIDIKAN_ISLAM,
        Subject.PENDIDIKAN_MORAL,
        Subject.ECONOMICS,
        Subject.BUSINESS,
        Subject.COMPUTER_SCIENCE,
      ].includes(s.id as Subject));
    }

    // ─── Form 6 / STPM ─────────────────────────────────────────────────────────
    if (grade === GradeLevel.FORM_6) {
      return SUBJECTS.filter(s => [
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.ECONOMICS,
        Subject.BUSINESS,
        Subject.BAHASA_MELAYU,
        Subject.ENGLISH,
      ].includes(s.id as Subject));
    }

    // ─── Singapore MOE (Secondary: Sec 1-5) ────────────────────────────────────
    if (grade === GradeLevel.SEC_1 || grade === GradeLevel.SEC_2 ||
      grade === GradeLevel.SEC_3 || grade === GradeLevel.SEC_4 || grade === GradeLevel.SEC_5) {
      return SUBJECTS.filter(s => [
        Subject.ENGLISH,
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.SCIENCE,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.GEOGRAPHY,
        Subject.SEJARAH,
        Subject.ECONOMICS,
        Subject.BUSINESS,
        Subject.COMPUTER_SCIENCE,
      ].includes(s.id as Subject));
    }

    // ─── IGCSE / Cambridge: Year 1-6 (Primary) ─────────────────────────────────
    if ([GradeLevel.YEAR_1, GradeLevel.YEAR_2, GradeLevel.YEAR_3,
    GradeLevel.YEAR_4, GradeLevel.YEAR_5, GradeLevel.YEAR_6].includes(grade)) {
      return SUBJECTS.filter(s => [
        Subject.ENGLISH,
        Subject.MATH,
        Subject.SCIENCE,
      ].includes(s.id as Subject));
    }

    // ─── IGCSE / Cambridge: Year 7-11 ──────────────────────────────────────────
    if ([GradeLevel.YEAR_7, GradeLevel.YEAR_8, GradeLevel.YEAR_9,
    GradeLevel.YEAR_10, GradeLevel.YEAR_11].includes(grade)) {
      return SUBJECTS.filter(s => [
        Subject.ENGLISH,
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.GEOGRAPHY,
        Subject.ECONOMICS,
        Subject.BUSINESS,
        Subject.COMPUTER_SCIENCE,
      ].includes(s.id as Subject));
    }

    // ─── A-Level / Year 12-13 ──────────────────────────────────────────────────
    if (grade === GradeLevel.YEAR_12 || grade === GradeLevel.YEAR_13) {
      return SUBJECTS.filter(s => [
        Subject.MATH,
        Subject.ADD_MATH,
        Subject.PHYSICS,
        Subject.CHEMISTRY,
        Subject.BIOLOGY,
        Subject.ECONOMICS,
        Subject.BUSINESS,
        Subject.COMPUTER_SCIENCE,
        Subject.ENGLISH,
      ].includes(s.id as Subject));
    }

    // Fallback: return all subjects
    return SUBJECTS;
  };

  // Scroll Reveal Observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.1 });

    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [location.pathname]);

  // Fetch syllabus whenever Subject or Grade changes
  const fetchSyllabus = async (isRefresh: boolean = false) => {
    if (!selectedSubject || !selectedSyllabus || !selectedGrade) {
      console.log("Skipping syllabus fetch: missing selections");
      return;
    }
    console.log("🔄 Fetching syllabus for:", selectedSubject, selectedGrade, selectedSyllabus, isRefresh ? '(REFRESH)' : '');
    setLoadingTopics(true);
    setTopics([]);
    setSelectedTopic(null);

    try {
      const fetchedTopics = await geminiService.generateSyllabus(selectedSubject, selectedGrade, selectedSyllabus);
      console.log("✅ Fetched topics:", fetchedTopics.length);
      setTopics(fetchedTopics);
    } catch (error: any) {
      console.error("❌ Error fetching topics:", error);
      if (error.message === "QUOTA_EXCEEDED") {
        setShowQuotaModal(true);
      }
    } finally {
      setLoadingTopics(false);
    }
  };

  useEffect(() => {
    if (selectedSubject && selectedGrade && selectedSyllabus && location.pathname === '/practice') {
      fetchSyllabus();
    }
  }, [selectedSubject, selectedGrade, selectedSyllabus, location.pathname]);

  const handleStartProcess = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    // Allow everyone to play (Demo/Free)
    const subLevel = (user as any)?.subscriptionLevel;
    const subSyllabus = (user as any)?.subscribedSyllabus;
    if (user?.isSubscribed && subLevel === 'single' && subSyllabus) {
      setSelectedSyllabus(subSyllabus as Syllabus);
    }
    navigate('/practice');
  };

  const handleNewQuest = () => {
    // Reset all selection states for a clean start
    setSelectedSyllabus(null);
    setSelectedGrade(null);
    setSelectedSubject(null);
    setSelectedTopic(null);
    setSelectedCustomQuest(null);
    setSelectedYear(null);

    // Jump back to setup
    navigate('/practice');
  };

  const handleSubscribe = async (interval: 'month' | 'year', planLevel: 'single' | 'all', syllabus: Syllabus | null = null) => {
    if (!user) {
      alert("Please login or signup first to purchase a subscription.");
      setShowLoginModal(true);
      return;
    }

    if (planLevel === 'single' && !syllabus) {
      alert("Please select a syllabus for the Single Syllabus plan.");
      return;
    }

    try {
      console.log(`Starting embedded checkout process for ${planLevel} plan (${interval})...`);
      const token = localStorage.getItem('quest_token');

      const baseAmount = planLevel === 'all' ? currencyConfig.amountAll : currencyConfig.amount;
      const amount = baseAmount * 100;

      const body = {
        amount: Math.round(amount),
        currency: currencyConfig.code.toLowerCase(),
        interval: 'month',
        planLevel,
        syllabus
      };

      const res = await fetch('/api/subscription/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        setPaymentClientSecret(data.clientSecret);
        setPaymentAmount(data.amount);
        setPaymentInterval(interval);
        setSelectedPlanLevel(planLevel);
        setSelectedSubscriptionSyllabus(syllabus);
      } else {
        const err = await res.json();
        console.error("Subscription failed:", err);
        alert(`Failed to start subscription: ${err.error}`);
      }
    } catch (e) {
      console.error("Payment error:", e);
      alert("Error starting subscription. Check console.");
    }
  };

  const handleStartGame = async () => {
    // Check Subscription Limit (Limit: 1 Quest for free users/guests)

    // Prioritize questsPlayed (Generation count) if available
    let usageCount = 0;
    if (user && user.questsPlayed !== undefined) {
      usageCount = user.questsPlayed;
    } else {
      // Fallback or Guest
      usageCount = user?.completedQuizzes ?? stats.completedQuizzes;
    }

    console.log("Usage Check:", usageCount);

    // Check if user is Pro
    const isPro = user?.isSubscribed;
    const subscriptionLevel = (user as any)?.subscriptionLevel;
    const subscribedSyllabus = (user as any)?.subscribedSyllabus;

    if (!isPro && usageCount >= 1) {
      setShowLimitModal(true);
      return;
    }

    // Access Control check for Single Syllabus Plan
    if (isPro && subscriptionLevel === 'single' && selectedSyllabus !== subscribedSyllabus) {
      alert(`Your current plan only covers the ${subscribedSyllabus} syllabus. Please upgrade to "All Syllabus" or choose your subscribed syllabus.`);
      navigate('/pricing');
      return;
    }

    setLoadingGame(true);
    // Clear any previous active session when starting fresh
    localStorage.removeItem('quest_active_session');
    setActiveSession(null);

    if (gameMode === 'CUSTOM') {
      if (!selectedCustomQuest) {
        setLoadingGame(false);
        return;
      }
      setQuestions(selectedCustomQuest.questions);
      setLoadingGame(false);
      navigate('/practice/session');
      return;
    }

    // AI or Past Year Mode
    if (!selectedSubject || !selectedSyllabus || !selectedGrade) {
      setLoadingGame(false);
      return;
    }

    if (gameMode === 'AI' && !selectedTopic) {
      setLoadingGame(false);
      return;
    }

    if (gameMode === 'PAST_YEAR' && !selectedYear) {
      setLoadingGame(false);
      return;
    }

    try {
      const generatedQuestions = await geminiService.generateContent(
        selectedSubject,
        selectedGrade,
        gameMode === 'PAST_YEAR' ? 'Full Exam Paper' : selectedTopic!,
        selectedSyllabus,
        gameMode === 'PAST_YEAR',
        selectedYear || undefined
      );

      if (generatedQuestions.length > 0) {
        setQuestions(generatedQuestions);
        navigate('/practice/session');
      } else {
        alert("Oops! The AI teacher is taking a nap. Please try again or check your API key.");
      }
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") {
        setShowQuotaModal(true);
      } else if (error.message === "USER_LIMIT_REACHED") {
        setShowLimitModal(true);
      } else {
        console.error(error);
        alert("Error generating quest. Please check your connection.");
      }
    } finally {
      setLoadingGame(false);
    }
  };

  const handleGameComplete = async (score: number, correctAnswers: number) => {
    // Save to Database first
    if (user) {
      try {
        const token = localStorage.getItem('quest_token');

        if (activeAssignmentId) {
          await fetch(`/api/assignments/${activeAssignmentId}/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ score })
          });
          setActiveAssignmentId(null);
        }

        const res = await fetch('/api/results', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            score,
            mode: gameMode,
            questId: selectedCustomQuest?.id,
            correctAnswers,
            totalQuestions: questions.length,
            subject: gameMode === 'AI' ? selectedSubject : selectedCustomQuest?.subject,
            topic: gameMode === 'AI' ? selectedTopic : undefined
          })
        });
        if (res.ok) {
          // Sync coins from authoritative DB value
          const data = await res.json();
          if (typeof data.newCoinTotal === 'number') {
            setStats(prev => ({ ...prev, coins: data.newCoinTotal }));
          }
        } else {
          console.error("Failed to save result");
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Optimistic update for immediate feedback
    const xpGained = score;
    // 1 coin per correct answer — matches the backend results.ts logic
    const coinsGained = correctAnswers || 0;
    const newXp = stats.xp + xpGained;
    const newLevel = Math.floor(newXp / 1000) + 1;
    const oldLevel = stats.level;
    const newQuizzes = stats.completedQuizzes + 1;

    // Detect level up
    if (newLevel > oldLevel) {
      setLevelUpData({ prevLevel: oldLevel, newLevel, xpGained });
      setShowLevelUp(true);
    }

    setStats(prev => ({
      ...prev,
      xp: newXp,
      // Only apply optimistic coin update if not already synced from API above
      coins: (prev.coins || 0) + coinsGained,
      level: newLevel,
      completedQuizzes: newQuizzes,
      streak: prev.streak + 1
    }));

    // Re-fetch user profile (background) to ensure sync
    if (user) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('quest_token')}` }
      }).then(res => {
        if (res.ok) return res.json();
      }).then(data => {
        // Ideally we update AuthContext user here
      });
    }

    // Clear session on completion
    localStorage.removeItem('quest_active_session');
    setActiveSession(null);

    navigate('/dashboard');
  };

  const getDaysRemaining = (date?: string | Date) => {
    if (!date) return null;
    const end = new Date(date);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    if (diffTime < 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleCancelSubscription = async () => {
    if (window.confirm("Are you sure you want to cancel your Pro subscription? You will lose access to unlimited quizzes.")) {
      const success = await cancelSubscription();
      if (success) {
        alert("Your subscription has been cancelled.");
        navigate('/');
      }
    }
  };

  // EXP progress within current level (each level = 1000 XP)
  const xpForCurrentLevel = (stats.level - 1) * 1000;
  const xpForNextLevel = stats.level * 1000;
  const xpIntoLevel = stats.xp - xpForCurrentLevel;
  const xpToNextLevel = xpForNextLevel - xpForCurrentLevel; // always 1000
  const expPercent = Math.min(100, Math.round((xpIntoLevel / xpToNextLevel) * 100));

  // Level title
  const getLevelTitle = (level: number) => {
    if (level < 3) return 'Rookie Scholar';
    if (level < 6) return 'Rising Star';
    if (level < 10) return 'Knowledge Seeker';
    if (level < 15) return 'Quest Master';
    if (level < 20) return 'Legendary Mind';
    return 'Grand Champion';
  };

  // Level-up overlay
  const LevelUpOverlay = () => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowLevelUp(false)}>
      <div className="relative text-center animate-pop-in" onClick={e => e.stopPropagation()}>
        {/* Burst rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 rounded-full border-4 border-yellow-400/40 animate-ping" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 rounded-full border-4 border-yellow-300/60 animate-ping" style={{ animationDelay: '0.2s' }} />
        </div>

        <div className="bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 rounded-3xl p-10 shadow-2xl shadow-orange-500/40 mx-4 max-w-sm relative overflow-hidden">
          {/* Shine sweep */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-[shimmer_1.5s_ease-in-out_infinite]" />

          <div className="text-7xl mb-4 relative">⚡</div>
          <p className="text-white/80 font-bold text-sm uppercase tracking-widest mb-1">Level Up!</p>
          <div className="text-white font-display font-bold text-7xl leading-none mb-2">
            {levelUpData?.newLevel}
          </div>
          <p className="text-white/90 font-bold text-lg mb-1">{getLevelTitle(levelUpData?.newLevel ?? 1)}</p>
          <p className="text-white/70 text-sm mb-6">+{levelUpData?.xpGained} XP earned</p>
          <button
            onClick={() => setShowLevelUp(false)}
            className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-3 rounded-full transition-all border border-white/30"
          >
            Awesome! 🎉
          </button>
        </div>
      </div>
    </div>
  );

  const LimitReachedModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="max-w-md w-full p-8 relative animate-pop-in shadow-2xl border-2 border-brand-orange/20 overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-orange/10 rounded-full blur-3xl"></div>

        <div className="text-center relative z-10">
          <div className="w-20 h-20 bg-brand-orange/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-brand-orange rotate-3 shadow-inner">
            <Lock size={40} className="-rotate-3" />
          </div>

          <h3 className="text-3xl font-display font-bold text-brand-dark mb-4 tracking-tight">
            Quest Limit Reached!
          </h3>

          <div className="bg-orange-50/50 p-4 rounded-2xl mb-6 border border-brand-orange/10">
            <p className="text-brand-dark/70 leading-relaxed font-medium">
              You've completed your <span className="text-brand-orange font-bold">1 free quiz</span>.
              Upgrade to Pro for unlimited quest creation and play to unlock your full potential!
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Button
              fullWidth
              size="lg"
              onClick={() => {
                setShowLimitModal(false);
                navigate('/pricing');
              }}
              className="bg-brand-orange hover:bg-orange-400 py-6 text-lg shadow-lg shadow-brand-orange/20"
            >
              Upgrade to Pro <Sparkles size={18} className="ml-2" />
            </Button>

            <button
              onClick={() => setShowLimitModal(false)}
              className="text-brand-dark/40 hover:text-brand-dark font-bold text-sm transition-colors py-2"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </Card>
    </div>
  );

  const AiQuotaModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="max-w-md w-full p-8 relative animate-pop-in shadow-2xl border-2 border-brand-orange/20 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-orange/10 rounded-full blur-3xl"></div>

        <div className="text-center relative z-10">
          <div className="w-20 h-20 bg-brand-orange/5 rounded-3xl flex items-center justify-center mx-auto mb-6 text-brand-orange rotate-6 shadow-inner">
            <Coffee size={40} className="-rotate-6" />
          </div>

          <h3 className="text-3xl font-display font-bold text-brand-dark mb-4 tracking-tight">
            AI is Taking a Break!
          </h3>

          <div className="bg-orange-50/50 p-4 rounded-2xl mb-6 border border-brand-orange/10">
            <p className="text-brand-dark/70 leading-relaxed font-medium">
              We've hit the <span className="text-brand-orange font-bold">daily AI limit</span> for today.
              Our AI teacher needs some rest (and we need to wait for the quota to reset)!
            </p>
            <p className="text-xs text-brand-dark/40 mt-4 italic">
              Try again in a few hours or tomorrow morning.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Button
              fullWidth
              size="lg"
              onClick={() => setShowQuotaModal(false)}
              className="bg-brand-orange hover:bg-orange-400 py-6 text-lg shadow-lg"
            >
              Understand
            </Button>

            <p className="text-xs text-brand-dark/30 font-medium">
              Daily limits help keep Akshara Music Hub free for everyone.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderHome = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 space-y-20 pb-20">
      <Hero
        onStart={handleStartProcess}
        onViewPricing={() => navigate('/pricing')}
        isLoggedIn={!!user}
        isSubscribed={user?.isSubscribed || false}
        currencyConfig={currencyConfig}
      />

      {/* Active Quest Quick-Resume (Mobile & Desktop) */}
      {activeSession && (
        <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-30">
          <div className="p-6 bg-gradient-to-br from-brand-blue/10 via-brand-blue/5 to-white border-2 border-brand-blue/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-pop-in shadow-2xl shadow-brand-blue/10 group">
             <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="w-14 h-14 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg animate-float">
                <Rocket size={28} />
              </div>
              <div className="text-left">
                <span className="bg-brand-blue text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider mb-1 inline-block">Resume Quest</span>
                <p className="font-display font-bold text-brand-dark text-xl leading-tight">Continue where you left off!</p>
                <p className="text-xs text-brand-dark/60 font-medium mt-0.5">
                  {activeSession?.subject} • Question {(activeSession?.currentIndex || 0) + 1} of {activeSession?.questions?.length || 0}
                </p>
              </div>
            </div>
            <Button 
              size="lg"
              className="w-full md:w-auto shadow-xl shadow-brand-blue/20 bg-brand-blue hover:bg-brand-blue/90 animate-pulse-glow"
              onClick={() => {
                setQuestions(activeSession.questions);
                setSelectedSubject(activeSession.subject);
                setSelectedGrade(activeSession.grade);
                setSelectedSyllabus(activeSession.syllabus);
                setSelectedTopic(activeSession.topic);
                setGameMode(activeSession.gameMode);
                navigate('/practice/session');
              }}
            >
              Continue Adventure <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick Access Cards */}
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 relative z-20">
        {/* Teacher Dashboard Mini-Card */}
        <Card className="p-6 border-2 border-brand-dark/5 bg-gradient-to-br from-purple-50 to-pink-50 relative overflow-hidden group shadow-xl">
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
            <GraduationCap size={120} />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-md group-hover:shadow-lg transition-transform group-hover:-translate-y-1">
              <GraduationCap size={20} />
            </div>
            <h3 className="font-bold text-brand-dark mb-1">Teacher Dashboard</h3>
            <p className="text-xs text-brand-dark/60 mb-6 flex-1">
              Create custom quests, manage students, and track progress.
            </p>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              className="bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20"
              onClick={() => {
                if (!user) setShowLoginModal(true);
                else navigate('/teacher');
              }}
            >
              <Brain size={14} className="mr-1.5" /> Dashboard
            </Button>
          </div>
        </Card>

        {/* Rewards Shop Mini-Card */}
        <Card className="p-6 border-2 border-brand-dark/5 bg-gradient-to-br from-yellow-50 to-orange-50 relative overflow-hidden group shadow-xl">
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
            <Gift size={120} />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-md group-hover:shadow-lg transition-transform group-hover:-translate-y-1">
              <Gift size={20} />
            </div>
            <h3 className="font-bold text-brand-dark mb-1">Rewards Shop</h3>
            <p className="text-xs text-brand-dark/60 mb-6 flex-1">
              Spend your hard-earned coins on exciting rewards and power-ups.
            </p>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              className="bg-yellow-500 hover:bg-yellow-600 shadow-md shadow-yellow-500/20"
              onClick={() => { if (!user) setShowLoginModal(true); else navigate('/rewards'); }}
            >
              <Coins size={14} className="mr-1.5" /> {user ? 'Visit Shop' : 'Log In'}
            </Button>
          </div>
        </Card>

        {/* AI Study Plan Mini-Card */}
        <Card className="p-6 border-2 border-brand-dark/5 bg-gradient-to-br from-indigo-50 to-blue-50 relative overflow-hidden group shadow-xl">
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
            <Calendar size={120} />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-md group-hover:shadow-lg transition-transform group-hover:-translate-y-1">
              <Calendar size={20} />
            </div>
            <h3 className="font-bold text-brand-dark mb-1">AI Study Plan</h3>
            <p className="text-xs text-brand-dark/60 mb-6 flex-1">
              Generate a personalized daily roadmap to ace your exams.
            </p>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              onClick={() => {
                if (!user) setShowLoginModal(true);
                else navigate('/study-plan');
              }}
            >
              <Sparkles size={14} className="mr-1.5" /> Create Plan
            </Button>
          </div>
        </Card>
      </div>

      <Benefits />
      <HowItWorks />



      <SyllabusExplorer onSelectSubject={(subj, syll) => {
        setSelectedSubject(subj);
        setSelectedSyllabus(syll);
        handleStartProcess();
      }} />

      <FeaturedPapers onQuickStart={(paper) => {
        setSelectedSubject(paper.subject);
        setSelectedSyllabus(paper.syllabus);
        setSelectedGrade(paper.grade);
        setSelectedYear(paper.year);
        setGameMode('PAST_YEAR');

        if (!user) {
          setShowLoginModal(true);
        } else {
          // Setting the view to GAME_SETUP first ensures the UI is ready
          navigate('/practice');
          // We wait a tiny bit for state to propagate before starting
          // Alternatively, we could update handleStartGame to handle injection
          setTimeout(() => {
            const startBtn = document.querySelector('button.bg-brand-blue.text-white'); // Simple hack or better refactor
            if (startBtn) (startBtn as any).click();
          }, 100);
        }
      }} />

    </div >
  );

  const renderPricing = () => {

    return (
      <div className="max-w-6xl mx-auto px-4 pb-20 animate-float-slow">
        <div className="text-center mb-16 space-y-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="mb-4 mx-auto">
            <ArrowLeft size={16} /> Back to Home
          </Button>
          <h2 className="text-5xl font-display font-bold text-brand-dark">Choose Your Plan</h2>
          <p className="text-xl opacity-60">Unlock unlimited access to the entire curriculum.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {paymentClientSecret ? (
            <div className="md:col-span-3 flex justify-center">
              <PaymentForm
                amount={paymentAmount}
                interval={paymentInterval}
                planLevel={selectedPlanLevel}
                syllabus={selectedSubscriptionSyllabus}
                clientSecret={paymentClientSecret}
                onCancel={() => setPaymentClientSecret(null)}
                onSuccess={() => {
                  setPaymentClientSecret(null);
                  window.location.reload();
                }}
              />
            </div>
          ) : (
            <>
              {/* Free Starter */}
              <Card className="p-8 md:p-10 flex flex-col items-center gap-8 border-2 border-transparent hover:border-brand-dark/10 opacity-60 transition-all bg-white/50">
                <div className="text-center space-y-3">
                  <h3 className="font-display font-bold text-3xl text-brand-dark/60">Starter</h3>
                  <div className="text-5xl font-display font-bold text-brand-dark/60">
                    {currencyConfig.symbol} 0
                  </div>
                </div>

                <ul className="space-y-5 w-full flex-1">
                  <li className="flex items-start gap-3 text-sm font-medium text-brand-dark/60">
                    <CheckCircle2 size={18} className="text-brand-green shrink-0" />
                    <span>1 free quiz and 1 free create question</span>
                  </li>
                </ul>

                <Button variant="outline" fullWidth onClick={() => navigate('/practice')} className="py-4">
                  Get Started
                </Button>
              </Card>

              {/* Single Syllabus Plan */}
              <Card className="p-8 md:p-10 flex flex-col items-center gap-8 border-2 border-brand-dark/5 shadow-xl relative bg-white rounded-3xl group hover:border-brand-orange/20 transition-all">
                <div className="text-center space-y-3">
                  <h3 className="font-display font-bold text-3xl text-brand-dark">Single Syllabus</h3>
                  <div className="text-5xl font-display font-bold text-brand-dark flex flex-col items-center">
                    <span className="text-2xl text-brand-dark/40 line-through mb-1">
                      {currencyConfig.symbol} {currencyConfig.code === 'MYR' ? '29.9' : (currencyConfig.amount + 13).toFixed(1)}
                    </span>
                    <div>
                      {currencyConfig.symbol} {currencyConfig.amount}
                      <span className="text-lg font-normal opacity-40">/mo</span>
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-2">
                  <label className="text-xs font-bold text-brand-dark/40 uppercase">Choose Your Syllabus</label>
                  <select
                    className="w-full p-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-brand-orange/20 outline-none"
                    onChange={(e) => setSelectedSubscriptionSyllabus(e.target.value as Syllabus)}
                    value={selectedSubscriptionSyllabus || ''}
                  >
                    <option value="" disabled>Select Syllabus...</option>
                    {getSyllabusesByCountry(detectedCountry).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <ul className="space-y-5 w-full flex-1">
                  <li className="flex items-start gap-3 text-sm font-bold text-brand-dark/80 bg-brand-orange/5 p-4 rounded-xl border border-brand-orange/10">
                    <CheckCircle2 size={20} className="text-brand-orange shrink-0" />
                    <span>Unlimited Question & Answer</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-medium text-brand-dark/60">
                    <CheckCircle2 size={18} className="text-brand-green shrink-0" />
                    <span>One Selected Syllabus</span>
                  </li>
                </ul>

                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={() => handleSubscribe('month', 'single', selectedSubscriptionSyllabus)}
                  disabled={authLoading || user?.isSubscribed}
                  className="bg-brand-orange hover:bg-orange-400 py-6 text-lg shadow-xl shadow-brand-orange/20"
                >
                  {user?.isSubscribed ? 'Active Subscription' : 'Choose Single Plan'}
                </Button>
              </Card>

              {/* All Syllabus Plan */}
              <Card className="p-8 md:p-10 flex flex-col items-center gap-8 border-4 border-brand-orange relative shadow-2xl bg-white rounded-3xl scale-105 z-10 group">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-orange text-white px-6 py-2 rounded-full font-bold text-sm shadow-xl whitespace-nowrap animate-bounce">
                  BEST VALUE · ALL ACCESS
                </div>

                <div className="text-center space-y-3">
                  <h3 className="font-display font-bold text-3xl text-brand-dark">All Syllabus</h3>
                  <div className="text-5xl font-display font-bold text-brand-dark flex flex-col items-center">
                    <span className="text-2xl text-brand-dark/40 line-through mb-1">
                      {currencyConfig.symbol} {currencyConfig.code === 'MYR' ? '39.9' : (currencyConfig.amountAll + 20).toFixed(1)}
                    </span>
                    <div>
                      {currencyConfig.symbol} {currencyConfig.amountAll}
                      <span className="text-lg font-normal opacity-40">/mo</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-5 w-full flex-1">
                  <li className="flex items-start gap-4 text-sm font-bold text-brand-dark/80 px-2">
                    <CheckCircle2 size={18} className="text-brand-green shrink-0" />
                    <span>Unlimited Generate Question & Quiz</span>
                  </li>
                  <li className="flex items-start gap-4 text-sm font-bold text-brand-dark/80 px-2">
                    <CheckCircle2 size={18} className="text-brand-green shrink-0" />
                    <span>All Syllabuses Included</span>
                  </li>
                </ul>

                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={() => handleSubscribe('month', 'all')}
                  disabled={authLoading || user?.isSubscribed}
                  className="bg-brand-orange hover:bg-orange-400 py-6 text-lg shadow-xl shadow-brand-orange/30 group-hover:scale-[1.02] transition-transform"
                >
                  {user?.isSubscribed ? 'Active Subscription' : 'Upgrade to All Access'}
                </Button>
              </Card>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="max-w-4xl mx-auto space-y-8 pt-12">

      {/* Header and Stats Overview */}
      <div className="text-center">
        <div className="relative inline-block mb-4">
          <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 animate-pulse rounded-full"></div>
          <Trophy size={80} className="text-brand-accent relative z-10 mx-auto" />
        </div>
        <h2 className="text-4xl font-display font-bold text-brand-dark">Student Dashboard</h2>
        <p className="text-brand-dark/60 font-medium mb-8">Keep up the great work, {user?.name}!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
        {/* Level Card */}
        <Card className="bg-white/80 p-6 flex items-center gap-4 shadow-sm border border-brand-dark/5 md:col-span-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-blue to-indigo-600 flex items-center justify-center text-white font-display font-bold text-xl shadow-lg shrink-0">
            {stats.level}
          </div>
          <div>
            <p className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Lvl {stats.level}</p>
            <p className="font-bold text-brand-dark truncate">{getLevelTitle(stats.level)}</p>
          </div>
        </Card>
        
        <Card className="p-4 flex items-center gap-3 border shadow-sm bg-white/80">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-brand-orange text-xl"><Zap size={20} fill="#f97316" /></div>
          <div>
            <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Streak</p>
            <p className="font-bold text-brand-dark">{stats.streak} Days</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 border shadow-sm bg-white/80">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 text-xl"><Coins size={20} fill="#ca8a04" /></div>
          <div>
            <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Coins</p>
            <p className="font-bold text-brand-dark">{stats.coins}</p>
          </div>
        </Card>
      </div>

      {/* EXP bar simplified */}
      <div className="px-1 mb-8">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Experience Progress</span>
          <span className="text-[10px] font-black text-brand-blue italic">{xpIntoLevel}/{xpToNextLevel} XP</span>
        </div>
        <div className="h-2 bg-brand-dark/5 rounded-full overflow-hidden">
          <div className="h-full bg-brand-blue transition-all duration-1000" style={{ width: `${expPercent}%` }} />
        </div>
      </div>

      {/* Core Objective: Study Plan / Active Roadmap */}
      <Card className="p-8 border-slate-200 bg-white shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden relative border-2 ring-4 ring-slate-50">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue">
              <Calendar size={28} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-2xl tracking-tight">Active Roadmap</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Daily Learning Path</p>
            </div>
          </div>
          {currentStudyPlan && (
            <button 
              onClick={() => navigate('/study-progress')}
              className="px-4 py-2 rounded-xl bg-slate-50 text-slate-600 hover:text-brand-blue hover:bg-brand-blue/5 transition-all text-xs font-bold border border-slate-100 flex items-center gap-2"
            >
              Full Plan <ChevronRight size={16} />
            </button>
          )}
        </div>

        {!currentStudyPlan ? (
          <div className="flex flex-col items-center justify-center text-center py-16 space-y-6 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue animate-float">
              <Plus size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Ready to start your journey?</h3>
              <p className="text-slate-400 font-medium max-w-[280px] mx-auto">Create a personalized study plan to track and master your daily missions.</p>
            </div>
            <Button size="lg" variant="primary" onClick={() => navigate('/study-plan')} className="rounded-2xl font-black bg-brand-blue shadow-xl shadow-brand-blue/30 px-10 py-6 transform hover:scale-105 transition-all">
              <Plus size={20} className="mr-2" /> CREATE NEW PLAN
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-4 space-y-4">
               <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-center">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Current Progress</p>
                  <p className="text-4xl font-black text-emerald-700 mb-2">{Math.round((currentStudyPlan.tasks.filter((t: any) => t.isCompleted).length / currentStudyPlan.tasks.length) * 100)}%</p>
                  <div className="w-full h-2 bg-emerald-200/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 transition-all duration-1000" 
                      style={{ width: `${(currentStudyPlan.tasks.filter((t: any) => t.isCompleted).length / currentStudyPlan.tasks.length) * 100}%` }} 
                    />
                  </div>
               </div>
            </div>
            
            <div className="md:col-span-8 space-y-4">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Today's Priority Missions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentStudyPlan.tasks.filter((t: any) => !t.isCompleted).slice(0, 2).map((task: any) => (
                  <div key={task.id} className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100 flex flex-col justify-between transition-all hover:border-brand-blue/30 group bg-white shadow-sm hover:shadow-md">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">{task.day}</span>
                      </div>
                      <p className="font-bold text-slate-800 text-sm leading-snug group-hover:text-brand-blue transition-colors line-clamp-2 h-10">{task.title}</p>
                    </div>
                    <Button 
                      fullWidth
                      size="sm" 
                      className="h-10 text-xs font-black bg-brand-blue text-white rounded-xl shadow-md shadow-brand-blue/10 group-hover:bg-brand-blue/90"
                      onClick={() => {
                        const params = new URLSearchParams({
                            mode: 'AI',
                            subject: currentStudyPlan.subject,
                            grade: currentStudyPlan.grade,
                            syllabus: currentStudyPlan.syllabus,
                            topic: task.topicSearch,
                            autoStart: 'true'
                        });
                        navigate(`/practice?${params.toString()}`);
                      }}
                    >
                      EXECUTE
                    </Button>
                  </div>
                ))}
                {currentStudyPlan.tasks.filter((t: any) => !t.isCompleted).length === 0 && (
                  <div className="sm:col-span-2 p-10 rounded-[2rem] bg-emerald-50 border-2 border-dashed border-emerald-200 text-center">
                    <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">Mastery Achieved for Today! ✨</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </Card>

      {/* Resume Session UI */}
      {activeSession && (
        <div className="p-6 bg-gradient-to-br from-brand-blue/10 via-brand-blue/5 to-white border-2 border-brand-blue/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-pop-in relative overflow-hidden group shadow-2xl shadow-brand-blue/10 mb-8 mt-2">
          {/* Animated background element */}
          <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none group-hover:scale-125 group-hover:rotate-12 transition-all duration-700">
            <Rocket size={160} className="text-brand-blue" />
          </div>
          
          <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
            <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/30 flex-shrink-0 animate-float">
              <Rocket size={32} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-brand-blue text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">In Progress</span>
                <p className="font-display font-bold text-brand-dark text-2xl leading-tight">Your Adventure Awaits!</p>
              </div>
              <p className="text-brand-dark/60 font-medium">
                {activeSession?.subject} • {activeSession?.grade} • <span className="text-brand-blue font-bold">Question {(activeSession?.currentIndex || 0) + 1}</span> of {activeSession?.questions?.length || 0}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto relative z-10">
            <button 
              onClick={() => {
                if(window.confirm("Discard this quest? Your progress will be lost.")) {
                  localStorage.removeItem('quest_active_session');
                  setActiveSession(null);
                }
              }}
              className="flex-1 md:flex-none text-sm font-bold text-brand-dark/30 hover:text-red-500 transition-colors py-3 px-6 hover:bg-red-50 rounded-xl"
            >
              Discard
            </button>
            <Button 
              size="lg"
              className="flex-1 md:flex-none shadow-xl shadow-brand-blue/30 bg-brand-blue hover:bg-brand-blue/90 transform hover:scale-105 transition-all py-6 md:py-4 px-8 animate-pulse-glow"
              onClick={() => {
                setQuestions(activeSession.questions);
                setSelectedSubject(activeSession.subject);
                setSelectedGrade(activeSession.grade);
                setSelectedSyllabus(activeSession.syllabus);
                setSelectedTopic(activeSession.topic);
                setGameMode(activeSession.gameMode);
                navigate('/practice/session');
              }}
            >
              Continue Quest <ArrowRight size={20} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Secondary Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20 mt-4">
        {stats.badges.length > 0 && (
          <div className="bg-white/50 p-6 rounded-3xl col-span-1 md:col-span-2">
            <h3 className="font-bold text-xl mb-4 text-center">Your Badges</h3>
            <div className="flex flex-wrap gap-4 justify-center">
              {stats.badges.map((badge, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl shadow-sm flex items-center gap-2 border border-brand-dark/5 px-4">
                  <span className="text-2xl">🏅</span>
                  <span className="font-bold text-sm">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="md:col-span-2 hidden">
        </div>

        <div className="space-y-6 md:col-span-2">
          <DataAnalysis token={localStorage.getItem('quest_token') || ''} />
        </div>
      </div>

      {/* Global Dashboard Actions - Repositioned to Bottom per User Request */}
      <div className="flex flex-wrap items-center justify-center gap-4 py-8 border-t border-brand-dark/5 mt-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          className="rounded-2xl px-10 py-4 font-bold border-brand-dark/10 text-brand-dark/60 hover:text-brand-dark hover:bg-slate-50 transition-all flex items-center gap-2 bg-white/50 backdrop-blur-sm"
        >
          <Home size={20} /> Home
        </Button>
        <Button 
          variant="primary" 
          onClick={handleNewQuest}
          className="rounded-2xl px-10 py-4 font-bold bg-brand-blue shadow-xl shadow-brand-blue/20 flex items-center gap-2 transform active:scale-95 transition-all"
        >
          <Plus size={20} /> New Quest
        </Button>
      </div>
    </div>
  );


  const renderGameSetup = () => (
    <div className="max-w-4xl mx-auto pb-28 md:pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> Back
        </Button>
        <h2 className="text-2xl md:text-3xl font-display font-bold text-brand-dark">Setup Your Quest</h2>
      </div>

      <Card className="p-4 md:p-8">
        {/* Mode Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 border-b border-brand-dark/10 pb-6">
          <button
            onClick={() => setGameMode('AI')}
            className={`py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm ${gameMode === 'AI' ? 'bg-brand-blue text-white shadow-lg' : 'bg-brand-dark/5 hover:bg-brand-dark/10'}`}
          >
            <Sparkles size={16} /> AI Quest
          </button>
          <button
            disabled
            className="py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 relative"
          >
            <Lock size={16} /> Past Year
            <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Soon</span>
          </button>
          <button
            onClick={() => setGameMode('CUSTOM')}
            className={`py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm ${gameMode === 'CUSTOM' ? 'bg-brand-orange text-white shadow-lg' : 'bg-brand-dark/5 hover:bg-brand-dark/10'}`}
          >
            <GraduationCap size={16} /> Custom
          </button>
          <button
            onClick={() => navigate('/study-plan')}
            className="py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm bg-brand-dark/5 hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-200 text-indigo-600 hover:shadow-md hover:-translate-y-0.5"
          >
            <Calendar size={16} className="text-indigo-500" /> Study Plan
          </button>
        </div>

        {gameMode === 'AI' && (
          <>
            {/* Step 1: Syllabus Selection */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-brand-dark/60 uppercase tracking-wider mb-3">1. Select Syllabus</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {getSyllabusesByCountry(detectedCountry).map((syll) => {
                  const isPro = user?.isSubscribed;
                  const subLevel = (user as any)?.subscriptionLevel;
                  const subSyllabus = (user as any)?.subscribedSyllabus;
                  const isLocked = isPro && subLevel === 'single' && subSyllabus && subSyllabus !== syll;

                  return (
                    <button
                      key={syll}
                      onClick={() => !isLocked && setSelectedSyllabus(syll)}
                      disabled={isLocked}
                      className={`p-3.5 rounded-xl border-2 font-bold text-left transition-all flex items-center justify-between gap-3 text-sm ${selectedSyllabus === syll ? 'border-brand-accent bg-orange-50 text-brand-accent shadow-sm' : 'border-brand-dark/10 bg-white/50 hover:bg-white hover:border-brand-dark/20'} ${isLocked ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ScrollText size={18} className={selectedSyllabus === syll ? 'text-brand-accent' : 'text-brand-dark/40'} />
                        <span className="leading-tight">{syll}</span>
                      </div>
                      {isLocked && (
                        <div className="bg-brand-orange/10 text-brand-orange text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                          <Lock size={10} /> LOCKED
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Grade Selection */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-brand-dark/60 uppercase tracking-wider mb-3">2. Select Grade / Level</label>
              <div className="space-y-4">
                {selectedSyllabus && (() => {
                  const grades = getGradesBySyllabus(selectedSyllabus);
                  return (
                    <>
                      {grades.primary.length > 0 && (
                        <div>
                          <span className="text-xs font-bold text-brand-dark/40 mb-2 block uppercase">Primary / Elementary</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            {grades.primary.map((grade) => (
                              <button
                                key={grade}
                                onClick={() => setSelectedGrade(grade)}
                                className={`p-2 py-3 rounded-xl border-2 font-bold text-xs transition-all ${selectedGrade === grade ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-transparent bg-brand-dark/5 hover:bg-brand-dark/10'}`}
                              >
                                {grade}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {grades.secondary.length > 0 && (
                        <div>
                          <span className="text-xs font-bold text-brand-dark/40 mb-2 block uppercase">Secondary / Middle School</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                            {grades.secondary.map((grade) => (
                              <button
                                key={grade}
                                onClick={() => setSelectedGrade(grade)}
                                className={`p-2 py-3 rounded-xl border-2 font-bold text-xs transition-all ${selectedGrade === grade ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-transparent bg-brand-dark/5 hover:bg-brand-dark/10'}`}
                              >
                                {grade}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {grades.advanced && grades.advanced.length > 0 && (
                        <div>
                          <span className="text-xs font-bold text-brand-dark/40 mb-2 block uppercase">Advanced / Pre-U</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                            {grades.advanced.map((grade) => (
                              <button
                                key={grade}
                                onClick={() => setSelectedGrade(grade)}
                                className={`p-2 py-3 rounded-xl border-2 font-bold text-xs transition-all ${selectedGrade === grade ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-transparent bg-brand-dark/5 hover:bg-brand-dark/10'}`}
                              >
                                {grade}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Step 3: Subject Selection */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-brand-dark/60 uppercase tracking-wider mb-3">3. Choose Subject</label>
              {!selectedGrade ? (
                <div className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-brand-dark/20 rounded-xl text-brand-dark/40">
                  <BookOpen size={24} className="mb-1" />
                  <p className="text-sm">Select a grade first to see available subjects</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {getSubjectsByGrade(selectedGrade, selectedSyllabus).map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubject(sub.id)}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${selectedSubject === sub.id ? 'border-brand-blue bg-white shadow-md scale-105' : 'border-transparent bg-brand-dark/5 hover:bg-brand-dark/10'}`}
                    >
                      <div className={`${sub.color} w-10 h-10 flex items-center justify-center rounded-full text-lg shadow-sm`}>{sub.icon}</div>
                      <span className="font-bold text-xs text-center leading-tight">{sub.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 4: Topic Selection */}
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-bold text-brand-dark/60 uppercase tracking-wider">4. Select Topic</label>
              {selectedSubject && selectedGrade && (
                <button 
                  onClick={() => fetchSyllabus(true)} 
                  className={`text-xs text-brand-blue flex items-center gap-1 hover:underline disabled:opacity-50`}
                  disabled={loadingTopics}
                >
                  <RefreshCw size={12} className={loadingTopics ? 'animate-spin' : ''} /> Refresh Topics
                </button>
              )}
            </div>

            <div className="min-h-[120px] mb-8">
              {!selectedSubject || !selectedSyllabus || !selectedGrade ? (
                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-brand-dark/20 rounded-xl text-brand-dark/40">
                  <BookOpen size={32} className="mb-2" />
                  <p>Select syllabus, grade and subject first</p>
                </div>
              ) : loadingTopics ? (
                <div className="flex flex-col items-center justify-center h-32 space-y-3">
                  <Loader2 className="animate-spin text-brand-blue" size={32} />
                  <p className="text-sm font-bold text-brand-blue animate-pulse">Scanning {selectedSyllabus} Syllabus...</p>
                </div>
              ) : topics.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {topics.map((topic, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedTopic(topic)}
                      className={`p-3 text-left rounded-xl border-2 font-bold transition-all text-sm leading-snug ${selectedTopic === topic ? 'border-brand-accent bg-orange-50 text-brand-accent shadow-sm' : 'border-brand-dark/10 bg-white/50 hover:bg-white hover:border-brand-dark/20'}`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-brand-dark/50">
                  <p>No topics found. Try refreshing.</p>
                </div>
              )}
            </div>
          </>
        )}

        {gameMode === 'PAST_YEAR' && (
          <div className="mb-8">
            <PastYearSelector
              selectedSyllabus={selectedSyllabus}
              selectedGrade={selectedGrade}
              selectedSubject={selectedSubject}
              selectedYear={selectedYear}
              onSyllabusSelect={setSelectedSyllabus}
              onGradeSelect={setSelectedGrade}
              onSubjectSelect={setSelectedSubject}
              onYearSelect={setSelectedYear}
              getGradesBySyllabus={getGradesBySyllabus}
              getSubjectsByGrade={getSubjectsByGrade}
            />
          </div>
        )}

        {gameMode === 'CUSTOM' && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-bold text-brand-dark/60 uppercase tracking-wider">Select a Custom Quest</label>
              {user && (
                <button
                  onClick={() => navigate('/teacher')}
                  className="text-xs font-bold text-brand-orange flex items-center gap-1 hover:underline bg-brand-orange/5 px-3 py-1.5 rounded-lg border border-brand-orange/20 transition-all hover:bg-brand-orange/10"
                >
                  <Plus size={14} /> Manage / Create Quests
                </button>
              )}
            </div>

            {customQuests.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed border-brand-dark/10 rounded-xl">
                <p className="text-brand-dark/60 mb-4">No custom quests found.</p>
                {user ? (
                  <p className="text-sm text-brand-dark/40 italic">Create your quests in the Teacher Dashboard</p>
                ) : (
                  <p className="text-sm text-brand-dark/40 italic">Ask your teacher or parent to create one!</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customQuests.map((quest) => (
                  <button
                    key={quest.id}
                    onClick={() => setSelectedCustomQuest(quest)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${selectedCustomQuest?.id === quest.id ? 'border-brand-orange bg-orange-50 ring-2 ring-brand-orange/20' : 'border-brand-dark/10 bg-white hover:border-brand-orange/50'}`}
                  >
                    <div className="font-bold text-lg mb-1">{quest.title}</div>
                    <div className="text-xs font-bold text-brand-dark/50">
                      {quest.questions.length} Questions • {new Date(quest.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Desktop start button (inside card) */}
        <div className="hidden md:block">
          <Button
            fullWidth
            size="lg"
            disabled={
              gameMode === 'AI' ? (!selectedSubject || !selectedTopic || !selectedSyllabus || !selectedGrade || loadingGame) :
                gameMode === 'PAST_YEAR' ? (!selectedSubject || !selectedYear || !selectedSyllabus || !selectedGrade || loadingGame) :
                  (!selectedCustomQuest)
            }
            onClick={handleStartGame}
          >
            {loadingGame ? <><Loader2 className="animate-spin" /> Preparing Quest...</> : 'Start Adventure'}
          </Button>
        </div>
      </Card>

      {/* Mobile sticky start button */}
      <div className="md:hidden fixed bottom-20 left-0 right-0 px-4 z-40">
        <Button
          fullWidth
          size="lg"
          disabled={
            gameMode === 'AI' ? (!selectedSubject || !selectedTopic || !selectedSyllabus || !selectedGrade || loadingGame) :
              gameMode === 'PAST_YEAR' ? (!selectedSubject || !selectedYear || !selectedSyllabus || !selectedGrade || loadingGame) :
                (!selectedCustomQuest)
          }
          onClick={handleStartGame}
          className="shadow-2xl shadow-brand-blue/30 py-5 text-base"
        >
          {loadingGame ? <><Loader2 className="animate-spin" /> Preparing Quest...</> : '🚀 Start Adventure'}
        </Button>
      </div>
    </div>
  );

  const renderGameSession = () => (
    <GameSession
      questions={questions}
      onComplete={handleGameComplete}
      onExit={() => {
        // Clear session on manual exit to avoid confusing "Resume" later if they explicitly quit
        localStorage.removeItem('quest_active_session');
        setActiveSession(null);
        navigate('/');
      }}
      initialState={activeSession}
      onStateChange={(state) => {
        // Save session state to localStorage
        const sessionData = {
          ...state,
          questions,
          subject: selectedSubject,
          grade: selectedGrade,
          syllabus: selectedSyllabus,
          topic: selectedTopic,
          gameMode,
          timestamp: Date.now()
        };
        localStorage.setItem('quest_active_session', JSON.stringify(sessionData));
      }}
    />
  );

  const renderRewards = () => (
    <RewardsShop
      token={localStorage.getItem('quest_token') || ''}
      userCoins={stats.coins || 0}
      onCoinsUpdated={(newCoins) => setStats(prev => ({ ...prev, coins: newCoins }))}
    />
  );

  const renderAdmin = () => (
    user?.isAdmin ? (
      <AdminDashboard token={localStorage.getItem('quest_token') || ''} />
    ) : (
      <AdminLogin />
    )
  );

  const renderTeacherDashboard = () => (
    <TeacherDashboard
      onBack={() => navigate('/')}
      onViewPricing={() => navigate('/pricing')}
    />
  );
  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-brand-orange selection:text-white flex flex-col">
      {/* Level Up Overlay */}
      {showLevelUp && levelUpData && <LevelUpOverlay />}
      {/* Background Decorative Blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-orange/20 rounded-full blur-3xl -z-10 animate-float" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-blue/10 rounded-full blur-3xl -z-10" />

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden fixed top-14 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-b border-brand-dark/10 shadow-xl animate-menu-slide-down">
          <div className="flex flex-col p-4 gap-1">
            <button onClick={() => { setShowMobileMenu(false); if (user && (user.role === 'student' || user.role === 'teacher') && !user.isAdmin) { handleNewQuest(); } else { navigate('/'); setTimeout(() => document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' }), 200); } }} className="text-left px-4 py-3 rounded-xl font-bold text-brand-dark/70 hover:bg-brand-blue/5 hover:text-brand-blue transition-all text-sm">{user && (user.role === 'student' || user.role === 'teacher') && !user.isAdmin ? '🚀 New Quest' : '📚 Courses'}</button>
            <button onClick={() => { setShowMobileMenu(false); if (!user) setShowLoginModal(true); else navigate(user?.isAdmin ? '/admin' : user?.role === 'teacher' ? '/teacher' : '/dashboard'); }} className="text-left px-4 py-3 rounded-xl font-bold text-brand-dark/70 hover:bg-brand-blue/5 hover:text-brand-blue transition-all text-sm">📊 Dashboard</button>
            <button onClick={() => { setShowMobileMenu(false); if (!user) setShowLoginModal(true); else navigate('/classrooms'); }} className="text-left px-4 py-3 rounded-xl font-bold text-brand-dark/70 hover:bg-brand-blue/5 hover:text-brand-blue transition-all text-sm">🏫 Classrooms</button>
            <button onClick={() => { setShowMobileMenu(false); navigate('/leaderboard'); }} className="text-left px-4 py-3 rounded-xl font-bold text-brand-dark/70 hover:bg-brand-blue/5 hover:text-brand-blue transition-all text-sm">🏆 Leaderboard</button>
            {user?.isSubscribed && (
              <button onClick={() => { setShowMobileMenu(false); navigate('/rewards'); }} className="text-left px-4 py-3 rounded-xl font-bold text-brand-orange hover:bg-brand-orange/5 transition-all text-sm">🛍️ Rewards</button>
            )}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="p-3 md:p-4 lg:p-5 flex justify-between items-center max-w-6xl mx-auto z-50 relative">
        <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
          <BookOpen className="text-brand-orange w-5 h-5 md:w-6 md:h-6" />
          <span className="font-display font-bold text-base md:text-lg tracking-tight">Akshara Music Hub</span>
        </div>

        <div className="hidden md:flex items-center gap-4 lg:gap-8 flex-1 justify-center px-4">
          <button onClick={() => { if (user && (user.role === 'student' || user.role === 'teacher') && !user.isAdmin) { handleNewQuest(); } else { navigate('/'); setTimeout(() => document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' }), 100); } }} className="font-bold text-brand-dark/60 hover:text-brand-blue transition-colors text-xs lg:text-sm whitespace-nowrap">{user && (user.role === 'student' || user.role === 'teacher') && !user.isAdmin ? 'New Quest' : 'Courses'}</button>
          <button onClick={() => { if (!user) setShowLoginModal(true); else navigate(user?.isAdmin ? '/admin' : user?.role === 'teacher' ? '/teacher' : '/dashboard'); }} className="font-bold text-brand-dark/60 hover:text-brand-blue transition-colors text-xs lg:text-sm whitespace-nowrap">Dashboard</button>
          <button onClick={() => { if (!user) setShowLoginModal(true); else navigate('/classrooms'); }} className="font-bold text-brand-dark/60 hover:text-brand-blue transition-colors text-xs lg:text-sm whitespace-nowrap">Classrooms</button>
          <button onClick={() => { navigate('/leaderboard'); }} className="font-bold text-brand-dark/60 hover:text-brand-blue transition-colors text-xs lg:text-sm whitespace-nowrap">Leaderboard</button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Hamburger button - mobile only */}
          <button
            className="md:hidden flex flex-col items-center justify-center w-9 h-9 rounded-xl bg-brand-dark/5 hover:bg-brand-dark/10 transition-all gap-1.5 p-2"
            onClick={() => setShowMobileMenu(prev => !prev)}
            aria-label="Menu"
          >
            <span className={`block w-5 h-0.5 bg-brand-dark rounded-full transition-all ${showMobileMenu ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-brand-dark rounded-full transition-all ${showMobileMenu ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-brand-dark rounded-full transition-all ${showMobileMenu ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>

          {!user ? (
            <Button size="sm" onClick={() => setShowLoginModal(true)}>Log In</Button>
          ) : (
            <>
              {/* Rewards button - subscribers only */}
              {user?.isSubscribed && (
                <button
                  onClick={() => { navigate('/rewards'); setShowProfileMenu(false); }}
                  className="hidden md:flex items-center gap-1.5 bg-brand-orange/10 hover:bg-brand-orange/20 border border-brand-orange/20 text-brand-orange px-3 py-1 rounded-full font-bold text-sm transition-all"
                >
                  🛍️ Rewards
                </button>
              )}
              {/* Show Coins in Navbar */}
              <div className="hidden items-center gap-1 bg-yellow-100/80 px-3 py-1 rounded-full border border-yellow-200 text-yellow-700 sm:flex">
                <Coins className="w-4 h-4 fill-yellow-500" />
                <span className="font-bold text-sm">{stats.coins || 0}</span>
              </div>

              <div className="flex items-center gap-2 bg-white/60 backdrop-blur px-3 py-1 rounded-full border border-white/50">
                <Star className="w-4 h-4 text-brand-accent fill-brand-accent" />
                <span className="font-bold text-sm">{stats.xp} XP</span>
              </div>
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-full bg-brand-dark text-white flex items-center justify-center font-bold overflow-hidden border-2 border-white ring-2 ring-black/5 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  title="Profile Menu"
                >
                  {user.avatar ? <img src={user.avatar} alt="avatar" /> : user.name.charAt(0)}
                </div>

                {showProfileMenu && (
                  <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl border border-brand-dark/10 overflow-hidden animate-pop-in z-50">
                    <div className="p-4 border-b border-brand-dark/5 bg-brand-dark/5">
                      <p className="font-bold text-brand-dark truncate">{user.name}</p>
                      <p className="text-xs text-brand-dark/50 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (user?.isAdmin) navigate('/admin');
                        else if (user?.role === 'teacher') navigate('/teacher');
                        else navigate('/dashboard');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-brand-blue/5 text-sm font-bold text-brand-dark/70 hover:text-brand-blue flex items-center gap-2 transition-colors"
                    >
                      <UserIcon size={16} />
                      {user?.isAdmin ? 'Admin Dashboard' : user?.role === 'teacher' ? 'Teacher Dashboard' : 'My Dashboard'}
                    </button>
                    <button
                      onClick={() => { logout(); setShowProfileMenu(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-red-50 text-sm font-bold text-red-500 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pb-20 relative z-10">
        {showLoginModal && <LoginModal
          onClose={() => setShowLoginModal(false)}
        />}
        {showLimitModal && <LimitReachedModal />}
        {showQuotaModal && <AiQuotaModal />}

        <Routes>
          <Route path="/" element={renderHome()} />
          <Route path="/pricing" element={renderPricing()} />

          {/* Student dashboard — redirect teachers/admins to their own dashboards */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              {user?.isAdmin
                ? <Navigate to="/admin" replace />
                : user?.role === 'teacher'
                  ? <Navigate to="/teacher" replace />
                  : renderDashboard()
              }
            </ProtectedRoute>
          } />

          <Route path="/leaderboard" element={<div className="pt-8"><Leaderboard /></div>} />
          <Route path="/rewards" element={
            <ProtectedRoute>
              {renderRewards()}
            </ProtectedRoute>
          } />

          {/* Admin-only routes */}
          <Route path="/admin/*" element={<ProtectedRoute requiredRole="admin">{renderAdmin()}</ProtectedRoute>} />

          {/* Student practice routes */}
          <Route path="/practice" element={<ProtectedRoute>{renderGameSetup()}</ProtectedRoute>} />
          <Route path="/practice/session" element={<ProtectedRoute>{renderGameSession()}</ProtectedRoute>} />
          <Route path="/study-plan" element={<ProtectedRoute><div className="pt-8"><StudyPlanGenerator /></div></ProtectedRoute>} />
          <Route path="/study-progress" element={<ProtectedRoute><div className="pt-8"><StudyProgress /></div></ProtectedRoute>} />

          {/* Teacher-only route */}
          <Route path="/teacher" element={<ProtectedRoute requiredRole="teacher">{renderTeacherDashboard()}</ProtectedRoute>} />

          <Route path="/classrooms" element={
            <ProtectedRoute>
              <div className="max-w-4xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-4xl font-display font-bold text-brand-dark mb-8 text-center">Classrooms</h2>
                {user?.role === 'teacher' ? <ClassroomManager /> : <StudentClassrooms />}
              </div>
            </ProtectedRoute>
          } />

          <Route path="*" element={renderHome()} />
        </Routes>
      </main>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-brand-dark/10 safe-area-inset-bottom z-50">
        <div className="flex justify-around items-center px-2 pt-2 pb-3">
          {/* Home */}
          <button
            onClick={() => navigate('/')}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all ${location.pathname === '/' ? 'bg-brand-blue/10 text-brand-blue' : 'text-brand-dark/40 hover:text-brand-dark/70'
              }`}
          >
            <Home size={22} strokeWidth={location.pathname === '/' ? 2.5 : 1.8} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Home</span>
          </button>

          {/* Practice – center hero button */}
          <button
            onClick={() => { if (!user) { setShowLoginModal(true); } else { navigate('/practice'); } }}
            className="flex flex-col items-center gap-1 -mt-6"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all relative ${location.pathname.startsWith('/practice')
              ? 'bg-brand-orange text-white shadow-brand-orange/40 scale-105'
              : 'bg-gradient-to-br from-brand-orange to-orange-400 text-white shadow-brand-orange/30'
              }`}>
              <Sparkles size={26} strokeWidth={2} />
              {activeSession && !location.pathname.startsWith('/practice/session') && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-ping" />
              )}
              {activeSession && !location.pathname.startsWith('/practice/session') && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full" />
              )}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${location.pathname.startsWith('/practice') ? 'text-brand-orange' : 'text-brand-dark/50'
              }`}>Practice</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => {
              if (!user) { setShowLoginModal(true); }
              else if (user.isAdmin) { navigate('/admin'); }
              else if (user.role === 'teacher') { navigate('/teacher'); }
              else { navigate('/dashboard'); }
            }}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all ${
              (location.pathname === '/dashboard' || location.pathname === '/teacher' || location.pathname.startsWith('/admin'))
                ? 'bg-brand-blue/10 text-brand-blue'
                : 'text-brand-dark/40 hover:text-brand-dark/70'
            }`}
          >
            {user ? (
              <div className="w-6 h-6 rounded-full bg-brand-dark text-white flex items-center justify-center font-bold text-xs overflow-hidden">
                {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
            ) : (
              <UserIcon size={22} strokeWidth={1.8} />
            )}
            <span className="text-[10px] font-bold uppercase tracking-wide">Profile</span>
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}