import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Subject, Syllabus, GradeLevel } from '../types';
import { geminiService, StudyPlanResponse } from '../services/geminiService';
import { Button } from './Button';
import { Card } from './Card';
import { 
    Calendar, 
    Loader2, 
    Sparkles, 
    Target, 
    CheckCircle2, 
    ArrowLeft, 
    ChevronRight,
    GraduationCap,
    Clock,
    BookOpen
} from 'lucide-react';

export const StudyPlanGenerator: React.FC = () => {
    const navigate = useNavigate();
    const [subjects, setSubjects] = useState<string[]>([]);
    const [grade, setGrade] = useState<string>('');
    const [syllabus, setSyllabus] = useState<string>('');
    const [timeframe, setTimeframe] = useState<string>('4 Weeks');
    const [hoursPerDay] = useState<string>('2');
    const [goals, setGoals] = useState<string>('');

    const [studyPlan, setStudyPlan] = useState<StudyPlanResponse | null>(null);
    const [generatedId, setGeneratedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleSubject = (s: string) => {
        setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const handleGenerate = async () => {
        if (subjects.length === 0 || !grade || !syllabus || !timeframe) {
            setError('Please select at least one subject, a grade, a syllabus and a duration.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const plan = await geminiService.generateStudyPlan({
                subjects,
                grade,
                syllabus,
                timeframe,
                hoursPerDay,
                goals
            });
            
            setStudyPlan(plan);
            if (plan && (plan as any).id) {
                setGeneratedId((plan as any).id);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate study plan. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setStudyPlan(null);
        setGeneratedId(null);
        setGoals('');
        setSubjects([]);
    };

    const handleContinue = () => {
        if (generatedId) {
            navigate(`/study-progress?id=${generatedId}`);
        } else {
            navigate('/study-progress');
        }
    };

    if (studyPlan) {
        return (
            <div className="max-w-xl mx-auto py-20 px-4">
                <Card className="p-10 text-center space-y-8 border-slate-200 shadow-sm rounded-3xl bg-white">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={48} />
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Plan Ready!</h2>
                        <p className="text-slate-500 text-lg">Your study roadmap for <b>{subjects.join(', ')}</b> has been generated.</p>
                    </div>
                    <div className="pt-4 space-y-3">
                        <Button 
                            onClick={handleContinue} 
                            size="lg" 
                            className="w-full rounded-2xl py-6 text-lg font-bold bg-brand-blue"
                        >
                            Open Roadmap
                        </Button>
                        <button 
                            onClick={handleReset}
                            className="text-slate-400 font-semibold text-sm hover:text-slate-600 transition-colors"
                        >
                            Create Another Plan
                        </button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 hover:text-slate-900 bg-white border border-slate-200 shadow-sm transition-all"
                    >
                        <ArrowLeft size={18} />
                        <span className="text-sm font-bold">Back</span>
                    </button>
                    <div className="px-4 py-2 bg-brand-blue/10 border border-brand-blue/20 rounded-xl text-[10px] font-bold text-brand-blue uppercase tracking-widest">
                        Study Assistant
                    </div>
                </div>

                <div className="space-y-2 text-center md:text-left">
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Create Study Plan</h1>
                    <p className="text-slate-500 font-medium">Define your goals and we'll map out a custom syllabus for you.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2 p-8 border-slate-200 shadow-sm rounded-3xl bg-white space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <BookOpen size={14} className="text-brand-blue" /> Exam Syllabus
                                </label>
                                <select
                                    value={syllabus}
                                    onChange={(e) => setSyllabus(e.target.value)}
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-brand-blue outline-none transition-all font-bold text-slate-700 bg-slate-50/50"
                                >
                                    <option value="" disabled>Select Syllabus</option>
                                    {Object.values(Syllabus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <GraduationCap size={14} className="text-brand-blue" /> Grade Level
                                </label>
                                <select
                                    value={grade}
                                    onChange={(e) => setGrade(e.target.value)}
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-brand-blue outline-none transition-all font-bold text-slate-700 bg-slate-50/50"
                                >
                                    <option value="" disabled>Select Grade</option>
                                    {Object.values(GradeLevel).map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            <div className="space-y-4 md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Target size={14} className="text-brand-blue" /> Focus Subjects <span className="text-slate-300 normal-case tracking-normal">(select one or more)</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {Object.values(Subject).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => toggleSubject(s)}
                                            className={`p-4 rounded-2xl border-2 font-bold text-xs transition-all ${
                                                subjects.includes(s)
                                                ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                                                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600'
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                size="lg"
                                fullWidth
                                onClick={handleGenerate}
                                disabled={loading || subjects.length === 0 || !grade || !syllabus}
                                className="py-6 text-xl font-bold rounded-2xl bg-brand-blue transition-all"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-3">
                                        <Loader2 className="animate-spin" size={24} /> Generating Plan...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Sparkles size={20} /> Create Roadmap
                                    </span>
                                )}
                            </Button>
                            {error && (
                                <p className="mt-4 text-center text-red-500 font-bold text-xs uppercase tracking-widest bg-red-50 p-3 rounded-xl border border-red-100">
                                    Error: {error}
                                </p>
                            )}
                        </div>
                    </Card>

                    <Card className="p-8 border-slate-200 shadow-sm rounded-3xl bg-white space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Clock size={14} className="text-brand-blue" /> Duration
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                                {['1 Week', '4 Weeks', '8 Weeks'].map(t => (
                                    <button 
                                        key={t}
                                        onClick={() => setTimeframe(t)}
                                        className={`p-4 rounded-xl text-sm font-bold transition-all border-2 text-left ${timeframe === t ? 'bg-brand-blue/5 border-brand-blue text-brand-blue' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Specific Goals</label>
                            <textarea 
                                value={goals}
                                onChange={(e) => setGoals(e.target.value)}
                                placeholder="E.g. Focus on Algebra..."
                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-brand-blue focus:bg-white h-32 resize-none transition-all"
                            />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
