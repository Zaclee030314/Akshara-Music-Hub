import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import {
    Users, BookOpen, Loader2, Play, CheckCircle, Plus,
    Clock, AlertCircle, ChevronRight, Upload, X,
    GraduationCap, ClipboardList, Star, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../contexts/LanguageContext';

const StatusCard: React.FC<{ label: string; value: number; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${color}`}>
        {icon}
        <div>
            <p className="text-2xl font-extrabold leading-none">{value}</p>
            <p className="text-[11px] font-bold opacity-70 uppercase tracking-wider">{label}</p>
        </div>
    </div>
);

export const StudentClassrooms: React.FC = () => {
    const { t } = useT();
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinSuccess, setJoinSuccess] = useState(false);
    const navigate = useNavigate();

    const fetchClassrooms = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch('/api/classrooms', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { const d = await res.json(); setClassrooms(d.enrolled || []); }
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    useEffect(() => { fetchClassrooms(); }, []);

    const handleJoinClassroom = async () => {
        if (!joinCode.trim()) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch('/api/classrooms/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ joinCode })
            });
            if (res.ok) {
                setJoinCode('');
                setJoinSuccess(true);
                setTimeout(() => setJoinSuccess(false), 3000);
                fetchClassrooms();
            } else {
                const err = await res.json();
                alert(t('classroom.errorPrefix', { msg: err.error }));
            }
        } catch (e) { console.error(e); alert(t('classroom.failJoin')); }
        setIsLoading(false);
    };

    const handleStartAssignment = (assignment: any) => {
        navigate(`/practice?mode=custom&autoStart=true&questId=${assignment.questId}&assignmentId=${assignment.id}`);
    };

    if (isLoading && classrooms.length === 0) {
        return <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={36} />
            <p className="text-sm font-semibold text-slate-400">{t('classroom.loading')}</p>
        </div>;
    }

    return (
        <div className="space-y-6">
            {/* Join Classroom Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                        <GraduationCap size={20} />
                        <h3 className="text-lg font-extrabold">{t('classroom.joinTitle')}</h3>
                    </div>
                    <p className="text-indigo-200 text-sm font-medium mb-4">{t('classroom.enterCode')}</p>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="e.g., A1B2C3"
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && handleJoinClassroom()}
                            className="flex-1 md:w-52 px-4 py-2.5 rounded-xl bg-white/20 border-2 border-white/30 focus:border-white focus:outline-none placeholder:text-white/50 text-white font-mono font-extrabold tracking-widest text-lg text-center"
                            maxLength={6}
                        />
                        <button
                            onClick={handleJoinClassroom}
                            disabled={isLoading || joinCode.length < 6}
                            className="px-6 py-2.5 bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 rounded-xl font-extrabold text-sm shadow-md transition-all flex items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><ChevronRight size={16} /> {t('classroom.join')}</>}
                        </button>
                    </div>
                    {joinSuccess && (
                        <div className="mt-3 flex items-center gap-2 text-emerald-300 text-sm font-bold">
                            <CheckCircle size={16} /> {t('classroom.joinSuccess')}
                        </div>
                    )}
                </div>
            </div>

            {/* Classrooms List */}
            {classrooms.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users size={30} className="text-indigo-400" />
                    </div>
                    <h4 className="font-bold text-slate-600 mb-1">{t('classroom.noneTitle')}</h4>
                    <p className="text-sm text-slate-400">{t('classroom.noneDesc')}</p>
                </div>
            ) : (
                <div className="space-y-5">
                    <h3 className="text-xl font-extrabold text-slate-800">{t('classroom.myClassrooms')}</h3>
                    {classrooms.map(cls => (
                        <div key={cls.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            {/* Class Header */}
                            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                                    <GraduationCap size={20} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-extrabold text-slate-800 text-lg leading-tight truncate">{cls.name}</h4>
                                    <p className="text-xs font-bold text-slate-400">{t('classroom.teacher', { name: cls.teacher?.name || t('classroom.unknown') })}</p>
                                </div>
                            </div>
                            {/* Assignments */}
                            <ClassroomAssignments classroomId={cls.id} onStart={handleStartAssignment} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ClassroomAssignments: React.FC<{ classroomId: string; onStart: (a: any) => void }> = ({ classroomId, onStart }) => {
    const { t } = useT();
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const token = localStorage.getItem('quest_token');
                const res = await fetch(`/api/classrooms/${classroomId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) { const d = await res.json(); setAssignments(d.assignments || []); }
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, [classroomId]);

    const handleMarkDone = async (assignmentId: string, proofDataUrl?: string) => {
        try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ score: null, proofUrl: proofDataUrl || null })
            });
            if (res.ok) {
                setAssignments(assignments.map(a =>
                    a.id === assignmentId
                        ? { ...a, submissions: [...(a.submissions || []), { status: 'submitted', proofUrl: proofDataUrl }] }
                        : a
                ));
            } else alert(t('classroom.failSubmit'));
        } catch (e) { console.error(e); }
        setUploadingId(null);
    };

    if (loading) return (
        <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 className="animate-spin text-indigo-400" size={18} />
            <span className="text-sm text-slate-400 font-medium">{t('classroom.loadingAssignments')}</span>
        </div>
    );

    if (assignments.length === 0) return (
        <div className="px-5 py-6 text-center">
            <ClipboardList size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400 font-semibold">{t('classroom.noAssignments')}</p>
        </div>
    );

    const pending = assignments.filter(a => !a.submissions?.length);
    const submitted = assignments.filter(a => a.submissions?.some((s: any) => s.status === 'submitted'));
    const graded = assignments.filter(a => a.submissions?.some((s: any) => s.status === 'completed'));

    return (
        <div className="p-5 space-y-4">
            {/* Summary Stats */}
            <div className="flex flex-wrap gap-2">
                <StatusCard label={t('classroom.pending')} value={pending.length} color="bg-slate-100 text-slate-600" icon={<Clock size={18} className="opacity-60" />} />
                <StatusCard label={t('classroom.submitted')} value={submitted.length} color="bg-amber-50 text-amber-700" icon={<AlertCircle size={18} className="opacity-70" />} />
                <StatusCard label={t('classroom.graded')} value={graded.length} color="bg-emerald-50 text-emerald-700" icon={<Star size={18} className="opacity-70" />} />
            </div>

            {/* Assignment List */}
            <div className="space-y-3">
                {assignments.map(a => {
                    const isCompleted = a.submissions?.some((s: any) => s.status === 'completed');
                    const isSubmitted = a.submissions?.some((s: any) => s.status === 'submitted');
                    const score = isCompleted ? a.submissions.find((s: any) => s.status === 'completed')?.score : null;
                    const proof = a.submissions?.find((s: any) => s.proofUrl)?.proofUrl;
                    const isUploading = uploadingId === a.id;

                    let borderColor = 'border-slate-200';
                    let headerBg = 'bg-slate-50';
                    if (isCompleted) { borderColor = 'border-emerald-200'; headerBg = 'bg-emerald-50'; }
                    else if (isSubmitted) { borderColor = 'border-amber-200'; headerBg = 'bg-amber-50'; }

                    return (
                        <div key={a.id} className={`border-2 ${borderColor} rounded-xl overflow-hidden`}>
                            {/* Row header */}
                            <div className={`${headerBg} px-4 py-3 flex items-center justify-between gap-3`}>
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-500' : isSubmitted ? 'bg-amber-400' : 'bg-slate-200'}`}>
                                        {isCompleted
                                            ? <CheckCircle size={16} className="text-white" />
                                            : isSubmitted
                                            ? <Clock size={16} className="text-white" />
                                            : <FileText size={16} className="text-slate-500" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate">{a.title}</p>
                                        {a.dueDate && (
                                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                <Clock size={9} /> {t('classroom.due', { date: new Date(a.dueDate).toLocaleDateString() })}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Status / Action */}
                                <div className="shrink-0">
                                    {isCompleted ? (
                                        <div className="text-right">
                                            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 block">
                                                {score != null ? `${score}% 🎉` : t('classroom.done')}
                                            </span>
                                        </div>
                                    ) : isSubmitted ? (
                                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 block">
                                            {t('classroom.awaitingGrade')}
                                        </span>
                                    ) : a.questId ? (
                                        <button
                                            onClick={() => onStart(a)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-extrabold shadow-sm shadow-indigo-200 transition-all"
                                        >
                                            <Play size={12} /> {t('classroom.startQuest')}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    id={`proof-${a.id}`}
                                                    className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            setUploadingId(a.id);
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => handleMarkDone(a.id, reader.result as string);
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                                <label
                                                    htmlFor={`proof-${a.id}`}
                                                    className="flex items-center gap-1.5 px-3 py-2 border-2 border-indigo-200 text-indigo-600 rounded-lg text-xs font-bold cursor-pointer hover:bg-indigo-50 transition-all"
                                                >
                                                    {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                                    {isUploading ? t('classroom.uploading') : t('classroom.uploadProof')}
                                                </label>
                                            </>
                                            <button
                                                onClick={() => handleMarkDone(a.id)}
                                                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all"
                                            >
                                                {t('classroom.markDone')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description + Proof (expandable detail) */}
                            {(a.description || proof) && (
                                <div className="px-4 py-3 border-t border-slate-100 space-y-2">
                                    {a.description && (
                                        <p className="text-xs text-slate-600 font-medium bg-slate-50 rounded-lg p-3 whitespace-pre-wrap border border-slate-100">{a.description}</p>
                                    )}
                                    {proof && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('classroom.submittedProof')}</p>
                                            <img
                                                src={proof}
                                                alt="Proof"
                                                className="w-20 h-20 object-cover rounded-xl border-2 border-indigo-200 cursor-pointer hover:border-indigo-400 transition-all"
                                                onClick={() => window.open(proof, '_blank')}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
