import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware.js';
const router = express.Router();
const prisma = new PrismaClient();
// Generate a random 6 character code
const generateJoinCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
// Create a classroom (Teacher)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Classroom name is required' });
        }
        // Generate unique code
        let joinCode = generateJoinCode();
        let isUnique = false;
        while (!isUnique) {
            const existing = await prisma.classroom.findUnique({ where: { joinCode } });
            if (!existing) {
                isUnique = true;
            }
            else {
                joinCode = generateJoinCode();
            }
        }
        const classroom = await prisma.classroom.create({
            data: {
                name,
                joinCode,
                teacherId: req.user.id
            }
        });
        res.json(classroom);
    }
    catch (error) {
        console.error("Failed to create classroom:", error);
        res.status(500).json({ error: 'Failed to create classroom' });
    }
});
// Join a classroom (Student)
router.post('/join', authenticateToken, async (req, res) => {
    try {
        const { joinCode } = req.body;
        if (!joinCode) {
            return res.status(400).json({ error: 'Join code is required' });
        }
        const classroom = await prisma.classroom.findUnique({
            where: { joinCode: joinCode.toUpperCase() }
        });
        if (!classroom) {
            return res.status(404).json({ error: 'Invalid join code' });
        }
        // Add student to classroom
        await prisma.classroom.update({
            where: { id: classroom.id },
            data: {
                students: {
                    connect: { id: req.user.id }
                }
            }
        });
        res.json({ success: true, classroom });
    }
    catch (error) {
        console.error("Failed to join classroom:", error);
        res.status(500).json({ error: 'Failed to join classroom' });
    }
});
// Get classrooms for user
router.get('/', authenticateToken, async (req, res) => {
    try {
        // A user might be a teacher or student. We fetch both.
        const teachingClassrooms = await prisma.classroom.findMany({
            where: { teacherId: req.user.id },
            include: {
                _count: {
                    select: { students: true, assignments: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const studentClassrooms = await prisma.classroom.findMany({
            where: {
                students: {
                    some: { id: req.user.id }
                }
            },
            include: {
                teacher: { select: { name: true } },
                _count: { select: { assignments: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            teaching: teachingClassrooms,
            enrolled: studentClassrooms
        });
    }
    catch (error) {
        console.error("Failed to fetch classrooms:", error);
        res.status(500).json({ error: 'Failed to fetch classrooms' });
    }
});
// Get specific classroom details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const classroom = await prisma.classroom.findUnique({
            where: { id: req.params.id },
            include: {
                teacher: { select: { id: true, name: true, email: true } },
                students: { select: { id: true, name: true, email: true } },
                assignments: {
                    include: {
                        submissions: {
                            where: { studentId: req.user.id }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!classroom) {
            return res.status(404).json({ error: 'Classroom not found' });
        }
        res.json(classroom);
    }
    catch (error) {
        console.error("Failed to fetch classroom details:", error);
        res.status(500).json({ error: 'Failed to fetch classroom details' });
    }
});
// Get submissions for all assignments in a classroom (Teacher view)
router.get('/:id/submissions', authenticateToken, async (req, res) => {
    try {
        const classroom = await prisma.classroom.findUnique({
            where: { id: req.params.id }
        });
        if (!classroom || classroom.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized or not found' });
        }
        const assignments = await prisma.assignment.findMany({
            where: { classroomId: req.params.id },
            include: {
                submissions: {
                    include: {
                        student: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(assignments);
    }
    catch (error) {
        console.error("Failed to fetch submissions:", error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});
export default router;
