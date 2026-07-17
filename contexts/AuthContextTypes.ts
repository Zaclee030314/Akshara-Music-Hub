import { createContext } from 'react';
import { User } from '../types';

export interface AuthContextType {
    user: User | null;
    login: (identifier: string, password?: string) => Promise<boolean | { needsVerification: true; email: string }>;
    signup: (name: string, email: string, password: string, role: 'student' | 'teacher', grade?: string, syllabus?: string) => Promise<boolean | { needsVerification: true; email: string }>;
    verifyCode: (email: string, code: string) => Promise<boolean>;
    resendCode: (email: string) => Promise<boolean>;
    logout: () => void;
    subscribe: () => Promise<void>;
    cancelSubscription: () => Promise<boolean>;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
