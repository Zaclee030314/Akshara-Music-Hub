import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import { checkExpiredSubscriptions } from '../middleware/checkExpiredSubscriptions.js';
import prisma from '../db.js';

const router = express.Router();

// Get all quests (AUTHENTICATED)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        console.log('[API] Fetching all quests...');
        // Could filter by subject/grade
        const quests = await prisma.quest.findMany({
            include: { creator: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' } // Newest first
        });

        console.log(`[API] Found ${quests.length} quests`);

        // Parse questions string back to JSON for frontend
        const parsedQuests = quests.map(q => {
            try {
                return {
                    ...q,
                    questions: JSON.parse(q.questions)
                };
            } catch (e) {
                console.error(`[API] Failed to parse questions for quest ${q.id}:`, e);
                return {
                    ...q,
                    questions: []
                };
            }
        });
        res.json(parsedQuests);
    } catch (error) {
        console.error('[API] Error fetching quests:', error);
        res.status(500).json({ error: 'Failed to fetch quests' });
    }
});

// Create a quest (TEACHER only)
// Apply expiration check (runs AFTER authentication)
router.post('/', authenticateToken, checkExpiredSubscriptions, async (req: AuthRequest, res) => {
    const { title, subject, grade, syllabus, questions } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    console.log(`[API] Creating quest. User: ${userId}, Role: ${userRole}`);

    if (userRole !== 'teacher' && userRole !== 'TEACHER') {
        return res.status(403).json({ error: 'Only teachers can create quests' });
    }

    try {
        // Enforce 1-quest creation limit for free teachers
        const user = await prisma.user.findUnique({ where: { id: userId! } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`[API] User Subscribed: ${user.isSubscribed}, Quests Created: ${user.questsCreated}`);

        if (!user.isSubscribed && (userRole === 'teacher' || userRole === 'TEACHER')) {
            if (user.questsCreated >= 1) {
                console.log('[API] ❌ Quest creation blocked: Free limit reached');
                return res.status(403).json({
                    error: 'Free teachers are limited to 1 quest creation. Upgrade to Pro for unlimited creation.',
                    limit: 'quest_creation',
                    current: user.questsCreated,
                    max: 1
                });
            }
        }

        // Enforce syllabus selection for Single Syllabus users
        const subLevel = (user as any).subscriptionLevel;
        const subSyllabus = (user as any).subscribedSyllabus;
        if (user.isSubscribed && subLevel === 'single' && syllabus !== subSyllabus) {
            return res.status(403).json({
                error: `Your plan only allows creating quests for the ${subSyllabus} syllabus.`,
                requiredSyllabus: subSyllabus
            });
        }

        const newQuest = await prisma.quest.create({
            data: {
                title,
                subject,
                grade,
                syllabus,
                questions: JSON.stringify(questions),
                creatorId: userId!
            }
        });

        console.log(`[API] ✅ Quest created: ${newQuest.id}`);

        // Increment questsCreated counter for free users
        if (!user.isSubscribed) {
            await prisma.user.update({
                where: { id: userId! },
                data: { questsCreated: { increment: 1 } }
            });
            console.log(`[API] Incremented questsCreated count`);
        }

        res.json(newQuest);
    } catch (error) {
        console.error('[API] Error creating quest:', error);
        res.status(500).json({ error: 'Failed to create quest' });
    }
});

// Delete a quest (TEACHER only)
router.delete('/:id', authenticateToken, checkExpiredSubscriptions, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== 'teacher' && userRole !== 'TEACHER') {
        return res.status(403).json({ error: 'Only teachers can delete quests' });
    }

    try {
        // Ensure user owns the quest
        const quest = await prisma.quest.findUnique({ where: { id } });
        if (!quest) return res.status(404).json({ error: 'Quest not found' });
        if (quest.creatorId !== userId) return res.status(403).json({ error: 'You can only delete your own quests' });

        await prisma.quest.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete quest' });
    }
});

export default router;
