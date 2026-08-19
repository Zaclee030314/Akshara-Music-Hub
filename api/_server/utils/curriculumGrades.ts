// Server-side mirror of lib/curriculum.ts `getGradesBySyllabus`, as plain strings.
// Used to validate a student-submitted { gradeSyllabus, grade } pair on PUT /api/profile —
// the frontend list cannot be trusted, so the allowed pairs are re-checked here.
// Keep in sync with lib/curriculum.ts and the Syllabus/GradeLevel enums in types.ts.

const STANDARDS = ['Standard 1', 'Standard 2', 'Standard 3', 'Standard 4', 'Standard 5', 'Standard 6'];
const FORMS = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6 (STPM)'];
const YEARS = [
    'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7',
    'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'
];
const SECONDARIES = ['Secondary 1', 'Secondary 2', 'Secondary 3', 'Secondary 4', 'Secondary 5'];
const MUSIC_GRADES_WESTERN = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'
];
const MUSIC_GRADES_INDIAN = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
    'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'
];

// The 7 Syllabus enum string values.
export const SYLLABUSES: string[] = [
    'Malaysia National Curriculum',
    'Singapore National Curriculum',
    'Cambridge IGCSE',
    'Unified Examination Certificate (UEC)',
    'International Baccalaureate (IB)',
    'Western Music',
    'Indian Music'
];

export const isValidSyllabus = (syllabus: unknown): syllabus is string =>
    typeof syllabus === 'string' && SYLLABUSES.includes(syllabus);

/** Every grade string selectable under a given syllabus. */
export const gradesForSyllabus = (syllabus: string): string[] => {
    switch (syllabus) {
        case 'Cambridge IGCSE':
        case 'International Baccalaureate (IB)':
            return [...YEARS];
        case 'Singapore National Curriculum':
            return [...STANDARDS, ...SECONDARIES];
        case 'Unified Examination Certificate (UEC)':
            return [...FORMS];
        case 'Western Music':
            return [...MUSIC_GRADES_WESTERN];
        case 'Indian Music':
            return [...MUSIC_GRADES_INDIAN];
        case 'Malaysia National Curriculum':
        default:
            return [...STANDARDS, ...FORMS];
    }
};

export const isValidGradeForSyllabus = (syllabus: string, grade: unknown): grade is string =>
    typeof grade === 'string' && gradesForSyllabus(syllabus).includes(grade);
