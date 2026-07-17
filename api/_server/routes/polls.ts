import express from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware: require isAdmin (mirrors admin.ts pattern)
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

const parseOptions = (raw: string): string[] => {
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
};

// Tally votes for a poll into per-option counts + suggestions count.
const tallyVotes = (
    votes: Array<{ optionIndex: number | null; suggestion: string | null }>,
    optionCount: number
) => {
    const optionCounts = new Array(optionCount).fill(0);
    let suggestionsCount = 0;
    for (const v of votes) {
        if (typeof v.optionIndex === 'number' && v.optionIndex >= 0 && v.optionIndex < optionCount) {
            optionCounts[v.optionIndex]++;
        } else if (v.suggestion) {
            suggestionsCount++;
        }
    }
    return { optionCounts, suggestionsCount };
};

// ─── STUDENT ROUTES ──────────────────────────────────────────────────────────

// GET /api/polls/active — auth; newest active poll + myVote + counts.
router.get('/active', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const poll = await prisma.poll.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        if (!poll) return res.json({ poll: null });

        const options = parseOptions(poll.options);
        const votes = await prisma.pollVote.findMany({
            where: { pollId: poll.id },
            select: { optionIndex: true, suggestion: true, userId: true },
        });
        const { optionCounts, suggestionsCount } = tallyVotes(votes, options.length);

        const mine = votes.find(v => v.userId === req.user?.id) || null;
        const myVote = mine
            ? { optionIndex: mine.optionIndex, suggestion: mine.suggestion }
            : null;

        res.json({
            poll: {
                id: poll.id,
                question: poll.question,
                description: poll.description,
                options,
                allowSuggestions: poll.allowSuggestions,
                seasonId: poll.seasonId,
            },
            myVote,
            optionCounts,
            suggestionsCount,
            totalVotes: votes.length,
        });
    } catch (error) {
        console.error('[POLLS] active error:', error);
        res.status(500).json({ error: 'Failed to fetch active poll' });
    }
});

// POST /api/polls/:id/vote — auth; body { optionIndex } XOR { suggestion }.
router.post('/:id/vote', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { optionIndex, suggestion } = req.body;
        const hasOption = optionIndex !== undefined && optionIndex !== null;
        const hasSuggestion = suggestion !== undefined && suggestion !== null && String(suggestion).trim() !== '';

        if (hasOption === hasSuggestion) {
            return res.status(400).json({ error: 'Provide exactly one of optionIndex or suggestion' });
        }

        const poll = await prisma.poll.findUnique({ where: { id } });
        if (!poll) return res.status(404).json({ error: 'Poll not found' });
        if (!poll.isActive) return res.status(400).json({ error: 'This poll is no longer active' });

        const options = parseOptions(poll.options);

        const data: { pollId: string; userId: string; optionIndex?: number; suggestion?: string } = {
            pollId: id,
            userId,
        };

        if (hasOption) {
            const idx = parseInt(String(optionIndex), 10);
            if (isNaN(idx) || idx < 0 || idx >= options.length) {
                return res.status(400).json({ error: 'Invalid option selected' });
            }
            data.optionIndex = idx;
        } else {
            if (!poll.allowSuggestions) {
                return res.status(400).json({ error: 'This poll does not accept suggestions' });
            }
            const text = String(suggestion).trim();
            if (text.length === 0) {
                return res.status(400).json({ error: 'Suggestion cannot be empty' });
            }
            data.suggestion = text.slice(0, 200);
        }

        try {
            await prisma.pollVote.create({ data });
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return res.status(409).json({ error: 'You have already voted in this poll' });
            }
            throw err;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[POLLS] vote error:', error);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

// GET /api/polls/admin/all — every poll + vote counts.
router.get('/admin/all', authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const polls = await prisma.poll.findMany({ orderBy: { createdAt: 'desc' } });
        const withCounts = await Promise.all(
            polls.map(async p => {
                const options = parseOptions(p.options);
                const votes = await prisma.pollVote.findMany({
                    where: { pollId: p.id },
                    select: { optionIndex: true, suggestion: true },
                });
                const { optionCounts, suggestionsCount } = tallyVotes(votes, options.length);
                return {
                    id: p.id,
                    question: p.question,
                    description: p.description,
                    options,
                    allowSuggestions: p.allowSuggestions,
                    isActive: p.isActive,
                    seasonId: p.seasonId,
                    createdAt: p.createdAt,
                    optionCounts,
                    suggestionsCount,
                    totalVotes: votes.length,
                };
            })
        );
        res.json(withCounts);
    } catch (error) {
        console.error('[POLLS] admin/all error:', error);
        res.status(500).json({ error: 'Failed to fetch polls' });
    }
});

// POST /api/polls/admin — create a poll.
router.post('/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { question, description, options, allowSuggestions, seasonId } = req.body;
        if (!question || String(question).trim() === '') {
            return res.status(400).json({ error: 'Question is required' });
        }
        const allowSug = !!allowSuggestions;
        const optsRaw = Array.isArray(options) ? options.map((o: any) => String(o).trim()).filter(Boolean) : [];
        if (optsRaw.length < 2 && !allowSug) {
            return res.status(400).json({ error: 'Provide at least 2 options (or enable suggestions)' });
        }

        const poll = await prisma.poll.create({
            data: {
                question: String(question).trim(),
                description: description ? String(description) : null,
                options: JSON.stringify(optsRaw),
                allowSuggestions: allowSug,
                seasonId: seasonId ? String(seasonId) : null,
            },
        });
        res.json(poll);
    } catch (error) {
        console.error('[POLLS] create error:', error);
        res.status(500).json({ error: 'Failed to create poll' });
    }
});

// PUT /api/polls/admin/:id — toggle isActive and/or edit fields.
router.put('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.poll.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Poll not found' });

        const { question, description, options, allowSuggestions, isActive, seasonId } = req.body;
        const data: any = {};
        if (isActive !== undefined) data.isActive = !!isActive;
        if (question !== undefined) data.question = String(question).trim();
        if (description !== undefined) data.description = description ? String(description) : null;
        if (allowSuggestions !== undefined) data.allowSuggestions = !!allowSuggestions;
        if (seasonId !== undefined) data.seasonId = seasonId ? String(seasonId) : null;
        if (options !== undefined) {
            const optsRaw = Array.isArray(options) ? options.map((o: any) => String(o).trim()).filter(Boolean) : [];
            const allowSug = allowSuggestions !== undefined ? !!allowSuggestions : existing.allowSuggestions;
            if (optsRaw.length < 2 && !allowSug) {
                return res.status(400).json({ error: 'Provide at least 2 options (or enable suggestions)' });
            }
            data.options = JSON.stringify(optsRaw);
        }

        const poll = await prisma.poll.update({ where: { id }, data });
        res.json(poll);
    } catch (error) {
        console.error('[POLLS] update error:', error);
        res.status(500).json({ error: 'Failed to update poll' });
    }
});

// GET /api/polls/admin/:id/results — per-option counts + suggestions with user names.
router.get('/admin/:id/results', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const poll = await prisma.poll.findUnique({ where: { id } });
        if (!poll) return res.status(404).json({ error: 'Poll not found' });

        const options = parseOptions(poll.options);
        const votes = await prisma.pollVote.findMany({
            where: { pollId: id },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
        });
        const { optionCounts } = tallyVotes(votes, options.length);
        const suggestions = votes
            .filter(v => v.suggestion)
            .map(v => ({ suggestion: v.suggestion, userName: v.user?.name || 'Unknown', createdAt: v.createdAt }));

        res.json({
            id: poll.id,
            question: poll.question,
            options,
            optionCounts,
            suggestions,
            totalVotes: votes.length,
        });
    } catch (error) {
        console.error('[POLLS] results error:', error);
        res.status(500).json({ error: 'Failed to fetch poll results' });
    }
});

export default router;
