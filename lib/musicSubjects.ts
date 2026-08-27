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

export const CARNATIC_MUSIC_SUBJECTS: Subject[] = [
    Subject.SANGEETHAM,
    Subject.MRIDANGAM,
    Subject.VEENA,
    Subject.KEYBOARD_CARNATIC,
    Subject.HARMONIUM
];

export const HINDUSTANI_MUSIC_SUBJECTS: Subject[] = [
    Subject.HINDUSTANI_VOCAL,
    Subject.TABLA,
    Subject.HARMONIUM,
    Subject.SITAR
];

// Per-instrument study focus: every music quest is either Theory (concepts,
// notation, terminology, structure) or Aural & Practical (technique, playing
// method, listening, performance practice).
export type MusicFocus = 'Theory' | 'Aural & Practical';
export const MUSIC_FOCUSES: MusicFocus[] = ['Theory', 'Aural & Practical'];

/** True for any music syllabus ('Indian Music' kept for legacy stored rows). */
export const isMusicSyllabus = (syllabus: Syllabus | string | null | undefined): boolean =>
    syllabus === Syllabus.WESTERN_MUSIC ||
    syllabus === Syllabus.CARNATIC_MUSIC ||
    syllabus === Syllabus.HINDUSTANI_MUSIC ||
    syllabus === 'Indian Music';

/** Subjects offered under a music syllabus; union when the syllabus is unknown. */
export const musicSubjectsFor = (syllabus: Syllabus | string | null | undefined): Subject[] => {
    if (syllabus === Syllabus.WESTERN_MUSIC) return WESTERN_MUSIC_SUBJECTS;
    if (syllabus === Syllabus.CARNATIC_MUSIC || syllabus === 'Indian Music') return CARNATIC_MUSIC_SUBJECTS;
    if (syllabus === Syllabus.HINDUSTANI_MUSIC) return HINDUSTANI_MUSIC_SUBJECTS;
    return [...WESTERN_MUSIC_SUBJECTS, ...CARNATIC_MUSIC_SUBJECTS, ...HINDUSTANI_MUSIC_SUBJECTS.filter(s => s !== Subject.HARMONIUM)];
};
