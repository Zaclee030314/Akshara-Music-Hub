import { Question, Subject, GradeLevel, Syllabus } from "../types";

const isMockMode = import.meta.env.VITE_AI_MOCK_MODE === 'true';

// Read the currently selected site language (persisted by LanguageContext).
// AI-generated content follows this language server-side.
const currentLang = () => localStorage.getItem('quest_lang') || 'en';

const getSubjectCategory = (subject: string): 'STEM' | 'LANGS' | 'HUMS' | 'VALUES' => {
  const stem = [Subject.MATH, Subject.SCIENCE, Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY, Subject.ADD_MATH, Subject.COMPUTER_SCIENCE];
  const langs = [Subject.BAHASA_MELAYU, Subject.ENGLISH];
  const hums = [Subject.SEJARAH, Subject.GEOGRAPHY, Subject.ECONOMICS, Subject.BUSINESS];

  if (stem.includes(subject as Subject)) return 'STEM';
  if (langs.includes(subject as Subject)) return 'LANGS';
  if (hums.includes(subject as Subject)) return 'HUMS';
  return 'VALUES';
};

const getGradeCategory = (grade: string): 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' => {
  if (grade.includes('Standard 1') || grade.includes('Standard 2') || grade.includes('Standard 3') || grade.includes('Year 1') || grade.includes('Year 2') || grade.includes('Year 3')) return 'BASIC';
  if (grade.includes('Standard 4') || grade.includes('Standard 5') || grade.includes('Standard 6') || grade.includes('Form 1') || grade.includes('Year 4') || grade.includes('Year 5') || grade.includes('Year 6')) return 'INTERMEDIATE';
  return 'ADVANCED';
};

const generateMockContent = async (subject: string, grade: string, topic: string, syllabus: string, isPastYear?: boolean, year?: string): Promise<Question[]> => {
  console.log(`🛠️ AI MOCK MODE: ${isPastYear ? 'Past Year Paper' : 'Deep-differentiation quest'} for ${topic} in ${subject} (${syllabus}) ${isPastYear ? `[${year}]` : ''}`);
  await new Promise(resolve => setTimeout(resolve, 800));

  // ... (Keep existing mock logic or simplify)
  // For brevity in this fix, I'll return a simple mock response or the full one if needed.
  // Rewriting the full mock logic to ensure it works offline/mock mode.

  const subjectCat = getSubjectCategory(subject);

  // Minimal mock implementation to save space and ensure robustness
  const mockQuestions: Question[] = [];
  for (let i = 0; i < 15; i++) {
    mockQuestions.push({
      id: `mock-${Date.now()}-${i}`,
      text: `[MOCK] ${topic} Question ${i + 1} for ${grade} (${syllabus})`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswerIndex: 0,
      explanation: "Mock explanation."
    });
  }
  return mockQuestions;
};

const generateMockSyllabus = async (subject: string, grade: string, syllabus: string): Promise<string[]> => {
  return ["Mock Topic 1", "Mock Topic 2", "Mock Topic 3", "Mock Topic 4", "Mock Topic 5"];
};

const generateContent = async (subject: Subject, grade: GradeLevel, topic: string, syllabus: Syllabus, isPastYear?: boolean, year?: string): Promise<Question[]> => {
  if (isMockMode) {
    return generateMockContent(subject, grade, topic, syllabus, isPastYear, year);
  }

  try {
    const token = localStorage.getItem('quest_token');
    if (!token && !isMockMode) {
      console.warn("⚠️ No auth token found for generation");
    }

    const response = await fetch('/api/generate/quest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subject, grade, topic, syllabus, isPastYear, year, language: currentLang() }),
    });

    if (!response.ok) {
      if (response.status === 403) {
        const err = await response.json();
        if (err.code === 'USER_LIMIT_REACHED') throw new Error("USER_LIMIT_REACHED");
        throw new Error("QUOTA_EXCEEDED");
      }
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("🎁 [AI SERVICE] Quest Data Received:", typeof data, Array.isArray(data) ? `Array(${data.length})` : 'Object');

    // Safety: Ensure we return an array
    const questionsArray = Array.isArray(data) ? data : (data.questions || []);

    if (questionsArray.length > 0) {
      console.log("📝 [AI SERVICE] Sample Question:", questionsArray[0].text ? 'Has text' : 'Missing text', questionsArray[0].options ? `Options: ${questionsArray[0].options.length}` : 'No options');
    }
    return questionsArray;
  } catch (error: any) {
    if (error.message === "QUOTA_EXCEEDED" || error.message === "USER_LIMIT_REACHED") throw error;
    console.error("Failed to fetch from server generation endpoint:", error);
    throw error; // Stop falling back to mock data
  }
};

const generateSyllabus = async (subject: Subject, grade: GradeLevel, syllabus: Syllabus, forceRefresh?: boolean): Promise<string[]> => {
  if (isMockMode) {
    return generateMockSyllabus(subject, grade, syllabus);
  }

  try {
    const token = localStorage.getItem('quest_token');
    const response = await fetch('/api/generate/syllabus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subject, grade, syllabus, forceRefresh, language: currentLang() }),
    });

    if (!response.ok) throw new Error('Failed to fetch syllabus');
    return await response.json();
  } catch (error) {
    console.error("Syllabus fetch failed:", error);
    throw error;
  }
};

export interface StudyPlanRequest {
  subjects: string[];
  grade: string;
  syllabus: string;
  timeframe: string;
  hoursPerDay: string;
  goals?: string;
}

export interface StudyPlanResponse {
  title: string;
  overview: string;
  weeks: {
    weekNumber: number | string;
    focus: string;
    days: {
      day: string;
      tasks: { title: string; topicSearch: string }[];
    }[];
  }[];
  tips: string[];
}

const generateStudyPlan = async (params: StudyPlanRequest): Promise<StudyPlanResponse> => {
  if (isMockMode) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      title: `Study Plan: ${params.subjects.join(', ')} (${params.grade})`,
      overview: "A mock study plan for testing.",
      weeks: [
        {
          weekNumber: 1,
          focus: "Foundational Concepts",
          days: [
            { 
              day: "Day 1", 
              tasks: [
                { title: "Review Chapter 1", topicSearch: "Real Numbers" },
                { title: "Complete 5 practice questions", topicSearch: "Fractions" }
              ] 
            },
            { 
              day: "Day 2", 
              tasks: [
                { title: "Review Chapter 2", topicSearch: "Algebra" },
                { title: "Complete 5 practice questions", topicSearch: "Algebra" }
              ] 
            }
          ]
        }
      ],
      tips: ["Stay hydrated", "Take short breaks"]
    };
  }

  try {
    const token = localStorage.getItem('quest_token');
    const response = await fetch('/api/generate/study-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ...params, language: currentLang() }),
    });

    if (!response.ok) {
      const err = await response.json();
      if (response.status === 403 && err.code === 'USER_LIMIT_REACHED') throw new Error("USER_LIMIT_REACHED");
      throw new Error(err.error || 'Failed to generate study plan');
    }

    return await response.json();
  } catch (error) {
    console.error("Study plan generation failed:", error);
    throw error;
  }
};

export const geminiService = {
  generateContent,
  generateSyllabus,
  generateStudyPlan
};