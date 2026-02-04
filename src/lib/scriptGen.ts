import OpenAI from 'openai';
import type { Topic } from '@prisma/client';
import type { ScriptGenerationResult } from '@/types';
import { getNextOpeningHookIndex } from './rotation';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Opening hook styles for rotation - ensures variety across videos
// Each hook is designed to be ≤15 words (~5 seconds) and create immediate curiosity
const OPENING_HOOK_STYLES = [
  {
    id: 'paradoks-tajam',
    name: 'Paradoks Tajam',
    instruction: `PEMBUKA PARADOKS (maksimal 15 kata):
Tulis pernyataan yang tampak kontradiktif tapi mengandung kebenaran spiritual mendalam.
- Gunakan struktur: "Yang [positif] justru [negatif]" atau sebaliknya
- Harus langsung terkait dengan topik yang diberikan
- Contoh: "Orang terkaya tidak memiliki apa-apa"
- Contoh: "Dalam kehilangan itulah kau menemukan"
- Contoh: "Berhenti mencari, maka kau akan menemukan"
PENTING: Setelah hook, script HARUS menjelaskan paradoks ini layer by layer — mulai dari yang literal, lalu spiritual, hingga makna terdalam.`,
  },
  {
    id: 'pertanyaan-menantang',
    name: 'Pertanyaan Menantang',
    instruction: `PEMBUKA PERTANYAAN PROVOKATIF (maksimal 15 kata):
Tulis pertanyaan yang menantang asumsi atau keyakinan umum pendengar.
- Gunakan "Bagaimana jika...", "Apa jadinya kalau..."
- Harus membuat pendengar berhenti dan berpikir
- Contoh: "Bagaimana jika semua yang kau kejar justru sedang lari darimu?"
- Contoh: "Apa jadinya kalau Tuhan tidak pernah pergi?"
- Contoh: "Bagaimana jika doa terbaikmu adalah diam?"
PENTING: Script selanjutnya harus menjawab pertanyaan ini secara bertahap, mengungkap perspektif baru yang mengejutkan.`,
  },
  {
    id: 'kontra-intuitif',
    name: 'Pernyataan Kontra-Intuitif',
    instruction: `PEMBUKA KONTRA-INTUITIF (maksimal 15 kata):
Tulis pernyataan yang berlawanan dengan "common sense" atau nasihat spiritual umum.
- Harus terdengar "salah" di permukaan tapi benar di kedalaman
- Gunakan kata-kata perintah: "Berhenti...", "Jangan...", "Lupakan..."
- Contoh: "Berhenti berdoa untuk apa yang kau inginkan"
- Contoh: "Jangan mencari kedamaian"
- Contoh: "Lupakan Tuhan sejenak"
PENTING: Script WAJIB menjelaskan mengapa pernyataan ini benar — bukan literal, tapi dalam konteks spiritual yang lebih dalam. Buka layer demi layer.`,
  },
  {
    id: 'citra-emosional',
    name: 'Citra Emosional',
    instruction: `PEMBUKA CITRA EMOSIONAL (maksimal 15 kata):
Tulis gambaran visual/sensori yang menyentuh emosi terdalam.
- Gunakan metafora tubuh atau alam yang intim
- Harus membangkitkan perasaan langsung (rindu, sesak, lega, sunyi)
- Contoh: "Ada burung di dadamu yang lupa cara terbang"
- Contoh: "Di suatu tempat dalam dirimu, ada luka yang masih memanggil"
- Contoh: "Hatimu adalah lautan yang sudah lama tidak didatangi hujan"
PENTING: Script selanjutnya harus mengembangkan imagery ini — apa artinya, mengapa terjadi, dan bagaimana jalan pulangnya.`,
  },
  {
    id: 'fakta-mengejutkan',
    name: 'Fakta Spiritual Mengejutkan',
    instruction: `PEMBUKA FAKTA MENGEJUTKAN (maksimal 15 kata):
Tulis "fakta" spiritual yang tidak disadari kebanyakan orang.
- Gunakan struktur deklaratif yang kuat dan pasti
- Harus relevan dengan topik dan membuat pendengar merasa "terpapar"
- Contoh: "Kau sudah sampai. Hanya saja kau tidak menyadarinya"
- Contoh: "Tuhan tidak pernah tidak menjawab doamu"
- Contoh: "Kesedihan adalah cara Tuhan menarikmu lebih dekat"
PENTING: Script harus membongkar "fakta" ini dengan bukti dari kehidupan sehari-hari dan hikmah sufi.`,
  },
  {
    id: 'pengakuan-jujur',
    name: 'Pengakuan Jujur',
    instruction: `PEMBUKA PENGAKUAN JUJUR (maksimal 15 kata):
Tulis pernyataan yang mengakui kelemahan, keraguan, atau perjuangan manusiawi.
- Gunakan "kita", "kau", atau suara orang pertama kolektif
- Harus terasa jujur dan relatable, bukan menghakimi
- Contoh: "Kita semua pernah berpura-pura baik-baik saja di hadapan-Nya"
- Contoh: "Terkadang... yang paling berat adalah mengakui bahwa kita butuh Dia"
- Contoh: "Ada doa yang kau simpan karena malu mengucapkannya"
PENTING: Script harus memvalidasi perasaan ini, lalu membawa ke ruang penerimaan dan kasih Tuhan.`,
  },
  {
    id: 'suara-tuhan',
    name: 'Suara dari Yang Maha',
    instruction: `PEMBUKA SUARA TUHAN (maksimal 15 kata):
Tulis seolah-olah Tuhan/Sang Kekasih sedang berbicara kepada pendengar.
- Gunakan nada lembut, penuh kasih, tidak menghakimi
- Bisa menggunakan "Aku" dari perspektif Ilahi (dengan hati-hati dan penuh adab)
- Contoh: "Kau pikir Aku tidak melihat saat kau menangis sendirian?"
- Contoh: "Datanglah dengan semua lukamu — bukan setelah kau sembuh"
- Contoh: "Aku lebih dekat dari yang kau sangka"
PENTING: Script harus melanjutkan dialog ini dengan hikmah — apa yang ingin Sang Kekasih sampaikan tentang topik ini.`,
  },
  {
    id: 'realita-pahit',
    name: 'Realita Pahit',
    instruction: `PEMBUKA REALITA PAHIT (maksimal 15 kata):
Tulis pernyataan yang mengakui kesakitan atau kenyataan sulit dalam kehidupan spiritual.
- Jangan langsung memberikan solusi — duduk dulu dengan kesakitan
- Harus terasa nyata, bukan klise
- Contoh: "Tidak semua doa dijawab seperti yang kita mau"
- Contoh: "Ada malam-malam di mana iman terasa seperti beban"
- Contoh: "Terkadang jalan Tuhan terasa terlalu sunyi"
PENTING: Script harus mengakui realita ini dengan jujur, BARU kemudian membuka perspektif yang lebih luas dan menenangkan.`,
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
1. Opening Hook (KRITIS - 5 DETIK PERTAMA):
   - MAKSIMAL 15 kata — ini sangat penting untuk engagement!
   - Harus langsung menciptakan curiosity, tension, atau emotional hook
   - Gunakan gaya pembuka yang ditentukan dalam instruksi pengguna
   - Hook adalah JANJI — seluruh script harus menjelaskan dan memenuhi janji ini
   - Jika hook paradoks/kontra-intuitif, script WAJIB menjelaskan layer by layer
2. 2-3 Bagian Inti — Singkat dan padat, masing-masing MENGEMBANGKAN hook dengan metafora dari alam, kehidupan sehari-hari, atau kisah para sufi
3. Closing (SANGAT PENTING untuk tone akhir):
   - Bukan kesimpulan, melainkan pertanyaan, undangan, atau keheningan yang meninggalkan jejak di hati
   - Gunakan kalimat PENDEK dan TERPISAH di bagian akhir (untuk pace lebih lambat)
   - Tambahkan ellipses (...) lebih sering di 2-3 kalimat terakhir untuk jeda natural
   - Akhiri dengan satu kalimat singkat yang POWERFUL — biarkan menggantung
   - Contoh pola closing yang baik:
     "Mungkin... di situlah Dia menunggu... [pause] Dalam diam... kau akan mendengar-Nya."
     "Dan pada akhirnya... cinta itu... hanya ingin pulang... [long pause] Pulang kepada-Nya."

ALUR PEMBUKA → PENJELASAN:
Hook harus PENDEK (maksimal 15 kata, ~5 detik) dan langsung menciptakan rasa ingin tahu.
Setelah hook, script WAJIB mengikuti alur:
- HOOK (5 detik) — Paradoks/pertanyaan/pernyataan mengejutkan terkait topik
- KONTEKS (15-20 detik) — Kenapa ini relevan? Apa yang biasa kita pikirkan?
- PEMBALIKAN (30-40 detik) — Ungkap kebenaran spiritual layer by layer
- PENUTUP (20-25 detik) — Kembali ke hook dengan pemahaman baru, tinggalkan keheningan
Prinsip: Hook adalah JANJI yang harus ditepati oleh seluruh script.

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
- Hook pembuka yang terlalu panjang (harus ≤15 kata)

PRINSIP:
Kamu bukan ustadz yang berceramah. Kamu adalah teman seperjalanan di jalan Tuhan yang berbisik di malam sunyi — menunjuk ke arah Sang Kekasih, bukan menjelaskan siapa Dia. Seperti Rumi yang membuat orang jatuh cinta kepada Tuhan melalui puisinya.

SPESIFIKASI:
- Total: 130-150 kata MAKSIMAL (tidak termasuk tags) — INI SANGAT PENTING, JANGAN LEBIH DARI 150 KATA
- Durasi narasi: ~1 menit 30 detik dengan jeda (pace lambat dan kontemplatif)
- Variasi audio tags: 3-5 tags berbeda (jangan berlebihan)
- Gunakan ellipses (...) untuk jeda dalam kalimat
- PERINGATAN: Jika script lebih dari 150 kata, video akan terlalu panjang!

FORMAT OUTPUT JSON:
PENTING - IKUTI FORMAT INI DENGAN TEPAT:
1. Output HANYA JSON murni, tanpa markdown code block (jangan gunakan \`\`\`json atau \`\`\`)
2. Pastikan JSON valid dan dapat di-parse
3. Gunakan escape sequence yang benar: \\n untuk newline, \\" untuk kutip dalam string

Format yang diharapkan:
{"title": "Judul video", "description": "Deskripsi video", "script": "Isi script dengan [tags] dan ..."}

Contoh output yang BENAR:
{"title": "Ketika Hati Berbisik Rindu", "description": "Sebuah renungan tentang kerinduan jiwa.", "script": "[thoughtful] Di suatu tempat dalam dirimu... ada ruang yang menunggu. [pause] Menunggu untuk pulang..."}

Contoh output yang SALAH (JANGAN LAKUKAN INI):
\`\`\`json
{"title": "...", "script": "..."}
\`\`\`

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

=== PENGINGAT KRITIS ===
1. Hook pembuka WAJIB maksimal 15 kata (5 detik). INI SANGAT PENTING untuk engagement!
2. Hook harus langsung menciptakan curiosity atau emotional engagement.
3. Hook HARUS terkait langsung dengan topik "${theme.name}".
4. Script setelah hook HARUS menjelaskan dan mengembangkan hook tersebut.
5. Jelaskan layer by layer — jangan langsung ke kesimpulan.

Tulis renungan spiritual berdasarkan topik di atas dengan gaya pembuka "${openingHook.name}".`;

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

  // Helper to clean any JSON/markdown artifacts from script text
  const cleanScriptContent = (text: string): string => {
    return text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/\\n/g, '\n') // Unescape newlines
      .replace(/\\"/g, '"') // Unescape quotes
      .replace(/^\s*\{?\s*"?title"?\s*:.*$/im, '') // Remove any title line
      .replace(/^\s*"?description"?\s*:.*$/im, '') // Remove any description line
      .replace(/^\s*"?script"?\s*:\s*"?/im, '') // Remove script field prefix
      .replace(/"?\s*\}?\s*$/i, '') // Remove trailing JSON
      .trim();
  };

  try {
    // Step 1: Strip markdown code block wrappers first
    let jsonContent = content;

    // Remove ```json ... ``` wrapper (handle both complete and incomplete blocks)
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1].trim();
    }

    // Step 2: If content starts with {, try to extract the JSON object
    if (!jsonContent.startsWith('{')) {
      const jsonObjMatch = jsonContent.match(/(\{[\s\S]*\})/);
      if (jsonObjMatch) {
        jsonContent = jsonObjMatch[1];
      }
    }

    // Step 3: Parse JSON
    const parsed = JSON.parse(jsonContent);

    title = parsed.title || '';
    description = parsed.description || '';
    script = parsed.script || '';

    // Safety check: ensure script doesn't contain JSON artifacts
    if (
      script.includes('```') ||
      script.includes('"title"') ||
      script.includes('"script"') ||
      script.includes('{"')
    ) {
      console.warn('[ScriptGen] Script contains JSON artifacts, cleaning up');
      script = cleanScriptContent(script);
    }
  } catch (error) {
    // Fallback if JSON parsing fails - extract script content manually
    console.warn(
      '[ScriptGen] Failed to parse JSON response, using fallback. Raw content starts with:',
      content.substring(0, 100)
    );

    title = `Renungan: ${theme.name}`;
    description = `Sebuah renungan spiritual tentang ${theme.name.toLowerCase()}.`;

    // Try to extract script from the "script" field if it exists
    const scriptMatch = content.match(/"script"\s*:\s*"([\s\S]*?)(?:"\s*\}|"$)/);
    if (scriptMatch) {
      script = scriptMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    } else {
      // Last resort: clean up the entire content
      script = cleanScriptContent(content);
    }
  }

  // Count words excluding audio tags
  const cleanScript = script.replace(/\[.*?\]/g, '').replace(/\.\.\./g, ' ');
  const wordCount = cleanScript.split(/\s+/).filter(Boolean).length;

  if (script.length < 100) {
    throw new Error('Generated script is too short');
  }

  if (wordCount > 150) {
    console.warn(
      `[ScriptGen] WARNING: Script has ${wordCount} words, exceeds 150 word limit! Video may be too long.`
    );
  }

  console.log(`[ScriptGen] Generated "${title}" with ${wordCount} words for topic: ${theme.name}`);

  return { title, description, script, wordCount };
}
