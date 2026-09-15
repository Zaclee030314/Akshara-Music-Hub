import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { ArrowLeft, LogIn, Mail, Loader2, KeyRound, ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, X, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useT } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Syllabus } from '../types';
import { getGradesBySyllabus } from '../lib/curriculum';
import { suggestGrade, isMusicSyllabus } from '../lib/ageGrade';

interface LoginModalProps {
    onClose: () => void;
    /** Where to land after a successful login — preserves the user's intent
     *  (e.g. they clicked a subject or "Rewards" before logging in). Falls back
     *  to the role dashboard when not provided. */
    postLoginPath?: string | null;
}

type ModalView = 'login' | 'verify' | 'forgot_email' | 'forgot_otp' | 'forgot_newpass';

// Step indicator for forgot-password flow
const StepDots = ({ current }: { current: 1 | 2 | 3 }) => (
    <div className="flex items-center justify-center gap-2 mb-5">
        {[1, 2, 3].map(n => (
            <React.Fragment key={n}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${n < current ? 'bg-brand-green text-white' :
                        n === current ? 'bg-brand-orange text-white scale-110 shadow-md' :
                            'bg-brand-dark/10 text-brand-dark/40'
                    }`}>
                    {n < current ? <CheckCircle2 size={14} /> : n}
                </div>
                {n < 3 && <div className={`h-px w-7 transition-colors duration-300 ${n < current ? 'bg-brand-green' : 'bg-brand-dark/10'}`} />}
            </React.Fragment>
        ))}
    </div>
);

// Password input with show/hide toggle
const PasswordInput = ({ value, onChange, placeholder, onEnter }: {
    value: string; onChange: (v: string) => void; placeholder?: string; onEnter?: () => void;
}) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full p-3 pr-11 rounded-lg border-2 border-brand-dark/10 focus:outline-none focus:border-brand-orange transition-colors"
                placeholder={placeholder || '••••••••'}
                onKeyDown={e => e.key === 'Enter' && onEnter?.()}
            />
            <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark/30 hover:text-brand-dark/60 transition-colors">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    );
};

const BirthdayInput = ({ value, onChange, max }: { value: string, onChange: (val: string) => void, max: string }) => {
    const [text, setText] = useState(() => {
        if (!value) return '';
        const [y, m, d] = value.split('-');
        if (!y || !m || !d) return '';
        return `${d}/${m}/${y}`;
    });
    const dateInputRef = React.useRef<HTMLInputElement>(null);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^\d]/g, '');
        if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
        if (val.length > 5) val = val.substring(0, 5) + '/' + val.substring(5);
        if (val.length > 10) val = val.substring(0, 10);
        
        setText(val);
        
        if (val.length === 10) {
            const [d, m, y] = val.split('/');
            onChange(`${y}-${m}-${d}`);
        } else {
            onChange('');
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(val);
        if (val) {
            const [y, m, d] = val.split('-');
            if (y && m && d) setText(`${d}/${m}/${y}`);
        } else {
            setText('');
        }
    };

    const openPicker = () => {
        if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
            try {
                (dateInputRef.current as any).showPicker();
            } catch (e) {
                dateInputRef.current.focus();
            }
        } else if (dateInputRef.current) {
            dateInputRef.current.focus();
        }
    };

    return (
        <div className="relative flex items-center">
            <input 
                type="text" 
                value={text} 
                onChange={handleTextChange} 
                placeholder="DD/MM/YYYY" 
                className="w-full p-3 rounded-lg border-2 border-brand-dark/10 bg-white min-h-[48px] pr-12 focus:outline-none focus:border-brand-orange text-brand-dark"
            />
            <button 
                type="button"
                onClick={openPicker}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-brand-dark/50 hover:text-brand-orange hover:bg-brand-orange/10 rounded-full transition-colors"
            >
                <Calendar size={20} />
            </button>
            <input 
                type="date" 
                ref={dateInputRef}
                value={value} 
                max={max}
                onChange={handleDateChange} 
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
        </div>
    );
};

// OTP input
const OtpInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
        type="text" inputMode="numeric" maxLength={6}
        value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        className="w-full p-4 text-center text-3xl tracking-[1em] font-bold rounded-lg border-2 border-brand-dark/10 focus:outline-none focus:border-brand-orange"
        placeholder="000000"
    />
);

/** Returns the dashboard path for a user based on their role. */
const dashboardFor = (user: { isAdmin?: boolean; role?: string } | null | undefined): string => {
    if (!user) return '/';
    if (user.isAdmin) return '/admin';
    if (user.role === 'teacher') return '/teacher';
    if (user.role === 'parent') return '/profiles';
    return '/dashboard';
};

/** Reads the most recently logged-in user from localStorage (set by AuthContext on login). */
const getStoredUserRole = (): { isAdmin?: boolean; role?: string } | null => {
    try {
        const raw = localStorage.getItem('quest_user_role');
        if (raw) return JSON.parse(raw);
    } catch {}
    return null;
};

export const LoginModal = ({ onClose, postLoginPath }: LoginModalProps) => {
    const { login, signup, verifyCode, resendCode, user: authUser } = useAuth();
    const { t } = useT();
    const navigate = useNavigate();
    const [view, setView] = useState<ModalView>('login');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    // Close on Escape; clicking the dark backdrop (not the card) also closes.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose(); };

    // A real, thumb-sized close control (44px+) on EVERY view. The old control
    // was a 20px back-arrow with no padding — missed on phones, and it read as
    // "back" rather than "close" (on some views it only switched view).
    const closeX = (
        <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute top-3 right-3 z-10 p-2.5 rounded-full text-brand-dark/50 hover:text-brand-dark hover:bg-brand-dark/5 transition-colors"
        >
            <X size={22} />
        </button>
    );
    const backArrow = (onBack: () => void) => (
        <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="absolute top-3 left-3 z-10 p-2.5 rounded-full text-brand-dark/40 hover:text-brand-dark hover:bg-brand-dark/5 transition-colors"
        >
            <ArrowLeft size={20} />
        </button>
    );

    // Login / signup state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    // Signup: birthday, contact, syllabus + grade selection
    const [birthday, setBirthday] = useState('');           // 'YYYY-MM-DD'
    const [phone, setPhone] = useState('');
    const [selectedSyllabus, setSelectedSyllabus] = useState<Syllabus | ''>('');
    const [selectedGrade, setSelectedGrade] = useState('');
    // Once the student picks a standard themselves, stop overwriting it with the suggestion.
    const [gradeTouched, setGradeTouched] = useState(false);

    const todayISO = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

    const gradeOptions = React.useMemo(() => {
        if (!selectedSyllabus) return [];
        const g = getGradesBySyllabus(selectedSyllabus as Syllabus);
        return [...g.primary, ...g.secondary, ...(g.advanced || [])];
    }, [selectedSyllabus]);

    // Auto-suggest the standard from the birthday until the student overrides it.
    // Music syllabi have no age→grade relationship, so they are never suggested.
    const suggestedGrade = React.useMemo(() => {
        if (!birthday || !selectedSyllabus || isMusicSyllabus(selectedSyllabus)) return null;
        return suggestGrade(selectedSyllabus, birthday);
    }, [birthday, selectedSyllabus]);

    React.useEffect(() => {
        if (gradeTouched) return;
        if (!birthday || !selectedSyllabus || isMusicSyllabus(selectedSyllabus)) return;
        setSelectedGrade(suggestedGrade ?? '');
    }, [birthday, selectedSyllabus, suggestedGrade, gradeTouched]);

    const gradeWasSuggested = !gradeTouched && !!suggestedGrade && selectedGrade === suggestedGrade;

    // Forgot password state
    const [fpEmail, setFpEmail] = useState('');
    const [fpOtp, setFpOtp] = useState('');
    const [fpToken, setFpToken] = useState('');
    const [fpNewPw, setFpNewPw] = useState('');
    const [fpConfirmPw, setFpConfirmPw] = useState('');
    const [fpError, setFpError] = useState('');
    const [fpSuccess, setFpSuccess] = useState('');

    const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const wrap = async (fn: () => Promise<void>) => { setLoading(true); try { await fn(); } finally { setLoading(false); } };

    const handleVerify = () => wrap(async () => {
        setError('');
        setSuccess('');
        if (!code) { setError(t('login.alertEnterCode')); return; }
        const r = await verifyCode(email, code);
        if (r === true) {
            onClose();
            navigate(postLoginPath || dashboardFor(getStoredUserRole()));
        } else if (typeof r === 'object' && 'error' in r) {
            setError(r.error);
        }
    });

    const handleResend = () => wrap(async () => {
        setError('');
        setSuccess('');
        const r = await resendCode(email);
        if (r === true) setSuccess('New verification code sent to your email.');
        else if (typeof r === 'object' && 'error' in r) setError(r.error);
    });

    const handleSubmit = () => wrap(async () => {
        setError('');
        setSuccess('');
        // Sign-up has a dedicated email field, so use the email-specific message there.
        if (!email) { setError(isSignUp ? t('login.alertValidEmail') : t('login.alertEnterEmailOrName')); return; }
        if (isSignUp && !validEmail(email)) { setError(t('login.alertValidEmail')); return; }
        if (isSignUp) {
            if (!name || !password) { setError(t('login.alertFillAll')); return; }
            if (!birthday) { setError(t('login.alertEnterBirthday')); return; }
            if (!phone.trim()) { setError(t('login.alertEnterPhone')); return; }
            if (!selectedSyllabus) { setError(t('login.alertSelectSyllabus')); return; }
            if (!selectedGrade) { setError(t('login.alertSelectGrade')); return; }
            const r = await signup({
                name,
                email,
                password,
                role: 'student',
                grade: selectedGrade,
                syllabus: selectedSyllabus,
                birthday,
                phone: phone.trim()
            });
            if (typeof r === 'object' && 'error' in r) {
                setError(r.error);
            } else if (typeof r === 'object' && 'needsVerification' in r) {
                setEmail(r.email); setView('verify');
            } else if (r === true) {
                onClose();
                navigate(postLoginPath || dashboardFor(getStoredUserRole()));
            }
        } else {
            if (!password) { setError(t('login.alertEnterPassword')); return; }
            const r = await login(email, password);
            if (typeof r === 'object' && 'error' in r) {
                setError(r.error);
            } else if (typeof r === 'object' && 'needsVerification' in r) {
                setEmail(r.email); setView('verify');
            } else if (r === true) {
                onClose();
                navigate(postLoginPath || dashboardFor(getStoredUserRole()));
            }
        }
    });

    const fpSendOtp = () => wrap(async () => {
        setFpError('');
        if (!validEmail(fpEmail)) { setFpError(t('login.alertValidEmail')); return; }
        const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: fpEmail }) });
        const data = await res.json();
        if (!res.ok) setFpError(data.error || t('login.errFailSendCode'));
        else setView('forgot_otp');
    });

    const fpVerifyOtp = () => wrap(async () => {
        setFpError('');
        if (fpOtp.length !== 6) { setFpError(t('login.errFullCode')); return; }
        const res = await fetch('/api/auth/verify-reset-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: fpEmail, otp: fpOtp }) });
        const data = await res.json();
        if (!res.ok) setFpError(data.error || t('login.errInvalidCode'));
        else { setFpToken(data.resetToken); setView('forgot_newpass'); }
    });

    const fpReset = () => wrap(async () => {
        setFpError('');
        if (fpNewPw.length < 6) { setFpError(t('login.errPasswordMin')); return; }
        if (fpNewPw !== fpConfirmPw) { setFpError(t('login.errPasswordMatch')); return; }
        const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resetToken: fpToken, newPassword: fpNewPw }) });
        const data = await res.json();
        if (!res.ok) setFpError(data.error || t('login.errFailReset'));
        else {
            setFpSuccess(t('login.passwordResetSuccess'));
            setTimeout(() => {
                setView('login');
                setFpEmail(''); setFpOtp(''); setFpToken(''); setFpNewPw(''); setFpConfirmPw('');
                setFpSuccess(''); setFpError('');
            }, 2200);
        }
    });

    // ── EMAIL VERIFICATION ──────────────────────────────────────────────────
    if (view === 'verify') return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 overflow-y-auto" onClick={onBackdrop}>
            <Card className="max-w-md w-full p-8 relative">
                {backArrow(() => setView('login'))}
                {closeX}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-blue">
                        <Mail size={32} />
                    </div>
                    <h3 className="text-2xl font-bold font-display">{t('login.verifyEmail')}</h3>
                    <p className="text-gray-500 text-sm">{t('login.verifySentPre')} <b>{email}</b>. {t('login.verifySentPost')}</p>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.sixDigitCode')}</label>
                        <OtpInput value={code} onChange={setCode} />
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg font-medium">{error}</p>}
                    {success && <p className="text-sm text-brand-green bg-green-50 border border-green-200 p-3 rounded-lg font-medium">{success}</p>}
                    <Button fullWidth onClick={handleVerify} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : t('login.verifyContinue')}
                    </Button>
                    <div className="text-center pt-2">
                        <button onClick={handleResend} disabled={loading} className="text-brand-blue text-sm font-bold hover:underline disabled:opacity-50">
                            {t('login.resendCode')}
                        </button>
                    </div>
                    <div className="text-center text-xs text-gray-400">{t('login.checkSpam')}</div>
                </div>
            </Card>
        </div>
    );

    // ── FORGOT PASSWORD: STEP 1 – Email ─────────────────────────────────────
    if (view === 'forgot_email') return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 overflow-y-auto" onClick={onBackdrop}>
            <Card className="max-w-md w-full p-8 relative">
                {backArrow(() => { setView('login'); setFpError(''); })}
                {closeX}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-orange">
                        <KeyRound size={32} />
                    </div>
                    <h3 className="text-2xl font-bold font-display">{t('login.forgotTitle')}</h3>
                    <p className="text-gray-500 text-sm">{t('login.forgotDesc')}</p>
                </div>
                <StepDots current={1} />
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.emailAddress')}</label>
                        <input type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                            className="w-full p-3 rounded-lg border-2 border-brand-dark/10 focus:outline-none focus:border-brand-orange"
                            placeholder="your@email.com"
                            onKeyDown={e => e.key === 'Enter' && fpSendOtp()} />
                    </div>
                    {fpError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg font-medium">{fpError}</p>}
                    <Button fullWidth onClick={fpSendOtp} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : t('login.sendResetCode')}
                    </Button>
                </div>
            </Card>
        </div>
    );

    // ── FORGOT PASSWORD: STEP 2 – OTP ───────────────────────────────────────
    if (view === 'forgot_otp') return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 overflow-y-auto" onClick={onBackdrop}>
            <Card className="max-w-md w-full p-8 relative">
                {backArrow(() => { setView('forgot_email'); setFpError(''); setFpOtp(''); })}
                {closeX}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-blue">
                        <ShieldCheck size={32} />
                    </div>
                    <h3 className="text-2xl font-bold font-display">{t('login.enterResetCode')}</h3>
                    <p className="text-gray-500 text-sm">{t('login.resetCodeSentPre')} <b>{fpEmail}</b>.</p>
                </div>
                <StepDots current={2} />
                <div className="space-y-4">
                    <OtpInput value={fpOtp} onChange={setFpOtp} />
                    {fpError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg font-medium">{fpError}</p>}
                    <Button fullWidth onClick={fpVerifyOtp} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : t('login.verifyCodeBtn')}
                    </Button>
                    <div className="text-center pt-1">
                        <button onClick={() => { setFpOtp(''); setView('forgot_email'); setFpError(''); }}
                            className="text-brand-blue text-sm font-bold hover:underline">
                            {t('login.tryAgain')}
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );

    // ── FORGOT PASSWORD: STEP 3 – New Password ──────────────────────────────
    if (view === 'forgot_newpass') return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 overflow-y-auto" onClick={onBackdrop}>
            <Card className="max-w-md w-full p-8 relative">
                {closeX}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-green">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-2xl font-bold font-display">{t('login.setNewPassword')}</h3>
                    <p className="text-gray-500 text-sm">{t('login.chooseStrong')}</p>
                </div>
                <StepDots current={3} />
                {fpSuccess ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl font-medium text-sm">
                        <CheckCircle2 size={18} className="shrink-0" /> {fpSuccess}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.newPassword')}</label>
                            <PasswordInput value={fpNewPw} onChange={setFpNewPw} placeholder={t('login.passwordPlaceholder')} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.confirmPassword')}</label>
                            <PasswordInput value={fpConfirmPw} onChange={setFpConfirmPw} placeholder={t('login.repeatPassword')} onEnter={fpReset} />
                        </div>
                        {fpError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg font-medium">{fpError}</p>}
                        <Button fullWidth onClick={fpReset} disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : t('login.resetPasswordBtn')}
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );

    // ── MAIN LOGIN / SIGNUP ─────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 overflow-y-auto" onClick={onBackdrop}>
            <Card className="max-w-md w-full p-8 relative">
                {closeX}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-orange">
                        <LogIn size={32} />
                    </div>
                    <h3 className="text-2xl font-bold font-display">{isSignUp ? t('login.createAccount') : t('login.welcomeBack')}</h3>
                    <p className="text-gray-500">{isSignUp ? t('login.joinToday') : t('login.loginToContinue')}</p>
                </div>

                <div className="space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl font-medium text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                            <ShieldCheck className="shrink-0 mt-0.5" size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.fullName')}</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                className="w-full p-3 rounded-lg border-2 border-brand-dark/10" placeholder={t('login.fullNamePlaceholder')} />
                        </div>
                    )}

                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.birthday')}</label>
                            <BirthdayInput value={birthday} max={todayISO} onChange={setBirthday} />
                            <p className="text-xs text-brand-dark/40 mt-1">{t('login.birthdayHint')}</p>
                        </div>
                    )}

                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.contactPhone')}</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full p-3 rounded-lg border-2 border-brand-dark/10"
                                placeholder={t('login.contactPhonePlaceholder')}
                            />
                            <p className="text-xs text-brand-dark/40 mt-1">{t('login.contactPhoneHint')}</p>
                        </div>
                    )}

                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.syllabus')}</label>
                            <select
                                value={selectedSyllabus}
                                onChange={e => { setSelectedSyllabus(e.target.value as Syllabus | ''); setSelectedGrade(''); setGradeTouched(false); }}
                                className="w-full p-3 rounded-lg border-2 border-brand-dark/10 bg-white"
                            >
                                <option value="">{t('login.selectSyllabus')}</option>
                                {Object.values(Syllabus).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.myGrade')}</label>
                            <select
                                value={selectedGrade}
                                onChange={e => { setSelectedGrade(e.target.value); setGradeTouched(true); }}
                                disabled={!selectedSyllabus}
                                className="w-full p-3 rounded-lg border-2 border-brand-dark/10 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">{selectedSyllabus ? t('login.selectGrade') : t('login.chooseSyllabusFirst')}</option>
                                {gradeOptions.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                            {gradeWasSuggested && (
                                <p className="text-xs text-brand-blue/80 mt-1">{t('login.gradeSuggested')}</p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">
                            {isSignUp ? t('login.emailAddress') : t('login.emailOrName')}
                        </label>
                        <input type="text" value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full p-3 rounded-lg border-2 border-brand-dark/10"
                            placeholder={isSignUp ? t('login.emailSignupPlaceholder') : t('login.emailOrName')} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-brand-dark/50 mb-1">{t('login.password')}</label>
                        <PasswordInput value={password} onChange={setPassword} onEnter={handleSubmit} />
                        {/* Forgot password link — below the password field */}
                        {!isSignUp && (
                            <div className="text-right mt-1.5">
                                <button
                                    type="button"
                                    onClick={() => { setFpEmail(email); setFpError(''); setView('forgot_email'); }}
                                    className="text-xs font-bold text-brand-blue hover:underline"
                                >
                                    {t('login.forgotPassword')}
                                </button>
                            </div>
                        )}
                    </div>

                    <Button fullWidth onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? t('login.signUp') : t('login.logIn'))}
                    </Button>

                    <div className="text-center text-sm pt-2">
                        <span className="text-brand-dark/50">{isSignUp ? t('login.alreadyHaveAccount') : t('login.newHere')}</span>
                        <button onClick={() => setIsSignUp(!isSignUp)} className="font-bold text-brand-blue ml-1 hover:underline">
                            {isSignUp ? t('login.logIn') : t('login.createAccount')}
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
