import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, Loader2 } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { useT } from '../contexts/LanguageContext';
import { LeaderboardRow, DisplayRow, allTimeToRow } from './LeaderboardRow';

// Homepage top-10 all-time leaderboard preview. GET /api/leaderboard is public,
// so this works for logged-out visitors; the section hides itself when the
// board is empty (fresh installs) or the fetch fails.
export const HomeLeaderboard: React.FC = () => {
    const { t } = useT();
    const navigate = useNavigate();
    const [rows, setRows] = useState<DisplayRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/leaderboard?limit=10');
                if (!res.ok) throw new Error('leaderboard fetch failed');
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.leaderboard || []);
                if (!cancelled) setRows(list.map(allTimeToRow));
            } catch (err) {
                console.error('[HomeLeaderboard]', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (!loading && rows.length === 0) return null;

    return (
        <section className="max-w-4xl mx-auto px-4">
            <div className="text-center space-y-2 mb-8">
                <div className="inline-flex items-center justify-center p-3 bg-yellow-100 rounded-full">
                    <Trophy size={28} className="text-yellow-500" />
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-brand-dark">{t('home.leaderboardTitle')}</h2>
            </div>

            {loading ? (
                <div className="flex justify-center p-10 text-brand-dark/40">
                    <Loader2 className="animate-spin w-7 h-7" />
                </div>
            ) : (
                <Card className="p-2 sm:p-4 bg-white/80 shadow-sm divide-y divide-brand-dark/5">
                    {rows.map((player) => (
                        <LeaderboardRow key={player.id} player={player} unitLabel={t('leaderboard.xp')} />
                    ))}
                </Card>
            )}

            <div className="flex justify-center mt-6">
                <Button onClick={() => navigate('/leaderboard')} className="bg-brand-blue hover:bg-blue-500">
                    {t('home.viewFullLeaderboard')} <ArrowRight size={16} className="ml-1" />
                </Button>
            </div>
        </section>
    );
};

export default HomeLeaderboard;
