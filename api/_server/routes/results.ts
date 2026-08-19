import express from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import { checkExpiredSubscriptions } from '../middleware/checkExpiredSubscriptions.js';
import { shouldAwardPoints } from '../utils/gradeRank.js';
import { GATE_LENIENCY, expectedGradeFor, isMusicSyllabus } from '../utils/ageGrade.js';

const router = express.Router();

// Apply expiration check to all routes (runs AFTER authentication)
router.use(authenticateToken, checkExpiredSubscriptions);

// Save a game result
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    const { score, mode, questId, correctAnswers, totalQuestions, subject, topic, grade, syllabus } = req.body;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // Enforce 1-quest play limit for free users
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Award gating: the gate is judged by the student's AGE GROUP (derived from their
        // immutable birthday), not the standard they picked — students may edit their
        // standard freely, so gating on it would let anyone farm XP on easy quizzes.
        // Music syllabi have no age mapping, and accounts with no birthday on file fall
        // back to the selected grade — i.e. exactly today's behaviour.
        const ageGrade =
            (!isMusicSyllabus(user.gradeSyllabus) && user.birthday)
                ? expectedGradeFor(user.gradeSyllabus, user.birthday, new Date())
                : null;
        const gateGrade = ageGrade ?? user.grade;
        const gateSource: 'age' | 'profile' = ageGrade ? 'age' : 'profile';

        // Leniency only applies to the DERIVED grade — it exists to absorb age-mapping
        // drift (repeated/skipped years). A grade the student picked themselves has no
        // such drift, so the profile path keeps leniency 0 and stays exactly as it is
        // today for every existing account.
        let award = shouldAwardPoints(gateGrade, grade, gateSource === 'age' ? GATE_LENIENCY : 0);

        // Cross-syllabus music exemption: the "Grade N" rank space is shared by both
        // music syllabi, so without this a Grade 8 Indian Music student playing a
        // Grade 2 Western Music quiz would be gated even though the two ladders are
        // unrelated. A music quiz under a DIFFERENT syllabus than the student's own
        // always awards. (Same-syllabus music quizzes stay gated on the shared ladder.)
        if (!award && typeof syllabus === 'string' && isMusicSyllabus(syllabus) && syllabus !== user.gradeSyllabus) {
            award = true;
        }

        console.log(
            `[GATE] user=${userId} birthday=${user.birthday ? user.birthday.toISOString().slice(0, 10) : 'none'} ` +
            `syllabus=${user.gradeSyllabus ?? 'none'} profileGrade=${user.grade ?? 'none'} ` +
            `gateGrade=${gateGrade ?? 'none'} source=${gateSource} quizGrade=${grade ?? 'none'} award=${award}`
        );

        // Teacher-quest exemption: quests created by teachers/admins always award points
        if (questId) {
            const quest = await prisma.quest.findUnique({
                where: { id: questId },
                include: { creator: { select: { role: true, isAdmin: true } } }
            });
            if (quest && (quest.creator.role !== 'student' || quest.creator.isAdmin)) {
                award = true;
            }
        }

        const xpAwarded = award ? score : 0;
        const coinsAwarded = award ? (correctAnswers || 0) : 0;

        const result = await prisma.result.create({
            data: {
                userId,
                score,
                mode,
                totalQuestions: totalQuestions || 0,
                correctAnswers: correctAnswers || 0,
                subject: subject || undefined,
                topic: topic || undefined,
                grade: grade || undefined,
                xpAwarded,
                coinsAwarded,
                questId: questId || undefined
            }
        });

        console.log(`[API] ✅ Result saved: ${result.id}`);

        // Update user stats (XP, Coins) — skip entirely when nothing was awarded
        if (xpAwarded > 0 || coinsAwarded > 0) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    xp: { increment: xpAwarded },
                    coins: { increment: coinsAwarded },
                    // questsPlayed increment moved to /api/generation/quest
                }
            });
        }

        // Fetch updated coin total to send back to client
        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { coins: true }
        });

        console.log(`[API] ✅ Result saved! User XP: ${user.xp} -> +${xpAwarded}, Coins: +${coinsAwarded} (total: ${updatedUser?.coins}, gated: ${!award})`);

        res.json({
            ...result,
            newCoinTotal: updatedUser?.coins ?? 0,
            xpAwarded,
            coinsAwarded,
            gated: !award,
            gateGrade: gateGrade ?? null,
            gateSource
        });
    } catch (error) {
        console.error('[API] Error saving result:', error);
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// Get user results
router.get('/my-results', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    try {
        const results = await prisma.result.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            include: { quest: { select: { title: true } } }
        });
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

export default router;
