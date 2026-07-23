import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { Trophy, Crown, Medal, Calendar, Gift, UserCircle2, ArrowRight } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';

interface Season {
    id: string;
    name: string;
    description: string | null;
    prizeTitle: string;
    prizeDetails: string | null;
    secondPlacePoints: number;
    thirdPlacePoints: number;
    secondPrizeTitle: string | null;
    thirdPrizeTitle: string | null;
    firstPrizeCoins: number;
    secondPrizeCoins: number;
    thirdPrizeCoins: number;
    startDate: string;
    endDate: string;
    status: string;
}

interface Winner {
    rank: number;
    userId: string;
    points: number;
    awardedPoints: number;
    prizeTitle: string;
    name: string;
    avatar: string | null;
}

interface FinalizedSeason extends Season {
    winners: Winner[];
}

interface Props {
    onJoin: () => void;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const SeasonShowcase: React.FC<Props> = ({ onJoin }) => {
    const { t } = useT();
    const [season, setSeason] = useState<Season | null>(null);
    const [lastFinalized, setLastFinalized] = useState<FinalizedSeason | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await fetch('/api/seasons/current');
                if (res.ok) {
                    const data = await res.json();
                    if (active) {
                        setSeason(data.season || null);
                        setLastFinalized(data.lastFinalized || null);
                    }
                }
            } catch (err) {
                console.error('Failed to load season showcase', err);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    // Render nothing while loading or when there's nothing to show.
    if (loading) return null;
    if (!season && !lastFinalized) return null;

    const single = !(season && lastFinalized);

    const rankIcon = (rank: number) => {
        if (rank === 1) return <Crown size={18} className="text-yellow-500" />;
        if (rank === 2) return <Medal size={18} className="text-gray-400" />;
        return <Medal size={18} className="text-amber-700" />;
    };

    return (
        <section className="max-w-6xl mx-auto px-4">
            <div className={`grid gap-6 ${single ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
                {/* Active / upcoming season */}
                {season && (
                    <div className="relative overflow-hidden rounded-3xl border-2 border-brand-orange/20 bg-gradient-to-br from-brand-orange/5 via-yellow-50/60 to-white p-8 shadow-xl flex flex-col">
                        <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none">
                            <Trophy size={160} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full">
                            <span className="text-[11px] font-black text-brand-orange uppercase tracking-widest mb-2">{t('season.competition')}</span>
                            <h3 className="font-display font-bold text-2xl md:text-3xl text-brand-dark leading-tight">{season.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-brand-dark/50 font-bold mt-2">
                                <Calendar size={14} /> {fmt(season.startDate)} → {fmt(season.endDate)}
                            </div>

                            <div className="mt-5 space-y-2 flex-1">
                                <div className="flex items-start gap-2">
                                    <Gift size={18} className="text-brand-orange shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-brand-dark">{t('season.firstPrize', { prize: season.prizeTitle })}</p>
                                        {season.prizeDetails && (
                                            <p className="text-sm text-brand-dark/60">{season.prizeDetails}</p>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm text-brand-dark/60 font-medium pl-7">
                                    {t('season.plusPrizeCoins')} · 🥈 2nd {season.secondPrizeTitle ? `${season.secondPrizeTitle} ` : ''}+{season.secondPrizeCoins}🪙 · 🥉 3rd {season.thirdPrizeTitle ? `${season.thirdPrizeTitle} ` : ''}+{season.thirdPrizeCoins}🪙
                                </p>
                            </div>

                            <Button
                                size="lg"
                                onClick={onJoin}
                                className="mt-6 w-full bg-brand-orange hover:bg-orange-400 shadow-lg shadow-brand-orange/20"
                            >
                                {t('season.joinCompetition')} <ArrowRight size={18} className="ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Last season's champions */}
                {lastFinalized && (
                    <div className="relative overflow-hidden rounded-3xl border-2 border-brand-dark/5 bg-white p-8 shadow-xl flex flex-col">
                        <span className="text-[11px] font-black text-brand-dark/40 uppercase tracking-widest mb-2">{t('season.lastChampions')}</span>
                        <h3 className="font-display font-bold text-2xl text-brand-dark leading-tight">{lastFinalized.name}</h3>

                        <div className="mt-5 space-y-3 flex-1">
                            {lastFinalized.winners.length === 0 ? (
                                <p className="text-sm text-brand-dark/40 font-bold italic">{t('leaderboard.noWinners')}</p>
                            ) : (
                                lastFinalized.winners.map(w => (
                                    <div
                                        key={w.userId}
                                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${w.rank === 1 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' : 'bg-gray-50'}`}
                                    >
                                        {rankIcon(w.rank)}
                                        {w.avatar ? (
                                            <img src={w.avatar} alt={w.name} className="w-9 h-9 rounded-full object-cover" />
                                        ) : (
                                            <UserCircle2 size={28} className="text-brand-dark/30" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-brand-dark truncate">{w.name}</p>
                                            {w.rank === 1 && (
                                                <p className="text-xs text-brand-orange font-bold">{t('season.won', { prize: w.prizeTitle })}</p>
                                            )}
                                        </div>
                                        <span className="text-sm font-bold text-brand-dark/50 shrink-0">{t('leaderboard.pts', { count: w.points })}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default SeasonShowcase;
