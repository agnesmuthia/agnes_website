# 🎮 Game Belajar

Aplikasi web untuk membuat **game pembelajaran interaktif** bagi siswa SMA. Aplikasi ini dilengkapi rekap nilai 0–100,
papan skor ratusan siswa, analisis data dengan diagram, dan penyimpanan rekap ke **Google Drive**.

## ✨ Fitur

| Untuk siswa | Untuk guru |
|---|---|
| Masuk dengan **kode game** atau link/QR | **Perpustakaan aktivitas** untuk semua mata pelajaran (cari, filter mapel, duplikat) |
| Login: nama, kelas, NIS/absen | **Editor game** dengan 5 jenis soal: pilihan ganda, benar/salah, isian, menjodohkan, mengurutkan |
| 8 tema visual (Galaksi, Neon, Rimba, Samudra, Gunung Api, Pastel, Retro 8-Bit, Stadion) | **11 template siap pakai** (Matematika, Fisika, Biologi, Kimia, Sejarah, B. Inggris, B. Indonesia, Ekonomi, Geografi, Informatika, Mode Ujian) |
| Timer, XP, combo 🔥, power-up 50:50 & +15 detik, efek suara, konfeti | **Ekspor/impor template** (.json) dan **impor soal cepat** dari teks |
| Hasil berupa nilai 0–100 dengan animasi | **Atur akses**: jumlah soal, waktu, maks. kesempatan, jadwal buka/tutup, KKM, nilai tertinggi/terakhir/pertama |
| **Papan skor** dengan podium, pencarian, filter kelas, halaman per 50 siswa, layar penuh, refresh otomatis | **Rekap nilai**: ekspor CSV/Excel, cetak, reset kesempatan, **simpan ke Google Drive** (lengkap dengan diagram) |
| Melanjutkan pengerjaan setelah halaman tidak sengaja dimuat ulang | **Analisis**: rata-rata, median, ketuntasan, sebaran nilai, per kelas, analisis butir soal (kesukaran & daya pembeda), **kemajuan lintas game**, dan **rekomendasi tindakan guru** |

### 🛡️ Menjaga kejujuran nilai
- Kesempatan **dihitung saat siswa menekan "Mulai"**, jadi memuat ulang halaman tidak menghasilkan kesempatan baru.
- Nilai **dihitung di server** dari jawaban siswa, bukan dari skor yang dikirim browser.
- Soal & pilihan **diacak per siswa**. Bila "jumlah soal" lebih kecil dari bank soal, tiap siswa mendapat paket soal berbeda.
- **Deteksi keluar halaman**: setiap pindah tab/aplikasi dicatat. Setelah batas tercapai, jawaban dikumpulkan otomatis.
- Mode **ulangan resmi** (matikan "Tampilkan benar/salah langsung"): kunci jawaban tidak dikirim ke perangkat siswa sama sekali.
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
- Semua nilai tersimpan di lembar **Results** pada Google Sheets tersebut.
- Tombol **☁️ Simpan ke Google Drive** di Rekap Nilai membuat file rekap baru di folder **"Rekap Game Belajar"**.
  File ini berisi lembar Rekap Nilai, Distribusi (beserta diagram), Analisis Soal, dan Semua Percobaan.

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
