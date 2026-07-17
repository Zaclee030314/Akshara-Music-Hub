import express from 'express';
import prisma from '../db.js';
import { generateAIContent } from '../utils/ai.js';
// import { GoogleGenerativeAI } from '@google/generative-ai';
// import fetch from 'node-fetch'; // DISABLED: Using native fetch (Node 18+)

import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import { checkExpiredSubscriptions } from '../middleware/checkExpiredSubscriptions.js';

const router = express.Router();

// Helper function to check mock mode dynamically
const isMockMode = () => process.env.AI_MOCK_MODE === 'true';

// Types (replicated from client for server usage)
enum Subject {
    MATH = 'Mathematics',
    SCIENCE = 'Science',
    PHYSICS = 'Physics',
    CHEMISTRY = 'Chemistry',
    BIOLOGY = 'Biology',
    ADD_MATH = 'Additional Mathematics',
    COMPUTER_SCIENCE = 'Computer Science',
    BAHASA_MELAYU = 'Bahasa Melayu',
    ENGLISH = 'English',
    SEJARAH = 'Sejarah (History)',
    GEOGRAPHY = 'Geografi',
    ECONOMICS = 'Economics',
    BUSINESS = 'Business Studies',
    EDUCATION_ISLAM = 'Pendidikan Islam',
    EDUCATION_MORAL = 'Pendidikan Moral',
    RBT = 'Reka Bentuk & Teknologi (RBT)'
}

// Helper functions 
const getSubjectCategory = (subject: string) => {
    const stem = [Subject.MATH, Subject.SCIENCE, Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY, Subject.ADD_MATH, Subject.COMPUTER_SCIENCE];
    const langs = [Subject.BAHASA_MELAYU, Subject.ENGLISH];
    const hums = [Subject.SEJARAH, Subject.GEOGRAPHY, Subject.ECONOMICS, Subject.BUSINESS];
    if (stem.includes(subject as Subject)) return 'STEM';
    if (langs.includes(subject as Subject)) return 'LANGS';
    if (hums.includes(subject as Subject)) return 'HUMS';
    return 'VALUES';
};

// Mock Generation Logic (Server Side) 
const generateMockQuestions = (subject: string, grade: string, topic: string, syllabus: string) => {
    return Array.from({ length: 15 }).map((_, i) => ({
        id: `mock-${Date.now()}-${i}`,
        text: `[Server Mock] ${topic} Question ${i + 1} for ${grade}`,
        options: ["A", "B", "C", "D"],
        correctAnswerIndex: 0,
        explanation: "Server mock explanation."
    }));
};

const generateMockSyllabus = () => {
    return ["Mock Topic 1", "Mock Topic 2", "Mock Topic 3", "Mock Topic 4", "Mock Topic 5"];
}

/**
 * SUPER-ROBUST JSON REPAIR
 * Handles truncated or slightly malformed JSON by:
 * 1. Extracting the core JSON part via regex
 * 2. Closing open braces/brackets if truncated
 */
const superRepairJSON = (text: string): any => {
    // Stage 1: Basic Extraction
    let cleaned = text.trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        // If no full match, try to find the start and fix the end
        const startIdx = cleaned.indexOf('{');
        if (startIdx !== -1) {
            cleaned = cleaned.substring(startIdx);
        } else {
            const arrStartIdx = cleaned.indexOf('[');
            if (arrStartIdx !== -1) cleaned = cleaned.substring(arrStartIdx);
            else throw new Error("No JSON start found");
        }
    } else {
        cleaned = jsonMatch[0];
    }

    // Stage 2: Balanced Brackets (Repair Truncation)
    const stack: string[] = [];
    let insideString = false;
    let escape = false;
    let lastValidIdx = cleaned.length;

    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (char === '\\') {
            escape = true;
            continue;
        }
        if (char === '"') {
            insideString = !insideString;
            continue;
        }
        if (!insideString) {
            if (char === '{' || char === '[') {
                stack.push(char);
            } else if (char === '}' || char === ']') {
                const last = stack.pop();
                if ((char === '}' && last !== '{') || (char === ']' && last !== '[')) {
                    // Mismatch - might be malformed in the middle
                }
            }
        }
    }

    // If we are inside an unterminated string, close it
    if (insideString) cleaned += '"';

    // Close remaining brackets in reverse order
    while (stack.length > 0) {
        const last = stack.pop();
        if (last === '{') cleaned += '}';
        if (last === '[') cleaned += ']';
    }

    return JSON.parse(cleaned);
};

// ... Limit Check & Increment ...
router.post('/quest', authenticateToken, checkExpiredSubscriptions, async (req: AuthRequest, res) => {
    const { subject, grade, topic, syllabus, isPastYear, year } = req.body;
    const userId = req.user?.id;

    if (userId) {
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });

            // Check Limit
            if (user && !user.isSubscribed && user.questsPlayed >= 3) {
                console.log(`[GEN] ❌ Limit reached for user ${userId}`);
                return res.status(403).json({
                    error: "Free limit reached. Upgrade to Pro for unlimited quests!",
                    code: "USER_LIMIT_REACHED"
                });
            }

            // Increment Usage (Count attempt)
            if (user && !user.isSubscribed) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { questsPlayed: { increment: 1 } }
                });
                console.log(`[GEN] Incremented usage for user ${userId}`);
            }
        } catch (error) {
            console.error("[GEN] Error checking/updating user limit:", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }

    console.log(`[GEN] Request: ${subject} / ${grade} / ${topic || 'Full Paper'} / ${syllabus} ${isPastYear ? `(Past Year ${year})` : ''}`);

    // Check API Key
    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ [GEN] GEMINI_API_KEY is MISSING in environment.");
        return res.status(500).json({
            error: "Gemini API Key is missing. Please add it to your .env file or Vercel environment variables.",
            instruction: "Go to https://aistudio.google.com/app/apikey to get a new key."
        });
    }

    if (isMockMode()) {
        console.warn("⚠️ [GEN] AI_MOCK_MODE is ON. But user requested real questions. Stopping here to prevent mock data.");
        return res.status(403).json({ error: "Mock mode is enabled in .env but real questions were requested." });
    }

    // ─── PAST YEAR: STRICT QuestionBank requirement ───────────────────
    if (isPastYear && year) {
        try {
            const parsedYear = parseInt(String(year).split(' ')[0], 10);
            if (!isNaN(parsedYear)) {
                // Smart Matching: Extract key acronyms (KSSR, KSSM, IGCSE, SPM, etc.)
                const acronyms = (syllabus.match(/\b(KSSR|KSSM|IGCSE|SPM|UPSR|PT3|STPM|IB)\b/gi) || [])
                    .map(a => a.toUpperCase());

                const sKeywords = syllabus.split('(')[0].trim();

                // Grade Normalization: Standard 1 <-> Year 1 <-> Grade 1
                const gradeMatch = grade.match(/\d+/);
                const gradeNum = gradeMatch ? gradeMatch[0] : null;
                const gradeVariations = gradeNum ? [
                    `Standard ${gradeNum}`,
                    `Year ${gradeNum}`,
                    `Grade ${gradeNum}`,
                    `Form ${gradeNum}`,
                    grade
                ] : [grade];

                const realQuestions = await prisma.questionBank.findMany({
                    where: {
                        subject,
                        grade: { in: gradeVariations },
                        year: parsedYear,
                        OR: [
                            { syllabus: { contains: sKeywords, mode: 'insensitive' } },
                            { syllabus: syllabus },
                            ...acronyms.map(a => ({ syllabus: { contains: a, mode: 'insensitive' } }))
                        ]
                    },
                    orderBy: { createdAt: 'asc' },
                });

                if (realQuestions.length > 0) {
                    console.log(`✅ [GEN] Found ${realQuestions.length} real QuestionBank questions for ${subject}/${grade}/${parsedYear} (Variations: ${gradeVariations.join(', ')})`);

                    const formatted = realQuestions.map((q: any) => {
                        let options: string[] = [];
                        try { options = JSON.parse(q.options); } catch { options = ['A', 'B', 'C', 'D']; }
                        const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
                        const correctAnswerIndex = letterMap[q.correctAnswer?.toUpperCase()] ?? 0;

                        return {
                            id: `real-${q.id}`,
                            text: q.question,
                            options,
                            correctAnswerIndex,
                            explanation: q.explanation || 'No explanation provided.',
                            source: q.source || `${subject} ${year}`,
                            isRealQuestion: true,
                        };
                    });

                    // Return all found questions (max 50 to keep it manageable but satisfying)
                    return res.json(formatted.sort(() => Math.random() - 0.5).slice(0, 50));
                } else {
                    console.warn(`❌ [GEN] No Questions Found in Bank for ${subject} ${grade} ${parsedYear}.`);
                    return res.status(404).json({
                        error: "No questions found in the official bank for this year.",
                        instruction: "Administrator: Please use the 'AI Generate & Import' tool in the Admin Dashboard to add these questions."
                    });
                }
            }
        } catch (dbErr: any) {
            console.error(`❌ [GEN] DB lookup failed: ${dbErr.message}`);
            return res.status(500).json({ error: "Failed to retrieve questions from database." });
        }
    }


    try {
        // PURE AI GENERATION - Skip database entirely
        // GEMINI GENERATION - Generate questions with Gemini
        console.log("🤖 [GEN] Generating questions with Gemini...");

        let prompt = "";
        if (isPastYear) {
            // Resolve official exam name from syllabus + grade
            const examName = (() => {
                const s = syllabus.toLowerCase();
                const g = grade.toLowerCase();
                if (s.includes('uec')) return 'UEC (Unified Examination Certificate)'; 
                if (s.includes('kssr') || s.includes('kssm') || s.includes('malaysian')) {
                    if (g.includes('form 5')) return 'SPM (Sijil Pelajaran Malaysia)';
                    if (g.includes('form 3')) return 'PT3 (Pentaksiran Tingkatan 3)';
                    if (g.includes('standard 6')) return 'UPSR (Ujian Pencapaian Sekolah Rendah)';
                    if (g.includes('form 6')) return 'STPM (Sijil Tinggi Persekolahan Malaysia)';
                    return 'Malaysian National Exam';
                }
                if (s.includes('igcse') || s.includes('cambridge')) return 'Cambridge IGCSE';
                if (s.includes('singapore') || s.includes('moe')) return 'Singapore GCE O-Level';
                if (s.includes('ib')) return 'IB (International Baccalaureate)';
                return syllabus;
            })();

            // Language Selection for UEC & National Exams
            const targetLanguage = (() => {
                const s = syllabus.toLowerCase();
                const sub = subject.toLowerCase();
                if (s.includes('uec')) {
                    if (sub.includes('bahasa melayu') || sub.includes('sejarah')) return 'Bahasa Melayu (Malay)';
                    if (sub.includes('english')) return 'English';
                    return 'Simplified Chinese (简体中文)';
                }
                if (s.includes('kssr') || s.includes('kssm') || s.includes('malaysian')) {
                    if (sub.includes('english')) return 'English';
                    return 'Bahasa Melayu (Malay)';
                }
                return 'English';
            })();

            prompt = `You are an expert exam question compiler with comprehensive knowledge of official past year exam papers.

TASK: Reproduce 15-20 actual multiple-choice questions from the official ${examName} ${year} paper for ${subject} at ${grade} level.

CRITICAL RULES — READ CAREFULLY:
1. LANGUAGE: The entire question, options, and explanation MUST be written in ${targetLanguage}. This is strict.
2. RECALL REAL QUESTIONS: You were trained on official ${examName} past year papers published before your cutoff. Reproduce questions that genuinely appeared in or are extremely representative of the actual ${year} ${subject} paper. Do NOT invent generic revision questions.
3. CORRECT ANSWERS MUST BE 100% ACCURATE: Every correctAnswerIndex must be provably correct based on the official answer scheme. Wrong answers here are a serious failure.
4. REALISTIC DISTRACTORS: The wrong options must be the same plausible misconceptions that students commonly choose in the real exam — not obviously wrong choices.
5. YEAR-SPECIFIC EMPHASIS: Reflect the specific topics stressed in the ${year} paper.
6. FULL PAPER COVERAGE: Distribute questions across the main chapters/topics of ${subject} at ${grade} level.
7. DIFFICULTY SPREAD: Include approximately 8 easy, 10 medium, and 7 challenging questions.

Syllabus-specific rules:
${syllabus.toLowerCase().includes('kssr') || syllabus.toLowerCase().includes('malaysian') ? `- Follow Malaysian DSKP standards exactly.
- Use correct Malaysian terminology.
- SPM Paper 1 is all MCQ.` : ''}
${syllabus.toLowerCase().includes('uec') ? `- Follow Dong Zong (UEC) standards and terminology for ${grade}.
- Use official UEC subject naming conventions.` : ''}
${syllabus.toLowerCase().includes('igcse') || syllabus.toLowerCase().includes('cambridge') ? `- Use the official Cambridge ${subject} syllabus code.
- Match Cambridge command words exactly (state, describe, explain).` : ''}

`;
        } else {
            // General Generation Language
            const targetLanguage = (() => {
                const s = syllabus.toLowerCase();
                const sub = subject.toLowerCase();
                if (s.includes('uec')) {
                    if (sub.includes('bahasa melayu') || sub.includes('sejarah')) return 'Bahasa Melayu (Malay)';
                    if (sub.includes('english')) return 'English';
                    return 'Simplified Chinese (简体中文)';
                }
                if (s.includes('kssr') || s.includes('kssm') || s.includes('malaysian')) {
                    if (sub.includes('english')) return 'English';
                    return 'Bahasa Melayu (Malay)';
                }
                return 'English';
            })();

            prompt = `Generate a set of high-quality multiple-choice questions for:
            - Subject: ${subject}
            - Grade: ${grade}
            - Topic: ${topic}
            - Syllabus: ${syllabus}
            - Target Language: ${targetLanguage}
            
            CRITICAL INSTRUCTIONS:
            1. Language: Write the entire output (questions, options, explanations) in ${targetLanguage}.
            2. Format: ${grade} level, ${syllabus} standards
            3. Content: 4 options (A-D), correct index (0-3)
            `;
        }

        prompt += `
        GENERAL QUALITY RULES:
        1. QUANTITY: Generate 15-20 questions. No fewer than 15.
        2. RANDOMIZED ANSWERS: Ensure the correct answer (correctAnswerIndex) is evenly distributed among 0, 1, 2, and 3 across the entire set of questions. For example, in a set of 20 questions, roughly 5 should have index 0 (A), 5 should have index 1 (B), 5 should have index 2 (C), and 5 should have index 3 (D). Do NOT put the correct answer in the same position for every question.
        3. Simplicity: Use ONLY basic alphanumeric characters and standard punctuation. AVOID complex nesting or unusual symbols.
        4. Explanation Quality: Each explanation MUST be specific to the question. It must:
           - Directly state WHY the correct answer is right (cite the specific law, formula, fact, or rule)
           - Briefly explain why a common wrong choice is misleading
           - Be 2-3 sentences maximum. Do NOT write generic study notes.
           - GOOD example: "The correct answer is chlorophyll because it is the pigment that absorbs light energy for photosynthesis. Option B (glucose) is wrong because glucose is the product of photosynthesis, not the absorber."
           - BAD example: "This is an important topic in biology." — This is not acceptable.

        JSON SPECIFICATION:
        Return ONLY a valid JSON object with this exact structure:
        {"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correctAnswerIndex": 0, "explanation": "..."}]}
        `;

        try {
            console.log(`🤖 [GEN] Requesting Gemini (JSON Mode: Super-Robust 2.5)...`);
            const responseText = await generateAIContent(prompt, "gemini-2.5-flash", "application/json");

            if (!responseText) {
                console.error("❌ [GEN] Empty AI response");
                return res.json(generateMockQuestions(subject, grade, topic, syllabus));
            }

            console.log(`✅ [GEN] Received response (${responseText.length} chars). Parsing...`);

            // Try to parse the JSON with Super Repair
            let aiQuestions;
            try {
                const parsed = superRepairJSON(responseText);
                aiQuestions = parsed.questions || (Array.isArray(parsed) ? parsed : null);
            } catch (parseError: any) {
                console.error(`❌ [GEN] JSON Critical Failure: ${parseError.message}`);
                console.log(`[GEN] Full Response for Debug: ${responseText}`);
                return res.json(generateMockQuestions(subject, grade, topic, syllabus));
            }

            // Validate the questions have the right structure
            if (!Array.isArray(aiQuestions) || aiQuestions.length === 0) {
                console.error("❌ [GEN] Invalid questions format, using mock");
                return res.json(generateMockQuestions(subject, grade, topic, syllabus));
            }

            // Map to ensure consistent field names (question vs text)
            const formattedQuestions = aiQuestions.map((q: any, i: number) => ({
                id: `ai-${Date.now()}-${i}`,
                text: q.question || q.text || `Question ${i + 1}`,
                options: q.options || ["A", "B", "C", "D"],
                correctAnswerIndex: q.correctAnswerIndex ?? q.correctAnswer ?? 0,
                explanation: q.explanation || "No explanation provided"
            }));

            console.log(`✅ [GEN] Generated ${formattedQuestions.length} questions with Gemini`);
            
            // ─── ROBUST OPTION SHUFFLING ───────────────────────────────────
            // Ensure the correct answer is randomized (A, B, C, or D) for every question
            const randomizedQuestions = formattedQuestions.map((q: any) => {
                const options = [...q.options];
                const correctOptionText = options[q.correctAnswerIndex];
                
                // Fisher-Yates Shuffle
                for (let i = options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [options[i], options[j]] = [options[j], options[i]];
                }
                
                // Find new index of the correct answer
                const newCorrectIndex = options.indexOf(correctOptionText);
                
                return {
                    ...q,
                    options,
                    correctAnswerIndex: newCorrectIndex !== -1 ? newCorrectIndex : q.correctAnswerIndex
                };
            });

            return res.json(randomizedQuestions);
        } catch (error: any) {
            console.error("❌ [GEN] Error:", error.message);
            return res.status(500).json({
                error: `AI Generation failed: ${error.message}`,
                details: "Check your GEMINI_API_KEY in .env. If it's expired, you must renew it at Google AI Studio."
            });
        }
    } catch (error: any) {
        console.error("❌ [GEN] Outer Error:", error.message);
        console.error(error.stack);
        res.status(500).json({ error: "Generation Failed", details: error.message });
    }
});

router.post('/syllabus', async (req, res) => {
    const { subject, grade, syllabus, forceRefresh } = req.body;
    console.log(`[SYLLABUS] Request: ${subject} / ${grade} / ${syllabus}${forceRefresh ? ' (FORCE REFRESH)' : ''}`);

    if (isMockMode()) {
        console.log(`✅ [SYLLABUS] Using mock mode, returning mock data`);
        return res.json(generateMockSyllabus());
    }

    try {
        // 1. Check DB Cache (Skip if forceRefresh is true)
        if (!forceRefresh) {
            const cached = await prisma.courseSyllabus.findUnique({
                where: {
                    subject_grade_syllabus: { subject, grade, syllabus }
                }
            });

            if (cached) {
                console.log(`✅ [SYLLABUS] Found cached syllabus`);
                return res.json(JSON.parse(cached.topics));
            }
        } else {
            console.log(`[SYLLABUS] Bypassing cache due to forceRefresh`);
        }

        // AI SYLLABUS GENERATION with Gemini
        console.log(`🤖 [SYLLABUS] Generating syllabus with Gemini for: ${subject} ${grade} (JSON Mode)`);

        const prompt = `Generate a comprehensive list of syllabus topics for:
        - Subject: ${subject}
        - Grade Level: ${grade}
        - Syllabus/Curriculum: ${syllabus}

        INSTRUCTIONS:
        1. Base this on the OFFICIAL current curriculum.
        2. For KSSR/KSSM (Malaysian), align with latest DSKP standards.
        3. For IGCSE, align with Cambridge curriculum.
        4. For UEC, align with Dong Zong standards.
        5. Include 10-20 key topics to ensure full coverage. 
        6. STRICT FORMATTING: Each topic MUST start with "Topic X: " (e.g., Topic 1, Topic 2).
        7. DETAILED STRUCTURE: Include the main sub-topics in parentheses.
           Example: "Topic 1: Quadratic Functions (Graphs, Roots, Completing the Square)"
        8. UNIVERSAL APPLICABILITY: This must work for ANY subject (Mathematics, Computer Science, Biology, Languages, etc.).

        JSON SPECIFICATION:
        Return ONLY a JSON object with a "topics" key containing a flat array of strings.
        Example:
        {"topics": ["Topic 1: Topic Name (Subtopic A, Subtopic B)", "Topic 2: Topic Name (Subtopic C)"]}
        `;

        let responseText;
        try {
            responseText = await generateAIContent(prompt, "gemini-2.5-flash", "application/json");
        } catch (apiError: any) {
            console.error(`❌ [SYLLABUS] Gemini API Error: ${apiError.message}`);
            return res.status(500).json({
                error: `Syllabus generation failed: ${apiError.message}`,
                instruction: "Please check your GEMINI_API_KEY in .env."
            });
        }

        if (!responseText) {
            console.error("❌ [SYLLABUS] Empty AI response");
            return res.json(generateMockSyllabus());
        }

        console.log(`✅ [SYLLABUS] Received response (${responseText.length} chars). Parsing...`);

        let topics = [];
        try {
            const parsed = superRepairJSON(responseText);
            topics = parsed.topics || (Array.isArray(parsed) ? parsed : []);
        } catch (e: any) {
            console.error(`❌ [SYLLABUS] JSON Critical Failure: ${e.message}`);
            console.log(`[SYLLABUS] Full Response for Debug: ${responseText}`);
            return res.status(500).json({ error: "AI returned invalid JSON. Please try again." });
        }

        if (topics.length === 0) {
            console.warn("⚠️ [SYLLABUS] No topics parsed");
            return res.status(500).json({ error: "AI failed to generate topics." });
        }

        console.log(`✅ [SYLLABUS] Generated ${topics.length} topics with Gemini`);

        // Cache it for future use
        await prisma.courseSyllabus.upsert({
            where: {
                subject_grade_syllabus: { subject, grade, syllabus }
            },
            update: { topics: JSON.stringify(topics) },
            create: { subject, grade, syllabus, topics: JSON.stringify(topics) }
        });

        return res.json(topics);
    } catch (error: any) {
        console.error("❌ [SYLLABUS] Unexpected Error:", error.message);
        return res.status(500).json({ error: "Unexpected error during syllabus generation." });
    }
});

router.post('/study-plan', authenticateToken, checkExpiredSubscriptions, async (req: AuthRequest, res) => {
    const { subject, grade, syllabus, timeframe, hoursPerDay, goals } = req.body;
    const userId = req.user?.id;

    console.log(`[STUDY-PLAN] Request: ${subject} / ${grade} / ${syllabus} - ${timeframe} - ${hoursPerDay}h/day`);

    if (userId) {
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });

            // Check Limit reusing questsPlayed as a general AI generation count for now, 
            // or we could let subscribers have unlimited. Let's apply the same check.
            if (user && !user.isSubscribed && user.questsPlayed >= 5) { // Give a bit more leeway for study plans or use same limit
                console.log(`[STUDY-PLAN] ❌ Limit reached for user ${userId}`);
                return res.status(403).json({
                    error: "Free AI generation limit reached. Upgrade to Pro for unlimited features!",
                    code: "USER_LIMIT_REACHED"
                });
            }

            // Increment Usage
            if (user && !user.isSubscribed) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { questsPlayed: { increment: 1 } }
                });
            }
        } catch (error) {
            console.error("[STUDY-PLAN] Error checking/updating user limit:", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key is missing." });
    }

    if (isMockMode()) {
        console.log(`✅ [STUDY-PLAN] Using mock mode`);
        return res.json({
            title: `Study Plan: ${subject} (${grade})`,
            overview: "A mock study plan for testing.",
            weeks: [
                {
                    weekNumber: 1,
                    focus: "Foundational Concepts",
                    days: [
                        { 
                            day: "Day 1", 
                            tasks: [
                                { title: "Review Chapter 1: Real Numbers", topicSearch: "Real Numbers" },
                                { title: "Complete 10 MCQs on Fractions", topicSearch: "Fractions" }
                            ] 
                        },
                        { 
                            day: "Day 2", 
                            tasks: [
                                { title: "Practice Algebra basics", topicSearch: "Algebra" }
                            ] 
                        }
                    ]
                }
            ],
            tips: ["Stay hydrated", "Take short breaks"]
        });
    }

    try {
        console.log(`🤖 [STUDY-PLAN] Generating with Gemini...`);

        const prompt = `Act as an expert academic tutor and create a highly effective, personalized study plan.
        
        STUDENT PROFILE:
        - Subject: ${subject}
        - Grade Level: ${grade}
        - Syllabus/Curriculum: ${syllabus}
        - Timeframe: ${timeframe}
        - Daily Study Commitment: ${hoursPerDay} hours per day
        - Additional Goals/Focus: ${goals || 'General mastery and exam preparation'}

        - Commitment: ${hoursPerDay} hours per day
        ${goals ? `- Specific Goals: ${goals}` : ""}

        IMPORTANT: Keep it simple and clean. Use MINIMAL words. 
        - Title should be very short (max 5 words).
        - Overview should be max 2 sentences.
        - Task titles should be extremely concise (max 4-5 words).
        - Provide max 3 high-impact tips.

        Return ONLY a JSON object with this structure:
        {
          "title": "Short Course Title",
          "overview": "Brief 1-2 sentence strategy.",
          "weeks": [
            {
              "weekNumber": 1,
              "focus": "Short Weekly Focus",
              "days": [
                {
                  "day": "Day 1",
                  "tasks": [
                    { "title": "Concise task description", "topicSearch": "Exact topic name for practice" }
                  ]
                }
              ]
            }
          ],
        }
        
        CRITICAL: 
        1. Each task MUST be an object with "title" and "topicSearch".
        2. "topicSearch" should be a 1-3 word keyword that represents the mathematical or academic topic (e.g., "Algebra", "Calculus", "Probability", "Human Rights", "Volcanoes"). This will be used to deep-link the student to specific practice questions.
        3. Give tasks like "Complete 10 MCQ questions on [Topic]", "Review [Topic] theory", etc.
        `;

        let responseText;
        try {
            responseText = await generateAIContent(prompt, "gemini-2.5-flash", "application/json");
        } catch (apiError: any) {
            console.error(`❌ [STUDY-PLAN] Gemini API Error: ${apiError.message}`);
            return res.status(500).json({ error: `AI generation failed: ${apiError.message}` });
        }

        if (!responseText) {
            return res.status(500).json({ error: "Empty response from AI" });
        }

        let planData;
        try {
            planData = superRepairJSON(responseText);
        } catch (e: any) {
            console.error(`❌ [STUDY-PLAN] JSON parse failed: ${e.message}`);
            return res.status(500).json({ error: "AI returned invalid JSON." });
        }

        // --- NEW: Persist the Study Plan ---
        if (userId && planData.weeks) {
            try {
                // We'll replace the existing plan for this subject/grade if it exists, 
                // or just keep one active plan overall. The prompt suggests a simpler clean tracking.
                // Let's replace any existing plan for the SAME user to keep it clean.
                await prisma.studyPlan.deleteMany({
                    where: { userId }
                });

                const createdPlan = await prisma.studyPlan.create({
                    data: {
                        userId,
                        title: planData.title,
                        overview: planData.overview,
                        subject,
                        grade,
                        syllabus,
                        timeframe,
                        tasks: {
                            create: planData.weeks.flatMap((week: any) => 
                                week.days.flatMap((day: any) => 
                                    day.tasks.map((task: any) => ({
                                        weekNumber: parseInt(String(week.weekNumber)),
                                        day: day.day,
                                        title: task.title,
                                        topicSearch: task.topicSearch
                                    }))
                                )
                            )
                        }
                    }
                });
                console.log(`✅ [STUDY-PLAN] Saved to DB (ID: ${createdPlan.id})`);
                planData.id = createdPlan.id; // Return the ID to the client
            } catch (dbErr) {
                console.error("❌ [STUDY-PLAN] DB Save Error:", dbErr);
                // We don't fail the request if saving fails, but alert in logs
            }
        }

        console.log(`✅ [STUDY-PLAN] Generated successfully`);
        return res.json(planData);
    } catch (error: any) {
        console.error("❌ [STUDY-PLAN] Error:", error.message);
        return res.status(500).json({ error: "Failed to generate study plan." });
    }
});


export default router;
