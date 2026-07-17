import React, { useEffect, useState } from 'react';
import { Trophy, UserCircle2, X } from 'lucide-react';

interface Winner {
    rank: number;
    userId: string;
    points: number;
    awardedPoints: number;
    prizeTitle: string;
    name: string;
    avatar: string | null;
}

interface FinalizedSeason {
    id: string;
    name: string;
    prizeTitle: string;
    prizeDetails: string | null;
    secondPlacePoints: number;
    thirdPlacePoints: number;
    winners: Winner[];
}

export const SeasonResultsPopup: React.FC = () => {
    const [season, setSeason] = useState<FinalizedSeason | null>(null);
    const token = localStorage.getItem('quest_token') || '';

    useEffect(() => {
        if (!token) return;
        let active = true;
        fetch('/api/seasons/latest-finalized', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (!active || !data || !data.season) return;
                const s: FinalizedSeason = data.season;
                if (localStorage.getItem('season_seen_' + s.id)) return;
                setSeason(s);
            })
            .catch(() => { /* silent */ });
        return () => { active = false; };
    }, [token]);

    if (!season) return null;

    const close = () => {
        localStorage.setItem('season_seen_' + season.id, '1');
        setSeason(null);
    };

    // Podium order: 2nd, 1st, 3rd for a classic podium look
    const byRank = (r: number) => season.winners.find(w => w.rank === r) || null;
    const podium = [byRank(2), byRank(1), byRank(3)];
    const medalFor = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : '🥉');
    const heightFor = (r: number) => (r === 1 ? 'h-28' : r === 2 ? 'h-20' : 'h-16');

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm" onClick={close} />
            <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 md:p-10 animate-pop-in border border-brand-dark/10 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={close}
                    className="absolute top-5 right-5 text-brand-dark/30 hover:text-brand-dark transition-colors"
                    aria-label="Close"
                >
                    <X size={22} />
                </button>

                <div className="text-center mb-8">
                    <div className="relative inline-block mb-3">
                        <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-30 animate-pulse rounded-full" />
                        <Trophy size={56} className="text-brand-accent relative z-10 mx-auto" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-brand-dark">🏆 {season.name} Results!</h2>
                    <p className="text-brand-dark/50 font-medium text-sm mt-1">The season has ended — here are the champions.</p>
                </div>

                {season.winners.length === 0 ? (
                    <p className="text-center text-brand-dark/40 font-bold italic py-8">No participants this season.</p>
                ) : (
                    <div className="flex items-end justify-center gap-3 md:gap-4 mb-6">
                        {podium.map((w, idx) => {
                            if (!w) return <div key={idx} className="flex-1" />;
                            return (
                                <div key={w.userId} className="flex-1 flex flex-col items-center">
                                    <div className="text-2xl mb-1">{medalFor(w.rank)}</div>
                                    {w.avatar ? (
                                        <img src={w.avatar} alt={w.name} className="w-14 h-14 rounded-full object-cover border-4 border-brand-orange/30 mb-2" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full bg-brand-dark/5 flex items-center justify-center mb-2 text-brand-dark/40">
                                            <UserCircle2 size={32} />
                                        </div>
                                    )}
                                    <p className="font-bold text-sm text-brand-dark text-center leading-tight mb-1 truncate max-w-full">{w.name}</p>
                                    <div className={`w-full ${heightFor(w.rank)} rounded-t-2xl bg-gradient-to-t from-indigo-500 to-purple-500 flex items-start justify-center pt-2`}>
                                        <span className="text-white font-black text-lg">{w.points}</span>
                                    </div>
                                    {w.rank === 1 ? (
                                        <div className="text-center mt-2">
                                            <p className="text-[11px] font-black text-brand-orange uppercase tracking-wide">Won: {w.prizeTitle}</p>
                                            {season.prizeDetails && <p className="text-[10px] text-brand-dark/50 mt-0.5">{season.prizeDetails}</p>}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] font-bold text-brand-dark/60 mt-2 text-center">+{w.awardedPoints} bonus points</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center mb-6">
                    <p className="text-xs font-bold text-brand-dark/60">
                        🏆 1st: {season.prizeTitle} · 🥈 2nd: +{season.secondPlacePoints} pts · 🥉 3rd: +{season.thirdPlacePoints} pts
                    </p>
                </div>

                <button
                    onClick={close}
                    className="w-full bg-brand-dark text-white font-bold rounded-2xl py-4 text-sm hover:bg-brand-dark/90 active:scale-95 transition-all"
                >
                    Awesome, close
                </button>
            </div>
        </div>
    );
};
