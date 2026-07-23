import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';
import { LANGS, Lang } from '../i18n/types';

interface LanguageSwitcherProps {
    /** 'compact' = desktop navbar pill; 'block' = full-width row for the mobile menu. */
    variant?: 'compact' | 'block';
    /** Optional callback fired after a language is selected (e.g. close the mobile menu). */
    onSelect?: () => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'compact', onSelect }) => {
    const { lang, setLang } = useT();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const current = LANGS.find(l => l.code === lang) ?? LANGS[0];

    // Close on outside click / Escape.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const choose = (code: Lang) => {
        setLang(code);
        setOpen(false);
        onSelect?.();
    };

    const panel = (
        <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl border border-brand-dark/10 overflow-hidden animate-pop-in z-50">
            {LANGS.map(l => (
                <button
                    key={l.code}
                    onClick={() => choose(l.code)}
                    className={`w-full text-left px-4 py-3 hover:bg-brand-blue/5 text-sm font-bold flex items-center justify-between gap-2 transition-colors ${l.code === lang ? 'text-brand-blue' : 'text-brand-dark/70 hover:text-brand-blue'}`}
                >
                    <span className="flex flex-col leading-tight">
                        <span>{l.native}</span>
                        {l.native !== l.label && <span className="text-[10px] font-medium text-brand-dark/40">{l.label}</span>}
                    </span>
                    {l.code === lang && <Check size={16} className="shrink-0" />}
                </button>
            ))}
        </div>
    );

    // Full-width block row for the mobile menu dropdown.
    if (variant === 'block') {
        return (
            <div ref={ref} className="relative">
                <button
                    onClick={() => setOpen(o => !o)}
                    className="w-full text-left px-4 py-3 rounded-xl font-bold text-brand-dark/70 hover:bg-brand-blue/5 hover:text-brand-blue transition-all text-sm flex items-center justify-between gap-2"
                >
                    <span className="flex items-center gap-2"><Globe size={16} /> {current.native}</span>
                    <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                    <div className="mt-1 rounded-xl border border-brand-dark/10 overflow-hidden bg-white">
                        {LANGS.map(l => (
                            <button
                                key={l.code}
                                onClick={() => choose(l.code)}
                                className={`w-full text-left px-4 py-2.5 text-sm font-bold flex items-center justify-between gap-2 transition-colors ${l.code === lang ? 'text-brand-blue bg-brand-blue/5' : 'text-brand-dark/70 hover:bg-brand-blue/5 hover:text-brand-blue'}`}
                            >
                                <span>{l.native}</span>
                                {l.code === lang && <Check size={16} className="shrink-0" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Compact navbar pill (desktop).
    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 bg-white/60 backdrop-blur border border-white/50 hover:bg-white px-2.5 md:px-3 py-1.5 rounded-full font-bold text-xs md:text-sm text-brand-dark/70 hover:text-brand-blue transition-all"
                aria-label="Select language"
                aria-expanded={open}
            >
                <Globe size={16} className="shrink-0" />
                <span className="hidden sm:inline max-w-[6rem] truncate">{current.native}</span>
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && panel}
        </div>
    );
};
