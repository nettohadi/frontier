import OpenAI from 'openai';

const VALIDATION_SYSTEM_PROMPT = `Anda adalah seorang ahli bahasa Indonesia dan editor konten spiritual yang bertugas memeriksa kualitas naskah video.

TUGAS ANDA:
1. Periksa kesalahan pengetikan (typo) dalam bahasa Indonesia
2. Identifikasi kata-kata yang TIDAK ADA dalam kamus bahasa Indonesia (kata yang dikarang/made-up words)
3. Evaluasi koherensi dan kejelasan alur cerita
4. Pastikan naskah mudah dipahami dan tidak membingungkan

FOKUS KHUSUS:
- Kata-kata yang sepertinya bahasa Indonesia tapi sebenarnya tidak ada (contoh: "kemanusiawian" seharusnya "kemanusiaan")
- Kombinasi kata yang tidak lazim/tidak natural dalam bahasa Indonesia (contoh: "Telahkah" seharusnya "Sudahkah", "Bilamanakah" seharusnya "Kapankah", "Tidakkah" boleh tapi "Belumkah" lebih natural dari "Tak pernah-kah")
- Kata-kata yang aneh atau tidak natural dalam konteks kalimat
- Alur pemikiran yang melompat-lompat atau tidak jelas
- Kalimat yang terlalu panjang atau membingungkan

KRITERIA VALIDASI:
- "isValid": true jika tidak ada masalah critical atau major
- "isValid": false jika ada masalah critical atau 2+ masalah major
- Masalah "critical": kata yang jelas tidak ada dalam bahasa Indonesia
- Masalah "major": typo yang mengubah makna, kombinasi kata yang tidak lazim/tidak natural, alur yang tidak jelas
- Masalah "minor": typo kecil yang tidak mengganggu pemahaman

OUTPUT FORMAT - SANGAT PENTING:
Anda WAJIB mengembalikan HANYA JSON yang valid tanpa teks tambahan. Gunakan struktur PERSIS seperti berikut:

{
  "isValid": <boolean: true atau false>,
  "overallQuality": <string: "excellent" atau "good" atau "fair" atau "poor">,
  "issues": [
    {
      "type": <string: "typo" atau "made-up-word" atau "coherence" atau "clarity">,
      "severity": <string: "critical" atau "major" atau "minor">,
      "location": <string: kutipan bagian yang bermasalah>,
      "issue": <string: deskripsi masalah>,
      "suggestion": <string: saran perbaikan>
    }
  ],
  "summary": <string: ringkasan singkat hasil validasi>,
  "recommendation": <string: "accept" atau "revise" atau "regenerate">
}

ATURAN OUTPUT:
1. Kembalikan HANYA objek JSON, tanpa markdown code blocks, tanpa penjelasan tambahan
2. Field "isValid" HARUS bernilai boolean (true/false), BUKAN string
3. Field "issues" HARUS berupa array (bisa kosong jika tidak ada masalah)
4. Semua field WAJIB ada dalam response
5. Gunakan PERSIS nilai yang diizinkan untuk setiap field

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
 * Validates and sanitizes the LLM response to ensure it matches expected structure.
 * Provides safe defaults for missing or invalid fields.
 */
function sanitizeValidationResult(parsed: unknown): ValidationResult {
  // Handle non-object responses
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[ScriptValidation] Invalid response: not an object, defaulting to accept');
    return createDefaultResult('accept');
  }

  const raw = parsed as Record<string, unknown>;

  // Sanitize isValid - must be boolean
  let isValid: boolean;
  if (typeof raw.isValid === 'boolean') {
    isValid = raw.isValid;
  } else if (raw.isValid === 'true' || raw.isValid === 'yes') {
    isValid = true;
  } else if (raw.isValid === 'false' || raw.isValid === 'no') {
    isValid = false;
  } else {
    console.warn('[ScriptValidation] Invalid isValid value, defaulting to true');
    isValid = true;
  }

  // Sanitize overallQuality - must be one of the allowed values
  const validQualities = ['excellent', 'good', 'fair', 'poor'] as const;
  let overallQuality: ValidationResult['overallQuality'] = 'fair';
  if (typeof raw.overallQuality === 'string' && validQualities.includes(raw.overallQuality as any)) {
    overallQuality = raw.overallQuality as ValidationResult['overallQuality'];
  } else {
    console.warn('[ScriptValidation] Invalid overallQuality, defaulting to "fair"');
  }

  // Sanitize recommendation - must be one of the allowed values
  const validRecommendations = ['accept', 'revise', 'regenerate'] as const;
  let recommendation: ValidationResult['recommendation'] = 'accept';
  if (typeof raw.recommendation === 'string' && validRecommendations.includes(raw.recommendation as any)) {
    recommendation = raw.recommendation as ValidationResult['recommendation'];
  } else {
    console.warn('[ScriptValidation] Invalid recommendation, defaulting to "accept"');
  }

  // Sanitize issues array
  let issues: ValidationIssue[] = [];
  if (Array.isArray(raw.issues)) {
    issues = raw.issues
      .filter((issue): issue is Record<string, unknown> => issue && typeof issue === 'object')
      .map((issue) => sanitizeIssue(issue))
      .filter((issue): issue is ValidationIssue => issue !== null);
  }

  // Sanitize summary
  const summary = typeof raw.summary === 'string' ? raw.summary : 'Validation completed';

  return {
    isValid,
    overallQuality,
    issues,
    summary,
    recommendation,
  };
}

/**
 * Sanitizes a single issue object from the LLM response.
 * Returns null if the issue is invalid.
 */
function sanitizeIssue(raw: Record<string, unknown>): ValidationIssue | null {
  const validTypes = ['typo', 'made-up-word', 'coherence', 'clarity'] as const;
  const validSeverities = ['critical', 'major', 'minor'] as const;

  // Type must be valid
  if (typeof raw.type !== 'string' || !validTypes.includes(raw.type as any)) {
    return null;
  }

  // Severity must be valid
  if (typeof raw.severity !== 'string' || !validSeverities.includes(raw.severity as any)) {
    return null;
  }

  return {
    type: raw.type as ValidationIssue['type'],
    severity: raw.severity as ValidationIssue['severity'],
    location: typeof raw.location === 'string' ? raw.location : 'Unknown location',
    issue: typeof raw.issue === 'string' ? raw.issue : 'Unknown issue',
    suggestion: typeof raw.suggestion === 'string' ? raw.suggestion : '',
  };
}

/**
 * Creates a default validation result for error cases
 */
function createDefaultResult(recommendation: ValidationResult['recommendation']): ValidationResult {
  return {
    isValid: recommendation === 'accept',
    overallQuality: 'fair',
    issues: [],
    summary: 'Validation could not be completed properly',
    recommendation,
  };
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

    const parsed = JSON.parse(jsonContent);

    // Guard check: validate and sanitize the parsed response
    const validationResult = sanitizeValidationResult(parsed);

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
    const defaultResult = createDefaultResult('accept');
    defaultResult.summary = `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return {
      success: false,
      result: defaultResult,
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
