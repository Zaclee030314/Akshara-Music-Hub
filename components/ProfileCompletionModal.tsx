import React, { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '../contexts/useAuth';
import { Loader2, X, Plus, Trash2, Sparkles } from 'lucide-react';

interface Child {
    name: string;
    age: string;
    birthday: string;
}

interface ProfileCompletionModalProps {
    onClose: () => void;
}

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('quest_token')}`
});

export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({ onClose }) => {
    const { user, refreshUser } = useAuth();
    const [children, setChildren] = useState<Child[]>([{ name: '', age: '', birthday: '' }]);
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [sameAsEmail, setSameAsEmail] = useState(false);
    const [saving, setSaving] = useState(false);

    const updateChild = (idx: number, field: keyof Child, value: string) => {
        setChildren(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    };
    const addChild = () => setChildren(prev => [...prev, { name: '', age: '', birthday: '' }]);
    const removeChild = (idx: number) => setChildren(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validChildren = children.filter(c => c.name.trim());
        if (validChildren.length === 0) {
            alert('Please add at least one child.');
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
                    parentEmail: sameAsEmail ? user?.email : parentEmail,
                    children: validChildren.map(c => ({
                        name: c.name.trim(),
                        age: c.age === '' ? null : Number(c.age),
                        birthday: c.birthday
                    }))
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
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-brand-dark/40 uppercase">Children</label>
                        {children.map((child, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_70px_140px_auto] gap-2 items-end">
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={child.name}
                                    onChange={(e) => updateChild(idx, 'name', e.target.value)}
                                    className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none text-sm font-medium"
                                />
                                <input
                                    type="number"
                                    min={0}
                                    placeholder="Age"
                                    value={child.age}
                                    onChange={(e) => updateChild(idx, 'age', e.target.value)}
                                    className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none text-sm font-medium"
                                />
                                <input
                                    type="date"
                                    value={child.birthday}
                                    onChange={(e) => updateChild(idx, 'birthday', e.target.value)}
                                    className="w-full p-2.5 rounded-xl border-2 border-brand-dark/10 focus:border-brand-blue focus:outline-none text-sm font-medium"
                                />
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
