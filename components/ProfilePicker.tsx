import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';
import { Card } from './Card';
import { Button } from './Button';
import { Loader2, Plus, Pencil, Trash2, Check, X, Crown, Settings2, CreditCard, User as UserIcon } from 'lucide-react';
import { Syllabus } from '../types';
import { getGradesBySyllabus } from '../lib/curriculum';

// Netflix-style "Who's learning?" screen for parent accounts.
// Lives at /profiles. Works from both the parent session and a switched child
// session (the parent token is kept in localStorage while acting as a child).

export interface FamilyProfile {
    id: string;
    name: string;
    avatar: string | null;
    grade: string | null;
    gradeSyllabus: string | null;
    birthday: string | null;
    xp: number;
    seasonXp: number;
    level: number;
    coins: number;
    seatIndex: number;
    seatCovered: boolean;
}

interface FamilyData {
    isFamily: boolean;
    parent: {
        id: string; name: string; email: string; avatar: string | null;
        subscriptionSeats: number; isSubscribed: boolean; subscriptionLevel: string | null;
        subscribedSyllabus: string | null; subscriptionEndDate: string | null; cancelAtPeriodEnd: boolean;
    } | null;
    profiles: FamilyProfile[];
    activeProfileId: string | null;
    maxProfiles: number;
}

const TILE_COLORS = ['bg-brand-blue', 'bg-brand-orange', 'bg-brand-green', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-amber-500', 'bg-indigo-500', 'bg-rose-500', 'bg-cyan-600'];

const allGrades = (syllabus: string): string[] => {
    try {
        const g = getGradesBySyllabus(syllabus as Syllabus);
        return [...g.primary, ...g.secondary, ...(g.advanced || [])];
    } catch { return []; }
};

interface EditorProps {
    initial: FamilyProfile | null;
    saving: boolean;
    onCancel: () => void;
    onSave: (payload: { name: string; birthday: string; gradeSyllabus: string; grade: string }) => void;
}

const ProfileEditor: React.FC<EditorProps> = ({ initial, saving, onCancel, onSave }) => {
    const { t } = useT();
    const [name, setName] = useState(initial?.name || '');
    const [birthday, setBirthday] = useState(initial?.birthday || '');
    const [syllabus, setSyllabus] = useState(initial?.gradeSyllabus || '');
    const [grade, setGrade] = useState(initial?.grade || '');
    const grades = syllabus ? allGrades(syllabus) : [];
    const birthdayLocked = !!initial?.birthday;

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); onSave({ name, birthday, gradeSyllabus: syllabus, grade }); }}
            className="space-y-4"
        >
            <h3 className="font-display font-bold text-xl text-brand-dark">{initial ? t('family.editProfile') : t('family.newProfile')}</h3>
            <div className="space-y-1">
                <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('family.name')}</label>
                <input value={name} onChange={e => setName(e.target.value)} required maxLength={60}
                    className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-bold" />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('family.birthday')}</label>
                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} required={!birthdayLocked} disabled={birthdayLocked}
                    className={`w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium min-h-[48px] ${birthdayLocked ? 'bg-gray-100 opacity-70' : ''}`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('family.syllabus')}</label>
                    <select value={syllabus} onChange={e => { setSyllabus(e.target.value); setGrade(''); }}
                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 bg-white focus:border-brand-blue focus:outline-none font-medium">
                        <option value="">{t('family.selectSyllabus')}</option>
                        {Object.values(Syllabus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('family.grade')}</label>
                    <select value={grade} onChange={e => setGrade(e.target.value)} disabled={!syllabus}
                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 bg-white focus:border-brand-blue focus:outline-none font-medium disabled:opacity-50">
                        <option value="">{t('family.selectGrade')}</option>
                        {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={onCancel} disabled={saving}><X size={16} /> {t('common.cancel')}</Button>
                <Button type="submit" disabled={saving || !name.trim()} className="bg-brand-blue hover:bg-blue-600">
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <><Check size={16} /> {t('common.save')}</>}
                </Button>
            </div>
        </form>
    );
};

export const ProfilePicker: React.FC = () => {
    const { user, switchProfile, familyToken } = useAuth();
    const { t } = useT();
    const navigate = useNavigate();

    const [data, setData] = useState<FamilyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [manage, setManage] = useState(false);
    const [editing, setEditing] = useState<FamilyProfile | 'new' | null>(null);
    const [saving, setSaving] = useState(false);
    const [switching, setSwitching] = useState<string | null>(null);

    const headers = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${familyToken() || ''}`
    });

    const load = async () => {
        try {
            const res = await fetch('/api/family', { headers: headers() });
            if (!res.ok) throw new Error('Failed');
            setData(await res.json());
        } catch {
            setError(t('family.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const handleSelect = async (p: FamilyProfile) => {
        if (switching) return;
        setSwitching(p.id);
        const ok = await switchProfile(p.id);
        setSwitching(null);
        if (ok) navigate('/dashboard');
    };

    const handleSave = async (payload: { name: string; birthday: string; gradeSyllabus: string; grade: string }) => {
        setSaving(true);
        try {
            const isNew = editing === 'new';
            const res = await fetch(isNew ? '/api/family/children' : `/api/family/children/${(editing as FamilyProfile).id}`, {
                method: isNew ? 'POST' : 'PUT',
                headers: headers(),
                body: JSON.stringify({
                    name: payload.name,
                    birthday: payload.birthday || undefined,
                    gradeSyllabus: payload.gradeSyllabus || null,
                    grade: payload.grade || null
                })
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) { alert(body.error || t('family.saveError')); return; }
            setEditing(null);
            await load();
        } catch {
            alert(t('family.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (p: FamilyProfile) => {
        if (!confirm(t('family.removeConfirm', { name: p.name }))) return;
        const res = await fetch(`/api/family/children/${p.id}`, { method: 'DELETE', headers: headers() });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { alert(body.error || t('family.saveError')); return; }
        await load();
    };

    if (loading) {
        return <div className="flex justify-center p-16 text-brand-dark/50"><Loader2 className="animate-spin w-8 h-8" /></div>;
    }
    if (error || !data) {
        return <div className="text-center p-16 text-red-500 font-bold">{error || t('family.loadError')}</div>;
    }
    if (!data.isFamily || !data.parent) {
        return (
            <div className="max-w-xl mx-auto pt-12 px-4 text-center space-y-4">
                <p className="text-brand-dark/60">{t('family.notFamily')}</p>
                <Button onClick={() => navigate('/profile')} className="bg-brand-blue hover:bg-blue-600">{t('nav.myProfile')}</Button>
            </div>
        );
    }

    const { parent, profiles } = data;
    const uncovered = profiles.filter(p => !p.seatCovered);
    const canAdd = profiles.length < data.maxProfiles;

    return (
        <div className="max-w-4xl mx-auto pt-10 pb-20 px-4 space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-3xl md:text-5xl font-display font-bold text-brand-dark">{t('family.title')}</h1>
                <p className="text-brand-dark/60">{manage ? t('family.manageDesc') : t('family.subtitle')}</p>
            </div>

            {/* Subscription / seats summary */}
            <Card className={`p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3 ${parent.isSubscribed ? 'bg-brand-green/5 border border-brand-green/20' : 'bg-brand-orange/5 border border-brand-orange/20'}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${parent.isSubscribed ? 'bg-brand-green/15 text-brand-green' : 'bg-brand-orange/15 text-brand-orange'}`}>
                        <Crown size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-brand-dark text-sm">
                            {parent.isSubscribed
                                ? t('family.seatsCovered', { seats: Math.min(parent.subscriptionSeats, profiles.length), count: profiles.length })
                                : t('family.freePlan')}
                        </p>
                        {parent.isSubscribed && uncovered.length > 0 && (
                            <p className="text-xs text-brand-dark/60">{t('family.seatsUncovered', { name: uncovered.map(p => p.name).join(', '), count: profiles.length })}</p>
                        )}
                        {parent.isSubscribed && uncovered.length === 0 && parent.subscriptionEndDate && (
                            <p className="text-xs text-brand-dark/60">{t('family.renewsOn', { date: new Date(parent.subscriptionEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) })}</p>
                        )}
                    </div>
                </div>
                {(!parent.isSubscribed || uncovered.length > 0) && (
                    <Button size="sm" onClick={() => navigate('/pricing')} className="bg-brand-orange hover:bg-orange-400 shrink-0">
                        <CreditCard size={14} /> {parent.isSubscribed ? t('family.renewFor', { count: profiles.length }) : t('family.subscribeFor', { count: profiles.length })}
                    </Button>
                )}
            </Card>

            {/* Profile tiles */}
            <div className="flex flex-wrap justify-center gap-5 md:gap-8">
                {profiles.map((p, i) => {
                    const isActive = data.activeProfileId === p.id || (user?.id === p.id);
                    return (
                        <div key={p.id} className="relative w-32 sm:w-40 flex flex-col items-center gap-2 group">
                            <button
                                type="button"
                                disabled={!!switching || manage}
                                onClick={() => manage ? setEditing(p) : handleSelect(p)}
                                className={`w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden flex items-center justify-center text-white text-5xl font-display font-bold shadow-xl transition-transform ${TILE_COLORS[i % TILE_COLORS.length]} ${manage ? 'opacity-90' : 'hover:scale-105'} ${isActive ? 'ring-4 ring-brand-dark' : 'ring-4 ring-transparent group-hover:ring-white'}`}
                            >
                                {p.avatar ? <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" /> : p.name.charAt(0).toUpperCase()}
                                {switching === p.id && (
                                    <span className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-3xl"><Loader2 className="animate-spin text-white" size={32} /></span>
                                )}
                                {manage && (
                                    <span className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-3xl"><Pencil className="text-white" size={32} /></span>
                                )}
                            </button>
                            <p className="font-bold text-brand-dark text-center truncate w-full">{p.name}</p>
                            <p className="text-[11px] text-brand-dark/50 text-center leading-tight">
                                {p.grade ? `${p.grade}` : (p.gradeSyllabus || '')}
                                {p.grade || p.gradeSyllabus ? ' · ' : ''}{t('family.level', { level: p.level })}
                            </p>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${p.seatCovered && parent.isSubscribed ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-dark/5 text-brand-dark/40'}`}>
                                {p.seatCovered && parent.isSubscribed ? t('family.covered') : t('family.freeSeat')}
                            </span>
                            {manage && profiles.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemove(p)}
                                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white shadow-md text-red-500 hover:bg-red-50 flex items-center justify-center"
                                    aria-label={t('family.remove')}
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    );
                })}

                {manage && canAdd && (
                    <button
                        type="button"
                        onClick={() => setEditing('new')}
                        className="w-32 sm:w-40 flex flex-col items-center gap-2 group"
                    >
                        <span className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl border-4 border-dashed border-brand-dark/15 flex items-center justify-center text-brand-dark/30 group-hover:text-brand-blue group-hover:border-brand-blue/40 transition-colors">
                            <Plus size={40} />
                        </span>
                        <span className="font-bold text-brand-dark/60 group-hover:text-brand-blue">{t('family.addProfile')}</span>
                    </button>
                )}
            </div>

            {/* Editor */}
            {editing && (
                <Card className="p-6 md:p-8 shadow-xl max-w-lg mx-auto">
                    <ProfileEditor
                        initial={editing === 'new' ? null : editing}
                        saving={saving}
                        onCancel={() => setEditing(null)}
                        onSave={handleSave}
                    />
                </Card>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-3">
                <Button variant={manage ? 'primary' : 'outline'} onClick={() => { setManage(m => !m); setEditing(null); }} className={manage ? 'bg-brand-dark hover:bg-brand-dark/90' : ''}>
                    {manage ? <><Check size={16} /> {t('family.done')}</> : <><Settings2 size={16} /> {t('family.manage')}</>}
                </Button>
                <Button variant="outline" onClick={() => navigate('/profile')}>
                    <UserIcon size={16} /> {t('family.parentAccount')}
                </Button>
            </div>
            <p className="text-center text-xs text-brand-dark/40">{parent.email}</p>
        </div>
    );
};

export default ProfilePicker;
