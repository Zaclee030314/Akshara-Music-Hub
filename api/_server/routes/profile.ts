import express from 'express';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../db.js';
import { expectedGradeFor, schoolAge } from '../utils/ageGrade.js';
import { isValidSyllabus, isValidGradeForSyllabus } from '../utils/curriculumGrades.js';

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

// Parse a 'YYYY-MM-DD' string into a UTC-midnight Date.
// NEVER `new Date('2012-03-04')` directly — that is parsed as UTC and then rendered in
// local time, which shifts the date by a day for anyone west of Greenwich.
const parseBirthday = (value: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (isNaN(date.getTime())) return null;
    // Reject rolled-over dates like 2012-02-31.
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return date;
};

// Shape the profile fields returned to the client.
const shapeProfile = (user: any) => {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        grade: user.grade,
        gradeSyllabus: user.gradeSyllabus,
        birthday: user.birthday ? new Date(user.birthday).toISOString().slice(0, 10) : null,
        // The standard the student's XP is actually judged at (null for music / no birthday).
        expectedGrade: user.birthday
            ? expectedGradeFor(user.gradeSyllabus, new Date(user.birthday), new Date())
            : null,
        avatar: user.avatar,
        parentName: user.parentName,
        parentPhone: user.parentPhone,
        parentEmail: user.parentEmail,
        profileCompleted: user.profileCompleted,
        referralCreditCents: user.referralCreditCents ?? 0,
        language: user.language ?? null
    };
};

// Supported UI languages for the language-preference endpoint.
const SUPPORTED_LANGUAGES = ['en', 'ms', 'zh', 'ta'];

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

// PUT /api/profile — update name, avatar, syllabus/standard, and (once) birthday
router.put('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name, avatar, grade, gradeSyllabus, birthday } = req.body;
        const data: {
            name?: string;
            avatar?: string;
            grade?: string;
            gradeSyllabus?: string;
            birthday?: Date;
        } = {};

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

        // Syllabus + standard are student-editable: they only drive which content is shown.
        // XP earning is gated on the student's age group, so changing these cannot be
        // used to farm points (see utils/ageGrade.ts and routes/results.ts).
        if (gradeSyllabus !== undefined) {
            if (!isValidSyllabus(gradeSyllabus)) {
                return res.status(400).json({ error: 'Unknown syllabus' });
            }
            data.gradeSyllabus = gradeSyllabus;
        }

        if (grade !== undefined) {
            // Validate against the syllabus being set in this same request, falling back
            // to the one already on the account.
            const existing = await prisma.user.findUnique({
                where: { id: userId },
                select: { gradeSyllabus: true }
            });
            const effectiveSyllabus = data.gradeSyllabus ?? existing?.gradeSyllabus ?? null;
            if (!effectiveSyllabus || !isValidSyllabus(effectiveSyllabus)) {
                return res.status(400).json({ error: 'Please choose a syllabus before selecting a standard' });
            }
            if (!isValidGradeForSyllabus(effectiveSyllabus, grade)) {
                return res.status(400).json({ error: 'That standard is not available for the selected syllabus' });
            }
            data.grade = grade;
        }

        // Birthday is a ONE-TIME backfill for accounts created before birthdays were
        // captured at signup. Once set it is immutable here — the age-based XP gate reads
        // it, so a self-service edit would reopen the exploit it exists to close.
        // Corrections must go through staff.
        if (birthday !== undefined) {
            const current = await prisma.user.findUnique({
                where: { id: userId },
                select: { birthday: true }
            });
            if (current?.birthday) {
                return res.status(400).json({
                    error: 'Your date of birth is already on file and cannot be changed here. Please contact your teacher or Akshara staff to correct it.'
                });
            }
            if (typeof birthday !== 'string') {
                return res.status(400).json({ error: 'Date of birth must be in YYYY-MM-DD format' });
            }
            const parsed = parseBirthday(birthday);
            if (!parsed) {
                return res.status(400).json({ error: 'Date of birth must be a valid date in YYYY-MM-DD format' });
            }
            const age = schoolAge(parsed, new Date());
            if (age < 4 || age > 100) {
                return res.status(400).json({ error: 'Please enter a valid date of birth' });
            }
            data.birthday = parsed;
        }

        const user = await prisma.user.update({ where: { id: userId }, data });
        res.json(shapeProfile(user));
    } catch (error) {
        console.error('[PROFILE] PUT error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/profile/language — persist the user's preferred UI language
router.put('/language', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { language } = req.body;
        if (typeof language !== 'string' || !SUPPORTED_LANGUAGES.includes(language)) {
            return res.status(400).json({ error: 'Unsupported language' });
        }

        await prisma.user.update({ where: { id: userId }, data: { language } });
        res.json({ success: true, language });
    } catch (error) {
        console.error('[PROFILE] PUT /language error:', error);
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

// PUT /api/profile/family — update parent details, mark profile complete
router.put('/family', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { parentName, parentPhone, parentEmail } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                parentName: typeof parentName === 'string' ? parentName : null,
                parentPhone: typeof parentPhone === 'string' ? parentPhone : null,
                parentEmail: typeof parentEmail === 'string' ? parentEmail : null,
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
