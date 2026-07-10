import React, { useState, useEffect } from 'react';
import { Question, CustomQuest, Subject, GradeLevel, Syllabus } from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { Plus, Trash2, Save, ArrowLeft, BookOpen, CheckCircle, HelpCircle, Loader2, Sparkles, Layout, List, Settings, Info, CheckCircle2, Users, Gift, GraduationCap, ArrowRight, BarChart3 } from 'lucide-react';
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

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <Loader2 className="animate-spin text-brand-orange" size={40} />
                <p className="text-brand-dark/60">Loading your profile...</p>
            </div>
        );
    }

    const [quests, setQuests] = useState<CustomQuest[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [questTitle, setQuestTitle] = useState('');
    const [questSubject, setQuestSubject] = useState<Subject | ''>('');
    const [questGrade, setQuestGrade] = useState<GradeLevel | ''>('');
    const [questSyllabus, setQuestSyllabus] = useState<Syllabus | ''>(() => {
        const subLevel = (user as any)?.subscriptionLevel;
        const subSyllabus = (user as any)?.subscribedSyllabus;
        return (user?.isSubscribed && subLevel === 'single' && subSyllabus) ? subSyllabus as Syllabus : '';
    });

    // Returns subjects available for the selected grade level and syllabus
    const getSubjectsByGrade = (grade: GradeLevel | '', syllabus: Syllabus | ''): Subject[] => {
        const allSubjects = Object.values(Subject);
        if (!grade) return allSubjects;

        // ── UEC (Unified Examination Certificate) ───────
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

        // ── IB (International Baccalaureate) ───────
        if (syllabus === 'International Baccalaureate (IB)') {
            // PYP: Year 1-6
            if ([GradeLevel.YEAR_1, GradeLevel.YEAR_2, GradeLevel.YEAR_3,
            GradeLevel.YEAR_4, GradeLevel.YEAR_5, GradeLevel.YEAR_6].includes(grade as GradeLevel)) {
                return [Subject.ENGLISH, Subject.MATH, Subject.SCIENCE];
            }
            // MYP: Year 7-11
            if ([GradeLevel.YEAR_7, GradeLevel.YEAR_8, GradeLevel.YEAR_9,
            GradeLevel.YEAR_10, GradeLevel.YEAR_11].includes(grade as GradeLevel)) {
                return [Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH, Subject.SCIENCE,
                Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY,
                Subject.GEOGRAPHY, Subject.SEJARAH, Subject.ECONOMICS, Subject.COMPUTER_SCIENCE];
            }
            // DP: Year 12-13
            if ([GradeLevel.YEAR_12, GradeLevel.YEAR_13].includes(grade as GradeLevel)) {
                return [Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS,
                Subject.CHEMISTRY, Subject.BIOLOGY, Subject.GEOGRAPHY,
                Subject.ECONOMICS, Subject.BUSINESS, Subject.COMPUTER_SCIENCE];
            }
        }

        // Lower Primary: Standard 1-3
        if ([GradeLevel.STD_1, GradeLevel.STD_2, GradeLevel.STD_3].includes(grade as GradeLevel)) {
            return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.SCIENCE,
            Subject.PENDIDIKAN_ISLAM, Subject.PENDIDIKAN_MORAL];
        }
        // Upper Primary: Standard 4-6
        if ([GradeLevel.STD_4, GradeLevel.STD_5, GradeLevel.STD_6].includes(grade as GradeLevel)) {
            return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.SCIENCE,
            Subject.SEJARAH, Subject.RBT, Subject.PENDIDIKAN_ISLAM, Subject.PENDIDIKAN_MORAL];
        }
        // Lower Secondary: Form 1-3
        if ([GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3].includes(grade as GradeLevel)) {
            return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.SCIENCE,
            Subject.SEJARAH, Subject.GEOGRAPHY, Subject.RBT,
            Subject.PENDIDIKAN_ISLAM, Subject.PENDIDIKAN_MORAL, Subject.COMPUTER_SCIENCE];
        }
        // Upper Secondary: Form 4-5
        if ([GradeLevel.FORM_4, GradeLevel.FORM_5].includes(grade as GradeLevel)) {
            return [Subject.BAHASA_MELAYU, Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH,
            Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY, Subject.SEJARAH,
            Subject.GEOGRAPHY, Subject.PENDIDIKAN_ISLAM, Subject.PENDIDIKAN_MORAL,
            Subject.ECONOMICS, Subject.BUSINESS, Subject.COMPUTER_SCIENCE];
        }
        // Form 6 / STPM
        if (grade === GradeLevel.FORM_6) {
            return [Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS, Subject.CHEMISTRY,
            Subject.BIOLOGY, Subject.ECONOMICS, Subject.BUSINESS,
            Subject.BAHASA_MELAYU, Subject.ENGLISH];
        }
        // Singapore Secondary (Sec 1-5)
        if ([GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3,
        GradeLevel.SEC_4, GradeLevel.SEC_5].includes(grade as GradeLevel)) {
            return [Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH, Subject.SCIENCE,
            Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY,
            Subject.GEOGRAPHY, Subject.SEJARAH, Subject.ECONOMICS,
            Subject.BUSINESS, Subject.COMPUTER_SCIENCE];
        }
        // International primary (Year 1-6)
        if ([GradeLevel.YEAR_1, GradeLevel.YEAR_2, GradeLevel.YEAR_3,
        GradeLevel.YEAR_4, GradeLevel.YEAR_5, GradeLevel.YEAR_6].includes(grade as GradeLevel)) {
            return [Subject.ENGLISH, Subject.MATH, Subject.SCIENCE];
        }
        // IGCSE / Year 7-11
        if ([GradeLevel.YEAR_7, GradeLevel.YEAR_8, GradeLevel.YEAR_9,
        GradeLevel.YEAR_10, GradeLevel.YEAR_11].includes(grade as GradeLevel)) {
            return [Subject.ENGLISH, Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS,
            Subject.CHEMISTRY, Subject.BIOLOGY, Subject.GEOGRAPHY,
            Subject.ECONOMICS, Subject.BUSINESS, Subject.COMPUTER_SCIENCE];
        }
        // A-Level / Year 12-13
        if ([GradeLevel.YEAR_12, GradeLevel.YEAR_13].includes(grade as GradeLevel)) {
            return [Subject.MATH, Subject.ADD_MATH, Subject.PHYSICS, Subject.CHEMISTRY,
            Subject.BIOLOGY, Subject.ECONOMICS, Subject.BUSINESS,
            Subject.COMPUTER_SCIENCE, Subject.ENGLISH];
        }
        return allSubjects;
    };
    const [questions, setQuestions] = useState<Question[]>([]);

    // Current Question Form State
    const [currentQText, setCurrentQText] = useState('');
    const [option1, setOption1] = useState('');
    const [option2, setOption2] = useState('');
    const [option3, setOption3] = useState('');
    const [option4, setOption4] = useState('');
    const [correctIndex, setCorrectIndex] = useState(0);
    const [explanation, setExplanation] = useState('');

    const fetchQuests = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/quests');
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
    }, [user, isCreating]);

    const handleAddQuestion = () => {        if (!currentQText || !option1 || !option2 || !option3 || !option4 || !explanation) {
            alert("Please fill in all fields for the question.");
            return;
        }

        const newQuestion: Question = {
            id: `q-${Date.now()}`,
            text: currentQText,
            options: [option1, option2, option3, option4],
            correctAnswerIndex: correctIndex,
            explanation: explanation
        };

        setQuestions([...questions, newQuestion]);

        // Reset form
        setCurrentQText('');
        setOption1('');
        setOption2('');
        setOption3('');
        setOption4('');
        setCorrectIndex(0);
        setExplanation('');
    };

    const handleRemoveQuestion = (index: number) => {
        const newQuestions = [...questions];
        newQuestions.splice(index, 1);
        setQuestions(newQuestions);
    };

    const handleSaveQuest = async () => {
        if (!questTitle || !questSubject || !questGrade || !questSyllabus) {
            alert("Please enter title, subject, grade, and syllabus.");
            return;
        }

        const subLevel = (user as any)?.subscriptionLevel;
        const subSyllabus = (user as any)?.subscribedSyllabus;

        if (user?.isSubscribed && subLevel === 'single' && questSyllabus !== subSyllabus) {
            alert(`Your current plan only allows creating quests for the ${subSyllabus} syllabus. Please upgrade to "All Syllabus" for full access.`);
            return;
        }
        if (questions.length === 0) {
            alert("Please add at least one question.");
            return;
        }

        setIsLoading(true);
        const token = localStorage.getItem('quest_token');

        try {
            const res = await fetch('/api/quests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: questTitle,
                    subject: questSubject,
                    grade: questGrade,
                    syllabus: questSyllabus,
                    questions: questions
                })
            });

            if (res.ok) {
                alert("Homework saved successfully!");
                setIsCreating(false);
                setQuestTitle('');
                setQuestSubject('');
                setQuestGrade('');
                setQuestSyllabus((user as any)?.subscriptionLevel === 'single' ? (user as any)?.subscribedSyllabus : '');
                setQuestions([]);
                fetchQuests(); // Refresh the list
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            console.error("Failed to save quest", error);
            alert("Failed to save homework.");
        }
        setIsLoading(false);
    };

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

    if (isCreating) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-float">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                            <ArrowLeft size={20} /> Cancel
                        </Button>
                        <h2 className="text-3xl font-display font-bold text-brand-dark">Create Homework</h2>
                    </div>
                    <Button onClick={handleSaveQuest} disabled={questions.length === 0 || isLoading} className="bg-brand-green hover:bg-green-600">
                        {isLoading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2" size={20} /> Save Homework</>}
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Quest Setup & Questions Preview */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Section 1: Details */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-brand-dark/40 mb-2">
                                <Settings size={14} className="uppercase tracking-widest" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Homework Configuration</span>
                            </div>

                            <Card className="p-5 space-y-4 bg-white/80 backdrop-blur-sm border-brand-dark/5 shadow-sm">
                                <div>
                                    <label className="label-text">Homework Title</label>
                                    <input
                                        type="text"
                                        value={questTitle}
                                        onChange={(e) => setQuestTitle(e.target.value)}
                                        placeholder="e.g., Solar System Mastery"
                                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-bold text-base"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="label-text">Syllabus</label>
                                        <select
                                            value={questSyllabus}
                                            onChange={(e) => {
                                                setQuestSyllabus(e.target.value as Syllabus);
                                                setQuestGrade(''); // reset grade
                                                setQuestSubject('');
                                            }}
                                            disabled={(user as any)?.subscriptionLevel === 'single'}
                                            className={`w-full p-2.5 rounded-xl border-2 border-brand-dark/10 font-bold text-sm ${(user as any)?.subscriptionLevel === 'single' ? 'bg-gray-100 opacity-60' : 'bg-white'}`}
                                        >
                                            <option value="">Select Syllabus</option>
                                            {Object.values(Syllabus).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="label-text">Grade</label>
                                            <select
                                                value={questGrade}
                                                onChange={(e) => {
                                                    setQuestGrade(e.target.value as GradeLevel);
                                                    setQuestSubject('');
                                                }}
                                                disabled={!questSyllabus}
                                                className={`w-full p-2.5 rounded-xl border-2 border-brand-dark/10 font-bold text-sm ${!questSyllabus ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white'}`}
                                            >
                                                <option value="">Grade</option>
                                                {/* (Keep existing grade mapping logic) */}
                                                {questSyllabus === 'Unified Examination Certificate (UEC)'
                                                    ? [GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3, GradeLevel.FORM_4, GradeLevel.FORM_5, GradeLevel.FORM_6].map(g => <option key={g} value={g}>{g}</option>)
                                                    : questSyllabus === 'Malaysian National Curriculum (KSSR/KSSM)'
                                                        ? [...[GradeLevel.STD_1, GradeLevel.STD_2, GradeLevel.STD_3, GradeLevel.STD_4, GradeLevel.STD_5, GradeLevel.STD_6], ...[GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3, GradeLevel.FORM_4, GradeLevel.FORM_5, GradeLevel.FORM_6]].map(g => <option key={g} value={g}>{g}</option>)
                                                        : questSyllabus === 'Singapore MOE Syllabus (PSLE/O-Level)'
                                                            ? [...[GradeLevel.STD_1, GradeLevel.STD_2, GradeLevel.STD_3, GradeLevel.STD_4, GradeLevel.STD_5, GradeLevel.STD_6], ...[GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3, GradeLevel.SEC_4, GradeLevel.SEC_5]].map(g => <option key={g} value={g}>{g}</option>)
                                                            : questSyllabus === 'Cambridge IGCSE' || questSyllabus === 'International Baccalaureate (IB)'
                                                                ? [GradeLevel.YEAR_1, GradeLevel.YEAR_2, GradeLevel.YEAR_3, GradeLevel.YEAR_4, GradeLevel.YEAR_5, GradeLevel.YEAR_6, GradeLevel.YEAR_7, GradeLevel.YEAR_8, GradeLevel.YEAR_9, GradeLevel.YEAR_10, GradeLevel.YEAR_11, GradeLevel.YEAR_12, GradeLevel.YEAR_13].map(g => <option key={g} value={g}>{g}</option>)
                                                                : Object.values(GradeLevel).map(g => <option key={g} value={g}>{g}</option>)
                                                }
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label-text">Subject</label>
                                            <select
                                                value={questSubject}
                                                onChange={(e) => setQuestSubject(e.target.value as Subject)}
                                                disabled={!questGrade}
                                                className={`w-full p-2.5 rounded-xl border-2 border-brand-dark/10 font-bold text-sm ${!questGrade ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white'}`}
                                            >
                                                <option value="">Subject</option>
                                                {getSubjectsByGrade(questGrade, questSyllabus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Section 2: Questions Preview List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-brand-dark/40 mb-2">
                                <div className="flex items-center gap-2">
                                    <List size={14} className="uppercase tracking-widest" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Question Stack</span>
                                </div>
                                <span className="text-[10px] font-bold bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">{questions.length} Items</span>
                            </div>

                            <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2 pb-10">
                                {questions.length === 0 ? (
                                    <div className="text-center p-8 border-2 border-dashed border-brand-dark/10 rounded-2xl bg-white/30 text-brand-dark/30">
                                        <div className="mb-2 opacity-20 flex justify-center"><BookOpen size={30} /></div>
                                        <p className="text-xs font-bold">Your questions will appear here as you add them.</p>
                                    </div>
                                ) : (
                                    questions.map((q, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-brand-dark/5 relative group animate-pop-in">
                                            <button
                                                onClick={() => handleRemoveQuestion(idx)}
                                                className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-1.5 rounded-lg shadow-sm"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <div className="flex gap-3">
                                                <div className="flex-shrink-0 w-6 h-6 bg-brand-blue/10 text-brand-blue font-bold rounded-lg text-[10px] flex items-center justify-center">
                                                    #{idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-[13px] text-brand-dark leading-tight mb-2 truncate">{q.text}</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle2 size={12} className="text-brand-green" />
                                                        <span className="text-[11px] font-bold text-brand-green truncate">{q.options[q.correctAnswerIndex]}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Question Content Creation */}
                    <div className="lg:col-span-8">
                        <div className="flex items-center gap-2 text-brand-dark/40 mb-4">
                            <Sparkles size={14} className="uppercase tracking-widest" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Content Creator</span>
                        </div>

                        <Card className="p-8 space-y-8 bg-white border-brand-dark/5 shadow-xl relative overflow-hidden">
                            {/* Question Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-brand-dark/60 uppercase tracking-widest">Question Text</label>
                                    {currentQText.length > 0 && <span className="text-[10px] font-bold text-brand-blue">{currentQText.length} characters</span>}
                                </div>
                                <textarea
                                    className="w-full p-5 rounded-2xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-bold text-lg min-h-[140px] shadow-inner bg-gray-50/30 transition-all resize-none"
                                    placeholder="Write your brilliant question here..."
                                    value={currentQText}
                                    onChange={(e) => setCurrentQText(e.target.value)}
                                />
                            </div>

                            {/* Options Section */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-brand-dark/60 uppercase tracking-widest flex items-center gap-2">
                                    Multiple Choice Options <Info size={14} className="opacity-40" />
                                </label>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[option1, option2, option3, option4].map((opt, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setCorrectIndex(idx)}
                                            className={`relative group cursor-pointer p-1 rounded-2xl border-2 transition-all duration-300 ${correctIndex === idx ? 'border-brand-green bg-green-50 shadow-md transform scale-[1.02]' : 'border-transparent bg-gray-50/50 hover:bg-white hover:border-brand-dark/10'}`}
                                        >
                                            <div className="absolute -top-3 -right-3 z-10 transition-transform duration-300 transform scale-0 group-hover:scale-100" style={{ transform: correctIndex === idx ? 'scale(1)' : undefined }}>
                                                {correctIndex === idx ? (
                                                    <div className="bg-brand-green text-white p-1 rounded-full shadow-lg border-2 border-white"><CheckCircle2 size={16} /></div>
                                                ) : (
                                                    <div className="bg-white text-brand-dark/20 p-1 rounded-full shadow-sm border-2 border-brand-dark/5 group-hover:text-brand-green"><CheckCircle size={16} /></div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 p-4">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-colors ${correctIndex === idx ? 'bg-brand-green text-white' : 'bg-brand-dark/5 text-brand-dark/30'}`}>
                                                    {String.fromCharCode(65 + idx)}
                                                </div>
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent font-bold text-brand-dark placeholder:text-brand-dark/20 focus:outline-none"
                                                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                                    value={idx === 0 ? option1 : idx === 1 ? option2 : idx === 2 ? option3 : option4}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (idx === 0) setOption1(val);
                                                        if (idx === 1) setOption2(val);
                                                        if (idx === 2) setOption3(val);
                                                        if (idx === 3) setOption4(val);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Explanation Section */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-brand-dark/60 uppercase tracking-widest">Explanation (Optional)</label>
                                <textarea
                                    className="w-full p-4 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium text-sm min-h-[100px] bg-gray-50/30 shadow-inner"
                                    placeholder="Explain why the answer is correct..."
                                    value={explanation}
                                    onChange={(e) => setExplanation(e.target.value)}
                                />
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row gap-4">
                                <Button
                                    fullWidth
                                    size="lg"
                                    variant="secondary"
                                    onClick={handleAddQuestion}
                                    className="py-6 text-lg font-bold shadow-lg transition-all bg-brand-blue hover:bg-blue-600 shadow-brand-blue/20"
                                >
                                    <><Plus className="mr-2" /> Add Question to Homework</>
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>

                <style>{`
            .label-text {
                @apply block text-xs font-bold text-brand-dark/60 uppercase mb-2 ml-1;
            }
            .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                @apply bg-brand-dark/10 rounded-full;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                @apply bg-brand-dark/20;
            }
            @keyframes pop-in {
                0% { transform: scale(0.95); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
            .animate-pop-in {
                animation: pop-in 0.3s ease-out forwards;
            }
        `}</style>
            </div>
        );
    }


    const canCreate = true;
    const [dashTab, setDashTab] = useState<'homework' | 'rewards' | 'analytics'>('homework');
    const token = localStorage.getItem('quest_token') || '';

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
                    <Button onClick={() => setIsCreating(true)}>
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
