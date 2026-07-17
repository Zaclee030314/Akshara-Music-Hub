import React, { useEffect, useState } from 'react';
import { Trophy, UserCircle2, Medal, CalendarClock } from 'lucide-react';

interface TopUser {
    userId: string;
    name: string;
    avatar: string | null;
    points: number;
    rank: number;
}

interface SeasonInfo {
    id: string;
    name: string;
    description: string | null;
    prizeTitle: string;
    prizeDetails: string | null;
    secondPlacePoints: number;
    thirdPlacePoints: number;
    startDate: string;
    endDate: string;
    status: string;
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtFull = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Formats a window like "1 Jul – 30 Sep 2026"
const formatRange = (startISO: string, endISO: string) => {
    const s = new Date(startISO);
    const e = new Date(endISO);
    if (s.getFullYear() === e.getFullYear()) {
        return `${fmtDay(s)} – ${fmtFull(e)}`;
    }
    return `${fmtFull(s)} – ${fmtFull(e)}`;
};

export const SeasonBanner: React.FC = () => {
    const [season, setSeason] = useState<SeasonInfo | null>(null);
    const [top3, setTop3] = useState<TopUser[]>([]);

    useEffect(() => {
        let active = true;
        fetch('/api/seasons/current')
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (!active || !data) return;
                setSeason(data.season || null);
                setTop3(Array.isArray(data.top3) ? data.top3 : []);
            })
            .catch(() => { /* silent — banner is non-critical */ });
        return () => { active = false; };
    }, []);

    if (!season) return null;

    const isUpcoming = season.status === 'upcoming';

    return (
        <div className="relative overflow-hidden rounded-[2rem] p-6 md:p-8 text-white shadow-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600">
            <div className="absolute -right-8 -top-8 opacity-10 rotate-12">
                <Trophy size={160} />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full">
                        {isUpcoming ? 'Upcoming Season' : 'Live Competition'}
                    </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <Trophy size={28} className="text-yellow-300 shrink-0" />
                    <h3 className="text-2xl md:text-3xl font-display font-bold tracking-tight">{season.name}</h3>
                </div>

                <div className="flex items-center gap-2 text-white/80 text-sm font-bold mb-3">
                    <CalendarClock size={16} />
                    {isUpcoming
                        ? <span>Starts {fmtFull(new Date(season.startDate))}</span>
                        : <span>{formatRange(season.startDate, season.endDate)}</span>}
                </div>

                {season.description && (
                    <p className="text-white/80 text-sm font-medium mb-4 max-w-2xl">{season.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-sm font-bold bg-white/15 rounded-xl px-3 py-1.5">🏆 1st: {season.prizeTitle}</span>
                    <span className="text-sm font-bold bg-white/15 rounded-xl px-3 py-1.5">🥈 2nd: +{season.secondPlacePoints} pts</span>
                    <span className="text-sm font-bold bg-white/15 rounded-xl px-3 py-1.5">🥉 3rd: +{season.thirdPlacePoints} pts</span>
                </div>

                {!isUpcoming && top3.length > 0 && (
                    <div className="mt-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Current Leaders</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            {top3.map(u => {
                                const medal = u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : '🥉';
                                return (
                                    <div key={u.userId} className="flex items-center gap-2.5 bg-white/10 rounded-2xl px-3 py-2 flex-1 min-w-0">
                                        <span className="text-lg shrink-0">{medal}</span>
                                        {u.avatar ? (
                                            <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover border-2 border-white/30 shrink-0" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                                <UserCircle2 size={18} />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-sm truncate">{u.name}</p>
                                            <p className="text-[11px] text-white/70 font-bold flex items-center gap-1">
                                                <Medal size={11} /> {u.points} pts
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
