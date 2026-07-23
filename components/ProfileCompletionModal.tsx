import React, { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';
import { Loader2, X, Sparkles } from 'lucide-react';

interface ProfileCompletionModalProps {
    onClose: () => void;
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
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!parentName.trim()) {
            alert(t('profile.enterParentName'));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/profile/family', {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({
                    parentName,
                    parentPhone,
                    parentEmail: sameAsEmail ? user?.email : parentEmail
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <Card className="max-w-lg w-full p-6 md:p-8 shadow-2xl border-2 border-brand-orange/20 animate-pop-in relative my-8">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-brand-dark/40 hover:text-brand-dark transition-colors"
                    aria-label={t('common.close')}
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6 space-y-2">
                    <div className="inline-flex items-center justify-center p-3 bg-brand-orange/10 rounded-full">
                        <Sparkles size={28} className="text-brand-orange" />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-brand-dark">{t('profile.completeTitle')}</h3>
                    <p className="text-sm text-brand-dark/60">{t('profile.completeDesc')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">{t('profile.parentName')}</label>
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

                    <Button type="submit" disabled={saving} fullWidth className="bg-brand-orange hover:bg-orange-400 py-4">
                        {saving ? <Loader2 className="animate-spin" size={18} /> : t('profile.saveContinue')}
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default ProfileCompletionModal;
