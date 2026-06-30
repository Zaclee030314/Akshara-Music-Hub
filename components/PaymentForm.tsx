import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    PaymentElement,
    Elements,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { Card } from './Card';
import { Button } from './Button';
import { Loader2, AlertCircle, ShieldCheck, CreditCard } from 'lucide-react';

// Only load Stripe if not in mock mode
const isMockMode = import.meta.env.VITE_STRIPE_MOCK_MODE === 'true';
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const hasValidKey = stripeKey.startsWith('pk_test_') || stripeKey.startsWith('pk_live_');

// Only create stripePromise if we have a valid key and not in mock mode
const stripePromise = (!isMockMode && hasValidKey) ? loadStripe(stripeKey) : null;

const CheckoutForm = ({ amount, onSuccess, onCancel }: { amount: number, onSuccess: () => void, onCancel: () => void }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) return;

        setLoading(true);
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/dashboard?success=true`,
            },
        });

        if (error) {
            setErrorMessage(error.message || 'An unexpected error occurred.');
            setLoading(false);
        } else {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />
            {errorMessage && (
                <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-lg text-sm font-medium border border-red-100">
                    <AlertCircle size={16} />
                    {errorMessage}
                </div>
            )}
            <div className="flex gap-3 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    fullWidth
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    fullWidth
                    disabled={!stripe || loading}
                    className="bg-brand-orange hover:bg-orange-400"
                >
                    {loading ? <Loader2 className="animate-spin" /> : `Complete Payment`}
                </Button>
            </div>
        </form>
    );
};

// Simulated Payment Form for Mock Mode
const MockPaymentForm = ({ amount, interval, planLevel, syllabus, onSuccess, onCancel, clientSecret }: { amount: number, interval: string, planLevel: string, syllabus: string | null, onSuccess: () => void, onCancel: () => void, clientSecret: string }) => {
    const [loading, setLoading] = useState(false);

    const handleSimulatePayment = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('quest_token');
            const res = await fetch('/api/subscription/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    paymentIntentId: clientSecret,
                    interval: interval,
                    planLevel: planLevel,
                    syllabus: syllabus
                })
            });

            if (res.ok) {
                setTimeout(() => {
                    onSuccess();
                }, 1500);
            } else {
                alert("Simulation failed");
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-xl text-yellow-800 text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck size={18} />
                    Simulated Test Mode
                </div>
                <p>No real Stripe keys detected. You are in safe simulation mode. No real money will be charged.</p>
            </div>

            <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl space-y-4">
                <div className="flex justify-between items-center opacity-50">
                    <span className="text-xs font-bold uppercase">Card Details</span>
                    <span className="text-xs">•••• •••• •••• 4242</span>
                </div>
                <div className="h-10 bg-gray-50 rounded-lg"></div>
            </div>

            <div className="flex gap-3 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    fullWidth
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSimulatePayment}
                    fullWidth
                    disabled={loading}
                    className="bg-brand-orange hover:bg-orange-400"
                >
                    {loading ? <Loader2 className="animate-spin" /> : `Simulate Payment`}
                </Button>
            </div>
        </div>
    );
};

export const PaymentForm = ({ amount, interval, planLevel, syllabus, clientSecret, onSuccess, onCancel }: { amount: number, interval: string, planLevel: string, syllabus: string | null, clientSecret: string, onSuccess: () => void, onCancel: () => void }) => {
    const isMock = clientSecret.startsWith('mock_');

    const options = {
        clientSecret,
        appearance: {
            theme: 'stripe' as const,
            variables: {
                colorPrimary: '#FF7E3E', // Brand orange
                colorBackground: '#ffffff',
                colorText: '#1A1A1A',
                borderRadius: '12px',
            },
        },
    };

    return (
        <Card className="max-w-md w-full p-8 shadow-2xl border-2 border-brand-orange/20 animate-pop-in">
            <div className="text-center mb-8">
                <h3 className="text-2xl font-bold font-display mb-2">Secure Payment</h3>
                <p className="text-gray-500 text-sm">{isMock ? 'Simulating Akshara Music Hub Pro Upgrade' : 'Complete your upgrade to Akshara Music Hub Pro'}</p>
            </div>

            {isMock ? (
                <MockPaymentForm amount={amount} interval={interval} planLevel={planLevel} syllabus={syllabus} onSuccess={onSuccess} onCancel={onCancel} clientSecret={clientSecret} />
            ) : (
                <Elements stripe={stripePromise} options={options}>
                    <CheckoutForm amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
                </Elements>
            )}
        </Card>
    );
};
