import React, { useEffect, useState } from 'react';
import { ResultEntry } from '../types';
import { BarChart3, TrendingUp, BookOpen, Target, Loader2, History, Sparkles, ScrollText, FileClock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './Card';

interface DataAnalysisProps {
    token: string;
}

interface SubjectStat {
    subject: string;
    totalQuestions: number;
    correctAnswers: number;
}

// Friendly label + styling for each quiz mode
const MODE_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    AI: { label: 'AI Quest', className: 'bg-brand-blue/10 text-brand-blue', icon: <Sparkles size={11} /> },
    CUSTOM: { label: 'Custom', className: 'bg-purple-100 text-purple-600', icon: <ScrollText size={11} /> },
    PAST_YEAR: { label: 'Past Year', className: 'bg-amber-100 text-amber-600', icon: <FileClock size={11} /> },
};

const getModeMeta = (mode: string) =>
    MODE_META[mode] || { label: mode || 'Quiz', className: 'bg-brand-dark/5 text-brand-dark/50', icon: <BookOpen size={11} /> };

// Format an ISO date string as e.g. "6 Jul 2026"
const formatDate = (value: string): string => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const accuracyColor = (accuracy: number): string =>
    accuracy >= 80 ? 'text-brand-green' : accuracy >= 50 ? 'text-brand-orange' : 'text-red-500';

const HISTORY_PREVIEW_COUNT = 5;

export const DataAnalysis: React.FC<DataAnalysisProps> = ({ token }) => {
    const [results, setResults] = useState<ResultEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAllHistory, setShowAllHistory] = useState(false);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const res = await fetch('/api/results/my-results', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                }
            } catch (error) {
                console.error("Failed to fetch results for analysis:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [token]);

    if (loading) {
        return (
            <Card className="p-8 flex justify-center items-center border-2 border-brand-dark/5 shadow-xl relative overflow-hidden group">
                <Loader2 className="animate-spin text-brand-blue" size={32} />
            </Card>
        );
    }

    if (results.length === 0) {
        return (
            <Card className="p-8 border-2 border-brand-dark/5 shadow-xl relative overflow-hidden">
                <div className="text-center px-4 py-8">
                    <div className="w-16 h-16 bg-brand-dark/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="text-brand-dark/40" size={32} />
                    </div>
                    <h3 className="text-xl font-display font-bold text-brand-dark mb-2">No Data Yet</h3>
                    <p className="text-brand-dark/60 text-sm">
                        Complete some quests to see your performance analysis here!
                    </p>
                </div>
            </Card>
        );
    }

    // Aggregate results by subject
    const subjectStatsMap = results.reduce<Record<string, SubjectStat>>((acc, result) => {
        // If subject is missing, group under 'General' or based on mode
        const subj: string = result.subject || (result.mode === 'CUSTOM' ? 'Custom Quest' : 'General');
        if (!acc[subj]) {
            acc[subj] = { subject: subj, totalQuestions: 0, correctAnswers: 0 };
        }
        acc[subj].totalQuestions += result.totalQuestions;
        acc[subj].correctAnswers += result.correctAnswers;
        return acc;
    }, {});

    // Sort by total questions descending
    const subjectStats: SubjectStat[] = Object.values(subjectStatsMap);
    subjectStats.sort((a, b) => b.totalQuestions - a.totalQuestions);

    // Overall totals
    const totalQuestionsAll = subjectStats.reduce((sum, stat) => sum + stat.totalQuestions, 0);
    const totalCorrectAll = subjectStats.reduce((sum, stat) => sum + stat.correctAnswers, 0);
    const overallAccuracy = totalQuestionsAll > 0 ? Math.round((totalCorrectAll / totalQuestionsAll) * 100) : 0;

    return (
        <Card className="p-6 md:p-8 border-2 border-brand-dark/5 shadow-xl bg-gradient-to-br from-white to-blue-50/30">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 text-brand-blue rounded-xl flex items-center justify-center shadow-inner">
                    <TrendingUp size={24} />
                </div>
                <div>
                    <h3 className="text-2xl font-display font-bold text-brand-dark">Performance Analysis</h3>
                    <p className="text-sm text-brand-dark/60">See how you're doing across different subjects</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-brand-dark/5 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-brand-dark/5 rounded-full">
                        <BookOpen className="text-brand-dark/60" size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-brand-dark/40 uppercase tracking-wider mb-1">Total Questions</p>
                        <p className="text-3xl font-display font-bold text-brand-dark">{totalQuestionsAll}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-brand-dark/5 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full">
                        <Target className="text-brand-green" size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-brand-dark/40 uppercase tracking-wider mb-1">Overall Accuracy</p>
                        <p className="text-3xl font-display font-bold text-brand-green">{overallAccuracy}%</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="font-bold text-brand-dark mb-4 px-1">Subject Breakdown</h4>
                {subjectStats.map((stat, idx) => {
                    const accuracy = stat.totalQuestions > 0 ? Math.round((stat.correctAnswers / stat.totalQuestions) * 100) : 0;
                    return (
                        <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-brand-dark/5 relative overflow-hidden group hover:border-brand-blue/30 transition-colors">
                            <div className="flex justify-between items-end mb-2 relative z-10">
                                <div>
                                    <h5 className="font-bold text-brand-dark text-lg">{stat.subject}</h5>
                                    <p className="text-xs text-brand-dark/50 font-medium">
                                        {stat.correctAnswers} / {stat.totalQuestions} Correct
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-lg font-bold ${accuracy >= 80 ? 'text-brand-green' : accuracy >= 50 ? 'text-brand-orange' : 'text-red-500'}`}>
                                        {accuracy}%
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-brand-dark/5 h-2.5 rounded-full overflow-hidden relative z-10">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${accuracy >= 80 ? 'bg-brand-green' : accuracy >= 50 ? 'bg-brand-orange' : 'bg-red-500'}`}
                                    style={{ width: `${Math.max(accuracy, 2)}%` }} // At least 2% so dot is visible
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quiz History — individual completed quizzes, most recent first */}
            <div className="mt-8 pt-6 border-t border-brand-dark/5">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h4 className="font-bold text-brand-dark flex items-center gap-2">
                        <History size={18} className="text-brand-blue" /> Quiz History
                    </h4>
                    <span className="text-xs font-bold text-brand-dark/40">{results.length} completed</span>
                </div>

                <div className="space-y-2.5">
                    {(showAllHistory ? results : results.slice(0, HISTORY_PREVIEW_COUNT)).map((result) => {
                        const total = result.totalQuestions || 0;
                        const correct = result.correctAnswers || 0;
                        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
                        const mode = getModeMeta(result.mode);
                        const title = result.quest?.title || result.subject || (result.mode === 'CUSTOM' ? 'Custom Quest' : 'General Practice');

                        return (
                            <div key={result.id} className="bg-white p-4 rounded-xl shadow-sm border border-brand-dark/5 flex items-center gap-4 hover:border-brand-blue/30 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${mode.className}`}>
                                            {mode.icon} {mode.label}
                                        </span>
                                        <span className="text-xs text-brand-dark/40 font-medium">{formatDate(result.date)}</span>
                                    </div>
                                    <h5 className="font-bold text-brand-dark truncate">{title}</h5>
                                    <p className="text-xs text-brand-dark/50 font-medium">{correct} / {total} correct · +{result.score} XP</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`text-2xl font-display font-bold ${accuracyColor(accuracy)}`}>{accuracy}%</span>
                                    <p className="text-[10px] font-bold text-brand-dark/30 uppercase tracking-wider">Accuracy</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {results.length > HISTORY_PREVIEW_COUNT && (
                    <button
                        onClick={() => setShowAllHistory(v => !v)}
                        className="mt-4 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white border border-brand-dark/5 text-sm font-bold text-brand-blue hover:bg-brand-blue/5 transition-colors"
                    >
                        {showAllHistory
                            ? <>Show less <ChevronUp size={16} /></>
                            : <>Show all {results.length} quizzes <ChevronDown size={16} /></>}
                    </button>
                )}
            </div>
        </Card>
    );
};
