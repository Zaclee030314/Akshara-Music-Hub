import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Initialize environment variables BEFORE importing routes
import fs from 'fs';
import path from 'path';

// Load base .env first
dotenv.config();

// Load .env.local and override if it exists
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
}

const key = process.env.GEMINI_API_KEY || '';
console.log(`[BOOT] GEMINI_API_KEY loaded. Ending in: "...${key.substring(key.length - 6)}"`);

// Import routes - Vercel will bundle these automatically
import authRoutes from './_server/routes/auth.js';
import questRoutes from './_server/routes/quests.js';
import resultRoutes from './_server/routes/results.js';
import subscriptionRoutes from './_server/routes/subscription.js';
import generationRoutes from './_server/routes/generation.js';
import testRoutes from './_server/routes/test.js';
import webhookRoutes from './_server/routes/webhooks.js';
import adminRoutes from './_server/routes/admin.js';
import rewardRoutes from './_server/routes/rewards.js';
import questionBankRoutes from './questionBank.js';
import paperFilesRoutes from './_server/routes/paperFiles.js';
import studyPlansRoutes from './_server/routes/studyPlans.js';
import classroomRoutes from './_server/routes/classrooms.js';
import assignmentRoutes from './_server/routes/assignments.js';
import leaderboardRoutes from './_server/routes/leaderboard.js';
import profileRoutes from './_server/routes/profile.js';
import seasonRoutes from './_server/routes/seasons.js';
import pollRoutes from './_server/routes/polls.js';

const app = express();
console.log("[VERCEL] Starting serverless function...");

app.use(cors());

// Webhook route MUST come before express.json() to use raw body
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '150mb' }));

// Log all requests
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/generate', generationRoutes);
app.use('/api/test', testRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/question-bank', questionBankRoutes);
app.use('/api/paper-files', paperFilesRoutes);
app.use('/api/study-plans', studyPlansRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/seasons', seasonRoutes);
app.use('/api/polls', pollRoutes);

app.get('/api', (req, res) => {
    res.send('Akshara Music Hub API is running on Vercel');
});

export default app;
