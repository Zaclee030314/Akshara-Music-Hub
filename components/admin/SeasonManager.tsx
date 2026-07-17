import React, { useEffect, useState } from 'react';
import {
    Trophy, Plus, Edit2, Loader2, Calendar, Award, CheckCircle, XCircle, UserCircle2, X,
} from 'lucide-react';

interface Winner {
    rank: number;
    userId: string;
    points: number;
    awardedPoints: number;
    prizeTitle: string;
    name: string;
    avatar: string | null;
}

interface Season {
    id: string;
    name: string;
    description: string | null;
    prizeTitle: string;
    prizeDetails: string | null;
    secondPlacePoints: number;
    thirdPlacePoints: number;
    startDate: string;
    endDate: string;
    status: string;
    rawStatus: string;
    winners: Winner[];
}

interface LeaderRow {
    userId: string;
    name: string;
    avatar: string | null;
    points: number;
    rank: number;
}

interface Props {
    token: string;
}

const emptyForm = {
    name: '', description: '', prizeTitle: '', prizeDetails: '',
    secondPlacePoints: '50', thirdPlacePoints: '25', startDate: '', endDate: '',
};

// Convert an ISO string to the value a datetime-local input expects.
const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
};

const statusChip = (status: string) => {
    const map: Record<string, string> = {
        upcoming: 'bg-blue-50 text-blue-600',
        active: 'bg-green-50 text-green-600',
        ended: 'bg-amber-50 text-amber-600',
        finalized: 'bg-purple-50 text-purple-600',
    };
    return map[status] || 'bg-gray-50 text-gray-500';
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const SeasonManager: React.FC<Props> = ({ token }) => {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Season | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);

    // Finalize flow
    const [finalizeSeason, setFinalizeSeason] = useState<Season | null>(null);
    const [preview, setPreview] = useState<LeaderRow[] | null>(null);
    const [finalizing, setFinalizing] = useState(false);

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchSeasons = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/seasons/admin/all', { headers });
            if (res.ok) setSeasons(await res.json());
        } catch {
            showToast('Failed to load seasons', 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchSeasons(); }, [token]);

    const openCreate = () => {
        setEditing(null);
        setForm({ ...emptyForm });
        setShowModal(true);
    };

    const openEdit = (s: Season) => {
        setEditing(s);
        setForm({
            name: s.name,
            description: s.description || '',
            prizeTitle: s.prizeTitle,
            prizeDetails: s.prizeDetails || '',
            secondPlacePoints: String(s.secondPlacePoints),
            thirdPlacePoints: String(s.thirdPlacePoints),
            startDate: toLocalInput(s.startDate),
            endDate: toLocalInput(s.endDate),
        });
        setShowModal(true);
    };

    const saveSeason = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.prizeTitle || !form.startDate || !form.endDate) {
            showToast('Please fill name, prize and dates', 'error');
            return;
        }
        setSaving(true);
        try {
            const url = editing ? `/api/seasons/admin/${editing.id}` : '/api/seasons/admin';
            const res = await fetch(url, {
                method: editing ? 'PUT' : 'POST',
                headers,
                body: JSON.stringify({
                    name: form.name,
                    description: form.description,
                    prizeTitle: form.prizeTitle,
                    prizeDetails: form.prizeDetails,
                    secondPlacePoints: parseInt(form.secondPlacePoints, 10) || 0,
                    thirdPlacePoints: parseInt(form.thirdPlacePoints, 10) || 0,
                    startDate: new Date(form.startDate).toISOString(),
                    endDate: new Date(form.endDate).toISOString(),
                }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast(`Season ${editing ? 'updated' : 'created'}`, 'success');
                setShowModal(false);
                fetchSeasons();
            } else {
                showToast(data.error || 'Failed to save season', 'error');
            }
        } catch {
            showToast('Failed to save season', 'error');
        }
        setSaving(false);
    };

    const openFinalize = async (s: Season) => {
        setFinalizeSeason(s);
        setPreview(null);
        try {
            const res = await fetch(`/api/seasons/${s.id}/leaderboard`, { headers });
            if (res.ok) {
                const data = await res.json();
                setPreview((data.leaderboard || []).slice(0, 3));
            } else {
                setPreview([]);
            }
        } catch {
            setPreview([]);
        }
    };

    const confirmFinalize = async () => {
        if (!finalizeSeason) return;
        setFinalizing(true);
        try {
            const res = await fetch(`/api/seasons/admin/${finalizeSeason.id}/finalize`, {
                method: 'POST',
                headers,
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Season finalized & winners announced', 'success');
                setFinalizeSeason(null);
                fetchSeasons();
            } else {
                showToast(data.error || 'Failed to finalize', 'error');
            }
        } catch {
            showToast('Failed to finalize', 'error');
        }
        setFinalizing(false);
    };

    const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉');

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
                    <Trophy className="text-brand-orange" size={24} />
                    <div>
                        <h3 className="font-bold text-sm">Seasonal Competitions</h3>
                        <p className="text-xs text-brand-dark/40">Run leaderboards with real prizes</p>
                    </div>
                </div>
                <button onClick={openCreate} className="bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-dark/90 flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                    <Plus size={16} /> New Season
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12 text-brand-dark/30"><Loader2 className="animate-spin" size={28} /></div>
            ) : seasons.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-brand-dark/5">
                    <Trophy className="mx-auto text-brand-dark/10 mb-3" size={44} />
                    <p className="text-brand-dark/30 font-bold italic">No seasons yet. Create your first competition!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {seasons.map(s => (
                        <div key={s.id} className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h4 className="font-bold text-brand-dark">{s.name}</h4>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${statusChip(s.status)}`}>{s.status}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-brand-dark/50 font-medium mb-1">
                                        <Calendar size={13} /> {fmt(s.startDate)} → {fmt(s.endDate)}
                                    </div>
                                    <p className="text-xs text-brand-dark/60 flex items-center gap-1.5">
                                        <Award size={13} className="text-brand-orange" />
                                        <span className="font-bold">{s.prizeTitle}</span>
                                        <span className="text-brand-dark/30">· 2nd +{s.secondPlacePoints} · 3rd +{s.thirdPlacePoints}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {s.status !== 'finalized' && (
                                        <button onClick={() => openEdit(s)} className="p-2 hover:bg-brand-dark/5 rounded-lg text-brand-dark/40 hover:text-brand-dark" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    {s.status === 'ended' && (
                                        <button onClick={() => openFinalize(s)} className="bg-brand-orange text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-600 active:scale-95 transition-all flex items-center gap-1.5">
                                            <Trophy size={14} /> Finalize & Announce
                                        </button>
                                    )}
                                </div>
                            </div>

                            {s.status === 'finalized' && s.winners.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-brand-dark/5 flex flex-wrap gap-3">
                                    {s.winners.map(w => (
                                        <div key={w.userId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                                            <span>{medal(w.rank)}</span>
                                            {w.avatar ? (
                                                <img src={w.avatar} alt={w.name} className="w-7 h-7 rounded-full object-cover" />
                                            ) : (
                                                <UserCircle2 size={20} className="text-brand-dark/30" />
                                            )}
                                            <div>
                                                <p className="text-xs font-bold text-brand-dark">{w.name}</p>
                                                <p className="text-[10px] text-brand-dark/40 font-bold">
                                                    {w.points} pts{w.rank === 1 ? ` · ${w.prizeTitle}` : ` · +${w.awardedPoints} XP`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[400] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                        <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg p-8 animate-pop-in border border-brand-dark/10 my-8">
                            <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-brand-dark/30 hover:text-brand-dark"><X size={20} /></button>
                            <h2 className="text-2xl font-display font-bold mb-6">{editing ? 'Edit' : 'New'} Season</h2>
                            <form onSubmit={saveSeason} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Season Name *</label>
                                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 ring-brand-orange/20 mt-1" placeholder="Autumn Championship 2026" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Description</label>
                                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:ring-2 ring-brand-orange/20 mt-1" placeholder="Compete for the top spot!" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Prize Title (1st) *</label>
                                        <input value={form.prizeTitle} onChange={e => setForm(p => ({ ...p, prizeTitle: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 ring-brand-orange/20 mt-1" placeholder="Bluetooth Speaker" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Prize Details</label>
                                        <input value={form.prizeDetails} onChange={e => setForm(p => ({ ...p, prizeDetails: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:ring-2 ring-brand-orange/20 mt-1" placeholder="Collect at reception" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">2nd Place Bonus XP</label>
                                        <input type="number" value={form.secondPlacePoints} onChange={e => setForm(p => ({ ...p, secondPlacePoints: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 ring-brand-orange/20 mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">3rd Place Bonus XP</label>
                                        <input type="number" value={form.thirdPlacePoints} onChange={e => setForm(p => ({ ...p, thirdPlacePoints: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 ring-brand-orange/20 mt-1" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Start *</label>
                                        <input type="datetime-local" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 ring-brand-orange/20 mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">End *</label>
                                        <input type="datetime-local" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 ring-brand-orange/20 mt-1" />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-50 text-brand-dark/40 py-3.5 rounded-2xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
                                    <button type="submit" disabled={saving} className="flex-[2] bg-brand-dark text-white py-3.5 rounded-2xl font-bold hover:bg-brand-dark/90 shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                        {saving ? <Loader2 className="animate-spin" size={18} /> : 'Save Season'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Finalize Confirm Modal */}
            {finalizeSeason && (
                <div className="fixed inset-0 z-[400] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm" onClick={() => setFinalizeSeason(null)} />
                        <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 animate-pop-in border border-brand-dark/10">
                            <button onClick={() => setFinalizeSeason(null)} className="absolute top-5 right-5 text-brand-dark/30 hover:text-brand-dark"><X size={20} /></button>
                            <div className="text-center mb-6">
                                <Trophy size={40} className="text-brand-orange mx-auto mb-2" />
                                <h2 className="text-xl font-display font-bold">Finalize “{finalizeSeason.name}”?</h2>
                                <p className="text-xs text-brand-dark/50 mt-1">This locks the season, awards bonus XP to 2nd & 3rd, and announces winners. This cannot be undone.</p>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                                <p className="text-[10px] font-black text-brand-dark/40 uppercase tracking-widest mb-3">Current Top 3</p>
                                {preview === null ? (
                                    <div className="flex justify-center py-4 text-brand-dark/30"><Loader2 className="animate-spin" size={20} /></div>
                                ) : preview.length === 0 ? (
                                    <p className="text-center text-brand-dark/40 text-sm font-bold italic py-2">No participants yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {preview.map(r => (
                                            <div key={r.userId} className="flex items-center gap-2">
                                                <span>{medal(r.rank)}</span>
                                                {r.avatar ? (
                                                    <img src={r.avatar} alt={r.name} className="w-7 h-7 rounded-full object-cover" />
                                                ) : (
                                                    <UserCircle2 size={20} className="text-brand-dark/30" />
                                                )}
                                                <span className="font-bold text-sm text-brand-dark flex-1">{r.name}</span>
                                                <span className="font-bold text-sm text-brand-orange">{r.points} pts</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setFinalizeSeason(null)} className="flex-1 bg-gray-50 text-brand-dark/40 py-3.5 rounded-2xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
                                <button onClick={confirmFinalize} disabled={finalizing} className="flex-[2] bg-brand-orange text-white py-3.5 rounded-2xl font-bold hover:bg-orange-600 shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {finalizing ? <Loader2 className="animate-spin" size={18} /> : 'Confirm & Announce'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SeasonManager;
