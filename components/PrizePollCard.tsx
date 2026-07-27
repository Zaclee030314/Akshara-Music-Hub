import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { Vote, CheckCircle2, Loader2, MessageSquarePlus, Pencil } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';

// `index` is the option's TRUE position in the poll's stored options array.
// It is what we post back when voting — never the map position, because
// soft-removed options are filtered out server-side without renumbering.
interface PollOption {
    index: number;
    text: string;
    count: number;
    suggestedByName: string | null;
}

interface PollData {
    id: string;
    question: string;
    description: string | null;
    options: PollOption[];
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
    totalVotes?: number;
}

export const PrizePollCard: React.FC = () => {
    const { t } = useT();
    const [data, setData] = useState<ActivePollResponse | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [suggestion, setSuggestion] = useState('');
    const [useSuggestion, setUseSuggestion] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [changing, setChanging] = useState(false);
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
    const options = poll.options || [];
    const hasVoted = !!data.myVote;
    // Show the picker when they haven't voted yet, or when they asked to change.
    const picking = !hasVoted || changing;

    const submitVote = async () => {
        setError('');
        const body: { optionIndex?: number; suggestion?: string } = {};
        if (useSuggestion) {
            if (suggestion.trim() === '') { setError(t('poll.errSuggestion')); return; }
            body.suggestion = suggestion.trim();
        } else if (selected !== null) {
            body.optionIndex = selected; // already the stable index
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
            if (res.ok) {
                setSuggestion('');
                setUseSuggestion(false);
                setSelected(null);
                setChanging(false);
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

    const startChanging = () => {
        setError('');
        setUseSuggestion(false);
        setSuggestion('');
        setSelected(data.myVote?.optionIndex ?? null);
        setChanging(true);
    };

    const myIndex = data.myVote?.optionIndex ?? null;
    const votedLabel = myIndex !== null
        ? (options.find(o => o.index === myIndex)?.text || '')
        : (data.myVote?.suggestion || '');
    const maxCount = Math.max(1, ...options.map(o => o.count));

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

            {!picking ? (
                <div className="mt-3">
                    {votedLabel && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-2xl px-4 py-3 font-bold text-sm">
                            <CheckCircle2 size={18} className="shrink-0" />
                            <span>{t('poll.youVoted', { choice: votedLabel })}</span>
                        </div>
                    )}

                    <div className="space-y-3 mt-4">
                        {options.map(o => {
                            const pct = Math.round((o.count / maxCount) * 100);
                            const isMine = o.index === myIndex;
                            return (
                                <div key={o.index}>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className={`text-sm font-bold min-w-0 ${isMine ? 'text-indigo-700' : 'text-brand-dark'}`}>
                                            {o.text}
                                            {isMine && (
                                                <span className="ml-2 text-[9px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-black uppercase tracking-wide align-middle">
                                                    {t('poll.yourVote')}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs font-black text-indigo-600 shrink-0">
                                            {t('poll.votesShort', { count: o.count })}
                                        </span>
                                    </div>
                                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${isMine ? 'bg-indigo-600' : 'bg-indigo-400'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    {o.suggestedByName && (
                                        <p className="text-[10px] text-brand-dark/40 font-bold mt-1">
                                            {t('poll.suggestedBy', { name: o.suggestedByName })}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-xs text-brand-dark/40 font-bold mt-4 text-center">
                        {t('poll.totalVotes', { count: data.totalVotes ?? 0 })}
                    </p>

                    <button
                        onClick={startChanging}
                        className="w-full mt-3 bg-indigo-50 text-indigo-600 font-bold rounded-2xl py-2.5 text-sm hover:bg-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Pencil size={14} /> {t('poll.changeVote')}
                    </button>
                </div>
            ) : (
                <div className="space-y-2 mt-3">
                    {options.map(o => (
                        <label
                            key={o.index}
                            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer transition-all ${
                                !useSuggestion && selected === o.index
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-brand-dark/10 hover:border-indigo-300'
                            }`}
                        >
                            <input
                                type="radio"
                                name={`poll-${poll.id}`}
                                checked={!useSuggestion && selected === o.index}
                                onChange={() => { setSelected(o.index); setUseSuggestion(false); }}
                                className="accent-indigo-600 w-4 h-4"
                            />
                            <span className="min-w-0">
                                <span className="font-bold text-sm text-brand-dark">{o.text}</span>
                                <span className="ml-2 text-xs font-bold text-brand-dark/40">
                                    {t('poll.votesShort', { count: o.count })}
                                </span>
                                {o.suggestedByName && (
                                    <span className="block text-[10px] text-brand-dark/40 font-bold">
                                        {t('poll.suggestedBy', { name: o.suggestedByName })}
                                    </span>
                                )}
                            </span>
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

                    <div className="flex gap-2 mt-2">
                        {hasVoted && (
                            <button
                                onClick={() => { setChanging(false); setError(''); }}
                                disabled={submitting}
                                className="flex-1 bg-gray-50 text-brand-dark/50 font-bold rounded-2xl py-3 text-sm hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {t('poll.cancelChange')}
                            </button>
                        )}
                        <button
                            onClick={submitVote}
                            disabled={submitting}
                            className="flex-[2] bg-indigo-600 text-white font-bold rounded-2xl py-3 text-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {submitting
                                ? <Loader2 size={18} className="animate-spin" />
                                : (hasVoted ? t('poll.updateVote') : t('poll.submitVote'))}
                        </button>
                    </div>
                </div>
            )}
        </Card>
    );
};
