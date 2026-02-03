import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 44 Hakikat/Sufi topics for spiritual video generation
const topics = [
  { name: 'Kembali', description: 'Kembali kepada Tuhan setelah tersesat. Bukan sekadar menyesali dosa, tapi melupakan segala yang menghalangi jiwa dari cinta-Nya. Pintu yang tak pernah tertutup.' },
  { name: 'Kehati-hatian Batin', description: 'Menjaga diri bukan hanya dari yang terlarang, tapi dari segala yang mengaburkan pandangan batin. Hidup dengan penuh kesadaran di setiap langkah.' },
  { name: 'Melepas Dunia', description: 'Melepaskan ketergantungan pada dunia. Bukan membenci dunia, tapi membebaskan hati dari genggamannya. Memiliki tanpa dimiliki.' },
  { name: 'Kemiskinan Spiritual', description: 'Menyadari bahwa diri ini tidak memiliki apa-apa dan hanya Tuhan yang menjadi kebutuhan sejati. Kaya karena tidak butuh selain-Nya.' },
  { name: 'Kesabaran', description: 'Kesabaran yang aktif, bukan pasif. Keteguhan jiwa menghadapi ujian, menahan diri dari keluhan, dan tetap berjalan meski jalan terasa gelap.' },
  { name: 'Penyerahan Diri', description: 'Penyerahan total kepada Tuhan setelah berusaha. Melepas ilusi kendali dan percaya bahwa segala yang terjadi adalah yang terbaik dari-Nya.' },
  { name: 'Kerelaan', description: 'Kerelaan hati menerima segala ketetapan Tuhan. Bukan hanya sabar, tapi menemukan kedamaian dan bahkan kegembiraan dalam setiap takdir-Nya.' },
  { name: 'Takut yang Mendekatkan', description: 'Takut bukan kepada siksaan, tapi takut terhalang dari-Nya. Ketakutan yang justru mendekatkan, bukan menjauhkan. Seperti ombak yang tunduk pada bulan.' },
  { name: 'Harapan', description: 'Harapan kepada rahmat Tuhan yang tak terbatas. Keyakinan bahwa segelap apapun malam, fajar pasti datang. Berbaik sangka kepada Sang Pencipta.' },
  { name: 'Kerinduan', description: 'Kerinduan mendalam kepada Tuhan. Rindu yang tak bernama, perasaan asing di dunia, dan panggilan pulang yang terdengar di keheningan malam.' },
  { name: 'Keintiman', description: 'Keintiman dengan Tuhan. Kedekatan yang membuat seorang hamba merasa tak pernah sendiri. Seperti ikan yang tak pernah merasa jauh dari air.' },
  { name: 'Cinta Ilahi', description: 'Mencintai Tuhan bukan karena surga atau neraka, tapi karena Dia layak dicintai. Cinta yang melampaui bentuk dan nama.' },
  { name: 'Peleburan Diri', description: 'Lebur dalam Tuhan. Kematian ego hingga yang tersisa hanya kesadaran akan Dia. Matilah sebelum kau mati.' },
  { name: 'Kekal Bersama-Nya', description: 'Setelah ego lebur, lahir kembali sebagai hamba sejati yang hidup dengan-Nya dan untuk-Nya. Hidup baru setelah kematian diri palsu.' },
  { name: 'Pengenalan Sejati', description: 'Pengenalan sejati terhadap Tuhan. Bukan pengetahuan akal, tapi pencerahan batin. Siapa mengenal dirinya, mengenal Tuhannya.' },
  { name: 'Penyucian Jiwa', description: 'Membersihkan hati dari penyakit batin. Mengosongkan dari sifat buruk, mengisi dengan sifat terpuji, hingga cahaya Tuhan menyingkap tabir.' },
  { name: 'Kesatuan Wujud', description: 'Tuhan hadir dalam segala sesuatu. Kemanapun kau menghadap, di situ wajah-Nya. Yang tampak dan Yang tersembunyi.' },
  { name: 'Mengawasi Hati', description: 'Kesadaran bahwa Tuhan selalu melihat. Menyembah seakan kau melihat-Nya, dan jika tidak, ketahuilah Dia melihatmu.' },
  { name: 'Seruling Buluh', description: 'Jiwa manusia yang terpisah dari asalnya. Ia baru bisa bernyanyi setelah dikosongkan dan dilubangi. Luka yang menjadi melodi.' },
  { name: 'Cahaya di Atas Cahaya', description: 'Tuhan adalah cahaya langit dan bumi. Cahaya-Nya berlapis-lapis, tak terhingga. Dan di dalam diri manusia ada percikan cahaya itu, menunggu untuk dikenali dan dinyalakan kembali.' },
  { name: 'Lautan dan Tetesan', description: 'Apakah tetesan yang mencari lautan, atau lautan yang berpura-pura menjadi tetesan? Ilusi keterpisahan antara hamba dan Tuhan.' },
  { name: 'Cermin Hati', description: 'Hati sebagai cermin yang memantulkan cahaya Tuhan. Jika cermin berdebu, cahaya tak bisa masuk. Membersihkan hati agar bisa melihat-Nya.' },
  { name: 'Burung dan Sangkar', description: 'Ruh yang terpenjara dalam tubuh. Burung yang lupa bahwa pintu sangkar tak pernah terkunci. Ia bisa terbang kapan saja, jika ingat sayapnya.' },
  { name: 'Kemabukan Spiritual', description: 'Mabuk cinta Tuhan tanpa minuman. Puncak kecintaan yang membuat akal tunduk dan hati mengambil alih.' },
  { name: 'Menyepi Bersama Tuhan', description: 'Mengasingkan diri dari keramaian untuk mendengar bisikan-Nya di kedalaman sunyi. Gua hati tempat harta pengenalan tersembunyi.' },
  { name: 'Nafas sebagai Ingatan', description: 'Setiap tarikan nafas adalah memanggil-Nya, setiap hembusan adalah kembali kepada-Nya. Hidup itu sendiri adalah ingatan tanpa henti kepada-Nya.' },
  { name: 'Mendengarkan dengan Hati', description: 'Seluruh alam memuji Tuhan bagi yang bisa mendengar. Suara di balik kesunyian. Kebijaksanaan yang datang saat mulut terdiam.' },
  { name: 'Perenungan', description: 'Merenungkan ciptaan untuk mengenal Sang Pencipta. Satu jam perenungan bisa melampaui satu tahun ibadah tanpa kesadaran.' },
  { name: 'Menimbang Diri', description: 'Introspeksi diri di penghujung hari. Menimbang amal dan niat. Siapa yang menghisab dirinya sebelum dihisab, ia akan ringan timbangannya.' },
  { name: 'Kembali yang Murni', description: 'Kembali yang total dan tulus. Bukan sekadar menyesal, tapi berputar balik sepenuhnya. Air mata yang membasuh bukan hanya mata, tapi seluruh jiwa.' },
  { name: 'Mati Sebelum Mati', description: 'Mati dari ego saat masih hidup. Kelahiran kedua yang sesungguhnya. Ketika diri palsu mati, ruh baru benar-benar hidup.' },
  { name: 'Lalai dan Terjaga', description: 'Kebanyakan manusia tertidur walau matanya terbuka. Manusia tidur, ketika mati barulah mereka terbangun.' },
  { name: 'Luka sebagai Cahaya', description: 'Patah hati sebagai pintu masuk cahaya Tuhan. Para pencari Tuhan percaya bahwa luka terdalam justru menjadi jendela terlebar.' },
  { name: 'Perjalanan Tanpa Jarak', description: 'Tuhan lebih dekat dari urat nadi. Pencarian yang ironis, yang dicari tak pernah pergi. Kita sudah sampai sebelum berangkat.' },
  { name: 'Penjara Pikiran', description: 'Bisikan jahat dan keraguan sebagai rantai yang kita buat sendiri. Kunci kebebasan ada di mengingat-Nya dan kepasrahan. Hati hanya tenang dengan mengingat Tuhan.' },
  { name: 'Tamu di Rumah Hati', description: 'Setiap emosi adalah tamu yang dikirim Tuhan. Sambut mereka dengan kerelaan, karena setiap tamu membawa pesan.' },
  { name: 'Pintu yang Selalu Terbuka', description: 'Tuhan membentangkan tangan-Nya bagi yang ingin kembali. Pintu-Nya tak pernah tertutup. Mengapa kau ragu untuk pulang?' },
  { name: 'Topeng dan Wajah Sejati', description: 'Siapa dirimu ketika tak seorang pun melihat? Melepas kepura-puraan untuk menemukan wajah sejati di hadapan Tuhan.' },
  { name: 'Debu dan Cahaya', description: 'Manusia diciptakan dari tanah yang hina, namun ditiupkan ruh Tuhan. Kerendahan yang justru memancarkan cahaya. Sujud yang mengangkat derajat.' },
  { name: 'Api yang Tidak Membakar', description: 'Cinta yang menerangi bukan menghanguskan. Seperti api yang menjadi dingin dan damai. Cinta Tuhan yang menyelamatkan, bukan menghancurkan.' },
  { name: 'Hakikat Shalat', description: 'Shalat bukan sekadar gerakan tubuh dan bacaan lisan. Ia adalah perjalanan ruh menghadap Tuhan. Sujud yang sesungguhnya adalah ketika hati lebih rendah dari lutut.' },
  { name: 'Ketulusan Sejati', description: 'Beramal tanpa penonton. Ketulusan yang murni adalah ketika tangan kiri tak tahu apa yang diberikan tangan kanan. Melakukan kebaikan bukan untuk dilihat, tapi karena memang begitulah hati ingin bergerak.' },
  { name: 'Ibadah dengan Rasa Cinta', description: 'Beribadah bukan karena kewajiban yang memberatkan, tapi karena rindu yang menggerakkan. Seperti kekasih yang tak perlu dipaksa untuk menemui yang dicintainya.' },
  { name: 'Tak Mengharap Pahala', description: 'Beramal tanpa perhitungan untung rugi. Bukan pedagang yang berdagang dengan Tuhan, tapi pecinta yang memberi tanpa mengharap kembali. Ibadah karena Dia layak disembah, bukan karena apa yang bisa didapat.' },
];

const backgrounds = [
  { name: 'Forest Stream', filename: '01-forest-stream.mp4', category: 'nature' },
  { name: 'Mountain Lake', filename: '02-mountain-lake.mp4', category: 'nature' },
  { name: 'Ocean Waves', filename: '03-ocean-waves.mp4', category: 'nature' },
  { name: 'Clouds Timelapse', filename: '04-clouds-timelapse.mp4', category: 'sky' },
  { name: 'Rain on Leaves', filename: '05-rain-on-leaves.mp4', category: 'nature' },
  { name: 'Misty Forest', filename: '06-misty-forest.mp4', category: 'nature' },
  { name: 'Starry Night', filename: '07-starry-night.mp4', category: 'sky' },
  { name: 'Autumn Leaves', filename: '08-autumn-leaves.mp4', category: 'nature' },
  { name: 'Sunlight Trees', filename: '09-sunlight-trees.mp4', category: 'nature' },
  { name: 'Waterfall', filename: '10-waterfall.mp4', category: 'nature' },
];

async function main() {
  // Delete existing topics that have no videos
  console.log('Cleaning up existing topics...');
  const existingTopics = await prisma.topic.findMany({
    include: { _count: { select: { videos: true } } },
  });

  for (const topic of existingTopics) {
    if (topic._count.videos === 0) {
      await prisma.topic.delete({ where: { id: topic.id } });
      console.log(`  - Deleted: ${topic.name}`);
    } else {
      // Deactivate topics with videos instead of deleting
      await prisma.topic.update({
        where: { id: topic.id },
        data: { isActive: false },
      });
      console.log(`  - Deactivated (has ${topic._count.videos} videos): ${topic.name}`);
    }
  }

  console.log('\nSeeding new topics...');

  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { name: topic.name },
      update: { description: topic.description, isActive: true },
      create: {
        name: topic.name,
        description: topic.description,
        isActive: true,
      },
    });
    console.log(`  - ${topic.name}`);
  }

  console.log('\nSeeding background videos...');

  for (const bg of backgrounds) {
    await prisma.backgroundVideo.upsert({
      where: { filename: bg.filename },
      update: {},
      create: {
        name: bg.name,
        filename: bg.filename,
        durationMs: 5000, // 5 seconds
        category: bg.category,
      },
    });
    console.log(`  - ${bg.name}`);
  }

  console.log('\nSeeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
