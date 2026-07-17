import express from 'express';
import prisma from '../db.js';

const router = express.Router();

// GET /api/leaderboard - fetch top users by XP
router.get('/', async (req, res) => {
    try {
        const topUsers = await prisma.user.findMany({
            where: { role: 'student' }, // assuming we only rank students
            select: {
                id: true,
                name: true,
                xp: true,
                avatar: true,
                grade: true
            },
            orderBy: {
                xp: 'desc'
            },
            take: 50 // top 50
        });

        // Calculate rank and level (assuming some level formula, e.g. Math.floor(xp / 100) + 1)
        const leaderboardData = topUsers.map((user, index) => ({
            id: user.id,
            name: user.name,
            xp: user.xp,
            avatar: user.avatar,
            grade: user.grade,
            level: Math.floor(user.xp / 100) + 1, // Basic level formula
            rank: index + 1
        }));

        res.json(leaderboardData);
    } catch (error) {
        console.error('[LEADERBOARD] Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

export default router;
