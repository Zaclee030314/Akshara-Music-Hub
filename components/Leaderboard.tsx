import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Trophy, Medal, Star, UserCircle2, Loader2, Award, CalendarClock } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';

interface LeaderboardUser {
    id: string;
    name: string;
    xp: number;
    level: number;
    rank: number;
    avatar?: string | null;
    grade?: string | null;
}

// Row shape returned by /api/seasons/current/leaderboard (hydrateUsers with grade).
interface SeasonRow {
    userId: string;
    name: string;
    avatar: string | null;
    grade?: string | null;
    points: number;
    rank: number;
}

interface SeasonInfo {
    id: string;
    name: string;
    status: string;
}

interface PastWinner {
    rank: number;
    userId: string;
    name: string;
    avatar: string | null;
    points: number;
    prizeTitle: string;
}

interface PastSeason {
    id: string;
    name: string;
    endDate: string;
    prizeTitle: string;
    winners: PastWinner[];
}

type Tab = 'season' | 'alltime';

// A normalized row so both leaderboards share one renderer.
interface DisplayRow {
    id: string;
    name: string;
    avatar?: string | null;
    grade?: string | null;
    rank: number;
    value: number;
    level: number;
}

export const Leaderboard: React.FC = () => {
    const { user } = useAuth();
    const { t } = useT();
    // Default to the season-first model.
    const [tab, setTab] = useState<Tab>('season');

    // All-time (lifetime XP)
    const [allTimeData, setAllTimeData] = useState<LeaderboardUser[]>([]);
    const [allTimeLoading, setAllTimeLoading] = useState(true);
    const [allTimeError, setAllTimeError] = useState('');

    // Current season
    const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
    const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
    const [seasonMe, setSeasonMe] = useState<SeasonRow | null>(null);
    const [seasonLoading, setSeasonLoading] = useState(true);
    const [seasonError, setSeasonError] = useState('');

    const [pastSeasons, setPastSeasons] = useState<PastSeason[]>([]);

    useEffect(() => {
        // All-time leaderboard (public)
        fetch('/api/leaderboard')
            .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
            .then(data => setAllTimeData(Array.isArray(data) ? data : []))
            .catch(() => setAllTimeError(t('leaderboard.errAllTime')))
            .finally(() => setAllTimeLoading(false));

        // Current-season leaderboard (auth optional — send token so "me" resolves)
        const token = localStorage.getItem('quest_token');
        fetch('/api/seasons/current/leaderboard', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
            .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
            .then(data => {
                setSeasonInfo(data.season || null);
                setSeasonRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
                setSeasonMe(data.me || null);
            })
            .catch(() => setSeasonError(t('leaderboard.errSeason')))
            .finally(() => setSeasonLoading(false));

        fetch('/api/seasons/history')
            .then(r => (r.ok ? r.json() : []))
            .then(data => setPastSeasons(Array.isArray(data) ? data : []))
            .catch(() => { /* silent — past winners are supplementary */ });
    }, []);

    const medalFor = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉');
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const allTimeRows: DisplayRow[] = allTimeData.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, grade: p.grade,
        rank: p.rank, value: p.xp, level: p.level,
    }));

    const seasonToRow = (r: SeasonRow): DisplayRow => ({
        id: r.userId, name: r.name, avatar: r.avatar, grade: r.grade,
        rank: r.rank, value: r.points, level: Math.floor(r.points / 1000) + 1,
    });
    const seasonDisplayRows: DisplayRow[] = seasonRows.map(seasonToRow);
    // Append the caller's own standing when they sit outside the visible list.
    const seasonMeRow = seasonMe && !seasonRows.some(r => r.userId === seasonMe.userId)
        ? seasonToRow(seasonMe)
        : null;

    const isActiveTab = tab;
    const loading = isActiveTab === 'alltime' ? allTimeLoading : seasonLoading;
    const error = isActiveTab === 'alltime' ? allTimeError : seasonError;
    const valueLabel = isActiveTab === 'alltime' ? t('leaderboard.totalXp') : t('leaderboard.seasonXp');

    const renderRow = (player: DisplayRow, keySuffix = '') => {
        const isCurrentUser = user && player.id === user.id;
        let RankIcon = null;
        if (player.rank === 1) RankIcon = <Trophy size={24} className="text-yellow-400 fill-yellow-400" />;
        else if (player.rank === 2) RankIcon = <Medal size={24} className="text-gray-400 fill-gray-400" />;
        else if (player.rank === 3) RankIcon = <Medal size={24} className="text-amber-600 fill-amber-600" />;

        return (
            <div
                key={player.id + keySuffix}
                className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    isCurrentUser
                        ? 'bg-brand-blue/10 border-2 border-brand-blue shadow-sm scale-[1.02]'
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-100'
                }`}
            >
                <div className="flex items-center gap-4">
                    <div className="w-10 text-center font-bold text-xl text-brand-dark/50">
                        {RankIcon ? RankIcon : `#${player.rank}`}
                    </div>
                    <div className="flex items-center gap-3">
                        {player.avatar ? (
                            <img
                                src={player.avatar}
                                alt={player.name}
                                className={`w-10 h-10 rounded-full object-cover border-2 ${isCurrentUser ? 'border-brand-blue' : 'border-gray-200'}`}
                            />
                        ) : (
                            <div className={`p-2 rounded-full ${isCurrentUser ? 'bg-brand-blue/20 text-brand-blue' : 'bg-gray-200 text-gray-500'}`}>
                                <UserCircle2 size={24} />
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <p className={`font-bold ${isCurrentUser ? 'text-brand-blue' : 'text-brand-dark'}`}>
                                    {player.name}{isCurrentUser ? ` (${t('leaderboard.you')})` : ''}
                                </p>
                                {player.grade && (
                                    <span className="text-[10px] font-bold bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full">
                                        {player.grade}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-brand-dark/50">
                                <Star size={14} className="text-brand-orange fill-brand-orange" />
                                {t('leaderboard.level', { level: player.level })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <p className="font-bold text-lg text-brand-dark">{player.value}</p>
                    <p className="text-xs font-bold text-brand-dark/50 uppercase tracking-wider">
                        {isActiveTab === 'alltime' ? t('leaderboard.xp') : t('leaderboard.seasonXp')}
                    </p>
                </div>
            </div>
        );
    };

    const pillBase = 'flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all';

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center p-4 bg-brand-orange/10 rounded-full mb-4">
                    <Trophy size={48} className="text-brand-orange" />
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-brand-dark">{t('nav.leaderboard')}</h2>
                <p className="text-brand-dark/70 max-w-lg mx-auto">
                    {t('leaderboard.subtitle')}
                </p>
            </div>

            {/* Tab toggle */}
            <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl max-w-md mx-auto">
                <button
                    onClick={() => setTab('season')}
                    className={`${pillBase} ${tab === 'season' ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-dark/40 hover:text-brand-dark/70'}`}
                >
                    {t('leaderboard.currentSeason')}
                </button>
                <button
                    onClick={() => setTab('alltime')}
                    className={`${pillBase} ${tab === 'alltime' ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-dark/40 hover:text-brand-dark/70'}`}
                >
                    {t('leaderboard.allTime')}
                </button>
            </div>

            {/* Season header (only on season tab, when active) */}
            {tab === 'season' && seasonInfo && (
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-brand-orange -mt-2">
                    <CalendarClock size={16} />
                    {seasonInfo.name}
                </div>
            )}

            <Card className="p-4 md:p-6 shadow-xl border-t-4 border-t-brand-accent">
                {loading ? (
                    <div className="flex justify-center p-8 text-brand-dark/50">
                        <Loader2 className="animate-spin w-8 h-8" />
                    </div>
                ) : error ? (
                    <div className="text-center p-8 text-red-500 font-bold">{error}</div>
                ) : tab === 'season' && !seasonInfo ? (
                    <div className="text-center p-10 text-brand-dark/50 space-y-3">
                        <CalendarClock size={40} className="mx-auto text-brand-dark/20" />
                        <p className="font-bold">{t('leaderboard.noSeason')}</p>
                        <p className="text-sm text-brand-dark/40">{t('leaderboard.noSeasonDesc')}</p>
                    </div>
                ) : tab === 'alltime' && allTimeRows.length === 0 ? (
                    <div className="text-center p-8 text-brand-dark/50">{t('leaderboard.noUsers')}</div>
                ) : tab === 'season' && seasonDisplayRows.length === 0 ? (
                    <div className="text-center p-8 text-brand-dark/50">{t('leaderboard.noSeasonScores')}</div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-end px-1">
                            <span className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">{valueLabel}</span>
                        </div>
                        {(tab === 'alltime' ? allTimeRows : seasonDisplayRows).map(p => renderRow(p))}
                        {tab === 'season' && seasonMeRow && (
                            <>
                                <div className="text-center text-[10px] font-black text-brand-dark/20 uppercase tracking-widest">{t('leaderboard.yourStanding')}</div>
                                {renderRow(seasonMeRow, '-me')}
                            </>
                        )}
                    </div>
                )}
            </Card>

            {pastSeasons.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Award size={22} className="text-brand-orange" />
                        <h3 className="text-xl font-display font-bold text-brand-dark">{t('leaderboard.pastWinners')}</h3>
                    </div>
                    {pastSeasons.map(season => (
                        <Card key={season.id} className="p-5 md:p-6 bg-white/80 border border-brand-dark/5">
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                                <h4 className="font-bold text-brand-dark">{season.name}</h4>
                                <span className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">
                                    {t('leaderboard.ended', { date: fmtDate(season.endDate) })}
                                </span>
                            </div>
                            {season.winners.length === 0 ? (
                                <p className="text-brand-dark/40 text-sm font-bold italic">{t('leaderboard.noWinners')}</p>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-3">
                                    {season.winners.map(w => (
                                        <div key={w.userId} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 flex-1 min-w-0">
                                            <span className="text-xl shrink-0">{medalFor(w.rank)}</span>
                                            {w.avatar ? (
                                                <img src={w.avatar} alt={w.name} className="w-9 h-9 rounded-full object-cover border-2 border-gray-200 shrink-0" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                                    <UserCircle2 size={22} />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-brand-dark truncate">{w.name}</p>
                                                <p className="text-[11px] text-brand-dark/50 font-bold">
                                                    {t('leaderboard.pts', { count: w.points })}{w.rank === 1 && w.prizeTitle ? ` · ${w.prizeTitle}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
