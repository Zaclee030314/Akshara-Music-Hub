import React, { useState, useEffect } from 'react';
import { Subject, Syllabus, GradeLevel } from '../types';
import {
    Users,
    TrendingUp,
    Calendar,
    CheckCircle,
    XCircle,
    ChevronRight,
    ArrowLeft,
    Target,
    BookOpen,
    LayoutDashboard,
    ShoppingBag,
    Gift,
    Plus,
    Edit2,
    Trash2,
    Search,
    Filter,
    MoreVertical,
    Clock,
    Database,
    Upload,
    Sparkles,
    Zap,
    FileText,
    UserPlus,
    GraduationCap,
    Loader2,
    ShieldCheck,
    Shield,
    Trophy,
    Vote,
    Share2
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import SeasonManager from './admin/SeasonManager';
import PollManager from './admin/PollManager';
import ReferralReport from './admin/ReferralReport';

interface AdminStats {
    users: number;
    totalCoins: number;
    totalXP: number;
    totalQuestions: number;
    totalCorrect: number;
    averageAccuracy: number;
}

interface UserStats {
    id: string;
    name: string;
    email: string;
    role: string;
    xp: number;
    isAdmin: boolean;
    isSubscribed: boolean;
    questsPlayed: number;
    totalQuestions: number;
    totalCorrect: number;
    accuracy: number;
    subjectsDone: string[];
}

interface Reward {
    id: string;
    title: string;
    description: string | null;
    coinCost: number;
    icon: string | null;
    imageUrl: string | null;
    stock: number | null;
    isActive: boolean;
}

interface Redemption {
    id: string;
    userId: string;
    rewardId: string;
    status: string;
    redeemedAt: string;
    user: { name: string; email: string };
    reward: { title: string };
    receiverName?: string;
    receiverPhone?: string;
    receiverAddress?: string;
}

interface PerformanceMetric {
    date: string;
    answered: number;
    correct: number;
    accuracy: number;
}

interface AdminDashboardProps {
    token: string;
}

const API_BASE = '/api/admin';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ token }) => {
    const { user: currentUser } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [tab, setTab] = useState<'analytics' | 'users' | 'rewards' | 'redemptions' | 'papers' | 'roles' | 'seasons' | 'polls' | 'referrals'>('analytics');
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserStats[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [redemptions, setRedemptions] = useState<Redemption[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
    const [userPerformance, setUserPerformance] = useState<PerformanceMetric[]>([]);
    const [loadingPerformance, setLoadingPerformance] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [rewardImageUrl, setRewardImageUrl] = useState<string | null>(null);
    const [showTeacherModal, setShowTeacherModal] = useState(false);
    const [teacherForm, setTeacherForm] = useState({ name: '', email: '', password: '' });
    const [creatingTeacher, setCreatingTeacher] = useState(false);
    const [roleSearchQuery, setRoleSearchQuery] = useState('');
    const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSortOrder, setUserSortOrder] = useState<'default' | 'accuracy-desc' | 'accuracy-asc' | 'xp-desc'>('default');
    const [redemptionSearchQuery, setRedemptionSearchQuery] = useState('');

    // Paper Files state
    const [paperFiles, setPaperFiles] = useState<any[]>([]);
    const [uploadForm, setUploadForm] = useState({ syllabus: '', grade: '', subject: '', year: '', label: '' });
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [uRes, sRes, rRes, rdRes, pfRes] = await Promise.all([
                fetch(`${API_BASE}/users`, { headers }),
                fetch(`${API_BASE}/stats`, { headers }),
                fetch(`${API_BASE}/rewards`, { headers }),
                fetch(`${API_BASE}/redemptions`, { headers }),
                fetch('/api/paper-files', { headers })
            ]);

            if (uRes.ok) setUsers(await uRes.json());
            if (sRes.ok) setStats(await sRes.json());
            if (rRes.ok) setRewards(await rRes.json());
            if (rdRes.ok) setRedemptions(await rdRes.json());
            if (pfRes.ok) setPaperFiles(await pfRes.json());
        } catch (error) {
            showToast('Failed to refresh data', 'error');
        }
        setLoading(false);
    };

    const fetchUserPerformance = async (userId: string) => {
        setLoadingPerformance(true);
        try {
            const res = await fetch(`${API_BASE}/users/${userId}/performance`, { headers });
            if (res.ok) setUserPerformance(await res.json());
        } catch {
            showToast('Failed to fetch performance data', 'error');
        }
        setLoadingPerformance(false);
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const handleBackToUsers = () => {
        setSelectedUser(null);
        setUserPerformance([]);
    };

    const handleCreateTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherForm.name || !teacherForm.email || !teacherForm.password) {
            showToast('Please fill in all fields', 'error');
            return;
        }
        setCreatingTeacher(true);
        try {
            const res = await fetch(`${API_BASE}/create-teacher`, {
                method: 'POST',
                headers,
                body: JSON.stringify(teacherForm),
            });
            const data = await res.json();
            if (res.ok) {
                showToast(`Teacher account created for ${data.teacher?.name || teacherForm.name}`, 'success');
                setShowTeacherModal(false);
                setTeacherForm({ name: '', email: '', password: '' });
                fetchData();
            } else {
                showToast(data.error || 'Failed to create teacher', 'error');
            }
        } catch {
            showToast('Failed to create teacher', 'error');
        }
        setCreatingTeacher(false);
    };

    const handleUpdateUserRole = async (userId: string, changes: { role?: string; isAdmin?: boolean }) => {
        setSavingRoleId(userId);
        try {
            const res = await fetch(`${API_BASE}/users/${userId}/role`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(changes),
            });
            const data = await res.json();
            if (res.ok) {
                setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...data.user } : u)));
                showToast('Access updated', 'success');
            } else {
                showToast(data.error || 'Failed to update access', 'error');
            }
        } catch {
            showToast('Failed to update access', 'error');
        }
        setSavingRoleId(null);
    };

    const handleSelectUser = (user: UserStats) => {
        setSelectedUser(user);
        fetchUserPerformance(user.id);
    };

    const handleRewardImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) {
            showToast('Image must be under 50MB', 'error');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setRewardImageUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    // PDF Upload handlers
    const handlePaperFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        const tooBig = selected.filter(f => f.size > 100 * 1024 * 1024);
        if (tooBig.length > 0) {
            showToast(`${tooBig.length} file(s) exceed 100MB limit`, 'error');
            return;
        }
        setUploadFiles(selected);
    };

    const handleUploadPapers = async () => {
        if (!uploadForm.syllabus || !uploadForm.grade || !uploadForm.subject || !uploadForm.year) {
            showToast('Please fill in all fields (Syllabus, Grade, Subject, Year)', 'error');
            return;
        }
        if (uploadFiles.length === 0) {
            showToast('Please select at least one PDF file', 'error');
            return;
        }
        setUploading(true);
        try {
            // Convert all files to base64
            const filesData = await Promise.all(
                uploadFiles.map(file => new Promise<{ label: string; fileData: string; fileSize: number }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        label: uploadForm.label || file.name.replace(/\.pdf$/i, '').replace(/_/g, ' '),
                        fileData: reader.result as string,
                        fileSize: file.size
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                }))
            );

            const res = await fetch('/api/paper-files/upload', {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...uploadForm, year: parseInt(uploadForm.year), files: filesData })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`✅ ${data.uploaded} PDF(s) uploaded successfully!`, 'success');
                setUploadFiles([]);
                setUploadForm({ syllabus: '', grade: '', subject: '', year: '', label: '' });
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.error || 'Upload failed', 'error');
            }
        } catch (e) {
            showToast('Upload error. Check file sizes.', 'error');
        }
        setUploading(false);
    };

    const handleDeletePaper = async (id: string) => {
        if (!confirm('Delete this paper PDF?')) return;
        try {
            const res = await fetch(`/api/paper-files/${id}`, { method: 'DELETE', headers });
            if (res.ok) {
                showToast('Paper deleted', 'success');
                setPaperFiles(prev => prev.filter(p => p.id !== id));
            } else {
                showToast('Failed to delete', 'error');
            }
        } catch {
            showToast('Error deleting paper', 'error');
        }
    };

    const handleSaveReward = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            title: formData.get('title'),
            description: formData.get('description'),
            coinCost: parseInt(formData.get('coinCost') as string),
            icon: formData.get('icon'),
            imageUrl: rewardImageUrl ?? editingReward?.imageUrl ?? null,
            stock: formData.get('stock') ? parseInt(formData.get('stock') as string) : null,
            isActive: true
        };

        try {
            const url = editingReward ? `${API_BASE}/rewards/${editingReward.id}` : `${API_BASE}/rewards`;
            const res = await fetch(url, {
                method: editingReward ? 'PUT' : 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (res.ok) {
                showToast(`Reward ${editingReward ? 'updated' : 'created'} successfully`, 'success');
                setShowRewardModal(false);
                setEditingReward(null);
                setRewardImageUrl(null);
                fetchData();
            } else {
                showToast('Failed to save reward', 'error');
            }
        } catch {
            showToast('Error saving reward', 'error');
        }
    };

    const handleDeleteReward = async (id: string) => {
        if (!confirm('Are you sure you want to delete this reward?')) return;
        try {
            const res = await fetch(`${API_BASE}/rewards/${id}`, { method: 'DELETE', headers });
            if (res.ok) {
                showToast('Reward deleted', 'success');
                setRewards(prev => prev.filter(r => r.id !== id));
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.error || 'Failed to delete reward', 'error');
            }
        } catch {
            showToast('Error deleting reward', 'error');
        }
    };

    const handleUpdateRedemption = async (id: string, status: string) => {
        try {
            const res = await fetch(`${API_BASE}/redemptions/${id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                showToast(`Status updated to ${status}`, 'success');
                fetchData();
            }
        } catch {
            showToast('Error updating status', 'error');
        }
    };

    const renderAnalytics = () => {
        if (!stats) return null;
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Students', value: stats.users, icon: <Users size={20} />, color: 'bg-blue-500' },
                        { label: 'Questions', value: stats.totalQuestions, icon: <BookOpen size={20} />, color: 'bg-purple-500' },
                        { label: 'Avg. Accuracy', value: `${stats.averageAccuracy}%`, icon: <Target size={20} />, color: 'bg-green-500' },
                        { label: 'Coins in Econ', value: stats.totalCoins, icon: <ShoppingBag size={20} />, color: 'bg-orange-500' }
                    ].map((s, i) => (
                        <div key={i} className="bg-white rounded-2xl p-6 border border-brand-dark/5 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`${s.color} p-2 rounded-xl text-white shadow-lg shadow-${s.color.split('-')[1]}-200`}>
                                    {s.icon}
                                </div>
                                <span className="text-[10px] font-bold text-brand-dark/40 uppercase tracking-widest">{s.label}</span>
                            </div>
                            <div className="text-3xl font-display font-bold text-brand-dark">{s.value.toLocaleString()}</div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-3xl p-8 border border-brand-dark/5 shadow-sm">
                        <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
                            <TrendingUp size={24} className="text-brand-orange" />
                            Engagement Metrics
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-sm font-bold text-brand-dark/60">Total XP Distributed</span>
                                <span className="font-bold text-brand-dark text-lg">⭐ {stats.totalXP.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-sm font-bold text-brand-dark/60">Global Correct Answers</span>
                                <span className="font-bold text-brand-green text-lg">✅ {stats.totalCorrect.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-brand-dark rounded-3xl p-8 text-white relative overflow-hidden group shadow-xl">
                        <div className="relative z-10">
                            <h3 className="font-display font-bold text-2xl mb-2 italic">Student Retention</h3>
                            <p className="text-white/60 text-sm mb-6">Active community participation</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-display font-bold text-brand-orange">{stats.averageAccuracy}%</span>
                                <span className="text-white/40 font-bold uppercase text-[10px] tracking-widest">Global Success Rate</span>
                            </div>
                        </div>
                        <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                            <LayoutDashboard size={200} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderUsers = () => {
        const filteredUsers = users
            .filter(u => 
                u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
            )
            .sort((a, b) => {
                if (userSortOrder === 'accuracy-desc') return b.accuracy - a.accuracy;
                if (userSortOrder === 'accuracy-asc') return a.accuracy - b.accuracy;
                if (userSortOrder === 'xp-desc') return b.xp - a.xp;
                return 0; // default (current state is usually xp-desc from backend)
            });

        return (
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/20" size={18} />
                        <input
                            type="text"
                            placeholder="Search students by name or email..."
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            className="w-full bg-white border border-brand-dark/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium outline-none focus:ring-2 ring-brand-blue/20 shadow-sm transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="text-brand-dark/30" size={18} />
                        <select
                            value={userSortOrder}
                            onChange={(e) => setUserSortOrder(e.target.value as any)}
                            className="bg-white border border-brand-dark/5 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:ring-2 ring-brand-blue/20 shadow-sm appearance-none cursor-pointer pr-10 relative"
                            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                        >
                            <option value="default">Default (XP)</option>
                            <option value="accuracy-desc">Accuracy (High → Low)</option>
                            <option value="accuracy-asc">Accuracy (Low → High)</option>
                            <option value="xp-desc">Most XP</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setShowTeacherModal(true)}
                        className="flex items-center justify-center gap-2 bg-brand-dark text-white rounded-2xl px-5 py-3.5 text-sm font-bold shadow-sm hover:bg-brand-dark/90 active:scale-95 transition-all whitespace-nowrap"
                    >
                        <UserPlus size={18} /> Add Teacher
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-brand-dark/5">
                            <Search className="mx-auto text-brand-dark/10 mb-4" size={48} />
                            <p className="text-brand-dark/30 font-bold italic">No students match your search</p>
                        </div>
                    ) : (
                        filteredUsers.map(u => (
                            <div key={u.id} onClick={() => handleSelectUser(u)} className="bg-white rounded-2xl p-5 flex items-center gap-6 border border-brand-dark/5 hover:border-brand-blue/30 hover:shadow-lg transition-all cursor-pointer group">
                                <div className="w-12 h-12 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark font-display font-bold text-lg shrink-0 group-hover:bg-brand-blue group-hover:text-white transition-colors">
                                    {u.name[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-brand-dark">{u.name}</p>
                                        {u.isSubscribed && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange font-bold uppercase">PRO</span>}
                                    </div>
                                    <p className="text-[10px] text-brand-dark/40 font-medium truncate uppercase tracking-tighter">{u.email}</p>
                                    {u.subjectsDone && u.subjectsDone.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {u.subjectsDone.slice(0, 3).map((s, i) => (
                                                <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold border border-blue-100 uppercase">
                                                    {s}
                                                </span>
                                            ))}
                                            {u.subjectsDone.length > 3 && <span className="text-[8px] text-brand-dark/30 font-bold">+{u.subjectsDone.length - 3}</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="hidden md:flex items-center gap-8 text-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-brand-dark/30 uppercase mb-0.5">Questions</p>
                                        <p className="font-bold text-sm tracking-tighter">{u.totalQuestions}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-brand-dark/30 uppercase mb-0.5">Accuracy</p>
                                        <p className={`font-bold text-sm ${u.accuracy > 80 ? 'text-green-500' : u.accuracy > 50 ? 'text-brand-orange' : 'text-red-500'}`}>
                                            {u.accuracy}%
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-brand-dark/20 group-hover:text-brand-blue group-hover:translate-x-1 transition-all" />
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const renderRoles = () => {
        const filtered = users.filter(u =>
            u.name.toLowerCase().includes(roleSearchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(roleSearchQuery.toLowerCase())
        );
        const rank = (u: UserStats) => (u.isAdmin ? 0 : u.role === 'teacher' ? 1 : 2);
        const sorted = [...filtered].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

        return (
            <div className="space-y-4">
                <div className="bg-brand-blue/5 border border-brand-blue/10 rounded-2xl p-4 flex items-start gap-3 text-sm text-brand-dark/60">
                    <ShieldCheck className="text-brand-blue shrink-0 mt-0.5" size={18} />
                    <span>Change a user's role or grant platform-admin access. Admins can manage students, teachers, rewards and everyone's access.</span>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/20" size={18} />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={roleSearchQuery}
                        onChange={(e) => setRoleSearchQuery(e.target.value)}
                        className="w-full bg-white border border-brand-dark/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium outline-none focus:ring-2 ring-brand-blue/20 shadow-sm transition-all"
                    />
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {sorted.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-brand-dark/5">
                            <Search className="mx-auto text-brand-dark/10 mb-4" size={48} />
                            <p className="text-brand-dark/30 font-bold italic">No users match your search</p>
                        </div>
                    ) : (
                        sorted.map(u => {
                            const isSelf = currentUser?.id === u.id;
                            const saving = savingRoleId === u.id;
                            return (
                                <div key={u.id} className="bg-white rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 border border-brand-dark/5">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="w-11 h-11 rounded-2xl bg-brand-dark/5 flex items-center justify-center text-brand-dark font-display font-bold text-lg shrink-0">
                                            {u.name[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-brand-dark truncate">{u.name}</p>
                                                {isSelf && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-dark/5 text-brand-dark/40 font-bold uppercase">You</span>}
                                                {u.isAdmin && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange font-bold uppercase flex items-center gap-0.5"><ShieldCheck size={9} /> Admin</span>}
                                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${u.role === 'teacher' ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>{u.role}</span>
                                            </div>
                                            <p className="text-[10px] text-brand-dark/40 font-medium truncate uppercase tracking-tighter">{u.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <select
                                            value={u.role === 'teacher' ? 'teacher' : 'student'}
                                            disabled={saving}
                                            onChange={(e) => handleUpdateUserRole(u.id, { role: e.target.value })}
                                            className="bg-gray-50 border border-brand-dark/5 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 ring-brand-blue/20 cursor-pointer disabled:opacity-50"
                                        >
                                            <option value="student">Student</option>
                                            <option value="teacher">Teacher</option>
                                        </select>

                                        {u.isAdmin ? (
                                            <button
                                                onClick={() => handleUpdateUserRole(u.id, { isAdmin: false })}
                                                disabled={saving || isSelf}
                                                title={isSelf ? "You can't revoke your own admin access" : 'Revoke admin access'}
                                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                            >
                                                <Shield size={15} /> Revoke Admin
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleUpdateUserRole(u.id, { isAdmin: true })}
                                                disabled={saving}
                                                title="Grant platform-admin access"
                                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-brand-dark text-white hover:bg-brand-dark/90 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
                                            >
                                                <ShieldCheck size={15} /> Make Admin
                                            </button>
                                        )}

                                        {saving && <Loader2 className="animate-spin text-brand-dark/40" size={18} />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    const renderPapers = () => (
        <div className="space-y-8">
            {/* Upload Form */}
            <div className="bg-white rounded-3xl p-8 border border-brand-dark/5 shadow-sm">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Upload size={20} className="text-brand-orange" />
                    Upload Past Year PDFs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest block mb-1">Syllabus *</label>
                        <select
                            value={uploadForm.syllabus}
                            onChange={e => setUploadForm(p => ({ ...p, syllabus: e.target.value }))}
                            className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:ring-2 ring-brand-orange/20 appearance-none"
                        >
                            <option value="">Select Syllabus...</option>
                            {Object.values(Syllabus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest block mb-1">Grade *</label>
                        <select
                            value={uploadForm.grade}
                            onChange={e => setUploadForm(p => ({ ...p, grade: e.target.value }))}
                            className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:ring-2 ring-brand-orange/20 appearance-none"
                        >
                            <option value="">Select Grade...</option>
                            {Object.values(GradeLevel).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest block mb-1">Subject *</label>
                        <select
                            value={uploadForm.subject}
                            onChange={e => setUploadForm(p => ({ ...p, subject: e.target.value }))}
                            className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:ring-2 ring-brand-orange/20 appearance-none"
                        >
                            <option value="">Select Subject...</option>
                            {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest block mb-1">Year *</label>
                        <select
                            value={uploadForm.year}
                            onChange={e => setUploadForm(p => ({ ...p, year: e.target.value }))}
                            className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:ring-2 ring-brand-orange/20 appearance-none"
                        >
                            <option value="">Select Year...</option>
                            {['2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016'].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest block mb-1">Label (optional — auto-uses filename if blank)</label>
                        <input
                            value={uploadForm.label}
                            onChange={e => setUploadForm(p => ({ ...p, label: e.target.value }))}
                            placeholder="e.g. SPM 2023 — Mathematics Paper 1"
                            className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:ring-2 ring-brand-orange/20"
                        />
                    </div>
                </div>

                {/* File Picker */}
                <div className="border-2 border-dashed border-brand-dark/10 rounded-2xl p-6 text-center mb-4 hover:border-brand-orange/30 transition-colors">
                    <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        id="pdf-upload"
                        className="hidden"
                        onChange={handlePaperFilesChange}
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                        <FileText size={32} className="mx-auto text-brand-dark/20 mb-3" />
                        <p className="font-bold text-sm text-brand-dark/50">
                            {uploadFiles.length > 0
                                ? `${uploadFiles.length} file(s) selected`
                                : 'Click to select PDF(s) — multiple allowed'}
                        </p>
                        {uploadFiles.length > 0 && (
                            <ul className="mt-2 text-xs text-brand-dark/40 space-y-1">
                                {uploadFiles.map((f, i) => (
                                    <li key={i}>{f.name} — {(f.size / 1024 / 1024).toFixed(1)} MB</li>
                                ))}
                            </ul>
                        )}
                        <p className="text-[10px] text-brand-dark/30 mt-2">Up to 100MB per file</p>
                    </label>
                </div>

                <button
                    onClick={handleUploadPapers}
                    disabled={uploading}
                    className="w-full bg-brand-dark text-white py-4 rounded-2xl font-bold text-sm hover:bg-brand-orange transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-95"
                >
                    {uploading ? <><span className="animate-spin">⏳</span> Uploading...</> : <><Upload size={16} /> Upload PDF(s)</>}
                </button>
            </div>

            {/* Uploaded Papers List */}
            <div className="bg-white rounded-3xl border border-brand-dark/5 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-brand-dark/5">
                    <h3 className="font-bold flex items-center gap-2">
                        <FileText size={18} className="text-brand-orange" />
                        Uploaded Papers ({paperFiles.length})
                    </h3>
                </div>
                {paperFiles.length === 0 ? (
                    <p className="text-center py-16 text-brand-dark/30 font-bold italic text-sm">No papers uploaded yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50 text-left">
                                    {['Label', 'Syllabus', 'Grade', 'Subject', 'Year', 'Size', ''].map(h => (
                                        <th key={h} className="px-5 py-3 text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-dark/5">
                                {paperFiles.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3">
                                            <a href={`/api/paper-files/${p.id}`} target="_blank" rel="noopener noreferrer"
                                                className="font-bold text-sm text-brand-orange hover:underline flex items-center gap-1">
                                                <FileText size={14} />{p.label}
                                            </a>
                                        </td>
                                        <td className="px-5 py-3 text-xs font-medium text-brand-dark/60">{p.syllabus}</td>
                                        <td className="px-5 py-3 text-xs font-medium text-brand-dark/60">{p.grade}</td>
                                        <td className="px-5 py-3 text-xs font-medium text-brand-dark/60">{p.subject}</td>
                                        <td className="px-5 py-3 text-xs font-bold text-brand-dark">{p.year}</td>
                                        <td className="px-5 py-3 text-xs text-brand-dark/40">{(p.fileSize / 1024 / 1024).toFixed(1)} MB</td>
                                        <td className="px-5 py-3">
                                            <button onClick={() => handleDeletePaper(p.id)}
                                                className="p-2 hover:bg-red-50 rounded-lg text-brand-dark/30 hover:text-red-500 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const renderRewards = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-brand-dark/5 shadow-sm">
                <div className="flex items-center gap-3">
                    <Gift className="text-brand-orange" size={24} />
                    <div>
                        <h3 className="font-bold text-sm">Reward Catalog</h3>
                        <p className="text-xs text-brand-dark/40">Manage incentives for students</p>
                    </div>
                </div>
                <button onClick={() => { setEditingReward(null); setShowRewardModal(true); }} className="bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-dark/90 flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                    <Plus size={16} /> New Reward
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {rewards.map(r => (
                    <div key={r.id} className="bg-white p-6 rounded-3xl border border-brand-dark/5 shadow-sm relative group">
                        <div className="flex justify-between mb-4">
                            {r.imageUrl
                                ? <img src={r.imageUrl} alt={r.title} className="w-16 h-16 object-cover rounded-2xl shadow" />
                                : <span className="text-4xl">{r.icon || '🎁'}</span>
                            }
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingReward(r); setShowRewardModal(true); }} className="p-2 hover:bg-brand-dark/5 rounded-lg text-brand-dark/40 hover:text-brand-dark"><Edit2 size={16} /></button>
                                <button onClick={() => handleDeleteReward(r.id)} className="p-2 hover:bg-red-50 rounded-lg text-brand-dark/40 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <h4 className="font-bold text-lg mb-1">{r.title}</h4>
                        <p className="text-sm text-brand-dark/60 mb-4 line-clamp-2">{r.description || 'No description provided.'}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-brand-dark/5">
                            <div className="flex items-center gap-1.5 font-bold text-brand-orange">
                                <ShoppingBag size={14} />
                                <span>{r.coinCost} Coins</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${r.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                                {r.isActive ? (r.stock !== null ? `${r.stock} in stock` : 'Active') : 'Inactive'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderRedemptions = () => {
        const filteredRedemptions = redemptions.filter(rd => 
            rd.user.name.toLowerCase().includes(redemptionSearchQuery.toLowerCase()) || 
            rd.user.email.toLowerCase().includes(redemptionSearchQuery.toLowerCase()) ||
            rd.reward.title.toLowerCase().includes(redemptionSearchQuery.toLowerCase())
        );
        
        return (
        <div className="bg-white rounded-3xl border border-brand-dark/5 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-brand-dark/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h3 className="font-bold flex items-center gap-2 italic">
                    <Clock size={20} className="text-brand-orange" />
                    Student Redemptions
                </h3>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/20" size={16} />
                    <input
                        type="text"
                        placeholder="Search student or reward..."
                        value={redemptionSearchQuery}
                        onChange={(e) => setRedemptionSearchQuery(e.target.value)}
                        className="w-full sm:w-64 bg-gray-50 border border-brand-dark/5 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 ring-brand-blue/20 shadow-sm transition-all"
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left bg-gray-50/50">
                            <th className="px-6 py-4 text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">Student</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">Reward</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">Delivery Info</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">Redeemed At</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-brand-dark/30 uppercase tracking-widest">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark/5">
                        {filteredRedemptions.map(rd => (
                            <tr key={rd.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-sm">{rd.user.name}</p>
                                    <p className="text-[10px] text-brand-dark/40">{rd.user.email}</p>
                                </td>
                                <td className="px-6 py-4 font-bold text-sm text-brand-orange italic">{rd.reward.title}</td>
                                <td className="px-6 py-4">
                                    <div className="text-xs space-y-0.5">
                                        <p className="font-bold text-brand-dark">{rd.receiverName || 'N/A'}</p>
                                        <p className="font-medium text-brand-dark/60">{rd.receiverPhone || 'N/A'}</p>
                                        <p className="text-[10px] text-brand-dark/40 line-clamp-1 italic max-w-[150px]" title={rd.receiverAddress || ''}>
                                            {rd.receiverAddress || 'No address'}
                                        </p>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-[10px] font-medium text-brand-dark/40">{new Date(rd.redeemedAt).toLocaleString()}</td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-tighter ${rd.status === 'fulfilled' ? 'bg-green-50 text-green-600' :
                                        rd.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                                        }`}>
                                        {rd.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        {rd.status === 'pending' && (
                                            <>
                                                <button onClick={() => handleUpdateRedemption(rd.id, 'fulfilled')} className="p-2 hover:bg-green-50 rounded-lg text-green-600 transition-colors" title="Mark as Fulfilled"><CheckCircle size={16} /></button>
                                                <button onClick={() => handleUpdateRedemption(rd.id, 'cancelled')} className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors" title="Cancel Redemption"><XCircle size={16} /></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredRedemptions.length === 0 && <p className="text-center py-20 text-brand-dark/30 font-bold italic">No redemptions found</p>}
            </div>
        </div>
    );
    };

    const renderUserPerformance = () => {
        if (!selectedUser) return null;
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <button onClick={handleBackToUsers} className="flex items-center gap-2 text-sm font-bold text-brand-dark/40 hover:text-brand-dark transition-colors mb-4">
                    <ArrowLeft size={16} /> Back to User List
                </button>

                <div className="bg-white rounded-3xl p-8 border border-brand-dark/5 shadow-sm">
                    <div className="flex items-center gap-6 mb-8">
                        <div className="w-20 h-20 rounded-2xl bg-brand-dark text-white flex items-center justify-center font-display font-bold text-4xl shadow-2xl">
                            {selectedUser.name[0].toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-display font-bold">{selectedUser.name}</h2>
                                {selectedUser.isSubscribed && <span className="bg-brand-orange/10 text-brand-orange text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Pro Member</span>}
                            </div>
                            <p className="text-brand-dark/40 font-bold uppercase tracking-tighter mt-1">{selectedUser.email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Academic XP', value: selectedUser.xp, icon: '⭐' },
                            { label: 'Q. Answered', value: selectedUser.totalQuestions, icon: '📚' },
                            { label: 'Correct', value: selectedUser.totalCorrect, icon: '✅' },
                            { label: 'Avg Accuracy', value: `${selectedUser.accuracy}%`, icon: '🎯' }
                        ].map((s, i) => (
                            <div key={i} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:border-brand-dark/10">
                                <p className="text-[10px] font-bold text-brand-dark/40 uppercase mb-2 tracking-widest">{s.label}</p>
                                <div className="text-2xl font-display font-bold">{s.icon} {s.value.toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-brand-dark/5 shadow-sm">
                    <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2 italic">
                        <Calendar size={20} className="text-brand-orange" />
                        Performance Progress
                    </h3>

                    {loadingPerformance ? (
                        <div className="text-center py-12 text-brand-dark/20 font-bold">Aggregating history...</div>
                    ) : userPerformance.length === 0 ? (
                        <p className="text-center py-12 text-brand-dark/20 font-bold italic">This user hasn't completed any sessions yet</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left border-b border-brand-dark/5">
                                        <th className="pb-4 text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Date</th>
                                        <th className="pb-4 text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Volume</th>
                                        <th className="pb-4 text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Precision</th>
                                        <th className="pb-4 text-[10px] font-black text-brand-dark/30 uppercase tracking-widest">Success Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-dark/5">
                                    {userPerformance.map((p, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 font-bold text-sm">{new Date(p.date).toLocaleDateString()}</td>
                                            <td className="py-4 text-sm font-medium">{p.answered} Qs</td>
                                            <td className="py-4 text-sm font-bold text-brand-green">{p.correct} Correct</td>
                                            <td className="py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden min-w-[100px]">
                                                        <div className={`h-full rounded-full transition-all duration-1000 ${p.accuracy > 80 ? 'bg-green-500' : p.accuracy > 50 ? 'bg-orange-400' : 'bg-red-500'}`} style={{ width: `${p.accuracy}%` }} />
                                                    </div>
                                                    <span className="text-xs font-black w-12">{p.accuracy}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50/50 flex">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-brand-dark/5 p-6 flex flex-col shrink-0">
                <div className="flex items-center gap-2 mb-10 px-2">
                    <div className="w-8 h-8 bg-brand-dark rounded-xl flex items-center justify-center">
                        <LayoutDashboard className="text-white" size={18} />
                    </div>
                    <span className="font-display font-bold text-lg tracking-tight">Admin<span className="text-brand-orange">Pro</span></span>
                </div>

                <nav className="flex-1 space-y-1">
                    {[
                        { id: 'analytics', label: 'Analytics', icon: <TrendingUp size={18} /> },
                        { id: 'users', label: 'Students', icon: <Users size={18} /> },
                        { id: 'roles', label: 'Roles', icon: <ShieldCheck size={18} /> },
                        { id: 'rewards', label: 'Rewards', icon: <Gift size={18} /> },
                        { id: 'redemptions', label: 'Orders', icon: <ShoppingBag size={18} /> },
                        { id: 'seasons', label: 'Seasons', icon: <Trophy size={18} /> },
                        { id: 'polls', label: 'Polls', icon: <Vote size={18} /> },
                        { id: 'referrals', label: 'Referrals', icon: <Share2 size={18} /> },
                        { id: 'papers', label: 'Papers', icon: <FileText size={18} /> }
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setTab(item.id as any); setSelectedUser(null); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all
                                ${tab === item.id && !selectedUser ? 'bg-brand-dark text-white shadow-lg' : 'text-brand-dark/40 hover:bg-brand-dark/5 hover:text-brand-dark'}`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="mt-auto p-4 bg-brand-orange/5 rounded-2xl border border-brand-orange/10">
                    <p className="text-[10px] font-black text-brand-orange uppercase tracking-widest mb-1">System Health</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-bold text-brand-dark/60">API Connected</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto pt-10 pb-16 px-8">
                    {toast && (
                        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-6 py-3 rounded-2xl shadow-2xl font-bold text-white text-sm animate-pop-in
                        ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                            {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                            {toast.msg}
                        </div>
                    )}

                    <header className="flex items-center justify-between mb-10">
                        <div>
                            <h1 className="text-3xl font-display font-bold tracking-tight">
                                {selectedUser ? 'Student Performance' :
                                    tab === 'analytics' ? 'Dashboard Overview' :
                                        tab === 'users' ? 'Student Management' :
                                            tab === 'roles' ? 'Roles & Access' :
                                                tab === 'rewards' ? 'Rewards Catalog' :
                                                tab === 'seasons' ? 'Seasons & Competitions' :
                                                    tab === 'polls' ? 'Prize Polls' :
                                                    tab === 'referrals' ? 'Referral Program' :
                                                        tab === 'papers' ? 'Past Year Papers' : 'Fulfillment Center'}
                            </h1>
                            <p className="text-brand-dark/40 text-sm mt-1 font-medium italic">
                                {selectedUser ? `Analyzing growth for ${selectedUser.name}` : 'Real-time platform monitoring'}
                            </p>
                        </div>
                    </header>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-40 opacity-20 animate-pulse">
                            <LayoutDashboard size={48} className="animate-spin-slow mb-4" />
                            <span className="font-bold uppercase tracking-widest text-[10px]">Syncing Data</span>
                        </div>
                    ) : selectedUser ? (
                        renderUserPerformance()
                    ) : (
                        <>
                            {tab === 'analytics' && renderAnalytics()}
                            {tab === 'users' && renderUsers()}
                            {tab === 'roles' && renderRoles()}
                            {tab === 'rewards' && renderRewards()}
                            {tab === 'redemptions' && renderRedemptions()}
                            {tab === 'seasons' && <SeasonManager token={token} />}
                            {tab === 'polls' && <PollManager token={token} />}
                            {tab === 'referrals' && <ReferralReport token={token} />}
                            {tab === 'papers' && renderPapers()}
                        </>
                    )}
                </div>
            </div>

            {/* Reward Modal */}
            {showRewardModal && (
                <div className="fixed inset-0 z-[400] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm" onClick={() => { setShowRewardModal(false); setRewardImageUrl(null); }} />
                        <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-xl p-10 transform transition-all animate-pop-in border border-brand-dark/10">
                            <h2 className="text-3xl font-display font-bold mb-8 italic">{editingReward ? 'Refine' : 'Add'} Reward</h2>
                            <form onSubmit={handleSaveReward} className="space-y-6">
                                {/* Image Upload */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Reward Image (Optional)</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-brand-dark/10 flex items-center justify-center overflow-hidden shrink-0">
                                            {(rewardImageUrl || editingReward?.imageUrl) ? (
                                                <img src={rewardImageUrl || editingReward?.imageUrl!} alt="preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-3xl">{editingReward?.icon || '🎁'}</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleRewardImageChange}
                                                className="w-full text-xs text-brand-dark/50 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-brand-dark/5 file:text-brand-dark hover:file:bg-brand-dark/10 cursor-pointer"
                                            />
                                            <p className="text-[10px] text-brand-dark/30 mt-1 px-1">PNG, JPG, WEBP up to 50MB. If set, image replaces the emoji icon.</p>
                                            {(rewardImageUrl || editingReward?.imageUrl) && (
                                                <button type="button" onClick={() => setRewardImageUrl('')} className="text-[10px] text-red-400 hover:text-red-600 font-bold mt-1 px-1">✕ Remove image</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Icon/Emoji (fallback)</label>
                                        <input name="icon" defaultValue={editingReward?.icon || ''} className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 font-bold text-2xl focus:ring-2 ring-brand-orange/20" placeholder="🎁" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Coin Cost</label>
                                        <input required type="number" name="coinCost" defaultValue={editingReward?.coinCost || ''} className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 font-bold focus:ring-2 ring-brand-orange/20" placeholder="500" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Reward Title</label>
                                    <input required name="title" defaultValue={editingReward?.title || ''} className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 font-bold focus:ring-2 ring-brand-orange/20" placeholder="Sticker Pack" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Description</label>
                                    <textarea name="description" defaultValue={editingReward?.description || ''} className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 font-medium focus:ring-2 ring-brand-orange/20" rows={3} placeholder="Tell them what they're winning..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Initial Stock (Optional)</label>
                                    <input type="number" name="stock" defaultValue={editingReward?.stock || ''} className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 font-bold focus:ring-2 ring-brand-orange/20" placeholder="100 (Leave blank for ∞)" />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setShowRewardModal(false)} className="flex-1 bg-gray-50 text-brand-dark/40 py-5 rounded-2xl font-bold hover:bg-gray-100 active:scale-95 transition-all">Cancel</button>
                                    <button type="submit" className="flex-[2] bg-brand-dark text-white py-5 rounded-3xl font-bold text-lg hover:bg-brand-dark/90 shadow-xl active:scale-95 transition-all">Save Catalog Item</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Teacher Modal */}
            {showTeacherModal && (
                <div className="fixed inset-0 z-[400] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm" onClick={() => setShowTeacherModal(false)} />
                        <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md p-10 transform transition-all animate-pop-in border border-brand-dark/10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                                    <GraduationCap size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-display font-bold">Add Teacher</h2>
                                    <p className="text-xs text-brand-dark/40 font-medium">Provision a verified teacher account</p>
                                </div>
                            </div>
                            <form onSubmit={handleCreateTeacher} className="space-y-5 mt-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Full Name</label>
                                    <input
                                        value={teacherForm.name}
                                        onChange={(e) => setTeacherForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 font-bold focus:ring-2 ring-brand-blue/20"
                                        placeholder="e.g. Ms. Tan"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Email</label>
                                    <input
                                        type="email"
                                        value={teacherForm.email}
                                        onChange={(e) => setTeacherForm(p => ({ ...p, email: e.target.value }))}
                                        className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 font-bold focus:ring-2 ring-brand-blue/20"
                                        placeholder="teacher@centre.com"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-brand-dark/30 uppercase tracking-widest px-1">Temporary Password</label>
                                    <input
                                        type="text"
                                        value={teacherForm.password}
                                        onChange={(e) => setTeacherForm(p => ({ ...p, password: e.target.value }))}
                                        className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 font-bold focus:ring-2 ring-brand-blue/20"
                                        placeholder="At least 6 characters"
                                    />
                                    <p className="text-[10px] text-brand-dark/30 mt-1 px-1">Share this with the teacher — they can change it via “Forgot password”.</p>
                                </div>
                                <div className="flex gap-4 pt-2">
                                    <button type="button" onClick={() => setShowTeacherModal(false)} className="flex-1 bg-gray-50 text-brand-dark/40 py-4 rounded-2xl font-bold hover:bg-gray-100 active:scale-95 transition-all">Cancel</button>
                                    <button type="submit" disabled={creatingTeacher} className="flex-[2] bg-brand-dark text-white py-4 rounded-2xl font-bold hover:bg-brand-dark/90 shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                        {creatingTeacher ? <Loader2 className="animate-spin" size={18} /> : 'Create Teacher'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
