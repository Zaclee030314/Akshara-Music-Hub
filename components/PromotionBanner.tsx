import React from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { Button } from './Button';
import { useT } from '../contexts/LanguageContext';

interface PromotionBannerProps {
    onClose?: () => void;
    onAction?: () => void;
}

export const PromotionBanner: React.FC<PromotionBannerProps> = ({ onClose, onAction }) => {
    const { t } = useT();
    return (
        <div className="relative group overflow-hidden animate-in slide-in-from-top duration-700">
            <div className="bg-gradient-to-r from-brand-blue via-brand-orange to-brand-blue bg-[length:200%_auto] animate-gradient p-[1px]">
                <div className="bg-white/95 backdrop-blur-sm px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-brand-orange/10 p-1.5 rounded-lg animate-pulse">
                            <Sparkles size={18} className="text-brand-orange" />
                        </div>
                        <p className="font-bold text-sm sm:text-base text-brand-dark">
                            {t('promo.newBadge')} <span className="text-brand-orange">{t('promo.plan')}</span> {t('promo.tagline')}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onAction}
                            className="flex items-center gap-2 text-sm font-bold text-brand-blue hover:text-blue-600 transition-colors group/btn"
                        >
                            {t('promo.getDiscount')} <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                                aria-label={t('common.close')}
                            >
                                <X size={14} className="text-brand-dark/40" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 6s ease infinite;
        }
      `}</style>
        </div>
    );
};
