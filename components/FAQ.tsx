import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
    {
        q: 'Is Akshara Music Hub aligned with the Malaysian syllabus?',
        a: 'Yes! We cover the national curriculum (KSSR/KSSM), MOE Singapore, and IGCSE for most major subjects.'
    },
    {
        q: 'How does the AI Tutor work?',
        a: 'Our AI analyzes each question and provides hints or step-by-step explanations if you get stuck, helping you learn the concepts behind the answers.'
    },
    {
        q: 'Do I need a subscription to play?',
        a: 'You can try one demo quest for free as a guest. To unlock unlimited quests across all subjects, you\'ll need a Pro subscription.'
    },
    {
        q: 'Can parents and teachers track progress?',
        a: 'Absolutely! Teachers can monitor classroom sessions and Parents can track individual student progress through the Creator Dashboard.'
    }
];

export const FAQ: React.FC = () => {
    const [openIdx, setOpenIdx] = useState<number | null>(0);

    return (
        <section id="faq" className="py-24 px-4 max-w-3xl mx-auto space-y-12">
            <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-orange/10 rounded-2xl flex items-center justify-center mx-auto text-brand-orange mb-4">
                    <HelpCircle size={32} />
                </div>
                <h2 className="text-4xl font-display font-bold text-brand-dark">Frequently Asked Questions</h2>
                <p className="text-lg text-brand-dark/60">Everything you need to know about Akshara Music Hub.</p>
            </div>

            <div className="space-y-4">
                {FAQS.map((faq, idx) => (
                    <div key={idx} className="bg-white rounded-3xl overflow-hidden border-2 border-brand-dark/5">
                        <button
                            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-brand-orange/5 transition-colors"
                        >
                            <span className="text-lg font-bold text-brand-dark">{faq.q}</span>
                            <ChevronDown className={`transition-transform duration-300 ${openIdx === idx ? 'rotate-180' : ''}`} />
                        </button>
                        <div className={`transition-all duration-300 ${openIdx === idx ? 'max-h-96 opacity-100 p-6 pt-0' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                            <p className="text-brand-dark/60 leading-relaxed font-medium">{faq.a}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
