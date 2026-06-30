export enum Subject {
  BAHASA_MELAYU = 'Bahasa Melayu',
  ENGLISH = 'English',
  MATH = 'Mathematics',
  SCIENCE = 'Science',
  SEJARAH = 'Sejarah (History)',
  GEOGRAPHY = 'Geografi',
  PENDIDIKAN_ISLAM = 'Pendidikan Islam',
  PENDIDIKAN_MORAL = 'Pendidikan Moral',
  RBT = 'Reka Bentuk & Teknologi (RBT)',
  PHYSICS = 'Physics',
  CHEMISTRY = 'Chemistry',
  BIOLOGY = 'Biology',
  ADD_MATH = 'Additional Mathematics',
  ECONOMICS = 'Economics',
  BUSINESS = 'Business Studies',
  COMPUTER_SCIENCE = 'Computer Science'
}

export enum Syllabus {
  KSSR_KSSM = 'Malaysia National Curriculum',
  MOE_SINGAPORE = 'Singapore National Curriculum',
  IGCSE = 'Cambridge IGCSE',
  UEC = 'Unified Examination Certificate (UEC)',
  IB = 'International Baccalaureate (IB)'
}

export enum GradeLevel {
  STD_1 = 'Standard 1',
  STD_2 = 'Standard 2',
  STD_3 = 'Standard 3',
  STD_4 = 'Standard 4',
  STD_5 = 'Standard 5',
  STD_6 = 'Standard 6',
  FORM_1 = 'Form 1',
  FORM_2 = 'Form 2',
  FORM_3 = 'Form 3',
  FORM_4 = 'Form 4',
  FORM_5 = 'Form 5',
  FORM_6 = 'Form 6 (STPM)',
  // International
  YEAR_1 = 'Year 1',
  YEAR_2 = 'Year 2',
  YEAR_3 = 'Year 3',
  YEAR_4 = 'Year 4',
  YEAR_5 = 'Year 5',
  YEAR_6 = 'Year 6',
  YEAR_7 = 'Year 7',
  YEAR_8 = 'Year 8',
  YEAR_9 = 'Year 9',
  YEAR_10 = 'Year 10',
  YEAR_11 = 'Year 11',
  YEAR_12 = 'Year 12',
  YEAR_13 = 'Year 13',
  // Singapore / Others
  SEC_1 = 'Secondary 1',
  SEC_2 = 'Secondary 2',
  SEC_3 = 'Secondary 3',
  SEC_4 = 'Secondary 4',
  SEC_5 = 'Secondary 5'
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher';
  isSubscribed: boolean;
  subscriptionEndDate?: string | Date;
  subscriptionInterval?: 'month';
  subscriptionLevel?: 'single' | 'all';
  subscribedSyllabus?: string;
  completedQuizzes?: number;
  questsPlayed?: number;
  avatar?: string;
  password?: string;
  isAdmin?: boolean;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  badges: string[];
  completedQuizzes: number;
  questsPlayed?: number;
  isSubscribed: boolean; // Keeping for backward compat, but strictly controlled by Auth
  subscriptionLevel?: 'single' | 'all';
  subscribedSyllabus?: string;
  leaderboardRank: number;
  coins?: number;
  lastLoginDate?: string;
}

export interface GameState {
  questions: Question[];
  currentIndex: number;
  score: number;
  isFinished: boolean;
  isLoading: boolean;
  currentStreak: number;
}

export interface CustomQuest {
  id: string;
  title: string;
  createdAt: number;
  subject: Subject;
  grade: GradeLevel;
  syllabus: Syllabus;
  questions: Question[];
}

export interface ResultEntry {
  id: string;
  userId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  mode: string;
  subject?: string;
  date: string;
  quest?: {
    title: string;
  };
}

export type ViewState = 'HOME' | 'PRICING' | 'GAME_SETUP' | 'GAME_SESSION' | 'DASHBOARD' | 'TEACHER_DASHBOARD' | 'REWARDS' | 'ADMIN' | 'LEADERBOARD';