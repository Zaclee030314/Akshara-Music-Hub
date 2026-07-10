import React, { useState, useEffect } from 'react';
import {
    Plus, Users, BookOpen, Loader2, Copy, CheckCircle2,
    ChevronDown, ChevronUp, Award, X, GraduationCap,
    FileText, Eye, ClipboardList, Trash2, CheckCircle,
    AlertCircle, MoreHorizontal, Sparkles, ArrowLeft,
    Save, Info, Settings, List, HelpCircle, RefreshCw, Brain,
    TrendingUp, BarChart3, Target
} from 'lucide-react';
import { CustomQuest, Question, Subject, GradeLevel, Syllabus } from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { useAuth } from '../contexts/useAuth';

/* ─── tiny helpers ────────────────────────────────────────────── */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const map: Record<string, { label: string; cls: string }> = {
        completed: { label: '✓ Graded',        cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
        submitted: { label: '⏳ Needs Review',  cls: 'bg-amber-100  text-amber-700  border border-amber-200'  },
        pending:   { label: '○ Pending',        cls: 'bg-slate-100  text-slate-400  border border-slate-200'  },
    };
    const c = map[status] ?? map.pending;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
};

/* ─── Subject/Grade helpers (mirrors TeacherDashboard) ─────── */
const getSubjectsByGrade = (grade: GradeLevel | '', syllabus: Syllabus | ''): Subject[] => {
    const allSubjects = Object.values(Subject);
    if (!grade) return allSubjects;

    if (syllabus === 'Unified Examination Certificate (UEC)') {
        if ([GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3].includes(grade as GradeLevel)) {
            return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.SCIENCE,
            Subject.SEJARAH, Subject.GEOGRAPHY, Subject.PENDIDIKAN_MORAL, Subject.COMPUTER_SCIENCE];
        }
        if ([GradeLevel.FORM_4, GradeLevel.FORM_5].includes(grade as GradeLevel)) {
            return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH,
            Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY, Subject.GEOGRAPHY,
            Subject.SEJARAH, Subject.ECONOMICS, Subject.BUSINESS,
            Subject.PENDIDIKAN_MORAL, Subject.COMPUTER_SCIENCE];
        }
        if (grade === GradeLevel.FORM_6) {
            return [Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS, Subject.CHEMISTRY,
            Subject.BIOLOGY, Subject.ECONOMICS, Subject.BUSINESS,
            Subject.ENGLISH, Subject.BAHASA_MELAYU];
        }
    }

    if (syllabus === 'International Baccalaureate (IB)') {
        if ([GradeLevel.YEAR_1, GradeLevel.YEAR_2, GradeLevel.YEAR_3,
        GradeLevel.YEAR_4, GradeLevel.YEAR_5, GradeLevel.YEAR_6].includes(grade as GradeLevel)) {
            return [Subject.ENGLISH, Subject.MATH, Subject.SCIENCE];
        }
        if ([GradeLevel.YEAR_7, GradeLevel.YEAR_8, GradeLevel.YEAR_9,
        GradeLevel.YEAR_10, GradeLevel.YEAR_11].includes(grade as GradeLevel)) {
            return [Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH, Subject.SCIENCE,
            Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY,
            Subject.GEOGRAPHY, Subject.SEJARAH, Subject.ECONOMICS, Subject.COMPUTER_SCIENCE];
        }
        if ([GradeLevel.YEAR_12, GradeLevel.YEAR_13].includes(grade as GradeLevel)) {
            return [Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS,
            Subject.CHEMISTRY, Subject.BIOLOGY, Subject.GEOGRAPHY,
            Subject.ECONOMICS, Subject.BUSINESS, Subject.COMPUTER_SCIENCE];
        }
    }

    if ([GradeLevel.STD_1, GradeLevel.STD_2, GradeLevel.STD_3].includes(grade as GradeLevel)) {
        return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.SCIENCE,
        Subject.PENDIDIKAN_ISLAM, Subject.PENDIDIKAN_MORAL];
    }
    if ([GradeLevel.STD_4, GradeLevel.STD_5, GradeLevel.STD_6].includes(grade as GradeLevel)) {
        return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.SCIENCE,
        Subject.SEJARAH, Subject.RBT, Subject.PENDIDIKAN_ISLAM, Subject.PENDIDIKAN_MORAL];
    }
    if ([GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3].includes(grade as GradeLevel)) {
        return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.SCIENCE,
        Subject.SEJARAH, Subject.GEOGRAPHY, Subject.RBT,
        Subject.PENDIDIKAN_ISLAM, Subject.PENDIDIKAN_MORAL, Subject.COMPUTER_SCIENCE];
    }
    if ([GradeLevel.FORM_4, GradeLevel.FORM_5].includes(grade as GradeLevel)) {
        return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH,
        Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY, Subject.SEJARAH,
        Subject.GEOGRAPHY, Subject.PENDIDIKAN_ISLAM, Subject.PENDIDIKAN_MORAL,
        Subject.ECONOMICS, Subject.BUSINESS, Subject.COMPUTER_SCIENCE];
    }
    if (grade === GradeLevel.FORM_6) {
        return [Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS, Subject.CHEMISTRY,
        Subject.BIOLOGY, Subject.ECONOMICS, Subject.BUSINESS,
        Subject.BAHASA_MELAYU, Subject.ENGLISH];
    }
    if ([GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3,
    GradeLevel.SEC_4, GradeLevel.SEC_5].includes(grade as GradeLevel)) {
        return [Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH, Subject.SCIENCE,
        Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY,
        Subject.GEOGRAPHY, Subject.SEJARAH, Subject.ECONOMICS,
        Subject.BUSINESS, Subject.COMPUTER_SCIENCE];
    }
    if ([GradeLevel.YEAR_1, GradeLevel.YEAR_2, GradeLevel.YEAR_3,
    GradeLevel.YEAR_4, GradeLevel.YEAR_5, GradeLevel.YEAR_6].includes(grade as GradeLevel)) {
        return [Subject.ENGLISH, Subject.MATH, Subject.SCIENCE];
    }
    if ([GradeLevel.YEAR_7, GradeLevel.YEAR_8, GradeLevel.YEAR_9,
    GradeLevel.YEAR_10, GradeLevel.YEAR_11].includes(grade as GradeLevel)) {
        return [Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS,
        Subject.CHEMISTRY, Subject.BIOLOGY, Subject.GEOGRAPHY,
        Subject.ECONOMICS, Subject.BUSINESS, Subject.COMPUTER_SCIENCE];
    }
    if ([GradeLevel.YEAR_12, GradeLevel.YEAR_13].includes(grade as GradeLevel)) {
        return [Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS, Subject.CHEMISTRY,
        Subject.BIOLOGY, Subject.ECONOMICS, Subject.BUSINESS,
        Subject.COMPUTER_SCIENCE, Subject.ENGLISH];
    }
    return allSubjects;
};

const getGradesBySyllabus = (syll: Syllabus | ''): GradeLevel[] => {
    if (!syll) return Object.values(GradeLevel);
    switch (syll) {
        case Syllabus.IGCSE:
        case Syllabus.IB:
            return [GradeLevel.YEAR_1, GradeLevel.YEAR_2, GradeLevel.YEAR_3,
            GradeLevel.YEAR_4, GradeLevel.YEAR_5, GradeLevel.YEAR_6,
            GradeLevel.YEAR_7, GradeLevel.YEAR_8, GradeLevel.YEAR_9,
            GradeLevel.YEAR_10, GradeLevel.YEAR_11, GradeLevel.YEAR_12, GradeLevel.YEAR_13];
        case Syllabus.MOE_SINGAPORE:
            return [GradeLevel.STD_1, GradeLevel.STD_2, GradeLevel.STD_3,
            GradeLevel.STD_4, GradeLevel.STD_5, GradeLevel.STD_6,
            GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3,
            GradeLevel.SEC_4, GradeLevel.SEC_5];
        case Syllabus.UEC:
            return [GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3,
            GradeLevel.FORM_4, GradeLevel.FORM_5, GradeLevel.FORM_6];
        case Syllabus.KSSR_KSSM:
        default:
            return [GradeLevel.STD_1, GradeLevel.STD_2, GradeLevel.STD_3,
            GradeLevel.STD_4, GradeLevel.STD_5, GradeLevel.STD_6,
            GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3,
            GradeLevel.FORM_4, GradeLevel.FORM_5, GradeLevel.FORM_6];
    }
};


/* ═══════════════════════════════════════════════════════════════
   ██  HOMEWORK CREATOR SUB-COMPONENT  (used inside classrooms)
   ═══════════════════════════════════════════════════════════════ */
interface HomeworkCreatorProps {
    classroomId: string;
    classroomName: string;
    onClose: () => void;
    onCreated: () => void;
}

const HomeworkCreator: React.FC<HomeworkCreatorProps> = ({ classroomId, classroomName, onClose, onCreated }) => {
    const { user } = useAuth();
    const [mode, setMode] = useState<'manual' | 'ai'>('manual');
    const [isLoading, setIsLoading] = useState(false);

    // Quest metadata
    const [questTitle, setQuestTitle] = useState('');
    const [questSubject, setQuestSubject] = useState<Subject | ''>('');
    const [questGrade, setQuestGrade] = useState<GradeLevel | ''>('');
    const [questSyllabus, setQuestSyllabus] = useState<Syllabus | ''>(() => {
        const subLevel = (user as any)?.subscriptionLevel;
        const subSyllabus = (user as any)?.subscribedSyllabus;
        return (user?.isSubscribed && subLevel === 'single' && subSyllabus) ? subSyllabus as Syllabus : '';
    });

    // Manual question form
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQText, setCurrentQText] = useState('');
    const [option1, setOption1] = useState('');
    const [option2, setOption2] = useState('');
    const [option3, setOption3] = useState('');
    const [option4, setOption4] = useState('');
    const [correctIndex, setCorrectIndex] = useState(0);
    const [explanation, setExplanation] = useState('');

    // AI generation
    const [aiTopics, setAiTopics] = useState<string[]>([]);
    const [selectedTopic, setSelectedTopic] = useState('');
    const [loadingTopics, setLoadingTopics] = useState(false);
    const [generatingQuestions, setGeneratingQuestions] = useState(false);

    const token = () => localStorage.getItem('quest_token');
    const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

    // Fetch topics when subject/grade/syllabus are selected in AI mode
    useEffect(() => {
        if (mode === 'ai' && questSubject && questGrade && questSyllabus) {
            const fetchTopics = async () => {
                setLoadingTopics(true);
                setAiTopics([]);
                setSelectedTopic('');
                try {
                    const res = await fetch('/api/generate/syllabus', {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({ subject: questSubject, grade: questGrade, syllabus: questSyllabus })
                    });
                    if (res.ok) {
                        const topics = await res.json();
                        setAiTopics(topics);
                    }
                } catch (e) {
                    console.error('Failed to fetch topics', e);
                }
                setLoadingTopics(false);
            };
            fetchTopics();
        }
    }, [mode, questSubject, questGrade, questSyllabus]);

    const handleAddQuestion = () => {
        if (!currentQText || !option1 || !option2 || !option3 || !option4 || !explanation) {
            alert("Please fill in all fields for the question.");
            return;
        }
        const newQ: Question = {
            id: `q-${Date.now()}`,
            text: currentQText,
            options: [option1, option2, option3, option4],
            correctAnswerIndex: correctIndex,
            explanation
        };
        setQuestions([...questions, newQ]);
        setCurrentQText(''); setOption1(''); setOption2(''); setOption3(''); setOption4('');
        setCorrectIndex(0); setExplanation('');
    };

    const handleRemoveQuestion = (idx: number) => {
        setQuestions(prev => prev.filter((_, i) => i !== idx));
    };

    const handleAiGenerate = async () => {
        if (!questSubject || !questGrade || !questSyllabus || !selectedTopic) {
            alert('Please select syllabus, grade, subject, and topic first.');
            return;
        }
        setGeneratingQuestions(true);
        try {
            const res = await fetch('/api/generate/quest', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    subject: questSubject,
                    grade: questGrade,
                    topic: selectedTopic,
                    syllabus: questSyllabus
                })
            });
            if (!res.ok) {
                if (res.status === 403) {
                    const err = await res.json();
                    alert(err.error || 'You have reached the generation limit. Upgrade to Pro for unlimited.');
                } else {
                    alert('Failed to generate questions. Please try again.');
                }
                setGeneratingQuestions(false);
                return;
            }
            const data = await res.json();
            const generated: Question[] = Array.isArray(data) ? data : (data.questions || []);
            if (generated.length > 0) {
                setQuestions(prev => [...prev, ...generated]);
            } else {
                alert('AI returned no questions. Try a different topic.');
            }
        } catch (e) {
            console.error(e);
            alert('Error generating questions.');
        }
        setGeneratingQuestions(false);
    };

    const handleSaveAndAssign = async () => {
        if (!questTitle) { alert('Please enter a homework title.'); return; }
        if (!questSubject || !questGrade || !questSyllabus) { alert('Please select syllabus, grade, and subject.'); return; }
        if (questions.length === 0) { alert('Please add at least one question.'); return; }

        setIsLoading(true);
        try {
            // Step 1: Save the quest
            const questRes = await fetch('/api/quests', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    title: questTitle,
                    subject: questSubject,
                    grade: questGrade,
                    syllabus: questSyllabus,
                    questions
                })
            });
            if (!questRes.ok) {
                const err = await questRes.json();
                alert(`Error saving homework: ${err.error}`);
                setIsLoading(false);
                return;
            }
            const savedQuest = await questRes.json();

            // Step 2: Create assignment in classroom linking to this quest
            const assignRes = await fetch('/api/assignments', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    classroomId,
                    title: questTitle,
                    description: `${questSubject} • ${questGrade} • ${questions.length} questions`,
                    questId: savedQuest.id
                })
            });
            if (assignRes.ok) {
                onCreated();
            } else {
                alert('Homework saved but failed to assign to classroom. You can assign it manually.');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to save homework.');
        }
        setIsLoading(false);
    };

    return (
        <div className="border-t border-indigo-100 bg-gradient-to-b from-indigo-50/80 to-white p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                        <BookOpen size={18} />
                    </div>
                    <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">Create Homework</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">For: {classroomName}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                    <X size={18} />
                </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setMode('manual')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <HelpCircle size={14} /> Manual Questions
                </button>
                <button
                    onClick={() => setMode('ai')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'ai' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Sparkles size={14} /> AI Generate
                </button>
            </div>

            {/* ── Homework Configuration ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Homework Title *</label>
                    <input
                        type="text"
                        value={questTitle}
                        onChange={e => setQuestTitle(e.target.value)}
                        placeholder="e.g., Chapter 5 Review"
                        className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none font-bold text-sm bg-white"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Syllabus *</label>
                    <select
                        value={questSyllabus}
                        onChange={e => { setQuestSyllabus(e.target.value as Syllabus); setQuestGrade(''); setQuestSubject(''); }}
                        disabled={(user as any)?.subscriptionLevel === 'single'}
                        className={`w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 font-bold text-sm ${(user as any)?.subscriptionLevel === 'single' ? 'bg-gray-100 opacity-60' : 'bg-white'}`}
                    >
                        <option value="">Select Syllabus</option>
                        {Object.values(Syllabus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Grade *</label>
                    <select
                        value={questGrade}
                        onChange={e => { setQuestGrade(e.target.value as GradeLevel); setQuestSubject(''); }}
                        disabled={!questSyllabus}
                        className={`w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 font-bold text-sm ${!questSyllabus ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
                    >
                        <option value="">Select Grade</option>
                        {getGradesBySyllabus(questSyllabus).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Subject *</label>
                    <select
                        value={questSubject}
                        onChange={e => setQuestSubject(e.target.value as Subject)}
                        disabled={!questGrade}
                        className={`w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 font-bold text-sm ${!questGrade ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
                    >
                        <option value="">Select Subject</option>
                        {getSubjectsByGrade(questGrade, questSyllabus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* ── AI Topic Selection + Generate ── */}
            {mode === 'ai' && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Brain size={16} className="text-purple-600" />
                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">AI Question Generator</span>
                    </div>

                    {!questSubject || !questGrade || !questSyllabus ? (
                        <p className="text-xs text-purple-400 italic">Select syllabus, grade, and subject above to load topics.</p>
                    ) : loadingTopics ? (
                        <div className="flex items-center gap-2 py-4 justify-center">
                            <Loader2 size={16} className="animate-spin text-purple-500" />
                            <span className="text-xs font-bold text-purple-500 animate-pulse">Scanning syllabus topics...</span>
                        </div>
                    ) : aiTopics.length > 0 ? (
                        <>
                            <label className="block text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1.5">Select Topic</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
                                {aiTopics.map((topic, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedTopic(topic)}
                                        className={`p-2.5 text-left rounded-xl border-2 font-bold text-xs transition-all leading-snug ${selectedTopic === topic
                                            ? 'border-purple-400 bg-purple-100 text-purple-700 shadow-sm'
                                            : 'border-purple-100 bg-white hover:border-purple-300 text-slate-700'
                                            }`}
                                    >
                                        {topic}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={handleAiGenerate}
                                disabled={!selectedTopic || generatingQuestions}
                                className="w-full mt-2 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-200 transition-all"
                            >
                                {generatingQuestions ? (
                                    <><Loader2 size={16} className="animate-spin" /> Generating Questions...</>
                                ) : (
                                    <><Sparkles size={16} /> Generate Questions with AI</>
                                )}
                            </button>
                        </>
                    ) : (
                        <p className="text-xs text-purple-400 text-center py-3">No topics found. Try a different combination.</p>
                    )}
                </div>
            )}

            {/* ── Manual Question Creator ── */}
            {mode === 'manual' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <HelpCircle size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Add Question</span>
                    </div>

                    <textarea
                        className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none font-bold text-sm min-h-[80px] bg-slate-50/50 resize-none"
                        placeholder="Write your question here..."
                        value={currentQText}
                        onChange={e => setCurrentQText(e.target.value)}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[option1, option2, option3, option4].map((opt, idx) => (
                            <div
                                key={idx}
                                onClick={() => setCorrectIndex(idx)}
                                className={`relative cursor-pointer p-0.5 rounded-xl border-2 transition-all ${correctIndex === idx
                                    ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                                    : 'border-transparent bg-slate-50 hover:bg-white hover:border-slate-200'
                                    }`}
                            >
                                {correctIndex === idx && (
                                    <div className="absolute -top-2 -right-2 z-10 bg-emerald-500 text-white p-0.5 rounded-full border-2 border-white shadow">
                                        <CheckCircle2 size={12} />
                                    </div>
                                )}
                                <div className="flex items-center gap-3 p-3">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${correctIndex === idx ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                        {String.fromCharCode(65 + idx)}
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full bg-transparent font-bold text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none"
                                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                        value={idx === 0 ? option1 : idx === 1 ? option2 : idx === 2 ? option3 : option4}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (idx === 0) setOption1(val);
                                            if (idx === 1) setOption2(val);
                                            if (idx === 2) setOption3(val);
                                            if (idx === 3) setOption4(val);
                                        }}
                                        onClick={e => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <textarea
                        className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none font-medium text-xs min-h-[60px] bg-slate-50/30 resize-none"
                        placeholder="Explanation (why the answer is correct)..."
                        value={explanation}
                        onChange={e => setExplanation(e.target.value)}
                    />

                    <button
                        onClick={handleAddQuestion}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all"
                    >
                        <Plus size={16} /> Add Question
                    </button>
                </div>
            )}

            {/* ── Questions Stack ── */}
            {questions.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <List size={14} className="text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Question Stack</span>
                        </div>
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{questions.length} Questions</span>
                    </div>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {questions.map((q, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start gap-3 group">
                                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 font-bold rounded-lg text-[10px] flex items-center justify-center shrink-0">
                                    #{idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-xs text-slate-700 leading-tight truncate">{q.text}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <CheckCircle2 size={10} className="text-emerald-500" />
                                        <span className="text-[10px] font-bold text-emerald-600 truncate">{q.options[q.correctAnswerIndex]}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveQuestion(idx)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Save & Assign Button ── */}
            <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-all">
                    Cancel
                </button>
                <button
                    onClick={handleSaveAndAssign}
                    disabled={isLoading || questions.length === 0 || !questTitle}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-200 transition-all"
                >
                    {isLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    ) : (
                        <><Save size={16} /> Save & Assign to Classroom</>
                    )}
                </button>
            </div>
        </div>
    );
};


/* ═══════════════════════════════════════════════════════════════
   ██  MAIN CLASSROOM MANAGER COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export const ClassroomManager: React.FC = () => {
    const [classrooms, setClassrooms]         = useState<any[]>([]);
    const [quests,     setQuests]             = useState<CustomQuest[]>([]);
    const [isLoading,  setIsLoading]          = useState(false);
    const [isCreating, setIsCreating]         = useState(false);
    const [newName,    setNewName]            = useState('');
    const [assigningId,setAssigningId]        = useState<string|null>(null);
    const [selQuestId, setSelQuestId]         = useState('');
    const [aTitle,     setATitle]             = useState('');
    const [aDesc,      setADesc]              = useState('');
    const [copiedCode, setCopiedCode]         = useState<string|null>(null);
    const [expandedId, setExpandedId]         = useState<string|null>(null);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<string|null>(null);
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [submissions,setSubmissions]        = useState<any[]>([]);
    const [grading,    setGrading]            = useState<Record<string,string>>({});
    const [proofModal, setProofModal]         = useState<string|null>(null);
    const [deletingSubId, setDeletingSubId]   = useState<string|null>(null);
    const [creatingHwId, setCreatingHwId]     = useState<string|null>(null);

    const token = () => localStorage.getItem('quest_token');
    const auth  = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` });

    /* fetch */
    const fetchClassrooms = async () => {
        setIsLoading(true);
        try {
            const r = await fetch('/api/classrooms', { headers: auth() });
            if (r.ok) { const d = await r.json(); setClassrooms(d.teaching||[]); }
        } catch(e){ console.error(e); }
        setIsLoading(false);
    };
    const fetchQuests = async () => {
        try { const r=await fetch('/api/quests'); if(r.ok) setQuests(await r.json()); } catch(e){}
    };
    const fetchSubs = async (classId:string) => {
        try {
            const r = await fetch(`/api/classrooms/${classId}/submissions`,{headers:auth()});
            if(r.ok) setSubmissions(await r.json());
        } catch(e){}
    };
    useEffect(()=>{ fetchClassrooms(); fetchQuests(); },[]);

    /* actions */
    const createClassroom = async () => {
        if(!newName.trim()) return;
        setIsLoading(true);
        const r = await fetch('/api/classrooms',{method:'POST',headers:auth(),body:JSON.stringify({name:newName})});
        if(r.ok){ setNewName(''); setIsCreating(false); fetchClassrooms(); }
        else alert('Failed to create classroom');
        setIsLoading(false);
    };

    const createAssignment = async () => {
        if(!assigningId||!aTitle) return alert('Title required');
        setIsLoading(true);
        const r = await fetch('/api/assignments',{method:'POST',headers:auth(),body:JSON.stringify({classroomId:assigningId,title:aTitle,description:aDesc,questId:selQuestId||''})});
        if(r.ok){ setAssigningId(null); setATitle(''); setADesc(''); setSelQuestId(''); fetchClassrooms(); }
        else alert('Failed to create assignment');
        setIsLoading(false);
    };

    const handleGrade = async (assignmentId:string, studentId:string) => {
        const score = grading[`${assignmentId}-${studentId}`];
        if(!score?.trim()) return alert('Enter a score');
        const r = await fetch(`/api/assignments/${assignmentId}/grade`,{method:'POST',headers:auth(),body:JSON.stringify({studentId,score:parseInt(score)})});
        if(r.ok){ if(expandedId) fetchSubs(expandedId); }
        else alert('Failed to grade');
    };

    const handleDeleteSub = async (subId:string) => {
        setDeletingSubId(subId);
        const r = await fetch(`/api/assignments/submissions/${subId}`,{method:'DELETE',headers:auth()});
        if(r.ok){
            setSubmissions(prev => prev.map(a=>({...a, submissions: a.submissions?.filter((s:any)=>s.id!==subId)})));
        } else alert('Failed to remove submission');
        setDeletingSubId(null);
    };

    const copyCode = (code:string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(()=>setCopiedCode(null), 2000);
    };

    if(isLoading && classrooms.length===0) return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={36}/>
            <p className="text-sm font-semibold text-slate-400">Loading classrooms…</p>
        </div>
    );

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-extrabold text-slate-800">My Classrooms</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{classrooms.length} active {classrooms.length===1?'class':'classes'}</p>
                </div>
                <button onClick={()=>setIsCreating(true)}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all">
                    <Plus size={16}/> New Classroom
                </button>
            </div>

            {/* ── Create classroom panel ── */}
            {isCreating && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="font-bold text-indigo-800 flex items-center gap-2"><GraduationCap size={16}/> New Classroom</p>
                        <button onClick={()=>setIsCreating(false)}><X size={16} className="text-slate-400"/></button>
                    </div>
                    <div className="flex gap-3">
                        <input type="text" placeholder="e.g., Form 4 Science A"
                            value={newName} onChange={e=>setNewName(e.target.value)}
                            onKeyDown={e=>e.key==='Enter'&&createClassroom()}
                            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 focus:outline-none bg-white font-medium text-sm"/>
                        <button onClick={createClassroom} disabled={!newName.trim()||isLoading}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all">
                            {isLoading?<Loader2 size={15} className="animate-spin"/>:'Create'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Create assignment panel (assign existing quest) ── */}
            {assigningId && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="font-bold text-orange-800 flex items-center gap-2"><ClipboardList size={16}/> Assign Existing Homework</p>
                        <button onClick={()=>setAssigningId(null)}><X size={16} className="text-slate-400"/></button>
                    </div>
                    <input type="text" placeholder="Assignment title *"
                        value={aTitle} onChange={e=>setATitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border-2 border-orange-200 focus:border-orange-400 focus:outline-none bg-white font-medium text-sm"/>
                    <textarea placeholder="Instructions (optional)" rows={2}
                        value={aDesc} onChange={e=>setADesc(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border-2 border-orange-200 focus:border-orange-400 focus:outline-none bg-white font-medium text-sm resize-none"/>
                    <select value={selQuestId} onChange={e=>setSelQuestId(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border-2 border-orange-200 bg-white font-medium text-sm">
                        <option value="">— Text assignment only —</option>
                        {quests.map(q=><option key={q.id} value={q.id}>{q.title}</option>)}
                    </select>
                    <div className="flex justify-end gap-3">
                        <button onClick={()=>setAssigningId(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50">Cancel</button>
                        <button onClick={createAssignment} disabled={!aTitle||isLoading}
                            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-sm shadow-orange-200 transition-all">
                            Assign to Class
                        </button>
                    </div>
                </div>
            )}

            {/* ── Empty state ── */}
            {classrooms.length===0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    <GraduationCap size={36} className="mx-auto mb-3 text-slate-300"/>
                    <p className="font-bold text-slate-500">No classrooms yet</p>
                    <p className="text-sm text-slate-400 mt-1">Create your first classroom to start assigning work.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {classrooms.map(cls => {
                        const isExp = expandedId===cls.id;
                        const isCreatingHw = creatingHwId === cls.id;
                        const needsReview = isExp ? submissions.reduce((n,a)=>n+(a.submissions?.filter((s:any)=>s.status==='submitted').length||0),0) : 0;
                        return (
                            <div key={cls.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                {/* ── Classroom row ── */}
                                <div className="p-4 flex flex-wrap items-center gap-3">
                                    {/* Avatar + name */}
                                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                                        <GraduationCap size={20} className="text-indigo-600"/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-extrabold text-slate-800 text-base leading-tight truncate">{cls.name}</h4>
                                        <div className="flex gap-3 text-xs font-semibold text-slate-400 mt-0.5">
                                            <span className="flex items-center gap-1"><Users size={11}/>{cls._count?.students||0} students</span>
                                            <span className="flex items-center gap-1"><ClipboardList size={11}/>{cls._count?.assignments||0} assignments</span>
                                            {isExp && needsReview>0 && <span className="flex items-center gap-1 text-amber-500"><AlertCircle size={11}/>{needsReview} need review</span>}
                                        </div>
                                    </div>

                                    {/* Join code */}
                                    <div className="shrink-0 text-center">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Join Code</p>
                                        <button onClick={()=>copyCode(cls.joinCode)}
                                            className="flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-xl font-mono font-extrabold text-indigo-600 text-sm transition-all">
                                            {cls.joinCode}
                                            {copiedCode===cls.joinCode
                                                ? <CheckCircle2 size={12} className="text-emerald-500"/>
                                                : <Copy size={12} className="text-slate-400"/>}
                                        </button>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                        <button
                                            onClick={() => {
                                                setCreatingHwId(isCreatingHw ? null : cls.id);
                                                setAssigningId(null);
                                            }}
                                            className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${isCreatingHw
                                                ? 'border-indigo-400 text-indigo-700 bg-indigo-50'
                                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                            }`}
                                        >
                                            <Plus size={13}/> Create Homework
                                        </button>
                                        <button onClick={()=>setAssigningId(cls.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 border border-orange-200 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-50 transition-all">
                                            <ClipboardList size={13}/> Assign Existing
                                        </button>
                                        <button onClick={()=>{
                                            if(isExp){ setExpandedId(null); }
                                            else { setExpandedId(cls.id); fetchSubs(cls.id); }
                                        }} className="flex items-center gap-1 px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-all">
                                            <Eye size={13}/>
                                            {isExp?'Hide':'Submissions'}
                                            {isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
                                        </button>
                                    </div>
                                </div>

                                {/* ── Inline Homework Creator ── */}
                                {isCreatingHw && (
                                    <HomeworkCreator
                                        classroomId={cls.id}
                                        classroomName={cls.name}
                                        onClose={() => setCreatingHwId(null)}
                                        onCreated={() => {
                                            setCreatingHwId(null);
                                            fetchClassrooms();
                                            fetchQuests();
                                        }}
                                    />
                                )}

                                {/* ── Submissions panel ── */}
                                {isExp && (() => {
                                    const activeId = selectedAssignmentId || submissions[0]?.id;
                                    const activeAssignment = submissions.find(a => a.id === activeId);

                                    return (
                                        <div className="border-t border-slate-100 bg-slate-50 p-6">
                                            {submissions.length===0 ? (
                                                <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                                    <FileText size={32} className="mx-auto mb-3 opacity-30"/>
                                                    <p className="text-base font-semibold">No assignments yet.</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col md:flex-row gap-6">
                                                    {/* Tabs Sidebar */}
                                                    <div className="w-full md:w-1/3 flex flex-col gap-3">
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Assignments</h4>
                                                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                                                            {submissions.map(a => {
                                                                const isSelected = a.id === activeId;
                                                                const total  = a.submissions?.length||0;
                                                                const graded = a.submissions?.filter((s:any)=>s.status==='completed').length||0;
                                                                const hasPending = a.submissions?.some((s:any)=>s.status==='submitted');

                                                                return (
                                                                    <button
                                                                        key={a.id}
                                                                        onClick={() => setSelectedAssignmentId(a.id)}
                                                                        className={`flex items-start flex-col gap-2 w-full text-left p-4 rounded-2xl transition-all border ${
                                                                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                                                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center justify-between w-full">
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                <BookOpen size={18} className={`shrink-0 ${isSelected?'text-indigo-200':'text-indigo-400'}`}/>
                                                                                <span className={`font-bold text-base truncate ${isSelected?'text-white':'text-slate-800'}`}>{a.title}</span>
                                                                            </div>
                                                                            {hasPending && <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 shadow-sm" />}
                                                                        </div>
                                                                        <div className={`text-xs font-bold ${isSelected?'text-indigo-200':'text-slate-400'}`}>
                                                                            {graded}/{total} Graded
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Active Assignment Submissions */}
                                                    <div className="w-full md:w-2/3">
                                                        {activeAssignment && (() => {
                                                            const a = activeAssignment;
                                                            const total = a.submissions?.length || 0;
                                                            return (
                                                                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md">
                                                                    <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <h3 className="font-display font-bold text-xl text-slate-800">Student Submissions</h3>
                                                                            <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">{total} total</span>
                                                                        </div>
                                                                        <div className="relative">
                                                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                                                            <input 
                                                                                type="text" 
                                                                                placeholder="Search students..." 
                                                                                value={studentSearchQuery}
                                                                                onChange={(e) => setStudentSearchQuery(e.target.value)}
                                                                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 shadow-sm w-full sm:w-64"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    {total === 0 ? (
                                                                        <p className="text-base text-slate-400 italic px-6 py-12 text-center">No submissions yet for this assignment.</p>
                                                                    ) : (
                                                                        <div className="divide-y divide-slate-100">
                                                                            {a.submissions
                                                                                .filter((sub:any) => sub.student?.name?.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                                                                                .map((sub:any) => {
                                                                                const key = `${a.id}-${sub.studentId}`;
                                                                                const cur = grading[key] ?? (sub.score!=null ? String(sub.score) : '');
                                                                                const isDeleting = deletingSubId===sub.id;
                                                                                return (
                                                                                    <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 gap-4 hover:bg-slate-50 transition-colors">
                                                                                        {/* student info */}
                                                                                        <div className="flex items-center gap-4 min-w-0">
                                                                                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 shadow-inner border border-indigo-200">
                                                                                                <span className="text-lg font-extrabold text-indigo-600">
                                                                                                    {(sub.student?.name||'S').charAt(0).toUpperCase()}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div>
                                                                                                <span className="text-base font-bold text-slate-700 truncate block mb-1">{sub.student?.name||'Student'}</span>
                                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                                    <StatusBadge status={sub.status||'pending'}/>
                                                                                                    {sub.proofUrl && (
                                                                                                        <button onClick={()=>setProofModal(sub.proofUrl)} className="text-xs text-indigo-500 hover:text-indigo-600 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                                                                                                            <ImageIcon size={12}/> View Proof
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        
                                                                                        {/* actions */}
                                                                                        <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-0">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <input type="number" placeholder="0-100" value={cur} min="0" max="100"
                                                                                                    onChange={e=>setGrading({...grading,[key]:e.target.value})}
                                                                                                    className="w-20 px-3 py-2 text-center text-sm font-bold rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none transition-colors shadow-sm"/>
                                                                                                <button onClick={()=>handleGrade(a.id,sub.studentId)}
                                                                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md shrink-0">
                                                                                                    Save
                                                                                                </button>
                                                                                            </div>
                                                                                            <button
                                                                                                onClick={()=>handleDeleteSub(sub.id)}
                                                                                                disabled={isDeleting}
                                                                                                title="Remove submission"
                                                                                                className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-40 shrink-0">
                                                                                                {isDeleting ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Proof modal ── */}
            {proofModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={()=>setProofModal(null)}>
                    <div className="relative max-w-lg w-full" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setProofModal(null)} className="absolute -top-9 right-0 text-white/80 hover:text-white text-sm font-bold flex items-center gap-1">
                            <X size={15}/> Close
                        </button>
                        <img src={proofModal} alt="Proof" className="w-full rounded-2xl shadow-2xl border-4 border-white/10"/>
                    </div>
                </div>
            )}
        </div>
    );
};
