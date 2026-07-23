import React, { useEffect, useState } from 'react';
import {
    Share2, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight, UserCircle2, Users,
} from 'lucide-react';

interface ReferredUser {
    id: string;
    name: string;
    email: string;
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
    referred: ReferredUser[];
}

interface Props {
    token: string;
}

export const ReferralReport: React.FC<Props> = ({ token }) => {
    const [rows, setRows] = useState<ReferralRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchReferrals = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/referrals', { headers });
            if (res.ok) setRows(await res.json());
            else showToast('Failed to load referrals', 'error');
        } catch {
            showToast('Failed to load referrals', 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchReferrals(); }, [token]);

    const toggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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

            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-brand-dark/5 shadow-sm">
                <div className="flex items-center gap-3">
                    <Share2 className="text-brand-orange" size={24} />
                    <div>
                        <h3 className="font-bold text-sm">Parent Referrals</h3>
                        <p className="text-xs text-brand-dark/40">Who's bringing new families to the platform</p>
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
                                        </div>
                                        <p className="text-[10px] text-brand-dark/40 font-medium truncate uppercase tracking-tighter">{row.referrer.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="flex flex-col items-center bg-brand-green/10 text-brand-green rounded-2xl px-4 py-2">
                                            <span className="font-display font-bold text-lg leading-none">RM{((row.referrer.referralCreditCents ?? 0) / 100).toFixed(2)}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Earned</span>
                                        </div>
                                        <div className="flex flex-col items-center bg-brand-orange/10 text-brand-orange rounded-2xl px-4 py-2">
                                            <span className="font-display font-bold text-2xl leading-none">{row.count}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Referred</span>
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
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-brand-dark truncate">{u.name}</p>
                                                        <p className="text-[10px] text-brand-dark/40 font-medium truncate">{u.email}</p>
                                                    </div>
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
