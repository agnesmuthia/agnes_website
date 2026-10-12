# 🎮 Game Belajar

Aplikasi web untuk membuat **game pembelajaran interaktif** bagi siswa SMA. Aplikasi ini dilengkapi rekap nilai 0–100,
papan skor ratusan siswa, analisis data dengan diagram, dan penyimpanan rekap ke **Google Drive**.

## ✨ Fitur

| Untuk siswa | Untuk guru |
|---|---|
| Masuk dengan **kode game** atau link/QR | **Perpustakaan aktivitas** untuk semua mata pelajaran (cari, filter mapel, duplikat) |
| Login: **akun Google (Gmail)** terverifikasi, atau formulir nama-kelas-NIS (diatur per game) | **Editor game** dengan 5 jenis soal: pilihan ganda, benar/salah, isian, menjodohkan, mengurutkan |
| 8 tema visual (Galaksi, Neon, Rimba, Samudra, Gunung Api, Pastel, Retro 8-Bit, Stadion) | **11 template siap pakai** (Matematika, Fisika, Biologi, Kimia, Sejarah, B. Inggris, B. Indonesia, Ekonomi, Geografi, Informatika, Mode Ujian) |
| Timer, XP, combo 🔥, power-up 50:50 & +15 detik, efek suara, konfeti | **Ekspor/impor template** (.json) dan **impor soal cepat** dari teks |
| Hasil berupa nilai 0–100 dengan animasi | **Atur akses**: jumlah soal, waktu, maks. kesempatan, jadwal buka/tutup, KKM, nilai tertinggi/terakhir/pertama |
| **Papan skor** dengan podium, pencarian, filter kelas, halaman per 50 siswa, layar penuh, refresh otomatis | **Rekap nilai**: ekspor CSV/Excel, cetak, reset kesempatan, **simpan ke folder Google Drive** (per kelas atau gabungan, lengkap dengan diagram), **simpan otomatis setiap malam** |
| Melanjutkan pengerjaan setelah halaman tidak sengaja dimuat ulang | **Analisis**: rata-rata, median, ketuntasan, sebaran nilai, per kelas, analisis butir soal (kesukaran & daya pembeda), **kemajuan lintas game**, dan **rekomendasi tindakan guru** |

### 🛡️ Menjaga kejujuran nilai
- Dengan **login Google**, identitas siswa diverifikasi oleh Google di server dan kesempatan dihitung per email, sehingga siswa tidak bisa menyamar atau mengganti NIS untuk mengulang.
- Kesempatan **dihitung saat siswa menekan "Mulai"**, jadi memuat ulang halaman tidak menghasilkan kesempatan baru.
- Nilai **dihitung di server** dari jawaban siswa, bukan dari skor yang dikirim browser.
- Soal & pilihan **diacak per siswa**. Bila "jumlah soal" lebih kecil dari bank soal, tiap siswa mendapat paket soal berbeda.
- **Deteksi keluar halaman**: setiap pindah tab/aplikasi dicatat. Setelah batas tercapai, jawaban dikumpulkan otomatis.
- Mode **ulangan resmi** (matikan "Tampilkan benar/salah langsung"): kunci jawaban tidak dikirim ke perangkat siswa sama sekali.
- Jawaban yang dikirim setelah game ditutup atau melebihi batas waktu tetap dinilai, tetapi **diberi tanda** di rekap.
- Papan skor tidak pernah mengirim NIS atau email siswa.
- Analisis menandai hasil yang **perlu diverifikasi** (sering keluar halaman, atau nilai tinggi dengan waktu jawab yang tidak wajar).

## 🚀 Menjalankan

Aplikasi ini terdiri dari file statis saja (HTML/CSS/JS, tanpa proses build).

1. **Online gratis dengan GitHub Pages**: di repositori GitHub buka *Settings → Pages*, lalu pilih branch dan folder `/ (root)`.
   Aplikasi akan tersedia di `https://<username>.github.io/<nama-repo>/`.
2. **Coba di komputer**: jalankan `python3 -m http.server` di folder ini, lalu buka `http://localhost:8000`.

Saat pertama kali dibuka, aplikasi berjalan dalam **Mode Lokal**: data tersimpan di browser itu saja. Mode ini cocok untuk mencoba.

## ☁️ Menghubungkan ke Google Sheets / Google Drive (agar bisa dibagikan ke siswa)

1. Buat Google Sheets baru (https://sheets.new), misalnya beri nama **Database Game Belajar**.
2. Buka menu **Ekstensi → Apps Script**, hapus kode bawaan, lalu tempel seluruh isi [`backend/Code.gs`](backend/Code.gs).
3. Buka **Project Settings** (ikon ⚙️) → **Script Properties** → **Add script property**. Isi *Property* `TEACHER_KEY` dan *Value* kata sandi Anda, lalu **Save**. Kata sandi tidak ditulis di dalam kode.
4. Klik **Terapkan → Deployment baru → Aplikasi web**. Isi *Jalankan sebagai*: **Saya**, dan *Akses*: **Siapa saja**. Klik **Terapkan** dan beri izin.
5. Salin URL yang berakhiran `/exec`. Di aplikasi buka **Guru → Pengaturan**, tempel URL tersebut, lalu klik **Simpan**.
6. Masuk kembali dengan kata sandi yang Anda isi pada `TEACHER_KEY`.

Setelah terhubung:
- Link/kode game yang dibagikan bisa dibuka siswa dari HP masing-masing.
- Semua nilai tersimpan di lembar **Results** pada Google Sheets tersebut (inilah "database" aplikasi; jangan dihapus).
- Tombol **☁️ Simpan ke Google Drive** di Rekap Nilai membuat atau memperbarui file rekap berisi lembar Rekap Nilai,
  Distribusi (beserta diagram), Analisis Soal, dan Semua Percobaan. File disusun otomatis di
  `GameBelajar / Tahun ajaran / Mata pelajaran / Kelas`, atau di folder yang Anda pilih sendiri.
- **Simpan otomatis** (menu Pengaturan) memperbarui rekap setiap malam sekitar pukul 21.00 untuk game yang ada aktivitas baru.

## 🔐 Login Google untuk siswa (opsional)

1. Buka https://console.cloud.google.com/, buat project baru (mis. "GameBelajar").
2. Buka **Google Auth Platform** → **Get started**: isi nama aplikasi & email, pilih **External**. Lalu di **Audience** klik **Publish app**.
3. Buka **Clients** → **Create client** → **Web application**. Pada **Authorized JavaScript origins** isi alamat situs Anda,
   misalnya `https://agnesmuthia.github.io`. Klik **Create** dan salin **Client ID**.
4. Di aplikasi: **Guru → Pengaturan → Login Google untuk siswa**, tempel Client ID, lalu **Simpan**.
5. Di editor game, pada **Cara login siswa** pilih **Akun Google (Gmail)**. Opsional: batasi domain email.

Client ID bukan rahasia. Kata sandi guru (`TEACHER_KEY`) tetap hanya ada di Script Properties.

## ⬆️ Memperbarui aplikasi

- **Tampilan (GitHub Pages)** diperbarui otomatis 1–3 menit setelah perubahan di-push.
- **Backend (`Code.gs`)** harus disalin ulang ke Apps Script lalu **Terapkan → Kelola deployment → ✏️ → Versi baru → Terapkan**.
  Dasbor guru menampilkan peringatan jika versi `Code.gs` sudah tertinggal. Data nilai tidak berubah dan URL `/exec` tetap sama.

> Untuk memindahkan game dari Mode Lokal: buka **Aktivitas Saya → Ekspor semua**, hubungkan Google Sheets, lalu pilih **Impor**.

## 🗂️ Struktur

```
index.html              halaman utama (router berbasis hash)
assets/css/style.css    tampilan & 8 tema
assets/js/logic.js      penilaian, pengacakan, kebijakan nilai (dipakai browser & server)
assets/js/core.js       aturan server: akses, batas kesempatan, papan skor, rekap
assets/js/api.js        Mode Lokal (localStorage) atau Google Apps Script
assets/js/student.js    layar siswa: gabung, login, bermain, hasil, papan skor
assets/js/teacher.js    dasbor guru
assets/js/analytics.js  statistik, analisis butir soal, rekomendasi
assets/js/charts.js     diagram SVG
assets/js/templates.js  tema, jenis soal, template siap pakai
backend/server.gs       penyimpanan Google Sheets + ekspor Drive
backend/Code.gs         file siap tempel ke Apps Script (dibuat oleh tools/build-backend.sh)
```

Jika `logic.js`, `core.js`, atau `server.gs` diubah, jalankan `sh tools/build-backend.sh` untuk memperbarui `backend/Code.gs`.
