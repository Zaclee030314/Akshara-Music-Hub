// One-off, idempotent data migration for the Indian Music → Carnatic/Hindustani split.
//
//   npm run migrate:music-split      (requires DATABASE_URL in .env)
//
// All rows stored under the retired 'Indian Music' syllabus become 'Carnatic Music'
// (the pre-split content and user base were Carnatic: Sangeetham, Mridangam, Veena,
// Keyboard, Harmonium). Tabla users are moved to 'Hindustani Music'. Re-running is
// safe: once nothing matches 'Indian Music', every updateMany is a no-op.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OLD = 'Indian Music';
const CARNATIC = 'Carnatic Music';
const HINDUSTANI = 'Hindustani Music';

async function main() {
    // Tabla is a Hindustani subject after the split — route Tabla-scoped rows there.
    const tablaQuests = await prisma.quest.updateMany({
        where: { syllabus: OLD, subject: 'Tabla' }, data: { syllabus: HINDUSTANI }
    });
    const tablaBank = await prisma.questionBank.updateMany({
        where: { syllabus: OLD, subject: 'Tabla' }, data: { syllabus: HINDUSTANI }
    });
    const tablaSyllabi = await prisma.courseSyllabus.updateMany({
        where: { syllabus: OLD, subject: 'Tabla' }, data: { syllabus: HINDUSTANI }
    });

    const results = {
        'User.gradeSyllabus': await prisma.user.updateMany({ where: { gradeSyllabus: OLD }, data: { gradeSyllabus: CARNATIC } }),
        'User.subscribedSyllabus': await prisma.user.updateMany({ where: { subscribedSyllabus: OLD }, data: { subscribedSyllabus: CARNATIC } }),
        'PendingUser.syllabus': await prisma.pendingUser.updateMany({ where: { syllabus: OLD }, data: { syllabus: CARNATIC } }),
        'Quest.syllabus': await prisma.quest.updateMany({ where: { syllabus: OLD }, data: { syllabus: CARNATIC } }),
        'QuestionBank.syllabus': await prisma.questionBank.updateMany({ where: { syllabus: OLD }, data: { syllabus: CARNATIC } }),
        'CourseSyllabus.syllabus': await prisma.courseSyllabus.updateMany({ where: { syllabus: OLD }, data: { syllabus: CARNATIC } }),
        'PaperFile.syllabus': await prisma.paperFile.updateMany({ where: { syllabus: OLD }, data: { syllabus: CARNATIC } }),
        'StudyPlan.syllabus': await prisma.studyPlan.updateMany({ where: { syllabus: OLD }, data: { syllabus: CARNATIC } }),
    };

    console.log(`Tabla → Hindustani: quests=${tablaQuests.count}, bank=${tablaBank.count}, topicCaches=${tablaSyllabi.count}`);
    for (const [k, v] of Object.entries(results)) console.log(`${k}: ${v.count} rows → '${CARNATIC}'`);
    console.log('Done. Re-running is a no-op.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
