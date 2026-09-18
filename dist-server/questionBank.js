import express from 'express';
import prisma from './_server/db.js';
const router = express.Router();
/**
 * GET /api/question-bank/count
 * Public endpoint — returns count of real questions per year for a given subject/grade/syllabus.
 * Used by the student UI to show "Real Questions Available" vs "AI Generated" badges.
 *
 * Query params: syllabus, grade, subject (all required)
 * Response: { "2024": 25, "2023": 40, "2022": 0, ... }
 */
router.get('/count', async (req, res) => {
    const { syllabus, grade, subject } = req.query;
    if (!syllabus || !grade || !subject) {
        return res.status(400).json({ error: 'syllabus, grade, and subject query params are required' });
    }
    try {
        const grouped = await prisma.questionBank.groupBy({
            by: ['year'],
            where: { syllabus, grade, subject },
            _count: { id: true },
            orderBy: { year: 'desc' },
        });
        // Convert to { "2024": 25, "2023": 40, ... }
        const counts = {};
        for (const row of grouped) {
            counts[String(row.year)] = row._count.id;
        }
        res.json(counts);
    }
    catch (error) {
        console.error('[QB-COUNT] Error:', error);
        res.status(500).json({ error: 'Failed to get question counts' });
    }
});
export default router;
