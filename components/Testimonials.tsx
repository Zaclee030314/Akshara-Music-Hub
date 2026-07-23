import React from 'react';
import { Star, Quote } from 'lucide-react';
import { Card } from './Card';
import { useT } from '../contexts/LanguageContext';

const REVIEWS = [
    {
        name: 'Sarah Tan',
        roleKey: 'testimonials.review1.role',
        textKey: 'testimonials.review1.text',
        rating: 5,
        avatar: '👩‍🎓'
    },
    {
        name: 'Ahmad Rafiq',
        roleKey: 'testimonials.review2.role',
        textKey: 'testimonials.review2.text',
        rating: 5,
        avatar: '👨‍🎓'
    },
    {
        name: 'Mrs. Lim',
        roleKey: 'testimonials.review3.role',
        textKey: 'testimonials.review3.text',
        rating: 5,
        avatar: '👩‍🏫'
    }
];

export const Testimonials: React.FC = () => {
    const { t } = useT();
    return (
        <section id="reviews" className="py-24 px-4 max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-4xl md:text-5xl font-display font-bold text-brand-dark">{t('testimonials.title')}</h2>
                <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="text-brand-orange fill-brand-orange" size={24} />
                    ))}
                </div>
                <p className="text-brand-dark/50 font-bold">{t('testimonials.rating')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {REVIEWS.map((review, idx) => (
                    <Card key={idx} className="p-10 scale-100 hover:scale-105 transition-transform duration-300 relative">
                        <Quote className="absolute top-6 right-6 text-brand-orange/10" size={64} />
                        <div className="space-y-6 relative z-10">
                            <div className="flex gap-1">
                                {[...Array(review.rating)].map((_, i) => (
                                    <Star key={i} className="text-brand-orange fill-brand-orange" size={16} />
                                ))}
                            </div>
                            <p className="text-lg text-brand-dark/80 italic leading-relaxed font-medium">"{t(review.textKey)}"</p>
                            <div className="flex items-center gap-4 pt-4 border-t border-brand-dark/5">
                                <div className="w-12 h-12 bg-brand-orange/10 rounded-full flex items-center justify-center text-2xl">
                                    {review.avatar}
                                </div>
                                <div>
                                    <h4 className="font-bold text-brand-dark">{review.name}</h4>
                                    <p className="text-sm text-brand-dark/50">{t(review.roleKey)}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </section>
    );
};
