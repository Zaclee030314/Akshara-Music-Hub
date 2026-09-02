import React, { useEffect, useState } from 'react';
import { Trophy, X, Coins } from 'lucide-react';
import { SeasonPodium } from './SeasonPodium';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';

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
    secondPrizeTitle: string | null;
    thirdPrizeTitle: string | null;
    firstPrizeCoins: number;
    secondPrizeCoins: number;
    thirdPrizeCoins: number;
    winners: Winner[];
}

export const SeasonResultsPopup: React.FC = () => {
    const { user } = useAuth();
    const { t } = useT();
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
                // Per-account gate: skip if this account already dismissed this season.
                if (user?.lastSeenSeasonId === s.id) return;
                // Same-device fast path so the popup doesn't flash before user state loads.
                if (localStorage.getItem('season_seen_' + s.id)) return;
                setSeason(s);
            })
            .catch(() => { /* silent */ });
        return () => { active = false; };
    }, [token, user?.lastSeenSeasonId]);

    if (!season) return null;

    const close = () => {
        const seasonId = season.id;
        localStorage.setItem('season_seen_' + seasonId, '1');
        setSeason(null);
        // Persist per-account so the popup won't reappear on other devices.
        if (token) {
            fetch('/api/profile/season-seen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ seasonId }),
            }).catch(() => { /* silent — localStorage already covers this device */ });
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm" onClick={close} />
            <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 md:p-10 animate-pop-in border border-brand-dark/10 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={close}
                    className="absolute top-5 right-5 text-brand-dark/30 hover:text-brand-dark transition-colors"
                    aria-label={t('common.close')}
                >
                    <X size={22} />
                </button>

                <div className="text-center mb-8">
                    <div className="relative inline-block mb-3">
                        <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-30 animate-pulse rounded-full" />
                        <Trophy size={56} className="text-brand-accent relative z-10 mx-auto" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-brand-dark">{t('season.resultsTitle', { name: season.name })}</h2>
                    <p className="text-brand-dark/50 font-medium text-sm mt-1">{t('season.resultsSubtitle')}</p>
                </div>

                {season.winners.length === 0 ? (
                    <p className="text-center text-brand-dark/40 font-bold italic py-8">{t('season.noParticipants')}</p>
                ) : (
                    <div className="mb-6">
                        <SeasonPodium winners={season.winners} championNote={season.prizeDetails} />
                    </div>
                )}

                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center mb-6">
                    <p className="text-xs font-bold text-brand-dark/60">
                        🏆 1st: {season.prizeTitle}{season.firstPrizeCoins > 0 && <> (+{season.firstPrizeCoins.toLocaleString()}<Coins size={12} className="inline -mt-0.5 text-yellow-500 fill-yellow-400" />)</>}
                        {' · '}🥈 2nd: {season.secondPrizeTitle || <>+{season.secondPrizeCoins.toLocaleString()}<Coins size={12} className="inline -mt-0.5 text-yellow-500 fill-yellow-400" /></>}
                        {' · '}🥉 3rd: {season.thirdPrizeTitle || <>+{season.thirdPrizeCoins.toLocaleString()}<Coins size={12} className="inline -mt-0.5 text-yellow-500 fill-yellow-400" /></>}
                    </p>
                </div>

                <button
                    onClick={close}
                    className="w-full bg-brand-dark text-white font-bold rounded-2xl py-4 text-sm hover:bg-brand-dark/90 active:scale-95 transition-all"
                >
                    {t('season.awesomeClose')}
                </button>
            </div>
        </div>
    );
};
