/*
 * logic.js — Logika penilaian bersama.
 * File ini dipakai di browser (Mode Lokal) DAN disalin otomatis ke backend/Code.gs
 * (lihat tools/build-backend.sh), sehingga cara menilai selalu sama persis.
 *
 * Jenis soal:
 *   mcq   : { q, options:[...], answer:<index benar> }
 *   tf    : { q, answer:true|false }
 *   short : { q, answers:['jawaban', 'alternatif'] }
 *   match : { q, pairs:[[kiri, kanan], ...] }
 *   order : { q, items:[urutan benar...] }
 */
var Logic = (function () {
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

  function studentKey(st) {
    return norm(st.cls) + '|' + norm(st.sid || st.name);
  }

  // Kunci jawaban dalam "urutan tampilan" (setelah opsi diacak).
  function answerKey(q, perm) {
    switch (q.type) {
      case 'mcq': return perm.indexOf(Number(q.answer));
      case 'tf': return q.answer === true || q.answer === 'true';
      case 'short': return (q.answers || []).slice();
      case 'match': return q.pairs.map(function (_, i) { return perm.indexOf(i); });
      case 'order': return q.items.map(function (_, i) { return perm.indexOf(i); });
    }
    return null;
  }

  // Nilai satu soal: 0..1 (menjodohkan & mengurutkan bisa bernilai sebagian).
  function gradeDisplay(type, ans, a) {
    if (a === null || a === undefined || a === '') return 0;
    switch (type) {
      case 'mcq': return Number(a) === Number(ans) ? 1 : 0;
      case 'tf': return (a === true || a === 'true') === (ans === true) ? 1 : 0;
      case 'short':
        var v = norm(a);
        return ans.some(function (x) { return norm(x) === v; }) ? 1 : 0;
      case 'match':
      case 'order':
        if (!Array.isArray(a) || !ans.length) return 0;
        var c = 0;
        for (var i = 0; i < ans.length; i++) if (Number(a[i]) === ans[i]) c++;
        return c / ans.length;
    }
    return 0;
  }

  // Menyiapkan soal untuk satu percobaan siswa.
  // served = yang dikirim ke siswa, key = rahasia yang disimpan di server.
  function buildAttempt(game) {
    var s = game.settings || {};
    var qs = (game.questions || []).slice();
    if (s.shuffleQuestions) qs = shuffle(qs);
    var n = Number(s.questionCount) || 0;
    if (n > 0 && n < qs.length) qs = qs.slice(0, n);

    var key = [], served = [];
    qs.forEach(function (q) {
      var perm = null;
      var item = { id: q.id, type: q.type, q: q.q, img: q.img || '' };
      if (q.type === 'mcq') {
        perm = s.shuffleOptions ? shuffle(range(q.options.length)) : range(q.options.length);
        item.options = perm.map(function (i) { return q.options[i]; });
      } else if (q.type === 'match') {
        perm = derange(q.pairs.length);
        item.left = q.pairs.map(function (p) { return p[0]; });
        item.right = perm.map(function (i) { return q.pairs[i][1]; });
      } else if (q.type === 'order') {
        perm = derange(q.items.length);
        item.items = perm.map(function (i) { return q.items[i]; });
      }
      key.push({ id: q.id, perm: perm });
      // Kunci jawaban hanya dikirim bila guru mengaktifkan umpan balik langsung.
      if (s.showFeedback) item.ans = answerKey(q, perm);
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
      var f = gradeDisplay(q.type, answerKey(q, k.perm), answers ? answers[i] : null);
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
      return {
        key: k, name: latest.name, cls: latest.cls, sid: latest.sid,
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
    shuffle: shuffle, norm: norm, studentKey: studentKey, answerKey: answerKey,
    gradeDisplay: gradeDisplay, buildAttempt: buildAttempt, grade: grade, counted: counted, rank: rank
  };
})();
