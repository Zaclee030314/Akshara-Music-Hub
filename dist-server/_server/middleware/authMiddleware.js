import jwt from 'jsonwebtoken';
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    // Read secret inside handler to ensure it's available after dotenv.config()
    const secret = process.env.JWT_SECRET || 'supersecretkeyshouldbeenv';
    if (!token)
        return res.sendStatus(401);
    jwt.verify(token, secret, (err, user) => {
        if (err) {
            console.error("[AUTH] JWT Verification failed:", err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};
// Billing, family management and account-level settings must be done from the
// parent's own session, never from a child profile the parent switched into.
export const requireParentSession = (req, res, next) => {
    if (req.user?.act === 'child') {
        return res.status(403).json({
            error: 'Switch back to the parent profile to do this.',
            code: 'PARENT_SESSION_REQUIRED'
        });
    }
    next();
};
