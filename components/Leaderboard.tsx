import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Trophy, Medal, Star, UserCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

interface LeaderboardUser {
    id: string;
    name: string;
    xp: number;
    level: number;
    rank: number;
}

export const Leaderboard: React.FC = () => {
    const { user, userStats } = useAuth();
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch('/api/leaderboard');
                if (!response.ok) throw new Error('Failed to fetch leaderboard');
                const data = await response.json();
                setLeaderboardData(data);
            } catch (err) {
                console.error(err);
                setError('Could not load leaderboard data.');
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    // Ensure current user is in the list if logged in, even if not in top 50
    const displayData = [...leaderboardData];
    if (user && userStats && !loading && !error) {
        const userInTop = displayData.find(u => u.id === user.id);
        if (!userInTop) {
            displayData.push({
                id: user.id,
                name: user.name + ' (You)',
                xp: userStats.xp,
                level: userStats.level,
                rank: userStats.leaderboardRank || displayData.length + 1
            });
        } else {
            // mark them as (You) if not already marked
            if (!userInTop.name.endsWith('(You)')) {
                userInTop.name = userInTop.name + ' (You)';
            }
        }
        displayData.sort((a, b) => a.rank - b.rank);
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center p-4 bg-brand-orange/10 rounded-full mb-4">
                    <Trophy size={48} className="text-brand-orange" />
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-brand-dark">Global Leaderboard</h2>
                <p className="text-brand-dark/70 max-w-lg mx-auto">
                    Compete with other students and climb to the top! Earn XP by completing quizzes and quests.
                </p>
            </div>

            <Card className="p-4 md:p-6 shadow-xl border-t-4 border-t-brand-accent">
                {loading ? (
                    <div className="flex justify-center p-8 text-brand-dark/50">
                        <Loader2 className="animate-spin w-8 h-8" />
                    </div>
                ) : error ? (
                    <div className="text-center p-8 text-red-500 font-bold">{error}</div>
                ) : displayData.length === 0 ? (
                    <div className="text-center p-8 text-brand-dark/50">No users found on the leaderboard yet.</div>
                ) : (
                    <div className="space-y-4">
                        {displayData.map((player) => {
                            const isCurrentUser = user && player.id === user.id;
                            let RankIcon = null;
                            
                            if (player.rank === 1) RankIcon = <Trophy size={24} className="text-yellow-400 fill-yellow-400" />;
                            else if (player.rank === 2) RankIcon = <Medal size={24} className="text-gray-400 fill-gray-400" />;
                            else if (player.rank === 3) RankIcon = <Medal size={24} className="text-amber-600 fill-amber-600" />;

                            return (
                                <div 
                                    key={player.id} 
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
                                            <div className={`p-2 rounded-full ${isCurrentUser ? 'bg-brand-blue/20 text-brand-blue' : 'bg-gray-200 text-gray-500'}`}>
                                                <UserCircle2 size={24} />
                                            </div>
                                            <div>
                                                <p className={`font-bold ${isCurrentUser ? 'text-brand-blue' : 'text-brand-dark'}`}>
                                                    {player.name}
                                                </p>
                                                <div className="flex items-center gap-1 text-sm text-brand-dark/50">
                                                    <Star size={14} className="text-brand-orange fill-brand-orange" />
                                                    Level {player.level}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-brand-dark">{player.xp}</p>
                                        <p className="text-xs font-bold text-brand-dark/50 uppercase tracking-wider">XP</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};
