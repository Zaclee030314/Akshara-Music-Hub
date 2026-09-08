import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { authenticateToken, requireParentSession, AuthRequest } from '../middleware/authMiddleware.js';
import { childEmailFor, activeChildren, MAX_PROFILES } from '../utils/family.js';
import { isValidSyllabus, isValidGradeForSyllabus } from '../utils/curriculumGrades.js';
import { getUserSeasonXp } from '../utils/seasonScore.js';

// ─── Family profiles (Netflix-style "Who's learning?") ───────────────────────
//
//   GET    /api/family                 → parent summary + child profiles
//   POST   /api/family/setup           → convert this student account into parent + child #1
//   POST   /api/family/children        → add a child profile
//   PUT    /api/family/children/:id    → edit a child profile
//   DELETE /api/family/children/:id    → archive a child profile
//   POST   /api/family/switch/:id      → child-scoped token for that profile
//
// Children never log in. The parent's token is `{id, role:'parent'}`; a switched
// session carries `{id: childId, role:'student', parentId, act:'child'}` so every
// existing per-user route (quests, results, XP, leaderboard) just works for the child,
// while `requireParentSession` keeps billing and family management parent-only.

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyshouldbeenv';

const parseBirthday = (value: unknown): Date | null => {
    if (typeof value !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (isNaN(date.getTime())) return null;
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return date;
};

interface ChildInput { name: string; birthday: Date | null; grade: string | null; gradeSyllabus: string | null; }

// Validate one child payload. `requireBirthday` is true for new profiles.
type ChildRead = { ok: true; value: ChildInput; error?: undefined } | { ok: false; error: string; value?: undefined };
const readChildInput = (raw: any, requireBirthday: boolean): ChildRead => {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name) return { ok: false, error: 'Each profile needs a name.' };
    if (name.length > 60) return { ok: false, error: 'Name is too long.' };

    let birthday: Date | null = null;
    if (raw?.birthday !== undefined && raw?.birthday !== null && raw?.birthday !== '') {
        birthday = parseBirthday(raw.birthday);
        if (!birthday) return { ok: false, error: `Invalid date of birth for ${name}.` };
    } else if (requireBirthday) {
        return { ok: false, error: `Date of birth is required for ${name}.` };
    }

    let gradeSyllabus: string | null = null;
    let grade: string | null = null;
    if (raw?.gradeSyllabus) {
        if (!isValidSyllabus(raw.gradeSyllabus)) return { ok: false, error: `Unknown syllabus for ${name}.` };
        gradeSyllabus = raw.gradeSyllabus;
        if (raw?.grade) {
            if (!isValidGradeForSyllabus(raw.gradeSyllabus, raw.grade)) {
                return { ok: false, error: `${raw.grade} is not a valid grade for ${raw.gradeSyllabus}.` };
            }
            grade = raw.grade;
        }
    } else if (raw?.grade) {
        return { ok: false, error: `Choose a syllabus for ${name} before a grade.` };
    }

    return { ok: true, value: { name, birthday, grade, gradeSyllabus } };
};

const shapeChild = async (c: { id: string; name: string; avatar: string | null; grade: string | null; gradeSyllabus: string | null; birthday: Date | null; xp: number; coins: number; createdAt: Date; profileCompleted: boolean }, index: number, seats: number) => {
    const seasonXp = await getUserSeasonXp(c.id, new Date());
    return {
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        grade: c.grade,
        gradeSyllabus: c.gradeSyllabus,
        birthday: c.birthday ? c.birthday.toISOString().slice(0, 10) : null,
        xp: c.xp,
        seasonXp,
        level: Math.floor(seasonXp / 1000) + 1,
        coins: c.coins,
        seatIndex: index,
        seatCovered: index < seats,
        profileCompleted: c.profileCompleted
    };
};

// Resolve the family root (the parent) for the caller — a parent, or a child's parent.
const familyRootFor = async (userId: string) => {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, parentId: true, role: true } });
    if (!me) return null;
    const rootId = me.parentId || me.id;
    return prisma.user.findUnique({ where: { id: rootId } });
};

// GET /api/family
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const root = await familyRootFor(req.user!.id);
        if (!root) return res.status(404).json({ error: 'User not found' });
        if (root.role !== 'parent') {
            return res.json({ isFamily: false, parent: null, profiles: [], activeProfileId: null, maxProfiles: MAX_PROFILES });
        }
        const children = await activeChildren(root.id);
        const profiles = await Promise.all(children.map((c, i) => shapeChild(c, i, root.subscriptionSeats)));
        res.json({
            isFamily: true,
            parent: {
                id: root.id,
                name: root.name,
                email: root.email,
                avatar: root.avatar,
                subscriptionSeats: root.subscriptionSeats,
                isSubscribed: root.isSubscribed,
                subscriptionLevel: root.subscriptionLevel,
                subscribedSyllabus: root.subscribedSyllabus,
                subscriptionEndDate: root.subscriptionEndDate,
                cancelAtPeriodEnd: root.cancelAtPeriodEnd
            },
            profiles,
            activeProfileId: req.user!.act === 'child' ? req.user!.id : null,
            maxProfiles: MAX_PROFILES
        });
    } catch (error) {
        console.error('[FAMILY] GET error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/family/setup — turn this student account into a parent account whose
// first child profile is the current learner (keeps XP, results, grade, birthday).
router.post('/setup', authenticateToken, requireParentSession, async (req: AuthRequest, res) => {
    try {
        const current = await prisma.user.findUnique({ where: { id: req.user!.id } });
        if (!current) return res.status(404).json({ error: 'User not found' });
        if (current.parentId) return res.status(400).json({ error: 'This is already a child profile.' });
        if (current.role === 'parent') return res.status(400).json({ error: 'Family profiles are already set up.' });
        if (current.role !== 'student') return res.status(400).json({ error: 'Only student accounts can be converted into family accounts.' });

        const rawChildren = Array.isArray(req.body?.children) ? req.body.children : [];
        const extra: ChildInput[] = [];
        for (const raw of rawChildren) {
            const r = readChildInput(raw, true);
            if (!r.ok) return res.status(400).json({ error: r.error });
            extra.push(r.value);
        }
        if (1 + extra.length > MAX_PROFILES) {
            return res.status(400).json({ error: `A family can have at most ${MAX_PROFILES} profiles.` });
        }

        const firstName = typeof req.body?.firstProfileName === 'string' && req.body.firstProfileName.trim()
            ? req.body.firstProfileName.trim().slice(0, 60)
            : current.name;
        const parentDisplayName = typeof req.body?.parentName === 'string' && req.body.parentName.trim()
            ? req.body.parentName.trim().slice(0, 60)
            : (current.parentName || current.name);

        const parentId = crypto.randomUUID();
        // Child rows never log in; give the extra profiles an unguessable password hash.
        const childPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

        await prisma.$transaction(async (tx) => {
            // 1. Free the unique e-mail / referral code so the parent row can take them,
            //    and strip account-level state from what becomes child profile #1.
            await tx.user.update({
                where: { id: current.id },
                data: {
                    email: childEmailFor(current.id),
                    name: firstName,
                    referralCode: null,
                    referredById: null,
                    referralCreditCents: 0,
                    referralRewardGranted: false,
                    stripeCustomerId: null,
                    isSubscribed: false,
                    subscriptionInterval: null,
                    subscriptionStartDate: null,
                    subscriptionEndDate: null,
                    subscriptionLevel: null,
                    subscribedSyllabus: null,
                    cancelAtPeriodEnd: false,
                    isAdmin: false,
                    questsPlayed: 0,
                    questsCreated: 0,
                    profileCompleted: true
                }
            });

            // 2. The parent account inherits the login, subscription and referral state.
            await tx.user.create({
                data: {
                    id: parentId,
                    email: current.email,
                    password: current.password,
                    name: parentDisplayName,
                    role: 'parent',
                    parentName: current.parentName || parentDisplayName,
                    parentPhone: current.parentPhone,
                    parentEmail: current.parentEmail,
                    children: current.children,
                    profileCompleted: true,
                    isVerified: true,
                    isAdmin: current.isAdmin,
                    createdAt: current.createdAt,
                    stripeCustomerId: current.stripeCustomerId,
                    isSubscribed: current.isSubscribed,
                    subscriptionInterval: current.subscriptionInterval,
                    subscriptionStartDate: current.subscriptionStartDate,
                    subscriptionEndDate: current.subscriptionEndDate,
                    subscriptionLevel: current.subscriptionLevel,
                    subscribedSyllabus: current.subscribedSyllabus,
                    cancelAtPeriodEnd: current.cancelAtPeriodEnd,
                    subscriptionSeats: 1,
                    questsPlayed: current.questsPlayed,
                    questsCreated: 0,
                    referralCode: current.referralCode,
                    referredById: current.referredById,
                    referralCreditCents: current.referralCreditCents,
                    referralRewardGranted: current.referralRewardGranted,
                    language: current.language,
                    lastSeenSeasonId: current.lastSeenSeasonId
                }
            });

            // 3. Link child #1 and move referral bookkeeping onto the parent.
            await tx.user.update({ where: { id: current.id }, data: { parentId } });
            await tx.user.updateMany({ where: { referredById: current.id }, data: { referredById: parentId } });
            await tx.referralEarning.updateMany({ where: { referrerId: current.id }, data: { referrerId: parentId } });
            await tx.referralEarning.updateMany({ where: { referredUserId: current.id }, data: { referredUserId: parentId } });

            // 4. Extra children.
            for (const c of extra) {
                const id = crypto.randomUUID();
                await tx.user.create({
                    data: {
                        id,
                        email: childEmailFor(id),
                        password: childPasswordHash,
                        name: c.name,
                        role: 'student',
                        grade: c.grade,
                        gradeSyllabus: c.gradeSyllabus,
                        birthday: c.birthday,
                        parentId,
                        parentName: current.parentName || parentDisplayName,
                        parentPhone: current.parentPhone,
                        parentEmail: current.parentEmail,
                        isVerified: true,
                        profileCompleted: true,
                        language: current.language
                    }
                });
            }
        });

        const token = jwt.sign({ id: parentId, role: 'parent' }, JWT_SECRET, { expiresIn: '7d' });
        console.log(`[FAMILY] Converted ${current.email} into a parent account with ${1 + extra.length} profile(s)`);
        res.json({ token, parentId, profiles: 1 + extra.length });
    } catch (error) {
        console.error('[FAMILY] setup error:', error);
        res.status(500).json({ error: 'Could not set up family profiles' });
    }
});

// Every management route below requires a real parent session on a parent account.
const requireParentAccount = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true } });
    if (!me || me.role !== 'parent') return res.status(403).json({ error: 'Family profiles are not set up on this account.' });
    next();
};

// POST /api/family/children
router.post('/children', authenticateToken, requireParentSession, requireParentAccount, async (req: AuthRequest, res) => {
    try {
        const parentId = req.user!.id;
        const r = readChildInput(req.body, true);
        if (!r.ok) return res.status(400).json({ error: r.error });

        const count = await prisma.user.count({ where: { parentId, archivedAt: null } });
        if (count >= MAX_PROFILES) return res.status(400).json({ error: `A family can have at most ${MAX_PROFILES} profiles.` });

        const parent = await prisma.user.findUnique({ where: { id: parentId } });
        const id = crypto.randomUUID();
        const created = await prisma.user.create({
            data: {
                id,
                email: childEmailFor(id),
                password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
                name: r.value.name,
                role: 'student',
                grade: r.value.grade,
                gradeSyllabus: r.value.gradeSyllabus,
                birthday: r.value.birthday,
                parentId,
                parentName: parent?.parentName || parent?.name,
                parentPhone: parent?.parentPhone,
                parentEmail: parent?.parentEmail,
                isVerified: true,
                profileCompleted: true,
                language: parent?.language
            }
        });
        const children = await activeChildren(parentId);
        const index = children.findIndex(c => c.id === created.id);
        res.json(await shapeChild(children[index], index, parent?.subscriptionSeats ?? 1));
    } catch (error) {
        console.error('[FAMILY] add child error:', error);
        res.status(500).json({ error: 'Could not add profile' });
    }
});

// PUT /api/family/children/:id — name, avatar, syllabus/grade; birthday only if unset.
router.put('/children/:id', authenticateToken, requireParentSession, requireParentAccount, async (req: AuthRequest, res) => {
    try {
        const parentId = req.user!.id;
        const child = await prisma.user.findFirst({ where: { id: req.params.id, parentId, archivedAt: null } });
        if (!child) return res.status(404).json({ error: 'Profile not found' });

        const data: Record<string, any> = {};
        if (req.body?.name !== undefined) {
            const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
            if (!name) return res.status(400).json({ error: 'Name cannot be empty.' });
            data.name = name.slice(0, 60);
        }
        if (req.body?.avatar !== undefined) {
            const avatar = req.body.avatar;
            if (avatar !== null) {
                if (typeof avatar !== 'string' || !avatar.startsWith('data:')) return res.status(400).json({ error: 'Avatar must be a data URL image' });
                if (avatar.length > 400000) return res.status(400).json({ error: 'Avatar image is too large.' });
            }
            data.avatar = avatar;
        }
        if (req.body?.gradeSyllabus !== undefined || req.body?.grade !== undefined) {
            const syllabus = req.body.gradeSyllabus ?? child.gradeSyllabus;
            const grade = req.body.grade ?? child.grade;
            if (syllabus && !isValidSyllabus(syllabus)) return res.status(400).json({ error: 'Unknown syllabus.' });
            if (grade && (!syllabus || !isValidGradeForSyllabus(syllabus, grade))) {
                return res.status(400).json({ error: `${grade} is not a valid grade for ${syllabus || 'this syllabus'}.` });
            }
            data.gradeSyllabus = syllabus || null;
            data.grade = grade || null;
        }
        if (req.body?.birthday !== undefined && req.body.birthday !== '' && req.body.birthday !== null) {
            if (child.birthday) return res.status(400).json({ error: 'Date of birth cannot be changed once set.' });
            const b = parseBirthday(req.body.birthday);
            if (!b) return res.status(400).json({ error: 'Invalid date of birth.' });
            data.birthday = b;
        }

        await prisma.user.update({ where: { id: child.id }, data });
        const parent = await prisma.user.findUnique({ where: { id: parentId }, select: { subscriptionSeats: true } });
        const children = await activeChildren(parentId);
        const index = children.findIndex(c => c.id === child.id);
        res.json(await shapeChild(children[index], index, parent?.subscriptionSeats ?? 1));
    } catch (error) {
        console.error('[FAMILY] edit child error:', error);
        res.status(500).json({ error: 'Could not update profile' });
    }
});

// DELETE /api/family/children/:id — soft delete; keeps results/XP history intact.
router.delete('/children/:id', authenticateToken, requireParentSession, requireParentAccount, async (req: AuthRequest, res) => {
    try {
        const parentId = req.user!.id;
        const child = await prisma.user.findFirst({ where: { id: req.params.id, parentId, archivedAt: null } });
        if (!child) return res.status(404).json({ error: 'Profile not found' });
        const count = await prisma.user.count({ where: { parentId, archivedAt: null } });
        if (count <= 1) return res.status(400).json({ error: 'A family needs at least one profile.' });
        await prisma.user.update({ where: { id: child.id }, data: { archivedAt: new Date() } });
        res.json({ success: true });
    } catch (error) {
        console.error('[FAMILY] archive child error:', error);
        res.status(500).json({ error: 'Could not remove profile' });
    }
});

// POST /api/family/switch/:id — issue a child-scoped session token.
router.post('/switch/:id', authenticateToken, requireParentSession, requireParentAccount, async (req: AuthRequest, res) => {
    try {
        const parentId = req.user!.id;
        const child = await prisma.user.findFirst({
            where: { id: req.params.id, parentId, archivedAt: null },
            select: { id: true, name: true }
        });
        if (!child) return res.status(404).json({ error: 'Profile not found' });
        const token = jwt.sign({ id: child.id, role: 'student', parentId, act: 'child' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, profileId: child.id, name: child.name });
    } catch (error) {
        console.error('[FAMILY] switch error:', error);
        res.status(500).json({ error: 'Could not switch profile' });
    }
});

export default router;
