import React, { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { ArrowLeft, LogIn, Mail, Loader2, KeyRound, ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, X } from 'lucide-react';
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
    const [isSignUp, setIsSignUp] = useState(false);

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
        if (!code) { alert(t('login.alertEnterCode')); return; }
        const ok = await verifyCode(email, code);
        if (ok) {
            onClose();
            navigate(postLoginPath || dashboardFor(getStoredUserRole()));
        }
    });

    const handleResend = () => wrap(async () => { await resendCode(email); });

    const handleSubmit = () => wrap(async () => {
        // Sign-up has a dedicated email field, so use the email-specific message there.
        if (!email) { alert(isSignUp ? t('login.alertValidEmail') : t('login.alertEnterEmailOrName')); return; }
        if (isSignUp && !validEmail(email)) { alert(t('login.alertValidEmail')); return; }
        if (isSignUp) {
            if (!name || !password) { alert(t('login.alertFillAll')); return; }
            if (!birthday) { alert(t('login.alertEnterBirthday')); return; }
            if (!phone.trim()) { alert(t('login.alertEnterPhone')); return; }
            if (!selectedSyllabus) { alert(t('login.alertSelectSyllabus')); return; }
            if (!selectedGrade) { alert(t('login.alertSelectGrade')); return; }
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
            if (typeof r === 'object' && r.needsVerification) { setEmail(r.email); setView('verify'); }
            else if (r === true) {
                onClose();
                navigate(postLoginPath || dashboardFor(getStoredUserRole()));
            }
        } else {
            if (!password) { alert(t('login.alertEnterPassword')); return; }
            const r = await login(email, password);
            if (typeof r === 'object' && r.needsVerification) { setEmail(r.email); setView('verify'); }
            else if (r === true) {
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <Card className="max-w-md w-full p-8 relative my-8">
                <button onClick={() => setView('login')} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <ArrowLeft size={20} />
                </button>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <Card className="max-w-md w-full p-8 relative my-8">
                <button onClick={() => { setView('login'); setFpError(''); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <ArrowLeft size={20} />
                </button>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <Card className="max-w-md w-full p-8 relative my-8">
                <button onClick={() => { setView('forgot_email'); setFpError(''); setFpOtp(''); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <ArrowLeft size={20} />
                </button>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <Card className="max-w-md w-full p-8 relative my-8">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <Card className="max-w-md w-full p-8 relative my-8">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <ArrowLeft size={20} />
                </button>
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-orange">
                        <LogIn size={32} />
                    </div>
                    <h3 className="text-2xl font-bold font-display">{isSignUp ? t('login.createAccount') : t('login.welcomeBack')}</h3>
                    <p className="text-gray-500">{isSignUp ? t('login.joinToday') : t('login.loginToContinue')}</p>
                </div>

                <div className="space-y-4">
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
                            {/* appearance-none + min-h are required: iOS Safari renders a bare
                                date input about 20px tall and unusable without them. */}
                            <input
                                type="date"
                                value={birthday}
                                max={todayISO}
                                onChange={e => setBirthday(e.target.value)}
                                className="w-full p-3 rounded-lg border-2 border-brand-dark/10 bg-white appearance-none min-h-[48px]"
                            />
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
