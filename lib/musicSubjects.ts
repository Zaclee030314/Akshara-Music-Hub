import { Subject, Syllabus } from '../types';

// Single frontend source of truth for which subjects belong to each music syllabus.
// Keep in sync with the AI prompt rules in api/_server/routes/generation.ts.

export const WESTERN_MUSIC_SUBJECTS: Subject[] = [
    Subject.MUSIC_THEORY,
    Subject.PIANO,
    Subject.VIOLIN,
    Subject.GUITAR,
    Subject.WESTERN_VOCAL
];

export const INDIAN_MUSIC_SUBJECTS: Subject[] = [
    Subject.SANGEETHAM,
    Subject.MRIDANGAM,
    Subject.VEENA,
    Subject.KEYBOARD_CARNATIC,
    Subject.HARMONIUM,
    Subject.TABLA
];

/** Subjects offered under a music syllabus; union when the syllabus is unknown. */
export const musicSubjectsFor = (syllabus: Syllabus | string | null | undefined): Subject[] => {
    if (syllabus === Syllabus.WESTERN_MUSIC) return WESTERN_MUSIC_SUBJECTS;
    if (syllabus === Syllabus.INDIAN_MUSIC) return INDIAN_MUSIC_SUBJECTS;
    return [...WESTERN_MUSIC_SUBJECTS, ...INDIAN_MUSIC_SUBJECTS];
};
