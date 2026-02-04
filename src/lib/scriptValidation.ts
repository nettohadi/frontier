import OpenAI from 'openai';

const VALIDATION_SYSTEM_PROMPT = `Anda adalah seorang ahli bahasa Indonesia dan editor konten spiritual yang bertugas memeriksa kualitas naskah video.

TUGAS ANDA:
1. Periksa kesalahan pengetikan (typo) dalam bahasa Indonesia
2. Identifikasi kata-kata yang TIDAK ADA dalam kamus bahasa Indonesia (kata yang dikarang/made-up words)
3. Evaluasi koherensi dan kejelasan alur cerita
4. Pastikan naskah mudah dipahami dan tidak membingungkan

FOKUS KHUSUS:
- Kata-kata yang sepertinya bahasa Indonesia tapi sebenarnya tidak ada (contoh: "kemanusiawian" seharusnya "kemanusiaan")
- Kata-kata yang aneh atau tidak natural dalam konteks kalimat
- Alur pemikiran yang melompat-lompat atau tidak jelas
- Kalimat yang terlalu panjang atau membingungkan

OUTPUT FORMAT:
Berikan hasil dalam format JSON dengan struktur berikut:
{
  "isValid": true/false,
  "overallQuality": "excellent/good/fair/poor",
  "issues": [
    {
      "type": "typo/made-up-word/coherence/clarity",
      "severity": "critical/major/minor",
      "location": "bagian naskah yang bermasalah",
      "issue": "deskripsi masalah",
      "suggestion": "saran perbaikan"
    }
  ],
  "summary": "ringkasan singkat hasil validasi",
  "recommendation": "accept/revise/regenerate"
}

KRITERIA VALIDASI:
- "isValid: true" jika tidak ada masalah critical atau major
- "isValid: false" jika ada masalah critical atau 2+ masalah major
- Masalah "critical": kata yang jelas tidak ada dalam bahasa Indonesia
- Masalah "major": typo yang mengubah makna, alur yang tidak jelas
- Masalah "minor": typo kecil yang tidak mengganggu pemahaman

Berikan penilaian yang objektif dan konstruktif.`;

interface ValidationIssue {
  type: 'typo' | 'made-up-word' | 'coherence' | 'clarity';
  severity: 'critical' | 'major' | 'minor';
  location: string;
  issue: string;
  suggestion: string;
}

interface ValidationResult {
  isValid: boolean;
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  issues: ValidationIssue[];
  summary: string;
  recommendation: 'accept' | 'revise' | 'regenerate';
}

export interface ScriptValidationResponse {
  success: boolean;
  result: ValidationResult;
  rawResponse?: string;
  error?: string;
}

/**
 * Validates a generated script using a second LLM call
 * Uses Gemini 2.5 Flash for cost-effective validation
 */
export async function validateScript(
  title: string,
  description: string,
  script: string
): Promise<ScriptValidationResponse> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    const userPrompt = `Periksa kualitas naskah video berikut:

JUDUL: ${title}

DESKRIPSI: ${description}

NASKAH:
${script}

Berikan hasil validasi dalam format JSON yang sudah ditentukan.`;

    console.log('[ScriptValidation] Starting validation check...');

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: VALIDATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent validation
      max_tokens: 1000,
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response from validation API');
    }

    console.log('[ScriptValidation] Raw response received');

    // Parse JSON response (with fallback for markdown code blocks)
    let jsonContent = rawContent.trim();
    const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    // Extract JSON object if wrapped in other text
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    const validationResult: ValidationResult = JSON.parse(jsonContent);

    // Log validation summary
    console.log('[ScriptValidation] Validation complete:', {
      isValid: validationResult.isValid,
      quality: validationResult.overallQuality,
      issueCount: validationResult.issues.length,
      recommendation: validationResult.recommendation,
    });

    // Log critical/major issues
    const seriousIssues = validationResult.issues.filter(
      (issue) => issue.severity === 'critical' || issue.severity === 'major'
    );
    if (seriousIssues.length > 0) {
      console.warn('[ScriptValidation] Serious issues found:', seriousIssues);
    }

    return {
      success: true,
      result: validationResult,
      rawResponse: rawContent,
    };
  } catch (error) {
    console.error('[ScriptValidation] Validation error:', error);
    return {
      success: false,
      result: {
        isValid: false,
        overallQuality: 'poor',
        issues: [],
        summary: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendation: 'accept', // Default to accepting if validation fails
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper to check if script should be regenerated based on validation
 */
export function shouldRegenerateScript(
  validation: ValidationResult,
  maxAttempts: number = 3,
  currentAttempt: number = 1
): boolean {
  // Don't regenerate if we've hit max attempts
  if (currentAttempt >= maxAttempts) {
    console.log('[ScriptValidation] Max regeneration attempts reached');
    return false;
  }

  // Regenerate if recommendation is explicit
  if (validation.recommendation === 'regenerate') {
    return true;
  }

  // Regenerate if there are critical issues
  const hasCriticalIssues = validation.issues.some(
    (issue) => issue.severity === 'critical'
  );
  if (hasCriticalIssues) {
    console.log('[ScriptValidation] Critical issues found, regenerating');
    return true;
  }

  // Regenerate if there are multiple major issues
  const majorIssueCount = validation.issues.filter(
    (issue) => issue.severity === 'major'
  ).length;
  if (majorIssueCount >= 2) {
    console.log('[ScriptValidation] Multiple major issues found, regenerating');
    return true;
  }

  return false;
}
