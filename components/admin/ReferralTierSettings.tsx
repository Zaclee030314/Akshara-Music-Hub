import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, Settings2, Plus, Trash2, RotateCcw, Save, Infinity as InfinityIcon } from 'lucide-react';
import { Tier, AdminTokenProps } from './referralShared';

// Admin "Referral Tiers" tab: the tiered-rates table (From / Up to / RM per referral /
// Split over months) with per-row reset + delete, Add Tier and Save. Lives on its own tab,
// separate from the referral report.

// Editable row state keeps strings so the inputs stay controllable while typing.
interface TierDraft { minCount: string; maxCount: string; amountRM: string; splitMonths: string }
const toDraft = (t: Tier): TierDraft => ({
    minCount: String(t.minCount),
    maxCount: t.maxCount === null ? '' : String(t.maxCount),
    amountRM: (t.amountCents / 100).toFixed(2),
    splitMonths: String(t.splitMonths),
});

export const ReferralTierSettings: React.FC<AdminTokenProps> = ({ token }) => {
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [tiered, setTiered] = useState(true);
    const [drafts, setDrafts] = useState<TierDraft[]>([]);
    const [defaults, setDefaults] = useState<Tier[]>([]);
    const [saving, setSaving] = useState(false);

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchTiers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/referral-tiers', { headers });
            if (!res.ok) throw new Error('load');
            const data = await res.json();
            setTiered(!!data.tiered);
            setDrafts((data.tiers as Tier[]).map(toDraft));
            setDefaults(data.defaults || []);
        } catch {
            showToast('Failed to load referral tiers', 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchTiers(); }, [token]);

    // Keep "from" of each tier = previous "up to" + 1 (tiers are contiguous by rule).
    const setDraft = (idx: number, patch: Partial<TierDraft>) => {
        setDrafts(prev => {
            const next = prev.map((d, i) => (i === idx ? { ...d, ...patch } : { ...d }));
            for (let i = 1; i < next.length; i++) {
                const prevMax = parseInt(next[i - 1].maxCount, 10);
                next[i].minCount = Number.isFinite(prevMax) ? String(prevMax + 1) : '';
            }
            next[0].minCount = '1';
            return next;
        });
    };
    const addTier = () => {
        setDrafts(prev => {
            const last = prev[prev.length - 1];
            const lastMax = last ? parseInt(last.maxCount, 10) : 0;
            const fixedLast = last ? { ...last, maxCount: Number.isFinite(lastMax) ? last.maxCount : String(parseInt(last.minCount, 10) + 24) } : null;
            const base = fixedLast ? prev.slice(0, -1).concat(fixedLast) : prev;
            const from = fixedLast ? parseInt(fixedLast.maxCount, 10) + 1 : 1;
            return [...base, { minCount: String(from), maxCount: '', amountRM: last ? last.amountRM : '100.00', splitMonths: last ? last.splitMonths : '2' }];
        });
    };
    const removeTier = (idx: number) => setDrafts(prev => {
        const next = prev.filter((_, i) => i !== idx);
        if (next.length) { next[0].minCount = '1'; for (let i = 1; i < next.length; i++) { const m = parseInt(next[i - 1].maxCount, 10); next[i].minCount = Number.isFinite(m) ? String(m + 1) : ''; } }
        return next;
    });
    const resetTier = (idx: number) => { if (defaults[idx]) setDraft(idx, toDraft(defaults[idx])); };
    const resetAll = () => { if (defaults.length) setDrafts(defaults.map(toDraft)); };

    const saveTiers = async () => {
        setSaving(true);
        try {
            const tiers = drafts.map(d => ({
                minCount: parseInt(d.minCount, 10),
                maxCount: d.maxCount.trim() === '' ? null : parseInt(d.maxCount, 10),
                amountCents: Math.round(parseFloat(d.amountRM || '0') * 100),
                splitMonths: parseInt(d.splitMonths || '1', 10),
            }));
            const res = await fetch('/api/admin/referral-tiers', { method: 'PUT', headers, body: JSON.stringify({ tiered, tiers }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { showToast(data.error || 'Failed to save tiers', 'error'); }
            else { showToast('Referral tiers saved', 'success'); setDrafts((data.tiers as Tier[]).map(toDraft)); }
        } catch {
            showToast('Failed to save tiers', 'error');
        }
        setSaving(false);
    };

    return (
        <div className="space-y-4">
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-6 py-3 rounded-2xl shadow-2xl font-bold text-white text-sm animate-pop-in
                    ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header + Tiered rates switch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-brand-dark/5 shadow-sm">
                <div className="flex items-center gap-3">
                    <Settings2 className="text-brand-blue" size={24} />
                    <div>
                        <h3 className="font-bold text-sm">Tiered rates</h3>
                        <p className="text-xs text-brand-dark/40">Pay a different per-referral credit as members refer more families. A referral counts when the referred family pays.</p>
                    </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40">{tiered ? 'On' : 'Off'}</span>
                    <span
                        role="switch"
                        aria-checked={tiered}
                        onClick={() => setTiered(v => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${tiered ? 'bg-red-600' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${tiered ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </span>
                </label>
            </div>

            {/* Tier table */}
            <div className="bg-white rounded-2xl border border-brand-dark/5 shadow-sm p-4 space-y-2">
                {loading ? (
                    <div className="flex justify-center p-12 text-brand-dark/30"><Loader2 className="animate-spin" size={28} /></div>
                ) : (
                    <>
                        <div className="hidden sm:grid grid-cols-[2rem_1fr_1fr_1.4fr_1.2fr_2rem_2rem] gap-2 px-2 text-[10px] font-black uppercase tracking-widest text-brand-dark/40">
                            <span /><span>From</span><span>Up to</span><span>Per referral</span><span>Split over (months)</span><span /><span />
                        </div>
                        {drafts.map((d, idx) => {
                            const isLast = idx === drafts.length - 1;
                            const disabledRow = !tiered && idx > 0;
                            return (
                                <div key={idx} className={`grid grid-cols-2 sm:grid-cols-[2rem_1fr_1fr_1.4fr_1.2fr_2rem_2rem] gap-2 items-center bg-gray-50 rounded-xl p-2 ${disabledRow ? 'opacity-40' : ''}`}>
                                    <span className="w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-black flex items-center justify-center">{idx + 1}</span>
                                    <input value={d.minCount} readOnly className="bg-white/60 rounded-lg px-3 py-2 text-sm font-bold text-brand-dark/50 outline-none" />
                                    <div className="relative">
                                        <input
                                            value={d.maxCount}
                                            onChange={e => setDraft(idx, { maxCount: e.target.value.replace(/[^0-9]/g, '') })}
                                            placeholder={isLast ? '∞' : ''}
                                            disabled={disabledRow}
                                            className="w-full bg-white rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-brand-blue/20"
                                        />
                                        {isLast && d.maxCount === '' && <InfinityIcon size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-dark/30" />}
                                    </div>
                                    <div className="flex items-center bg-white rounded-lg px-3">
                                        <span className="text-xs font-black text-brand-dark/40 mr-1">RM</span>
                                        <input
                                            value={d.amountRM}
                                            onChange={e => setDraft(idx, { amountRM: e.target.value.replace(/[^0-9.]/g, '') })}
                                            disabled={disabledRow}
                                            className="w-full py-2 text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <input
                                        value={d.splitMonths}
                                        onChange={e => setDraft(idx, { splitMonths: e.target.value.replace(/[^0-9]/g, '') })}
                                        disabled={disabledRow}
                                        className="bg-white rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-brand-blue/20"
                                    />
                                    <button onClick={() => resetTier(idx)} title="Reset to default" className="p-1.5 rounded-lg text-brand-dark/30 hover:text-brand-dark hover:bg-white"><RotateCcw size={16} /></button>
                                    <button onClick={() => removeTier(idx)} title="Remove tier" disabled={drafts.length <= 1} className="p-1.5 rounded-lg text-brand-dark/30 hover:text-red-600 hover:bg-white disabled:opacity-30"><Trash2 size={16} /></button>
                                </div>
                            );
                        })}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <button onClick={addTier} className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-brand-dark/15 rounded-xl py-2.5 text-sm font-bold text-brand-dark/60 hover:border-brand-blue hover:text-brand-blue transition-colors">
                                <Plus size={16} /> Add Tier
                            </button>
                            <button onClick={resetAll} disabled={!defaults.length} className="flex items-center justify-center gap-2 border border-brand-dark/10 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-dark/60 hover:bg-gray-50 disabled:opacity-40">
                                <RotateCcw size={16} /> Reset all
                            </button>
                            <button onClick={saveTiers} disabled={saving} className="flex items-center justify-center gap-2 bg-brand-blue text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save tiers
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-brand-blue/5 border border-brand-blue/10 rounded-2xl p-4 text-[11px] text-brand-dark/60 space-y-1">
                <p><b>How it works.</b> The tier is chosen by how many of a member's referred families have paid. Tier 1 applies to their first {drafts[0]?.maxCount || '…'} paid referrals, tier 2 to the next, and so on. With tiered rates off, every referral pays tier 1.</p>
                <p>Amounts are subscription credit: the first month's share is credited when the referred family pays; the rest is released monthly and applied automatically at the referrer's next checkout.</p>
            </div>
        </div>
    );
};

export default ReferralTierSettings;
