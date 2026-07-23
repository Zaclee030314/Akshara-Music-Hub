import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '../contexts/useAuth';
import { Loader2, CreditCard, CheckCircle2, CalendarClock, ShieldOff, RefreshCw, Info } from 'lucide-react';

interface SubStatus {
    isSubscribed: boolean;
    cancelAtPeriodEnd?: boolean;
    subscriptionEndDate?: string | null;
    subscriptionStartDate?: string | null;
    subscriptionInterval?: string | null;
    subscriptionLevel?: string | null;
    subscribedSyllabus?: string | null;
}

const getDaysRemaining = (date?: string | null): number | null => {
    if (!date) return null;
    const end = new Date(date);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    if (diffTime < 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const planLabel = (level?: string | null): string => {
    if (level === 'all') return 'Max All-Access';
    if (level === 'single') return 'Single Syllabus';
    return 'Free';
};

const fmtDate = (date?: string | null): string => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
};

export const BillingPage: React.FC = () => {
    const navigate = useNavigate();
    const { cancelSubscription, reactivateSubscription, refreshUser } = useAuth();
    const [status, setStatus] = useState<SubStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [working, setWorking] = useState(false);
    const [referralCreditCents, setReferralCreditCents] = useState(0);

    const loadStatus = async () => {
        try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch('/api/subscription/check-subscription-status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load subscription status');
            const data: SubStatus = await res.json();
            setStatus(data);
        } catch (err) {
            console.error(err);
            setError('Could not load your subscription details.');
        } finally {
            setLoading(false);
        }
    };

    const loadReferralCredit = async () => {
        try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setReferralCreditCents(data.referralCreditCents ?? 0);
            }
        } catch (err) {
            console.error('Failed to load referral credit', err);
        }
    };

    useEffect(() => {
        loadStatus();
        loadReferralCredit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCancel = async () => {
        if (!window.confirm('Cancel your subscription? You will keep access until the end of your current billing period.')) return;
        setWorking(true);
        const ok = await cancelSubscription();
        if (ok) {
            await refreshUser();
            await loadStatus();
        }
        setWorking(false);
    };

    const handleReactivate = async () => {
        setWorking(true);
        const ok = await reactivateSubscription();
        if (ok) {
            await loadStatus();
        }
        setWorking(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center p-16 text-brand-dark/50">
                <Loader2 className="animate-spin w-8 h-8" />
            </div>
        );
    }

    if (error || !status) {
        return <div className="text-center p-16 text-red-500 font-bold">{error || 'Billing unavailable.'}</div>;
    }

    const subscribed = !!status.isSubscribed;
    const cancelPending = !!status.cancelAtPeriodEnd;
    const daysLeft = getDaysRemaining(status.subscriptionEndDate);

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8 pb-16 animate-in fade-in duration-500 px-4">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-4 bg-brand-orange/10 rounded-full mb-2">
                    <CreditCard size={40} className="text-brand-orange" />
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-brand-dark">My Subscription</h2>
                <p className="text-brand-dark/60">Manage your Akshara Music Hub plan.</p>
            </div>

            {referralCreditCents > 0 && (
                <div className="flex items-start gap-2 bg-brand-orange/5 border border-brand-orange/20 text-brand-dark/70 p-4 rounded-2xl text-sm font-medium">
                    <Info size={16} className="shrink-0 mt-0.5 text-brand-orange" />
                    <span>You have <b className="text-brand-orange">RM{(referralCreditCents / 100).toFixed(2)}</b> referral credit — it'll be applied at checkout.</span>
                </div>
            )}

            <Card className="p-6 md:p-8 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">Current Plan</p>
                        <p className="text-2xl font-display font-bold text-brand-dark">{subscribed ? planLabel(status.subscriptionLevel) : 'Free'}</p>
                    </div>
                    {subscribed ? (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${cancelPending ? 'bg-amber-100 text-amber-700' : 'bg-brand-green/10 text-brand-green'}`}>
                            {cancelPending ? 'Cancels at period end' : 'Active'}
                        </span>
                    ) : (
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-500">Free</span>
                    )}
                </div>

                {subscribed ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-brand-dark/5 pt-6">
                            {status.subscriptionLevel === 'single' && (
                                <div>
                                    <p className="text-xs font-bold text-brand-dark/40 uppercase">Subscribed Syllabus</p>
                                    <p className="font-medium text-brand-dark">{status.subscribedSyllabus || '—'}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-bold text-brand-dark/40 uppercase">Start Date</p>
                                <p className="font-medium text-brand-dark">{fmtDate(status.subscriptionStartDate)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-brand-dark/40 uppercase">Renews / Ends</p>
                                <p className="font-medium text-brand-dark">{fmtDate(status.subscriptionEndDate)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-brand-dark/40 uppercase flex items-center gap-1">
                                    <CalendarClock size={12} /> Days Remaining
                                </p>
                                <p className="font-medium text-brand-dark">{daysLeft !== null ? `${daysLeft} day${daysLeft === 1 ? '' : 's'}` : '—'}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 bg-brand-dark/5 border border-brand-dark/10 text-brand-dark/60 p-4 rounded-2xl text-xs font-medium">
                            <Info size={16} className="shrink-0 mt-0.5 text-brand-dark/40" />
                            <span>Plans are 30-day passes — access ends on {fmtDate(status.subscriptionEndDate)} unless you renew from the Pricing page.</span>
                        </div>

                        {cancelPending ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-sm font-medium">
                                    <span>Your subscription is scheduled to cancel on {fmtDate(status.subscriptionEndDate)}. You still have full access until then.</span>
                                </div>
                                <Button onClick={handleReactivate} disabled={working} fullWidth className="bg-brand-green hover:bg-green-600">
                                    {working ? <Loader2 className="animate-spin" size={18} /> : <><RefreshCw size={16} /> Reactivate Subscription</>}
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={handleCancel} disabled={working} variant="outline" fullWidth className="text-red-500 border-red-200 hover:bg-red-50">
                                {working ? <Loader2 className="animate-spin" size={18} /> : <><ShieldOff size={16} /> Cancel Subscription</>}
                            </Button>
                        )}
                    </>
                ) : (
                    <div className="space-y-4 border-t border-brand-dark/5 pt-6">
                        <ul className="space-y-2 text-sm text-brand-dark/60">
                            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-brand-green" /> 3 free quizzes</li>
                        </ul>
                        <Button onClick={() => navigate('/pricing')} fullWidth className="bg-brand-orange hover:bg-orange-400">
                            Upgrade Plan
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default BillingPage;
