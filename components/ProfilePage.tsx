import React, { useEffect, useRef, useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '../contexts/useAuth';
import { Loader2, Camera, User as UserIcon, Save, Plus, Trash2, CheckCircle2, Gift, Copy, Check } from 'lucide-react';

interface Child {
    name: string;
    age: string | number;
    birthday: string;
}

interface Profile {
    id: string;
    name: string;
    email: string;
    role: string;
    grade?: string | null;
    gradeSyllabus?: string | null;
    avatar?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
    parentEmail?: string | null;
    children: Child[];
    profileCompleted: boolean;
}

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('quest_token')}`
});

export const ProfilePage: React.FC = () => {
    const { refreshUser } = useAuth();
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
    const [children, setChildren] = useState<Child[]>([{ name: '', age: '', birthday: '' }]);
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
            if (data.parentEmail && data.parentEmail === data.email) setSameAsEmail(true);
            setChildren(data.children && data.children.length > 0 ? data.children : [{ name: '', age: '', birthday: '' }]);
        } catch (err) {
            console.error(err);
            setError('Could not load your profile.');
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
                        alert(err.error || 'Failed to update photo.');
                    } else {
                        const updated: Profile = await res.json();
                        setProfile(updated);
                        await refreshUser();
                    }
                } catch (err) {
                    console.error(err);
                    alert('Failed to update photo.');
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
        if (!displayName.trim()) { alert('Name cannot be empty.'); return; }
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
                alert(err.error || 'Failed to save name.');
            } else {
                const updated: Profile = await res.json();
                setProfile(updated);
                await refreshUser();
                setNameSaved(true);
                setTimeout(() => setNameSaved(false), 2500);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save name.');
        } finally {
            setSavingName(false);
        }
    };

    const updateChild = (idx: number, field: keyof Child, value: string) => {
        setChildren(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    };
    const addChild = () => setChildren(prev => [...prev, { name: '', age: '', birthday: '' }]);
    const removeChild = (idx: number) => setChildren(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

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
                    children: children
                        .filter(c => c.name.trim())
                        .map(c => ({ name: c.name.trim(), age: c.age === '' ? null : Number(c.age), birthday: c.birthday }))
                })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Failed to save family details.');
            } else {
                const updated: Profile = await res.json();
                setProfile(updated);
                await refreshUser();
                setFamilySaved(true);
                setTimeout(() => setFamilySaved(false), 2500);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save family details.');
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
        return <div className="text-center p-16 text-red-500 font-bold">{error || 'Profile unavailable.'}</div>;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 pt-8 pb-16 animate-in fade-in duration-500 px-4">
            <div className="text-center space-y-2">
                <h2 className="text-3xl md:text-4xl font-display font-bold text-brand-dark">My Profile</h2>
                <p className="text-brand-dark/60">Manage your photo, name and family details.</p>
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
                            <Camera size={16} /> Change photo
                        </Button>
                        <p className="text-xs text-brand-dark/40">JPG or PNG. It will be cropped to a square.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-dark/40 uppercase">Display Name</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="flex-1 p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-bold"
                        />
                        <Button onClick={handleSaveName} disabled={savingName} className="bg-brand-blue hover:bg-blue-600">
                            {savingName ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> Save</>}
                        </Button>
                    </div>
                    {nameSaved && (
                        <p className="text-sm text-brand-green font-bold flex items-center gap-1">
                            <CheckCircle2 size={14} /> Name updated
                        </p>
                    )}
                </div>
            </Card>

            {/* Read-only account info */}
            <Card className="p-6 md:p-8 shadow-sm space-y-4 bg-white/80">
                <h3 className="font-bold text-brand-dark flex items-center gap-2"><UserIcon size={18} /> Account</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs font-bold text-brand-dark/40 uppercase">Email</p>
                        <p className="font-medium text-brand-dark break-all">{profile.email}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-brand-dark/40 uppercase">Registered Standard / Grade</p>
                        <p className="font-medium text-brand-dark">{profile.grade || '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-brand-dark/40 uppercase">Syllabus</p>
                        <p className="font-medium text-brand-dark">{profile.gradeSyllabus || '—'}</p>
                    </div>
                </div>
            </Card>

            {/* Refer & Earn */}
            <Card className="p-6 md:p-8 shadow-sm space-y-4 bg-gradient-to-br from-brand-orange/5 to-yellow-50/50">
                <h3 className="font-bold text-brand-dark flex items-center gap-2"><Gift size={18} className="text-brand-orange" /> Refer &amp; Earn</h3>
                <p className="text-sm text-brand-dark/60">Share this link with other parents — you'll be credited for every signup.</p>
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
                            {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-brand-dark/40 text-sm">
                        <Loader2 className="animate-spin" size={16} /> Generating your link…
                    </div>
                )}
            </Card>

            {/* Family details */}
            <Card className="p-6 md:p-8 shadow-sm space-y-5">
                <h3 className="font-bold text-brand-dark">Family Details</h3>
                <form onSubmit={handleSaveFamily} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">Parent / Guardian Name</label>
                            <input
                                type="text"
                                value={parentName}
                                onChange={(e) => setParentName(e.target.value)}
                                className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">Parent Phone</label>
                            <input
                                type="tel"
                                value={parentPhone}
                                onChange={(e) => setParentPhone(e.target.value)}
                                className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-brand-dark/40 uppercase">Parent Email</label>
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
                            Same as my registered email
                        </label>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-brand-dark/40 uppercase">Children</label>
                        {children.map((child, idx) => (
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_150px_auto] gap-2 items-end">
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Child name"
                                        value={child.name}
                                        onChange={(e) => updateChild(idx, 'name', e.target.value)}
                                        className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        min={0}
                                        placeholder="Age"
                                        value={child.age}
                                        onChange={(e) => updateChild(idx, 'age', e.target.value)}
                                        className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="date"
                                        value={child.birthday}
                                        onChange={(e) => updateChild(idx, 'birthday', e.target.value)}
                                        className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none text-sm font-medium"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeChild(idx)}
                                    disabled={children.length <= 1}
                                    className="p-2.5 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    aria-label="Remove child"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addChild}>
                            <Plus size={16} /> Add child
                        </Button>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button type="submit" disabled={savingFamily} className="bg-brand-orange hover:bg-orange-400">
                            {savingFamily ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> Save Family Details</>}
                        </Button>
                        {familySaved && (
                            <span className="text-sm text-brand-green font-bold flex items-center gap-1">
                                <CheckCircle2 size={14} /> Saved
                            </span>
                        )}
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default ProfilePage;
