import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import { checkExpiredSubscriptions } from '../middleware/checkExpiredSubscriptions.js';
import prisma from '../db.js';
import { sendOTPEmail, sendPasswordResetEmail } from '../services/mailService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyshouldbeenv';

// Emails that are always granted platform-admin access (owner + operators).
// Auto-applied on login/verify so no manual DB edit is required.
const ADMIN_EMAILS = new Set<string>([
    'khlee030314@gmail.com',
]);
const isAdminEmail = (email: string): boolean => ADMIN_EMAILS.has(email.trim().toLowerCase());

// SIGNUP
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    // Public sign-ups are always students. Teacher/admin accounts are provisioned
    // by an admin from the Admin dashboard — never self-selected here.
    const role = 'student';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'This email is already registered. Please login instead.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to PendingUser instead of User
        await prisma.pendingUser.upsert({
            where: { email },
            update: {
                name,
                password: hashedPassword,
                role,
                verificationCode
            },
            create: {
                name,
                email,
                password: hashedPassword,
                role,
                verificationCode
            }
        });



        // Send real email
        const emailSent = await sendOTPEmail(email, verificationCode);

        if (!emailSent) {
            console.error(`[AUTH] Failed to send email to ${email}. Code was: ${verificationCode}`);
            return res.status(500).json({
                error: 'Verification email could not be sent. Please contact support or try again later.',
                debug: process.env.NODE_ENV === 'development' ? `Code: ${verificationCode}` : undefined
            });
        }

        res.json({ message: 'Verification code sent to your email', email });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
            code: error.code,
            meta: error.meta,
            stack: process.env.NODE_ENV === 'development' || true ? error.stack : undefined
        });
    }
});

// VERIFY
router.post('/verify', async (req, res) => {
    const { email, code } = req.body;

    try {
        const pendingUser = await prisma.pendingUser.findUnique({ where: { email } });
        if (!pendingUser) {
            // Check if already verified
            const registeredUser = await prisma.user.findUnique({ where: { email } });
            if (registeredUser) {
                return res.status(400).json({ error: 'Email already verified. Please login.' });
            }
            return res.status(404).json({ error: 'No pending registration found for this email.' });
        }

        if (pendingUser.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Move to User table
        const user = await prisma.user.create({
            data: {
                name: pendingUser.name,
                email: pendingUser.email,
                password: pendingUser.password,
                role: pendingUser.role,
                isVerified: true,
                isAdmin: isAdminEmail(pendingUser.email)
            }
        });

        // Delete from PendingUser
        await prisma.pendingUser.delete({ where: { email } });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isAdmin: user.isAdmin,
                isSubscribed: user.isSubscribed,
                subscriptionInterval: user.subscriptionInterval,
                subscriptionStartDate: user.subscriptionStartDate,
                subscriptionEndDate: user.subscriptionEndDate,
                subscriptionLevel: user.subscriptionLevel,
                subscribedSyllabus: user.subscribedSyllabus,
                cancelAtPeriodEnd: user.cancelAtPeriodEnd,
                questsPlayed: user.questsPlayed,
                questsCreated: user.questsCreated
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// RESEND OTP
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;
    try {
        const pendingUser = await prisma.pendingUser.findUnique({ where: { email } });

        if (!pendingUser) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (user) return res.status(400).json({ error: 'Email already verified.' });
            return res.status(404).json({ error: 'User not found' });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        await prisma.pendingUser.update({
            where: { email },
            data: { verificationCode }
        });

        // Send real email
        const emailSent = await sendOTPEmail(email, verificationCode);

        res.json({ message: 'New verification code sent. If email fails, check server/otp_test_fallback.txt', email });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    const { identifier, email, password } = req.body;
    const loginId = identifier || email; // Support both for backward compatibility

    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: loginId },
                    { name: loginId }
                ]
            },
            include: { _count: { select: { results: true } } }
        });

        if (!user) {
            // Check if they are pending verification
            const pending = await prisma.pendingUser.findUnique({ where: { email: loginId } });
            if (pending) {
                return res.status(403).json({
                    error: 'Your email is not verified. Please check your email for the code.',
                    needsVerification: true,
                    email: pending.email
                });
            }
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log(`[AUTH] Login failed: Invalid password for ${loginId}`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Self-heal admin access for allow-listed emails
        let isAdmin = user.isAdmin;
        if (isAdminEmail(user.email) && !user.isAdmin) {
            await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
            isAdmin = true;
            console.log(`[AUTH] Promoted ${user.email} to admin`);
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                xp: user.xp,
                coins: user.coins,
                isSubscribed: user.isSubscribed,
                subscriptionInterval: user.subscriptionInterval,
                subscriptionStartDate: user.subscriptionStartDate,
                subscriptionEndDate: user.subscriptionEndDate,
                subscriptionLevel: user.subscriptionLevel,
                subscribedSyllabus: user.subscribedSyllabus,
                cancelAtPeriodEnd: user.cancelAtPeriodEnd,
                isAdmin,
                questsPlayed: user.questsPlayed,
                questsCreated: user.questsCreated,
                completedQuizzes: user._count.results
            }
        });
    } catch (error) {
        console.error("[AUTH] Login error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ... (subscribe route) ...

// GET ME
router.get('/me', authenticateToken, checkExpiredSubscriptions, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { _count: { select: { results: true } } }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Self-heal admin access for allow-listed emails
        let isAdmin = user.isAdmin;
        if (isAdminEmail(user.email) && !user.isAdmin) {
            await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
            isAdmin = true;
        }

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                xp: user.xp,
                coins: user.coins,
                level: Math.floor(user.xp / 1000) + 1,
                isSubscribed: user.isSubscribed,
                subscriptionInterval: user.subscriptionInterval,
                subscriptionStartDate: user.subscriptionStartDate,
                subscriptionEndDate: user.subscriptionEndDate,
                subscriptionLevel: user.subscriptionLevel,
                subscribedSyllabus: user.subscribedSyllabus,
                cancelAtPeriodEnd: user.cancelAtPeriodEnd,
                isAdmin,
                questsPlayed: user.questsPlayed,
                questsCreated: user.questsCreated,
                completedQuizzes: user._count.results
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// FORGOT PASSWORD - Step 1: Send OTP to email
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'No account found with that email address.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.user.update({
            where: { email },
            data: {
                resetPasswordOtp: otp,
                resetPasswordOtpExpiry: expiry
            }
        });

        const emailSent = await sendPasswordResetEmail(email, otp);
        if (!emailSent) {
            return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
        }

        console.log(`[AUTH] Password reset OTP sent to ${email}`);
        res.json({ message: 'Password reset code sent to your email.', email });
    } catch (error) {
        console.error('[AUTH] forgot-password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// VERIFY RESET OTP - Step 2: Validate OTP, return short-lived reset token
router.post('/verify-reset-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpiry) {
            return res.status(400).json({ error: 'No password reset request found. Please request a new code.' });
        }

        if (user.resetPasswordOtp !== otp) {
            return res.status(400).json({ error: 'Invalid reset code. Please try again.' });
        }

        if (new Date() > user.resetPasswordOtpExpiry) {
            return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
        }

        // Issue a short-lived token that allows password reset (5 minutes)
        const resetToken = jwt.sign(
            { id: user.id, purpose: 'password_reset' },
            JWT_SECRET,
            { expiresIn: '5m' }
        );

        res.json({ message: 'OTP verified successfully.', resetToken });
    } catch (error) {
        console.error('[AUTH] verify-reset-otp error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// RESET PASSWORD - Step 3: Set new password using reset token
router.post('/reset-password', async (req, res) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
        return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    try {
        let payload: any;
        try {
            payload = jwt.verify(resetToken, JWT_SECRET);
        } catch (e) {
            return res.status(400).json({ error: 'Reset link has expired or is invalid. Please request a new one.' });
        }

        if (payload.purpose !== 'password_reset') {
            return res.status(400).json({ error: 'Invalid reset token.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: payload.id },
            data: {
                password: hashedPassword,
                resetPasswordOtp: null,
                resetPasswordOtpExpiry: null
            }
        });

        console.log(`[AUTH] Password reset successfully for user ${payload.id}`);
        res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (error) {
        console.error('[AUTH] reset-password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

