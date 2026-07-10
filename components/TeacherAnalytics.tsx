import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, BarChart3, Target, GraduationCap, ChevronDown } from 'lucide-react';
import { Card } from './Card';

interface TeacherAnalyticsProps {
    token: string;
}

export const TeacherAnalytics: React.FC<TeacherAnalyticsProps> = ({ token }) => {
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);

    useEffect(() => {
        const fetchClassrooms = async () => {
            try {
                const res = await fetch('/api/classrooms', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setClassrooms(data.teaching || []);
                    if (data.teaching && data.teaching.length > 0) {
                        setSelectedClassroomId(data.teaching[0].id);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch classrooms:", error);
            } finally {
                setIsLoadingClasses(false);
            }
        };
        fetchClassrooms();
    }, [token]);

    useEffect(() => {
        if (!selectedClassroomId) return;
        
        const fetchSubmissions = async () => {
            setIsLoadingData(true);
            try {
                const res = await fetch(`/api/classrooms/${selectedClassroomId}/submissions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSubmissions(data || []);
                }
            } catch (error) {
                console.error("Failed to fetch submissions:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchSubmissions();
    }, [selectedClassroomId, token]);

    if (isLoadingClasses) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-brand-blue" size={32} />
            </div>
        );
    }

    if (classrooms.length === 0) {
        return (
            <Card className="p-8 text-center border-2 border-brand-dark/5 shadow-xl">
                <GraduationCap className="mx-auto mb-4 text-slate-300" size={48} />
                <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Classrooms Yet</h3>
                <p className="text-slate-500 text-sm">
                    Create a classroom in the Classrooms tab first to see analytics.
                </p>
            </Card>
        );
    }

    // Calculate roster based on submissions
    const studentStats: Record<string, { name: string; totalScore: number; gradedCount: number; totalCompleted: number }> = {};
    submissions.forEach(a => {
        a.submissions?.forEach((sub: any) => {
            const sId = sub.studentId;
            if (!studentStats[sId]) {
                studentStats[sId] = { name: sub.student?.name || 'Unknown', totalScore: 0, gradedCount: 0, totalCompleted: 0 };
            }
            if (sub.status === 'completed' || sub.status === 'submitted') {
                studentStats[sId].totalCompleted++;
            }
            if (sub.status === 'completed' && typeof sub.score === 'number') {
                studentStats[sId].totalScore += sub.score;
                studentStats[sId].gradedCount++;
            }
        });
    });

    const roster = Object.values(studentStats)
        .map(s => ({
            name: s.name,
            completed: s.totalCompleted,
            accuracy: s.gradedCount > 0 ? Math.round(s.totalScore / s.gradedCount) : 0
        }))
        .sort((a, b) => b.accuracy - a.accuracy);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Classroom Selector */}
            <div className="flex items-center gap-3">
                <div className="relative inline-block w-64">
                    <select
                        value={selectedClassroomId}
                        onChange={(e) => setSelectedClassroomId(e.target.value)}
                        className="w-full appearance-none px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-indigo-400 shadow-sm transition-colors cursor-pointer"
                    >
                        {classrooms.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {isLoadingData ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Class Overall Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                            <div className="p-4 bg-indigo-50 rounded-2xl shrink-0">
                                <BarChart3 className="text-indigo-600" size={28} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Accuracy</p>
                                <p className="text-4xl font-display font-extrabold text-slate-800">{roster.length > 0 ? Math.round(roster.reduce((acc, curr) => acc + curr.accuracy, 0) / roster.length) : 0}%</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                            <div className="p-4 bg-emerald-50 rounded-2xl shrink-0">
                                <Target className="text-emerald-600" size={28} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Completed</p>
                                <p className="text-4xl font-display font-extrabold text-slate-800">{roster.reduce((acc, curr) => acc + curr.completed, 0)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                            <div className="p-4 bg-amber-50 rounded-2xl shrink-0">
                                <TrendingUp className="text-amber-600" size={28} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Top Performer</p>
                                <p className="text-2xl font-extrabold text-slate-800 truncate">{roster.length > 0 ? roster[0].name : 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Student Leaderboard & Visual Bars */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-display text-2xl font-extrabold text-slate-800">Student Performance</h3>
                            <span className="text-sm font-bold text-slate-500 bg-slate-100 px-4 py-1.5 rounded-full">{roster.length} Students</span>
                        </div>
                        {roster.length === 0 ? (
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm py-16 text-center px-4">
                                <Target className="mx-auto mb-4 text-slate-300" size={48} />
                                <p className="text-base text-slate-500 font-medium">No graded submissions yet to calculate analytics.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {roster.map((student, idx) => {
                                    const acc = student.accuracy;
                                    const color = acc >= 80 ? 'bg-emerald-500' : acc >= 50 ? 'bg-amber-500' : 'bg-red-500';
                                    const textColor = acc >= 80 ? 'text-emerald-600' : acc >= 50 ? 'text-amber-600' : 'text-red-500';

                                    return (
                                        <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-5">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base shadow-sm
                                                        ${idx===0?'bg-amber-100 text-amber-600':idx===1?'bg-slate-200 text-slate-600':idx===2?'bg-orange-100 text-orange-600':'bg-indigo-50 text-indigo-500'}`}>
                                                        #{idx+1}
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-bold text-slate-800">{student.name}</p>
                                                        <p className="text-sm font-bold text-slate-400 mt-0.5">{student.completed} assignments completed</p>
                                                    </div>
                                                </div>
                                                <div className={`text-3xl font-display font-extrabold ${textColor}`}>
                                                    {acc}%
                                                </div>
                                            </div>
                                            {/* Progress Bar */}
                                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative shadow-inner">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
                                                    style={{ width: `${Math.max(acc, 2)}%` }} 
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
