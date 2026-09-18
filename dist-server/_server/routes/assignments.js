import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware.js';
const router = express.Router();
const prisma = new PrismaClient();
// Create an assignment
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { classroomId, title, description, questId, dueDate } = req.body;
        if (!classroomId || !title)
            return res.status(400).json({ error: 'Missing required fields' });
        const classroom = await prisma.classroom.findUnique({
            where: { id: classroomId },
            include: { students: true }
        });
        if (!classroom || classroom.teacherId !== req.user.id)
            return res.status(403).json({ error: 'Unauthorized' });
        const assignment = await prisma.assignment.create({
            data: { classroomId, title, description, questId, dueDate: dueDate ? new Date(dueDate) : null }
        });
        if (classroom.students?.length > 0) {
            await prisma.assignmentSubmission.createMany({
                data: classroom.students.map(s => ({ assignmentId: assignment.id, studentId: s.id, status: 'pending' }))
            });
        }
        res.json(assignment);
    }
    catch (error) {
        console.error('Failed to create assignment:', error);
        res.status(500).json({ error: 'Failed to create assignment' });
    }
});
// Submit an assignment
router.post('/:id/submit', authenticateToken, async (req, res) => {
    try {
        const { score, proofUrl } = req.body;
        const status = proofUrl ? 'submitted' : 'completed';
        const submission = await prisma.assignmentSubmission.findUnique({
            where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } }
        });
        if (!submission) {
            await prisma.assignmentSubmission.create({
                data: { assignmentId: req.params.id, studentId: req.user.id, status, score: score || null, proofUrl: proofUrl || null, completedAt: new Date() }
            });
        }
        else {
            await prisma.assignmentSubmission.update({
                where: { id: submission.id },
                data: { status, score: score !== undefined ? score : submission.score, proofUrl: proofUrl || submission.proofUrl, completedAt: new Date() }
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Failed to submit assignment:', error);
        res.status(500).json({ error: 'Failed to submit assignment' });
    }
});
// Grade an assignment submission
router.post('/:id/grade', authenticateToken, async (req, res) => {
    try {
        const { studentId, score } = req.body;
        if (!studentId || score === undefined)
            return res.status(400).json({ error: 'Missing studentId or score' });
        const submission = await prisma.assignmentSubmission.findUnique({
            where: { assignmentId_studentId: { assignmentId: req.params.id, studentId } }
        });
        if (!submission)
            return res.status(404).json({ error: 'Submission not found' });
        const updated = await prisma.assignmentSubmission.update({
            where: { id: submission.id },
            data: { score: parseInt(score), status: 'completed' }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Failed to grade submission:', error);
        res.status(500).json({ error: 'Failed to grade submission' });
    }
});
// DELETE /api/assignments/submissions/:submissionId — teacher removes a submission from view
router.delete('/submissions/:submissionId', authenticateToken, async (req, res) => {
    try {
        const { submissionId } = req.params;
        // Verify the teacher owns the classroom this submission belongs to
        const submission = await prisma.assignmentSubmission.findUnique({
            where: { id: submissionId },
            include: { assignment: { include: { classroom: true } } }
        });
        if (!submission)
            return res.status(404).json({ error: 'Submission not found' });
        if (submission.assignment.classroom.teacherId !== req.user.id)
            return res.status(403).json({ error: 'Unauthorized' });
        await prisma.assignmentSubmission.delete({ where: { id: submissionId } });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Failed to delete submission:', error);
        res.status(500).json({ error: 'Failed to delete submission' });
    }
});
export default router;
