import prisma from '../db.js';

// Compute the effective status of a season without requiring manual status flips.
export const effectiveStatus = (
    season: { status: string; startDate: Date; endDate: Date },
    now: Date
): string => {
    if (season.status === 'finalized') return 'finalized';
    if (now < season.startDate) return 'upcoming';
    if (now <= season.endDate) return 'active';
    return 'ended';
};

// Sum per-user season points across a date window using the legacy-safe rule:
// legacy Result rows have xpAwarded=0 and were never backfilled, so rows where
// grade IS NULL AND xpAwarded === 0 are worth their `score`; everything else uses xpAwarded.
// Students only.
export const seasonScores = async (
    start: Date,
    end: Date
): Promise<Array<{ userId: string; points: number }>> => {
    const results = await prisma.result.findMany({
        where: { date: { gte: start, lte: end }, user: { role: 'student' } },
        select: { userId: true, score: true, xpAwarded: true, grade: true },
    });
    const totals = new Map<string, number>();
    for (const r of results) {
        const pts = (r.grade === null && r.xpAwarded === 0) ? r.score : r.xpAwarded;
        totals.set(r.userId, (totals.get(r.userId) || 0) + pts);
    }
    return Array.from(totals.entries())
        .map(([userId, points]) => ({ userId, points }))
        .sort((a, b) => b.points - a.points);
};

// Resolve the single "live" season whose [startDate,endDate] window contains `now`
// and which has not been finalized. If multiple overlap, prefer the latest start.
export const getActiveSeason = async (now: Date) => {
    const seasons = await prisma.season.findMany({
        where: {
            status: { not: 'finalized' },
            startDate: { lte: now },
            endDate: { gte: now },
        },
        orderBy: { startDate: 'desc' },
    });
    return seasons[0] || null;
};

// Sum a single user's points within the currently-active season.
// Returns 0 when there's no active season (XP "resets" between seasons).
export const getUserSeasonXp = async (userId: string, now: Date): Promise<number> => {
    const season = await getActiveSeason(now);
    if (!season) return 0;
    const results = await prisma.result.findMany({
        where: { userId, date: { gte: season.startDate, lte: season.endDate } },
        select: { score: true, xpAwarded: true, grade: true },
    });
    let total = 0;
    for (const r of results) {
        total += (r.grade === null && r.xpAwarded === 0) ? r.score : r.xpAwarded;
    }
    return total;
};
