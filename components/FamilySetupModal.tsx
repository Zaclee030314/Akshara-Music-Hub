import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';
import { Card } from './Card';
import { Button } from './Button';
import { X, Plus, Trash2, Loader2, Users } from 'lucide-react';
import { Syllabus } from '../types';
import { getGradesBySyllabus } from '../lib/curriculum';

// Converts a single-student account into a parent account with one profile per
// child. The current learner becomes profile #1 (keeps XP, results, grade).

interface ChildRow { name: string; birthday: string; gradeSyllabus: string; grade: string; }

interface Props {
    currentName: string;
    parentName: string;
    /** Children already recorded in the family details form (pre-fills the extra rows). */
    knownChildren: Array<{ name: string; birthday: string }>;
    onClose: () => void;
}

const gradesFor = (syllabus: string): string[] => {
    try {
        const g = getGradesBySyllabus(syllabus as Syllabus);
        return [...g.primary, ...g.secondary, ...(g.advanced || [])];
    } catch { return []; }
};

export const FamilySetupModal: React.FC<Props> = ({ currentName, parentName, knownChildren, onClose }) => {
    const { refreshUser } = useAuth();
    const { t } = useT();
    const navigate = useNavigate();

    const [firstProfileName, setFirstProfileName] = useState(currentName);
    const [parentDisplayName, setParentDisplayName] = useState(parentName);
    const [children, setChildren] = useState<ChildRow[]>(() =>
        knownChildren
            .filter(c => c.name.trim() && c.name.trim().toLowerCase() !== currentName.trim().toLowerCase())
            .map(c => ({ name: c.name, birthday: c.birthday, gradeSyllabus: '', grade: '' }))
    );
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, submitting]);

    const update = (idx: number, patch: Partial<ChildRow>) =>
        setChildren(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirm(t('family.setupConfirmPrompt'))) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/family/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('quest_token')}`
                },
                body: JSON.stringify({
                    firstProfileName,
                    parentName: parentDisplayName,
                    children: children
                        .filter(c => c.name.trim())
                        .map(c => ({
                            name: c.name.trim(),
                            birthday: c.birthday,
                            gradeSyllabus: c.gradeSyllabus || undefined,
                            grade: c.grade || undefined
                        }))
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || t('family.saveError'));
                return;
            }
            // Re-bootstrap the session as the new parent account.
            localStorage.setItem('quest_token', data.token);
            localStorage.removeItem('quest_parent_token');
            localStorage.setItem('quest_user_role', JSON.stringify({ role: 'parent', isAdmin: false }));
            await refreshUser();
            onClose();
            navigate('/profiles');
        } catch {
            alert(t('family.saveError'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-brand-dark/60 backdrop-blur-sm flex justify-center p-4 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
        >
            <Card className="w-full max-w-2xl m-auto p-6 md:p-8 shadow-2xl relative bg-white">
                <button type="button" onClick={onClose} disabled={submitting} aria-label={t('common.close')}
                    className="absolute top-3 right-3 z-10 p-2.5 rounded-full text-brand-dark/50 hover:text-brand-dark hover:bg-brand-dark/5 transition-colors">
                    <X size={22} />
                </button>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2 pr-8">
                        <h2 className="text-2xl font-display font-bold text-brand-dark flex items-center gap-2"><Users className="text-brand-blue" /> {t('family.setupTitle')}</h2>
                        <p className="text-sm text-brand-dark/60">{t('family.setupDesc')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('family.parentDisplayName')}</label>
                            <input value={parentDisplayName} onChange={e => setParentDisplayName(e.target.value)} required maxLength={60}
                                className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-bold" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('family.firstProfile')}</label>
                            <input value={firstProfileName} onChange={e => setFirstProfileName(e.target.value)} required maxLength={60}
                                className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-bold" />
                            <p className="text-[11px] text-brand-dark/40">{t('family.firstProfileHint')}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('family.otherChildren')}</label>
                        {children.length === 0 && <p className="text-sm text-brand-dark/40 italic">{t('family.noOtherChildren')}</p>}
                        {children.map((c, idx) => (
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2 items-end bg-brand-dark/[0.03] p-3 rounded-2xl">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-dark/40 uppercase">{t('family.name')}</label>
                                    <input value={c.name} onChange={e => update(idx, { name: e.target.value })} required maxLength={60}
                                        className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-dark/40 uppercase">{t('family.birthday')}</label>
                                    <input type="date" value={c.birthday} onChange={e => update(idx, { birthday: e.target.value })} required
                                        className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium min-h-[44px]" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-dark/40 uppercase">{t('family.syllabus')}</label>
                                    <select value={c.gradeSyllabus} onChange={e => update(idx, { gradeSyllabus: e.target.value, grade: '' })}
                                        className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 bg-white focus:border-brand-blue focus:outline-none font-medium">
                                        <option value="">{t('family.selectSyllabus')}</option>
                                        {Object.values(Syllabus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-dark/40 uppercase">{t('family.grade')}</label>
                                    <select value={c.grade} onChange={e => update(idx, { grade: e.target.value })} disabled={!c.gradeSyllabus}
                                        className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 bg-white focus:border-brand-blue focus:outline-none font-medium disabled:opacity-50">
                                        <option value="">{t('family.selectGrade')}</option>
                                        {gradesFor(c.gradeSyllabus).map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <button type="button" onClick={() => setChildren(prev => prev.filter((_, i) => i !== idx))}
                                    className="p-2.5 text-red-400 hover:text-red-600 transition-colors" aria-label={t('family.remove')}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => setChildren(prev => [...prev, { name: '', birthday: '', gradeSyllabus: '', grade: '' }])}
                            className="flex items-center gap-1 text-sm font-bold text-brand-blue hover:underline">
                            <Plus size={16} /> {t('family.addChild')}
                        </button>
                    </div>

                    <div className="bg-brand-orange/5 border border-brand-orange/20 rounded-2xl p-4 text-xs text-brand-dark/70 space-y-1">
                        <p>{t('family.setupNotePricing')}</p>
                        <p>{t('family.setupNote')}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
                        <Button type="submit" disabled={submitting || !firstProfileName.trim() || !parentDisplayName.trim()} className="bg-brand-blue hover:bg-blue-600">
                            {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Users size={16} /> {t('family.setupConfirm')}</>}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default FamilySetupModal;
