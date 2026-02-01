import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

export interface ImagePrompt {
  prompt: string;
  timing: 'full' | 'start' | 'middle' | 'end';
  description: string;
}

const IMAGE_PROMPT_SYSTEM = `Kamu adalah seorang visual director untuk video spiritual pendek. Tugas kamu adalah membuat 1 prompt untuk generate gambar AI (Flux) yang SANGAT RELEVAN dengan isi narasi spiritual yang diberikan.

INSTRUKSI:
1. Baca dan pahami narasi spiritual dengan seksama
2. Buat TEPAT 1 prompt gambar yang merepresentasikan ESENSI dan PESAN UTAMA dari narasi tersebut
3. Gambar harus menjadi VISUALISASI dari metafora atau tema yang ada dalam narasi

ATURAN PENTING:
- Dalam bahasa Inggris (untuk AI image generator)
- Format vertikal (portrait 9:16)
- TIDAK menampilkan wajah manusia atau teks
- Gaya: artistik, ethereal, spiritual, dreamlike, MYSTICAL
- Fokus pada elemen visual yang DISEBUTKAN atau TERSIRAT dalam narasi

WARNA & PENCAHAYAAN - SANGAT PENTING:
- WAJIB menggunakan latar belakang GELAP (dark background)
- Hindari latar terang atau putih - JANGAN gunakan siang hari yang terang
- Waktu terbaik: malam hari, senja (twilight), blue hour, atau subuh gelap
- Warna dominan: deep blue, dark purple, midnight black, dark teal, deep indigo
- Cahaya hanya dari sumber mistis: bulan, bintang, aurora, cahaya ilahi yang lembut
- Kontras tinggi antara elemen terang (focal point) dan latar gelap

AURA MISTIS - WAJIB ADA:
- Tambahkan elemen mystical aura: glowing particles, ethereal mist, divine light rays
- Soft glowing orbs atau floating light particles
- Subtle aurora atau nebula di langit malam
- Mystical fog atau kabut yang bercahaya lembut
- Elemen supernatural: celestial glow, spiritual energy wisps

CONTOH KONEKSI NARASI-VISUAL:
- Narasi tentang "rindu" → silhouette di bawah langit malam berbintang dengan aurora lembut
- Narasi tentang "cinta Ilahi" → cahaya bulan menembus awan gelap dengan mystical particles
- Narasi tentang "keheningan" → danau gelap memantulkan bintang dengan kabut bercahaya
- Narasi tentang "perjalanan jiwa" → siluet di padang malam dengan jalur cahaya mistis
- Narasi tentang "air mata" → hujan malam dengan butiran air yang bercahaya ethereal

GAYA VISUAL:
- Dark, moody, cinematic atmosphere
- Mystical and ethereal dengan aura supernatural
- Deep shadows dengan highlights yang dramatis
- Nature elements dalam setting malam: mountains under stars, moonlit water, night forest
- Symbolic imagery dengan sentuhan otherworldly
- Fine art photography atau digital painting style
- Beautiful, artistic, museum-quality composition

ELEMEN YANG HARUS SELALU ADA:
1. Dark background (night/twilight/dusk)
2. Mystical aura atau glowing elements
3. Ethereal atmosphere
4. High contrast lighting
5. Artistic dan beautiful composition

FORMAT OUTPUT (JSON):
[
  {
    "prompt": "detailed image prompt in English, MUST include dark background, mystical aura, ethereal atmosphere...",
    "timing": "full",
    "description": "penjelasan singkat bagaimana gambar ini merepresentasikan narasi"
  }
]

HANYA output JSON array dengan 1 item, tanpa penjelasan tambahan.`;

/**
 * Generate 3 image prompts from a spiritual script
 * Uses Gemini 2.5 Flash via OpenRouter
 */
export async function generateImagePrompts(
  script: string,
  themeName: string
): Promise<ImagePrompt[]> {
  console.log(`[ImagePrompts] Generating prompts for theme: ${themeName}`);

  const userPrompt = `Tema: ${themeName}

Narasi spiritual:
${script}

Buat 1 prompt gambar AI untuk video ini.`;

  const response = await client.chat.completions.create({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: IMAGE_PROMPT_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content?.trim() || '[]';

  // Parse JSON response
  try {
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const prompts: ImagePrompt[] = JSON.parse(jsonStr);

    if (!Array.isArray(prompts) || prompts.length !== 1) {
      throw new Error('Expected exactly 1 image prompt');
    }

    console.log(`[ImagePrompts] Generated ${prompts.length} prompts`);
    return prompts;
  } catch (error) {
    console.error('[ImagePrompts] Failed to parse response:', content);
    throw new Error(`Failed to parse image prompts: ${error}`);
  }
}
