import express from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/rewards — list all active rewards (authenticated users)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Single tuition centre: every student sees all active rewards
        const rewards = await prisma.reward.findMany({
            where: { isActive: true },
            orderBy: { coinCost: 'asc' }
        });
        res.json(rewards);
    } catch (error) {
        console.error('[REWARDS] Error fetching rewards:', error);
        res.status(500).json({ error: 'Failed to fetch rewards' });
    }
});

// GET /api/rewards/all — list ALL rewards incl. inactive (teacher management)
router.get('/all', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        const isAdmin = user?.isAdmin || false;

        const whereClause = isAdmin ? {} : { creatorId: userId };

        const rewards = await prisma.reward.findMany({ 
            where: whereClause,
            orderBy: { coinCost: 'asc' } 
        });
        res.json(rewards);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rewards' });
    }
});

// POST /api/rewards — create a new reward (teacher)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    const { title, description, icon, coinCost, stock, imageUrl } = req.body;
    const userId = req.user?.id;
    if (!title || !description || coinCost === undefined) {
        return res.status(400).json({ error: 'title, description and coinCost are required' });
    }
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const reward = await prisma.reward.create({
            data: {
                title,
                description,
                icon: icon || '🎁',
                coinCost: parseInt(coinCost),
                stock: stock !== undefined && stock !== '' ? parseInt(stock) : null,
                imageUrl: imageUrl || null,
                isActive: true,
                creatorId: userId
            }
        });
        res.json(reward);
    } catch (error) {
        console.error('[REWARDS] Create error:', error);
        res.status(500).json({ error: 'Failed to create reward' });
    }
});

// PUT /api/rewards/:id — update a reward (teacher)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { title, description, icon, coinCost, stock, imageUrl, isActive } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const current = await prisma.reward.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Reward not found' });
        
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (current.creatorId !== userId && !user?.isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const reward = await prisma.reward.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(icon !== undefined && { icon }),
                ...(coinCost !== undefined && { coinCost: parseInt(coinCost) }),
                ...(stock !== undefined && { stock: stock === '' || stock === null ? null : parseInt(stock) }),
                ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
                ...(isActive !== undefined && { isActive }),
            }
        });
        res.json(reward);
    } catch (error) {
        console.error('[REWARDS] Update error:', error);
        res.status(500).json({ error: 'Failed to update reward' });
    }
});

// PATCH /api/rewards/:id/toggle — toggle active/inactive
router.patch('/:id/toggle', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const current = await prisma.reward.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Reward not found' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (current.creatorId !== userId && !user?.isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const updated = await prisma.reward.update({ where: { id }, data: { isActive: !current.isActive } });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle reward' });
    }
});

// DELETE /api/rewards/:id — delete a reward (teacher)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const current = await prisma.reward.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Reward not found' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (current.creatorId !== userId && !user?.isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.reward.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('[REWARDS] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete reward' });
    }
});

// POST /api/rewards/redeem/:rewardId — redeem a reward
router.post('/redeem/:rewardId', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const { rewardId } = req.params;
    const { receiverName, receiverPhone, receiverAddress } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const [reward, user] = await Promise.all([
            prisma.reward.findUnique({ where: { id: rewardId } }),
            prisma.user.findUnique({ where: { id: userId } })
        ]);

        if (!reward) return res.status(404).json({ error: 'Reward not found' });
        if (!reward.isActive) return res.status(400).json({ error: 'This reward is no longer available' });
        if (reward.stock !== null && reward.stock <= 0) {
            return res.status(400).json({ error: 'This reward is out of stock' });
        }
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.coins < reward.coinCost) {
            return res.status(400).json({ error: `Not enough coins. You need ${reward.coinCost} coins but have ${user.coins}.` });
        }

        const [redemption] = await prisma.$transaction([
            prisma.redemption.create({
                data: { userId, rewardId, receiverName, receiverPhone, receiverAddress }
            }),
            prisma.user.update({
                where: { id: userId },
                data: { coins: { decrement: reward.coinCost } }
            }),
            ...(reward.stock !== null
                ? [prisma.reward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } })]
                : [])
        ]);

        res.json({ success: true, redemption, coinsSpent: reward.coinCost });
    } catch (error) {
        console.error('[REWARDS] Redemption error:', error);
        res.status(500).json({ error: 'Failed to redeem reward' });
    }
});

// GET /api/rewards/my-redemptions — get current user's redemption history
router.get('/my-redemptions', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const redemptions = await prisma.redemption.findMany({
            where: { userId },
            include: { reward: true },
            orderBy: { redeemedAt: 'desc' }
        });
        res.json(redemptions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch redemptions' });
    }
});

export default router;
