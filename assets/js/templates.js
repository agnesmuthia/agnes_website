/* templates.js — Tema visual, daftar mapel, jenis soal, dan template game siap pakai. */
var THEMES = {
  galaxy:  { name: 'Galaksi Kuis',      icon: '🚀', deco: ['🪐', '⭐', '☄️', '🌙', '✨'], desc: 'Petualangan luar angkasa' },
  neon:    { name: 'Arena Neon',        icon: '🎮', deco: ['⚡', '💥', '🕹️', '💎', '🔷'], desc: 'Gaya arcade cyberpunk' },
  jungle:  { name: 'Petualangan Rimba', icon: '🌴', deco: ['🦜', '🍃', '🐒', '🌺', '🦋'], desc: 'Jelajah hutan tropis' },
  ocean:   { name: 'Misi Samudra',      icon: '🐙', deco: ['🐠', '🫧', '🐚', '🌊', '🐬'], desc: 'Menyelam ke dasar laut' },
  volcano: { name: 'Gunung Api',        icon: '🌋', deco: ['🔥', '💥', '🪨', '☄️', '🔥'], desc: 'Tantangan panas membara' },
  candy:   { name: 'Pop Pastel',        icon: '🍭', deco: ['🍬', '🧁', '🌈', '💖', '🍩'], desc: 'Ceria dan manis' },
  pixel:   { name: 'Retro 8-Bit',       icon: '👾', deco: ['🕹️', '💾', '🍄', '⭐', '🪙'], desc: 'Game jadul klasik' },
  sport:   { name: 'Stadion Juara',     icon: '🏆', deco: ['⚽', '🏀', '🥇', '🏸', '🎯'], desc: 'Semangat kompetisi' }
};

var SUBJECTS = ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Indonesia', 'Bahasa Inggris', 'Sejarah', 'Geografi',
  'Ekonomi', 'Sosiologi', 'PPKn', 'Pendidikan Agama', 'Informatika', 'Seni Budaya', 'PJOK', 'Bahasa Daerah', 'Lainnya'];

var QTYPES = {
  mcq:        { name: 'Pilihan Ganda', icon: '🔠', hint: 'Pilih satu jawaban benar' },
  tf:         { name: 'Benar / Salah', icon: '⚖️', hint: 'Tentukan pernyataan benar atau salah' },
  short:      { name: 'Isian Singkat', icon: '⌨️', hint: 'Ketik jawaban singkat' },
  match:      { name: 'Menjodohkan', icon: '🔗', hint: 'Pasangkan kiri dengan kanan' },
  order:      { name: 'Mengurutkan', icon: '🔢', hint: 'Susun urutan yang benar' },
  group:      { name: 'Kelompokkan', icon: '🗂️', hint: 'Masukkan setiap item ke kelompoknya' },
  word:       { name: 'Kata Rahasia', icon: '🔤', hint: 'Temukan kata dari petunjuk' },
  cloze:      { name: 'Lengkapi Kalimat', icon: '✍️', hint: 'Isi bagian yang kosong' },
  multi:      { name: 'Pilih Semua yang Benar', icon: '☑️', hint: 'Bisa lebih dari satu jawaban' },
  wordsearch: { name: 'Cari Kata', icon: '🔍', hint: 'Temukan kata di kotak huruf' }
};

var ALL_TYPES = Object.keys(QTYPES);

// Jenis permainan. "types" = jenis soal yang cocok; soal lain tetap bisa dimainkan dengan tampilan standar.
var MODES = {
  classic:    { name: 'Kuis Klasik', icon: '📝', types: ALL_TYPES, desc: 'Kuis cepat ala gameshow dengan timer, combo, dan power-up. Semua jenis soal bisa dipakai.', how: 'Jawab setiap soal secepat dan setepat mungkin!' },
  balloon:    { name: 'Balon Meletus', icon: '🎈', types: ['mcq', 'tf'], desc: 'Jawaban melayang sebagai balon. Letuskan balon yang benar sebelum terbang!', how: 'Ketuk balon yang membawa jawaban benar.' },
  whack:      { name: 'Pukul Tikus', icon: '🔨', types: ['multi'], desc: 'Tikus bermunculan membawa jawaban. Pukul hanya yang benar, hindari yang salah!', how: 'Pukul tikus yang membawa jawaban benar. Memukul yang salah mengurangi nilai.' },
  memory:     { name: 'Kartu Memori', icon: '🃏', types: ['match'], reveal: true, desc: 'Buka dua kartu sekaligus dan temukan pasangan yang cocok.', how: 'Ingat posisi kartu, lalu buka dua kartu yang berpasangan.' },
  hangman:    { name: 'Tebak Kata', icon: '🔡', types: ['word'], reveal: true, desc: 'Tebak huruf demi huruf dari petunjuk sebelum balon udaramu habis.', how: 'Pilih huruf untuk menebak kata. Setiap tebakan salah meletuskan satu balon.' },
  anagram:    { name: 'Susun Huruf', icon: '🔤', types: ['word'], desc: 'Huruf-huruf diacak. Susun kembali menjadi kata yang benar.', how: 'Ketuk huruf sesuai urutan untuk membentuk kata.' },
  group:      { name: 'Kelompokkan', icon: '🗂️', types: ['group'], desc: 'Seret atau ketuk setiap item ke dalam kelompok yang tepat.', how: 'Pilih item, lalu ketuk kelompok tujuannya.' },
  cloze:      { name: 'Lengkapi Kalimat', icon: '✍️', types: ['cloze'], desc: 'Kalimat rumpang: pilih kata yang tepat untuk setiap bagian kosong.', how: 'Ketuk kata di bank kata untuk mengisi bagian kosong.' },
  wordsearch: { name: 'Cari Kata', icon: '🔍', types: ['wordsearch'], desc: 'Temukan kata-kata yang tersembunyi di kotak huruf.', how: 'Geser jari dari huruf pertama ke huruf terakhir, atau ketuk keduanya.' },
  wheel:      { name: 'Roda Putar', icon: '🎡', types: ALL_TYPES, desc: 'Putar roda keberuntungan untuk menentukan soal berikutnya.', how: 'Putar roda, lalu jawab soal yang terpilih.' },
  box:        { name: 'Kotak Misteri', icon: '🎁', types: ALL_TYPES, desc: 'Pilih kotak misteri, buka, dan jawab soal di dalamnya.', how: 'Pilih kotak mana saja. Buka semua kotak untuk menyelesaikan game.' }
};

var DEFAULT_SETTINGS = {
  questionCount: 0, timePerQuestion: 30, maxAttempts: 1, scorePolicy: 'best', kkm: 75,
  openAt: '', closeAt: '', active: true, shuffleQuestions: true, shuffleOptions: true,
  showFeedback: true, showLeaderboard: true, powerUps: true, antiCheat: 3,
  loginMode: 'form', allowedDomain: ''
};

function mcq(q, options, answer) { return { type: 'mcq', q: q, options: options, answer: answer }; }
function tf(q, answer) { return { type: 'tf', q: q, answer: answer }; }
function short(q, answers) { return { type: 'short', q: q, answers: answers }; }
function match(q, pairs) { return { type: 'match', q: q, pairs: pairs }; }
function order(q, items) { return { type: 'order', q: q, items: items }; }
function qGroup(q, groups) {
  return { type: 'group', q: q, groups: Object.keys(groups).map(function (k) { return { name: k, items: groups[k] }; }) };
}
function qWord(clue, answer) { return { type: 'word', q: clue, answer: answer }; }
function qCloze(text, extra, q) { return { type: 'cloze', q: q || 'Lengkapi kalimat berikut.', text: text, extra: extra || [] }; }
function qMulti(q, right, wrong) {
  return { type: 'multi', q: q, items: right.map(function (t) { return [t, true]; }).concat(wrong.map(function (t) { return [t, false]; })) };
}
function qSearch(q, words) { return { type: 'wordsearch', q: q, words: words }; }

var TEMPLATES = [
  {
    id: 't-mat', title: 'Kuis Kilat Fungsi Kuadrat', subject: 'Matematika', theme: 'neon', mode: 'classic',
    description: 'Adu cepat menjawab soal fungsi kuadrat dengan berbagai jenis soal. Cocok untuk pemanasan.',
    settings: { timePerQuestion: 30, maxAttempts: 2 },
    questions: [
      mcq('Titik puncak grafik f(x) = x² − 4x + 3 adalah…', ['(2, −1)', '(−2, 15)', '(2, 1)', '(4, 3)'], 0),
      mcq('Akar-akar persamaan x² − 5x + 6 = 0 adalah…', ['2 dan 3', '−2 dan −3', '1 dan 6', '−1 dan 6'], 0),
      tf('Grafik f(x) = −2x² + 3 terbuka ke bawah.', true),
      short('Nilai diskriminan dari x² + 2x + 5 = 0 adalah… (tulis angkanya)', ['-16', '−16']),
      mcq('Sumbu simetri dari f(x) = 2x² + 8x − 1 adalah…', ['x = −2', 'x = 2', 'x = −4', 'x = 4'], 0),
      tf('Jika D < 0, persamaan kuadrat memiliki dua akar real berbeda.', false),
      match('Jodohkan nilai diskriminan dengan jenis akarnya.', [['D > 0', 'Dua akar real berbeda'], ['D = 0', 'Dua akar real kembar'], ['D < 0', 'Tidak memiliki akar real']])
    ]
  },
  {
    id: 't-fis-balon', title: 'Letuskan Balon Besaran & Satuan', subject: 'Fisika', theme: 'candy', mode: 'balloon',
    description: 'Balon jawaban melayang ke atas. Letuskan yang benar sebelum lepas!',
    settings: { timePerQuestion: 20, maxAttempts: 2 },
    questions: [
      mcq('Satuan SI untuk gaya adalah…', ['Newton', 'Joule', 'Watt', 'Pascal'], 0),
      mcq('Besaran berikut yang termasuk besaran pokok adalah…', ['Massa', 'Gaya', 'Kecepatan', 'Usaha'], 0),
      mcq('Satuan SI untuk energi adalah…', ['Joule', 'Newton', 'Volt', 'Kelvin'], 0),
      tf('Kecepatan termasuk besaran vektor.', true),
      mcq('Alat untuk mengukur kuat arus listrik adalah…', ['Amperemeter', 'Voltmeter', 'Ohmmeter', 'Barometer'], 0),
      tf('Satuan suhu dalam SI adalah derajat Celsius.', false),
      mcq('Dimensi kecepatan adalah…', ['[L][T]⁻¹', '[M][L][T]⁻²', '[L][T]⁻²', '[M][T]⁻¹'], 0),
      mcq('Benda jatuh bebas dari ketinggian 20 m (g = 10 m/s²). Waktu sampai ke tanah adalah…', ['2 s', '4 s', '1 s', '20 s'], 0)
    ]
  },
  {
    id: 't-kim-tikus', title: 'Pukul Unsur & Senyawa!', subject: 'Kimia', theme: 'volcano', mode: 'whack',
    description: 'Tikus bermunculan membawa lambang kimia. Pukul hanya yang sesuai perintah!',
    settings: { timePerQuestion: 25, maxAttempts: 2, powerUps: false },
    questions: [
      qMulti('Pukul semua unsur LOGAM!', ['Na', 'Fe', 'Cu', 'Al', 'Mg'], ['O', 'N', 'Cl', 'S', 'Ne']),
      qMulti('Pukul semua GAS MULIA!', ['He', 'Ne', 'Ar', 'Kr', 'Xe'], ['H', 'O', 'N', 'Cl', 'F']),
      qMulti('Pukul semua senyawa ASAM!', ['HCl', 'H₂SO₄', 'HNO₃', 'CH₃COOH'], ['NaOH', 'KOH', 'NaCl', 'Ca(OH)₂', 'NH₃'])
    ]
  },
  {
    id: 't-bio-memori', title: 'Kartu Memori Sel & Organ', subject: 'Biologi', theme: 'jungle', mode: 'memory',
    description: 'Buka kartu dan temukan pasangan organel–fungsi serta sistem–organ.',
    settings: { timePerQuestion: 40, maxAttempts: 2, powerUps: false },
    questions: [
      match('Temukan pasangan organel dan fungsinya.', [['Mitokondria', 'Respirasi sel'], ['Ribosom', 'Sintesis protein'], ['Kloroplas', 'Fotosintesis'],
        ['Lisosom', 'Pencernaan intrasel'], ['Nukleus', 'Pengendali kegiatan sel'], ['Vakuola', 'Penyimpan cairan sel']]),
      match('Temukan pasangan sistem organ dan organnya.', [['Pernapasan', 'Paru-paru'], ['Pencernaan', 'Lambung'], ['Peredaran darah', 'Jantung'],
        ['Ekskresi', 'Ginjal'], ['Koordinasi', 'Otak'], ['Gerak', 'Tulang']])
    ]
  },
  {
    id: 't-ing-hangman', title: 'Vocabulary Hangman', subject: 'Bahasa Inggris', theme: 'ocean', mode: 'hangman',
    description: 'Guess the English word letter by letter before your balloons run out!',
    settings: { timePerQuestion: 40, maxAttempts: 3, powerUps: false },
    questions: [
      qWord('A person who teaches students at school', 'TEACHER'),
      qWord('The opposite of "ancient"', 'MODERN'),
      qWord('A place where you can borrow books', 'LIBRARY'),
      qWord('The day after today', 'TOMORROW'),
      qWord('Past tense of "write"', 'WROTE'),
      qWord('A very large body of salt water', 'OCEAN'),
      qWord('Someone who flies an airplane', 'PILOT')
    ]
  },
  {
    id: 't-inf-anagram', title: 'Susun Istilah Informatika', subject: 'Informatika', theme: 'neon', mode: 'anagram',
    description: 'Huruf-huruf istilah komputer diacak. Susun kembali berdasarkan petunjuk!',
    settings: { timePerQuestion: 30, maxAttempts: 2 },
    questions: [
      qWord('Langkah-langkah logis dan sistematis untuk menyelesaikan masalah', 'ALGORITMA'),
      qWord('Tempat menyimpan nilai yang dapat berubah di dalam program', 'VARIABEL'),
      qWord('Sistem bilangan yang hanya terdiri atas 0 dan 1', 'BINER'),
      qWord('Titik terkecil penyusun gambar digital', 'PIKSEL'),
      qWord('"Otak" komputer yang memproses instruksi', 'PROSESOR'),
      qWord('Kumpulan perangkat yang saling terhubung untuk berbagi data', 'JARINGAN'),
      qWord('Padanan bahasa Indonesia untuk "browser"', 'PERAMBAN')
    ]
  },
  {
    id: 't-eko-kelompok', title: 'Kelompokkan Konsep Ekonomi', subject: 'Ekonomi', theme: 'sport', mode: 'group',
    description: 'Sortir kebutuhan, pos APBN, dan peran pelaku ekonomi ke kelompok yang tepat.',
    settings: { timePerQuestion: 30, maxAttempts: 2 },
    questions: [
      qGroup('Kelompokkan berdasarkan intensitas kebutuhan.', {
        'Primer': ['Makanan pokok', 'Pakaian', 'Tempat tinggal'],
        'Sekunder': ['Kulkas', 'Sepeda motor', 'Televisi'],
        'Tersier': ['Mobil mewah', 'Perhiasan berlian', 'Kapal pesiar']
      }),
      qGroup('Kelompokkan pos dalam APBN.', {
        'Pendapatan negara': ['Pajak penghasilan', 'Bea dan cukai', 'Penerimaan negara bukan pajak'],
        'Belanja negara': ['Gaji pegawai negeri', 'Subsidi energi', 'Pembangunan infrastruktur']
      }),
      qGroup('Kelompokkan peran pelaku ekonomi.', {
        'Rumah tangga konsumen': ['Menyediakan tenaga kerja', 'Membeli barang konsumsi'],
        'Rumah tangga produsen': ['Membayar upah', 'Menghasilkan barang dan jasa'],
        'Pemerintah': ['Memungut pajak', 'Membuat kebijakan ekonomi']
      })
    ]
  },
  {
    id: 't-ind-cloze', title: 'Lengkapi Teks Bahasa Indonesia', subject: 'Bahasa Indonesia', theme: 'galaxy', mode: 'cloze',
    description: 'Kalimat rumpang tentang struktur teks, majas, dan kata baku. Pilih kata yang tepat!',
    settings: { timePerQuestion: 30, maxAttempts: 2 },
    questions: [
      qCloze('Teks eksposisi tersusun atas [tesis], [argumentasi], dan [penegasan ulang].', ['orientasi', 'komplikasi']),
      qCloze('Kalimat "Wajahnya bagai bulan purnama" mengandung majas [simile], sedangkan "Angin berbisik di telingaku" mengandung majas [personifikasi].', ['hiperbola', 'metafora']),
      qCloze('Bentuk baku dari kata "apotik" adalah [apotek], sedangkan bentuk baku dari "resiko" adalah [risiko].', ['apotik', 'resiko']),
      qCloze('Teks laporan hasil observasi bersifat [objektif] karena disusun berdasarkan [fakta].', ['subjektif', 'opini'])
    ]
  },
  {
    id: 't-geo-cari', title: 'Cari Kata Atmosfer & Batuan', subject: 'Geografi', theme: 'pixel', mode: 'wordsearch',
    description: 'Temukan nama lapisan atmosfer dan jenis batuan yang tersembunyi di kotak huruf.',
    settings: { timePerQuestion: 30, maxAttempts: 2, powerUps: false },
    questions: [
      qSearch('Temukan nama lapisan atmosfer!', ['TROPOSFER', 'STRATOSFER', 'MESOSFER', 'TERMOSFER', 'EKSOSFER', 'OZON']),
      qSearch('Temukan nama jenis batuan!', ['BASALT', 'GRANIT', 'MARMER', 'ANDESIT', 'OBSIDIAN', 'BREKSI'])
    ]
  },
  {
    id: 't-sej-roda', title: 'Roda Sejarah Kemerdekaan', subject: 'Sejarah', theme: 'pixel', mode: 'wheel',
    description: 'Putar roda untuk menentukan soal berikutnya tentang peristiwa Proklamasi.',
    settings: { timePerQuestion: 45 },
    questions: [
      order('Urutkan peristiwa berikut sesuai kronologi.', ['Pembentukan BPUPKI', 'Peristiwa Rengasdengklok', 'Proklamasi Kemerdekaan', 'Pengesahan UUD 1945 oleh PPKI']),
      mcq('Proklamasi kemerdekaan Indonesia dibacakan pada tanggal…', ['17 Agustus 1945', '16 Agustus 1945', '18 Agustus 1945', '1 Juni 1945'], 0),
      mcq('Teks proklamasi diketik oleh…', ['Sayuti Melik', 'Soekarno', 'Mohammad Hatta', 'Ahmad Soebardjo'], 0),
      tf('Peristiwa Rengasdengklok terjadi pada 16 Agustus 1945.', true),
      match('Jodohkan tokoh dengan perannya.', [['Soekarno', 'Membacakan teks proklamasi'], ['Fatmawati', 'Menjahit bendera Merah Putih'], ['Latief Hendraningrat', 'Mengibarkan bendera']]),
      short('Rumusan dasar negara yang disampaikan Soekarno pada 1 Juni 1945 diberi nama…', ['Pancasila'])
    ]
  },
  {
    id: 't-sos-kotak', title: 'Kotak Misteri Interaksi Sosial', subject: 'Sosiologi', theme: 'galaxy', mode: 'box',
    description: 'Setiap kotak menyimpan tantangan berbeda tentang interaksi sosial. Buka semuanya!',
    settings: { timePerQuestion: 35 },
    questions: [
      mcq('Syarat terjadinya interaksi sosial adalah…', ['Kontak sosial dan komunikasi', 'Kerja sama dan persaingan', 'Asimilasi dan akulturasi', 'Norma dan nilai'], 0),
      tf('Akulturasi adalah perpaduan dua kebudayaan tanpa menghilangkan unsur kebudayaan aslinya.', true),
      match('Jodohkan bentuk interaksi dengan contohnya.', [['Kerja sama', 'Gotong royong membersihkan desa'], ['Persaingan', 'Lomba cerdas cermat antarsekolah'],
        ['Konflik', 'Tawuran antarpelajar'], ['Akomodasi', 'Mediasi oleh pihak ketiga']]),
      qMulti('Pilih semua yang termasuk proses sosial ASOSIATIF.', ['Kerja sama', 'Akomodasi', 'Asimilasi', 'Akulturasi'], ['Persaingan', 'Kontravensi', 'Konflik']),
      qGroup('Kelompokkan contoh norma berikut.', {
        'Norma kesopanan': ['Mengucapkan salam saat bertamu', 'Berbicara santun kepada orang tua'],
        'Norma hukum': ['Memakai helm saat berkendara', 'Membayar pajak tepat waktu']
      }),
      short('Proses sosial yang mengarah pada persatuan disebut proses…', ['asosiatif'])
    ]
  },
  {
    id: 't-ujian', title: 'Ulangan Harian (Mode Ujian)', subject: 'Lainnya', theme: 'galaxy', mode: 'classic', exam: true,
    description: 'Template kosong untuk penilaian resmi: 1x kesempatan, tanpa kunci jawaban di layar, anti-curang ketat.',
    settings: { timePerQuestion: 60, maxAttempts: 1, showFeedback: false, showLeaderboard: false, powerUps: false, antiCheat: 2, scorePolicy: 'first' },
    questions: [
      mcq('Contoh soal: ganti dengan soal Anda.', ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'], 0)
    ]
  }
];

// Membuat salinan template yang siap disunting.
function gameFromTemplate(t) {
  var g = JSON.parse(JSON.stringify(t));
  g.questions.forEach(function (q) { q.id = U.uid(); });
  g.settings = Object.assign({}, DEFAULT_SETTINGS, g.settings || {});
  g.mode = MODES[g.mode] ? g.mode : 'classic';
  delete g.id; delete g.exam;
  g.code = '';
  return g;
}
