import React, { useState, useEffect } from 'react';
import { CustomQuest } from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { Plus, Trash2, ArrowLeft, BookOpen, Loader2, Sparkles, Info, Gift, GraduationCap, ArrowRight, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useNavigate } from 'react-router-dom';
import TeacherRewardsManager from './TeacherRewardsManager';
import { TeacherAnalytics } from './TeacherAnalytics';

interface TeacherDashboardProps {
    onBack: () => void;
    onViewPricing: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onBack, onViewPricing }) => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        refreshUser();
    }, []);

    // NOTE: every hook below must run on EVERY render. Do not add an early
    // `return` above these — React requires a stable hook order, and a
    // conditional return here previously crashed the dashboard to a blank page.
    const [quests, setQuests] = useState<CustomQuest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [dashTab, setDashTab] = useState<'homework' | 'rewards' | 'analytics'>('homework');
    const [needsClassroom, setNeedsClassroom] = useState(false);


    const fetchQuests = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/quests', {
                headers: { Authorization: `Bearer ${localStorage.getItem('quest_token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Filter quests created by this user
                const myQuests = data.filter((q: any) => q.creatorId === user?.id);
                setQuests(myQuests);
            }
        } catch (error) {
            console.error("Failed to fetch quests", error);
        }
        setIsLoading(false);
    };

    // Load quests from API
    useEffect(() => {
        fetchQuests();
    }, [user]);

    const handleDeleteQuest = async (id: string) => {
        if (confirm("Are you sure you want to delete this homework?")) {
            const token = localStorage.getItem('quest_token');
            try {
                const res = await fetch(`/api/quests/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    fetchQuests();
                } else {
                    alert("Failed to delete homework.");
                }
            } catch (error) {
                console.error(error);
                alert("Error deleting homework.");
            }
        }
    };


    const token = localStorage.getItem('quest_token') || '';

    // Safe here: every hook above has already run, so the hook order stays stable.
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <Loader2 className="animate-spin text-brand-orange" size={40} />
                <p className="text-brand-dark/60">Loading your profile...</p>
            </div>
        );
    }

    // Homework is always created inside a classroom (that's how it gets assigned to
    // students), so this sends the teacher there — creating a class first if needed.
    const handleCreateHomework = async () => {
        try {
            const res = await fetch('/api/classrooms', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.ok ? await res.json() : null;
            if (data && Array.isArray(data.teaching) && data.teaching.length > 0) {
                navigate('/classrooms');
            } else {
                setNeedsClassroom(true);
            }
        } catch {
            // If the check fails, still send them to Classrooms rather than dead-ending.
            navigate('/classrooms');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-float">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={onBack}>
                        <ArrowLeft size={20} /> Back to Home
                    </Button>
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-display font-bold text-brand-dark">Homework Creator Dashboard</h2>
                        <div className="flex items-center gap-2 mt-1">
                            {user?.isSubscribed ? (
                                <span className="bg-brand-green/10 text-brand-green text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand-green/20 flex items-center gap-1">
                                    <Sparkles size={8} /> {user.subscriptionLevel === 'all' ? 'ALL ACCESS' : `PRO: ${user.subscribedSyllabus || 'Single'}`}
                                </span>
                            ) : (
                                <span className="bg-brand-dark/5 text-brand-dark/40 text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand-dark/10">
                                    FREE ACCOUNT
                                </span>
                            )}
                            {user?.isSubscribed && user?.subscriptionEndDate && (
                                <span className="text-[10px] font-bold text-brand-dark/40 uppercase">
                                    Ends: {new Date(user.subscriptionEndDate).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Button onClick={handleCreateHomework}>
                        <Plus className="mr-2" /> Create Homework
                    </Button>
                </div>
            </div>

            {/* Classroom CTA */}
            <Card className="p-5 border-2 border-indigo-100 bg-gradient-to-r from-indigo-50 via-purple-50/50 to-white relative overflow-hidden group">
                <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
                    <GraduationCap size={120} />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <GraduationCap size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-brand-dark text-lg">Create Homework in Classrooms</h3>
                            <p className="text-xs text-brand-dark/50 font-medium mt-0.5">Create questions manually or use AI to generate them — directly inside each classroom.</p>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 shrink-0"
                        onClick={() => navigate('/classrooms')}
                    >
                        Go to Classrooms <ArrowRight size={16} className="ml-1" />
                    </Button>
                </div>
            </Card>

            {/* Shown when the teacher has no classroom yet — homework must live in one */}
            {needsClassroom && (
                <Card className="p-5 border-2 border-amber-200 bg-amber-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-brand-dark">Create a classroom first</h3>
                            <p className="text-xs text-brand-dark/60 font-medium mt-0.5">
                                Homework is assigned to a classroom, so you need one before you can create it. It only takes a moment — then share the join code with your students.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setNeedsClassroom(false)}
                            className="text-xs font-bold text-brand-dark/40 hover:text-brand-dark/70 px-3 py-2"
                        >
                            Dismiss
                        </button>
                        <Button
                            variant="primary"
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-200"
                            onClick={() => navigate('/classrooms')}
                        >
                            New Classroom <ArrowRight size={16} className="ml-1" />
                        </Button>
                    </div>
                </Card>
            )}

            {/* Tab Switcher */}
            <div className="flex gap-1 bg-brand-dark/5 p-1 rounded-2xl w-fit overflow-x-auto">
                <button
                    onClick={() => setDashTab('homework')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        dashTab === 'homework' ? 'bg-white shadow text-brand-dark' : 'text-brand-dark/50 hover:text-brand-dark'
                    }`}
                >
                    <BookOpen size={15} /> Homework
                </button>
                <button
                    onClick={() => setDashTab('rewards')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        dashTab === 'rewards' ? 'bg-white shadow text-amber-600' : 'text-brand-dark/50 hover:text-brand-dark'
                    }`}
                >
                    <Gift size={15} /> Rewards
                </button>
                <button
                    onClick={() => setDashTab('analytics')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        dashTab === 'analytics' ? 'bg-white shadow text-indigo-600' : 'text-brand-dark/50 hover:text-brand-dark'
                    }`}
                >
                    <BarChart3 size={15} /> Analytics
                </button>
            </div>

            {dashTab === 'analytics' ? (
                <TeacherAnalytics token={token} />
            ) : dashTab === 'rewards' ? (
                <TeacherRewardsManager />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {isLoading ? (
                        <div className="col-span-full flex justify-center py-10">
                            <Loader2 className="animate-spin text-brand-blue" size={40} />
                        </div>
                    ) : quests.length === 0 ? (
                        <div className="col-span-full text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-brand-dark/10">
                            <div className="w-20 h-20 bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-orange">
                                <BookOpen size={40} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">No Homework Created Yet</h3>
                            <p className="text-brand-dark/60 font-medium">Create your first homework assignment to get started!</p>
                        </div>
                    ) : (
                        quests.map((quest) => (
                            <Card key={quest.id} className="p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-brand-blue/20">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-xl">{quest.title}</h3>
                                        <div className="flex gap-2 text-xs font-bold text-brand-dark/50 mt-1">
                                            <span className="bg-blue-50 text-brand-blue px-2 py-0.5 rounded">{quest.subject}</span>
                                            <span className="bg-orange-50 text-brand-orange px-2 py-0.5 rounded">{quest.grade}</span>
                                        </div>
                                        <p className="text-sm text-brand-dark/50 font-medium mt-2">
                                            Created: {new Date(quest.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-full text-xs font-bold">
                                        {quest.questions.length} Qs
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4 border-t border-brand-dark/5">
                                    <button
                                        onClick={() => handleDeleteQuest(quest.id)}
                                        className="text-red-400 hover:text-red-600 flex items-center gap-2 text-sm font-bold transition-colors"
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
