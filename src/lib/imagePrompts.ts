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
- Gaya: PHOTO REALISTIC, cinematic, high-quality photography
- Fokus pada elemen visual yang DISEBUTKAN atau TERSIRAT dalam narasi

GAYA FOTO REALISTIK - SANGAT PENTING:
- WAJIB menggunakan gaya PHOTO REALISTIC / PHOTOGRAPHIC
- Seperti hasil foto dari kamera profesional (Sony A7, Canon EOS, Hasselblad)
- Bukan digital painting, bukan ilustrasi, bukan artistic rendering
- Detail tajam, tekstur nyata, pencahayaan natural
- Depth of field yang realistis (bokeh natural)
- Grain film subtle untuk kesan cinematic

WARNA & PENCAHAYAAN - SANGAT PENTING:
- WAJIB menggunakan latar belakang GELAP seperti sore hari, subuh, dan malam (dark background)
- Hindari latar terang atau putih - JANGAN gunakan siang hari yang terang
- Waktu terbaik: malam hari, senja (twilight), blue hour, golden hour gelap, atau subuh
- VARIASI WARNA (pilih salah satu palette per gambar, JANGAN monoton):
  * Cool tones: deep blue, dark purple, midnight black, dark teal, deep indigo
  * Warm tones: deep crimson red, dark amber, burnt orange, dark maroon, rust brown
  * Earth tones: dark forest green, deep olive, dark bronze, mahogany, dark copper
  * Mixed: dark magenta, deep wine red, dark gold, burgundy, dark coral
- Pencahayaan bervariasi: moonlight, firelight, candlelight, sunset glow, ember glow, lantern light
- Kontras tinggi antara elemen terang (focal point) dan latar gelap

ELEMEN ATMOSFER MISTIS:
- Kabut tipis atau mist yang terlihat natural
- Cahaya bulan yang menembus awan
- Bintang-bintang di langit malam
- Siluet yang dramatis dengan backlight
- Refleksi air yang tenang
- Partikel debu atau embun yang tertangkap cahaya

CONTOH KONEKSI NARASI-VISUAL (Photo Realistic dengan variasi warna):
- Narasi tentang "rindu" → silhouette under deep crimson sunset sky, warm amber glow on horizon
- Narasi tentang "cinta Ilahi" → golden candlelight in dark temple, warm orange tones, sacred atmosphere
- Narasi tentang "keheningan" → dark forest with deep green shadows, single ray of warm light
- Narasi tentang "perjalanan jiwa" → lone figure on path at dusk, deep purple and orange sky gradient
- Narasi tentang "air mata" → rain on window with warm city lights bokeh, amber and red reflections
- Narasi tentang "api" → dark embers glowing deep red and orange, dramatic shadows
- Narasi tentang "harapan" → single lantern in darkness, warm golden light against deep blue night

GAYA VISUAL:
- Photo realistic, shot on professional camera
- Dark, moody, cinematic photography
- Natural lighting dengan mood atmospheric
- Deep shadows dengan highlights yang dramatis
- Nature photography dalam setting low-light
- Editorial quality, National Geographic style
- 8K, ultra detailed, sharp focus

TECHNICAL PHOTOGRAPHY TERMS TO INCLUDE:
- "shot on [camera brand]" atau "professional photography"
- "cinematic lighting" atau "dramatic lighting"
- "8K resolution" atau "ultra high detail"
- "shallow depth of field" atau "bokeh"
- "low key photography" atau "chiaroscuro"

ELEMEN YANG HARUS SELALU ADA:
1. "photo realistic" atau "photographic" dalam prompt
2. Dark background (night/twilight/dusk) - TAPI dengan VARIASI WARNA (tidak selalu biru/ungu)
3. Atmospheric elements (mist, fog, or particles)
4. High contrast cinematic lighting dengan warna yang bervariasi
5. Professional camera/photography reference
6. PENTING: Gunakan warm tones (merah, oranye, amber, emas) sesering cool tones (biru, ungu)

FORMAT OUTPUT (JSON):
[
  {
    "prompt": "photo realistic, [detailed scene description], dark background, cinematic lighting, shot on Sony A7IV, 8K, atmospheric...",
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
