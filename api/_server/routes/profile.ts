import express from 'express';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../db.js';

const router = express.Router();

// Generate an 8-char uppercase referral code excluding ambiguous chars (0/O/1/I).
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateReferralCode = (): string => {
    const bytes = crypto.randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length];
    }
    return code;
};

// Shape the profile fields returned to the client (parse children JSON safely).
const shapeProfile = (user: any) => {
    let children: any[] = [];
    if (user.children) {
        try {
            const parsed = JSON.parse(user.children);
            if (Array.isArray(parsed)) children = parsed;
        } catch {
            children = [];
        }
    }
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        grade: user.grade,
        gradeSyllabus: user.gradeSyllabus,
        avatar: user.avatar,
        parentName: user.parentName,
        parentPhone: user.parentPhone,
        parentEmail: user.parentEmail,
        children,
        profileCompleted: user.profileCompleted
    };
};

// GET /api/profile — current user's profile
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(shapeProfile(user));
    } catch (error) {
        console.error('[PROFILE] GET error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/profile — update name and/or avatar
router.put('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name, avatar } = req.body;
        const data: { name?: string; avatar?: string } = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({ error: 'Name must be a non-empty string' });
            }
            data.name = name.trim();
        }

        if (avatar !== undefined) {
            if (typeof avatar !== 'string' || !avatar.startsWith('data:')) {
                return res.status(400).json({ error: 'Avatar must be a data URL image' });
            }
            if (avatar.length > 400000) {
                return res.status(400).json({ error: 'Avatar image is too large. Please choose a smaller image.' });
            }
            data.avatar = avatar;
        }

        const user = await prisma.user.update({ where: { id: userId }, data });
        res.json(shapeProfile(user));
    } catch (error) {
        console.error('[PROFILE] PUT error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/profile/referral-code — return (generating if needed) this user's referral code
router.get('/referral-code', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.referralCode) {
            return res.json({ code: user.referralCode });
        }

        // Generate a unique code, retrying on a unique-constraint collision.
        for (let attempt = 0; attempt < 5; attempt++) {
            const code = generateReferralCode();
            try {
                const updated = await prisma.user.update({
                    where: { id: userId },
                    data: { referralCode: code },
                });
                return res.json({ code: updated.referralCode });
            } catch (err: any) {
                if (err?.code === 'P2002') continue; // collision — retry
                throw err;
            }
        }
        return res.status(500).json({ error: 'Could not generate a referral code. Please try again.' });
    } catch (error) {
        console.error('[PROFILE] GET /referral-code error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/profile/season-seen — record the latest finalized season this user has seen
router.post('/season-seen', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { seasonId } = req.body;
        if (typeof seasonId !== 'string' || seasonId.trim().length === 0) {
            return res.status(400).json({ error: 'seasonId must be a non-empty string' });
        }

        await prisma.user.update({
            where: { id: userId },
            data: { lastSeenSeasonId: seasonId.trim() }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[PROFILE] POST /season-seen error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/profile/family — update parent + children details, mark profile complete
router.put('/family', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { parentName, parentPhone, parentEmail, children } = req.body;

        const childrenArray = Array.isArray(children)
            ? children.map((c: any) => ({
                name: typeof c?.name === 'string' ? c.name : '',
                age: c?.age ?? null,
                birthday: typeof c?.birthday === 'string' ? c.birthday : ''
            }))
            : [];

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                parentName: typeof parentName === 'string' ? parentName : null,
                parentPhone: typeof parentPhone === 'string' ? parentPhone : null,
                parentEmail: typeof parentEmail === 'string' ? parentEmail : null,
                children: JSON.stringify(childrenArray),
                profileCompleted: true
            }
        });

        res.json(shapeProfile(user));
    } catch (error) {
        console.error('[PROFILE] PUT /family error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
