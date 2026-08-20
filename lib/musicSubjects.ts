import { Subject, Syllabus } from '../types';

// Single frontend source of truth for which subjects belong to each music syllabus.
// Keep in sync with the AI prompt rules in api/_server/routes/generation.ts.

// Instruments only — each instrument then splits into a "Theory" or
// "Aural & Practical" study focus (MUSIC_FOCUSES below).
export const WESTERN_MUSIC_SUBJECTS: Subject[] = [
    Subject.GUITAR,
    Subject.PIANO,
    Subject.DRUMS,
    Subject.WESTERN_VOCAL,
    Subject.VIOLIN,
    Subject.TRUMPET,
    Subject.SAXOPHONE,
    Subject.FLUTE,
    Subject.BASS_GUITAR,
    Subject.CELLO,
    Subject.TROMBONE,
    Subject.ORGAN,
    Subject.UKULELE,
    Subject.CLARINET,
    Subject.HARMONICA,
    Subject.VIOLA,
    Subject.OBOE,
    Subject.FRENCH_HORN,
    Subject.BANJO,
    Subject.ACCORDION
];

export const INDIAN_MUSIC_SUBJECTS: Subject[] = [
    Subject.SANGEETHAM,
    Subject.MRIDANGAM,
    Subject.VEENA,
    Subject.KEYBOARD_CARNATIC,
    Subject.HARMONIUM,
    Subject.TABLA
];

// Per-instrument study focus: every music quest is either Theory (concepts,
// notation, terminology, structure) or Aural & Practical (technique, playing
// method, listening, performance practice).
export type MusicFocus = 'Theory' | 'Aural & Practical';
export const MUSIC_FOCUSES: MusicFocus[] = ['Theory', 'Aural & Practical'];

/** Subjects offered under a music syllabus; union when the syllabus is unknown. */
export const musicSubjectsFor = (syllabus: Syllabus | string | null | undefined): Subject[] => {
    if (syllabus === Syllabus.WESTERN_MUSIC) return WESTERN_MUSIC_SUBJECTS;
    if (syllabus === Syllabus.INDIAN_MUSIC) return INDIAN_MUSIC_SUBJECTS;
    return [...WESTERN_MUSIC_SUBJECTS, ...INDIAN_MUSIC_SUBJECTS];
};
