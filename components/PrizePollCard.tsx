import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { Vote, CheckCircle2, Loader2, MessageSquarePlus } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';

interface PollData {
    id: string;
    question: string;
    description: string | null;
    options: string[];
    allowSuggestions: boolean;
    seasonId: string | null;
}

interface MyVote {
    optionIndex: number | null;
    suggestion: string | null;
}

interface ActivePollResponse {
    poll: PollData | null;
    myVote?: MyVote | null;
    optionCounts?: number[];
    suggestionsCount?: number;
    totalVotes?: number;
}

export const PrizePollCard: React.FC = () => {
    const { t } = useT();
    const [data, setData] = useState<ActivePollResponse | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [suggestion, setSuggestion] = useState('');
    const [useSuggestion, setUseSuggestion] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const token = localStorage.getItem('quest_token') || '';

    const fetchPoll = async () => {
        try {
            const res = await fetch('/api/polls/active', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { setData({ poll: null }); return; }
            setData(await res.json());
        } catch {
            setData({ poll: null });
        }
    };

    useEffect(() => {
        if (token) fetchPoll();
    }, []);

    if (!data || !data.poll) return null;
    const poll = data.poll;
    const voted = !!data.myVote;

    const submitVote = async () => {
        setError('');
        const body: { optionIndex?: number; suggestion?: string } = {};
        if (useSuggestion) {
            if (suggestion.trim() === '') { setError(t('poll.errSuggestion')); return; }
            body.suggestion = suggestion.trim();
        } else if (selected !== null) {
            body.optionIndex = selected;
        } else {
            setError(t('poll.errPickOption'));
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`/api/polls/${poll.id}/vote`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok || res.status === 409) {
                await fetchPoll();
            } else {
                const err = await res.json().catch(() => ({}));
                setError(err.error || t('poll.errFailVote'));
            }
        } catch {
            setError(t('poll.errFailVote'));
        }
        setSubmitting(false);
    };

    const votedLabel = data.myVote?.suggestion
        ? data.myVote.suggestion
        : (data.myVote?.optionIndex !== null && data.myVote?.optionIndex !== undefined
            ? poll.options[data.myVote.optionIndex]
            : '');

    return (
        <Card className="bg-white/80 border border-brand-dark/5 p-6 md:p-7">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Vote size={20} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">{t('poll.prizePoll')}</p>
                    <h3 className="font-bold text-brand-dark text-lg leading-tight">{poll.question}</h3>
                </div>
            </div>
            {poll.description && <p className="text-sm text-brand-dark/60 mb-4">{poll.description}</p>}

            {voted ? (
                <div className="mt-3">
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-2xl px-4 py-3 font-bold text-sm">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <span>{t('poll.youVoted', { choice: votedLabel })}</span>
                    </div>
                    <p className="text-xs text-brand-dark/40 font-bold mt-2 text-center">
                        {t('poll.totalVotes', { count: data.totalVotes ?? 0 })}
                    </p>
                </div>
            ) : (
                <div className="space-y-2 mt-3">
                    {poll.options.map((opt, i) => (
                        <label
                            key={i}
                            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer transition-all ${
                                !useSuggestion && selected === i
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-brand-dark/10 hover:border-indigo-300'
                            }`}
                        >
                            <input
                                type="radio"
                                name={`poll-${poll.id}`}
                                checked={!useSuggestion && selected === i}
                                onChange={() => { setSelected(i); setUseSuggestion(false); }}
                                className="accent-indigo-600 w-4 h-4"
                            />
                            <span className="font-bold text-sm text-brand-dark">{opt}</span>
                        </label>
                    ))}

                    {poll.allowSuggestions && (
                        <div
                            className={`rounded-2xl border-2 px-4 py-3 transition-all ${
                                useSuggestion ? 'border-indigo-500 bg-indigo-50' : 'border-brand-dark/10'
                            }`}
                        >
                            <label className="flex items-center gap-3 cursor-pointer mb-2">
                                <input
                                    type="radio"
                                    name={`poll-${poll.id}`}
                                    checked={useSuggestion}
                                    onChange={() => setUseSuggestion(true)}
                                    className="accent-indigo-600 w-4 h-4"
                                />
                                <span className="font-bold text-sm text-brand-dark flex items-center gap-1.5">
                                    <MessageSquarePlus size={16} /> {t('poll.suggestOwn')}
                                </span>
                            </label>
                            {useSuggestion && (
                                <input
                                    type="text"
                                    value={suggestion}
                                    maxLength={200}
                                    onChange={e => setSuggestion(e.target.value)}
                                    placeholder={t('poll.typeIdea')}
                                    className="w-full bg-white border border-brand-dark/10 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 ring-indigo-200"
                                />
                            )}
                        </div>
                    )}

                    {error && <p className="text-red-500 text-xs font-bold px-1">{error}</p>}

                    <button
                        onClick={submitVote}
                        disabled={submitting}
                        className="w-full mt-2 bg-indigo-600 text-white font-bold rounded-2xl py-3 text-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : t('poll.submitVote')}
                    </button>
                </div>
            )}
        </Card>
    );
};
