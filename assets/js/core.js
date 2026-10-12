/*
 * core.js — "Server" aplikasi. Semua aturan (akses, batas percobaan, penilaian,
 * papan skor) ada di sini. Dipakai oleh Mode Lokal di browser dan disalin ke
 * backend/Code.gs untuk Google Sheets, dengan objek `db` yang berbeda.
 */
var Core = (function () {
  var VERSION = 3; // naikkan setiap kali backend (Code.gs) berubah
  var TEACHER_ACTIONS = ['listGames', 'saveGame', 'deleteGame', 'results', 'resetAttempts', 'exportDrive',
    'getConfig', 'saveConfig', 'driveFolders', 'driveCreateFolder', 'driveHistory', 'runAutoSave'];
  var NO_DRIVE = 'Fitur Google Drive hanya tersedia jika aplikasi terhubung ke Google Sheets (menu Pengaturan).';
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

  // Perbandingan tanpa berhenti di karakter pertama yang berbeda.
  function sameKey(a, b) {
    a = String(a); b = String(b);
    var diff = a.length ^ b.length;
    for (var i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
  }

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

  function config(db) { return db.getConfig ? db.getConfig() : {}; }

  function publicGame(g, cfg) {
    var s = g.settings || {};
    var google = s.loginMode === 'google';
    return {
      code: g.code, title: g.title, subject: g.subject, cls: g.cls || '', description: g.description || '',
      theme: g.theme || 'galaxy', mode: Logic.mode(g), questionCount: questionTotal(g),
      settings: {
        timePerQuestion: Number(s.timePerQuestion) || 0, maxAttempts: Number(s.maxAttempts) || 0,
        showFeedback: !!s.showFeedback, showLeaderboard: !!s.showLeaderboard, powerUps: !!s.powerUps,
        antiCheat: Number(s.antiCheat) || 0, kkm: Number(s.kkm) || 75, scorePolicy: s.scorePolicy || 'best',
        openAt: s.openAt || '', closeAt: s.closeAt || '', active: s.active !== false,
        loginMode: google ? 'google' : 'form', allowedDomain: google ? (s.allowedDomain || '') : '',
        googleClientId: google && cfg ? (cfg.googleClientId || '') : ''
      }
    };
  }

  function cleanStudent(st, sidOptional) {
    st = st || {};
    var out = {
      name: String(st.name || '').trim().slice(0, 80),
      cls: String(st.cls || '').trim().toUpperCase().slice(0, 30),
      sid: String(st.sid || '').trim().slice(0, 30)
    };
    if (out.name.length < 3) fail('Tuliskan nama lengkapmu.');
    if (!out.cls) fail('Tuliskan kelasmu.');
    if (!out.sid && !sidOptional) fail('Tuliskan NIS atau nomor absen.');
    return out;
  }

  function validateGame(g) {
    if (!g || !String(g.title || '').trim()) fail('Judul game wajib diisi.');
    g.mode = Logic.mode(g);
    if (!g.questions || !g.questions.length) fail('Tambahkan minimal 1 soal.');
    g.questions.forEach(function (q, i) {
      var n = 'Soal ' + (i + 1) + ': ';
      if (!q.id) q.id = uid();
      var DEFAULT_Q = { cloze: 'Lengkapi kalimat berikut.', wordsearch: 'Temukan kata-kata berikut.', group: 'Kelompokkan item berikut.' };
      if (!String(q.q || '').trim() && DEFAULT_Q[q.type]) q.q = DEFAULT_Q[q.type];
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
      } else if (q.type === 'group') {
        q.groups = (q.groups || []).map(function (gr) {
          return {
            name: String(gr.name || '').trim(),
            items: (gr.items || []).map(function (t) { return String(t).trim(); }).filter(Boolean)
          };
        }).filter(function (gr) { return gr.name && gr.items.length; });
        if (q.groups.length < 2) fail(n + 'minimal 2 kelompok, masing-masing berisi item.');
        if (q.groups.length > 4) fail(n + 'maksimal 4 kelompok.');
      } else if (q.type === 'word') {
        q.answer = String(q.answer || '').trim().toUpperCase();
        var wl = Logic.letters(q.answer).length;
        if (wl < 2) fail(n + 'kata jawaban minimal 2 huruf.');
        if (wl > 20) fail(n + 'kata jawaban maksimal 20 huruf.');
      } else if (q.type === 'cloze') {
        q.text = String(q.text || '').trim();
        if (!Logic.clozeParts(q.text).blanks.length) fail(n + 'tandai kata yang dikosongkan dengan kurung siku, cth. [Jakarta].');
        q.extra = (q.extra || []).map(function (t) { return String(t).trim(); }).filter(Boolean);
      } else if (q.type === 'multi') {
        q.items = (q.items || []).map(function (it) { return [String(it[0] || '').trim(), !!it[1]]; })
          .filter(function (it) { return it[0]; });
        if (q.items.length < 3) fail(n + 'minimal 3 pilihan.');
        if (!q.items.some(function (it) { return it[1]; })) fail(n + 'tandai minimal 1 jawaban benar.');
      } else if (q.type === 'wordsearch') {
        q.words = (q.words || []).map(function (w) { return String(w).trim().toUpperCase(); })
          .filter(function (w) { return Logic.letters(w).length; });
        if (q.words.length < 2) fail(n + 'minimal 2 kata untuk dicari.');
        if (q.words.length > 12) fail(n + 'maksimal 12 kata.');
        q.words.forEach(function (w) {
          var l = Logic.letters(w).length;
          if (l < 3 || l > 14) fail(n + 'kata "' + w + '" harus 3–14 huruf.');
        });
        Logic.makeWordsearch(q.words);
      } else {
        fail(n + 'jenis soal tidak dikenal.');
      }
    });
    return g;
  }

  function domainOk(email, domain) {
    domain = String(domain || '').trim().toLowerCase().replace(/^@/, '');
    if (!domain) return true;
    var host = email.split('@')[1] || '';
    return host === domain || host.slice(-(domain.length + 1)) === '.' + domain;
  }

  // Penanda (bukan penolakan) agar jawaban siswa tidak hilang, tetapi guru tahu.
  function lateFlags(r, g) {
    var s = g.settings || {};
    var flags = [];
    var fin = Date.parse(r.finishedAt);
    if (s.closeAt && fin > Date.parse(s.closeAt) + 120000) flags.push('Dikirim setelah game ditutup');
    var tpq = Number(s.timePerQuestion) || 0;
    if (tpq > 0) {
      var m = Logic.mode(g), types = {};
      (g.questions || []).forEach(function (q) { types[q.id] = q.type; });
      var perQ = m === 'wheel' || m === 'box' ? 12 : 5; // waktu animasi/umpan balik per soal
      var limit = (s.powerUps ? 15 : 0) + 120;
      (r.servedKey || []).forEach(function (k) { limit += Logic.timeFor(types[k.id] || 'mcq', m, tpq) + perQ; });
      if (Number(r.durationSec) > limit) flags.push('Melebihi batas waktu pengerjaan');
    }
    return flags.join('; ');
  }

  function cleanConfig(c) {
    var out = {};
    c = c || {};
    if ('googleClientId' in c) {
      var cid = String(c.googleClientId || '').trim();
      if (cid && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(cid)) {
        fail('Client ID tidak valid. Bentuknya seperti 1234567890-abc123.apps.googleusercontent.com');
      }
      out.googleClientId = cid;
    }
    if ('schoolYear' in c) {
      var y = String(c.schoolYear || '').trim().replace('/', '-');
      if (y && !/^\d{4}-\d{4}$/.test(y)) fail('Tahun ajaran harus berbentuk 2026-2027.');
      out.schoolYear = y;
    }
    if ('driveRootId' in c) out.driveRootId = String(c.driveRootId || '').trim();
    if ('autoSave' in c) out.autoSave = !!c.autoSave;
    if ('autoSaveMode' in c) out.autoSaveMode = c.autoSaveMode === 'combined' ? 'combined' : 'perClass';
    if ('teacherEmails' in c) {
      var list = (Array.isArray(c.teacherEmails) ? c.teacherEmails : String(c.teacherEmails || '').split(/[,;\s]+/))
        .map(function (e) { return String(e).trim().toLowerCase(); }).filter(Boolean);
      list.forEach(function (e) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) fail('Email guru tidak valid: ' + e); });
      out.teacherEmails = list.filter(function (e, i) { return list.indexOf(e) === i; }).slice(0, 50);
    }
    return out;
  }

  function stripRow(r) {
    return {
      id: r.id, code: r.code, key: r.key, name: r.name, cls: r.cls, sid: r.sid, attempt: Number(r.attempt) || 1,
      status: r.status, score: r.status === 'done' ? Number(r.score) : null, correct: Number(r.correct) || 0,
      total: Number(r.total) || 0, durationSec: Number(r.durationSec) || 0, violations: Number(r.violations) || 0,
      xp: Number(r.xp) || 0, startedAt: r.startedAt, finishedAt: r.finishedAt || '', detail: r.detail || {},
      email: r.email || '', flags: r.flags || ''
    };
  }

  function handle(db, req) {
    req = req || {};
    var action = req.action;
    var tkey = db.teacherKey();
    var auth = String(req.auth || '');
    var isTeacher = (!!tkey && !!auth && sameKey(auth, tkey)) ||
      (auth.indexOf('gs_') === 0 && !!db.checkSession && !!db.checkSession(auth));
    if (TEACHER_ACTIONS.indexOf(action) >= 0 && !isTeacher) fail('Kata sandi guru salah.');

    switch (action) {
      case 'ping':
        var cfgP = config(db);
        return {
          mode: db.mode, teacher: isTeacher, configured: !!tkey, version: VERSION,
          googleLogin: !!cfgP.googleClientId, googleClientId: cfgP.googleClientId || ''
        };

      case 'teacherGoogle': {
        if (!db.verifyGoogleToken || !db.createSession) fail('Login Gmail guru hanya tersedia jika aplikasi terhubung ke Google Sheets.');
        var who = db.verifyGoogleToken(String(req.idToken || ''));
        if (!db.isTeacherEmail(who.email)) {
          fail('Email ' + who.email + ' belum terdaftar sebagai guru. Masuk dengan kata sandi, lalu tambahkan email ini di menu Pengaturan.');
        }
        return { session: db.createSession(who.email), email: who.email, name: who.name };
      }

      case 'logout':
        if (auth.indexOf('gs_') === 0 && db.endSession) db.endSession(auth);
        return {};

      case 'getGame': {
        var g = needGame(db, req.code);
        return { game: publicGame(g, config(db)), closed: accessError(g) };
      }

      case 'start': {
        var g1 = needGame(db, req.code);
        var err = accessError(g1);
        if (err) fail(err);
        var s1 = g1.settings || {};
        var st, key, email = '';
        if (s1.loginMode === 'google') {
          if (!db.verifyGoogleToken) fail('Login Google hanya tersedia jika aplikasi terhubung ke Google Sheets.');
          var ident = db.verifyGoogleToken(String(req.idToken || ''));
          if (!domainOk(ident.email, s1.allowedDomain)) {
            fail('Gunakan akun Google dengan domain @' + String(s1.allowedDomain).replace(/^@/, '') + '.');
          }
          var raw = req.student || {};
          st = cleanStudent({ name: raw.name || ident.name, cls: raw.cls, sid: raw.sid }, true);
          email = ident.email;
          key = 'g|' + email;
        } else {
          st = cleanStudent(req.student);
          key = Logic.studentKey(st);
        }
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
          servedKey: at.key, answers: [], detail: {}, email: email, flags: ''
        };
        db.appendResult(row);
        st.email = email;
        return {
          attemptId: row.id, served: at.served, attemptNo: row.attempt, maxAttempts: max,
          startedAt: row.startedAt, game: publicGame(g1, config(db)), student: st
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
          r.flags = lateFlags(r, g2);
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
        var all3 = db.results({ code: g3.code });
        // "me" = id percobaan milik siswa ini (acak, tidak bisa ditebak). NIS/email tidak pernah dikirim.
        var meKey = null;
        all3.forEach(function (r) { if (req.me && r.id === String(req.me)) meKey = r.key; });
        var list = Logic.rank(Logic.counted(all3, s3.scorePolicy).filter(function (x) { return x.finished; }));
        return {
          game: publicGame(g3),
          list: list.map(function (x) {
            return { name: x.name, cls: x.cls, score: x.score, durationSec: x.durationSec, xp: x.xp, attempts: x.attempts, me: x.key === meKey };
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
        if (!db.exportDrive) fail(NO_DRIVE);
        var g4 = needGame(db, req.code);
        var rows = db.results({ code: g4.code });
        if (!rows.length) fail('Belum ada siswa yang mengerjakan game ini.');
        var files = db.exportDrive(g4, rows, { mode: req.mode, folderId: req.folderId || '' });
        return { files: files, url: files.length ? files[0].url : '' };
      }

      case 'getConfig':
        return { config: config(db), drive: db.driveInfo ? db.driveInfo() : null, owner: db.ownerEmail ? db.ownerEmail() : '',
          me: auth.indexOf('gs_') === 0 && db.checkSession ? db.checkSession(auth) : '' };

      case 'saveConfig': {
        if (!db.setConfig) fail(NO_DRIVE);
        db.setConfig(cleanConfig(req.config));
        return { config: config(db), drive: db.driveInfo ? db.driveInfo() : null, owner: db.ownerEmail ? db.ownerEmail() : '' };
      }

      case 'driveFolders':
        if (!db.driveFolders) fail(NO_DRIVE);
        return db.driveFolders(String(req.parentId || ''), !!req.fromMyDrive);

      case 'driveCreateFolder': {
        if (!db.driveCreateFolder) fail(NO_DRIVE);
        var fname = String(req.name || '').trim();
        if (!fname) fail('Nama folder wajib diisi.');
        return { folder: db.driveCreateFolder(String(req.parentId || ''), fname) };
      }

      case 'driveHistory':
        if (!db.driveHistory) return { files: [] };
        return { files: db.driveHistory(req.code ? String(req.code).toUpperCase() : '') };

      case 'runAutoSave':
        if (!db.autoSave) fail(NO_DRIVE);
        return db.autoSave();
    }
    fail('Aksi tidak dikenal: ' + action);
  }

  return { handle: handle, publicGame: publicGame, accessError: accessError, VERSION: VERSION };
})();
