import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { Card } from './Card';
import { useT } from '../contexts/LanguageContext';
import { 
    CheckCircle2, 
    Circle, 
    ArrowLeft, 
    Loader2, 
    Sparkles, 
    Clock, 
    Target, 
    Trophy,
    ChevronRight,
    Play,
    RefreshCw,
    AlertCircle,
    Layout
} from 'lucide-react';

interface StudyTask {
    id: string;
    weekNumber: number;
    day: string;
    title: string;
    topicSearch: string;
    isCompleted: boolean;
    completedAt: string | null;
}

interface StudyPlan {
    id: string;
    title: string;
    overview: string | null;
    subject: string;
    grade: string;
    syllabus: string;
    timeframe: string;
    tasks: StudyTask[];
}

export const StudyProgress: React.FC = () => {
    const { t } = useT();
    const navigate = useNavigate();
    const [plan, setPlan] = useState<StudyPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

    const fetchPlan = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('quest_token');
            const res = await fetch('/api/study-plans/current', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                setPlan(data);
            } else if (res.status === 404) {
                setError('No active study plan found.');
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.details || t('studyprogress.fetchFailed'));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlan();
    }, []);

    const toggleTask = async (taskId: string, currentStatus: boolean) => {
        setUpdatingTaskId(taskId);
        try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch(`/api/study-plans/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ isCompleted: !currentStatus })
            });

            if (res.ok) {
                const updatedTask = await res.json();
                setPlan(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
                    };
                });
            }
        } catch (err) {
            console.error('Failed to update task', err);
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const handleStartPractice = (subject: string, grade: string, syllabus: string, topic: string) => {
        const params = new URLSearchParams({
            mode: 'AI',
            subject,
            grade,
            syllabus,
            topic,
            autoStart: 'true'
        });
        navigate(`/practice?${params.toString()}`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
                <Loader2 className="animate-spin text-brand-blue" size={48} strokeWidth={2} />
                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">{t('studyprogress.loading')}</p>
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="max-w-xl mx-auto py-20 px-4">
                <Card className="p-10 text-center space-y-8 border-slate-200 shadow-sm rounded-3xl bg-white">
                    <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={40} />
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('studyprogress.focusPlan')}</h2>
                        <p className="text-slate-500 font-medium">
                            {error === 'No active study plan found.' ? t('studyprogress.noActivePlan') : error}
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        {error !== 'No active study plan found.' && (
                            <Button onClick={fetchPlan} size="lg" className="rounded-2xl py-4 font-bold bg-brand-blue">
                                {t('studyprogress.tryAgain')}
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            onClick={() => navigate('/study-plan')}
                            className="rounded-2xl py-4 font-bold border-slate-200 text-slate-600"
                        >
                            {t('studyprogress.createNewPlan')}
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    const todayTasks = plan.tasks.filter(t => !t.isCompleted).slice(0, 2);
    const completedCount = plan.tasks.filter(t => t.isCompleted).length;
    const progressPercent = Math.round((completedCount / plan.tasks.length) * 100);

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto space-y-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <button 
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-widest mb-4"
                        >
                            <ArrowLeft size={16} /> {t('nav.dashboard')}
                        </button>
                        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{t('studyprogress.roadmapTitle', { subject: plan.subject })}</h1>
                        <p className="text-slate-500 font-medium">{plan.grade} • {plan.syllabus} • {plan.timeframe}</p>
                    </div>

                    <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-sm">
                            {progressPercent}%
                        </div>
                        <div className="space-y-1.5 min-w-[140px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('studyprogress.totalProgress')}</p>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 transition-all duration-1000" 
                                    style={{ width: `${progressPercent}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Target size={20} className="text-brand-blue" /> {t('studyprogress.focusedTasks')}
                        </h3>
                        
                        <div className="space-y-4">
                            {todayTasks.length > 0 ? todayTasks.map(task => (
                                <Card key={task.id} className="p-6 border-slate-200 shadow-sm rounded-3xl bg-white flex flex-col sm:flex-row items-center justify-between gap-6 transition-all hover:border-brand-blue/30">
                                    <div className="flex items-center gap-6">
                                        <button 
                                            onClick={() => toggleTask(task.id, task.isCompleted)}
                                            disabled={updatingTaskId === task.id}
                                            className="text-slate-200 hover:text-brand-blue transition-all"
                                        >
                                            {updatingTaskId === task.id ? <Loader2 size={32} className="animate-spin" /> : <Circle size={32} />}
                                        </button>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('studyprogress.dayWeek', { day: task.day, week: task.weekNumber })}</p>
                                            <p className="font-bold text-slate-900 text-lg">{task.title}</p>
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={() => handleStartPractice(plan.subject, plan.grade, plan.syllabus, task.topicSearch)}
                                        className="w-full sm:w-auto rounded-xl py-3 px-6 font-bold bg-brand-blue flex items-center gap-2"
                                    >
                                        <Play size={16} fill="currentColor" /> {t('studyprogress.practice')}
                                    </Button>
                                </Card>
                            )) : (
                                <Card className="p-12 border-dashed border-2 border-slate-200 bg-white/50 text-center rounded-3xl">
                                    <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <p className="font-bold text-slate-900">{t('studyprogress.allComplete')}</p>
                                    <p className="text-slate-500 text-sm">{t('studyprogress.onTrack')}</p>
                                </Card>
                            )}
                        </div>

                        <div className="pt-8 space-y-8">
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Layout size={20} className="text-brand-blue" /> {t('studyprogress.fullRoadmap')}
                            </h3>
                            
                            <div className="space-y-6">
                                {Array.from(new Set(plan.tasks.map(t => t.weekNumber))).sort((a,b)=>a-b).map(weekNum => {
                                    const weekTasks = plan.tasks.filter(t => t.weekNumber === weekNum);
                                    return (
                                        <div key={weekNum} className="space-y-4">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2 border-l-2 border-brand-blue ml-1">{t('studyprogress.week', { week: weekNum })}</p>
                                            <div className="grid grid-cols-1 gap-3">
                                                {weekTasks.map(task => (
                                                    <div 
                                                        key={task.id} 
                                                        className={`flex items-center justify-between p-4 px-6 rounded-2xl border transition-all ${task.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <button 
                                                                onClick={() => toggleTask(task.id, task.isCompleted)}
                                                                className={task.isCompleted ? 'text-emerald-500' : 'text-slate-200'}
                                                            >
                                                                {task.isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                                            </button>
                                                            <span className={`font-bold text-sm ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.title}</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-300 uppercase">{task.day}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <Card className="p-8 border-slate-200 shadow-sm rounded-3xl bg-white space-y-6 lg:sticky lg:top-8">
                            <div className="space-y-2">
                                <h4 className="text-lg font-bold text-slate-900">{t('studyprogress.overviewTitle')}</h4>
                                <p className="text-sm text-slate-500 leading-relaxed">{plan.overview || t('studyprogress.overviewFallback')}</p>
                            </div>

                            <div className="pt-4 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400 font-medium">{t('studyprogress.tasksTotal')}</span>
                                    <span className="text-slate-900 font-bold">{plan.tasks.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400 font-medium">{t('studyprogress.tasksFinished')}</span>
                                    <span className="text-emerald-600 font-bold">{completedCount}</span>
                                </div>
                            </div>

                            <button 
                                onClick={async () => {
                                    if(window.confirm(t('studyprogress.confirmDelete'))) {
                                        try {
                                            const res = await fetch(`/api/study-plans/${plan.id}`, { 
                                                method: 'DELETE',
                                                headers: { 'Authorization': `Bearer ${localStorage.getItem('quest_token')}` }
                                            });
                                            if (res.ok) {
                                                navigate('/study-plan');
                                            } else {
                                                const errData = await res.json().catch(() => ({}));
                                                alert(errData.error || t('studyprogress.deleteFailed'));
                                            }
                                        } catch (err) {
                                            alert(t('studyprogress.deleteError'));
                                            console.error(err);
                                        }
                                    }
                                }}
                                className="w-full py-3 rounded-xl border border-red-100 text-red-500 text-xs font-bold hover:bg-red-50 transition-all uppercase tracking-widest mt-4"
                            >
                                {t('studyprogress.resetRoadmap')}
                            </button>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
;
