import React from 'react';
import { BookOpen, Facebook, Instagram, Twitter, Youtube, Mail } from 'lucide-react';
import { useT } from '../contexts/LanguageContext';

export const Footer: React.FC = () => {
    const { t } = useT();
    return (
        <footer className="bg-brand-dark text-white pt-12 pb-10 px-6 md:px-12 lg:px-20 w-full mt-auto">
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 border-b border-white/10 pb-10 md:pb-12 text-center sm:text-left">
                <div className="space-y-4 flex flex-col items-center sm:items-start col-span-1 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-2">
                        <BookOpen className="text-brand-orange w-6 h-6 md:w-7 md:h-7" />
                        <span className="font-display font-bold text-lg md:text-xl tracking-tight">Akshara Music Hub</span>
                    </div>
                    <p className="text-white/50 leading-relaxed text-xs md:text-sm max-w-xs">
                        {t('footer.tagline')}
                    </p>
                    <div className="flex gap-2">
                        <button className="w-8 h-8 md:w-9 md:h-9 bg-white/5 rounded-lg flex items-center justify-center hover:bg-brand-orange transition-colors"><Facebook size={14} className="md:w-4 md:h-4" /></button>
                        <button className="w-8 h-8 md:w-9 md:h-9 bg-white/5 rounded-lg flex items-center justify-center hover:bg-brand-orange transition-colors"><Instagram size={14} className="md:w-4 md:h-4" /></button>
                        <button className="w-8 h-8 md:w-9 md:h-9 bg-white/5 rounded-lg flex items-center justify-center hover:bg-brand-orange transition-colors"><Twitter size={14} className="md:w-4 md:h-4" /></button>
                        <button className="w-8 h-8 md:w-9 md:h-9 bg-white/5 rounded-lg flex items-center justify-center hover:bg-brand-orange transition-colors"><Youtube size={14} className="md:w-4 md:h-4" /></button>
                    </div>
                </div>

                <div className="space-y-4 md:space-y-5">
                    <h4 className="font-bold text-sm md:text-base font-display text-white/90">{t('footer.syllabus')}</h4>
                    <ul className="space-y-2 text-white/40 font-medium text-xs md:text-sm">
                        <li className="hover:text-brand-orange cursor-pointer transition-colors">{t('footer.syllabus.my')}</li>
                        <li className="hover:text-brand-orange cursor-pointer transition-colors">{t('footer.syllabus.sg')}</li>
                        <li className="hover:text-brand-orange cursor-pointer transition-colors">{t('footer.syllabus.igcse')}</li>
                        <li className="hover:text-brand-orange cursor-pointer transition-colors">{t('footer.syllabus.alevel')}</li>
                    </ul>
                </div>

                <div className="space-y-4 md:space-y-5">
                    <h4 className="font-bold text-sm md:text-base font-display text-white/90">{t('footer.company')}</h4>
                    <ul className="space-y-2 text-white/40 font-medium text-xs md:text-sm">
                        <li className="hover:text-brand-orange cursor-pointer transition-colors">{t('footer.aboutUs')}</li>
                        <li className="hover:text-brand-orange cursor-pointer transition-colors">{t('footer.ourMission')}</li>
                        <li className="hover:text-brand-orange cursor-pointer transition-colors">{t('footer.privacy')}</li>
                        <li className="hover:text-brand-orange cursor-pointer transition-colors">{t('footer.terms')}</li>
                    </ul>
                </div>

                <div className="space-y-4 md:space-y-5 col-span-1 sm:col-span-2 lg:col-span-1">
                    <h4 className="font-bold text-sm md:text-base font-display text-white/90">{t('footer.subscribe')}</h4>
                    <p className="text-white/40 font-medium text-xs md:text-sm">{t('footer.subscribeDesc')}</p>
                    <div className="flex gap-2 w-full max-w-sm mx-auto sm:mx-0">
                        <input
                            type="email"
                            placeholder={t('footer.emailPlaceholder')}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:border-brand-orange transition-colors text-xs"
                        />
                        <button className="bg-brand-orange px-3 py-1.5 rounded-lg font-bold hover:bg-orange-400 transition-colors uppercase tracking-widest text-[10px] shadow-lg">
                            <Mail size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-white/30 text-[10px] md:text-xs font-medium">
                <p>{t('footer.rights')}</p>
                <p>{t('footer.partner')}</p>
            </div>
        </footer>
    );
};
