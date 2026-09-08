import React, { useEffect, useState } from 'react';
import {
    Share2, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight, UserCircle2, Users,
    Settings2, Plus, Trash2, RotateCcw, Save, Infinity as InfinityIcon,
} from 'lucide-react';

interface ReferredUser {
    id: string;
    name: string;
    email: string;
    paid: boolean;
}

interface Tier {
    minCount: number;
    maxCount: number | null;
    amountCents: number;
    splitMonths: number;
}

interface ReferralRow {
    referrer: {
        id: string;
        name: string;
        email: string;
        referralCode: string | null;
        referralCreditCents?: number;
    };
    count: number;
    paidReferrals: number;
    tier: Tier;
    totalEarnedCents: number;
    creditedCents: number;
    pendingCents: number;
    nextDue: string | null;
    referred: ReferredUser[];
}

interface Props {
    token: string;
}

const rm = (cents: number) => `RM${(cents / 100).toFixed(2)}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Editable row state keeps strings so the inputs stay controllable while typing.
interface TierDraft { minCount: string; maxCount: string; amountRM: string; splitMonths: string }
const toDraft = (t: Tier): TierDraft => ({
    minCount: String(t.minCount),
    maxCount: t.maxCount === null ? '' : String(t.maxCount),
    amountRM: (t.amountCents / 100).toFixed(2),
    splitMonths: String(t.splitMonths),
});

export const ReferralReport: React.FC<Props> = ({ token }) => {
    const [rows, setRows] = useState<ReferralRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Tier settings
    const [tiered, setTiered] = useState(true);
    const [drafts, setDrafts] = useState<TierDraft[]>([]);
    const [defaults, setDefaults] = useState<Tier[]>([]);
    const [savingTiers, setSavingTiers] = useState(false);
    const [showSettings, setShowSettings] = useState(true);

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [r1, r2] = await Promise.all([
                fetch('/api/admin/referrals', { headers }),
                fetch('/api/admin/referral-tiers', { headers }),
            ]);
            if (r1.ok) setRows(await r1.json()); else showToast('Failed to load referrals', 'error');
            if (r2.ok) {
                const data = await r2.json();
                setTiered(!!data.tiered);
                setDrafts((data.tiers as Tier[]).map(toDraft));
                setDefaults(data.defaults || []);
            }
        } catch {
            showToast('Failed to load referrals', 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, [token]);

    const toggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

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

    const saveTiers = async () => {
        setSavingTiers(true);
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
        setSavingTiers(false);
    };

    const tierLabel = (t: Tier) => `${t.minCount}–${t.maxCount === null ? '∞' : t.maxCount}`;

    return (
        <div className="space-y-4">
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-6 py-3 rounded-2xl shadow-2xl font-bold text-white text-sm animate-pop-in
                    ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* ── Tier settings ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-brand-dark/5 shadow-sm">
                <button onClick={() => setShowSettings(s => !s)} className="w-full flex items-center justify-between p-4 text-left">
                    <div className="flex items-center gap-3">
                        <Settings2 className="text-brand-blue" size={22} />
                        <div>
                            <h3 className="font-bold text-sm">Tiered rates</h3>
                            <p className="text-xs text-brand-dark/40">Pay different per-referral credit as members refer more. A referral counts when the referred family pays.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer" onClick={e => e.stopPropagation()}>
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
                        {showSettings ? <ChevronDown size={18} className="text-brand-dark/30" /> : <ChevronRight size={18} className="text-brand-dark/30" />}
                    </div>
                </button>

                {showSettings && (
                    <div className="px-4 pb-4 space-y-2">
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
                            <button onClick={saveTiers} disabled={savingTiers} className="flex items-center justify-center gap-2 bg-brand-blue text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
                                {savingTiers ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save tiers
                            </button>
                        </div>
                        <p className="text-[11px] text-brand-dark/40">Amounts are subscription credit: the first month's share is credited when the referred family pays; the rest is released monthly and applied automatically at the referrer's next checkout.</p>
                    </div>
                )}
            </div>

            {/* ── Report ────────────────────────────────────────────────── */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-brand-dark/5 shadow-sm">
                <div className="flex items-center gap-3">
                    <Share2 className="text-brand-orange" size={24} />
                    <div>
                        <h3 className="font-bold text-sm">Parent Referrals</h3>
                        <p className="text-xs text-brand-dark/40">Who's bringing new families to the platform — and what they've earned</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12 text-brand-dark/30"><Loader2 className="animate-spin" size={28} /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-brand-dark/5">
                    <Share2 className="mx-auto text-brand-dark/10 mb-3" size={44} />
                    <p className="text-brand-dark/30 font-bold italic">No referrals yet — parents can share their link from their Profile page.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {rows.map(row => {
                        const isOpen = expanded.has(row.referrer.id);
                        return (
                            <div key={row.referrer.id} className="bg-white rounded-2xl border border-brand-dark/5 shadow-sm overflow-hidden">
                                <button
                                    onClick={() => toggle(row.referrer.id)}
                                    className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
                                >
                                    {isOpen
                                        ? <ChevronDown size={18} className="text-brand-dark/30 shrink-0" />
                                        : <ChevronRight size={18} className="text-brand-dark/30 shrink-0" />}
                                    <div className="w-11 h-11 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark font-display font-bold text-lg shrink-0">
                                        {row.referrer.name[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-brand-dark truncate">{row.referrer.name}</p>
                                            {row.referrer.referralCode && (
                                                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-brand-orange/10 text-brand-orange font-mono">
                                                    {row.referrer.referralCode}
                                                </span>
                                            )}
                                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-brand-blue/10 text-brand-blue">
                                                Tier {tierLabel(row.tier)} · {rm(row.tier.amountCents)}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-brand-dark/40 font-medium truncate uppercase tracking-tighter">{row.referrer.email}</p>
                                        {row.nextDue && row.pendingCents > 0 && (
                                            <p className="text-[10px] text-brand-dark/50 font-medium mt-0.5">Next release {fmtDate(row.nextDue)}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                        <div className="flex flex-col items-center bg-brand-orange/10 text-brand-orange rounded-2xl px-3 py-2">
                                            <span className="font-display font-bold text-xl leading-none">{row.paidReferrals}<span className="text-xs text-brand-orange/60">/{row.count}</span></span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Paid / Signed</span>
                                        </div>
                                        <div className="flex flex-col items-center bg-brand-green/10 text-brand-green rounded-2xl px-3 py-2">
                                            <span className="font-display font-bold text-lg leading-none">{rm(row.totalEarnedCents)}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Earned</span>
                                        </div>
                                        <div className="flex flex-col items-center bg-brand-dark/5 text-brand-dark rounded-2xl px-3 py-2">
                                            <span className="font-display font-bold text-lg leading-none">{rm(row.pendingCents)}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Pending</span>
                                        </div>
                                        <div className="flex flex-col items-center bg-brand-blue/10 text-brand-blue rounded-2xl px-3 py-2">
                                            <span className="font-display font-bold text-lg leading-none">{rm(row.referrer.referralCreditCents ?? 0)}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Balance</span>
                                        </div>
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="px-5 pb-5 pt-1 border-t border-brand-dark/5">
                                        <p className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest my-3 flex items-center gap-1.5">
                                            <Users size={12} /> Referred Families
                                        </p>
                                        <div className="space-y-2">
                                            {row.referred.map(u => (
                                                <div key={u.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                                                    <UserCircle2 size={20} className="text-brand-dark/30 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-brand-dark truncate">{u.name}</p>
                                                        <p className="text-[10px] text-brand-dark/40 font-medium truncate">{u.email}</p>
                                                    </div>
                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${u.paid ? 'bg-brand-green/10 text-brand-green' : 'bg-gray-200 text-gray-500'}`}>
                                                        {u.paid ? 'Paid' : 'Signed up'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ReferralReport;
