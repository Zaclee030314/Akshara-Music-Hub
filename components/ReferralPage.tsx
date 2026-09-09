import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';
import { Gift, Copy, Check, Loader2, Share2, Users, CreditCard, CalendarClock, Link2, ArrowLeft, Infinity as InfinityIcon } from 'lucide-react';

// /referrals — the member-facing referral programme: personal link, progress,
// how it works, and the full tier table (what each level pays and how it is released).

interface Tier { minCount: number; maxCount: number | null; amountCents: number; splitMonths: number }
interface Stats {
    paidReferrals: number;
    tier: Tier;
    tiered: boolean;
    tiers: Tier[];
    totalEarnedCents: number;
    creditedCents: number;
    pendingCents: number;
    nextDue: string | null;
    creditBalanceCents: number;
}

const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('quest_token')}` });
const rm = (cents: number, dp = 2) => `RM${(cents / 100).toFixed(dp)}`;

export const ReferralPage: React.FC = () => {
    const { user } = useAuth();
    const { t } = useT();
    const navigate = useNavigate();
    const [code, setCode] = useState<string | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [blocked, setBlocked] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [codeRes, statsRes] = await Promise.all([
                    fetch('/api/profile/referral-code', { headers: authHeaders() }),
                    fetch('/api/profile/referral-stats', { headers: authHeaders() }),
                ]);
                if (codeRes.status === 403 || statsRes.status === 403) { setBlocked(true); return; }
                if (codeRes.ok) setCode((await codeRes.json()).code || null);
                if (statsRes.ok) setStats(await statsRes.json());
            } catch (err) {
                console.error('Failed to load referral programme', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const link = code ? `${window.location.origin}/?ref=${code}` : '';
    const shareText = t('referral.shareText', { link });

    const copy = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) { console.error('Copy failed', err); }
    };

    if (loading) {
        return <div className="flex justify-center p-16 text-brand-dark/50"><Loader2 className="animate-spin w-8 h-8" /></div>;
    }
    if (blocked || user?.isChildProfile) {
        return (
            <div className="max-w-xl mx-auto pt-12 px-4 text-center space-y-4">
                <p className="text-brand-dark/60">{t('referral.parentOnly')}</p>
                <Button onClick={() => navigate('/profiles')} className="bg-brand-blue hover:bg-blue-600">{t('nav.switchProfile')}</Button>
            </div>
        );
    }

    const tiers = stats?.tiers ?? [];
    const tiered = stats?.tiered ?? true;
    const currentIdx = stats ? tiers.findIndex(x => x.minCount === stats.tier.minCount) : -1;
    const example = tiers[0];

    return (
        <div className="max-w-4xl mx-auto space-y-8 pt-8 pb-16 px-4 animate-in fade-in duration-500">
            <button onClick={() => navigate('/profile')} className="flex items-center gap-1 text-sm font-bold text-brand-dark/50 hover:text-brand-dark">
                <ArrowLeft size={16} /> {t('nav.myProfile')}
            </button>
            <div className="text-center space-y-2">
                <h2 className="text-3xl md:text-4xl font-display font-bold text-brand-dark flex items-center justify-center gap-3">
                    <Gift className="text-brand-orange" size={32} /> {t('profile.referEarn')}
                </h2>
                <p className="text-brand-dark/60 max-w-2xl mx-auto">{t('referral.subtitle')}</p>
            </div>

            {/* Your link */}
            <Card className="p-6 md:p-8 shadow-xl space-y-4 bg-gradient-to-br from-brand-orange/5 to-yellow-50/50">
                <h3 className="font-bold text-brand-dark flex items-center gap-2"><Link2 size={18} className="text-brand-orange" /> {t('referral.yourLink')}</h3>
                {code ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text" value={link} readOnly onFocus={(e) => e.currentTarget.select()}
                            className="flex-1 p-3 rounded-xl border-2 border-brand-dark/10 bg-white font-medium text-sm text-brand-dark/70 focus:outline-none focus:border-brand-orange"
                        />
                        <Button onClick={copy} className="bg-brand-orange hover:bg-orange-400 shrink-0">
                            {copied ? <><Check size={16} /> {t('profile.copied')}</> : <><Copy size={16} /> {t('profile.copy')}</>}
                        </Button>
                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-white bg-[#25D366] hover:bg-[#1ebe5b] transition-colors shrink-0"
                        >
                            <Share2 size={16} /> {t('referral.shareWhatsApp')}
                        </a>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-brand-dark/40 text-sm"><Loader2 className="animate-spin" size={16} /> {t('profile.generatingLink')}</div>
                )}
                <p className="text-xs text-brand-dark/50">{t('referral.codeHint', { code: code || '…' })}</p>
            </Card>

            {/* Progress */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                    {[
                        { label: t('profile.paidReferrals'), value: String(stats.paidReferrals), accent: '' },
                        { label: t('profile.referralTier'), value: rm(stats.tier.amountCents, 0), accent: 'text-brand-orange', sub: t('profile.splitOver', { months: stats.tier.splitMonths }) },
                        { label: t('referral.totalEarned'), value: rm(stats.totalEarnedCents), accent: '' },
                        { label: t('referral.creditedSoFar'), value: rm(stats.creditedCents), accent: 'text-brand-green' },
                        { label: t('profile.pendingCredit'), value: rm(stats.pendingCents), accent: '' },
                        { label: t('referral.balance'), value: rm(stats.creditBalanceCents), accent: 'text-brand-blue', sub: stats.nextDue ? t('referral.nextOn', { date: new Date(stats.nextDue).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }) : undefined },
                    ].map((c, i) => (
                        <div key={i} className="bg-white rounded-2xl p-3 border border-brand-dark/5 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark/40">{c.label}</p>
                            <p className={`font-display font-bold text-xl text-brand-dark ${c.accent}`}>{c.value}</p>
                            {c.sub && <p className="text-[10px] text-brand-dark/50">{c.sub}</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* How it works */}
            <Card className="p-6 md:p-8 shadow-sm space-y-5">
                <h3 className="font-bold text-brand-dark">{t('referral.howTitle')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { icon: <Share2 size={22} />, title: t('referral.step1Title'), desc: t('referral.step1Desc') },
                        { icon: <Users size={22} />, title: t('referral.step2Title'), desc: t('referral.step2Desc') },
                        { icon: <Gift size={22} />, title: t('referral.step3Title'), desc: t('referral.step3Desc') },
                        { icon: <CreditCard size={22} />, title: t('referral.step4Title'), desc: t('referral.step4Desc') },
                    ].map((s, i) => (
                        <div key={i} className="relative bg-brand-dark/[0.03] rounded-2xl p-4 space-y-2">
                            <span className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-brand-orange text-white text-xs font-black flex items-center justify-center shadow">{i + 1}</span>
                            <div className="text-brand-orange">{s.icon}</div>
                            <p className="font-bold text-sm text-brand-dark">{s.title}</p>
                            <p className="text-xs text-brand-dark/60 leading-relaxed">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Tier table */}
            <Card className="p-6 md:p-8 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h3 className="font-bold text-brand-dark">{t('referral.tiersTitle')}</h3>
                        <p className="text-sm text-brand-dark/60">{tiered ? t('referral.tiersDesc') : t('referral.tieredOff')}</p>
                    </div>
                    {stats && currentIdx >= 0 && (
                        <span className="text-xs font-bold text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full">
                            {t('referral.youAreOn', { tier: currentIdx + 1 })}
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 text-left">
                                <th className="py-2 pr-3">{t('referral.tier')}</th>
                                <th className="py-2 pr-3">{t('referral.paidRange')}</th>
                                <th className="py-2 pr-3">{t('referral.perReferralCol')}</th>
                                <th className="py-2 pr-3">{t('referral.releasedOver')}</th>
                                <th className="py-2">{t('referral.perMonthCol')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(tiered ? tiers : tiers.slice(0, 1)).map((x, i) => {
                                const active = i === currentIdx;
                                return (
                                    <tr key={i} className={`border-t border-brand-dark/5 ${active ? 'bg-brand-orange/5' : ''}`}>
                                        <td className="py-3 pr-3">
                                            <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-black ${active ? 'bg-brand-orange text-white' : 'bg-brand-dark/5 text-brand-dark/60'}`}>{i + 1}</span>
                                        </td>
                                        <td className="py-3 pr-3 font-bold text-brand-dark">
                                            {tiered
                                                ? (x.maxCount === null ? <span className="inline-flex items-center gap-1">{x.minCount}<InfinityIcon size={14} className="text-brand-dark/40" /></span> : `${x.minCount} – ${x.maxCount}`)
                                                : t('referral.everyReferral')}
                                        </td>
                                        <td className="py-3 pr-3 font-display font-bold text-brand-orange text-lg">{rm(x.amountCents, 0)}</td>
                                        <td className="py-3 pr-3 text-brand-dark/70">{t('referral.months', { months: x.splitMonths })}</td>
                                        <td className="py-3 text-brand-dark/70">{rm(Math.floor(x.amountCents / x.splitMonths))}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {example && (
                    <div className="bg-brand-blue/5 border border-brand-blue/10 rounded-2xl p-4 text-sm text-brand-dark/70 flex gap-3">
                        <CalendarClock size={18} className="text-brand-blue shrink-0 mt-0.5" />
                        <p>{t('referral.example', { amount: rm(example.amountCents, 0), months: example.splitMonths, monthly: rm(Math.floor(example.amountCents / example.splitMonths)), three: rm(example.amountCents * 3, 0) })}</p>
                    </div>
                )}
                <ul className="text-xs text-brand-dark/50 space-y-1 list-disc pl-5">
                    <li>{t('referral.note1')}</li>
                    <li>{t('referral.note2')}</li>
                    <li>{t('referral.note3')}</li>
                </ul>
            </Card>
        </div>
    );
};

export default ReferralPage;
