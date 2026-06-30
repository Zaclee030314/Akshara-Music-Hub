import React from 'react';
import { Star, Quote } from 'lucide-react';
import { Card } from './Card';

const REVIEWS = [
    {
        name: 'Sarah Tan',
        role: 'Form 5 Student',
        text: 'Akshara Music Hub made Sejarah fun! The AI explanations actually help me understand the causes of historical events, not just memorize dates.',
        rating: 5,
        avatar: '👩‍🎓'
    },
    {
        name: 'Ahmad Rafiq',
        role: 'Standard 6 Student',
        text: 'I used to struggle with Math, but the gamified quests make me want to practice every day. I reached level 15 last week!',
        rating: 5,
        avatar: '👨‍🎓'
    },
    {
        name: 'Mrs. Lim',
        role: 'Parent',
        text: 'A great way to keep my kids engaged with their school syllabus. The KSSR alignment gives me peace of mind.',
        rating: 5,
        avatar: '👩‍🏫'
    }
];

export const Testimonials: React.FC = () => {
    return (
        <section id="reviews" className="py-24 px-4 max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-4xl md:text-5xl font-display font-bold text-brand-dark">What our heroes say</h2>
                <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="text-brand-orange fill-brand-orange" size={24} />
                    ))}
                </div>
                <p className="text-brand-dark/50 font-bold">4.9/5 based on 2,000+ reviews</p>
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
                            <p className="text-lg text-brand-dark/80 italic leading-relaxed font-medium">"{review.text}"</p>
                            <div className="flex items-center gap-4 pt-4 border-t border-brand-dark/5">
                                <div className="w-12 h-12 bg-brand-orange/10 rounded-full flex items-center justify-center text-2xl">
                                    {review.avatar}
                                </div>
                                <div>
                                    <h4 className="font-bold text-brand-dark">{review.name}</h4>
                                    <p className="text-sm text-brand-dark/50">{review.role}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </section>
    );
};
