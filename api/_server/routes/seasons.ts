import express from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import { seasonScores, effectiveStatus, getActiveSeason } from '../utils/seasonScore.js';
import { optionalUserId } from '../utils/optionalAuth.js';

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

// A leaderboard row after identity has been attached.
type HydratedRow = {
    userId: string;
    points: number;
    rank: number;
    name: string;
    avatar: string | null;
    grade?: string | null;
};

// Hydrate a scores array with user name/avatar (and optionally grade).
const hydrateUsers = async (
    rows: Array<{ userId: string; points: number }>,
    includeGrade = false
): Promise<HydratedRow[]> => {
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

// GET /api/seasons/list — PUBLIC. Every season a student may browse: finalized,
// active, or ended-but-not-yet-finalized (upcoming seasons are hidden — they have no
// standings yet). Newest first. Feeds the season dropdown on the leaderboard.
//
// Including 'ended' seasons is deliberate: before this route an ended season that an
// admin had not yet finalized was invisible on every student surface (/history,
// lastFinalized and /latest-finalized all filter on the RAW 'finalized' status), so a
// finished competition's results silently vanished until someone pressed Finalize.
// Registered BEFORE '/:id/...' so Express doesn't read "list" as a season id.
router.get('/list', async (_req, res) => {
    try {
        const now = new Date();
        const all = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });
        const visible = all.filter(s => effectiveStatus(s, now) !== 'upcoming');

        // A season is a true snapshot only if it is finalized AND actually has frozen
        // rows — seasons finalized before SeasonStanding existed have none, and must
        // fall back to a live recompute.
        const withRows = await prisma.seasonStanding.findMany({
            where: { seasonId: { in: visible.map(s => s.id) }, rank: 1 },
            select: { seasonId: true },
        });
        const snapshotIds = new Set(withRows.map(r => r.seasonId));

        res.json(visible.map(s => ({
            id: s.id,
            name: s.name,
            startDate: s.startDate,
            endDate: s.endDate,
            status: effectiveStatus(s, now),
            isSnapshot: s.status === 'finalized' && snapshotIds.has(s.id),
        })));
    } catch (error) {
        console.error('[SEASONS] list error:', error);
        res.status(500).json({ error: 'Failed to fetch season list' });
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

        // Optionally resolve the caller from a bearer token (public route).
        let me: any = null;
        const userId = optionalUserId(req);
        if (userId) {
            const idx = scores.findIndex(s => s.userId === userId);
            if (idx >= 20) {
                const hydrated = await hydrateUsers([scores[idx]], true);
                me = { ...hydrated[0], rank: idx + 1 };
            } else if (idx >= 0) {
                me = top20[idx];
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

// GET /api/seasons/:id/standings?limit=100 — the full standings for ONE season.
// Auth is OPTIONAL (a signed-in caller also gets their own row back).
//
// A finalized season with frozen rows is served from SeasonStanding and can never
// change again. Everything else (active, ended-but-unfinalized, or a legacy season
// finalized before snapshots existed) is recomputed live and flagged as such via
// `source`, so the UI can label it "provisional".
router.get('/:id/standings', async (req, res) => {
    try {
        const { id } = req.params;
        const now = new Date();
        const parsed = parseInt(String(req.query.limit ?? ''), 10);
        const limit = Math.min(100, Math.max(1, isNaN(parsed) ? 100 : parsed));

        const season = await prisma.season.findUnique({ where: { id } });
        if (!season) return res.status(404).json({ error: 'Season not found' });

        const userId = optionalUserId(req);

        // ── Frozen snapshot ──────────────────────────────────────────────────
        if (season.status === 'finalized') {
            const rows = await prisma.seasonStanding.findMany({
                where: { seasonId: id },
                orderBy: { rank: 'asc' },
                take: limit,
            });
            if (rows.length > 0) {
                // Profile photos are IDENTITY, not history: serve the user's CURRENT
                // avatar so a changed photo follows them onto old boards. The frozen
                // SeasonStanding.avatar remains the fallback for deleted accounts.
                // (Name/rank/points stay frozen — those ARE the history.)
                const liveUsers = await prisma.user.findMany({
                    where: { id: { in: rows.map(r => r.userId) } },
                    select: { id: true, avatar: true },
                });
                const liveAvatar = new Map(liveUsers.map(u => [u.id, u.avatar]));
                const toRow = (r: typeof rows[number]) => ({
                    userId: r.userId,
                    points: r.points,
                    rank: r.rank,
                    name: r.name,
                    avatar: liveAvatar.has(r.userId) ? liveAvatar.get(r.userId) : r.avatar,
                    grade: r.grade,
                });
                // The caller's own frozen row — null if they placed outside the snapshot.
                let me: any = null;
                if (userId) {
                    const mine = await prisma.seasonStanding.findFirst({
                        where: { seasonId: id, userId },
                    });
                    if (mine) {
                        if (!liveAvatar.has(mine.userId)) {
                            const self = await prisma.user.findUnique({ where: { id: mine.userId }, select: { avatar: true } });
                            if (self) liveAvatar.set(mine.userId, self.avatar);
                        }
                        me = toRow(mine);
                    }
                }
                return res.json({
                    season: publicSeasonShape(season, now),
                    source: 'snapshot',
                    leaderboard: rows.map(toRow),
                    me,
                });
            }
            // Finalized but no frozen rows (legacy season) — fall through to live.
        }

        // ── Live recompute ───────────────────────────────────────────────────
        const scores = await seasonScores(season.startDate, season.endDate);
        const top = await hydrateUsers(scores.slice(0, limit), true);

        let me: any = null;
        if (userId) {
            const idx = scores.findIndex(s => s.userId === userId);
            if (idx >= limit) {
                const hydrated = await hydrateUsers([scores[idx]], true);
                me = { ...hydrated[0], rank: idx + 1 };
            } else if (idx >= 0) {
                me = top[idx];
            }
        }

        res.json({
            season: publicSeasonShape(season, now),
            source: 'live',
            leaderboard: top,
            me,
        });
    } catch (error) {
        console.error('[SEASONS] standings error:', error);
        res.status(500).json({ error: 'Failed to fetch season standings' });
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

// PUT /api/seasons/admin/:id — update editable fields.
//
// What is editable depends on the EFFECTIVE status, not the raw one. Previously only a
// raw 'finalized' status blocked edits, which meant a season that had already ENDED
// could still have its startDate/endDate moved — silently rewriting its standings after
// students had played. Rules now:
//   upcoming  — fully editable (nothing has happened yet)
//   active    — startDate frozen once it has begun; endDate may only move forward in
//               time; prizes still editable
//   ended     — dates and prize points/coins frozen; only cosmetic text may change
//   finalized — nothing editable
router.put('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const now = new Date();
        const existing = await prisma.season.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Season not found' });

        const status = effectiveStatus(existing, now);
        if (status === 'finalized') {
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

        // The admin form is a datetime-local input, so it round-trips dates at MINUTE
        // precision. Compare at that same granularity or an unchanged resubmit of a
        // season whose stored date carries seconds would look like an edit and be rejected.
        const sameMinute = (a: Date, b: Date) =>
            Math.floor(a.getTime() / 60000) === Math.floor(b.getTime() / 60000);
        const startChanged = !sameMinute(start, existing.startDate);
        const endChanged = !sameMinute(end, existing.endDate);

        // Did the request try to change any prize points/coins field?
        const prizeNumbers: Array<[any, number]> = [
            [secondPlacePoints, existing.secondPlacePoints],
            [thirdPlacePoints, existing.thirdPlacePoints],
            [firstPrizeCoins, existing.firstPrizeCoins],
            [secondPrizeCoins, existing.secondPrizeCoins],
            [thirdPrizeCoins, existing.thirdPrizeCoins],
        ];
        const prizeValuesChanged = prizeNumbers.some(
            ([incoming, current]) => incoming !== undefined && nonNegInt(incoming) !== current
        );

        if (status === 'ended') {
            if (startChanged || endChanged || prizeValuesChanged) {
                return res.status(400).json({
                    error: 'A season that has ended can no longer have its dates or prizes changed — finalize it instead',
                });
            }
        } else if (status === 'active') {
            if (startChanged && now >= existing.startDate) {
                return res.status(400).json({
                    error: 'A season that has already started cannot have its start date changed',
                });
            }
            if (endChanged && end <= now) {
                return res.status(400).json({
                    error: 'The end date of a running season can only be moved to a future date',
                });
            }
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

        // All READS happen before the transaction opens — an interactive transaction on
        // pooled/serverless Neon is billed wall-clock, so no query that can be hoisted
        // out of it should stay inside.
        const scores = await seasonScores(season.startDate, season.endDate);
        const top3 = scores.slice(0, 3);
        const top100 = scores.slice(0, 100);
        // Identity is read ONCE, here, and copied into SeasonStanding. From this moment
        // the season's standings are detached from the live User rows.
        const hydrated = await hydrateUsers(top100, true);

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

            // Freeze the top 100 so ranks 4+ survive the season ending, and so a later
            // rename / student→teacher flip cannot rewrite history. (The frozen avatar
            // is only a deleted-account fallback — serving re-hydrates live avatars.)
            if (hydrated.length > 0) {
                await tx.seasonStanding.createMany({
                    data: hydrated.map((h, i) => ({
                        seasonId: season.id,
                        userId: h.userId,
                        rank: i + 1,
                        points: h.points,
                        name: h.name,
                        avatar: h.avatar ?? null,
                        grade: h.grade ?? null,
                    })),
                    skipDuplicates: true,
                });
            }

            await tx.season.update({
                where: { id: season.id },
                data: { status: 'finalized', finalizedAt: now },
            });
        }, {
            // Prisma's default interactive-transaction timeout is 5s. 100 standing
            // inserts plus the winner/coin writes against a pooled Neon connection can
            // comfortably exceed that, so give it real headroom.
            timeout: 15000,
            maxWait: 10000,
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
