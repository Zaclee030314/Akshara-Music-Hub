import jwt from 'jsonwebtoken';
import type { Request } from 'express';

// Resolve the caller's user id from a bearer token WITHOUT requiring one.
//
// Used by public routes that render slightly richer output for a signed-in
// visitor (e.g. "your standing" on a leaderboard) but must still answer
// anonymous requests. A missing, malformed or expired token is not an error
// here — it simply means "anonymous", so we return null rather than 401.
export const optionalUserId = (req: Request): string | null => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    try {
        const secret = process.env.JWT_SECRET || 'supersecretkeyshouldbeenv';
        const payload: any = jwt.verify(token, secret);
        return payload?.id || null;
    } catch {
        // invalid/expired token — treat as anonymous
        return null;
    }
};
