import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
const router = express.Router();
// Admin check middleware
const requireAdmin = async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.isAdmin)
            return res.status(403).json({ error: 'Admin access required' });
        next();
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
};
// POST /api/paper-files/upload — upload one or more PDFs (admin only)
// Body: { syllabus, grade, subject, year, files: [{ label, fileData, fileSize }] }
router.post('/upload', authenticateToken, requireAdmin, async (req, res) => {
    const { syllabus, grade, subject, year, files } = req.body;
    if (!syllabus || !grade || !subject || !year || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'syllabus, grade, subject, year, and files[] are required' });
    }
    const parsedYear = parseInt(String(year), 10);
    if (isNaN(parsedYear))
        return res.status(400).json({ error: 'year must be a number' });
    try {
        const created = await prisma.$transaction(files.map((f) => prisma.paperFile.create({
            data: {
                syllabus,
                grade,
                subject,
                year: parsedYear,
                label: f.label || `${subject} ${parsedYear} Paper`,
                fileData: f.fileData,
                fileSize: f.fileSize,
            }
        })));
        res.json({ uploaded: created.length, ids: created.map(f => f.id) });
    }
    catch (error) {
        console.error('[PAPER-FILES] Upload error:', error);
        res.status(500).json({ error: 'Upload failed', details: error.message });
    }
});
// GET /api/paper-files — list all papers (metadata only, no fileData)
// Optional query: ?syllabus=&grade=&subject=&year=
router.get('/', async (req, res) => {
    const { syllabus, grade, subject, year } = req.query;
    const where = {};
    if (syllabus)
        where.syllabus = syllabus;
    if (grade)
        where.grade = grade;
    if (subject)
        where.subject = subject;
    if (year)
        where.year = parseInt(year, 10);
    try {
        const files = await prisma.paperFile.findMany({
            where,
            select: { id: true, syllabus: true, grade: true, subject: true, year: true, label: true, fileSize: true, createdAt: true },
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
        });
        res.json(files);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch paper files' });
    }
});
// GET /api/paper-files/:id — serve the raw PDF
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const file = await prisma.paperFile.findUnique({ where: { id } });
        if (!file)
            return res.status(404).json({ error: 'File not found' });
        // fileData is a base64 data URL (data:application/pdf;base64,...)
        const base64 = file.fileData.includes(',') ? file.fileData.split(',')[1] : file.fileData;
        const buffer = Buffer.from(base64, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${file.label.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to serve file' });
    }
});
// DELETE /api/paper-files/:id — delete a paper (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.paperFile.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        console.error('[PAPER-FILES] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});
export default router;
