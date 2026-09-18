import prisma from '../db.js';
// ─── Family profiles ─────────────────────────────────────────────────────────
//
// A family is ONE parent account (role 'parent', the only row with a real login)
// plus one or more child profiles: ordinary `User` rows with role 'student' and
// `parentId` set. Children have a synthetic e-mail and never log in themselves;
// the parent "switches" into a child with a child-scoped token (see routes/family.ts).
//
// Everything that gates on a subscription must look at the PARENT row, because
// child rows are never subscribed directly. `effectiveSubscription()` is that
// single lookup and is used by every gate (quest generation, study plans, quest
// creation, /auth/me, subscription status).
export const CHILD_EMAIL_DOMAIN = 'profiles.akshara.local';
export const childEmailFor = (id) => `child.${id}@${CHILD_EMAIL_DOMAIN}`;
export const isChildEmail = (email) => !!email && email.toLowerCase().endsWith(`@${CHILD_EMAIL_DOMAIN}`);
export const MAX_PROFILES = 10;
/** The account that pays: the parent for a child profile, otherwise the user itself. */
export async function billingAccountId(userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { parentId: true } });
    return u?.parentId || userId;
}
/** Active (non-archived) child profiles of a parent, oldest first — this order defines seat coverage. */
export async function activeChildren(parentId) {
    return prisma.user.findMany({
        where: { parentId, archivedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
            id: true, name: true, avatar: true, grade: true, gradeSyllabus: true,
            birthday: true, xp: true, coins: true, createdAt: true, profileCompleted: true
        }
    });
}
/** Monthly add-on for every learner beyond the first (sen). Same on both plans. */
export const EXTRA_CHILD_CENTS = 4500;
/** Plan price covers the first learner; each additional active profile adds RM45. */
export const familyPriceCents = (unitCents, seats) => unitCents + EXTRA_CHILD_CENTS * Math.max(0, seats - 1);
/** Learner seats a checkout must charge for: the parent's active profiles (at least 1). */
export async function seatCountFor(userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, parentId: true } });
    if (!u || u.role !== 'parent')
        return 1;
    const n = await prisma.user.count({ where: { parentId: userId, archivedAt: null } });
    return Math.max(1, n);
}
const SUB_SELECT = {
    id: true, parentId: true, isSubscribed: true, subscriptionInterval: true,
    subscriptionStartDate: true, subscriptionEndDate: true, subscriptionLevel: true,
    subscribedSyllabus: true, cancelAtPeriodEnd: true, questsPlayed: true,
    questsCreated: true, subscriptionSeats: true
};
export async function effectiveSubscription(userId) {
    const own = await prisma.user.findUnique({ where: { id: userId }, select: SUB_SELECT });
    if (!own)
        return null;
    if (!own.parentId) {
        return {
            billingId: own.id,
            isSubscribed: own.isSubscribed,
            subscriptionInterval: own.subscriptionInterval,
            subscriptionStartDate: own.subscriptionStartDate,
            subscriptionEndDate: own.subscriptionEndDate,
            subscriptionLevel: own.subscriptionLevel,
            subscribedSyllabus: own.subscribedSyllabus,
            cancelAtPeriodEnd: own.cancelAtPeriodEnd,
            questsPlayed: own.questsPlayed,
            questsCreated: own.questsCreated,
            seats: own.subscriptionSeats,
            seatIndex: null,
            seatCovered: true,
            isChild: false,
            parentId: null
        };
    }
    const parent = await prisma.user.findUnique({ where: { id: own.parentId }, select: SUB_SELECT });
    if (!parent) {
        // Orphaned child (parent deleted) — treat as an unsubscribed standalone account.
        return {
            billingId: own.id, isSubscribed: false, subscriptionInterval: null, subscriptionStartDate: null,
            subscriptionEndDate: null, subscriptionLevel: null, subscribedSyllabus: null, cancelAtPeriodEnd: false,
            questsPlayed: own.questsPlayed, questsCreated: own.questsCreated, seats: 0, seatIndex: null,
            seatCovered: false, isChild: true, parentId: own.parentId
        };
    }
    const siblings = await prisma.user.findMany({
        where: { parentId: parent.id, archivedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true }
    });
    const seatIndex = siblings.findIndex(s => s.id === own.id);
    const seatCovered = seatIndex >= 0 && seatIndex < parent.subscriptionSeats;
    return {
        billingId: parent.id,
        isSubscribed: parent.isSubscribed && seatCovered,
        subscriptionInterval: parent.subscriptionInterval,
        subscriptionStartDate: parent.subscriptionStartDate,
        subscriptionEndDate: parent.subscriptionEndDate,
        subscriptionLevel: parent.subscriptionLevel,
        subscribedSyllabus: parent.subscribedSyllabus,
        cancelAtPeriodEnd: parent.cancelAtPeriodEnd,
        questsPlayed: parent.questsPlayed,
        questsCreated: parent.questsCreated,
        seats: parent.subscriptionSeats,
        seatIndex: seatIndex < 0 ? null : seatIndex,
        seatCovered,
        isChild: true,
        parentId: parent.id
    };
}
/** Count a free-tier quest against the family's shared allowance. */
export async function countFreeQuest(userId) {
    const billingId = await billingAccountId(userId);
    await prisma.user.update({ where: { id: billingId }, data: { questsPlayed: { increment: 1 } } });
}
