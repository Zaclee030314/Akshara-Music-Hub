import React from 'react';
import { MousePointerClick, Brain, Trophy } from 'lucide-react';

const STEPS = [
    {
        icon: <MousePointerClick />,
        title: 'Pick your Subject',
        description: 'Select your grade and subject. From BM to Physics, we\'ve got you covered.',
        color: 'bg-blue-500'
    },
    {
        icon: <Brain />,
        title: 'Master Quests',
        description: 'Teachers conduct sessions for class play, while Parents help students revise with step-by-step AI guidance.',
        color: 'bg-brand-orange'
    },
    {
        icon: <Trophy />,
        title: 'Track Success',
        description: 'Students level up and earn badges, while Teachers and Parents monitor progress on the dashboard.',
        color: 'bg-brand-green'
    }
];

export const HowItWorks: React.FC = () => {
    return (
        <section className="py-24 px-4 bg-brand-dark text-white rounded-[60px] mx-4 my-20">
            <div className="max-w-7xl mx-auto space-y-20">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl md:text-6xl font-display font-bold">The path to mastery</h2>
                    <p className="text-xl text-white/60 max-w-xl mx-auto">
                        Ready to start your adventure? It's as simple as 1, 2, 3.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative">
                    {/* Connecting lines for desktop */}
                    <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 -z-0" />

                    {STEPS.map((step, idx) => (
                        <div key={idx} className="relative z-10 flex flex-col items-center text-center space-y-6 group">
                            <div className={`w-24 h-24 ${step.color} rounded-full flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform duration-500`}>
                                {React.cloneElement(step.icon as React.ReactElement, { size: 40 })}
                                <div className="absolute -top-2 -right-2 w-10 h-10 bg-white text-brand-dark rounded-full flex items-center justify-center font-bold text-xl">
                                    {idx + 1}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-2xl font-bold font-display">{step.title}</h3>
                                <p className="text-white/60 leading-relaxed max-w-xs mx-auto">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
