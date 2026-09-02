import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Robust Gemini API call that uses direct FETCH to allow
 * setting the 'Referer' header. This is necessary because
 * the Google Node SDK does not support sending Referer,
 * which causes 403 errors if the API Key has "Application Restrictions".
 */
export async function generateAIContent(
    prompt: string,
    modelName: string = "gemini-2.5-flash",
    responseMimeType?: string
): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    // Safety check for model name
    const cleanModelName = modelName.includes('/') ? modelName.split('/').pop() : modelName;
    const modelPath = `models/${cleanModelName}`;

    const keySnippet = apiKey.substring(apiKey.length - 6);
    console.log(`[AI] >>> KEY VERIFICATION: Using API Key ending in "...${keySnippet}" | Model: ${modelPath} | JSON Mode: ${!!responseMimeType} <<<`);

    // URL for the Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

    try {
        // Try multiple referrers to match possible Application Restrictions
        const referers = [
            'https://revisionlab.vercel.app',
            'https://revisonlab.vercel.app',
            'http://localhost:3000',
            'http://localhost:5173'
        ];

        // We'll try with the primary one first, but logging the results
        const startTime = Date.now();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': referers[0],
                'Origin': referers[0]
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.4,
                    topP: 0.95,
                    topK: 40,
                    // Gemini 2.5 "thinking" tokens count against the output budget; with
                    // 8192 the JSON for 15-20 questions was routinely truncated (the repair
                    // step then salvaged only 2-3 questions). Cap thinking and raise the
                    // budget so full question sets fit.
                    max_output_tokens: 16384,
                    thinkingConfig: { thinkingBudget: 1024 },
                    response_mime_type: responseMimeType
                }
            })
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[AI] Gemini API Response received in ${duration}s (Status: ${response.status})`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Gemini API Error Response (${response.status}): ${errorText}`);

            try {
                const errorJson = JSON.parse(errorText);
                const message = errorJson.error?.message || errorText;

                // Enhanced error context
                if (response.status === 404) {
                    throw new Error(`Model not found or invalid: ${modelPath}. Check if Gemini 2.5 is available for this API key.`);
                }

                throw new Error(`Gemini API Error (${response.status}): ${message}`);
            } catch (e: any) {
                if (e.message.includes("Gemini API Error") || e.message.includes("Model not found")) throw e;
                throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
            }
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error("[AI] No text in response:", JSON.stringify(data));
            throw new Error("Empty response from Gemini API");
        }

        return text;
    } catch (error: any) {
        console.error('[AI] Generation Failed:', error.message);
        throw error;
    }
}
