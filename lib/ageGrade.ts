import { Syllabus, GradeLevel } from '../types';

// Age → expected grade mapping, CLIENT copy.
//
// This only drives an OVERRIDABLE SUGGESTION in the signup form — the student can always
// pick a different standard, and the server never trusts what arrives from here. The
// authoritative copy is api/_server/utils/ageGrade.ts, which is what actually gates XP.
// So if the two tables ever drift, the effect is a slightly-off default in a dropdown:
// cosmetic, not a security hole.
//
// ANCHOR (same as the server): `schoolAge` is the age the student TURNS DURING THE
// CURRENT CALENDAR YEAR. Malaysia's intake is "turns 7 that year → Standard 1".

export const isMusicSyllabus = (syllabus?: Syllabus | string | null): boolean =>
    syllabus === Syllabus.WESTERN_MUSIC || syllabus === Syllabus.INDIAN_MUSIC;

// The age the student turns during `now`'s calendar year.
export const schoolAge = (birthday: Date, now: Date): number =>
    now.getUTCFullYear() - birthday.getUTCFullYear();

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);

const formName = (n: number): GradeLevel =>
    n >= 6 ? GradeLevel.FORM_6 : (`Form ${n}` as GradeLevel);

/**
 * Parse a 'YYYY-MM-DD' input value into a UTC-midnight Date.
 * Never `new Date(str)` — that is UTC-parsed then rendered locally and drifts a day.
 */
export const parseBirthdayInput = (value: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (isNaN(date.getTime())) return null;
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return date;
};

/** The grade a student of this birthday is expected to be in. Null for music / unparseable. */
export const expectedGradeFor = (
    syllabus: Syllabus | string | null | undefined,
    birthday: Date,
    now: Date
): GradeLevel | null => {
    if (isMusicSyllabus(syllabus)) return null;

    const a = schoolAge(birthday, now);
    if (!Number.isFinite(a)) return null;

    switch (syllabus) {
        case Syllabus.IGCSE:
        case Syllabus.IB:
            return `Year ${clamp(a - 5, 1, 13)}` as GradeLevel;

        case Syllabus.UEC:
            // No primary tier in the UEC grade list — young students clamp to Form 1.
            return formName(clamp(a - 12, 1, 6));

        case Syllabus.MOE_SINGAPORE:
            if (a < 7) return GradeLevel.STD_1;
            if (a <= 12) return `Standard ${a - 6}` as GradeLevel;
            return `Secondary ${Math.min(a - 12, 5)}` as GradeLevel;

        case Syllabus.KSSR_KSSM:
        default:
            if (a < 7) return GradeLevel.STD_1;
            if (a <= 12) return `Standard ${a - 6}` as GradeLevel;
            if (a <= 17) return formName(a - 12);
            return GradeLevel.FORM_6;
    }
};

/** Convenience for form code: suggest a grade from a raw 'YYYY-MM-DD' string. */
export const suggestGrade = (
    syllabus: Syllabus | string | null | undefined,
    birthdayISO: string
): GradeLevel | null => {
    if (!birthdayISO) return null;
    const d = parseBirthdayInput(birthdayISO);
    if (!d) return null;
    const age = schoolAge(d, new Date());
    if (age < 4 || age > 100) return null;
    return expectedGradeFor(syllabus, d, new Date());
};
