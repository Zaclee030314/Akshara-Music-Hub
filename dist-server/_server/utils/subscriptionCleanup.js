import prisma from '../db.js';
/**
 * Cleanup function to run on server startup.
 * Checks all users for expired subscriptions and updates them.
 */
export async function cleanupExpiredSubscriptions() {
    console.log('[STARTUP] 🧹 Checking for expired subscriptions...');
    try {
        const now = new Date();
        // Find all users who are marked as subscribed BUT have an end date in the past
        const expiredUsers = await prisma.user.findMany({
            where: {
                isSubscribed: true,
                subscriptionEndDate: {
                    lt: now // Less than now (in the past)
                }
            }
        });
        if (expiredUsers.length === 0) {
            console.log('[STARTUP] ✅ No expired subscriptions found.');
            return;
        }
        console.log(`[STARTUP] ⚠️ Found ${expiredUsers.length} users with expired subscriptions. improving...`);
        // Batch update to expire them
        const updateResult = await prisma.user.updateMany({
            where: {
                isSubscribed: true,
                subscriptionEndDate: {
                    lt: now
                }
            },
            data: {
                isSubscribed: false,
                cancelAtPeriodEnd: false
            }
        });
        console.log(`[STARTUP] ✅ Successfully expired ${updateResult.count} subscriptions.`);
        // Log details of who was expired
        expiredUsers.forEach(user => {
            console.log(`[STARTUP] ❌ Expired user: ${user.email} (End Date: ${user.subscriptionEndDate?.toISOString()})`);
        });
    }
    catch (error) {
        console.error('[STARTUP] ❌ Error checking expired subscriptions:', error);
    }
}
