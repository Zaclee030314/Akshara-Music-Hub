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

interface SuggestedMetaEntry {
    index: number;
    text: string;
    userId: string;
    userName: string;
    createdAt: string;
}

// Student-added options recorded on Poll.suggestedMeta (JSON array).
const parseSuggestedMeta = (raw: string | null | undefined): SuggestedMetaEntry[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((e: any) => e && typeof e.index === 'number')
            .map((e: any) => ({
                index: e.index,
                text: String(e.text ?? ''),
                userId: String(e.userId ?? ''),
                userName: String(e.userName ?? 'Unknown'),
                createdAt: String(e.createdAt ?? ''),
            }));
    } catch {
        return [];
    }
};

// Soft-removed option indices recorded on Poll.removedOptions (JSON array of ints).
const parseRemoved = (raw: string | null | undefined): number[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((n: any) => parseInt(String(n), 10))
            .filter((n: number) => Number.isInteger(n) && n >= 0);
    } catch {
        return [];
    }
};

// Collapse whitespace so "  Extra   Class " and "Extra Class" are the same suggestion.
const normalizeText = (s: string): string => String(s).trim().replace(/\s+/g, ' ');

// ─── STUDENT ROUTES ──────────────────────────────────────────────────────────

// GET /api/polls/active — auth; newest active poll + myVote + per-option counts.
// Options are returned as objects carrying their TRUE array index so the client can
// post a stable optionIndex even though soft-removed options are filtered out.
router.get('/active', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const poll = await prisma.poll.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        if (!poll) return res.json({ poll: null });

        const options = parseOptions(poll.options);
        const meta = parseSuggestedMeta(poll.suggestedMeta);
        const removed = new Set(parseRemoved(poll.removedOptions));

        const votes = await prisma.pollVote.findMany({
            where: { pollId: poll.id },
            select: { optionIndex: true, suggestion: true, userId: true },
        });
        const { optionCounts } = tallyVotes(votes, options.length);

        const optionList = options
            .map((text, index) => ({
                index,
                text,
                count: optionCounts[index] || 0,
                suggestedByName: meta.find(m => m.index === index)?.userName || null,
            }))
            .filter(o => !removed.has(o.index));

        const mine = votes.find(v => v.userId === req.user?.id) || null;
        const myVote = mine
            ? { optionIndex: mine.optionIndex, suggestion: mine.suggestion }
            : null;

        res.json({
            poll: {
                id: poll.id,
                question: poll.question,
                description: poll.description,
                allowSuggestions: poll.allowSuggestions,
                seasonId: poll.seasonId,
                options: optionList,
            },
            myVote,
            totalVotes: votes.length,
        });
    } catch (error) {
        console.error('[POLLS] active error:', error);
        res.status(500).json({ error: 'Failed to fetch active poll' });
    }
});

// POST /api/polls/:id/vote — auth; body { optionIndex } XOR { suggestion }.
// Votes can be CHANGED: we upsert on the (pollId, userId) unique pair, so voting
// again MOVES the existing vote instead of creating a second one.
// A free-text `suggestion` is auto-promoted into a real, votable option (deduped
// case-insensitively against existing options), and the vote lands on that option.
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

        // ── Vote for an existing option ──────────────────────────────────────
        if (hasOption) {
            const options = parseOptions(poll.options);
            const removed = new Set(parseRemoved(poll.removedOptions));
            const idx = parseInt(String(optionIndex), 10);
            if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
                return res.status(400).json({ error: 'Invalid option selected' });
            }
            if (removed.has(idx)) {
                return res.status(400).json({ error: 'That option is no longer available' });
            }
            // `suggestion: null` clears any stale pre-upgrade free-text value.
            await prisma.pollVote.upsert({
                where: { pollId_userId: { pollId: id, userId } },
                create: { pollId: id, userId, optionIndex: idx, suggestion: null },
                update: { optionIndex: idx, suggestion: null },
            });
            return res.json({ success: true, optionIndex: idx });
        }

        // ── Suggest a new answer → auto-promote to a real option ─────────────
        if (!poll.allowSuggestions) {
            return res.status(400).json({ error: 'This poll does not accept suggestions' });
        }
        const norm = normalizeText(String(suggestion)).slice(0, 200);
        if (norm.length === 0) {
            return res.status(400).json({ error: 'Suggestion cannot be empty' });
        }

        const voter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const voterName = voter?.name || 'Unknown';

        // All inside one transaction so two students suggesting at the same moment
        // cannot both append the same option.
        const resolvedIndex = await prisma.$transaction(async tx => {
            // Row-lock the poll so the read-modify-write of `options` is serialized.
            // Best-effort: if raw SQL is unavailable the re-read below still covers
            // the common (non-simultaneous) case.
            try {
                await tx.$queryRaw`SELECT id FROM "Poll" WHERE id = ${id} FOR UPDATE`;
            } catch {
                /* ignore — fall back to the plain re-read */
            }

            const fresh = await tx.poll.findUnique({ where: { id } });
            if (!fresh) throw new Error('Poll disappeared mid-transaction');

            const options = parseOptions(fresh.options);
            const removedSet = new Set(parseRemoved(fresh.removedOptions));
            const target = norm.toLowerCase();

            // Case-insensitive dedupe against live (non-removed) options.
            let idx = -1;
            for (let i = 0; i < options.length; i++) {
                if (removedSet.has(i)) continue;
                if (normalizeText(options[i]).toLowerCase() === target) { idx = i; break; }
            }

            if (idx === -1) {
                // APPEND ONLY — never splice or reorder, existing votes point at indices.
                idx = options.length;
                const meta = parseSuggestedMeta(fresh.suggestedMeta);
                meta.push({
                    index: idx,
                    text: norm,
                    userId,
                    userName: voterName,
                    createdAt: new Date().toISOString(),
                });
                await tx.poll.update({
                    where: { id },
                    data: {
                        options: JSON.stringify([...options, norm]),
                        suggestedMeta: JSON.stringify(meta),
                    },
                });
            }

            await tx.pollVote.upsert({
                where: { pollId_userId: { pollId: id, userId } },
                create: { pollId: id, userId, optionIndex: idx, suggestion: null },
                update: { optionIndex: idx, suggestion: null },
            });
            return idx;
        });

        res.json({ success: true, optionIndex: resolvedIndex });
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
                const { optionCounts } = tallyVotes(votes, options.length);
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
                    // Now means "number of student-suggested OPTIONS" (they are real
                    // options after auto-promotion), not "number of free-text votes".
                    suggestionsCount: parseSuggestedMeta(p.suggestedMeta).length,
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

// Build the admin-facing option list: every option (including soft-removed ones,
// flagged) with its true index, count and suggester attribution.
const buildAdminOptions = (
    poll: { options: string; suggestedMeta: string | null; removedOptions: string | null },
    optionCounts: number[]
) => {
    const options = parseOptions(poll.options);
    const meta = parseSuggestedMeta(poll.suggestedMeta);
    const removed = new Set(parseRemoved(poll.removedOptions));
    return options.map((text, index) => {
        const m = meta.find(e => e.index === index);
        return {
            index,
            text,
            count: optionCounts[index] || 0,
            suggestedByName: m?.userName || null,
            suggestedByUserId: m?.userId || null,
            removed: removed.has(index),
        };
    });
};

// GET /api/polls/admin/:id/results — every option (removed ones flagged) + counts,
// plus any pre-upgrade free-text suggestion votes that were never promoted.
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

        // Rows created before the auto-promotion upgrade: optionIndex null, suggestion set.
        // Surfaced read-only (never auto-migrated) and still counted in totalVotes.
        const legacySuggestions = votes
            .filter(v => v.suggestion)
            .map(v => ({
                suggestion: v.suggestion,
                userName: v.user?.name || 'Unknown',
                createdAt: v.createdAt,
            }));

        res.json({
            poll: {
                id: poll.id,
                question: poll.question,
                allowSuggestions: poll.allowSuggestions,
            },
            options: buildAdminOptions(poll, optionCounts),
            legacySuggestions,
            totalVotes: votes.length,
        });
    } catch (error) {
        console.error('[POLLS] results error:', error);
        res.status(500).json({ error: 'Failed to fetch poll results' });
    }
});

// PATCH /api/polls/admin/:id/options/:index — soft-remove / restore one option.
// We deliberately do NOT delete the entry from `options` and do NOT touch votes:
// PollVote.optionIndex references options by ARRAY INDEX, so deleting or reordering
// would silently repoint every later vote at the wrong option. Removal is a hide.
router.patch('/admin/:id/options/:index', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id, index } = req.params;
        const { removed } = req.body;
        if (typeof removed !== 'boolean') {
            return res.status(400).json({ error: 'Body must include boolean "removed"' });
        }

        const poll = await prisma.poll.findUnique({ where: { id } });
        if (!poll) return res.status(404).json({ error: 'Poll not found' });

        const options = parseOptions(poll.options);
        const idx = parseInt(String(index), 10);
        if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
            return res.status(400).json({ error: 'Invalid option index' });
        }

        const current = new Set(parseRemoved(poll.removedOptions));
        if (removed) current.add(idx);
        else current.delete(idx);

        const updated = await prisma.poll.update({
            where: { id },
            data: { removedOptions: JSON.stringify([...current].sort((a, b) => a - b)) },
        });

        const votes = await prisma.pollVote.findMany({
            where: { pollId: id },
            select: { optionIndex: true, suggestion: true },
        });
        const { optionCounts } = tallyVotes(votes, options.length);

        res.json({ options: buildAdminOptions(updated, optionCounts) });
    } catch (error) {
        console.error('[POLLS] option remove error:', error);
        res.status(500).json({ error: 'Failed to update option' });
    }
});

export default router;
