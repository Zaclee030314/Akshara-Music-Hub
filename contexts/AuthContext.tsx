import React, { useState, useEffect, useContext } from 'react';
import { User } from '../types';
import { AuthContext, AuthContextType } from './AuthContextTypes';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing token
        const token = localStorage.getItem('quest_token');
        if (token) {
            // Verify token with backend
            fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Invalid token');
                })
                .then(data => {
                    setUser(data.user);
                })
                .catch(err => {
                    console.error("Session restore failed", err);
                    localStorage.removeItem('quest_token');
                    setUser(null);
                })
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const signup = async (name: string, email: string, password: string, role: 'student' | 'teacher', grade?: string, syllabus?: string): Promise<boolean | { needsVerification: true; email: string }> => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role, grade, syllabus })
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Signup failed');
                setIsLoading(false);
                return false;
            }
            setIsLoading(false);
            return { needsVerification: true, email: data.email || email };
        } catch (error) {
            console.error(error);
            alert('Signup failed');
            setIsLoading(false);
            return false;
        }
    };

    const verifyCode = async (email: string, code: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Verification failed');
                setIsLoading(false);
                return false;
            }
            setUser(data.user);
            localStorage.setItem('quest_token', data.token);
            localStorage.setItem('quest_user_role', JSON.stringify({ role: data.user.role, isAdmin: data.user.isAdmin }));
            setIsLoading(false);
            return true;
        } catch (error) {
            console.error(error);
            alert('Verification failed');
            setIsLoading(false);
            return false;
        }
    };

    const login = async (identifier: string, password?: string): Promise<boolean | { needsVerification: true; email: string }> => {
        setIsLoading(true);
        if (!password) {
            alert("Backend requires password login.");
            setIsLoading(false);
            return false;
        }

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.needsVerification) {
                    setIsLoading(false);
                    return { needsVerification: true, email: data.email };
                }
                alert(data.error || 'Login failed');
                setIsLoading(false);
                return false;
            }
            setUser(data.user);
            localStorage.setItem('quest_token', data.token);
            localStorage.setItem('quest_user_role', JSON.stringify({ role: data.user.role, isAdmin: data.user.isAdmin }));
            setIsLoading(false);
            return true;
        } catch (error) {
            console.error(error);
            alert('Login failed');
            setIsLoading(false);
            return false;
        }
    };

    const resendCode = async (email: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/resend-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) {
                alert('New verification code sent to your email.');
                setIsLoading(false);
                return true;
            }
            alert(data.error || 'Failed to resend code');
            setIsLoading(false);
            return false;
        } catch (error) {
            console.error(error);
            alert('Failed to resend code');
            setIsLoading(false);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('quest_token');
        localStorage.removeItem('quest_user');
        localStorage.removeItem('quest_user_role');
    };

    const subscribe = async () => {
        if (!user) return;
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1500));

        const updatedUser = { ...user, isSubscribed: true };

        // Update Session
        setUser(updatedUser);
        localStorage.setItem('quest_user', JSON.stringify(updatedUser));

        // Update DB
        const existingUsersStr = localStorage.getItem('quest_db_users');
        if (existingUsersStr) {
            const existingUsers: User[] = JSON.parse(existingUsersStr);
            const index = existingUsers.findIndex(u => u.id === user.id);
            if (index !== -1) {
                existingUsers[index] = updatedUser;
                localStorage.setItem('quest_db_users', JSON.stringify(existingUsers));
            }
        }

        setIsLoading(false);
    };

    const cancelSubscription = async (): Promise<boolean> => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch('/api/subscription/cancel-subscription', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    // Update user state
                    if (user) {
                        setUser({ ...user, isSubscribed: false });
                    }
                    setIsLoading(false);
                    return true;
                }
            }
            const err = await res.json();
            alert(`Cancellation failed: ${err.error || 'Unknown error'}`);
        } catch (e) {
            console.error(e);
            alert("Error cancelling subscription");
        } finally {
            setIsLoading(false);
        }
        return false;
    };

    const refreshUser = async () => {
        const token = localStorage.getItem('quest_token');
        if (!token) return;
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            }
        } catch (error) {
            console.error("Refresh failed", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, verifyCode, resendCode, logout, subscribe, cancelSubscription, refreshUser, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};


