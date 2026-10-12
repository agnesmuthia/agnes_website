/*
 * logic.js — Logika penilaian bersama.
 * File ini dipakai di browser (Mode Lokal) DAN disalin otomatis ke backend/Code.gs
 * (lihat tools/build-backend.sh), sehingga cara menilai selalu sama persis.
 *
 * Jenis soal:
 *   mcq        : { q, options:[...], answer:<index benar> }
 *   tf         : { q, answer:true|false }
 *   short      : { q, answers:['jawaban', 'alternatif'] }
 *   match      : { q, pairs:[[kiri, kanan], ...] }
 *   order      : { q, items:[urutan benar...] }
 *   group      : { q, groups:[{ name, items:[...] }, ...] }        (2–4 kelompok)
 *   word       : { q:<petunjuk>, answer:'KATA' }                    (susun huruf / tebak kata)
 *   cloze      : { q, text:'Ibu kota RI adalah [Jakarta].', extra:['Bandung'] }
 *   multi      : { q, items:[[teks, benar?], ...] }                 (pilih semua yang benar / pukul tikus)
 *   wordsearch : { q, words:['ATMOSFER', ...] }                     (cari kata)
 *
 * Jenis permainan (game.mode) hanya mengubah tampilan, kecuali mode yang
 * memang membutuhkan kunci di perangkat siswa (lihat REVEAL).
 */
var Logic = (function () {
  var HANGMAN_LIVES = 6;
  var TIME_FACTOR = { mcq: 1, tf: 1, short: 1.2, match: 1.5, order: 1.5, group: 2, word: 1.5, cloze: 2, multi: 1.5, wordsearch: 4 };
  var MODE_FACTOR = { memory: { match: 2.5 }, hangman: { word: 2 }, whack: { multi: 1.3 } };
  // Mode yang tidak bisa dimainkan tanpa kunci jawaban di perangkat siswa (mode latihan).
  var REVEAL = { memory: ['match'], hangman: ['word'] };
  var MODES = ['classic', 'balloon', 'whack', 'memory', 'hangman', 'anagram', 'group', 'cloze', 'wordsearch', 'wheel', 'box'];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function range(n) {
    var r = [];
    for (var i = 0; i < n; i++) r.push(i);
    return r;
  }

  // Acak tapi pastikan tidak sama dengan urutan asli (untuk menjodohkan/mengurutkan).
  function derange(n) {
    if (n < 2) return range(n);
    var p, tries = 0;
    do { p = shuffle(range(n)); tries++; } while (p.every(function (v, i) { return v === i; }) && tries < 10);
    return p;
  }

  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:"']+$/g, '');
  }

  // Huruf & angka saja, huruf besar (untuk soal kata dan cari kata).
  function letters(s) {
    return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function studentKey(st) {
    return norm(st.cls) + '|' + norm(st.sid || st.name);
  }

  function mode(game) {
    return MODES.indexOf(game && game.mode) >= 0 ? game.mode : 'classic';
  }

  function reveals(m, type) { return (REVEAL[m] || []).indexOf(type) >= 0; }

  function timeFor(type, m, base) {
    base = Number(base) || 0;
    if (!base) return 0;
    var f = (MODE_FACTOR[m] && MODE_FACTOR[m][type]) || TIME_FACTOR[type] || 1;
    return Math.round(base * f);
  }

  function clozeParts(text) {
    var parts = [], blanks = [], re = /\[([^\]]+)\]/g, last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      parts.push(text.slice(last, m.index));
      blanks.push(m[1].trim());
      last = re.lastIndex;
    }
    parts.push(text.slice(last));
    return { parts: parts, blanks: blanks };
  }

  function flatGroups(q) {
    var flat = [];
    (q.groups || []).forEach(function (g, gi) { (g.items || []).forEach(function (t) { flat.push({ t: t, g: gi }); }); });
    return flat;
  }

  // Teka-teki cari kata: arah → ↓ ↘ ↗ (tidak terbalik, agar ramah siswa).
  function makeWordsearch(words) {
    words = words.map(letters).filter(Boolean);
    var longest = Math.max.apply(null, words.map(function (w) { return w.length; }));
    var total = words.reduce(function (s, w) { return s + w.length; }, 0);
    var size = Math.min(15, Math.max(8, longest, Math.ceil(Math.sqrt(total * 2.2))));
    var DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1]];
    var ABC = 'ABCDEFGHIJKLMNOPRSTUWY';
    var order = range(words.length).sort(function (a, b) { return words[b].length - words[a].length; });
    for (var attempt = 0; attempt < 60; attempt++) {
      if (attempt && attempt % 15 === 0 && size < 16) size++;
      var grid = [];
      for (var r = 0; r < size; r++) { grid.push([]); for (var c = 0; c < size; c++) grid[r].push(''); }
      var ok = order.every(function (wi) {
        var w = words[wi];
        for (var t = 0; t < 250; t++) {
          var d = DIRS[Math.floor(Math.random() * DIRS.length)];
          var r0 = Math.floor(Math.random() * size), c0 = Math.floor(Math.random() * size);
          var r1 = r0 + d[0] * (w.length - 1), c1 = c0 + d[1] * (w.length - 1);
          if (r1 < 0 || r1 >= size || c1 >= size) continue;
          var fits = true;
          for (var i = 0; i < w.length && fits; i++) {
            var ch = grid[r0 + d[0] * i][c0 + d[1] * i];
            if (ch && ch !== w[i]) fits = false;
          }
          if (!fits) continue;
          for (var j = 0; j < w.length; j++) grid[r0 + d[0] * j][c0 + d[1] * j] = w[j];
          return true;
        }
        return false;
      });
      if (!ok) continue;
      return {
        words: words,
        grid: grid.map(function (row) {
          return row.map(function (ch) { return ch || ABC.charAt(Math.floor(Math.random() * ABC.length)); }).join('');
        })
      };
    }
    throw new Error('Gagal menyusun teka-teki cari kata. Kurangi jumlah atau panjang kata.');
  }

  // Huruf di sepanjang garis lurus (mendatar, menurun, diagonal) pada kotak huruf.
  function lineText(grid, r1, c1, r2, c2) {
    r1 = Number(r1); c1 = Number(c1); r2 = Number(r2); c2 = Number(c2);
    var dr = r2 - r1, dc = c2 - c1;
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return '';
    var n = Math.max(Math.abs(dr), Math.abs(dc)) + 1, sr = dr ? dr / Math.abs(dr) : 0, sc = dc ? dc / Math.abs(dc) : 0, out = '';
    for (var i = 0; i < n; i++) {
      var row = grid[r1 + sr * i];
      if (row === undefined || c1 + sc * i < 0 || c1 + sc * i >= row.length) return '';
      out += row.charAt(c1 + sc * i);
    }
    return out;
  }

  function hangmanScore(word, guesses) {
    var target = letters(word).split('');
    var uniq = target.filter(function (ch, i) { return target.indexOf(ch) === i; });
    var revealed = {}, seen = {}, lives = HANGMAN_LIVES, found = 0;
    for (var i = 0; i < guesses.length && lives > 0 && found < uniq.length; i++) {
      var g = letters(guesses[i]).charAt(0);
      if (!g || seen[g]) continue;
      seen[g] = 1;
      if (uniq.indexOf(g) >= 0) { revealed[g] = 1; found++; } else lives--;
    }
    if (!uniq.length) return 0;
    return found === uniq.length ? 1 : Math.round(found / uniq.length * 50) / 100;
  }

  // Kunci jawaban dalam "urutan tampilan" (setelah opsi diacak). k = { perm, grid } dari kunci server.
  function answerKey(q, k) {
    var perm = k && k.perm;
    switch (q.type) {
      case 'mcq': return perm.indexOf(Number(q.answer));
      case 'tf': return q.answer === true || q.answer === 'true';
      case 'short': return (q.answers || []).slice();
      case 'match': return q.pairs.map(function (_, i) { return perm.indexOf(i); });
      case 'order': return q.items.map(function (_, i) { return perm.indexOf(i); });
      case 'group':
        var flat = flatGroups(q);
        return perm.map(function (i) { return flat[i].g; });
      case 'word': return String(q.answer || '').toUpperCase().trim();
      case 'cloze':
        var cz = clozeParts(q.text), bank = cz.blanks.concat(q.extra || []);
        return { blanks: cz.blanks, bank: perm.map(function (i) { return bank[i]; }) };
      case 'multi': return perm.map(function (i) { return !!q.items[i][1]; });
      case 'wordsearch': return { grid: k.grid, words: (q.words || []).map(letters).filter(Boolean) };
    }
    return null;
  }

  // Nilai satu soal: 0..1 (banyak jenis soal bisa bernilai sebagian).
  function gradeDisplay(type, ans, a) {
    if (a === null || a === undefined || a === '') return 0;
    var i, c;
    switch (type) {
      case 'mcq': return Number(a) === Number(ans) ? 1 : 0;
      case 'tf': return (a === true || a === 'true') === (ans === true) ? 1 : 0;
      case 'short':
        var v = norm(a);
        return ans.some(function (x) { return norm(x) === v; }) ? 1 : 0;
      case 'match':
      case 'order':
      case 'group':
        if (!Array.isArray(a) || !ans.length) return 0;
        c = 0;
        for (i = 0; i < ans.length; i++) if (a[i] !== null && a[i] !== undefined && Number(a[i]) === ans[i]) c++;
        return c / ans.length;
      case 'word':
        if (Array.isArray(a)) return hangmanScore(ans, a); // tebak kata: daftar huruf yang ditebak
        return letters(a) === letters(ans) ? 1 : 0;      // susun huruf: kata akhir
      case 'cloze':
        if (!Array.isArray(a) || !ans.blanks.length) return 0;
        c = 0;
        ans.blanks.forEach(function (w, b) {
          var pick = a[b] === null || a[b] === undefined ? undefined : ans.bank[Number(a[b])];
          if (pick !== undefined && norm(pick) === norm(w)) c++;
        });
        return c / ans.blanks.length;
      case 'multi':
        if (!Array.isArray(a)) return 0;
        var pos = ans.filter(Boolean).length, tp = 0, fp = 0, seen = {};
        if (!pos) return 0;
        a.forEach(function (x) {
          x = Number(x);
          if (seen[x] || !(x >= 0 && x < ans.length)) return;
          seen[x] = 1;
          if (ans[x]) tp++; else fp++;
        });
        return Math.max(0, tp - fp) / pos;
      case 'wordsearch':
        if (!Array.isArray(a) || !ans.words.length) return 0;
        var found = {};
        a.forEach(function (sel) {
          if (!Array.isArray(sel) || sel.length !== 4) return;
          var t = lineText(ans.grid, sel[0], sel[1], sel[2], sel[3]);
          var rev = t.split('').reverse().join('');
          ans.words.forEach(function (w, wi) { if (t && (t === w || rev === w)) found[wi] = 1; });
        });
        return Object.keys(found).length / ans.words.length;
    }
    return 0;
  }

  // Menyiapkan soal untuk satu percobaan siswa.
  // served = yang dikirim ke siswa, key = rahasia yang disimpan di server.
  function buildAttempt(game) {
    var s = game.settings || {};
    var m = mode(game);
    var qs = (game.questions || []).slice();
    if (s.shuffleQuestions) qs = shuffle(qs);
    var n = Number(s.questionCount) || 0;
    if (n > 0 && n < qs.length) qs = qs.slice(0, n);

    var key = [], served = [];
    qs.forEach(function (q) {
      var k = { id: q.id, perm: null };
      var item = { id: q.id, type: q.type, q: q.q, img: q.img || '', time: timeFor(q.type, m, s.timePerQuestion) };
      if (q.type === 'mcq') {
        k.perm = s.shuffleOptions ? shuffle(range(q.options.length)) : range(q.options.length);
        item.options = k.perm.map(function (i) { return q.options[i]; });
      } else if (q.type === 'match') {
        k.perm = derange(q.pairs.length);
        item.left = q.pairs.map(function (p) { return p[0]; });
        item.right = k.perm.map(function (i) { return q.pairs[i][1]; });
      } else if (q.type === 'order') {
        k.perm = derange(q.items.length);
        item.items = k.perm.map(function (i) { return q.items[i]; });
      } else if (q.type === 'group') {
        var flat = flatGroups(q);
        k.perm = shuffle(range(flat.length));
        item.groups = q.groups.map(function (g) { return g.name; });
        item.items = k.perm.map(function (i) { return flat[i].t; });
      } else if (q.type === 'word') {
        var w = String(q.answer || '').toUpperCase().trim();
        var tiles = letters(w).split(''), mixed = tiles;
        for (var t = 0; t < 8 && mixed.join('') === tiles.join('') && tiles.length > 1; t++) mixed = shuffle(tiles);
        item.tiles = mixed;
        item.pattern = w.split(/\s+/).map(function (x) { return letters(x).length; }).filter(Boolean);
      } else if (q.type === 'cloze') {
        var cz = clozeParts(q.text), bank = cz.blanks.concat(q.extra || []);
        k.perm = shuffle(range(bank.length));
        item.parts = cz.parts;
        item.bank = k.perm.map(function (i) { return bank[i]; });
      } else if (q.type === 'multi') {
        k.perm = shuffle(range(q.items.length));
        item.items = k.perm.map(function (i) { return q.items[i][0]; });
      } else if (q.type === 'wordsearch') {
        var ws = makeWordsearch(q.words || []);
        k.grid = ws.grid;
        item.grid = ws.grid;
        item.words = ws.words;
      }
      key.push(k);
      // Kunci jawaban dikirim hanya bila umpan balik aktif, atau mode latihan yang membutuhkannya.
      if (s.showFeedback || reveals(m, q.type)) item.ans = answerKey(q, k);
      served.push(item);
    });
    return { served: served, key: key };
  }

  // Penilaian resmi (dilakukan di server, bukan percaya pada skor dari browser).
  function grade(game, key, answers) {
    var byId = {};
    (game.questions || []).forEach(function (q) { byId[q.id] = q; });
    var detail = {}, sum = 0, correct = 0;
    key.forEach(function (k, i) {
      var q = byId[k.id];
      if (!q) return;
      var f = gradeDisplay(q.type, answerKey(q, k), answers ? answers[i] : null);
      detail[k.id] = Math.round(f * 100) / 100;
      sum += f;
      if (f >= 0.999) correct++;
    });
    var total = key.length;
    return { score: total ? Math.round(sum / total * 100) : 0, correct: correct, total: total, detail: detail };
  }

  // Satu nilai per siswa sesuai kebijakan: best (tertinggi) | last (terakhir) | first (pertama).
  function counted(rows, policy) {
    var groups = {};
    rows.forEach(function (r) { (groups[r.key] = groups[r.key] || []).push(r); });
    return Object.keys(groups).map(function (k) {
      var list = groups[k].slice().sort(function (a, b) { return String(a.startedAt).localeCompare(String(b.startedAt)); });
      var done = list.filter(function (r) { return r.status === 'done'; });
      var latest = list[list.length - 1];
      var pick;
      if (!done.length) {
        pick = latest;
      } else if (policy === 'last') {
        pick = done[done.length - 1];
      } else if (policy === 'first') {
        pick = done[0];
      } else {
        pick = done.slice().sort(function (a, b) {
          return (Number(b.score) - Number(a.score)) || (Number(a.durationSec) - Number(b.durationSec));
        })[0];
      }
      var violations = list.reduce(function (s, r) { return s + (Number(r.violations) || 0); }, 0);
      var flags = [];
      list.forEach(function (r) {
        String(r.flags || '').split('; ').forEach(function (f) { if (f && flags.indexOf(f) < 0) flags.push(f); });
      });
      return {
        key: k, name: latest.name, cls: latest.cls, sid: latest.sid, email: latest.email || '', flags: flags.join('; '),
        score: done.length ? Number(pick.score) : 0,
        correct: Number(pick.correct) || 0, total: Number(pick.total) || 0,
        durationSec: Number(pick.durationSec) || 0, xp: Number(pick.xp) || 0,
        attempts: list.length, finished: done.length > 0,
        violations: violations, detail: pick.detail || {}, finishedAt: pick.finishedAt || pick.startedAt
      };
    });
  }

  function rank(list) {
    return list.slice().sort(function (a, b) {
      return (b.score - a.score) || (a.durationSec - b.durationSec) || String(a.name).localeCompare(String(b.name));
    });
  }

  return {
    shuffle: shuffle, norm: norm, letters: letters, studentKey: studentKey, answerKey: answerKey,
    gradeDisplay: gradeDisplay, buildAttempt: buildAttempt, grade: grade, counted: counted, rank: rank,
    mode: mode, reveals: reveals, timeFor: timeFor, clozeParts: clozeParts, makeWordsearch: makeWordsearch,
    lineText: lineText, hangmanScore: hangmanScore, HANGMAN_LIVES: HANGMAN_LIVES, MODES: MODES
  };
})();
