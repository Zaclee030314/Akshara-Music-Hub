import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
const router = express.Router();
// Apply authentication to all routes
router.use(authenticateToken);
/**
 * GET /api/study-plans/current
 * Fetches the user's current study plan including tasks
 */
router.get('/current', async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        console.log(`[STUDY-PLAN] Fetching plan for user: ${userId}`);
        const plan = await prisma.studyPlan.findFirst({
            where: { userId },
            include: {
                tasks: {
                    orderBy: [
                        { weekNumber: 'asc' },
                        { day: 'asc' }
                    ]
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        if (!plan) {
            console.log(`[STUDY-PLAN] No plan found for user: ${userId}`);
            return res.status(404).json({ error: 'No study plan found' });
        }
        console.log(`[STUDY-PLAN] Successfully fetched plan: ${plan.id}`);
        res.json(plan);
    }
    catch (error) {
        console.error('[STUDY-PLAN] Fetch error detail:', {
            message: error.message,
            stack: error.stack,
            userId
        });
        res.status(500).json({ error: 'Failed to fetch study plan', details: error.message });
    }
});
/**
 * PATCH /api/study-plans/tasks/:taskId
 * Updates a specific task's completion status
 */
router.patch('/tasks/:taskId', async (req, res) => {
    const userId = req.user?.id;
    const { taskId } = req.params;
    const { isCompleted } = req.body;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        // Verify the task belongs to the user's plan
        const task = await prisma.studyTask.findFirst({
            where: {
                id: taskId,
                studyPlan: { userId }
            }
        });
        if (!task) {
            return res.status(404).json({ error: 'Task not found or access denied' });
        }
        const updatedTask = await prisma.studyTask.update({
            where: { id: taskId },
            data: {
                isCompleted,
                completedAt: isCompleted ? new Date() : null
            }
        });
        res.json(updatedTask);
    }
    catch (error) {
        console.error('[STUDY-PLAN] Task update error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});
/**
 * DELETE /api/study-plans/:planId
 * Deletes a study plan
 */
router.delete('/:planId', async (req, res) => {
    const userId = req.user?.id;
    const { planId } = req.params;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const plan = await prisma.studyPlan.findFirst({
            where: { id: planId, userId }
        });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        await prisma.studyPlan.delete({
            where: { id: planId }
        });
        res.json({ success: true, message: 'Study plan deleted' });
    }
    catch (error) {
        console.error('[STUDY-PLAN] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete study plan' });
    }
});
export default router;
