import React, { useEffect, useState } from 'react';
import {
    Vote, Plus, Loader2, CheckCircle, XCircle, BarChart3, X, Trash2,
} from 'lucide-react';

interface Poll {
    id: string;
    question: string;
    description: string | null;
    options: string[];
    allowSuggestions: boolean;
    isActive: boolean;
    seasonId: string | null;
    optionCounts: number[];
    suggestionsCount: number;
    totalVotes: number;
}

interface PollResults {
    id: string;
    question: string;
    options: string[];
    optionCounts: number[];
    suggestions: Array<{ suggestion: string | null; userName: string; createdAt: string }>;
    totalVotes: number;
}

interface Props {
    token: string;
}

export const PollManager: React.FC<Props> = ({ token }) => {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const [question, setQuestion] = useState('');
    const [description, setDescription] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [allowSuggestions, setAllowSuggestions] = useState(false);

    const [results, setResults] = useState<PollResults | null>(null);

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchPolls = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/polls/admin/all', { headers });
            if (res.ok) setPolls(await res.json());
        } catch {
            showToast('Failed to load polls', 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchPolls(); }, [token]);

    const openCreate = () => {
        setQuestion('');
        setDescription('');
        setOptions(['', '']);
        setAllowSuggestions(false);
        setShowModal(true);
    };

    const savePoll = async (e: React.FormEvent) => {
        e.preventDefault();
        const opts = options.map(o => o.trim()).filter(Boolean);
        if (!question.trim()) { showToast('Question is required', 'error'); return; }
        if (opts.length < 2 && !allowSuggestions) {
            showToast('Add at least 2 options (or allow suggestions)', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/polls/admin', {
                method: 'POST',
                headers,
                body: JSON.stringify({ question, description, options: opts, allowSuggestions }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Poll created', 'success');
                setShowModal(false);
                fetchPolls();
            } else {
                showToast(data.error || 'Failed to create poll', 'error');
            }
        } catch {
            showToast('Failed to create poll', 'error');
        }
        setSaving(false);
    };

    const toggleActive = async (poll: Poll) => {
        try {
            const res = await fetch(`/api/polls/admin/${poll.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ isActive: !poll.isActive }),
            });
            if (res.ok) {
                setPolls(prev => prev.map(p => (p.id === poll.id ? { ...p, isActive: !p.isActive } : p)));
                showToast(poll.isActive ? 'Poll deactivated' : 'Poll activated', 'success');
            } else {
                showToast('Failed to update poll', 'error');
            }
        } catch {
            showToast('Failed to update poll', 'error');
        }
    };

    const viewResults = async (poll: Poll) => {
        setResults(null);
        try {
            const res = await fetch(`/api/polls/admin/${poll.id}/results`, { headers });
            if (res.ok) setResults(await res.json());
            else showToast('Failed to load results', 'error');
        } catch {
            showToast('Failed to load results', 'error');
        }
    };

    const addOption = () => setOptions(prev => [...prev, '']);
    const removeOption = (i: number) => setOptions(prev => prev.filter((_, idx) => idx !== i));
    const updateOption = (i: number, val: string) => setOptions(prev => prev.map((o, idx) => (idx === i ? val : o)));

    const maxCount = results ? Math.max(1, ...results.optionCounts) : 1;

    return (
        <div className="space-y-4">
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-6 py-3 rounded-2xl shadow-2xl font-bold text-white text-sm animate-pop-in
                    ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-brand-dark/5 shadow-sm">
                <div className="flex items-center gap-3">
                    <Vote className="text-indigo-500" size={24} />
                    <div>
                        <h3 className="font-bold text-sm">Prize Polls</h3>
                        <p className="text-xs text-brand-dark/40">Let students vote on rewards & ideas</p>
                    </div>
                </div>
                <button onClick={openCreate} className="bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-dark/90 flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                    <Plus size={16} /> New Poll
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12 text-brand-dark/30"><Loader2 className="animate-spin" size={28} /></div>
            ) : polls.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-brand-dark/5">
                    <Vote className="mx-auto text-brand-dark/10 mb-3" size={44} />
                    <p className="text-brand-dark/30 font-bold italic">No polls yet. Create your first poll!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {polls.map(p => (
                        <div key={p.id} className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h4 className="font-bold text-brand-dark">{p.question}</h4>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${p.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-brand-dark/50 font-bold">
                                        {p.totalVotes} vote{p.totalVotes === 1 ? '' : 's'}
                                        {p.allowSuggestions ? ` · ${p.suggestionsCount} suggestion${p.suggestionsCount === 1 ? '' : 's'}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => viewResults(p)} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 active:scale-95 transition-all">
                                        <BarChart3 size={14} /> Results
                                    </button>
                                    <button
                                        onClick={() => toggleActive(p)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${p.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                    >
                                        {p.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[400] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                        <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg p-8 animate-pop-in border border-brand-dark/10 my-8">
                            <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-brand-dark/30 hover:text-brand-dark"><X size={20} /></button>
                            <h2 className="text-2xl font-display font-bold mb-6">New Poll</h2>
                            <form onSubmit={savePoll} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Question *</label>
                                    <input value={question} onChange={e => setQuestion(e.target.value)} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 ring-indigo-200 mt-1" placeholder="Which prize should we offer next season?" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Description</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:ring-2 ring-indigo-200 mt-1" placeholder="Optional context for students" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Options</label>
                                    <div className="space-y-2 mt-1">
                                        {options.map((opt, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <input value={opt} onChange={e => updateOption(i, e.target.value)} className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 font-medium text-sm outline-none focus:ring-2 ring-indigo-200" placeholder={`Option ${i + 1}`} />
                                                {options.length > 2 && (
                                                    <button type="button" onClick={() => removeOption(i)} className="p-2 text-brand-dark/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={addOption} className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                        <Plus size={14} /> Add option
                                    </button>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={allowSuggestions} onChange={e => setAllowSuggestions(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                                    <span className="text-sm font-bold text-brand-dark">Allow students to suggest their own answer</span>
                                </label>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-50 text-brand-dark/40 py-3.5 rounded-2xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
                                    <button type="submit" disabled={saving} className="flex-[2] bg-brand-dark text-white py-3.5 rounded-2xl font-bold hover:bg-brand-dark/90 shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                        {saving ? <Loader2 className="animate-spin" size={18} /> : 'Create Poll'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Modal */}
            {results && (
                <div className="fixed inset-0 z-[400] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm" onClick={() => setResults(null)} />
                        <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg p-8 animate-pop-in border border-brand-dark/10 my-8">
                            <button onClick={() => setResults(null)} className="absolute top-5 right-5 text-brand-dark/30 hover:text-brand-dark"><X size={20} /></button>
                            <h2 className="text-xl font-display font-bold mb-1">{results.question}</h2>
                            <p className="text-xs text-brand-dark/40 font-bold mb-6">{results.totalVotes} total vote{results.totalVotes === 1 ? '' : 's'}</p>

                            <div className="space-y-3 mb-6">
                                {results.options.map((opt, i) => {
                                    const count = results.optionCounts[i] || 0;
                                    const pct = Math.round((count / maxCount) * 100);
                                    return (
                                        <div key={i}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-bold text-brand-dark">{opt}</span>
                                                <span className="text-sm font-black text-indigo-600">{count}</span>
                                            </div>
                                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {results.suggestions.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest mb-2">Suggestions ({results.suggestions.length})</p>
                                    <div className="space-y-2 max-h-56 overflow-y-auto">
                                        {results.suggestions.map((s, i) => (
                                            <div key={i} className="bg-gray-50 rounded-xl px-4 py-2.5">
                                                <p className="text-sm font-medium text-brand-dark">{s.suggestion}</p>
                                                <p className="text-[10px] text-brand-dark/40 font-bold mt-0.5">— {s.userName}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PollManager;
