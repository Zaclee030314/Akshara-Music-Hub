import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user, login } = useAuth();

    useEffect(() => {
        if (user && !user.isAdmin) {
            setError("This account does not have admin privileges.");
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await login(email, password);
            // login handles the user state update. 
            // If it returns an object, it might be a verification requirement or an error.
            if (typeof result === 'object' && 'error' in result) {
                setError(result.error);
            } else if (typeof result === 'object' && 'needsVerification' in result) {
                setError("Admin accounts must be pre-verified and authorized.");
            } else if (result === false) {
                setError("Invalid credentials or unauthorized access.");
            }
        } catch {
            setError("An unexpected error occurred.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4">
            <div className="bg-white/80 backdrop-blur rounded-3xl p-8 shadow-2xl border border-white/50 w-full max-w-md animate-pop-in">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-orange/10 rounded-2xl mb-4">
                        <ShieldCheck size={32} className="text-brand-orange" />
                    </div>
                    <h1 className="text-3xl font-display font-bold">Admin Portal</h1>
                    <p className="text-brand-dark/50 mt-1">Authorized Access Only</p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-start gap-3 text-sm animate-shake">
                        <AlertCircle className="shrink-0" size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-brand-dark/50 uppercase tracking-wide block mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@questacademy.com"
                            required
                            className="w-full px-4 py-3 bg-brand-dark/5 rounded-xl font-medium outline-none focus:ring-2 focus:ring-brand-orange/30 transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-brand-dark/50 uppercase tracking-wide block mb-1">Password</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full px-4 py-3 bg-brand-dark/5 rounded-xl font-medium outline-none focus:ring-2 focus:ring-brand-orange/30 transition-all pl-11"
                            />
                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/30" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-orange to-brand-accent text-white font-bold shadow-lg shadow-orange-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Secure Login'}
                    </button>
                </form>

                <p className="text-center text-xs text-brand-dark/30 mt-8">
                    IP log recorded for all failed attempts.
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
