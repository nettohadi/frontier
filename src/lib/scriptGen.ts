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
- Harus langsung terkait dengan topik yang diberikan
- Contoh: "Orang terkaya tidak memiliki apa-apa"
- Contoh: "Dalam kehilangan itulah kau menemukan"
- Contoh: "Berhenti mencari, maka kau akan menemukan"
PENTING: Setelah hook, script HARUS menjelaskan paradoks ini layer by layer — mulai dari yang literal, lalu spiritual, hingga makna terdalam.`,
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
    id: 'pertanyaan-menantang',
    name: 'Pertanyaan Menantang',
    instruction: `PEMBUKA PERTANYAAN PROVOKATIF (maksimal 15 kata):
Tulis pertanyaan yang menantang asumsi dan memaksa refleksi internal.
- Gunakan "Bagaimana jika...", "Pernahkah kau...", "Apa jadinya kalau..."
- Pertanyaan harus mengejutkan dan membuat pendengar berhenti sejenak
- Contoh: "Bagaimana jika semua yang kau kejar... justru lari darimu?"
- Contoh: "Pernahkah kau berdoa... dan berharap Dia tidak menjawab?"
- Contoh: "Apa jadinya kalau ketakutan terbesarmu... adalah jawabannya?"
PENTING: Script HARUS menjawab pertanyaan ini secara bertahap, membuka layer demi layer hingga pendengar menemukan jawabannya sendiri.`,
  },
  {
    id: 'citra-emosional',
    name: 'Citra Emosional',
    instruction: `PEMBUKA CITRA EMOSIONAL (maksimal 15 kata):
Tulis gambaran visual/metafora yang menyentuh emosi terdalam secara langsung.
- Gunakan metafora tubuh, alam, atau pengalaman universal yang intim
- Harus terasa "ditujukan untuk pendengar" secara personal
- Contoh: "Ada burung di dadamu yang lupa cara terbang"
- Contoh: "Lukamu masih berbicara... di tengah malam"
- Contoh: "Ada hujan yang turun di dalam dirimu... yang tak pernah reda"
PENTING: Script HARUS mengembangkan imagery ini — jelaskan apa burung itu, apa luka itu, apa hujan itu dalam konteks spiritual topik yang diberikan.`,
  },
  {
    id: 'pengakuan-jujur',
    name: 'Pengakuan Jujur',
    instruction: `PEMBUKA PENGAKUAN JUJUR (maksimal 15 kata):
Tulis pernyataan yang mengakui kelemahan atau perjuangan manusiawi secara vulnerable.
- Gunakan "Kita semua pernah...", "Kadang...", "Ada bagian dari dirimu yang..."
- Harus terasa jujur dan relatable — bukan menghakimi
- Contoh: "Kita semua pernah berpura-pura baik-baik saja di hadapan-Nya"
- Contoh: "Kadang... aku lelah bersabar"
- Contoh: "Ada bagian dari dirimu yang malu mengakui... kau masih ragu"
PENTING: Script harus MEMVALIDASI perasaan ini dulu, baru membawa ke penerimaan dan kasih Tuhan. Jangan langsung menasihati.`,
  },
  {
    id: 'suara-tuhan',
    name: 'Suara dari Yang Maha',
    instruction: `PEMBUKA SUARA TUHAN (maksimal 15 kata):
Tulis seolah Sang Kekasih/Tuhan berbicara langsung kepada pendengar dengan lembut.
- Gunakan sudut pandang orang pertama dari perspektif Ilahi
- Harus intim, penuh kasih, dan mengejutkan
- Contoh: "Kau pikir Aku tidak melihat... saat kau menangis sendirian?"
- Contoh: "Kenapa kau lari dari-Ku... padahal Aku yang mencarimu?"
- Contoh: "Aku menunggumu... di tempat yang kau hindari"
PENTING: Script harus melanjutkan "dialog" ini — mengembangkan apa yang Tuhan ingin sampaikan tentang topik tersebut dengan penuh hikmah dan kelembutan.`,
  },
  {
    id: 'realita-pahit',
    name: 'Realita Pahit',
    instruction: `PEMBUKA REALITA PAHIT (maksimal 15 kata):
Tulis pernyataan yang mengakui kenyataan sulit/menyakitkan dalam kehidupan spiritual.
- Harus jujur tentang rasa sakit, tanpa langsung memberi solusi
- Validasi dulu, baru buka perspektif
- Contoh: "Tidak semua doa dijawab seperti yang kita mau"
- Contoh: "Ada luka yang memang... tidak akan sembuh"
- Contoh: "Terkadang Tuhan diam. Dan itu menyakitkan"
PENTING: Script harus MENGAKUI realita ini dengan jujur terlebih dahulu, BARU KEMUDIAN membuka perspektif spiritual yang lebih luas. Jangan terburu-buru memberi "jawaban".`,
  },
  {
    id: 'misteri-menggantung',
    name: 'Misteri Menggantung',
    instruction: `PEMBUKA MISTERI MENGGANTUNG (maksimal 15 kata):
Tulis pernyataan misterius yang menciptakan suspense dan rasa ingin tahu.
- Harus terasa seperti ada "sesuatu" yang akan diungkap
- Gunakan bahasa yang enigmatis tapi tidak membingungkan
- Contoh: "Ada sesuatu yang menunggumu... di balik kesedihanmu"
- Contoh: "Malam ini berbeda. Kau akan mengerti nanti"
- Contoh: "Seseorang sedang memikirkanmu. Bukan manusia"
PENTING: Script HARUS mengungkap misteri ini secara bertahap — bawa pendengar dalam perjalanan penemuan hingga "sesuatu" itu terungkap di akhir.`,
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
- SANGAT PENTING: Periksa ejaan dengan teliti! Tidak boleh ada typo. Pastikan setiap kata ditulis dengan benar dalam Bahasa Indonesia baku.

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
