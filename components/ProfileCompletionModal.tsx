import React, { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';
import { Loader2, Sparkles, Plus, Trash2 } from 'lucide-react';

// Blocking by design: parent + child details are compulsory, so this modal has
// no close button — it goes away only when the form saves successfully.
interface ProfileCompletionModalProps {
    onClose: () => void;
}

interface ChildEntry {
    name: string;
    birthday: string;
}

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('quest_token')}`
});

export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({ onClose }) => {
    const { user, refreshUser } = useAuth();
    const { t } = useT();
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [sameAsEmail, setSameAsEmail] = useState(false);
    // Pre-fill the first child from the account itself — accounts are usually
    // registered for the student, whose birthday was captured at signup.
    const [children, setChildren] = useState<ChildEntry[]>([
        { name: user?.name || '', birthday: (user as any)?.birthday || '' }
    ]);
    const [saving, setSaving] = useState(false);

    const setChild = (idx: number, patch: Partial<ChildEntry>) =>
        setChildren(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));

    const canSubmit =
        parentName.trim().length > 0 &&
        parentPhone.trim().length > 0 &&
        children.length > 0 &&
        children.every(c => c.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.birthday));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        try {
            const res = await fetch('/api/profile/family', {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({
                    parentName,
                    parentPhone,
                    parentEmail: sameAsEmail ? user?.email : parentEmail,
                    children: children.map(c => ({ name: c.name.trim(), birthday: c.birthday }))
                })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || t('profile.failSaveDetails'));
                setSaving(false);
                return;
            }
            await refreshUser();
            onClose();
        } catch (err) {
            console.error(err);
            alert(t('profile.failSaveDetails'));
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <Card className="max-w-lg w-full p-6 md:p-8 shadow-2xl border-2 border-brand-orange/20 animate-pop-in relative my-8">
                <div className="text-center mb-6 space-y-2">
                    <div className="inline-flex items-center justify-center p-3 bg-brand-orange/10 rounded-full">
                        <Sparkles size={28} className="text-brand-orange" />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-brand-dark">{t('profile.completeTitle')}</h3>
                    <p className="text-sm text-brand-dark/60">{t('profile.completeDesc')}</p>
                    <p className="text-xs font-bold text-brand-orange">{t('profile.completeRequired')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.parentName')} *</label>
                            <input
                                type="text"
                                value={parentName}
                                onChange={(e) => setParentName(e.target.value)}
                                className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.parentPhone')} *</label>
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
                            value={sameAsEmail ? (user?.email || '') : parentEmail}
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

                    {/* Children — at least one, each with name + date of birth */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.children')} *</label>
                        {children.map((child, idx) => (
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-dark/40 uppercase">{t('profile.childName')}</label>
                                    <input
                                        type="text"
                                        value={child.name}
                                        onChange={(e) => setChild(idx, { name: e.target.value })}
                                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-dark/40 uppercase">{t('profile.childBirthday')}</label>
                                    <input
                                        type="date"
                                        value={child.birthday}
                                        onChange={(e) => setChild(idx, { birthday: e.target.value })}
                                        className="w-full p-3 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none font-medium appearance-none min-h-[48px]"
                                    />
                                </div>
                                {children.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setChildren(prev => prev.filter((_, i) => i !== idx))}
                                        className="p-3 text-red-400 hover:text-red-600 transition-colors"
                                        aria-label={t('common.close')}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                ) : <div />}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setChildren(prev => [...prev, { name: '', birthday: '' }])}
                            className="flex items-center gap-1 text-sm font-bold text-brand-blue hover:underline"
                        >
                            <Plus size={16} /> {t('profile.addChild')}
                        </button>
                    </div>

                    <Button type="submit" disabled={saving || !canSubmit} fullWidth className="bg-brand-orange hover:bg-orange-400 py-4 disabled:opacity-50">
                        {saving ? <Loader2 className="animate-spin" size={18} /> : t('profile.saveContinue')}
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default ProfileCompletionModal;
