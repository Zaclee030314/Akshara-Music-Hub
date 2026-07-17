import { Syllabus, GradeLevel } from '../types';

export const getSyllabusesByCountry = (country: string | null): Syllabus[] => {
    if (country === 'MY') {
        // Malaysia: show everything (music syllabi already included via Object.values)
        return Object.values(Syllabus);
    } else if (country === 'SG') {
        // Singapore: MOE Singapore, IGCSE, IB – no KSSM or UEC – plus music programmes
        return [Syllabus.MOE_SINGAPORE, Syllabus.IGCSE, Syllabus.IB, Syllabus.WESTERN_MUSIC, Syllabus.INDIAN_MUSIC];
    } else {
        // International / undetected: IGCSE and IB only – plus music programmes
        return [Syllabus.IGCSE, Syllabus.IB, Syllabus.MOE_SINGAPORE, Syllabus.WESTERN_MUSIC, Syllabus.INDIAN_MUSIC];
    }
};

export const getGradesBySyllabus = (syll: Syllabus): { primary: GradeLevel[]; secondary: GradeLevel[]; advanced?: GradeLevel[] } => {
    const all = Object.values(GradeLevel);
    switch (syll) {
        case Syllabus.IGCSE:
            return {
                primary: all.filter(g => ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'].includes(g)),
                secondary: all.filter(g => ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'].includes(g)),
                advanced: all.filter(g => ['Year 12', 'Year 13'].includes(g))
            };
        case Syllabus.MOE_SINGAPORE:
            return {
                primary: all.filter(g => g.startsWith('Standard')), // Singapore P1-P6 maps well to Standard 1-6
                secondary: all.filter(g => g.startsWith('Secondary'))
            };
        case Syllabus.IB:
            return {
                primary: all.filter(g => g.startsWith('Year') && parseInt(g.split(' ')[1]) <= 6),
                secondary: all.filter(g => g.startsWith('Year') && parseInt(g.split(' ')[1]) > 6 && parseInt(g.split(' ')[1]) <= 11),
                advanced: all.filter(g => ['Year 12', 'Year 13'].includes(g)) // IB also uses Year 12-13
            };
        case Syllabus.UEC:
            // UEC: Chinese independent schools — Junior Middle (Form 1-3) + Senior Middle (Form 4-6)
            return {
                primary: all.filter(g => [GradeLevel.FORM_1, GradeLevel.FORM_2, GradeLevel.FORM_3].includes(g as GradeLevel)),
                secondary: all.filter(g => [GradeLevel.FORM_4, GradeLevel.FORM_5, GradeLevel.FORM_6].includes(g as GradeLevel))
            };
        case Syllabus.WESTERN_MUSIC:
        case Syllabus.INDIAN_MUSIC:
            // Music grades: Grade 1-4 (foundation) + Grade 5-8 (advanced)
            return {
                primary: all.filter(g => ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'].includes(g)),
                secondary: all.filter(g => ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'].includes(g))
            };
        case Syllabus.KSSR_KSSM:
        default:
            return {
                primary: all.filter(g => g.startsWith('Standard')),
                secondary: all.filter(g => g.startsWith('Form'))
            };
    }
};
