import express from 'express';
import Stripe from 'stripe';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../db.js';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Create Payment Intent for Embedded Form
router.post('/create-payment-intent', authenticateToken, async (req: any, res: any) => {
    const user = req.user;
    const { amount, currency, interval, planLevel, syllabus } = req.body;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const isMockMode = !secretKey.startsWith('sk_') || process.env.STRIPE_MOCK_MODE === 'true';

    // Promo prices actually charged (MYR cents). Full prices are marketing strikethroughs on the frontend.
    const PRICE_TABLE: Record<string, number> = { single: 5990, all: 9990 };
    let finalAmount = PRICE_TABLE[planLevel] ?? PRICE_TABLE.single;
    // Charged currency is always MYR regardless of client-detected display currency.
    const finalCurrency = 'myr';

    // ─── REDEEM: apply the paying user's own accumulated referral credit as a discount ───
    // Load the user's spendable balance and apply as much as possible while keeping the
    // charge at or above Stripe's minimum. `applied` is what we actually discount now; it is
    // only decremented from the balance on successful activation in confirm-payment.
    const STRIPE_MIN = 200; // 2.00 MYR floor so the charge stays valid
    let appliedCredit = 0;
    try {
        const payer = await prisma.user.findUnique({
            where: { id: user.id },
            select: { referralCreditCents: true }
        });
        const balance = payer?.referralCreditCents ?? 0;
        appliedCredit = Math.max(0, Math.min(balance, finalAmount - STRIPE_MIN));
        finalAmount -= appliedCredit;
    } catch (creditErr) {
        console.error('[SUBSCRIPTION] Failed to load referral credit, charging full price:', creditErr);
        appliedCredit = 0;
    }

    if (isMockMode) {
        console.warn(`⚠️ STRIPE MOCK MODE ENABLED. Processing ${finalCurrency.toUpperCase()} ${finalAmount / 100} (${interval || 'month'})${appliedCredit > 0 ? ` [referral credit -${appliedCredit / 100}]` : ''}`);
        return res.json({
            clientSecret: `mock_secret_${Date.now()}`,
            amount: finalAmount,
            appliedCredit,
            interval: interval || 'month',
            planLevel: planLevel || 'single',
            syllabus: syllabus || null,
            isMock: true
        });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: finalAmount,
            currency: finalCurrency,
            payment_method_types: ['card'],
            metadata: {
                userId: user.id,
                planLevel: planLevel || 'single',
                syllabus: syllabus || '',
                appliedCredit: String(appliedCredit)
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            amount: finalAmount,
            appliedCredit,
            isMock: false
        });
    } catch (error: any) {
        console.error("Stripe Intent Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Update Subscription after successful payment intent
router.post('/confirm-payment', authenticateToken, async (req: any, res: any) => {
    const { paymentIntentId, interval, planLevel, syllabus } = req.body;
    const userId = req.user?.id;

    if (!paymentIntentId || !userId) return res.status(400).json({ error: 'Missing data' });

    const STRIPE_MIN = 200;
    const PRICE_TABLE: Record<string, number> = { single: 5990, all: 9990 };

    // Load the paying user up-front so we can (a) grant the referrer's reward exactly once
    // and (b) decrement any referral credit the payer applied at checkout.
    const payer = await prisma.user.findUnique({ where: { id: userId } });
    if (!payer) return res.status(404).json({ error: 'User not found' });

    // Referral bookkeeping — runs AFTER the subscription is activated (isSubscribed=true).
    //  DECREMENT: subtract the credit the payer actually applied to this checkout from their own balance.
    //  GRANT:     if this user was referred and hasn't triggered a grant yet, give the referrer
    //             RM5 (500 sen) and flag this user so it fires exactly once — even across renewals.
    // The GRANT credits `referredById` (a different user); the DECREMENT touches only the payer,
    // so the two steps never collide. NOTE: replicate the GRANT logic in webhooks.ts if real
    // recurring Stripe billing is adopted.
    const settleReferral = async (appliedCredit: number) => {
        // DECREMENT the payer's own applied credit (clamped so the balance never goes negative).
        if (appliedCredit > 0) {
            const decrementBy = Math.min(appliedCredit, payer.referralCreditCents);
            if (decrementBy > 0) {
                try {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { referralCreditCents: { decrement: decrementBy } }
                    });
                    console.log(`[REFERRAL] Redeemed ${decrementBy / 100} MYR credit for payer ${userId}`);
                } catch (decErr) {
                    console.error('[REFERRAL] Failed to decrement applied credit:', decErr);
                }
            }
        }

        // GRANT the referrer RM5, exactly once per referred student.
        if (payer.referredById && payer.referralRewardGranted === false) {
            try {
                const referrer = await prisma.user.findUnique({ where: { id: payer.referredById } });
                if (referrer) {
                    await prisma.$transaction([
                        prisma.user.update({
                            where: { id: payer.referredById },
                            data: { referralCreditCents: { increment: 500 } }
                        }),
                        prisma.user.update({
                            where: { id: userId },
                            data: { referralRewardGranted: true }
                        })
                    ]);
                    console.log(`[REFERRAL] Granted RM5 to referrer ${payer.referredById} for first payment by referred user ${userId}`);
                } else {
                    // Defensive: referrer no longer exists — still flag so we don't retry endlessly.
                    await prisma.user.update({ where: { id: userId }, data: { referralRewardGranted: true } });
                    console.warn(`[REFERRAL] Referrer ${payer.referredById} not found; flagged user ${userId} to avoid retries.`);
                }
            } catch (grantErr) {
                console.error('[REFERRAL] Failed to grant referral reward:', grantErr);
            }
        }
    };

    // Handle Mock Confirmation
    if (paymentIntentId.startsWith('mock_')) {
        const startDate = new Date();
        const endDate = new Date();

        // All subscriptions are monthly (fixed 30 days)
        endDate.setDate(endDate.getDate() + 30);

        await prisma.user.update({
            where: { id: userId },
            data: {
                isSubscribed: true,
                subscriptionInterval: interval || 'month',
                subscriptionLevel: planLevel || 'single',
                subscribedSyllabus: syllabus || null,
                subscriptionStartDate: startDate,
                subscriptionEndDate: endDate,
                cancelAtPeriodEnd: false,
                questsPlayed: 0,  // Reset counters on subscription
                questsCreated: 0
            }
        });

        // Re-derive the applied credit server-side (never trust the client) using the exact
        // formula from create-payment-intent. The payer's balance is unchanged since then, so
        // this equals what was discounted.
        const price = PRICE_TABLE[planLevel || 'single'] ?? PRICE_TABLE.single;
        const applied = Math.max(0, Math.min(payer.referralCreditCents, price - STRIPE_MIN));
        await settleReferral(applied);

        return res.json({ success: true, isMock: true });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status === 'succeeded') {
            const startDate = new Date();
            const endDate = new Date();

            // All subscriptions are monthly (fixed 30 days)
            endDate.setDate(endDate.getDate() + 30);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    isSubscribed: true,
                    subscriptionInterval: interval || 'month',
                    subscriptionLevel: (paymentIntent.metadata?.planLevel as string) || planLevel || 'single',
                    subscribedSyllabus: (paymentIntent.metadata?.syllabus as string) || syllabus || null,
                    subscriptionStartDate: startDate,
                    subscriptionEndDate: endDate,
                    cancelAtPeriodEnd: false,
                    questsPlayed: 0,  // Reset counters on subscription
                    questsCreated: 0
                }
            });

            // Authoritative applied-credit value is the one we stamped into the PaymentIntent metadata.
            const applied = parseInt((paymentIntent.metadata?.appliedCredit as string) || '0', 10) || 0;
            await settleReferral(applied);

            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Payment not successful' });
        }
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: 'Confirmation failed' });
    }
});

// Create Checkout Session (Original method)
router.post('/checkout', authenticateToken, async (req: any, res: any) => {
    const user = req.user;
    const { amount, currency, interval } = req.body;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const finalAmount = amount || 2500;
    const finalCurrency = (currency || 'myr').toLowerCase();
    const finalInterval = interval === 'year' ? 'year' : 'month';

    try {
        console.log(`Processing Real Payment: ${finalCurrency.toUpperCase()} ${finalAmount / 100} (${finalInterval})...`);

        // ONE-TIME PAYMENT (No Auto-Renewal)
        // Users must manually pay again when subscription expires
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: finalCurrency,
                        product_data: {
                            name: `Akshara Music Hub Pro - ${finalInterval === 'year' ? '1 Year' : '1 Month'} Access`,
                            description: `Unlimited Quizzes and Quest Creation for ${finalInterval === 'year' ? '1 year' : '1 month'}. No auto-renewal.`,
                        },
                        unit_amount: finalAmount,
                        // REMOVED: recurring - this makes it a one-time payment
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment', // Changed from 'subscription' to 'payment'
            success_url: `${FRONTEND_URL}?success=true&session_id={CHECKOUT_SESSION_ID}&interval=${finalInterval}`,
            cancel_url: `${FRONTEND_URL}?canceled=true`,
            client_reference_id: user.id,
            metadata: {
                userId: user.id,
                interval: finalInterval // Store interval in metadata
            }
        });

        res.json({ url: session.url });
    } catch (error: any) {
        console.error("Stripe Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Verify Payment (Simple alternative to Webhook for local dev)
router.get('/verify-session', authenticateToken, async (req: any, res: any) => {
    const { session_id, interval } = req.query;
    if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

    // Handle Simulated Session
    if (String(session_id).startsWith('mock_session')) {
        return res.json({ success: true, isSubscribed: true });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id as string);
        if (session.payment_status === 'paid') {
            const userId = req.user?.id;

            // Activate subscription
            if (userId) {
                const startDate = new Date();
                const endDate = new Date();

                // Calculate end date based on interval
                const subscriptionInterval = (session.metadata?.interval as string) || (interval as string) || 'month';
                if (subscriptionInterval === 'year') {
                    endDate.setFullYear(endDate.getFullYear() + 1);
                } else {
                    endDate.setMonth(endDate.getMonth() + 1);
                }

                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        isSubscribed: true,
                        subscriptionInterval,
                        subscriptionStartDate: startDate,
                        subscriptionEndDate: endDate,
                        cancelAtPeriodEnd: false,
                        questsPlayed: 0,  // Reset counters on subscription
                        questsCreated: 0
                    }
                });
            }
            res.json({ success: true, isSubscribed: true });
        } else {
            res.json({ success: false, status: session.payment_status });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Cancel Subscription (Deferred - keeps access until period end)
router.post('/cancel-subscription', authenticateToken, async (req: any, res: any) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const isMockMode = !secretKey.startsWith('sk_') || process.env.STRIPE_MOCK_MODE === 'true';

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (isMockMode) {
            console.log(`[MOCK] Scheduling cancellation for user: ${userId} at period end`);
            await prisma.user.update({
                where: { id: userId },
                data: { cancelAtPeriodEnd: true }
            });

            const endDate = user.subscriptionEndDate || new Date();
            return res.json({
                success: true,
                message: `Subscription will cancel on ${endDate.toLocaleDateString()}`,
                cancelAt: endDate
            });
        }

        // Real Stripe Logic
        let customerId = user.stripeCustomerId;

        // If no customerId, try to find by email
        if (!customerId) {
            const customers = await stripe.customers.list({ email: user.email, limit: 1 });
            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
            }
        }

        if (!customerId) {
            // No Stripe customer, just mark for cancellation
            await prisma.user.update({
                where: { id: userId },
                data: { cancelAtPeriodEnd: true }
            });
            const endDate = user.subscriptionEndDate || new Date();
            return res.json({
                success: true,
                message: `Subscription will cancel on ${endDate.toLocaleDateString()}`,
                cancelAt: endDate
            });
        }

        // Get active subscriptions
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1,
        });

        if (subscriptions.data.length > 0) {
            // Update Stripe subscription to cancel at period end
            await stripe.subscriptions.update(subscriptions.data[0].id, {
                cancel_at_period_end: true
            });
        }

        // Update Database - keep subscription active but mark for cancellation
        await prisma.user.update({
            where: { id: userId },
            data: { cancelAtPeriodEnd: true }
        });

        const endDate = user.subscriptionEndDate || new Date();
        res.json({
            success: true,
            message: `Subscription will cancel on ${endDate.toLocaleDateString()}. You'll have access until then.`,
            cancelAt: endDate
        });
    } catch (error: any) {
        console.error("Cancellation error:", error);
        res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
    }
});

// Check Subscription Status (checks if subscription has expired)
router.get('/check-subscription-status', authenticateToken, async (req: any, res: any) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const now = new Date();
        const endDate = user.subscriptionEndDate;

        // Check if subscription has expired (end date has passed)
        if (user.isSubscribed && endDate && now > endDate) {
            console.log(`[SUBSCRIPTION] Subscription expired for user ${userId}`);
            console.log(`[SUBSCRIPTION] End date: ${endDate.toISOString()}, Current: ${now.toISOString()}`);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    isSubscribed: false,
                    cancelAtPeriodEnd: false
                }
            });
            return res.json({
                isSubscribed: false,
                message: 'Subscription has expired',
                expiredOn: endDate
            });
        }

        // Return current subscription status
        res.json({
            isSubscribed: user.isSubscribed,
            cancelAtPeriodEnd: user.cancelAtPeriodEnd,
            subscriptionEndDate: user.subscriptionEndDate,
            subscriptionInterval: user.subscriptionInterval,
            subscriptionLevel: user.subscriptionLevel,
            subscribedSyllabus: user.subscribedSyllabus,
            questsPlayed: user.questsPlayed,
            questsCreated: user.questsCreated
        });
    } catch (error: any) {
        console.error("Status check error:", error);
        res.status(500).json({ error: error.message || 'Failed to check subscription status' });
    }
});

// Reactivate Subscription (undo cancellation before period ends)
router.post('/reactivate-subscription', authenticateToken, async (req: any, res: any) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const isMockMode = !secretKey.startsWith('sk_') || process.env.STRIPE_MOCK_MODE === 'true';

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.cancelAtPeriodEnd) {
            return res.json({ success: true, message: 'Subscription is not scheduled for cancellation' });
        }

        if (isMockMode) {
            console.log(`[MOCK] Reactivating subscription for user: ${userId}`);
            await prisma.user.update({
                where: { id: userId },
                data: { cancelAtPeriodEnd: false }
            });
            return res.json({
                success: true,
                message: 'Subscription reactivated successfully (Mock Mode)'
            });
        }

        // Real Stripe Logic
        let customerId = user.stripeCustomerId;

        // If no customerId, try to find by email
        if (!customerId) {
            const customers = await stripe.customers.list({ email: user.email, limit: 1 });
            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
            }
        }

        if (customerId) {
            // Get active subscriptions
            const subscriptions = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 1,
            });

            if (subscriptions.data.length > 0) {
                // Update Stripe subscription to NOT cancel at period end
                await stripe.subscriptions.update(subscriptions.data[0].id, {
                    cancel_at_period_end: false
                });
            }
        }

        // Update Database
        await prisma.user.update({
            where: { id: userId },
            data: { cancelAtPeriodEnd: false }
        });

        res.json({
            success: true,
            message: 'Subscription reactivated successfully. Your subscription will continue.'
        });
    } catch (error: any) {
        console.error("Reactivation error:", error);
        res.status(500).json({ error: error.message || 'Failed to reactivate subscription' });
    }
});

export default router;
