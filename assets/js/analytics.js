/* analytics.js — Statistik, analisis butir soal, kemajuan siswa, dan rekomendasi untuk guru. */
var Analytics = (function () {
  function mean(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
  function median(a) {
    if (!a.length) return 0;
    var b = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
  function std(a) {
    if (a.length < 2) return 0;
    var m = mean(a);
    return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (a.length - 1));
  }
  function r1(v) { return Math.round(v * 10) / 10; }

  // Analisis satu game.
  function game(g, rows, clsFilter) {
    var s = g.settings || {};
    var kkm = Number(s.kkm) || 75;
    var filtered = rows.filter(function (r) { return !clsFilter || r.cls === clsFilter; });
    var people = Logic.counted(filtered, s.scorePolicy);
    var done = people.filter(function (p) { return p.finished; });
    var scores = done.map(function (p) { return p.score; });
    var pass = done.filter(function (p) { return p.score >= kkm; });

    var bins = [];
    for (var b = 0; b < 10; b++) {
      var lo = b * 10, hi = b === 9 ? 100 : lo + 9;
      bins.push({ label: lo + '–' + hi, lo: lo, count: scores.filter(function (v) { return v >= lo && v <= hi; }).length });
    }

    var byClass = {};
    done.forEach(function (p) { (byClass[p.cls] = byClass[p.cls] || []).push(p.score); });
    var classes = Object.keys(byClass).sort().map(function (c) {
      return { cls: c, n: byClass[c].length, avg: r1(mean(byClass[c])), pass: byClass[c].filter(function (v) { return v >= kkm; }).length };
    });

    // Analisis butir soal: tingkat kesukaran (p) & daya pembeda (D) kelompok atas-bawah 27%.
    var ranked = done.slice().sort(function (a, b2) { return b2.score - a.score; });
    var k = Math.max(1, Math.round(ranked.length * 0.27));
    var upper = ranked.slice(0, k), lower = ranked.slice(-k);
    var items = (g.questions || []).map(function (q, i) {
      var vals = done.map(function (p) { return p.detail[q.id]; }).filter(function (v) { return v !== undefined; });
      var p = vals.length ? mean(vals.map(Number)) : null;
      var pu = mean(upper.map(function (x) { return x.detail[q.id]; }).filter(function (v) { return v !== undefined; }).map(Number));
      var pl = mean(lower.map(function (x) { return x.detail[q.id]; }).filter(function (v) { return v !== undefined; }).map(Number));
      var D = ranked.length >= 6 && p !== null ? r1(pu - pl) : null;
      return {
        no: i + 1, q: q, n: vals.length, p: p, pct: p === null ? null : Math.round(p * 100),
        level: p === null ? '-' : p < 0.3 ? 'Sukar' : p <= 0.7 ? 'Sedang' : 'Mudah',
        D: D, dLabel: D === null ? '-' : D >= 0.4 ? 'Sangat baik' : D >= 0.3 ? 'Baik' : D >= 0.2 ? 'Cukup' : 'Perlu revisi'
      };
    });

    var avgTime = mean(done.map(function (p) { return p.durationSec; }));
    var suspicious = done.filter(function (p) {
      return p.flags || p.violations >= Math.max(1, Number(s.antiCheat) || 2) || (p.total && p.durationSec / p.total < 3 && p.score >= 80);
    });

    return {
      kkm: kkm, people: people, done: done, n: done.length, unfinished: people.length - done.length,
      avg: r1(mean(scores)), median: r1(median(scores)), sd: r1(std(scores)),
      max: scores.length ? Math.max.apply(null, scores) : 0, min: scores.length ? Math.min.apply(null, scores) : 0,
      passN: pass.length, passRate: done.length ? Math.round(pass.length / done.length * 100) : 0,
      bins: bins, classes: classes, items: items, avgTime: avgTime,
      remedial: done.filter(function (p) { return p.score < kkm; }).sort(function (a, b2) { return a.score - b2.score; }),
      enrich: done.filter(function (p) { return p.score >= 90; }).sort(function (a, b2) { return b2.score - a.score; }),
      suspicious: suspicious
    };
  }

  function gameAdvice(A, g) {
    var out = [];
    if (!A.n) return [{ t: 'info', h: 'Belum ada data', p: 'Bagikan kode game ke siswa. Analisis akan muncul setelah ada siswa yang menyelesaikan game.' }];

    if (A.passRate < 50) {
      out.push({ t: 'bad', h: 'Ketuntasan klasikal rendah (' + A.passRate + '%)',
        p: 'Sebagian besar siswa belum mencapai KKM ' + A.kkm + '. Lakukan pembelajaran ulang (reteaching) secara klasikal dengan pendekatan berbeda — misalnya contoh konkret, visual, atau diskusi kelompok — sebelum melanjutkan ke materi berikutnya.' });
    } else if (A.passRate < 85) {
      out.push({ t: 'warn', h: 'Ketuntasan klasikal ' + A.passRate + '% (belum ideal ≥ 85%)',
        p: 'Lanjutkan materi sambil memberi remedial terarah kepada ' + A.remedial.length + ' siswa. Gunakan tutor sebaya: pasangkan siswa tuntas dengan siswa yang belum tuntas.' });
    } else {
      out.push({ t: 'good', h: 'Ketuntasan klasikal tercapai (' + A.passRate + '%)',
        p: 'Kelas siap melanjutkan ke materi berikutnya. Berikan remedial individual untuk siswa yang belum tuntas dan tantangan lebih tinggi bagi yang sudah mahir.' });
    }

    var hard = A.items.filter(function (it) { return it.p !== null && it.p < 0.4; });
    if (hard.length) {
      out.push({ t: 'warn', h: hard.length + ' soal dijawab benar oleh kurang dari 40% siswa',
        p: 'Konsep pada soal nomor ' + hard.map(function (i) { return i.no; }).join(', ') + ' perlu dibahas ulang di kelas. Cek juga apakah kalimat soal atau kunci jawabannya sudah jelas.' });
    }
    var easy = A.items.filter(function (it) { return it.p !== null && it.p > 0.9; });
    if (easy.length && easy.length >= A.items.length / 2) {
      out.push({ t: 'info', h: 'Banyak soal terlalu mudah',
        p: easy.length + ' soal dijawab benar oleh >90% siswa. Pertimbangkan menambah soal HOTS (analisis, evaluasi, mencipta) agar tes lebih menantang dan membedakan kemampuan siswa.' });
    }
    var weak = A.items.filter(function (it) { return it.D !== null && it.D < 0.2; });
    if (weak.length) {
      out.push({ t: 'info', h: 'Daya pembeda rendah pada soal ' + weak.map(function (i) { return i.no; }).join(', '),
        p: 'Soal-soal ini tidak membedakan siswa yang menguasai dan yang belum. Revisi pengecoh (pilihan salah) atau redaksi soalnya.' });
    }
    if (A.sd >= 20) {
      out.push({ t: 'warn', h: 'Kemampuan siswa sangat beragam (simpangan baku ' + A.sd + ')',
        p: 'Terapkan pembelajaran berdiferensiasi: kelompokkan siswa berdasarkan kesiapan belajar dan beri tugas bertingkat.' });
    }
    if (A.remedial.length) {
      out.push({ t: 'warn', h: A.remedial.length + ' siswa perlu remedial',
        p: 'Prioritaskan: ' + A.remedial.slice(0, 5).map(function (p) { return p.name + ' (' + p.score + ')'; }).join(', ') + (A.remedial.length > 5 ? ', dan lainnya' : '') + '. Lihat daftar lengkap di bawah.' });
    }
    if (A.enrich.length) {
      out.push({ t: 'good', h: A.enrich.length + ' siswa siap pengayaan',
        p: 'Siswa dengan nilai ≥ 90 bisa diberi proyek pengayaan atau dilibatkan sebagai tutor sebaya.' });
    }
    if (A.suspicious.length) {
      out.push({ t: 'bad', h: A.suspicious.length + ' hasil perlu diverifikasi',
        p: 'Terdeteksi sering keluar dari halaman game, menjawab sangat cepat dengan nilai tinggi, atau mengirim jawaban terlambat. Konfirmasi langsung kepada siswa sebelum nilai digunakan.' });
    }
    if (A.unfinished) {
      out.push({ t: 'info', h: A.unfinished + ' siswa belum menyelesaikan game',
        p: 'Mereka sudah memulai tetapi tidak mengirim jawaban. Anda dapat mereset kesempatan mereka di menu Rekap Nilai.' });
    }
    return out;
  }

  // Kemajuan lintas game (berdasarkan urutan tanggal dibuat).
  function progress(games, rows, clsFilter) {
    games = games.slice().sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); });
    var perGame = [], students = {};
    games.forEach(function (g) {
      var s = g.settings || {};
      var kkm = Number(s.kkm) || 75;
      var mine = rows.filter(function (r) { return r.code === g.code && (!clsFilter || r.cls === clsFilter); });
      var done = Logic.counted(mine, s.scorePolicy).filter(function (p) { return p.finished; });
      if (!done.length) return;
      perGame.push({
        game: g, n: done.length, avg: r1(mean(done.map(function (p) { return p.score; }))),
        passRate: Math.round(done.filter(function (p) { return p.score >= kkm; }).length / done.length * 100), kkm: kkm
      });
      done.forEach(function (p) {
        var st = students[p.key] = students[p.key] || { key: p.key, name: p.name, cls: p.cls, scores: [], kkm: kkm };
        st.scores.push({ code: g.code, title: g.title, score: p.score, kkm: kkm });
      });
    });
    var list = Object.keys(students).map(function (k) {
      var st = students[k];
      var sc = st.scores.map(function (x) { return x.score; });
      st.first = sc[0];
      st.last = sc[sc.length - 1];
      st.avg = r1(mean(sc));
      st.delta = sc.length > 1 ? st.last - st.first : 0;
      st.below = st.scores.filter(function (x) { return x.score < x.kkm; }).length;
      st.trend = sc.length < 2 ? 'Baru 1 game' : st.delta >= 5 ? 'Meningkat' : st.delta <= -5 ? 'Menurun' : 'Stabil';
      return st;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { perGame: perGame, students: list };
  }

  function progressAdvice(P) {
    var out = [];
    if (!P.perGame.length) return [{ t: 'info', h: 'Belum ada data', p: 'Data kemajuan muncul setelah siswa menyelesaikan minimal satu game pada filter ini.' }];
    if (P.perGame.length >= 2) {
      var a = P.perGame[P.perGame.length - 2], b = P.perGame[P.perGame.length - 1];
      var d = r1(b.avg - a.avg);
      if (d >= 5) out.push({ t: 'good', h: 'Rata-rata kelas naik ' + d + ' poin', p: 'Dari "' + a.game.title + '" (' + a.avg + ') ke "' + b.game.title + '" (' + b.avg + '). Strategi pembelajaran terakhir efektif — pertahankan dan apresiasi siswa.' });
      else if (d <= -5) out.push({ t: 'bad', h: 'Rata-rata kelas turun ' + Math.abs(d) + ' poin', p: 'Dari "' + a.game.title + '" (' + a.avg + ') ke "' + b.game.title + '" (' + b.avg + '). Evaluasi tingkat kesulitan materi terbaru dan cek apakah prasyarat materi sudah dikuasai.' });
      else out.push({ t: 'info', h: 'Rata-rata kelas relatif stabil', p: 'Perubahan rata-rata ' + d + ' poin antara dua game terakhir.' });
    }
    var down = P.students.filter(function (s) { return s.trend === 'Menurun'; });
    if (down.length) out.push({ t: 'warn', h: down.length + ' siswa mengalami penurunan', p: 'Perlu perhatian: ' + down.slice(0, 6).map(function (s) { return s.name; }).join(', ') + (down.length > 6 ? ', dan lainnya' : '') + '. Lakukan pendekatan personal/konseling belajar.' });
    var stuck = P.students.filter(function (s) { return s.scores.length >= 2 && s.below === s.scores.length; });
    if (stuck.length) out.push({ t: 'bad', h: stuck.length + ' siswa selalu di bawah KKM', p: 'Butuh bimbingan khusus dan koordinasi dengan wali kelas/BK/orang tua: ' + stuck.slice(0, 6).map(function (s) { return s.name; }).join(', ') + (stuck.length > 6 ? ', dan lainnya' : '') + '.' });
    var up = P.students.filter(function (s) { return s.trend === 'Meningkat'; });
    if (up.length) out.push({ t: 'good', h: up.length + ' siswa menunjukkan peningkatan', p: 'Berikan apresiasi agar motivasi terjaga: ' + up.slice(0, 6).map(function (s) { return s.name; }).join(', ') + (up.length > 6 ? ', dan lainnya' : '') + '.' });
    return out;
  }

  return { game: game, gameAdvice: gameAdvice, progress: progress, progressAdvice: progressAdvice, mean: mean };
})();
