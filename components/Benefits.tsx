import React from 'react';
import { BookOpen, Brain, Trophy, ShieldCheck, Zap, Heart } from 'lucide-react';
import { Card } from './Card';
import { useT } from '../contexts/LanguageContext';

const BENEFITS = [
    {
        icon: <BookOpen />,
        titleKey: 'benefits.item1.title',
        descKey: 'benefits.item1.desc',
        color: 'text-brand-blue bg-blue-100'
    },
    {
        icon: <Zap />,
        titleKey: 'benefits.item2.title',
        descKey: 'benefits.item2.desc',
        color: 'text-brand-orange bg-orange-100'
    },
    {
        icon: <Brain />,
        titleKey: 'benefits.item3.title',
        descKey: 'benefits.item3.desc',
        color: 'text-brand-green bg-green-100'
    },
    {
        icon: <Trophy />,
        titleKey: 'benefits.item4.title',
        descKey: 'benefits.item4.desc',
        color: 'text-purple-600 bg-purple-100'
    }
];

export const Benefits: React.FC = () => {
    const { t } = useT();
    return (
        <section className="py-20 bg-white/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-4xl md:text-6xl font-display font-bold text-brand-dark tracking-tight leading-none text-brand-dark">
                        {t('benefits.titlePre')} <span className="text-brand-orange">Akshara Music Hub</span> {t('benefits.titlePost')}
                    </h2>
                    <p className="text-xl text-brand-dark/60 max-w-2xl mx-auto font-medium">
                        {t('benefits.subtitle')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {BENEFITS.map((benefit, idx) => (
                        <Card
                            key={idx}
                            className={`p-10 space-y-6 hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2 border-none ring-1 ring-brand-dark/5 reveal-on-scroll delay-${(idx + 1) * 100}`}
                        >
                            <div className={`w-16 h-16 ${benefit.color} rounded-2xl flex items-center justify-center scale-110 group-hover:rotate-6 transition-transform`}>
                                {React.cloneElement(benefit.icon as React.ReactElement, { size: 32 })}
                            </div>
                            <h3 className="text-2xl font-bold">{t(benefit.titleKey)}</h3>
                            <p className="text-brand-dark/60 leading-relaxed font-medium">{t(benefit.descKey)}</p>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
};
