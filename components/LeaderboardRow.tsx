import React from 'react';
import { Trophy, Medal, Star, UserCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';

// A normalized row so every leaderboard (all-time, current season, a past season
// snapshot) shares one renderer.
export interface DisplayRow {
    id: string;
    name: string;
    avatar?: string | null;
    grade?: string | null;
    rank: number;
    value: number;
    level: number;
}

interface Props {
    player: DisplayRow;
    /** Unit shown under the value — "XP" on all-time, "Season XP" on a season board. */
    unitLabel: string;
}

export const LeaderboardRow: React.FC<Props> = ({ player, unitLabel }) => {
    const { user } = useAuth();
    const { t } = useT();

    const isCurrentUser = !!user && player.id === user.id;
    let RankIcon = null;
    if (player.rank === 1) RankIcon = <Trophy size={24} className="text-yellow-400 fill-yellow-400" />;
    else if (player.rank === 2) RankIcon = <Medal size={24} className="text-gray-400 fill-gray-400" />;
    else if (player.rank === 3) RankIcon = <Medal size={24} className="text-amber-600 fill-amber-600" />;

    return (
        <div
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
                    {unitLabel}
                </p>
            </div>
        </div>
    );
};

export default LeaderboardRow;
