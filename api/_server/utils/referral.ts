// Tiered referral programme.
//
// A referral CONVERTS when the referred user makes their first successful
// payment. The referrer's running count of converted referrals selects a tier;
// the tier amount is split into monthly instalments that are released into the
// referrer's `referralCreditCents` (which checkout already spends as a discount).
// Instalment 1 is credited at conversion; later ones are released lazily by
// `releaseDueInstalments` (called from /auth/me and checkout) — no cron needed.
//
// Tiers are admin-editable (ReferralTier table); DEFAULT_TIERS apply until the
// admin saves a table. The "tiered" toggle (AppSetting 'referral.tiered') off
// means every referral pays the first tier.

import prisma from '../db.js';

export interface TierDef {
    minCount: number;        // first converted referral this tier covers (1-based)
    maxCount: number | null; // null = no upper bound
    amountCents: number;
    splitMonths: number;
}

export const DEFAULT_TIERS: TierDef[] = [
    { minCount: 1, maxCount: 25, amountCents: 10000, splitMonths: 2 },
    { minCount: 26, maxCount: 100, amountCents: 20000, splitMonths: 4 },
    { minCount: 101, maxCount: 150, amountCents: 30000, splitMonths: 5 },
    { minCount: 151, maxCount: null, amountCents: 50000, splitMonths: 5 },
];

export const getSetting = async (key: string, fallback: string): Promise<string> => {
    try {
        const row = await prisma.appSetting.findUnique({ where: { key } });
        return row?.value ?? fallback;
    } catch {
        return fallback;
    }
};

export const isTieredEnabled = async (): Promise<boolean> =>
    (await getSetting('referral.tiered', 'true')) === 'true';

export const getTiers = async (): Promise<TierDef[]> => {
    try {
        const rows = await prisma.referralTier.findMany({ orderBy: { sortOrder: 'asc' } });
        if (rows.length) {
            return rows.map(r => ({ minCount: r.minCount, maxCount: r.maxCount, amountCents: r.amountCents, splitMonths: r.splitMonths }));
        }
    } catch (e: any) {
        console.warn(`[REFERRAL] Tier lookup failed (${e.message}); using defaults`);
    }
    return DEFAULT_TIERS;
};

/** The tier that the Nth converted referral (1-based) falls into. */
export const tierFor = (tiers: TierDef[], tiered: boolean, paidCount: number): TierDef => {
    if (!tiered || tiers.length === 0) return tiers[0] ?? DEFAULT_TIERS[0];
    return tiers.find(t => paidCount >= t.minCount && (t.maxCount === null || paidCount <= t.maxCount))
        ?? tiers[tiers.length - 1];
};

const addMonths = (d: Date, n: number): Date => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
};

/** Credit every instalment of this referrer's that has come due. Returns sen released. */
export const releaseDueInstalments = async (userId: string): Promise<number> => {
    try {
        const due = await prisma.referralInstalment.findMany({
            where: { creditedAt: null, dueDate: { lte: new Date() }, earning: { referrerId: userId } },
        });
        let total = 0;
        for (const inst of due) {
            // Claim first (guarded update) so two concurrent requests cannot double-credit.
            const claimed = await prisma.referralInstalment.updateMany({
                where: { id: inst.id, creditedAt: null },
                data: { creditedAt: new Date() },
            });
            if (claimed.count === 0) continue;
            await prisma.user.update({ where: { id: userId }, data: { referralCreditCents: { increment: inst.amountCents } } });
            total += inst.amountCents;
        }
        if (total > 0) console.log(`[REFERRAL] Released RM${(total / 100).toFixed(2)} of due instalments to ${userId}`);
        return total;
    } catch (e: any) {
        console.error('[REFERRAL] releaseDueInstalments failed:', e.message);
        return 0;
    }
};

/** Record a converted referral and credit its first instalment. Idempotent per referred user. */
export const grantReferralEarning = async (referrerId: string, referredUserId: string) => {
    const existing = await prisma.referralEarning.findUnique({ where: { referredUserId } });
    if (existing) return existing;

    const [tiers, tiered, priorCount] = await Promise.all([
        getTiers(),
        isTieredEnabled(),
        prisma.referralEarning.count({ where: { referrerId } }),
    ]);
    const tier = tierFor(tiers, tiered, priorCount + 1);
    const n = Math.max(1, tier.splitMonths);
    const base = Math.floor(tier.amountCents / n);
    const now = new Date();
    const instalments = Array.from({ length: n }, (_, i) => ({
        dueDate: addMonths(now, i),
        amountCents: i === n - 1 ? tier.amountCents - base * (n - 1) : base, // remainder on the last
        creditedAt: i === 0 ? now : null,
    }));

    const earning = await prisma.referralEarning.create({
        data: {
            referrerId,
            referredUserId,
            tierAmountCents: tier.amountCents,
            splitMonths: n,
            instalments: { create: instalments },
        },
    });
    await prisma.user.update({ where: { id: referrerId }, data: { referralCreditCents: { increment: instalments[0].amountCents } } });
    console.log(`[REFERRAL] Conversion #${priorCount + 1} for ${referrerId}: RM${(tier.amountCents / 100).toFixed(2)} over ${n} month(s); RM${(instalments[0].amountCents / 100).toFixed(2)} credited now`);
    return earning;
};

/**
 * Called on a payer's successful payment. If they were referred and their
 * referral hasn't converted yet, grant the referrer's earning and flag the
 * payer so this fires exactly once (renewals never re-trigger it).
 */
export const settleReferralGrant = async (payerId: string): Promise<void> => {
    try {
        const payer = await prisma.user.findUnique({
            where: { id: payerId },
            select: { referredById: true, referralRewardGranted: true },
        });
        if (!payer?.referredById || payer.referralRewardGranted) return;
        const referrer = await prisma.user.findUnique({ where: { id: payer.referredById }, select: { id: true } });
        if (referrer) {
            await grantReferralEarning(referrer.id, payerId);
        } else {
            console.warn(`[REFERRAL] Referrer ${payer.referredById} not found; flagging ${payerId} to avoid retries.`);
        }
        await prisma.user.update({ where: { id: payerId }, data: { referralRewardGranted: true } });
    } catch (e: any) {
        console.error('[REFERRAL] settleReferralGrant failed:', e.message);
    }
};

/** Summary for the referrer's own profile page. */
export const referralStatsFor = async (userId: string) => {
    const [earnings, tiers, tiered] = await Promise.all([
        prisma.referralEarning.findMany({ where: { referrerId: userId }, include: { instalments: true } }),
        getTiers(),
        isTieredEnabled(),
    ]);
    let totalEarnedCents = 0, creditedCents = 0, pendingCents = 0;
    let nextDue: Date | null = null;
    for (const e of earnings) {
        totalEarnedCents += e.tierAmountCents;
        for (const i of e.instalments) {
            if (i.creditedAt) creditedCents += i.amountCents;
            else {
                pendingCents += i.amountCents;
                if (!nextDue || i.dueDate < nextDue) nextDue = i.dueDate;
            }
        }
    }
    const paidReferrals = earnings.length;
    return {
        paidReferrals,
        tier: tierFor(tiers, tiered, paidReferrals + 1), // what the NEXT conversion pays
        tiered,
        totalEarnedCents,
        creditedCents,
        pendingCents,
        nextDue,
    };
};
