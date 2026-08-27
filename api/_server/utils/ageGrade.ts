// Age → expected grade mapping. AUTHORITATIVE copy (the server gates XP with this).
//
// ANCHOR: `schoolAge` is the age the student TURNS DURING THE CURRENT CALENDAR YEAR
// (year difference only — NOT the birthday-adjusted age). Malaysia's school intake is
// "a child who turns 7 during the year enters Standard 1", so a student who turns 13
// this year is in Form 1 for the whole year, regardless of whether their birthday has
// passed yet. Every table below is keyed off that number.
//
// This drives the XP/coin award gate in routes/results.ts: the gate is computed from the
// student's immutable birthday, NOT from the standard they picked, so a student cannot
// set themselves to Standard 1 and farm points on easy quizzes.
//
// Music syllabi (Western/Carnatic/Hindustani) have no age→grade relationship — a
// 40-year-old can legitimately be a Grade 1 pianist — so they return null and keep
// gating on the selected grade.

// Absorbs ±1 year of legitimate drift: repeated years, skipped years, students who
// started school early/late, southern-hemisphere transfers, and the year-boundary edge.
export const GATE_LENIENCY = 1;

export const isMusicSyllabus = (syllabus?: string | null): boolean =>
    syllabus === 'Western Music' ||
    syllabus === 'Carnatic Music' ||
    syllabus === 'Hindustani Music' ||
    syllabus === 'Indian Music'; // legacy stored value, pre-split

// The age the student turns during `now`'s calendar year.
export const schoolAge = (birthday: Date, now: Date): number =>
    now.getUTCFullYear() - birthday.getUTCFullYear();

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);

// 'Form 6 (STPM)' is the literal GradeLevel.FORM_6 string — never emit a bare 'Form 6'.
const FORM_6 = 'Form 6 (STPM)';
const formName = (n: number): string => (n >= 6 ? FORM_6 : `Form ${n}`);

/**
 * The grade a student of this birthday is expected to be in, for the given syllabus.
 * Returns null when the syllabus has no age mapping (music) or is unparseable.
 */
export const expectedGradeFor = (
    syllabus: string | null | undefined,
    birthday: Date,
    now: Date
): string | null => {
    if (isMusicSyllabus(syllabus)) return null;

    const a = schoolAge(birthday, now);
    if (!Number.isFinite(a)) return null;

    switch (syllabus) {
        case 'Cambridge IGCSE':
        case 'International Baccalaureate (IB)':
            // Year 1 at age 6 — deliberately the lenient side of the UK/IB intake.
            return `Year ${clamp(a - 5, 1, 13)}`;

        case 'Unified Examination Certificate (UEC)':
            // Chinese independent schools: Junior Middle 1-3 + Senior Middle 1-3.
            // No primary tier exists in the UEC grade list, so young students clamp to Form 1.
            return formName(clamp(a - 12, 1, 6));

        case 'Singapore National Curriculum':
            if (a < 7) return 'Standard 1';
            if (a <= 12) return `Standard ${a - 6}`;
            return `Secondary ${Math.min(a - 12, 5)}`;

        case 'Malaysia National Curriculum':
        default:
            // Unknown/null syllabus falls back to the Malaysian ladder (the default cohort).
            if (a < 7) return 'Standard 1';
            if (a <= 12) return `Standard ${a - 6}`;
            if (a <= 17) return formName(a - 12);
            return FORM_6;
    }
};
