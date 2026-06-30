import React from 'react';
import { Subject, GradeLevel, Syllabus } from '../types';
import { Card } from './Card';
import { BookOpen, Search, GraduationCap } from 'lucide-react';

interface SyllabusExplorerProps {
    onSelectSubject: (subject: Subject, syllabus: Syllabus) => void;
}

const REGIONS = [
    { id: 'malaysia', name: 'Malaysia 🇲🇾', icon: 'MY', syllabus: Syllabus.KSSR_KSSM },
    { id: 'singapore', name: 'Singapore 🇸🇬', icon: 'SG', syllabus: Syllabus.MOE_SINGAPORE },
    { id: 'international', name: 'International 🌍', icon: 'INT', syllabus: Syllabus.IGCSE },
];

const SUBJECT_DATA: Record<string, { name: string; subjects: any[] }[]> = {
    malaysia: [
        {
            name: 'Primary (Standard 1-6)',
            subjects: [
                { id: Subject.BAHASA_MELAYU, label: 'Bahasa Melayu', icon: 'BM', color: 'bg-yellow-100 text-yellow-700' },
                { id: Subject.ENGLISH, label: 'English', icon: 'BI', color: 'bg-indigo-100 text-indigo-700' },
                { id: Subject.MATH, label: 'Mathematics', icon: '➗', color: 'bg-blue-100 text-blue-700' },
                { id: Subject.SCIENCE, label: 'Science', icon: '🧬', color: 'bg-green-100 text-green-700' },
            ]
        },
        {
            name: 'Secondary (Form 1-5)',
            subjects: [
                { id: Subject.SEJARAH, label: 'Sejarah', icon: '🏛️', color: 'bg-orange-100 text-orange-700' },
                { id: Subject.GEOGRAPHY, label: 'Geography', icon: '🌍', color: 'bg-emerald-100 text-emerald-700' },
                { id: Subject.PHYSICS, label: 'Physics', icon: '⚛️', color: 'bg-purple-100 text-purple-700' },
                { id: Subject.CHEMISTRY, label: 'Chemistry', icon: '🧪', color: 'bg-lime-100 text-lime-700' },
                { id: Subject.BIOLOGY, label: 'Biology', icon: '🦠', color: 'bg-teal-100 text-teal-700' },
                { id: Subject.ADD_MATH, label: 'Add Maths', icon: '∫dx', color: 'bg-red-100 text-red-700' },
            ]
        }
    ],
    singapore: [
        {
            name: 'Primary (P1-P6)',
            subjects: [
                { id: Subject.ENGLISH, label: 'English', icon: 'EN', color: 'bg-indigo-100 text-indigo-700' },
                { id: Subject.MATH, label: 'Mathematics', icon: '➗', color: 'bg-blue-100 text-blue-700' },
                { id: Subject.SCIENCE, label: 'Science', icon: '🧬', color: 'bg-green-100 text-green-700' },
                { id: Subject.BAHASA_MELAYU, label: 'Malay (MT)', icon: 'ML', color: 'bg-yellow-100 text-yellow-700' },
            ]
        },
        {
            name: 'Secondary (Sec 1-4/5)',
            subjects: [
                { id: Subject.ENGLISH, label: 'English', icon: 'EN', color: 'bg-indigo-100 text-indigo-700' },
                { id: Subject.MATH, label: 'Mathematics', icon: '➗', color: 'bg-blue-100 text-blue-700' },
                { id: Subject.ADD_MATH, label: 'Add Maths', icon: '∫dx', color: 'bg-red-100 text-red-700' },
                { id: Subject.PHYSICS, label: 'Physics', icon: '⚛️', color: 'bg-purple-100 text-purple-700' },
                { id: Subject.CHEMISTRY, label: 'Chemistry', icon: '🧪', color: 'bg-lime-100 text-lime-700' },
                { id: Subject.BIOLOGY, label: 'Biology', icon: '🦠', color: 'bg-teal-100 text-teal-700' },
            ]
        }
    ],
    international: [
        {
            name: 'Secondary (IGCSE)',
            subjects: [
                { id: Subject.ENGLISH, label: 'English (0500)', icon: '🇬🇧', color: 'bg-indigo-100 text-indigo-700' },
                { id: Subject.MATH, label: 'Maths (0580)', icon: '➗', color: 'bg-blue-100 text-blue-700' },
                { id: Subject.ADD_MATH, label: 'Add Maths (0606)', icon: '∫dx', color: 'bg-red-100 text-red-700' },
                { id: Subject.PHYSICS, label: 'Physics (0625)', icon: '⚛️', color: 'bg-purple-100 text-purple-700' },
                { id: Subject.CHEMISTRY, label: 'Chemistry (0620)', icon: '🧪', color: 'bg-lime-100 text-lime-700' },
                { id: Subject.BIOLOGY, label: 'Biology (0610)', icon: '🦠', color: 'bg-teal-100 text-teal-700' },
            ]
        },
        {
            name: 'Advanced (A-Level)',
            subjects: [
                { id: Subject.ECONOMICS, label: 'Economics', icon: '📉', color: 'bg-amber-100 text-amber-700' },
                { id: Subject.BUSINESS, label: 'Business', icon: '💼', color: 'bg-slate-100 text-slate-700' },
                { id: Subject.COMPUTER_SCIENCE, label: 'Comp Science', icon: '💻', color: 'bg-cyan-100 text-cyan-700' },
            ]
        }
    ]
};

export const SyllabusExplorer: React.FC<SyllabusExplorerProps> = ({ onSelectSubject }) => {
    const [selectedRegion, setSelectedRegion] = React.useState('malaysia');

    return (
        <section id="courses" className="py-12 md:py-16 px-4 max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-4">
                <div className="space-y-2">
                    <h2 className="text-3xl md:text-4xl font-display font-bold text-brand-dark">Search Syllabuses</h2>
                    <p className="text-sm md:text-base text-brand-dark/60 max-w-xl mx-auto">
                        Select region to explore optimized revision topics.
                    </p>
                </div>

                {/* Region Selector */}
                <div className="flex justify-center gap-3">
                    {REGIONS.map((region) => (
                        <button
                            key={region.id}
                            onClick={() => setSelectedRegion(region.id)}
                            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${selectedRegion === region.id
                                ? 'bg-brand-orange text-white shadow-lg'
                                : 'bg-white text-brand-dark/50 hover:bg-brand-orange/5'
                                }`}
                        >
                            <span className="text-xl">{region.icon === 'MY' ? '🇲🇾' : (region.id === 'singapore' ? '🇸🇬' : '🌍')}</span>
                            {region.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {SUBJECT_DATA[selectedRegion].map((group) => (
                    <div key={group.name} className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-brand-dark/80">
                            <GraduationCap className="text-brand-orange w-5 h-5" /> {group.name}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {group.subjects.map((sub) => (
                                <button
                                    key={sub.id}
                                    onClick={() => onSelectSubject(sub.id, REGIONS.find(r => r.id === selectedRegion)?.syllabus || Syllabus.KSSR_KSSM)}
                                    className="group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl bg-white border border-transparent shadow-sm hover:border-brand-orange/20 hover:shadow-md transition-all duration-300"
                                >
                                    <div className={`w-10 h-10 md:w-12 md:h-12 ${sub.color.split(' ')[0]} rounded-lg flex items-center justify-center text-xl md:text-2xl mb-2 group-hover:scale-110 transition-transform`}>
                                        {sub.icon}
                                    </div>
                                    <span className={`font-bold text-xs md:text-sm text-center ${sub.color.split(' ')[1]}`}>{sub.label}</span>
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Search size={12} className="text-brand-orange" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-brand-blue/5 p-6 rounded-3xl border border-brand-blue/10 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 space-y-2 text-center md:text-left">
                    <h4 className="text-xl font-bold">New subjects every week</h4>
                    <p className="text-sm text-brand-dark/60">Akshara Music Hub is updated daily with MOE and IGCSE trends.</p>
                </div>
            </div>
        </section>
    );
};
