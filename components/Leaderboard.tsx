import React, { useState, useEffect, useRef } from 'react';
import { Card } from './Card';
import { Trophy, Medal, Star, UserCircle2, Loader2, Award, CalendarClock, Search, X } from 'lucide-react';
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

    // `t` changes identity when the language changes; effects below read it through
    // this ref so they never capture a stale copy nor re-run on every language tick.
    const tRef = useRef(t);
    tRef.current = t;

    // All-time (lifetime XP)
    const [allTimeData, setAllTimeData] = useState<LeaderboardUser[]>([]);
    const [allTimeMe, setAllTimeMe] = useState<LeaderboardUser | null>(null);
    // False while the API still answers with the legacy bare array (no `me` concept),
    // so we don't wrongly tell a ranked student they have no XP during a staggered deploy.
    const [allTimeMeSupported, setAllTimeMeSupported] = useState(false);
    const [allTimeLoading, setAllTimeLoading] = useState(true);
    const [allTimeError, setAllTimeError] = useState('');

    // Search (All-Time tab only): raw input + 300ms-debounced value that drives the fetch.
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Current season
    const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
    const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
    const [seasonMe, setSeasonMe] = useState<SeasonRow | null>(null);
    const [seasonLoading, setSeasonLoading] = useState(true);
    const [seasonError, setSeasonError] = useState('');

    const [pastSeasons, setPastSeasons] = useState<PastSeason[]>([]);

    // Debounce the search box (300ms) so typing doesn't fire a request per keystroke.
    useEffect(() => {
        const id = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
        return () => clearTimeout(id);
    }, [searchInput]);

    // All-time leaderboard (public; token sent when present so "me" resolves).
    // Re-runs whenever the debounced query changes.
    useEffect(() => {
        let cancelled = false;
        setAllTimeLoading(true);
        setAllTimeError('');

        const token = localStorage.getItem('quest_token');
        const url = searchQuery
            ? `/api/leaderboard?q=${encodeURIComponent(searchQuery)}`
            : '/api/leaderboard';

        fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
            .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
            .then(data => {
                if (cancelled) return;
                // Tolerate BOTH shapes: the old bare array and the new { leaderboard, me, total }.
                // The API and the bundle can deploy moments apart.
                const rows = Array.isArray(data) ? data : (data?.leaderboard ?? []);
                const me = Array.isArray(data) ? null : (data?.me ?? null);
                setAllTimeData(Array.isArray(rows) ? rows : []);
                setAllTimeMe(me);
                setAllTimeMeSupported(!Array.isArray(data));
            })
            .catch(() => { if (!cancelled) setAllTimeError(tRef.current('leaderboard.errAllTime')); })
            .finally(() => { if (!cancelled) setAllTimeLoading(false); });

        return () => { cancelled = true; };
    }, [searchQuery]);

    // Season standings + past-season history — fetched once on mount.
    useEffect(() => {
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
            .catch(() => setSeasonError(tRef.current('leaderboard.errSeason')))
            .finally(() => setSeasonLoading(false));

        fetch('/api/seasons/history')
            .then(r => (r.ok ? r.json() : []))
            .then(data => setPastSeasons(Array.isArray(data) ? data : []))
            .catch(() => { /* silent — past winners are supplementary */ });
    }, []);

    const medalFor = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉');
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const allTimeToRow = (p: LeaderboardUser): DisplayRow => ({
        id: p.id, name: p.name, avatar: p.avatar, grade: p.grade,
        rank: p.rank, value: p.xp, level: p.level,
    });
    const allTimeRows: DisplayRow[] = allTimeData.map(allTimeToRow);
    // Append the caller's own standing when they sit outside the visible list
    // (mirrors seasonMeRow). Suppressed while searching — the query drives the list.
    const allTimeMeRow = allTimeMe && !searchQuery && !allTimeData.some(r => r.id === allTimeMe.id)
        ? allTimeToRow(allTimeMe)
        : null;

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
                className={`flex items-center justify-between gap-3 p-4 rounded-xl transition-all ${
                    isCurrentUser
                        ? 'bg-brand-blue/10 border-2 border-brand-blue shadow-sm scale-[1.02]'
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-100'
                }`}
            >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-10 shrink-0 text-center font-bold text-xl text-brand-dark/50">
                        {RankIcon ? RankIcon : `#${player.rank}`}
                    </div>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {player.avatar ? (
                            <img
                                src={player.avatar}
                                alt={player.name}
                                className={`w-10 h-10 shrink-0 rounded-full object-cover border-2 ${isCurrentUser ? 'border-brand-blue' : 'border-gray-200'}`}
                            />
                        ) : (
                            <div className={`p-2 shrink-0 rounded-full ${isCurrentUser ? 'bg-brand-blue/20 text-brand-blue' : 'bg-gray-200 text-gray-500'}`}>
                                <UserCircle2 size={24} />
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <p className={`font-bold truncate ${isCurrentUser ? 'text-brand-blue' : 'text-brand-dark'}`}>
                                    {player.name}{isCurrentUser ? ` (${t('leaderboard.you')})` : ''}
                                </p>
                                {player.grade && (
                                    <span className="text-[10px] font-bold bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full shrink-0">
                                        {player.grade}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-brand-dark/50">
                                <Star size={14} className="text-brand-orange fill-brand-orange shrink-0" />
                                {t('leaderboard.level', { level: player.level })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-right shrink-0">
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

            {/* Search (All-Time only). Lives outside the Card so it keeps focus while refetching. */}
            {tab === 'alltime' && (
                <div className="relative w-full max-w-md mx-auto">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/30 pointer-events-none" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        maxLength={50}
                        placeholder={t('leaderboard.searchPlaceholder')}
                        aria-label={t('leaderboard.searchPlaceholder')}
                        className="w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded-xl border border-gray-200 bg-white text-brand-dark font-bold text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue"
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => setSearchInput('')}
                            aria-label={t('leaderboard.clearSearch')}
                            title={t('leaderboard.clearSearch')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-brand-dark/40 hover:text-brand-dark hover:bg-gray-100"
                        >
                            <X size={18} />
                        </button>
                    )}
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
                    <div className="text-center p-8 text-brand-dark/50 space-y-3">
                        {searchQuery ? (
                            <>
                                <Search size={40} className="mx-auto text-brand-dark/20" />
                                <p className="font-bold">{t('leaderboard.noMatches')}</p>
                                <button
                                    type="button"
                                    onClick={() => setSearchInput('')}
                                    className="text-sm font-bold text-brand-blue hover:underline min-h-[44px] px-3"
                                >
                                    {t('leaderboard.clearSearch')}
                                </button>
                            </>
                        ) : (
                            <p>{t('leaderboard.noUsers')}</p>
                        )}
                    </div>
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
                        {tab === 'alltime' && allTimeMeRow && (
                            <>
                                <div className="text-center text-[10px] font-black text-brand-dark/20 uppercase tracking-widest">{t('leaderboard.yourStanding')}</div>
                                {renderRow(allTimeMeRow, '-me')}
                            </>
                        )}
                        {tab === 'alltime' && !searchQuery && !allTimeMe && allTimeMeSupported && user?.role === 'student' && (
                            <>
                                <div className="text-center text-[10px] font-black text-brand-dark/20 uppercase tracking-widest">{t('leaderboard.yourStanding')}</div>
                                <p className="text-center text-sm text-brand-dark/40 font-bold px-4">{t('leaderboard.notRankedYet')}</p>
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
