/*
 * core.js — "Server" aplikasi. Semua aturan (akses, batas percobaan, penilaian,
 * papan skor) ada di sini. Dipakai oleh Mode Lokal di browser dan disalin ke
 * backend/Code.gs untuk Google Sheets, dengan objek `db` yang berbeda.
 */
var Core = (function () {
  var TEACHER_ACTIONS = ['listGames', 'saveGame', 'deleteGame', 'results', 'resetAttempts', 'exportDrive'];
  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function nowIso() { return new Date().toISOString(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }

  function newCode(db) {
    for (var t = 0; t < 50; t++) {
      var c = '';
      for (var i = 0; i < 6; i++) c += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
      if (!db.getGame(c)) return c;
    }
    throw new Error('Gagal membuat kode game, coba lagi.');
  }

  function fail(msg) { throw new Error(msg); }

  function needGame(db, code) {
    var g = db.getGame(String(code || '').trim().toUpperCase());
    if (!g) fail('Kode game tidak ditemukan. Periksa kembali kodenya.');
    return g;
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function accessError(g) {
    var s = g.settings || {};
    var t = Date.now();
    if (s.active === false) return 'Game sedang ditutup oleh guru.';
    if (s.openAt && t < Date.parse(s.openAt)) return 'Game belum dibuka. Dibuka pada ' + fmtDate(s.openAt) + '.';
    if (s.closeAt && t > Date.parse(s.closeAt)) return 'Waktu pengerjaan sudah berakhir (' + fmtDate(s.closeAt) + ').';
    return null;
  }

  function questionTotal(g) {
    var s = g.settings || {};
    var n = Number(s.questionCount) || 0;
    var all = (g.questions || []).length;
    return n > 0 && n < all ? n : all;
  }

  function publicGame(g) {
    var s = g.settings || {};
    return {
      code: g.code, title: g.title, subject: g.subject, cls: g.cls || '', description: g.description || '',
      theme: g.theme || 'galaxy', questionCount: questionTotal(g),
      settings: {
        timePerQuestion: Number(s.timePerQuestion) || 0, maxAttempts: Number(s.maxAttempts) || 0,
        showFeedback: !!s.showFeedback, showLeaderboard: !!s.showLeaderboard, powerUps: !!s.powerUps,
        antiCheat: Number(s.antiCheat) || 0, kkm: Number(s.kkm) || 75, scorePolicy: s.scorePolicy || 'best',
        openAt: s.openAt || '', closeAt: s.closeAt || '', active: s.active !== false
      }
    };
  }

  function cleanStudent(st) {
    st = st || {};
    var out = {
      name: String(st.name || '').trim().slice(0, 80),
      cls: String(st.cls || '').trim().toUpperCase().slice(0, 30),
      sid: String(st.sid || '').trim().slice(0, 30)
    };
    if (out.name.length < 3) fail('Tuliskan nama lengkapmu.');
    if (!out.cls) fail('Tuliskan kelasmu.');
    if (!out.sid) fail('Tuliskan NIS atau nomor absen.');
    return out;
  }

  function validateGame(g) {
    if (!g || !String(g.title || '').trim()) fail('Judul game wajib diisi.');
    if (!g.questions || !g.questions.length) fail('Tambahkan minimal 1 soal.');
    g.questions.forEach(function (q, i) {
      var n = 'Soal ' + (i + 1) + ': ';
      if (!q.id) q.id = uid();
      if (!String(q.q || '').trim()) fail(n + 'pertanyaan masih kosong.');
      if (q.type === 'mcq') {
        q.options = (q.options || []).map(String).filter(function (o) { return o.trim(); });
        if (q.options.length < 2) fail(n + 'minimal 2 pilihan jawaban.');
        if (!(Number(q.answer) >= 0 && Number(q.answer) < q.options.length)) fail(n + 'pilih jawaban yang benar.');
        q.answer = Number(q.answer);
      } else if (q.type === 'tf') {
        q.answer = q.answer === true || q.answer === 'true';
      } else if (q.type === 'short') {
        q.answers = (q.answers || []).map(String).filter(function (o) { return o.trim(); });
        if (!q.answers.length) fail(n + 'isi minimal 1 kunci jawaban.');
      } else if (q.type === 'match') {
        q.pairs = (q.pairs || []).filter(function (p) { return String(p[0]).trim() && String(p[1]).trim(); });
        if (q.pairs.length < 2) fail(n + 'minimal 2 pasangan.');
      } else if (q.type === 'order') {
        q.items = (q.items || []).map(String).filter(function (o) { return o.trim(); });
        if (q.items.length < 2) fail(n + 'minimal 2 item untuk diurutkan.');
      } else {
        fail(n + 'jenis soal tidak dikenal.');
      }
    });
    return g;
  }

  function stripRow(r) {
    return {
      id: r.id, code: r.code, key: r.key, name: r.name, cls: r.cls, sid: r.sid, attempt: Number(r.attempt) || 1,
      status: r.status, score: r.status === 'done' ? Number(r.score) : null, correct: Number(r.correct) || 0,
      total: Number(r.total) || 0, durationSec: Number(r.durationSec) || 0, violations: Number(r.violations) || 0,
      xp: Number(r.xp) || 0, startedAt: r.startedAt, finishedAt: r.finishedAt || '', detail: r.detail || {}
    };
  }

  function handle(db, req) {
    req = req || {};
    var action = req.action;
    var isTeacher = !!req.auth && String(req.auth) === String(db.teacherKey());
    if (TEACHER_ACTIONS.indexOf(action) >= 0 && !isTeacher) fail('Kata sandi guru salah.');

    switch (action) {
      case 'ping':
        return { mode: db.mode, teacher: isTeacher };

      case 'getGame': {
        var g = needGame(db, req.code);
        return { game: publicGame(g), closed: accessError(g) };
      }

      case 'start': {
        var g1 = needGame(db, req.code);
        var err = accessError(g1);
        if (err) fail(err);
        var st = cleanStudent(req.student);
        var key = Logic.studentKey(st);
        var mine = db.results({ code: g1.code }).filter(function (r) { return r.key === key; });
        var max = Number((g1.settings || {}).maxAttempts) || 0;
        if (max > 0 && mine.length >= max) {
          fail('Kesempatanmu sudah habis (' + max + 'x). Hubungi guru jika perlu mengulang.');
        }
        var at = Logic.buildAttempt(g1);
        var row = {
          id: uid(), code: g1.code, key: key, name: st.name, cls: st.cls, sid: st.sid,
          attempt: mine.length + 1, status: 'started', score: '', correct: '', total: at.key.length,
          durationSec: '', violations: 0, xp: 0, startedAt: nowIso(), finishedAt: '',
          servedKey: at.key, answers: [], detail: {}
        };
        db.appendResult(row);
        return {
          attemptId: row.id, served: at.served, attemptNo: row.attempt, maxAttempts: max,
          startedAt: row.startedAt, game: publicGame(g1), student: st
        };
      }

      case 'submit': {
        var r = db.getResult(String(req.attemptId || ''));
        if (!r) fail('Data pengerjaan tidak ditemukan.');
        var g2 = db.getGame(r.code);
        if (!g2) fail('Game sudah dihapus oleh guru.');
        if (r.status !== 'done') {
          var res = Logic.grade(g2, r.servedKey, Array.isArray(req.answers) ? req.answers : []);
          r.status = 'done';
          r.score = res.score;
          r.correct = res.correct;
          r.total = res.total;
          r.detail = res.detail;
          r.answers = req.answers || [];
          r.violations = Math.max(0, Math.min(999, Number(req.violations) || 0));
          r.xp = Math.max(0, Math.min(999999, Number(req.xp) || 0));
          r.finishedAt = nowIso();
          r.durationSec = Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000);
          db.updateResult(r);
        }
        var s2 = g2.settings || {};
        var max2 = Number(s2.maxAttempts) || 0;
        var used = db.results({ code: r.code }).filter(function (x) { return x.key === r.key; }).length;
        return {
          result: {
            score: Number(r.score), correct: Number(r.correct), total: Number(r.total),
            durationSec: Number(r.durationSec), xp: Number(r.xp), attempt: Number(r.attempt),
            maxAttempts: max2, remaining: max2 > 0 ? Math.max(0, max2 - used) : -1,
            kkm: Number(s2.kkm) || 75, showLeaderboard: !!s2.showLeaderboard
          }
        };
      }

      case 'leaderboard': {
        var g3 = needGame(db, req.code);
        var s3 = g3.settings || {};
        if (!s3.showLeaderboard && !isTeacher) fail('Papan skor game ini disembunyikan oleh guru.');
        var list = Logic.rank(Logic.counted(db.results({ code: g3.code }), s3.scorePolicy).filter(function (x) { return x.finished; }));
        return {
          game: publicGame(g3),
          list: list.map(function (x) {
            return { key: x.key, name: x.name, cls: x.cls, score: x.score, durationSec: x.durationSec, xp: x.xp, attempts: x.attempts };
          })
        };
      }

      case 'listGames': {
        var players = {};
        db.results({}).forEach(function (r) {
          (players[r.code] = players[r.code] || {})[r.key] = 1;
        });
        return {
          games: db.listGames().map(function (g) {
            var s4 = g.settings || {};
            g.participants = players[g.code] ? Object.keys(players[g.code]).length : 0;
            if (!accessError(g)) g.status = 'open';
            else if (s4.active === false) g.status = 'closed';
            else if (s4.openAt && Date.now() < Date.parse(s4.openAt)) g.status = 'scheduled';
            else g.status = 'ended';
            return g;
          })
        };
      }

      case 'saveGame': {
        var game = validateGame(req.game);
        game.code = game.code ? String(game.code).toUpperCase() : newCode(db);
        var prev = db.getGame(game.code);
        game.createdAt = prev ? prev.createdAt : nowIso();
        game.updatedAt = nowIso();
        delete game.participants;
        delete game.status;
        db.saveGame(game);
        return { game: game };
      }

      case 'deleteGame': {
        var code = String(req.code || '').toUpperCase();
        db.deleteGame(code);
        db.deleteResults({ code: code });
        return {};
      }

      case 'results': {
        var filter = req.code ? { code: String(req.code).toUpperCase() } : {};
        return { rows: db.results(filter).map(stripRow) };
      }

      case 'resetAttempts': {
        var c = String(req.code || '').toUpperCase();
        var n = db.deleteResults({ code: c, key: req.studentKey });
        return { removed: n };
      }

      case 'exportDrive': {
        if (!db.exportDrive) fail('Simpan ke Google Drive hanya tersedia jika aplikasi terhubung ke Google Sheets (menu Pengaturan).');
        var g4 = needGame(db, req.code);
        var rows = db.results({ code: g4.code });
        return { url: db.exportDrive(g4, rows) };
      }
    }
    fail('Aksi tidak dikenal: ' + action);
  }

  return { handle: handle, publicGame: publicGame, accessError: accessError };
})();
