import React, { useMemo, useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Loader2, Save, CheckCircle2, GraduationCap, Info, Cake } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';
import { Syllabus } from '../types';
import { getGradesBySyllabus } from '../lib/curriculum';
import { suggestGrade, isMusicSyllabus } from '../lib/ageGrade';

interface StandardEditorProps {
    syllabus?: string | null;
    grade?: string | null;
    birthday?: string | null;       // 'YYYY-MM-DD' — null when never captured
    expectedGrade?: string | null;  // server-computed age-based grade
    onSaved: () => void | Promise<void>;
}

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('quest_token')}`
});

/**
 * Lets a student change the syllabus/standard their content is drawn from.
 * This is deliberately editable: XP earning is gated on the student's AGE GROUP
 * (derived server-side from their birthday), so it cannot be used to farm points.
 * Birthday can only be set once, and only if the account has none on file.
 */
export const StandardEditor: React.FC<StandardEditorProps> = ({
    syllabus, grade, birthday, expectedGrade, onSaved
}) => {
    const { t } = useT();
    const [selectedSyllabus, setSelectedSyllabus] = useState<Syllabus | ''>((syllabus as Syllabus) || '');
    const [selectedGrade, setSelectedGrade] = useState(grade || '');
    const [newBirthday, setNewBirthday] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const gradeOptions = useMemo(() => {
        if (!selectedSyllabus) return [];
        const g = getGradesBySyllabus(selectedSyllabus as Syllabus);
        return [...g.primary, ...g.secondary, ...(g.advanced || [])];
    }, [selectedSyllabus]);

    const handleSyllabusChange = (value: string) => {
        const next = value as Syllabus | '';
        setSelectedSyllabus(next);
        // Grades are syllabus-specific — reset, then suggest from the birthday if we have one.
        const effectiveBirthday = birthday || newBirthday;
        if (next && effectiveBirthday && !isMusicSyllabus(next)) {
            setSelectedGrade(suggestGrade(next, effectiveBirthday) ?? '');
        } else {
            setSelectedGrade('');
        }
    };

    const handleSave = async () => {
        setError('');
        if (!selectedSyllabus) { setError(t('login.alertSelectSyllabus')); return; }
        if (!selectedGrade) { setError(t('login.alertSelectGrade')); return; }
        if (!birthday && !newBirthday) { setError(t('standard.birthdayRequired')); return; }

        setSaving(true);
        setSaved(false);
        try {
            const body: Record<string, string> = {
                gradeSyllabus: selectedSyllabus,
                grade: selectedGrade
            };
            // Only ever sent when the account has no birthday yet — the server rejects changes.
            if (!birthday && newBirthday) body.birthday = newBirthday;

            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || t('standard.saveError'));
                return;
            }
            await onSaved();
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            console.error(err);
            setError(t('standard.saveError'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="p-6 md:p-8 shadow-sm space-y-5 bg-white/80">
            <h3 className="font-bold text-brand-dark flex items-center gap-2">
                <GraduationCap size={18} className="text-brand-blue" /> {t('standard.title')}
            </h3>
            <p className="text-sm text-brand-dark/60">{t('standard.desc')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('login.syllabus')}</label>
                    <select
                        value={selectedSyllabus}
                        onChange={(e) => handleSyllabusChange(e.target.value)}
                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 bg-white focus:border-brand-blue focus:outline-none font-medium"
                    >
                        <option value="">{t('login.selectSyllabus')}</option>
                        {Object.values(Syllabus).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('standard.myStandard')}</label>
                    <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        disabled={!selectedSyllabus}
                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 bg-white focus:border-brand-blue focus:outline-none font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">{selectedSyllabus ? t('login.selectGrade') : t('login.chooseSyllabusFirst')}</option>
                        {gradeOptions.map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* One-time birthday capture for accounts created before birthdays existed. */}
            {!birthday && (
                <div className="space-y-1 bg-brand-orange/5 border border-brand-orange/20 rounded-xl p-4">
                    <label className="text-xs font-bold text-brand-dark/50 uppercase flex items-center gap-1.5">
                        <Cake size={14} className="text-brand-orange" /> {t('login.birthday')}
                    </label>
                    <input
                        type="date"
                        value={newBirthday}
                        max={todayISO}
                        onChange={(e) => setNewBirthday(e.target.value)}
                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 bg-white appearance-none min-h-[48px] focus:border-brand-orange focus:outline-none font-medium"
                    />
                    <p className="text-xs text-brand-dark/50">{t('standard.birthdayPrompt')}</p>
                </div>
            )}

            <p className="text-sm text-brand-dark/60 flex gap-2">
                <Info size={16} className="text-brand-blue shrink-0 mt-0.5" />
                <span>
                    {t('standard.explainer')}
                    {expectedGrade && <> {t('standard.judgedAt', { grade: expectedGrade })}</>}
                </span>
            </p>

            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg font-medium">{error}</p>}

            <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving} className="bg-brand-blue hover:bg-blue-600">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> {t('standard.save')}</>}
                </Button>
                {saved && (
                    <span className="text-sm text-brand-green font-bold flex items-center gap-1">
                        <CheckCircle2 size={14} /> {t('standard.saved')}
                    </span>
                )}
            </div>
        </Card>
    );
};

export default StandardEditor;
