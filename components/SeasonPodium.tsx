import React from 'react';
import { UserCircle2, Coins, Crown } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';

// A three-step stage: 2nd on the left, 1st raised in the centre, 3rd on the
// right. Shared by the leaderboard's Past Season Winners and the season
// results popup so every podium in the app looks the same.

export interface PodiumWinner {
    rank: number;
    userId: string;
    name: string;
    avatar: string | null;
    points: number;
    prizeTitle?: string | null;
    awardedPoints?: number; // coin prize paid out at finalize
}

interface Props {
    winners: PodiumWinner[];
    /** Extra line shown under the champion's prize (e.g. prize details). */
    championNote?: string | null;
    /** Unit label under the score — defaults to "pts". */
    unitLabel?: string;
    compact?: boolean;
}

const STEP: Record<number, { height: string; gradient: string; ring: string; medal: string }> = {
    1: { height: 'h-28 md:h-32', gradient: 'from-yellow-400 via-amber-400 to-orange-400', ring: 'ring-yellow-400', medal: '🥇' },
    2: { height: 'h-20 md:h-24', gradient: 'from-slate-300 via-gray-300 to-slate-400', ring: 'ring-slate-300', medal: '🥈' },
    3: { height: 'h-14 md:h-16', gradient: 'from-orange-300 via-amber-600 to-orange-700', ring: 'ring-orange-400', medal: '🥉' },
};

export const SeasonPodium: React.FC<Props> = ({ winners, championNote, unitLabel, compact }) => {
    const { t } = useT();
    const byRank = (r: number) => winners.find(w => w.rank === r) || null;
    const order = [byRank(2), byRank(1), byRank(3)];
    const avatarSize = compact ? 'w-12 h-12' : 'w-14 h-14 md:w-16 md:h-16';

    return (
        <div className="relative">
            <div className="flex items-end justify-center gap-2 md:gap-4">
                {order.map((w, idx) => {
                    const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                    const step = STEP[rank];
                    if (!w) {
                        // Keep the stage shape even when a place is empty.
                        return (
                            <div key={`empty-${rank}`} className="flex-1 flex flex-col items-center opacity-40">
                                <div className={`${avatarSize} rounded-full bg-brand-dark/5 flex items-center justify-center text-brand-dark/30 mb-2`}>
                                    <UserCircle2 size={28} />
                                </div>
                                <p className="text-xs font-bold text-brand-dark/40 mb-2">—</p>
                                <div className={`w-full ${step.height} rounded-t-2xl bg-gradient-to-t ${step.gradient} flex items-start justify-center pt-2`}>
                                    <span className="text-white/90 font-black text-2xl drop-shadow">{rank}</span>
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={w.userId} className="flex-1 flex flex-col items-center min-w-0">
                            {rank === 1 && <Crown size={22} className="text-yellow-500 fill-yellow-400 mb-1 animate-bounce-sm" />}
                            <div className="relative mb-2">
                                {w.avatar ? (
                                    <img src={w.avatar} alt={w.name} className={`${avatarSize} rounded-full object-cover ring-4 ${step.ring} shadow-lg`} />
                                ) : (
                                    <div className={`${avatarSize} rounded-full bg-brand-dark/5 ring-4 ${step.ring} flex items-center justify-center text-brand-dark/40 shadow-lg`}>
                                        <UserCircle2 size={32} />
                                    </div>
                                )}
                                <span className="absolute -bottom-2 -right-2 text-xl drop-shadow">{step.medal}</span>
                            </div>
                            <p className="font-bold text-sm text-brand-dark text-center leading-tight truncate max-w-full px-1">{w.name}</p>
                            {/* Prize captions sit ABOVE the pedestal so all three pedestals stay flush on the stage floor. */}
                            <div className="text-center mb-2 min-h-[1.25rem]">
                                {w.prizeTitle && <p className="text-[11px] font-black text-brand-orange uppercase tracking-wide leading-tight">{t('season.won', { prize: w.prizeTitle })}</p>}
                                {(w.awardedPoints ?? 0) > 0 && (
                                    <p className="text-[11px] font-bold text-brand-dark/60 inline-flex items-center gap-0.5">
                                        +{(w.awardedPoints ?? 0).toLocaleString()}<Coins size={12} className="text-yellow-500 fill-yellow-400" />
                                    </p>
                                )}
                                {rank === 1 && championNote && <p className="text-[10px] text-brand-dark/50 mt-0.5">{championNote}</p>}
                            </div>
                            <div className={`w-full ${step.height} rounded-t-2xl bg-gradient-to-t ${step.gradient} shadow-inner flex flex-col items-center justify-start pt-2 px-1`}>
                                <span className="text-white font-black text-2xl md:text-3xl drop-shadow leading-none">{rank}</span>
                                <span className="text-white/95 font-bold text-xs mt-1 drop-shadow">{unitLabel ? `${w.points.toLocaleString()} ${unitLabel}` : t('leaderboard.pts', { count: w.points.toLocaleString() })}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Stage floor — the pedestals all end here */}
            <div className="h-2.5 rounded-b-xl bg-gradient-to-r from-brand-dark/10 via-brand-dark/25 to-brand-dark/10" />
        </div>
    );
};

export default SeasonPodium;
