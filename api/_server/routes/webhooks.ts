import express from 'express';
import Stripe from 'stripe';
import prisma from '../db.js';
import { settleReferralGrant } from '../utils/referral.js';
import { seatCountFor } from '../utils/family.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Stripe webhook endpoint
// This endpoint receives events from Stripe about subscription changes
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set, skipping webhook verification');
        return res.status(400).send('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[WEBHOOK] Received event: ${event.type}`);

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutSessionCompleted(session);
            break;
        }
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            await handlePaymentSucceeded(invoice);
            break;
        }
        case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionUpdated(subscription);
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(subscription);
            break;
        }
        default:
            console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

// Handle successful payment (renewal)
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    console.log(`[WEBHOOK] Payment succeeded for invoice: ${invoice.id}`);

    const customerId = typeof (invoice as any).customer === 'string' ? (invoice as any).customer : (invoice as any).customer?.id;
    const subscriptionId = typeof (invoice as any).subscription === 'string' ? (invoice as any).subscription : (invoice as any).subscription?.id;

    if (!subscriptionId) {
        console.log('[WEBHOOK] No subscription ID in invoice, skipping');
        return;
    }

    try {
        // Get the subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Check if subscription is deleted
        if ('deleted' in subscription && subscription.deleted) {
            console.log('[WEBHOOK] Subscription is deleted, skipping');
            return;
        }

        // Find user by Stripe customer ID
        const user = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId }
        });

        if (!user) {
            console.warn(`[WEBHOOK] User not found for customer: ${customerId}`);
            return;
        }

        // Cast to Subscription to access properties (we already checked for .deleted)
        const sub = subscription as Stripe.Subscription;

        // Calculate new end date based on interval
        const startDate = new Date((sub as any).current_period_start * 1000);
        const endDate = new Date((sub as any).current_period_end * 1000);
        const interval = (sub as any).items?.data[0]?.price?.recurring?.interval || 'month';

        console.log(`[WEBHOOK] Renewing subscription for user: ${user.email}`);
        console.log(`[WEBHOOK] New period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // Update user subscription dates
        await prisma.user.update({
            where: { id: user.id },
            data: {
                isSubscribed: true,
                subscriptionInterval: interval,
                subscriptionStartDate: startDate,
                subscriptionEndDate: endDate,
                cancelAtPeriodEnd: sub.cancel_at_period_end
            }
        });

        // A referred user's FIRST successful payment converts the referral (idempotent).
        await settleReferralGrant(user.id);

        console.log(`[WEBHOOK] ✅ Subscription renewed for user: ${user.email}`);
    } catch (error: any) {
        console.error('[WEBHOOK] Error handling payment succeeded:', error.message);
    }
}

// Handle subscription updates (e.g., cancellation scheduled)
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    console.log(`[WEBHOOK] Subscription updated: ${subscription.id}`);

    const customerId = subscription.customer as string;

    try {
        const user = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId }
        });

        if (!user) {
            console.warn(`[WEBHOOK] User not found for customer: ${customerId}`);
            return;
        }

        // Update cancellation status
        await prisma.user.update({
            where: { id: user.id },
            data: {
                cancelAtPeriodEnd: subscription.cancel_at_period_end
            }
        });

        if (subscription.cancel_at_period_end) {
            console.log(`[WEBHOOK] ⏰ Subscription scheduled for cancellation: ${user.email}`);
        } else {
            console.log(`[WEBHOOK] ✅ Subscription reactivated: ${user.email}`);
        }
    } catch (error: any) {
        console.error('[WEBHOOK] Error handling subscription updated:', error.message);
    }
}

// Handle subscription deletion (immediate cancellation)
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    console.log(`[WEBHOOK] Subscription deleted: ${subscription.id}`);

    const customerId = subscription.customer as string;

    try {
        const user = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId }
        });

        if (!user) {
            console.warn(`[WEBHOOK] User not found for customer: ${customerId}`);
            return;
        }

        // Cancel subscription immediately
        await prisma.user.update({
            where: { id: user.id },
            data: {
                isSubscribed: false,
                cancelAtPeriodEnd: false
            }
        });

        console.log(`[WEBHOOK] ❌ Subscription cancelled for user: ${user.email}`);
    } catch (error: any) {
        console.error('[WEBHOOK] Error handling subscription deleted:', error.message);
    }
}

// Handle successful one-time payment checkout
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    if (session.payment_status !== 'paid') return;

    const userId = session.client_reference_id || session.metadata?.userId;
    const interval = session.metadata?.interval || 'month';

    if (!userId) {
        console.warn('[WEBHOOK] No userId found in checkout session');
        return;
    }

    try {
        const startDate = new Date();
        const endDate = new Date();

        // All subscriptions are monthly (fixed 30 days)
        endDate.setDate(endDate.getDate() + 30);

        await prisma.user.update({
            where: { id: userId },
            data: {
                isSubscribed: true,
                subscriptionInterval: interval,
                subscriptionStartDate: startDate,
                subscriptionEndDate: endDate,
                subscriptionSeats: await seatCountFor(userId),
                cancelAtPeriodEnd: false
            }
        });

        console.log(`[WEBHOOK] ✅ Subscription activated via checkout for user: ${userId}`);
    } catch (error: any) {
        console.error('[WEBHOOK] Error handling checkout session completed:', error.message);
    }
}

export default router;
