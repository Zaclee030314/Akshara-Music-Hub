import React, { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '../contexts/useAuth';
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
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [sameAsEmail, setSameAsEmail] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!parentName.trim()) {
            alert('Please enter a parent / guardian name.');
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
                alert(err.error || 'Failed to save details.');
                setSaving(false);
                return;
            }
            await refreshUser();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Failed to save details.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <Card className="max-w-lg w-full p-6 md:p-8 shadow-2xl border-2 border-brand-orange/20 animate-pop-in relative my-8">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-brand-dark/40 hover:text-brand-dark transition-colors"
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6 space-y-2">
                    <div className="inline-flex items-center justify-center p-3 bg-brand-orange/10 rounded-full">
                        <Sparkles size={28} className="text-brand-orange" />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-brand-dark">Complete Your Profile</h3>
                    <p className="text-sm text-brand-dark/60">Tell us a little about your family so we can personalize your learning.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-brand-dark/40 uppercase">Parent Name</label>
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
                            Same as my registered email
                        </label>
                    </div>

                    <Button type="submit" disabled={saving} fullWidth className="bg-brand-orange hover:bg-orange-400 py-4">
                        {saving ? <Loader2 className="animate-spin" size={18} /> : 'Save & Continue'}
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default ProfileCompletionModal;
