import { createContext } from 'react';
import { User } from '../types';

/** Options for creating an account. `birthday` is 'YYYY-MM-DD' and is required by the server. */
export interface SignupOptions {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'teacher';
    grade?: string;
    syllabus?: string;
    birthday?: string;
    phone?: string;
}

export interface AuthContextType {
    user: User | null;
    login: (identifier: string, password?: string) => Promise<boolean | { needsVerification: true; email: string }>;
    signup: (options: SignupOptions) => Promise<boolean | { needsVerification: true; email: string }>;
    verifyCode: (email: string, code: string) => Promise<boolean>;
    resendCode: (email: string) => Promise<boolean>;
    logout: () => void;
    subscribe: () => Promise<void>;
    cancelSubscription: () => Promise<boolean>;
    reactivateSubscription: () => Promise<boolean>;
    refreshUser: () => Promise<void>;
    /** Parent accounts: switch the session into one child profile (child-scoped token). */
    switchProfile: (childId: string) => Promise<boolean>;
    /** Return from a child profile to the parent session. */
    exitProfile: () => Promise<void>;
    /** The parent's own token while acting as a child, otherwise the current token. */
    familyToken: () => string | null;
    isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
