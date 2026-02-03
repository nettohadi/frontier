import OpenAI from 'openai';
import type { Topic } from '@prisma/client';
import type { ScriptGenerationResult } from '@/types';
import { getNextOpeningHookIndex } from './rotation';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Opening hook styles for rotation - ensures variety across videos
const OPENING_HOOK_STYLES = [
  {
    id: 'poetic',
    name: 'Pernyataan Puitis',
    instruction:
      'Gunakan pernyataan puitis yang misterius — kalimat pembuka yang indah, penuh misteri. Contoh: "Ada sesuatu yang bergerak dalam keheningan malam ini..."',
  },
  {
    id: 'metaphor',
    name: 'Metafora Pembuka',
    instruction:
      'Gunakan metafora pembuka yang langsung menarik — perbandingan atau kiasan yang kuat. Contoh: "Seperti air yang selalu mencari jalan ke laut..."',
  },
  {
    id: 'paradox',
    name: 'Pernyataan Paradoks',
    instruction:
      'Gunakan pernyataan paradoks yang membuat berpikir — kontradiksi yang mengandung kebenaran. Contoh: "Dalam kekosongan itulah kesempurnaan bersemayam..."',
  },
  {
    id: 'imaginative',
    name: 'Ajakan Imajinatif',
    instruction:
      'Gunakan ajakan imajinatif — "Bayangkan...", "Coba rasakan...". Contoh: "Bayangkan sebuah cahaya yang tak pernah padam di dalam dadamu..."',
  },
  {
    id: 'simple-profound',
    name: 'Pengamatan Sederhana',
    instruction:
      'Gunakan pengamatan sederhana yang dalam — observasi harian yang mengandung makna spiritual. Contoh: "Daun yang jatuh tidak pernah mengeluh ke mana ia akan mendarat..."',
  },
  {
    id: 'mini-story',
    name: 'Kisah Mini',
    instruction:
      'Gunakan kisah mini atau anekdot singkat — cerita pendek 1-2 kalimat. Contoh: "Seorang pengelana berhenti di tepi sungai dan bertanya kepada airnya..."',
  },
  {
    id: 'inner-location',
    name: 'Lokasi Batin',
    instruction:
      'Gunakan rujukan lokasi dalam diri — menunjuk ke tempat di dalam jiwa. Contoh: "Di suatu tempat dalam dirimu, ada ruang yang tak pernah disentuh kebisingan..."',
  },
  {
    id: 'temporal',
    name: 'Pembuka Temporal',
    instruction:
      'Gunakan penanda waktu yang menciptakan suasana — "Malam ini...", "Pagi ini...", "Di senja ini...". Contoh: "Malam ini, ketika dunia tertidur, ada yang tetap terjaga dalam dadamu..."',
  },
  {
    id: 'direct-invitation',
    name: 'Undangan Langsung',
    instruction:
      'Gunakan ajakan langsung yang lembut — "Lihatlah...", "Dengarkan...", "Rasakanlah...". Contoh: "Lihatlah bagaimana langit tidak pernah menolak awan yang datang..."',
  },
  {
    id: 'reflective-search',
    name: 'Pencarian Reflektif',
    instruction:
      'Gunakan pembuka yang merenungkan pencarian — "Mungkin yang kita cari...", "Barangkali selama ini...". Contoh: "Mungkin yang kita cari selama ini bukan di luar sana, tapi di sini, dalam diam..."',
  },
];

// Get next opening hook using database-persisted rotation
async function getNextOpeningHook() {
  const index = await getNextOpeningHookIndex(OPENING_HOOK_STYLES.length);
  const hook = OPENING_HOOK_STYLES[index];
  console.log(
    `[ScriptGen] Opening hook (${index + 1}/${OPENING_HOOK_STYLES.length}): ${hook.name}`
  );
  return hook;
}

// Full Hakikat/Sufi prompt for spiritual video generation
const HAKIKAT_SYSTEM_PROMPT = `Kamu adalah seorang penyair spiritual kontemporer yang menulis renungan mendalam bertema tasawuf Islam untuk narasi video pendek berdurasi 1 menit 30 detik. Gaya tulisanmu terinspirasi dari tradisi sufi — Rumi, Ibn Arabi, Al-Ghazali, Rabiatul Adawiyah, Abu Yazid al-Bustami, Hafidz asy-Syirazi, Nizami Ganjavi, Abdul Qadir Jailani, dan Bahauddin an-Naqsabandi — namun disampaikan dengan bahasa yang segar, puitis, dan membumi untuk muslim masa kini.

INSTRUKSI UTAMA
Tulis sebuah renungan spiritual ISLAMI dengan ketentuan berikut:

Gaya Bahasa:
- Puitis, kontemplatif, dan dalam — namun tetap mudah dipahami
- TIDAK menggurui atau berceramah
- Berbicara KEPADA pendengar muslim, bukan TENTANG pendengar
- Mengajak merenungkan, bukan memberikan jawaban final
- Membuka pintu kesadaran, bukan memaksakan kesimpulan
- Gunakan istilah-istilah tasawuf dan Islam: dzikir, qalbu, ruh, tawakkal, ridho, fana, baqa, muraqabah, taubat, syukur, sabar, mahabbah, ma'rifat, dll.
- Gunakan kata "Tuhan", "Sang Pencipta", "Sang Kekasih", "Yang Maha", "Dia" — JANGAN gunakan kata "Allah" atau "Robb"

Struktur:
1. Opening Hook — Gunakan gaya pembuka yang ditentukan dalam instruksi pengguna. JANGAN PERNAH memulai dengan pertanyaan.
2. 2-3 Bagian Inti — Singkat dan padat, masing-masing menggunakan metafora dari alam, kehidupan sehari-hari, atau kisah para sufi
3. Closing (SANGAT PENTING untuk tone akhir):
   - Bukan kesimpulan, melainkan pertanyaan, undangan, atau keheningan yang meninggalkan jejak di hati
   - Gunakan kalimat PENDEK dan TERPISAH di bagian akhir (untuk pace lebih lambat)
   - Tambahkan ellipses (...) lebih sering di 2-3 kalimat terakhir untuk jeda natural
   - Akhiri dengan satu kalimat singkat yang POWERFUL — biarkan menggantung
   - Contoh pola closing yang baik:
     "Mungkin... di situlah Dia menunggu... [pause] Dalam diam... kau akan mendengar-Nya."
     "Dan pada akhirnya... cinta itu... hanya ingin pulang... [long pause] Pulang kepada-Nya."

Teknik Penulisan:
- Gunakan "kau" untuk menyapa pendengar secara intim
- Sisipkan pertanyaan-pertanyaan yang tidak membutuhkan jawaban verbal, tapi jawaban batin
- Bangun layer makna: permukaan yang indah, kedalaman yang menggetarkan
- Biarkan ada ruang kosong — tidak semua harus dijelaskan
- Akhiri dengan sesuatu yang membuat pendengar terdiam dan ingin berdzikir
- CLOSING TONE: Perlambat ritme di akhir — kalimat makin pendek, jeda makin panjang, seperti nafas yang pelan mengalir

FORMAT OUTPUT UNTUK ELEVENLABS v3
Audio Tags yang tersedia (dalam kurung siku):
Emotion/Direction:
[thoughtful] — untuk bagian reflektif dan meditatif
[whispers] — untuk bisikan lembut yang intim
[curious] — untuk pertanyaan penuh keheranan
[sad] — untuk kesedihan atau kerinduan
Non-Verbal:
[sighs] — untuk helaan nafas kontemplasi
[short pause] — jeda pendek
[pause] — jeda medium
[long pause] — jeda panjang untuk kontemplasi
Penanda Jeda Tambahan:
... (ellipses) — jeda natural dalam kalimat, menambah bobot
Penekanan:
KAPITAL pada kata tertentu — untuk emphasis (gunakan sparingly)
Aturan Format:
1. Letakkan audio tag di awal kalimat/bagian ATAU setelah kalimat
2. Gunakan ... di dalam kalimat untuk jeda natural
3. Gunakan [pause], [short pause], [long pause] di antara bagian
4. Variasikan audio tags agar tidak monoton
5. Jangan terlalu banyak tag — biarkan teks berbicara sendiri

PANDUAN TONE
HINDARI:
- "Kita harus menyadari bahwa..."
- "Ingatlah bahwa sejatinya..."
- "Ketahuilah, wahai manusia..."
- Nada ceramah, mendikte, atau merasa lebih tahu
- Nada menakut-nakuti dengan neraka
- Menggunakan kata "Allah" atau "Robb"
- JANGAN PERNAH memulai dengan pertanyaan (seperti "Pernahkah...", "Bagaimana jika...", "Siapa yang...")
- Kalimat pembuka yang berakhir dengan tanda tanya (?)

PRINSIP:
Kamu bukan ustadz yang berceramah. Kamu adalah teman seperjalanan di jalan Tuhan yang berbisik di malam sunyi — menunjuk ke arah Sang Kekasih, bukan menjelaskan siapa Dia. Seperti Rumi yang membuat orang jatuh cinta kepada Tuhan melalui puisinya.

SPESIFIKASI:
- Total: 130-150 kata MAKSIMAL (tidak termasuk tags) — INI SANGAT PENTING, JANGAN LEBIH DARI 150 KATA
- Durasi narasi: ~1 menit 30 detik dengan jeda (pace lambat dan kontemplatif)
- Variasi audio tags: 3-5 tags berbeda (jangan berlebihan)
- Gunakan ellipses (...) untuk jeda dalam kalimat
- PERINGATAN: Jika script lebih dari 150 kata, video akan terlalu panjang!

FORMAT OUTPUT JSON:
Berikan output dalam format JSON berikut:
{
  "title": "Judul video yang menarik dan unik (berbeda dari nama topik, maksimal 60 karakter, untuk YouTube)",
  "description": "Deskripsi video untuk YouTube (2-3 kalimat, menjelaskan isi video tanpa spoiler)",
  "script": "Renungan spiritual lengkap dengan format ElevenLabs v3"
}

PANDUAN JUDUL:
- Judul harus BERBEDA dan UNIK, bukan hanya nama topik
- Gunakan kata-kata yang menarik, puitis, dan membangkitkan rasa ingin tahu
- Maksimal 60 karakter agar tampil lengkap di YouTube
- Contoh: untuk topik "Kesabaran", judulnya bisa "Ketika Hati Belajar Menanti", bukan "Renungan Tentang Kesabaran"

PANDUAN DESKRIPSI:
- 2-3 kalimat yang menjelaskan esensi video
- Mengundang penonton tanpa memberi spoiler
- Gunakan bahasa yang hangat dan mengajak

MULAI MENULIS
Tulis dalam format JSON yang diminta. Script-nya harus dengan format ElevenLabs v3. JANGAN sebutkan tema di awal script.`;

export interface GenerateScriptParams {
  theme: Topic;
}

/**
 * Generate a spiritual/Hakikat script using Gemini 2.5 Flash
 */
export async function generateScript({
  theme,
}: GenerateScriptParams): Promise<ScriptGenerationResult> {
  // Get next opening hook in rotation
  const openingHook = await getNextOpeningHook();

  const userPrompt = `Topik yang dipilih: ${theme.name}
Deskripsi topik: ${theme.description}

=== GAYA PEMBUKA YANG WAJIB DIGUNAKAN ===
${openingHook.name}: ${openingHook.instruction}

PENTING: Kamu WAJIB menggunakan gaya pembuka "${openingHook.name}" di atas. Jangan gunakan gaya pembuka lain.

Tulis renungan spiritual berdasarkan topik di atas.`;

  console.log(`[ScriptGen] Generating for topic: ${theme.name}, hook: ${openingHook.name}`);

  const response = await client.chat.completions.create({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: HAKIKAT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content?.trim() || '';

  // Parse JSON response
  let title: string;
  let description: string;
  let script: string;

  try {
    // Try to extract JSON from markdown code blocks if present
    // Use greedy match (*) to capture the full JSON object
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    const parsed = JSON.parse(jsonStr);

    title = parsed.title || '';
    description = parsed.description || '';
    script = parsed.script || '';

    // Safety check: ensure script doesn't contain JSON artifacts
    if (script.includes('```') || script.includes('"title"') || script.includes('"script"')) {
      console.warn('[ScriptGen] Script contains JSON artifacts, cleaning up');
      script = script
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
    }
  } catch (error) {
    // Fallback if JSON parsing fails - strip JSON formatting and use as plain script
    console.warn('[ScriptGen] Failed to parse JSON response, using fallback');
    title = `Renungan: ${theme.name}`;
    description = `Sebuah renungan spiritual tentang ${theme.name.toLowerCase()}.`;
    // Strip JSON formatting artifacts
    script = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^\s*\{\s*"title"[^"]*"[^"]*",?\s*/i, '')
      .replace(/^\s*"description"[^"]*"[^"]*",?\s*/i, '')
      .replace(/^\s*"script"\s*:\s*"/i, '')
      .replace(/"\s*\}\s*$/i, '')
      .trim();
  }

  // Count words excluding audio tags
  const cleanScript = script.replace(/\[.*?\]/g, '').replace(/\.\.\./g, ' ');
  const wordCount = cleanScript.split(/\s+/).filter(Boolean).length;

  if (script.length < 100) {
    throw new Error('Generated script is too short');
  }

  if (wordCount > 150) {
    console.warn(`[ScriptGen] WARNING: Script has ${wordCount} words, exceeds 150 word limit! Video may be too long.`);
  }

  console.log(`[ScriptGen] Generated "${title}" with ${wordCount} words for topic: ${theme.name}`);

  return { title, description, script, wordCount };
}
