import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';

const FAQS = [
    { qKey: 'faq.q1', aKey: 'faq.a1' },
    { qKey: 'faq.q2', aKey: 'faq.a2' },
    { qKey: 'faq.q3', aKey: 'faq.a3' },
    { qKey: 'faq.q4', aKey: 'faq.a4' }
];

export const FAQ: React.FC = () => {
    const { t } = useT();
    const [openIdx, setOpenIdx] = useState<number | null>(0);

    return (
        <section id="faq" className="py-24 px-4 max-w-3xl mx-auto space-y-12">
            <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-orange/10 rounded-2xl flex items-center justify-center mx-auto text-brand-orange mb-4">
                    <HelpCircle size={32} />
                </div>
                <h2 className="text-4xl font-display font-bold text-brand-dark">{t('faq.title')}</h2>
                <p className="text-lg text-brand-dark/60">{t('faq.subtitle')}</p>
            </div>

            <div className="space-y-4">
                {FAQS.map((faq, idx) => (
                    <div key={idx} className="bg-white rounded-3xl overflow-hidden border-2 border-brand-dark/5">
                        <button
                            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-brand-orange/5 transition-colors"
                        >
                            <span className="text-lg font-bold text-brand-dark">{t(faq.qKey)}</span>
                            <ChevronDown className={`transition-transform duration-300 ${openIdx === idx ? 'rotate-180' : ''}`} />
                        </button>
                        <div className={`transition-all duration-300 ${openIdx === idx ? 'max-h-96 opacity-100 p-6 pt-0' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                            <p className="text-brand-dark/60 leading-relaxed font-medium">{t(faq.aKey)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
