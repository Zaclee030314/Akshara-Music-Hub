import React from 'react';
import { Rocket, Sparkles, Star } from 'lucide-react';
import { Button } from './Button';

interface HeroProps {
    onStart: () => void;
    onViewPricing: () => void;
    isLoggedIn: boolean;
    isSubscribed: boolean;
    currencyConfig: { code: string; symbol: string; amount: number; amountAll: number };
}

export const Hero: React.FC<HeroProps> = ({ onStart, onViewPricing, isLoggedIn, isSubscribed, currencyConfig }) => {
    const priceDisplay = currencyConfig?.code === 'MYR' ? 'RM20' : '$10';

    return (
        <section className="relative text-center space-y-8 py-20 sm:py-32 px-4 w-screen -ml-[50vw] left-1/2 min-h-[70vh] flex items-center justify-center flex-col overflow-hidden mt-8">
            {/* Background Image */}
            <div className="absolute inset-0 -z-20 w-full h-full">
                <img
                    src="/assets/hero-bg.jpg"
                    alt="Students studying"
                    className="w-full h-full object-cover brightness-50 object-center"
                />
            </div>

            {/* Decorative background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[600px] sm:h-[800px] bg-brand-orange/20 rounded-full blur-[120px] -z-10 animate-float mix-blend-overlay" />
            <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-brand-blue/5 rounded-full blur-[80px] -z-10 animate-float delay-500" />

            {/* Badge */}
            <div className="flex justify-center animate-reveal-up delay-100 mt-8">
                <div className="bg-white/10 backdrop-blur-md px-5 py-1.5 rounded-full shadow-md border border-white/20 text-white font-bold text-[10px] md:text-xs flex items-center gap-2 hover:scale-105 transition-transform cursor-default">
                    <Sparkles size={14} className="text-brand-orange animate-pulse" /> The Future of Smart Revision
                </div>
            </div>

            {/* Headline */}
            <div className="space-y-4 max-w-4xl mx-auto animate-reveal-up delay-200">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-white tracking-tight leading-[1.15] drop-shadow-lg">
                    Akshara Music Hub
                    <br className="hidden sm:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue via-brand-orange to-brand-green filter drop-shadow-md text-3xl sm:text-4xl mt-2 inline-block">
                        Where Music, Education & Smart Practice Meet
                    </span>
                </h1>

                <p className="text-sm sm:text-base lg:text-lg text-white/90 max-w-xl mx-auto leading-relaxed font-medium px-2 animate-reveal-up delay-300 drop-shadow-md">
                    by Akshara Fine Arts
                </p>
            </div>

            {/* CTA Buttons — centered */}
            <div className="flex flex-col items-center gap-3 pt-2 animate-reveal-up delay-400">
                <Button
                    size="lg"
                    onClick={onStart}
                    className="px-16 py-6 text-xl shadow-xl hover:scale-105 transition-transform"
                >
                    {isLoggedIn ? 'Continue Practising' : 'Start Practising Today'}
                    <Rocket className="w-5 h-5 ml-2" />
                </Button>
            </div>

            {/* Trust badges */}
            <div className="pt-10 flex flex-wrap justify-center gap-6 sm:gap-12 md:gap-16 opacity-80 hover:opacity-100 transition-all duration-500 animate-reveal-up delay-500">
                {[
                    'Trusted by 10,000+ Users',
                    'KSSR/KSSM Aligned',
                    '4.9/5 Rating',
                ].map(text => (
                    <div key={text} className="flex items-center gap-2 text-white drop-shadow-md">
                        <Star className="text-brand-orange fill-brand-orange shrink-0" size={18} />
                        <span className="font-bold text-sm">{text}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};
