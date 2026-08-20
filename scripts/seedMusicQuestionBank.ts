// Seeds the official Akshara Fine Arts music question banks into QuestionBank.
//
//   npm run seed:music        (requires DATABASE_URL in .env)
//
// Idempotent: every row has a deterministic id and is upserted, so re-running
// updates in place instead of duplicating. For files marked `shuffle: true`
// (answer keys in the source documents are heavily biased toward option A),
// each question's options are shuffled with a PRNG seeded from the row id —
// stable across runs — and correctAnswer is rewritten to the new position.
//
// Music rows use year 0 as a sentinel (music has no exam-year dimension; the
// column is required by the schema shared with academic past-year papers).

import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'api', '_server', 'data', 'seed');

interface SeedQuestion {
    id: string;
    topic: string;
    subtopic?: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    difficulty: string;
    classification?: string; // "Theory" | "Practical"; absent = fits both focuses
    source: string;
    subject?: string;
    grade?: string;
    syllabus?: string;
}

interface SeedFile {
    shuffle: boolean;
    note?: string;
    defaults: { subject: string; grade: string; syllabus: string };
    questions: SeedQuestion[];
}

// Deterministic PRNG (mulberry32) keyed on a string hash, so the option
// shuffle for a given row id is identical on every run.
const hashString = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

const mulberry32 = (seed: number) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const seededShuffle = (q: SeedQuestion): { options: string[]; correctIndex: number } => {
    const rand = mulberry32(hashString(q.id));
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return {
        options: order.map(i => q.options[i]),
        correctIndex: order.indexOf(q.correctIndex)
    };
};

async function main() {
    const files = readdirSync(SEED_DIR).filter(f => f.endsWith('.json'));
    let grandTotal = 0;

    for (const file of files) {
        const data: SeedFile = JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8'));

        if (data.note?.includes('NOT seeded')) {
            console.log(`⏭  ${file}: parked (${data.questions.length} questions, not seeded)`);
            continue;
        }

        let created = 0, updated = 0;
        const answerSpread = [0, 0, 0, 0];

        for (const q of data.questions) {
            const { options, correctIndex } = data.shuffle ? seededShuffle(q) : { options: q.options, correctIndex: q.correctIndex };
            answerSpread[correctIndex]++;

            const row = {
                subject: q.subject ?? data.defaults.subject,
                grade: q.grade ?? data.defaults.grade,
                syllabus: q.syllabus ?? data.defaults.syllabus,
                topic: q.topic,
                subtopic: q.subtopic ?? null,
                year: 0, // sentinel: music content has no exam year
                question: q.question,
                options: JSON.stringify(options),
                correctAnswer: 'ABCD'[correctIndex],
                explanation: q.explanation ?? 'This is the correct answer according to the official Akshara Fine Arts curriculum.',
                difficulty: q.difficulty,
                classification: q.classification ?? null,
                source: q.source
            };

            const existing = await prisma.questionBank.findUnique({ where: { id: q.id } });
            await prisma.questionBank.upsert({
                where: { id: q.id },
                update: row,
                create: { id: q.id, ...row }
            });
            existing ? updated++ : created++;
        }

        grandTotal += created + updated;
        console.log(`✅ ${file}: ${created} created, ${updated} updated (answers A/B/C/D: ${answerSpread.join('/')})`);
    }

    console.log(`\nDone. ${grandTotal} questions in the bank from ${files.length} files.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
