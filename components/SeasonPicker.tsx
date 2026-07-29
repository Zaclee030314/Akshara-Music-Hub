import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';

export interface SeasonListItem {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    /** effective status: 'active' | 'ended' | 'finalized' (upcoming seasons aren't listed) */
    status: string;
    /** true when the season is finalized AND has frozen standings rows */
    isSnapshot: boolean;
}

interface Props {
    value: string | null;
    /** Fired on mount with the default selection, then on every user change.
     *  Receives null when there is no browsable season at all. */
    onChange: (season: SeasonListItem | null) => void;
}

// Dropdown of every browsable season (active, ended, finalized), so students can look
// back at Season 1/2/3… and not just the one that happens to be running.
export const SeasonPicker: React.FC<Props> = ({ value, onChange }) => {
    const { t } = useT();
    const [seasons, setSeasons] = useState<SeasonListItem[]>([]);

    // onChange identity may change every render in the parent; read it through a ref so
    // the fetch effect runs exactly once.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        let cancelled = false;
        fetch('/api/seasons/list')
            .then(r => (r.ok ? r.json() : []))
            .then((data: SeasonListItem[]) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : [];
                setSeasons(list);
                // Default: the season that's running now, else the most recent one that
                // has concluded (the list is already newest-first).
                const active = list.find(s => s.status === 'active');
                const newestDone = list.find(s => s.status === 'finalized' || s.status === 'ended');
                onChangeRef.current(active || newestDone || list[0] || null);
            })
            .catch(() => { if (!cancelled) onChangeRef.current(null); });
        return () => { cancelled = true; };
    }, []);

    // One season means there is nothing to pick — the season name is already in the
    // header, so a single-option <select> would just be noise.
    if (seasons.length < 2) return null;

    return (
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto w-full">
            <CalendarClock size={16} className="text-brand-dark/30 shrink-0" />
            <select
                value={value ?? ''}
                aria-label={t('leaderboard.selectSeason')}
                onChange={e => {
                    const next = seasons.find(s => s.id === e.target.value) || null;
                    if (next) onChange(next);
                }}
                className="flex-1 min-h-[44px] px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-brand-dark font-bold text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue"
            >
                {seasons.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
        </div>
    );
};

export default SeasonPicker;
