import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Lang } from '../i18n/types';
import { dictionaries } from '../i18n';
import { useAuth } from './useAuth';

interface LanguageContextType {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const VALID: Lang[] = ['en', 'ms', 'zh', 'ta'];
const isLang = (v: unknown): v is Lang => typeof v === 'string' && (VALID as string[]).includes(v);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    // Initial language: localStorage override wins on first paint (user.language
    // is adopted below once auth resolves). Falls back to 'en'.
    const [lang, setLangState] = useState<Lang>(() => {
        try {
            const stored = localStorage.getItem('quest_lang');
            if (isLang(stored)) return stored;
        } catch { /* ignore */ }
        return 'en';
    });

    // Adopt the logged-in user's saved language when auth resolves / user changes.
    useEffect(() => {
        const userLang = (user as { language?: unknown } | null)?.language;
        if (isLang(userLang) && userLang !== lang) {
            setLangState(userLang);
            try { localStorage.setItem('quest_lang', userLang); } catch { /* ignore */ }
        }
        // Only react to the user object changing (login/logout/refresh).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Keep <html lang> in sync for accessibility + font selection.
    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        try { localStorage.setItem('quest_lang', l); } catch { /* ignore */ }
        document.documentElement.lang = l;

        // Persist to the backend for logged-in users (fire-and-forget).
        try {
            const token = localStorage.getItem('quest_token');
            if (token) {
                fetch('/api/profile/language', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ language: l }),
                }).catch(err => console.error('Failed to persist language', err));
            }
        } catch { /* ignore */ }
    }, []);

    const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
        let str = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
        if (vars) {
            for (const [k, v] of Object.entries(vars)) {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
        }
        return str;
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useT = (): LanguageContextType => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useT must be used within a LanguageProvider');
    return ctx;
};
