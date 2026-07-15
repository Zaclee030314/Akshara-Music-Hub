import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { generateAIContent } from '../utils/ai.js';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware: require isAdmin
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

router.use(authenticateToken, requireAdmin);

// GET /api/admin/stats — aggregate analytics
router.get('/stats', async (_req, res) => {
    try {
        const [userCount, totalCoins, totalXP, performance] = await Promise.all([
            prisma.user.count(),
            prisma.user.aggregate({ _sum: { coins: true } }),
            prisma.user.aggregate({ _sum: { xp: true } }),
            prisma.result.aggregate({
                _sum: {
                    totalQuestions: true,
                    correctAnswers: true
                }
            })
        ]);

        res.json({
            users: userCount,
            totalCoins: totalCoins._sum.coins || 0,
            totalXP: totalXP._sum.xp || 0,
            totalQuestions: performance._sum.totalQuestions || 0,
            totalCorrect: performance._sum.correctAnswers || 0,
            averageAccuracy: performance._sum.totalQuestions ?
                Math.round((performance._sum.correctAnswers || 0) / performance._sum.totalQuestions * 100) : 0
        });
    } catch (error) {
        console.error('[ADMIN] Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// GET /api/admin/users — list all users (with aggregate stats)
router.get('/users', async (_req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                xp: true,
                isAdmin: true,
                isSubscribed: true,
                questsPlayed: true,
                results: {
                    select: {
                        totalQuestions: true,
                        correctAnswers: true,
                        subject: true
                    }
                }
            },
            orderBy: { xp: 'desc' }
        });

        const usersWithStats = users.map(u => {
            const totalQ = u.results.reduce((sum, r) => sum + r.totalQuestions, 0);
            const totalC = u.results.reduce((sum, r) => sum + r.correctAnswers, 0);
            const subjects = Array.from(new Set(u.results.map(r => r.subject).filter(Boolean))).sort();

            return {
                ...u,
                totalQuestions: totalQ,
                totalCorrect: totalC,
                accuracy: totalQ ? Math.round((totalC / totalQ) * 100) : 0,
                subjectsDone: subjects,
                results: undefined
            };
        });

        res.json(usersWithStats);
    } catch (error) {
        console.error('[ADMIN] Users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/admin/create-teacher — provision a verified teacher account
// Teachers can no longer self-register, so admins create them here.
router.post('/create-teacher', async (req, res) => {
    const { name, email, password } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address' });
    }
    if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const normalizedEmail = String(email).trim().toLowerCase();
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            return res.status(400).json({ error: 'A user with this email already exists' });
        }
        // Clear any stale pending self-registration for this email
        await prisma.pendingUser.deleteMany({ where: { email: normalizedEmail } });

        const hashedPassword = await bcrypt.hash(password, 10);
        const teacher = await prisma.user.create({
            data: {
                name: String(name).trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: 'teacher',
                isVerified: true,
            },
            select: { id: true, name: true, email: true, role: true },
        });

        console.log(`[ADMIN] Created teacher account: ${teacher.email}`);
        res.json({ success: true, teacher });
    } catch (error: any) {
        console.error('[ADMIN] Create teacher error:', error);
        res.status(500).json({ error: 'Failed to create teacher account' });
    }
});

// PATCH /api/admin/users/:id/role — change a user's role and/or admin access
router.patch('/users/:id/role', async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { role, isAdmin } = req.body;

    if (role !== undefined && role !== 'student' && role !== 'teacher') {
        return res.status(400).json({ error: "role must be 'student' or 'teacher'" });
    }
    if (isAdmin !== undefined && typeof isAdmin !== 'boolean') {
        return res.status(400).json({ error: 'isAdmin must be a boolean' });
    }
    if (role === undefined && isAdmin === undefined) {
        return res.status(400).json({ error: 'Nothing to update' });
    }

    // Prevent an admin from revoking their own admin access (avoids lockout)
    if (isAdmin === false && id === req.user?.id) {
        return res.status(400).json({ error: 'You cannot revoke your own admin access' });
    }

    try {
        const data: { role?: string; isAdmin?: boolean } = {};
        if (role !== undefined) data.role = role;
        if (isAdmin !== undefined) data.isAdmin = isAdmin;

        const updated = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, name: true, email: true, role: true, isAdmin: true },
        });

        console.log(`[ADMIN] Updated access for ${updated.email}: role=${updated.role}, isAdmin=${updated.isAdmin}`);
        res.json({ success: true, user: updated });
    } catch (error: any) {
        console.error('[ADMIN] Update role error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// GET /api/admin/users/:userId/performance — Daily stats for a user
router.get('/users/:userId/performance', async (req, res) => {
    const { userId } = req.params;
    try {
        const results = await prisma.result.findMany({
            where: { userId },
            orderBy: { date: 'asc' },
            select: {
                date: true,
                totalQuestions: true,
                correctAnswers: true
            }
        });

        const dailyStats: Record<string, { answered: number, correct: number }> = {};

        results.forEach(r => {
            const day = r.date.toISOString().split('T')[0];
            if (!dailyStats[day]) {
                dailyStats[day] = { answered: 0, correct: 0 };
            }
            dailyStats[day].answered += r.totalQuestions;
            dailyStats[day].correct += r.correctAnswers;
        });

        const formattedStats = Object.entries(dailyStats).map(([date, stats]) => ({
            date,
            ...stats,
            accuracy: stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0
        })).sort((a, b) => b.date.localeCompare(a.date));

        res.json(formattedStats);
    } catch (error) {
        console.error('[ADMIN] Performance error:', error);
        res.status(500).json({ error: 'Failed to fetch performance data' });
    }
});

// --- REWARD MANAGEMENT ---

// GET /api/admin/rewards — list all rewards (including inactive)
router.get('/rewards', async (_req, res) => {
    try {
        const rewards = await prisma.reward.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(rewards);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rewards' });
    }
});

// POST /api/admin/rewards — create a new reward
router.post('/rewards', async (req, res) => {
    try {
        const { title, description, coinCost, icon, stock } = req.body;
        const reward = await prisma.reward.create({
            data: { title, description, coinCost, icon, stock: stock || null }
        });
        res.json(reward);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create reward' });
    }
});

// PUT /api/admin/rewards/:id — update a reward
router.put('/rewards/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const data = req.body;
        const reward = await prisma.reward.update({
            where: { id },
            data
        });
        res.json(reward);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update reward' });
    }
});

// DELETE /api/admin/rewards/:id — delete a reward (and its linked redemptions first)
router.delete('/rewards/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Delete linked redemptions first to avoid foreign key constraint errors
        await prisma.redemption.deleteMany({ where: { rewardId: id } });
        await prisma.reward.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('[ADMIN] Delete reward error:', error);
        res.status(500).json({ error: 'Failed to delete reward' });
    }
});

// GET /api/admin/redemptions — list all redemptions
router.get('/redemptions', async (_req, res) => {
    try {
        const redemptions = await prisma.redemption.findMany({
            include: {
                user: { select: { name: true, email: true } },
                reward: { select: { title: true } }
            },
            orderBy: { redeemedAt: 'desc' }
        });
        res.json(redemptions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch redemptions' });
    }
});

// PATCH /api/admin/redemptions/:id — update redemption status
router.patch('/redemptions/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const redemption = await prisma.redemption.update({
            where: { id },
            data: { status }
        });
        res.json(redemption);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update redemption' });
    }
});

// ─── QUESTION BANK MANAGEMENT ────────────────────────────────────────────────

// Helpers
const resolveExamName = (syllabus: string, grade: string): string => {
    const s = syllabus.toLowerCase();
    const g = grade.toLowerCase();
    if (s.includes('kssr') || s.includes('kssm') || s.includes('malaysian')) {
        if (g.includes('form 5')) return 'SPM (Sijil Pelajaran Malaysia)';
        if (g.includes('form 3')) return 'PT3 (Pentaksiran Tingkatan 3)';
        if (g.includes('standard 6')) return 'UPSR (Ujian Pencapaian Sekolah Rendah)';
        if (g.includes('form 6')) return 'STPM (Sijil Tinggi Persekolahan Malaysia)';
        return 'Malaysian National Exam';
    }
    if (s.includes('igcse') || s.includes('cambridge')) return 'Cambridge IGCSE';
    if (s.includes('singapore') || s.includes('moe')) return 'Singapore GCE O-Level';
    if (s.includes('ib')) return 'IB (International Baccalaureate)';
    return syllabus;
};

const repairJSON = (text: string): any => {
    let cleaned = text.trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    } else {
        const start = cleaned.indexOf('{') !== -1 ? cleaned.indexOf('{') : cleaned.indexOf('[');
        if (start !== -1) cleaned = cleaned.substring(start);
        else throw new Error('No JSON found in response');
    }
    const stack: string[] = [];
    let inStr = false, esc = false;
    for (const char of cleaned) {
        if (esc) { esc = false; continue; }
        if (char === '\\') { esc = true; continue; }
        if (char === '"') { inStr = !inStr; continue; }
        if (!inStr) {
            if (char === '{' || char === '[') stack.push(char);
            else if (char === '}' || char === ']') stack.pop();
        }
    }
    if (inStr) cleaned += '"';
    while (stack.length) cleaned += stack.pop() === '{' ? '}' : ']';
    return JSON.parse(cleaned);
};

// ⚠️ IMPORTANT: /question-bank/ai-generate MUST come BEFORE /question-bank to avoid Express swallowing it
// POST /api/admin/question-bank/ai-generate — AI auto-generate & save questions
router.post('/question-bank/ai-generate', async (req, res) => {
    const { syllabus, grade, subject, year, count = 25 } = req.body;

    if (!syllabus || !grade || !subject || !year) {
        return res.status(400).json({ error: 'syllabus, grade, subject, and year are required' });
    }

    const parsedYear = parseInt(String(year), 10);
    if (isNaN(parsedYear)) {
        return res.status(400).json({ error: 'year must be a valid number' });
    }

    const examName = resolveExamName(syllabus, grade);
    const numQ = Math.min(Math.max(parseInt(String(count), 10) || 25, 5), 40);

    const prompt = `You are an expert exam question compiler with comprehensive knowledge of official past year exam papers.

TASK: Generate ${numQ} multiple-choice questions representative of the official ${examName} ${parsedYear} paper for ${subject} at ${grade} level.

REQUIREMENTS:
1. Each question must have exactly 4 options as full answer text (not just A/B/C/D labels).
2. correctAnswer must be EXACTLY one of: "A", "B", "C", or "D".
3. Include the topic/chapter name for each question.
4. Include a 2-3 sentence explanation for each answer.
5. Include difficulty: "Easy", "Medium", or "Hard".
6. Include source like "${subject} ${examName} ${parsedYear} Paper 1".
7. Cover diverse topics from the full ${subject} syllabus.
8. Difficulty spread: ~30% Easy, ~45% Medium, ~25% Hard.
9. THE RESPONSE MUST BE EXACTLY ${numQ} QUESTIONS. DO NOT RETURN FEWER.
${syllabus.toLowerCase().includes('kssr') || syllabus.toLowerCase().includes('kssm') || syllabus.toLowerCase().includes('malaysian') ? '10. Follow Malaysian DSKP standard terminology.' : ''}
${syllabus.toLowerCase().includes('igcse') || syllabus.toLowerCase().includes('cambridge') ? '10. Follow Cambridge syllabus. Use command words: state, describe, explain, calculate, suggest.' : ''}

Return ONLY a valid JSON object (no other text):
{
  "questions": [
    {
      "question": "Full question text?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "A",
      "topic": "Chapter/topic name",
      "difficulty": "Medium",
      "explanation": "Why the answer is correct...",
      "source": "${subject} ${examName} ${parsedYear}"
    }
  ]
}`;

    try {
        console.log(`🤖 [QB-AI] Generating ${numQ} questions for ${syllabus}/${grade}/${subject}/${parsedYear}`);
        const responseText = await generateAIContent(prompt, 'gemini-2.5-flash', 'application/json');

        if (!responseText) {
            return res.status(500).json({ error: 'AI returned empty response. Please try again.' });
        }

        let parsed: any;
        try {
            parsed = repairJSON(responseText);
        } catch (e: any) {
            console.error('[QB-AI] JSON parse failure:', e.message);
            return res.status(500).json({ error: 'AI returned malformed JSON. Please try again.' });
        }

        const rawQuestions: any[] = parsed.questions || (Array.isArray(parsed) ? parsed : []);
        if (rawQuestions.length < Math.min(numQ, 5)) {
            return res.status(500).json({ error: `AI returned too few questions (${rawQuestions.length}/${numQ}). Please try again.` });
        }

        const created = await prisma.$transaction(
            rawQuestions.map((q: any) =>
                prisma.questionBank.create({
                    data: {
                        subject,
                        grade,
                        syllabus,
                        year: parsedYear,
                        topic: q.topic || 'General',
                        subtopic: q.subtopic || null,
                        question: q.question || q.text || '',
                        options: JSON.stringify(Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D']),
                        correctAnswer: String(q.correctAnswer || 'A').toUpperCase().charAt(0),
                        explanation: q.explanation || '',
                        difficulty: q.difficulty || 'Medium',
                        source: q.source || `${subject} ${examName} ${parsedYear}`,
                    },
                })
            )
        );

        console.log(`✅ [QB-AI] Saved ${created.length} questions to QuestionBank`);
        res.json({ uploaded: created.length, message: `Successfully generated and imported ${created.length} questions!` });
    } catch (error: any) {
        console.error('[QB-AI] Error:', error);
        res.status(500).json({ error: 'AI generation failed', details: error.message });
    }
});

// POST /api/admin/question-bank — upload single question or bulk array (manual JSON)
router.post('/question-bank', async (req, res) => {
    try {
        const { syllabus, grade, subject, year, questions } = req.body;

        if (!syllabus || !grade || !subject || !year) {
            return res.status(400).json({ error: 'syllabus, grade, subject, and year are required' });
        }

        const parsedYear = parseInt(String(year), 10);
        if (isNaN(parsedYear)) {
            return res.status(400).json({ error: 'year must be a valid number' });
        }

        const rawList: any[] = Array.isArray(questions) ? questions : [questions];

        if (!rawList.length) {
            return res.status(400).json({ error: 'No questions provided' });
        }

        const created = await prisma.$transaction(
            rawList.map((q: any) =>
                prisma.questionBank.create({
                    data: {
                        subject,
                        grade,
                        syllabus,
                        year: parsedYear,
                        topic: q.topic || 'General',
                        subtopic: q.subtopic || null,
                        question: q.question,
                        options: JSON.stringify(q.options),
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation || '',
                        difficulty: q.difficulty || 'Medium',
                        source: q.source || null,
                    },
                })
            )
        );

        console.log(`[QB] ✅ Uploaded ${created.length} questions for ${syllabus} / ${grade} / ${subject} / ${parsedYear}`);
        res.json({ uploaded: created.length, ids: created.map((q) => q.id) });
    } catch (error: any) {
        console.error('[QB] Upload error:', error);
        res.status(500).json({ error: 'Failed to upload questions', details: error.message });
    }
});

// GET /api/admin/question-bank — list questions with optional filters
router.get('/question-bank', async (req, res) => {
    try {
        const { syllabus, grade, subject, year } = req.query as Record<string, string>;
        const where: any = {};
        if (syllabus) where.syllabus = syllabus;
        if (grade) where.grade = grade;
        if (subject) where.subject = subject;
        if (year) where.year = parseInt(year, 10);

        const questions = await prisma.questionBank.findMany({
            where,
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        });

        res.json(questions);
    } catch (error: any) {
        console.error('[QB] List error:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

// DELETE /api/admin/question-bank/:id — delete a single question
router.delete('/question-bank/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.questionBank.delete({ where: { id } });
        res.json({ success: true });
    } catch (error: any) {
        console.error('[QB] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete question' });
    }
});

// DELETE /api/admin/question-bank — delete ALL questions matching a filter (bulk delete)
router.delete('/question-bank', async (req, res) => {
    const { syllabus, grade, subject, year } = req.query as Record<string, string>;
    try {
        const where: any = {};
        if (syllabus) where.syllabus = syllabus;
        if (grade) where.grade = grade;
        if (subject) where.subject = subject;
        if (year) where.year = parseInt(year, 10);

        const result = await prisma.questionBank.deleteMany({ where });
        res.json({ deleted: result.count });
    } catch (error: any) {
        console.error('[QB] Bulk delete error:', error);
        res.status(500).json({ error: 'Failed to bulk delete questions' });
    }
});

export default router;
