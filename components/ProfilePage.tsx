import React, { useEffect, useRef, useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';
import { Loader2, Camera, User as UserIcon, Save, CheckCircle2, Gift, Copy, Check, Sparkles, Plus, Trash2 } from 'lucide-react';
import { StandardEditor } from './StandardEditor';

interface Profile {
    id: string;
    name: string;
    email: string;
    role: string;
    grade?: string | null;
    gradeSyllabus?: string | null;
    birthday?: string | null;
    expectedGrade?: string | null;
    avatar?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
    parentEmail?: string | null;
    children?: Array<{ name: string; birthday: string }>;
    createdAt?: string | null;
    profileCompleted: boolean;
    referralCreditCents?: number;
}

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('quest_token')}`
});

export const ProfilePage: React.FC = () => {
    const { refreshUser } = useAuth();
    const { t } = useT();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Name edit
    const [displayName, setDisplayName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);

    // Avatar
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Family form
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [sameAsEmail, setSameAsEmail] = useState(false);
    const [childrenList, setChildrenList] = useState<Array<{ name: string; birthday: string }>>([]);
    const [savingFamily, setSavingFamily] = useState(false);
    const [familySaved, setFamilySaved] = useState(false);

    // Referral
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const loadProfile = async () => {
        try {
            const res = await fetch('/api/profile', { headers: authHeaders() });
            if (!res.ok) throw new Error('Failed to load profile');
            const data: Profile = await res.json();
            setProfile(data);
            setDisplayName(data.name || '');
            setParentName(data.parentName || '');
            setParentPhone(data.parentPhone || '');
            setParentEmail(data.parentEmail || '');
            setChildrenList(data.children && data.children.length > 0 ? data.children : [{ name: '', birthday: '' }]);
            if (data.parentEmail && data.parentEmail === data.email) setSameAsEmail(true);
        } catch (err) {
            console.error(err);
            setError(t('profile.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const loadReferralCode = async () => {
        try {
            const res = await fetch('/api/profile/referral-code', { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setReferralCode(data.code || null);
            }
        } catch (err) {
            console.error('Failed to load referral code', err);
        }
    };

    useEffect(() => {
        loadProfile();
        loadReferralCode();
    }, []);

    const referralLink = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';

    const handleCopyReferral = async () => {
        if (!referralLink) return;
        try {
            await navigator.clipboard.writeText(referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed', err);
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAvatar(true);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = async () => {
                // Draw to a 256x256 canvas with cover-crop
                const size = 256;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) { setUploadingAvatar(false); return; }

                const scale = Math.max(size / img.width, size / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                const dx = (size - w) / 2;
                const dy = (size - h) / 2;
                ctx.drawImage(img, dx, dy, w, h);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                try {
                    const res = await fetch('/api/profile', {
                        method: 'PUT',
                        headers: authHeaders(),
                        body: JSON.stringify({ avatar: dataUrl })
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        alert(err.error || t('profile.failUpdatePhoto'));
                    } else {
                        const updated: Profile = await res.json();
                        setProfile(updated);
                        await refreshUser();
                    }
                } catch (err) {
                    console.error(err);
                    alert(t('profile.failUpdatePhoto'));
                } finally {
                    setUploadingAvatar(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleSaveName = async () => {
        if (!displayName.trim()) { alert(t('profile.nameEmpty')); return; }
        setSavingName(true);
        setNameSaved(false);
        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ name: displayName.trim() })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || t('profile.failSaveName'));
            } else {
                const updated: Profile = await res.json();
                setProfile(updated);
                await refreshUser();
                setNameSaved(true);
                setTimeout(() => setNameSaved(false), 2500);
            }
        } catch (err) {
            console.error(err);
            alert(t('profile.failSaveName'));
        } finally {
            setSavingName(false);
        }
    };

    const handleSaveFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingFamily(true);
        setFamilySaved(false);
        try {
            const res = await fetch('/api/profile/family', {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({
                    parentName,
                    parentPhone,
                    parentEmail: sameAsEmail ? profile?.email : parentEmail,
                    children: childrenList.filter(c => c.name.trim() && c.birthday)
                })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || t('profile.failSaveFamily'));
            } else {
                const updated: Profile = await res.json();
                setProfile(updated);
                await refreshUser();
                setFamilySaved(true);
                setTimeout(() => setFamilySaved(false), 2500);
            }
        } catch (err) {
            console.error(err);
            alert(t('profile.failSaveFamily'));
        } finally {
            setSavingFamily(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-16 text-brand-dark/50">
                <Loader2 className="animate-spin w-8 h-8" />
            </div>
        );
    }

    if (error || !profile) {
        return <div className="text-center p-16 text-red-500 font-bold">{error || t('profile.unavailable')}</div>;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 pt-8 pb-16 animate-in fade-in duration-500 px-4">
            <div className="text-center space-y-2">
                <h2 className="text-3xl md:text-4xl font-display font-bold text-brand-dark">{t('nav.myProfile')}</h2>
                <p className="text-brand-dark/60">{t('profile.manageDesc')}</p>
            </div>

            {/* Avatar + Name */}
            <Card className="p-6 md:p-8 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-brand-dark text-white flex items-center justify-center text-3xl font-bold overflow-hidden border-4 border-white ring-2 ring-brand-dark/10">
                            {profile.avatar
                                ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                                : profile.name.charAt(0).toUpperCase()}
                        </div>
                        {uploadingAvatar && (
                            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                                <Loader2 className="animate-spin w-6 h-6 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-2">
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAvatar}
                        >
                            <Camera size={16} /> {t('profile.changePhoto')}
                        </Button>
                        <p className="text-xs text-brand-dark/40">{t('profile.photoHint')}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.displayName')}</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="flex-1 p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-bold"
                        />
                        <Button onClick={handleSaveName} disabled={savingName} className="bg-brand-blue hover:bg-blue-600">
                            {savingName ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> {t('common.save')}</>}
                        </Button>
                    </div>
                    {nameSaved && (
                        <p className="text-sm text-brand-green font-bold flex items-center gap-1">
                            <CheckCircle2 size={14} /> {t('profile.nameUpdated')}
                        </p>
                    )}
                </div>
            </Card>

            {/* Read-only account info */}
            <Card className="p-6 md:p-8 shadow-sm space-y-4 bg-white/80">
                <h3 className="font-bold text-brand-dark flex items-center gap-2"><UserIcon size={18} /> {t('profile.account')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.email')}</p>
                        <p className="font-medium text-brand-dark break-all">{profile.email}</p>
                    </div>
                    {profile.birthday && (
                        <div>
                            <p className="text-xs font-bold text-brand-dark/40 uppercase">{t('login.birthday')}</p>
                            <p className="font-medium text-brand-dark">{profile.birthday}</p>
                        </div>
                    )}
                    {profile.createdAt && (
                        <div>
                            <p className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.dateJoined')}</p>
                            <p className="font-medium text-brand-dark">{profile.createdAt}</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Syllabus + standard (student-editable — XP is gated on age, not on this) */}
            <StandardEditor
                syllabus={profile.gradeSyllabus}
                grade={profile.grade}
                birthday={profile.birthday}
                expectedGrade={profile.expectedGrade}
                onSaved={async () => { await loadProfile(); await refreshUser(); }}
            />

            {/* How to earn XP & Coins */}
            <Card className="p-6 md:p-8 shadow-sm space-y-4 bg-gradient-to-br from-brand-blue/5 to-white">
                <h3 className="font-bold text-brand-dark flex items-center gap-2">
                    <Sparkles size={18} className="text-brand-blue" /> {t('profile.pointsTitle')}
                </h3>
                <ul className="space-y-2.5 text-sm text-brand-dark/70">
                    {[
                        t('profile.pointsQuest'),
                        t('profile.pointsStandard'),
                        t('profile.pointsXp'),
                        t('profile.pointsCoins')
                    ].map((line, i) => (
                        <li key={i} className="flex gap-2.5">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-blue shrink-0" />
                            <span>{line}</span>
                        </li>
                    ))}
                </ul>
            </Card>

            {/* Refer & Earn */}
            <Card className="p-6 md:p-8 shadow-sm space-y-4 bg-gradient-to-br from-brand-orange/5 to-yellow-50/50">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-bold text-brand-dark flex items-center gap-2"><Gift size={18} className="text-brand-orange" /> {t('profile.referEarn')}</h3>
                    <span className="text-sm font-bold text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full">
                        {t('profile.earnedSoFar', { amount: ((profile.referralCreditCents ?? 0) / 100).toFixed(2) })}
                    </span>
                </div>
                <p className="text-sm text-brand-dark/60">{t('profile.referDesc')}</p>
                {referralCode ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={referralLink}
                            readOnly
                            onFocus={(e) => e.currentTarget.select()}
                            className="flex-1 p-3 rounded-xl border-2 border-brand-dark/10 bg-white font-medium text-sm text-brand-dark/70 focus:outline-none focus:border-brand-orange"
                        />
                        <Button onClick={handleCopyReferral} className="bg-brand-orange hover:bg-orange-400 shrink-0">
                            {copied ? <><Check size={16} /> {t('profile.copied')}</> : <><Copy size={16} /> {t('profile.copy')}</>}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-brand-dark/40 text-sm">
                        <Loader2 className="animate-spin" size={16} /> {t('profile.generatingLink')}
                    </div>
                )}
            </Card>

            {/* Family details */}
            <Card className="p-6 md:p-8 shadow-sm space-y-5">
                <h3 className="font-bold text-brand-dark">{t('profile.familyDetails')}</h3>
                <form onSubmit={handleSaveFamily} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.parentGuardianName')}</label>
                            <input
                                type="text"
                                value={parentName}
                                onChange={(e) => setParentName(e.target.value)}
                                className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.parentPhone')}</label>
                            <input
                                type="tel"
                                value={parentPhone}
                                onChange={(e) => setParentPhone(e.target.value)}
                                className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.parentEmail')}</label>
                        <input
                            type="email"
                            value={sameAsEmail ? profile.email : parentEmail}
                            onChange={(e) => setParentEmail(e.target.value)}
                            disabled={sameAsEmail}
                            className={`w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium ${sameAsEmail ? 'bg-gray-100 opacity-70' : ''}`}
                        />
                        <label className="flex items-center gap-2 text-sm text-brand-dark/60 mt-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sameAsEmail}
                                onChange={(e) => setSameAsEmail(e.target.checked)}
                                className="rounded"
                            />
                            {t('profile.sameAsEmail')}
                        </label>
                    </div>

                    {/* Children — name + date of birth, at least one */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.children')}</label>
                        {childrenList.map((child, idx) => (
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-dark/40 uppercase">{t('profile.childName')}</label>
                                    <input
                                        type="text"
                                        value={child.name}
                                        onChange={(e) => setChildrenList(prev => prev.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))}
                                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-dark/40 uppercase">{t('profile.childBirthday')}</label>
                                    <input
                                        type="date"
                                        value={child.birthday}
                                        onChange={(e) => setChildrenList(prev => prev.map((c, i) => i === idx ? { ...c, birthday: e.target.value } : c))}
                                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium appearance-none min-h-[48px]"
                                    />
                                </div>
                                {childrenList.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setChildrenList(prev => prev.filter((_, i) => i !== idx))}
                                        className="p-3 text-red-400 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                ) : <div />}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setChildrenList(prev => [...prev, { name: '', birthday: '' }])}
                            className="flex items-center gap-1 text-sm font-bold text-brand-blue hover:underline"
                        >
                            <Plus size={16} /> {t('profile.addChild')}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button type="submit" disabled={savingFamily} className="bg-brand-orange hover:bg-orange-400">
                            {savingFamily ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> {t('profile.saveFamily')}</>}
                        </Button>
                        {familySaved && (
                            <span className="text-sm text-brand-green font-bold flex items-center gap-1">
                                <CheckCircle2 size={14} /> {t('profile.saved')}
                            </span>
                        )}
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default ProfilePage;
