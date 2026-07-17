// Grade ranking utilities for award gating.
// Academic family: Standard 1-6 (rank 1-6), Form 1-6 (rank 7-12, "Form 6 (STPM)" → 12),
// Year 1-13 (rank 1-13), Secondary 1-5 (rank 7-11).
// Music family: Grade N (rank N).

export const gradeRank = (grade: string | null | undefined): { family: 'academic' | 'music'; rank: number } | null => {
    if (!grade) return null;
    const cleaned = grade.replace(' (STPM)', '').trim();

    const match = cleaned.match(/^(Standard|Form|Year|Secondary|Grade)\s+(\d+)$/i);
    if (!match) return null;

    const prefix = match[1].toLowerCase();
    const n = parseInt(match[2], 10);
    if (isNaN(n)) return null;

    switch (prefix) {
        case 'standard':
            return { family: 'academic', rank: n };
        case 'form':
            return { family: 'academic', rank: 6 + n };
        case 'year':
            return { family: 'academic', rank: n };
        case 'secondary':
            return { family: 'academic', rank: 6 + n };
        case 'grade':
            return { family: 'music', rank: n };
        default:
            return null;
    }
};

// True when points should be awarded: unknown/unparseable grades never gate,
// different families never gate, and playing at or above your own rank earns points.
export const shouldAwardPoints = (
    userGrade: string | null | undefined,
    quizGrade: string | null | undefined
): boolean => {
    const userRank = gradeRank(userGrade);
    if (!userRank) return true;

    const quizRank = gradeRank(quizGrade);
    if (!quizRank) return true;

    if (userRank.family !== quizRank.family) return true;

    return quizRank.rank >= userRank.rank;
};
