import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import { seasonScores, effectiveStatus, getActiveSeason } from '../utils/seasonScore.js';

const router = express.Router();

// Parse a coin/points field as a non-negative integer (defaults to 0).
const nonNegInt = (v: any): number => Math.max(0, parseInt(String(v ?? 0), 10) || 0);

// Middleware: require isAdmin (mirrors admin.ts pattern)
const requireAdmin = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch {
        res.status(500).json({ error: 'Server error' });
    }
};

type SeasonRow = {
    id: string;
    name: string;
    description: string | null;
    prizeTitle: string;
    prizeDetails: string | null;
    secondPlacePoints: number;
    thirdPlacePoints: number;
    secondPrizeTitle: string | null;
    thirdPrizeTitle: string | null;
    firstPrizeCoins: number;
    secondPrizeCoins: number;
    thirdPrizeCoins: number;
    startDate: Date;
    endDate: Date;
    status: string;
    createdAt: Date;
};

// Hydrate a scores array with user name/avatar (and optionally grade).
const hydrateUsers = async (
    rows: Array<{ userId: string; points: number }>,
    includeGrade = false
) => {
    const ids = rows.map(r => r.userId);
    const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, avatar: true, grade: includeGrade },
    });
    const map = new Map(users.map(u => [u.id, u]));
    return rows.map((r, i) => {
        const u = map.get(r.userId);
        return {
            userId: r.userId,
            points: r.points,
            rank: i + 1,
            name: u?.name || 'Unknown',
            avatar: u?.avatar || null,
            ...(includeGrade ? { grade: (u as any)?.grade ?? null } : {}),
        };
    });
};

// Attach hydrated winners (with user name/avatar) to a season object.
const hydrateWinners = async (seasonId: string) => {
    const winners = await prisma.seasonWinner.findMany({
        where: { seasonId },
        orderBy: { rank: 'asc' },
        include: { user: { select: { name: true, avatar: true } } },
    });
    return winners.map(w => ({
        rank: w.rank,
        userId: w.userId,
        points: w.points,
        awardedPoints: w.awardedPoints,
        prizeTitle: w.prizeTitle,
        name: w.user?.name || 'Unknown',
        avatar: w.user?.avatar || null,
    }));
};

const publicSeasonShape = (s: SeasonRow, now: Date) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    prizeTitle: s.prizeTitle,
    prizeDetails: s.prizeDetails,
    secondPlacePoints: s.secondPlacePoints,
    thirdPlacePoints: s.thirdPlacePoints,
    secondPrizeTitle: s.secondPrizeTitle,
    thirdPrizeTitle: s.thirdPrizeTitle,
    firstPrizeCoins: s.firstPrizeCoins,
    secondPrizeCoins: s.secondPrizeCoins,
    thirdPrizeCoins: s.thirdPrizeCoins,
    startDate: s.startDate,
    endDate: s.endDate,
    status: effectiveStatus(s, now),
});

// ─── PUBLIC ROUTES ───────────────────────────────────────────────────────────

// GET /api/seasons/current — the most relevant season (active preferred, else soonest upcoming)
// plus lastFinalized (with winners) and top3 of the active season.
router.get('/current', async (_req, res) => {
    try {
        const now = new Date();
        const all = await prisma.season.findMany({ orderBy: { startDate: 'asc' } });

        const active = all.find(s => effectiveStatus(s, now) === 'active') || null;
        const upcoming = all
            .filter(s => effectiveStatus(s, now) === 'upcoming')
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] || null;

        const chosen = active || upcoming;

        let top3: any[] = [];
        if (active) {
            const scores = await seasonScores(active.startDate, active.endDate);
            top3 = await hydrateUsers(scores.slice(0, 3));
        }

        // Most recently finalized season with winners
        const finalized = all
            .filter(s => s.status === 'finalized')
            .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0] || null;

        let lastFinalized: any = null;
        if (finalized) {
            lastFinalized = {
                ...publicSeasonShape(finalized, now),
                winners: await hydrateWinners(finalized.id),
            };
        }

        res.json({
            season: chosen ? publicSeasonShape(chosen, now) : null,
            top3,
            lastFinalized,
        });
    } catch (error) {
        console.error('[SEASONS] current error:', error);
        res.status(500).json({ error: 'Failed to fetch current season' });
    }
});

// GET /api/seasons/history — all finalized seasons desc by endDate, each with winners.
router.get('/history', async (_req, res) => {
    try {
        const now = new Date();
        const finalized = await prisma.season.findMany({
            where: { status: 'finalized' },
            orderBy: { endDate: 'desc' },
        });
        const seasons = await Promise.all(
            finalized.map(async s => ({
                ...publicSeasonShape(s, now),
                winners: await hydrateWinners(s.id),
            }))
        );
        res.json(seasons);
    } catch (error) {
        console.error('[SEASONS] history error:', error);
        res.status(500).json({ error: 'Failed to fetch season history' });
    }
});

// GET /api/seasons/latest-finalized — auth; most recently finalized season + winners (for popup)
router.get('/latest-finalized', authenticateToken, async (_req, res) => {
    try {
        const now = new Date();
        const finalized = await prisma.season.findMany({
            where: { status: 'finalized' },
            orderBy: { endDate: 'desc' },
            take: 1,
        });
        if (finalized.length === 0) return res.json({ season: null });
        const s = finalized[0];
        res.json({
            season: {
                ...publicSeasonShape(s, now),
                winners: await hydrateWinners(s.id),
            },
        });
    } catch (error) {
        console.error('[SEASONS] latest-finalized error:', error);
        res.status(500).json({ error: 'Failed to fetch latest finalized season' });
    }
});

// GET /api/seasons/current/leaderboard — the live season's standings (top 20).
// Auth is OPTIONAL: if a valid token is present we also return the caller's own
// standing. Registered BEFORE '/:id/leaderboard' so "current" isn't read as an :id.
router.get('/current/leaderboard', async (req, res) => {
    try {
        const now = new Date();
        const season = await getActiveSeason(now);
        if (!season) {
            return res.json({ season: null, leaderboard: [], me: null });
        }

        const scores = await seasonScores(season.startDate, season.endDate);
        const top20 = await hydrateUsers(scores.slice(0, 20), true);

        // Optionally resolve the caller from a bearer token (public route, so decode manually).
        let me: any = null;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const secret = process.env.JWT_SECRET || 'supersecretkeyshouldbeenv';
                const payload: any = jwt.verify(token, secret);
                const userId = payload?.id;
                if (userId) {
                    const idx = scores.findIndex(s => s.userId === userId);
                    if (idx >= 20) {
                        const hydrated = await hydrateUsers([scores[idx]], true);
                        me = { ...hydrated[0], rank: idx + 1 };
                    } else if (idx >= 0) {
                        me = top20[idx];
                    }
                }
            } catch {
                /* invalid/expired token — treat as anonymous */
            }
        }

        res.json({
            season: publicSeasonShape(season, now),
            leaderboard: top20,
            me,
        });
    } catch (error) {
        console.error('[SEASONS] current/leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch current season leaderboard' });
    }
});

// GET /api/seasons/:id/leaderboard — auth; top 10 + requester's own standing if outside top 10.
router.get('/:id/leaderboard', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const now = new Date();
        const season = await prisma.season.findUnique({ where: { id } });
        if (!season) return res.status(404).json({ error: 'Season not found' });

        const scores = await seasonScores(season.startDate, season.endDate);
        const top10 = await hydrateUsers(scores.slice(0, 10), true);

        // Requesting user's own standing if outside top 10
        let me: any = null;
        const userId = req.user?.id;
        if (userId) {
            const idx = scores.findIndex(s => s.userId === userId);
            if (idx >= 10) {
                const hydrated = await hydrateUsers([scores[idx]], true);
                me = { ...hydrated[0], rank: idx + 1 };
            } else if (idx >= 0) {
                me = top10[idx];
            }
        }

        res.json({
            season: publicSeasonShape(season, now),
            leaderboard: top10,
            me,
        });
    } catch (error) {
        console.error('[SEASONS] leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch season leaderboard' });
    }
});

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

// GET /api/seasons/admin/all — every season, any status, with winners.
router.get('/admin/all', authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const now = new Date();
        const all = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });
        const seasons = await Promise.all(
            all.map(async s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                prizeTitle: s.prizeTitle,
                prizeDetails: s.prizeDetails,
                secondPlacePoints: s.secondPlacePoints,
                thirdPlacePoints: s.thirdPlacePoints,
                secondPrizeTitle: s.secondPrizeTitle,
                thirdPrizeTitle: s.thirdPrizeTitle,
                firstPrizeCoins: s.firstPrizeCoins,
                secondPrizeCoins: s.secondPrizeCoins,
                thirdPrizeCoins: s.thirdPrizeCoins,
                startDate: s.startDate,
                endDate: s.endDate,
                rawStatus: s.status,
                status: effectiveStatus(s, now),
                createdAt: s.createdAt,
                winners: s.status === 'finalized' ? await hydrateWinners(s.id) : [],
            }))
        );
        res.json(seasons);
    } catch (error) {
        console.error('[SEASONS] admin/all error:', error);
        res.status(500).json({ error: 'Failed to fetch seasons' });
    }
});

// POST /api/seasons/admin — create a season.
router.post('/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name, description, prizeTitle, prizeDetails,
            secondPlacePoints, thirdPlacePoints,
            secondPrizeTitle, thirdPrizeTitle,
            firstPrizeCoins, secondPrizeCoins, thirdPrizeCoins,
            startDate, endDate,
        } = req.body;

        if (!name || !prizeTitle || !startDate || !endDate) {
            return res.status(400).json({ error: 'name, prizeTitle, startDate and endDate are required' });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid start or end date' });
        }
        if (end <= start) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        // Reject overlap with any existing non-finalized season.
        const others = await prisma.season.findMany({ where: { status: { not: 'finalized' } } });
        const overlaps = others.some(o => start <= o.endDate && end >= o.startDate);
        if (overlaps) {
            return res.status(400).json({ error: 'This date range overlaps an existing active or upcoming season' });
        }

        const season = await prisma.season.create({
            data: {
                name: String(name).trim(),
                description: description ? String(description) : null,
                prizeTitle: String(prizeTitle).trim(),
                prizeDetails: prizeDetails ? String(prizeDetails) : null,
                secondPlacePoints: nonNegInt(secondPlacePoints),
                thirdPlacePoints: nonNegInt(thirdPlacePoints),
                secondPrizeTitle: secondPrizeTitle ? String(secondPrizeTitle).trim() : null,
                thirdPrizeTitle: thirdPrizeTitle ? String(thirdPrizeTitle).trim() : null,
                firstPrizeCoins: nonNegInt(firstPrizeCoins),
                secondPrizeCoins: nonNegInt(secondPrizeCoins),
                thirdPrizeCoins: nonNegInt(thirdPrizeCoins),
                startDate: start,
                endDate: end,
            },
        });
        res.json(season);
    } catch (error) {
        console.error('[SEASONS] create error:', error);
        res.status(500).json({ error: 'Failed to create season' });
    }
});

// PUT /api/seasons/admin/:id — update editable fields (blocked once finalized).
router.put('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.season.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Season not found' });
        if (existing.status === 'finalized') {
            return res.status(400).json({ error: 'A finalized season cannot be edited' });
        }

        const {
            name, description, prizeTitle, prizeDetails,
            secondPlacePoints, thirdPlacePoints,
            secondPrizeTitle, thirdPrizeTitle,
            firstPrizeCoins, secondPrizeCoins, thirdPrizeCoins,
            startDate, endDate,
        } = req.body;

        const start = startDate !== undefined ? new Date(startDate) : existing.startDate;
        const end = endDate !== undefined ? new Date(endDate) : existing.endDate;
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid start or end date' });
        }
        if (end <= start) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        // Reject overlap with any OTHER non-finalized season.
        const others = await prisma.season.findMany({
            where: { status: { not: 'finalized' }, id: { not: id } },
        });
        const overlaps = others.some(o => start <= o.endDate && end >= o.startDate);
        if (overlaps) {
            return res.status(400).json({ error: 'This date range overlaps an existing active or upcoming season' });
        }

        const data: any = { startDate: start, endDate: end };
        if (name !== undefined) data.name = String(name).trim();
        if (description !== undefined) data.description = description ? String(description) : null;
        if (prizeTitle !== undefined) data.prizeTitle = String(prizeTitle).trim();
        if (prizeDetails !== undefined) data.prizeDetails = prizeDetails ? String(prizeDetails) : null;
        if (secondPlacePoints !== undefined) data.secondPlacePoints = nonNegInt(secondPlacePoints);
        if (thirdPlacePoints !== undefined) data.thirdPlacePoints = nonNegInt(thirdPlacePoints);
        if (secondPrizeTitle !== undefined) data.secondPrizeTitle = secondPrizeTitle ? String(secondPrizeTitle).trim() : null;
        if (thirdPrizeTitle !== undefined) data.thirdPrizeTitle = thirdPrizeTitle ? String(thirdPrizeTitle).trim() : null;
        if (firstPrizeCoins !== undefined) data.firstPrizeCoins = nonNegInt(firstPrizeCoins);
        if (secondPrizeCoins !== undefined) data.secondPrizeCoins = nonNegInt(secondPrizeCoins);
        if (thirdPrizeCoins !== undefined) data.thirdPrizeCoins = nonNegInt(thirdPrizeCoins);

        const season = await prisma.season.update({ where: { id }, data });
        res.json(season);
    } catch (error) {
        console.error('[SEASONS] update error:', error);
        res.status(500).json({ error: 'Failed to update season' });
    }
});

// POST /api/seasons/admin/:id/finalize — snapshot winners, award bonus XP, mark finalized.
router.post('/admin/:id/finalize', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const now = new Date();
        const season = await prisma.season.findUnique({ where: { id } });
        if (!season) return res.status(404).json({ error: 'Season not found' });
        if (season.status === 'finalized') {
            return res.status(400).json({ error: 'Season is already finalized' });
        }
        if (now <= season.endDate) {
            return res.status(400).json({ error: 'Season has not ended yet' });
        }

        const scores = await seasonScores(season.startDate, season.endDate);
        const top3 = scores.slice(0, 3);

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < top3.length; i++) {
                const rank = i + 1;
                // Per-rank prize is now paid in COINS (permanent currency), not XP.
                const coins = rank === 1 ? season.firstPrizeCoins
                    : rank === 2 ? season.secondPrizeCoins
                        : season.thirdPrizeCoins;
                // Snapshot the per-rank prize TEXT so it survives future season edits.
                const prizeTitle = rank === 1 ? season.prizeTitle
                    : rank === 2 ? (season.secondPrizeTitle || '')
                        : (season.thirdPrizeTitle || '');
                await tx.seasonWinner.create({
                    data: {
                        seasonId: season.id,
                        userId: top3[i].userId,
                        rank,
                        points: top3[i].points,
                        awardedPoints: coins, // reused column now means "coins awarded"
                        prizeTitle,
                    },
                });
                if (coins > 0) {
                    await tx.user.update({
                        where: { id: top3[i].userId },
                        data: { coins: { increment: coins } },
                    });
                }
            }
            await tx.season.update({ where: { id: season.id }, data: { status: 'finalized' } });
        });

        res.json({
            success: true,
            season: { ...publicSeasonShape({ ...season, status: 'finalized' }, now) },
            winners: await hydrateWinners(season.id),
        });
    } catch (error) {
        console.error('[SEASONS] finalize error:', error);
        res.status(500).json({ error: 'Failed to finalize season' });
    }
});

export default router;
