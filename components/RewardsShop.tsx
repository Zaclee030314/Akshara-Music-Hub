import React, { useState, useEffect } from 'react';
import { Coins, ShoppingBag, Clock, CheckCircle, XCircle, Star, Package } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';

interface Reward {
    id: string;
    title: string;
    description: string;
    icon: string;
    imageUrl: string | null;
    coinCost: number;
    stock: number | null;
    isActive: boolean;
}

interface Redemption {
    id: string;
    redeemedAt: string;
    reward: Reward;
}

interface RewardsShopProps {
    userCoins: number;
    token: string;
    onCoinsUpdated: (newCoins: number) => void;
}

const API_BASE = '/api';

const RewardsShop: React.FC<RewardsShopProps> = ({ userCoins, token, onCoinsUpdated }) => {
    const { t } = useT();
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [redemptions, setRedemptions] = useState<Redemption[]>([]);
    const [tab, setTab] = useState<'shop' | 'history'>('shop');
    const [loading, setLoading] = useState(true);
    const [confirmReward, setConfirmReward] = useState<Reward | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [redeeming, setRedeeming] = useState(false);

    // Delivery Info Form State
    const [receiverName, setReceiverName] = useState('');
    const [receiverPhone, setReceiverPhone] = useState('');
    const [receiverAddress, setReceiverAddress] = useState('');

    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const [rRes, hRes] = await Promise.all([
                    fetch(`${API_BASE}/rewards`, { headers: authHeaders }),
                    fetch(`${API_BASE}/rewards/my-redemptions`, { headers: authHeaders })
                ]);
                if (rRes.ok) setRewards(await rRes.json());
                if (hRes.ok) setRedemptions(await hRes.json());
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchAll();
    }, [token]);

    const handleRedeem = async () => {
        if (!confirmReward) return;

        // Basic Validation
        if (!receiverName.trim() || !receiverPhone.trim() || !receiverAddress.trim()) {
            showToast(t('rewards.fillDelivery'), 'error');
            return;
        }

        setRedeeming(true);
        try {
            const res = await fetch(`${API_BASE}/rewards/redeem/${confirmReward.id}`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    receiverName,
                    receiverPhone,
                    receiverAddress
                })
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || t('rewards.redemptionFailed'), 'error');
            } else {
                const newCoins = userCoins - confirmReward.coinCost;
                onCoinsUpdated(newCoins);
                // Update stock locally
                setRewards(prev => prev.map(r =>
                    r.id === confirmReward.id && r.stock !== null
                        ? { ...r, stock: r.stock - 1 }
                        : r
                ));
                // Add to history
                const newRedemption: Redemption = {
                    id: data.redemption.id,
                    redeemedAt: data.redemption.redeemedAt,
                    reward: confirmReward
                };
                setRedemptions(prev => [newRedemption, ...prev]);
                showToast(t('rewards.redeemedToast', { title: confirmReward.title, cost: confirmReward.coinCost }), 'success');

                // Clear form
                setReceiverName('');
                setReceiverPhone('');
                setReceiverAddress('');
                setConfirmReward(null);
            }
        } catch {
            showToast(t('rewards.networkError'), 'error');
        }
        setRedeeming(false);
    };

    return (
        <div className="max-w-4xl mx-auto pt-10 pb-16 px-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-6 py-3 rounded-2xl shadow-2xl font-bold text-white text-sm transition-all animate-pop-in
          ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-3 mb-3">
                    <ShoppingBag size={40} className="text-brand-orange" />
                </div>
                <h1 className="text-4xl font-display font-bold italic tracking-tight">{t('rewards.title')}</h1>
                <p className="text-brand-dark/50 mt-1 font-medium">{t('rewards.subtitle')}</p>
                <div className="inline-flex items-center gap-2 mt-4 bg-brand-dark/5 border border-brand-dark/10 text-brand-dark px-6 py-3 rounded-2xl font-bold text-xl shadow-inner group">
                    <Coins className="text-brand-orange fill-brand-orange/20 w-6 h-6 group-hover:rotate-12 transition-transform" />
                    {userCoins.toLocaleString()} <span className="text-[10px] text-brand-dark/40 uppercase tracking-widest mt-1 ml-1">{t('rewards.coins')}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl mb-10 w-fit mx-auto shadow-sm border border-brand-dark/5">
                {(['shop', 'history'] as const).map(tabKey => (
                    <button key={tabKey} onClick={() => setTab(tabKey)}
                        className={`px-8 py-2.5 rounded-xl font-bold text-sm transition-all
              ${tab === tabKey ? 'bg-brand-dark text-white shadow-lg' : 'text-brand-dark/40 hover:text-brand-dark hover:bg-brand-dark/5'}`}>
                        {tabKey === 'shop' ? t('rewards.catalog') : t('rewards.myRedemptions')}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 opacity-20">
                    <ShoppingBag size={48} className="animate-spin-slow mb-4" />
                    <span className="font-bold uppercase tracking-widest text-[10px]">{t('rewards.restocking')}</span>
                </div>
            ) : tab === 'shop' ? (
                rewards.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-brand-dark/5">
                        <Package size={64} className="mx-auto text-brand-dark/10 mb-6" />
                        <p className="text-brand-dark/40 font-bold text-xl italic mb-2">{t('rewards.emptyTitle')}</p>
                        <p className="text-brand-dark/30 text-sm">{t('rewards.emptyDesc')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {rewards.map(reward => {
                            const canAfford = userCoins >= reward.coinCost;
                            const outOfStock = reward.stock !== null && reward.stock <= 0;
                            const disabled = !canAfford || outOfStock;
                            return (
                                <div key={reward.id}
                                    className={`bg-white rounded-[32px] p-8 border transition-all flex flex-col relative group
                                    ${disabled ? 'opacity-50 grayscale' : 'border-brand-dark/5 shadow-sm hover:shadow-2xl hover:border-brand-orange/20 hover:-translate-y-2'}`}>
                                    <div className="flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                        {reward.imageUrl
                                            ? <img src={reward.imageUrl} alt={reward.title} className="w-20 h-20 object-cover rounded-2xl shadow-md" />
                                            : <span className="text-6xl">{reward.icon}</span>
                                        }
                                    </div>
                                    <h3 className="font-display font-bold text-xl text-center mb-2 tracking-tight">{reward.title}</h3>
                                    <p className="text-brand-dark/40 text-sm text-center mb-6 flex-1 font-medium leading-relaxed">{reward.description}</p>
                                    <div className="flex items-center justify-between mt-auto pt-6 border-t border-brand-dark/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">{t('rewards.price')}</span>
                                            <span className="flex items-center gap-1.5 text-brand-orange font-bold text-lg">
                                                <Coins className="fill-brand-orange/20 w-4 h-4" />{reward.coinCost}
                                            </span>
                                        </div>
                                        {reward.stock !== null && (
                                            <span className="text-[10px] font-black px-3 py-1 bg-gray-50 rounded-lg text-brand-dark/30 uppercase tracking-tighter">
                                                {reward.stock > 0 ? t('rewards.left', { count: reward.stock }) : t('rewards.soldOut')}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => !disabled && setConfirmReward(reward)}
                                        disabled={disabled}
                                        className={`mt-6 w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95
                                            ${disabled
                                                ? 'bg-gray-100 text-brand-dark/20 cursor-not-allowed shadow-none'
                                                : 'bg-brand-dark text-white hover:bg-brand-orange hover:shadow-brand-orange/20'
                                            }`}>
                                        {outOfStock ? t('rewards.depleted') : !canAfford ? t('rewards.lowBalance') : t('rewards.redeemNow')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                redemptions.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-brand-dark/5">
                        <Clock size={64} className="mx-auto text-brand-dark/10 mb-6" />
                        <p className="text-brand-dark/40 font-bold text-xl italic">{t('rewards.noHistory')}</p>
                        <p className="text-brand-dark/30 text-sm mt-2">{t('rewards.noHistoryDesc')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {redemptions.map(r => (
                            <div key={r.id} className="bg-white rounded-3xl p-6 flex items-center gap-6 shadow-sm border border-brand-dark/5 hover:border-brand-orange/10 transition-colors">
                                <span className="text-4xl shrink-0">{r.reward.icon}</span>
                                <div className="flex-1">
                                    <p className="font-bold text-brand-dark text-lg">{r.reward.title}</p>
                                    <p className="text-xs text-brand-dark/40 font-bold uppercase tracking-widest mt-0.5">
                                        {t('rewards.redeemed', { date: new Date(r.redeemedAt).toLocaleDateString() })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="flex items-center gap-1.5 text-brand-orange font-black text-sm bg-brand-orange/5 px-4 py-2 rounded-xl border border-brand-orange/10">
                                        -{r.reward.coinCost} <Coins className="fill-brand-orange/20 w-4 h-4" />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Confirm Modal */}
            {confirmReward && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm" onClick={() => setConfirmReward(null)} />
                    <div className="relative bg-white rounded-[40px] p-10 max-w-sm w-full shadow-2xl animate-pop-in border border-brand-dark/10" onClick={e => e.stopPropagation()}>
                        <div className="text-7xl text-center mb-6">{confirmReward.icon}</div>
                        <h3 className="font-display font-bold text-3xl text-center mb-2 italic tracking-tight">{confirmReward.title}</h3>
                        <p className="text-brand-dark/40 text-sm text-center mb-8 font-medium leading-relaxed">{confirmReward.description}</p>

                        <div className="flex flex-col gap-4 mb-8">
                            <div className="space-y-1 text-left">
                                <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">{t('rewards.recipientName')}</label>
                                <input
                                    value={receiverName}
                                    onChange={e => setReceiverName(e.target.value)}
                                    className="w-full bg-gray-50 border border-brand-dark/5 rounded-2xl px-6 py-4 font-bold focus:ring-2 ring-brand-orange/20 outline-none transition-all"
                                    placeholder={t('rewards.enterFullName')}
                                />
                            </div>
                            <div className="space-y-1 text-left">
                                <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">{t('rewards.phoneNumber')}</label>
                                <input
                                    value={receiverPhone}
                                    onChange={e => setReceiverPhone(e.target.value)}
                                    className="w-full bg-gray-50 border border-brand-dark/5 rounded-2xl px-6 py-4 font-bold focus:ring-2 ring-brand-orange/20 outline-none transition-all"
                                    placeholder="+60..."
                                />
                            </div>
                            <div className="space-y-1 text-left">
                                <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">{t('rewards.deliveryAddress')}</label>
                                <textarea
                                    value={receiverAddress}
                                    onChange={e => setReceiverAddress(e.target.value)}
                                    className="w-full bg-gray-50 border border-brand-dark/5 rounded-2xl px-6 py-4 font-medium focus:ring-2 ring-brand-orange/20 outline-none transition-all h-24 resize-none"
                                    placeholder={t('rewards.enterAddress')}
                                />
                            </div>
                        </div>

                        <div className="bg-brand-orange/5 rounded-3xl p-6 text-center mb-8 border border-brand-orange/10">
                            <p className="text-brand-orange font-black text-2xl flex items-center justify-center gap-2">
                                <Coins className="fill-brand-orange/20 w-6 h-6 rotate-12" />
                                {t('rewards.coinsLabel', { count: confirmReward.coinCost })}
                            </p>
                            <p className="text-brand-dark/30 text-[10px] font-bold uppercase tracking-widest mt-2">
                                {t('rewards.newBalance', { balance: (userCoins - confirmReward.coinCost).toLocaleString() })}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button onClick={handleRedeem} disabled={redeeming}
                                className="w-full py-5 rounded-3xl bg-brand-dark text-white font-bold text-lg shadow-xl hover:bg-brand-orange hover:shadow-brand-orange/20 transition-all active:scale-95 disabled:opacity-50">
                                {redeeming ? t('rewards.processing') : t('rewards.confirmRedemption')}
                            </button>
                            <button onClick={() => setConfirmReward(null)} className="w-full py-4 rounded-2xl font-bold text-brand-dark/30 hover:text-brand-dark transition-colors text-sm">
                                {t('rewards.notNow')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RewardsShop;
