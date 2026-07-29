import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from './Card';
import { Trophy, UserCircle2, Loader2, Award, CalendarClock, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';
import { LeaderboardRow, DisplayRow } from './LeaderboardRow';
import { SeasonPicker, SeasonListItem } from './SeasonPicker';

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

// Rows shown before the "Show more" expander. A 100-row wall is unusable on a phone.
const SEASON_PREVIEW = 20;

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

    // Season standings — for WHICHEVER season the picker has selected, not just the
    // running one. Past seasons are served frozen (source: 'snapshot').
    const [selectedSeason, setSelectedSeason] = useState<SeasonListItem | null>(null);
    const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
    const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
    const [seasonMe, setSeasonMe] = useState<SeasonRow | null>(null);
    const [seasonSource, setSeasonSource] = useState<'snapshot' | 'live' | null>(null);
    const [seasonExpanded, setSeasonExpanded] = useState(false);
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

    // Past-season prize history — fetched once on mount.
    useEffect(() => {
        fetch('/api/seasons/history')
            .then(r => (r.ok ? r.json() : []))
            .then(data => setPastSeasons(Array.isArray(data) ? data : []))
            .catch(() => { /* silent — past winners are supplementary */ });
    }, []);

    // The picker owns the season list and reports its default on mount, so this is also
    // how the first season board gets loaded. `null` means there is no browsable season.
    const handleSeasonChange = useCallback((s: SeasonListItem | null) => {
        setSelectedSeason(s);
        setSeasonExpanded(false);
        if (!s) {
            setSeasonInfo(null);
            setSeasonRows([]);
            setSeasonMe(null);
            setSeasonSource(null);
            setSeasonLoading(false);
        }
    }, []);

    // Standings for the selected season (auth optional — send the token so "me" resolves).
    const selectedSeasonId = selectedSeason?.id ?? null;
    useEffect(() => {
        if (!selectedSeasonId) return;
        let cancelled = false;
        setSeasonLoading(true);
        setSeasonError('');

        const token = localStorage.getItem('quest_token');
        fetch(`/api/seasons/${selectedSeasonId}/standings?limit=100`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
            .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
            .then(data => {
                if (cancelled) return;
                setSeasonInfo(data.season || null);
                setSeasonRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
                setSeasonMe(data.me || null);
                setSeasonSource(data.source === 'snapshot' ? 'snapshot' : 'live');
            })
            .catch(() => { if (!cancelled) setSeasonError(tRef.current('leaderboard.errSeason')); })
            .finally(() => { if (!cancelled) setSeasonLoading(false); });

        return () => { cancelled = true; };
    }, [selectedSeasonId]);

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
    // Collapse the season board to a readable preview until the student asks for more.
    const visibleSeasonRows = seasonExpanded ? seasonDisplayRows : seasonDisplayRows.slice(0, SEASON_PREVIEW);
    const canExpandSeason = seasonDisplayRows.length > SEASON_PREVIEW;
    // Append the caller's own standing when they sit outside the VISIBLE list — that
    // includes ranks hidden behind the "Show more" fold, not just ranks outside the top 100.
    const seasonMeRow = seasonMe && !visibleSeasonRows.some(r => r.id === seasonMe.userId)
        ? seasonToRow(seasonMe)
        : null;

    const isActiveTab = tab;
    const loading = isActiveTab === 'alltime' ? allTimeLoading : seasonLoading;
    const error = isActiveTab === 'alltime' ? allTimeError : seasonError;
    const valueLabel = isActiveTab === 'alltime' ? t('leaderboard.totalXp') : t('leaderboard.seasonXp');
    const unitLabel = isActiveTab === 'alltime' ? t('leaderboard.xp') : t('leaderboard.seasonXp');

    const renderRow = (player: DisplayRow, keySuffix = '') => (
        <LeaderboardRow key={player.id + keySuffix} player={player} unitLabel={unitLabel} />
    );

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

            {/* Season picker + header (season tab only) */}
            {tab === 'season' && (
                <div className="space-y-3 -mt-2">
                    <SeasonPicker value={selectedSeason?.id ?? null} onChange={handleSeasonChange} />
                    {seasonInfo && (
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                            <span className="flex items-center gap-2 text-sm font-bold text-brand-orange">
                                <CalendarClock size={16} />
                                {seasonInfo.name}
                            </span>
                            {seasonSource && (
                                <span
                                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                        seasonSource === 'snapshot'
                                            ? 'bg-purple-50 text-purple-600'
                                            : 'bg-green-50 text-green-600'
                                    }`}
                                >
                                    {seasonSource === 'snapshot'
                                        ? t('leaderboard.finalStandings')
                                        : t('leaderboard.liveStandings')}
                                </span>
                            )}
                        </div>
                    )}
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
                        {(tab === 'alltime' ? allTimeRows : visibleSeasonRows).map(p => renderRow(p))}
                        {tab === 'season' && canExpandSeason && (
                            <button
                                type="button"
                                onClick={() => setSeasonExpanded(v => !v)}
                                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-brand-blue hover:bg-gray-50 active:scale-[0.99] transition-all"
                            >
                                {seasonExpanded ? (
                                    <><ChevronUp size={16} /> {t('leaderboard.showLess')}</>
                                ) : (
                                    <><ChevronDown size={16} /> {t('leaderboard.showMore')}</>
                                )}
                            </button>
                        )}
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
