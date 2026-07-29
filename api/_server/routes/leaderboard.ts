import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';

const router = express.Router();

// Level formula shared with the dashboard / /me endpoints.
const levelFor = (xp: number) => Math.floor(xp / 1000) + 1;

// The ONE canonical ordering for the all-time board. Every rank number we hand
// out is derived from this tuple, so equal-XP students never shuffle between
// requests and the counted ranks below agree with the listed ranks.
const ORDER = [
    { xp: 'desc' as const },
    { name: 'asc' as const },
    { id: 'asc' as const },
];

const ROW_SELECT = {
    id: true,
    name: true,
    xp: true,
    avatar: true,
    grade: true,
} as const;

interface RankableRow {
    id: string;
    name: string;
    xp: number;
    avatar?: string | null;
    grade?: string | null;
}

// True GLOBAL rank of a single row = 1 + (number of students that sort strictly
// before it). The OR mirrors the ORDER tuple exactly: higher xp, or equal xp with
// an earlier name, or equal xp+name with an earlier id.
const rankOf = (u: { xp: number; name: string; id: string }): Promise<number> =>
    prisma.user
        .count({
            where: {
                role: 'student',
                OR: [
                    { xp: { gt: u.xp } },
                    { xp: u.xp, name: { lt: u.name } },
                    { xp: u.xp, name: u.name, id: { lt: u.id } },
                ],
            },
        })
        .then(n => n + 1);

const shape = (u: RankableRow, rank: number) => ({
    id: u.id,
    name: u.name,
    xp: u.xp,
    avatar: u.avatar ?? null,
    grade: u.grade ?? null,
    level: levelFor(u.xp),
    rank,
});

// GET /api/leaderboard?q=&limit=
// Public. Returns { leaderboard, me, total }.
//  - no q  → top `limit` students (default 100, clamped 1..100), ranks = index + 1
//  - with q → up to 20 name matches, each carrying its TRUE global rank
// Auth is OPTIONAL: a valid student bearer token also yields `me` (their row +
// true global rank) so a student outside the visible list can still find themselves.
router.get('/', async (req, res) => {
    try {
        const rawQ = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 50) : '';
        const q = rawQ.length > 0 ? rawQ : null;

        const parsedLimit = parseInt(String(req.query.limit ?? ''), 10);
        const limit = Number.isFinite(parsedLimit)
            ? Math.min(100, Math.max(1, parsedLimit))
            : 100;

        let leaderboard: ReturnType<typeof shape>[];

        if (q) {
            const matches = await prisma.user.findMany({
                where: { role: 'student', name: { contains: q, mode: 'insensitive' } },
                select: ROW_SELECT,
                orderBy: ORDER,
                take: 20,
            });
            const ranks = await Promise.all(matches.map(m => rankOf(m)));
            leaderboard = matches.map((m, i) => shape(m, ranks[i]));
        } else {
            const top = await prisma.user.findMany({
                where: { role: 'student' },
                select: ROW_SELECT,
                orderBy: ORDER,
                take: limit,
            });
            leaderboard = top.map((u, i) => shape(u, i + 1));
        }

        // Optional auth — public route, so decode the token manually rather than
        // gating with authenticateToken (mirrors seasons.ts GET /current/leaderboard).
        let me: ReturnType<typeof shape> | null = null;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const secret = process.env.JWT_SECRET || 'supersecretkeyshouldbeenv';
                const payload: any = jwt.verify(token, secret);
                const userId = payload?.id;
                if (userId) {
                    const self = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { ...ROW_SELECT, role: true },
                    });
                    if (self && self.role === 'student') {
                        me = shape(self, await rankOf(self));
                    }
                }
            } catch {
                /* invalid/expired token — treat as anonymous */
            }
        }

        const total = await prisma.user.count({ where: { role: 'student' } });

        res.json({ leaderboard, me, total });
    } catch (error) {
        console.error('[LEADERBOARD] Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

export default router;
