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
  mcq:   { name: 'Pilihan Ganda', icon: '🔠', hint: 'Pilih satu jawaban benar' },
  tf:    { name: 'Benar / Salah', icon: '⚖️', hint: 'Tentukan pernyataan benar atau salah' },
  short: { name: 'Isian Singkat', icon: '⌨️', hint: 'Ketik jawaban singkat' },
  match: { name: 'Menjodohkan',   icon: '🔗', hint: 'Pasangkan kiri dengan kanan' },
  order: { name: 'Mengurutkan',   icon: '🔢', hint: 'Susun urutan yang benar' }
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

var TEMPLATES = [
  {
    id: 't-mat', title: 'Kuis Kilat Fungsi Kuadrat', subject: 'Matematika', theme: 'neon', mode: 'Kuis Kilat',
    description: 'Adu cepat menjawab soal fungsi kuadrat. Cocok untuk pemanasan.',
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
    id: 't-fis', title: 'Misi Hukum Newton', subject: 'Fisika', theme: 'galaxy', mode: 'Petualangan',
    description: 'Jelajahi hukum gerak Newton dalam misi luar angkasa.',
    settings: { timePerQuestion: 40 },
    questions: [
      mcq('Benda bermassa 4 kg diberi gaya 20 N. Percepatannya adalah…', ['5 m/s²', '80 m/s²', '0,2 m/s²', '16 m/s²'], 0),
      tf('Hukum I Newton disebut juga hukum kelembaman (inersia).', true),
      match('Jodohkan hukum Newton dengan contohnya.', [['Hukum I', 'Penumpang terdorong ke depan saat bus mengerem'], ['Hukum II', 'Mobil makin berat makin sulit dipercepat'], ['Hukum III', 'Roket terdorong ke atas karena semburan gas ke bawah']]),
      mcq('Satuan gaya dalam SI adalah…', ['Newton', 'Joule', 'Watt', 'Pascal'], 0),
      short('Berat benda bermassa 10 kg di bumi (g = 10 m/s²) adalah … N', ['100']),
      tf('Gaya aksi dan reaksi bekerja pada benda yang sama.', false)
    ]
  },
  {
    id: 't-bio', title: 'Ekspedisi Sel & Organel', subject: 'Biologi', theme: 'jungle', mode: 'Petualangan',
    description: 'Kenali organel sel dan fungsinya sambil menjelajah rimba.',
    settings: { timePerQuestion: 30 },
    questions: [
      match('Jodohkan organel dengan fungsinya.', [['Mitokondria', 'Respirasi sel / penghasil energi'], ['Ribosom', 'Sintesis protein'], ['Kloroplas', 'Fotosintesis'], ['Lisosom', 'Pencernaan intraseluler']]),
      mcq('Organel yang hanya dimiliki sel tumbuhan adalah…', ['Dinding sel', 'Ribosom', 'Mitokondria', 'Membran sel'], 0),
      tf('Sel prokariotik tidak memiliki membran inti.', true),
      mcq('Pusat pengatur seluruh kegiatan sel adalah…', ['Nukleus', 'Vakuola', 'Badan Golgi', 'Sentriol'], 0),
      short('Organel yang berperan dalam modifikasi dan pengemasan protein disebut badan …', ['golgi', 'badan golgi']),
      order('Urutkan tingkat organisasi kehidupan dari yang terkecil.', ['Sel', 'Jaringan', 'Organ', 'Sistem organ', 'Organisme'])
    ]
  },
  {
    id: 't-kim', title: 'Tantangan Tabel Periodik', subject: 'Kimia', theme: 'volcano', mode: 'Kuis Kilat',
    description: 'Seberapa kenal kamu dengan unsur-unsur kimia?',
    settings: { timePerQuestion: 25 },
    questions: [
      match('Jodohkan lambang unsur dengan namanya.', [['Na', 'Natrium'], ['K', 'Kalium'], ['Fe', 'Besi'], ['Ag', 'Perak']]),
      mcq('Unsur golongan VIIIA disebut…', ['Gas mulia', 'Halogen', 'Alkali', 'Alkali tanah'], 0),
      short('Lambang unsur emas adalah…', ['Au']),
      tf('Dalam satu periode dari kiri ke kanan, jari-jari atom cenderung semakin kecil.', true),
      mcq('Konfigurasi elektron ₁₁Na adalah…', ['2, 8, 1', '2, 8, 2', '2, 9', '2, 7, 2'], 0),
      tf('Unsur-unsur golongan IA disebut halogen.', false)
    ]
  },
  {
    id: 't-sej', title: 'Lorong Waktu Kemerdekaan', subject: 'Sejarah', theme: 'pixel', mode: 'Urutkan Peristiwa',
    description: 'Susun kembali peristiwa menjelang dan sesudah Proklamasi.',
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
    id: 't-ing', title: 'Tenses Challenge', subject: 'Bahasa Inggris', theme: 'candy', mode: 'Kuis Kilat',
    description: 'Master the English tenses — fast and fun!',
    settings: { timePerQuestion: 25 },
    questions: [
      mcq('She ___ to school every day.', ['goes', 'go', 'is go', 'going'], 0),
      mcq('They ___ football when it started to rain.', ['were playing', 'played', 'are playing', 'have played'], 0),
      short('Past participle of "write" is…', ['written']),
      tf('"I have finished my homework" uses the present perfect tense.', true),
      match('Match the tense with its example.', [['Simple Past', 'I visited Bali last year'], ['Present Continuous', 'I am reading now'], ['Simple Future', 'I will call you tomorrow']]),
      mcq('By next year, I ___ here for ten years.', ['will have worked', 'will work', 'have worked', 'worked'], 0)
    ]
  },
  {
    id: 't-ind', title: 'Detektif Majas', subject: 'Bahasa Indonesia', theme: 'ocean', mode: 'Petualangan',
    description: 'Selami dunia majas dan unsur kebahasaan.',
    settings: { timePerQuestion: 35 },
    questions: [
      match('Jodohkan majas dengan contohnya.', [['Personifikasi', 'Angin berbisik di telingaku'], ['Hiperbola', 'Tangisnya membanjiri seisi rumah'], ['Metafora', 'Dia adalah bintang kelas'], ['Simile', 'Wajahnya bagai bulan purnama']]),
      mcq('"Ayah baru saja membeli Kijang." Kalimat ini mengandung majas…', ['Metonimia', 'Hiperbola', 'Litotes', 'Ironi'], 0),
      tf('Teks eksposisi bertujuan menghibur pembaca dengan cerita fiksi.', false),
      mcq('Struktur teks eksposisi yang tepat adalah…', ['Tesis – argumentasi – penegasan ulang', 'Orientasi – komplikasi – resolusi', 'Abstrak – orientasi – koda', 'Identifikasi – deskripsi'], 0),
      short('Majas yang merendahkan diri untuk tujuan sopan santun disebut…', ['litotes'])
    ]
  },
  {
    id: 't-eko', title: 'Pasar Juara: Permintaan & Penawaran', subject: 'Ekonomi', theme: 'sport', mode: 'Benar/Salah Cepat',
    description: 'Tebak cepat konsep hukum permintaan dan penawaran.',
    settings: { timePerQuestion: 15 },
    questions: [
      tf('Menurut hukum permintaan, jika harga naik maka jumlah barang yang diminta turun (ceteris paribus).', true),
      tf('Menurut hukum penawaran, jika harga naik maka jumlah barang yang ditawarkan turun.', false),
      mcq('Titik pertemuan kurva permintaan dan penawaran disebut…', ['Harga keseimbangan', 'Harga eceran', 'Harga pokok', 'Harga dasar'], 0),
      tf('Pendapatan konsumen termasuk faktor yang memengaruhi permintaan.', true),
      mcq('Pasar yang hanya memiliki satu penjual disebut pasar…', ['Monopoli', 'Oligopoli', 'Persaingan sempurna', 'Monopsoni'], 0),
      tf('Biaya produksi tidak memengaruhi penawaran.', false)
    ]
  },
  {
    id: 't-geo', title: 'Menembus Atmosfer', subject: 'Geografi', theme: 'ocean', mode: 'Urutkan',
    description: 'Susun lapisan atmosfer dan kenali cirinya.',
    settings: { timePerQuestion: 40 },
    questions: [
      order('Urutkan lapisan atmosfer dari yang paling dekat dengan permukaan bumi.', ['Troposfer', 'Stratosfer', 'Mesosfer', 'Termosfer', 'Eksosfer']),
      match('Jodohkan lapisan dengan cirinya.', [['Troposfer', 'Tempat terjadinya cuaca'], ['Stratosfer', 'Terdapat lapisan ozon'], ['Mesosfer', 'Tempat meteor terbakar']]),
      tf('Lapisan ozon melindungi bumi dari radiasi ultraviolet.', true),
      mcq('Gas yang paling banyak di atmosfer bumi adalah…', ['Nitrogen', 'Oksigen', 'Karbon dioksida', 'Argon'], 0)
    ]
  },
  {
    id: 't-inf', title: 'Kode Rahasia Algoritma', subject: 'Informatika', theme: 'neon', mode: 'Kuis Kilat',
    description: 'Pecahkan teka-teki algoritma dan logika.',
    settings: { timePerQuestion: 35 },
    questions: [
      order('Urutkan langkah algoritma menukar isi dua gelas A dan B.', ['Tuang isi gelas A ke gelas C (kosong)', 'Tuang isi gelas B ke gelas A', 'Tuang isi gelas C ke gelas B']),
      mcq('Struktur yang mengulang instruksi selama kondisi terpenuhi disebut…', ['Perulangan', 'Percabangan', 'Runtunan', 'Fungsi'], 0),
      short('Bilangan biner 1010 sama dengan bilangan desimal…', ['10']),
      tf('Flowchart menggunakan simbol belah ketupat untuk keputusan.', true),
      match('Jodohkan istilah dengan artinya.', [['Input', 'Data yang dimasukkan'], ['Proses', 'Pengolahan data'], ['Output', 'Hasil pengolahan']])
    ]
  },
  {
    id: 't-ujian', title: 'Ulangan Harian (Mode Ujian)', subject: 'Lainnya', theme: 'galaxy', mode: 'Mode Ujian',
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
  delete g.id; delete g.mode;
  g.code = '';
  return g;
}
