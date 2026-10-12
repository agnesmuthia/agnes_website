/* teacher.js — Dasbor guru. */
var Teacher = (function () {
  var esc = U.esc, $ = U.$, $$ = U.$$;
  var D = null;          // draft game di editor
  var cache = { games: null };

  var NAV = [
    ['', '🏠', 'Beranda'], ['aktivitas', '🗂️', 'Aktivitas Saya'], ['buat', '✨', 'Buat Game'], ['template', '🎨', 'Template'],
    ['rekap', '📋', 'Rekap Nilai'], ['analisis', '📊', 'Analisis'], ['pengaturan', '⚙️', 'Pengaturan']
  ];
  var STATUS = { open: ['Aktif', 'ok'], closed: ['Ditutup', 'off'], scheduled: ['Terjadwal', 'warn'], ended: ['Berakhir', 'off'] };

  function root() { return $('#app'); }

  function shell(active, content) {
    root().innerHTML = '<div class="dash">' +
      '<aside class="side"><a class="logo dark" href="#/guru">🎮 <b>Game</b>Belajar</a><nav>' +
      NAV.map(function (n) {
        return '<a href="#/guru' + (n[0] ? '/' + n[0] : '') + '" class="' + (active === n[0] ? 'on' : '') + '"><span>' + n[1] + '</span>' + n[2] + '</a>';
      }).join('') + '</nav>' +
      '<div class="side-foot"><div class="mode-pill ' + (Api.isLocal() ? 'local' : 'cloud') + '">' + (Api.isLocal() ? '💻 Mode Lokal' : '☁️ Google Sheets') + '</div>' +
      '<button class="btn small ghost full" id="logout">Keluar</button></div></aside>' +
      '<main class="main" id="main">' +
      (Api.isLocal() && active !== 'pengaturan' ? '<div class="notice warn">💻 <span><b>Mode Lokal:</b> data hanya tersimpan di browser ini, sehingga siswa belum bisa bermain dari perangkat lain. ' +
        '<a href="#/guru/pengaturan">Hubungkan ke Google Sheets</a> agar bisa dibagikan dan rekap tersimpan di Google Drive.</span></div>' : '') +
      content + '</main></div>';
    $('#logout').onclick = function () { Api.setAuth(''); cache.games = null; location.hash = '#/'; };
  }

  function loadingMain(active) { shell(active, '<div class="center-box"><div class="spinner dark"></div><p>Memuat…</p></div>'); }

  function games(force) {
    if (cache.games && !force) return Promise.resolve(cache.games);
    return Api.call('listGames').then(function (r) {
      cache.games = r.games.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
      return cache.games;
    });
  }

  function fail(err) {
    if (/sandi guru salah/i.test(err.message)) { Api.setAuth(''); route(''); return; }
    U.toast(err.message, 'err');
    var m = $('#main');
    if (m && m.querySelector('.spinner')) m.innerHTML = '<div class="card center-box"><div class="big-emoji">⚠️</div><p>' + esc(err.message) + '</p><a class="btn" href="#/guru/pengaturan">Periksa pengaturan</a></div>';
  }

  /* ================= LOGIN GURU ================= */
  function login() {
    var local = Api.isLocal();
    var needPin = local && !LocalDB.hasPin();
    root().innerHTML = Student.themed('galaxy',
      '<header class="topbar"><a class="logo" href="#/">🎮 <b>Game</b>Belajar</a></header>' +
      '<form class="card glass login-card" id="tl"><div class="big-emoji">👩‍🏫</div>' +
      '<h2>' + (needPin ? 'Buat PIN Guru' : 'Masuk sebagai Guru') + '</h2>' +
      '<p class="muted">' + (needPin ? 'Buat PIN untuk melindungi dasbor di perangkat ini (Mode Lokal).'
        : local ? 'Masukkan PIN guru perangkat ini.' : 'Masukkan kata sandi guru (TEACHER_KEY di Google Apps Script).') + '</p>' +
      '<input type="password" name="k" required minlength="4" placeholder="' + (needPin ? 'PIN baru (min. 4 karakter)' : 'Kata sandi / PIN') + '" autocomplete="current-password">' +
      (needPin ? '<input type="password" name="k2" required minlength="4" placeholder="Ulangi PIN">' : '') +
      '<button class="btn big glow full">Masuk</button>' +
      '<p class="small muted">Server: ' + (local ? 'Mode Lokal (browser ini)' : 'Google Sheets') + ' · <a href="#/guru/pengaturan" id="toset">ubah</a></p></form>');
    $('#toset').onclick = function (e) { e.preventDefault(); settingsPublic(); };
    $('#tl').onsubmit = function (e) {
      e.preventDefault();
      var k = e.target.k.value;
      if (needPin) {
        if (k !== e.target.k2.value) { U.toast('PIN tidak sama.', 'err'); return; }
        LocalDB.setPin(k);
      }
      Api.setAuth(k);
      Api.call('ping').then(function (r) {
        if (r.configured === false) throw new Error('TEACHER_KEY belum diatur di Script Properties Google Apps Script.');
        if (!r.teacher) throw new Error(local ? 'PIN salah.' : 'Kata sandi guru salah.');
        U.toast('Selamat datang! 👋', 'ok');
        route(location.hash.replace(/^#\/guru\/?/, ''));
      }).catch(function (err) { Api.setAuth(''); U.toast(err.message, 'err'); });
    };
  }

  // Pengaturan server yang bisa diakses sebelum login (untuk menyambungkan backend).
  function settingsPublic() {
    var m = U.modal('<h3>Alamat server</h3><p class="muted">Tempelkan URL Web App Google Apps Script. Kosongkan untuk Mode Lokal.</p>' +
      '<input id="su" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(Api.url()) + '">' +
      '<div class="row end gap"><button class="btn" id="ss">Simpan</button></div>');
    $('#ss', m.el).onclick = function () { Api.setUrl($('#su', m.el).value.trim()); m.close(); login(); };
  }

  /* ================= ROUTER GURU ================= */
  function route(path) {
    Student.cleanup();
    if (!Api.auth()) { login(); return; }
    var p = path.split('/');
    switch (p[0]) {
      case '': return dashboard();
      case 'aktivitas': return library();
      case 'template': return templates();
      case 'buat': return editor(null, p[1]);
      case 'edit': return editor(p[1]);
      case 'rekap': return recap(p[1]);
      case 'analisis': return analysis(p[1]);
      case 'kemajuan': return progressView();
      case 'pengaturan': return settings();
    }
    dashboard();
  }

  /* ================= BERANDA ================= */
  function dashboard() {
    loadingMain('');
    Promise.all([games(true), Api.call('results')]).then(function (res) {
      var gs = res[0], rows = res[1].rows;
      var done = rows.filter(function (r) { return r.status === 'done'; });
      var people = {};
      rows.forEach(function (r) { people[r.key] = 1; });
      var avg = done.length ? Math.round(Analytics.mean(done.map(function (r) { return r.score; }))) : 0;
      var active = gs.filter(function (g) { return g.status === 'open'; }).length;
      var recent = rows.slice().sort(function (a, b) { return String(b.startedAt).localeCompare(String(a.startedAt)); }).slice(0, 8);
      var byCode = {};
      gs.forEach(function (g) { byCode[g.code] = g; });
      shell('', '<div class="page-head"><div><h1>Halo, Bapak/Ibu Guru! 👋</h1><p class="muted">Ringkasan aktivitas game pembelajaran Anda.</p></div>' +
        '<a class="btn glow" href="#/guru/buat">✨ Buat Game Baru</a></div>' +
        '<div class="kpis">' +
        kpi('🎮', gs.length, 'Aktivitas dibuat') + kpi('🟢', active, 'Sedang aktif') +
        kpi('🧑‍🎓', Object.keys(people).length, 'Siswa bermain') + kpi('📝', done.length, 'Pengerjaan selesai') + kpi('📈', avg, 'Rata-rata nilai') +
        '</div>' +
        '<div class="grid2">' +
        '<section class="card"><h3>⚡ Aksi cepat</h3><div class="quick">' +
        '<a href="#/guru/template"><span>🎨</span>Pakai template</a><a href="#/guru/buat"><span>✨</span>Buat dari nol</a>' +
        '<a href="#/guru/rekap"><span>📋</span>Lihat rekap</a><a href="#/guru/analisis"><span>📊</span>Analisis nilai</a>' +
        '<a href="#/guru/kemajuan"><span>📈</span>Kemajuan siswa</a><a href="#/guru/pengaturan"><span>☁️</span>Google Drive</a></div></section>' +
        '<section class="card"><h3>🕒 Aktivitas siswa terbaru</h3>' +
        (recent.length ? '<ul class="feed">' + recent.map(function (r) {
          var g = byCode[r.code];
          return '<li><b>' + esc(r.name) + '</b> <span class="muted">(' + esc(r.cls) + ')</span> ' +
            (r.status === 'done' ? 'mendapat <b class="' + (r.score >= ((g && g.settings.kkm) || 75) ? 'txt-ok' : 'txt-bad') + '">' + r.score + '</b>' : '<i>sedang mengerjakan</i>') +
            ' di <a href="#/guru/rekap/' + esc(r.code) + '">' + esc(g ? g.title : r.code) + '</a><small>' + U.fmtDate(r.finishedAt || r.startedAt) + '</small></li>';
        }).join('') + '</ul>' : '<p class="muted">Belum ada siswa yang bermain. Bagikan kode game Anda!</p>') +
        '</section></div>' +
        '<section class="card"><div class="row between"><h3>🗂️ Aktivitas terbaru</h3><a href="#/guru/aktivitas">Lihat semua →</a></div>' +
        '<div class="gcards">' + gs.slice(0, 4).map(gameCard).join('') + (gs.length ? '' : '<p class="muted">Belum ada aktivitas. Mulai dari template!</p>') + '</div></section>');
      bindCards();
    }).catch(fail);
  }

  function kpi(icon, v, label) {
    return '<div class="kpi"><span>' + icon + '</span><b>' + v + '</b><small>' + label + '</small></div>';
  }

  /* ================= PERPUSTAKAAN AKTIVITAS ================= */
  function gameCard(g) {
    var st = STATUS[g.status] || STATUS.open;
    var th = THEMES[g.theme] || THEMES.galaxy;
    return '<article class="gcard theme-' + esc(g.theme in THEMES ? g.theme : 'galaxy') + '" data-code="' + esc(g.code) + '">' +
      '<div class="gc-top"><span class="gc-icon">' + th.icon + '</span><span class="badge ' + st[1] + '">' + st[0] + '</span></div>' +
      '<h4>' + esc(g.title) + '</h4>' +
      '<div class="gc-meta"><span class="chip">' + esc(g.subject || 'Umum') + '</span>' + (g.cls ? '<span class="chip">' + esc(g.cls) + '</span>' : '') + '</div>' +
      '<div class="gc-stats"><span>❓ ' + g.questions.length + ' soal</span><span>🧑‍🎓 ' + (g.participants || 0) + '</span><span>🔑 <b>' + esc(g.code) + '</b></span></div>' +
      '<div class="gc-actions">' +
      '<button data-a="share" title="Bagikan">🔗 Bagikan</button><button data-a="edit" title="Sunting">✏️</button>' +
      '<button data-a="recap" title="Rekap nilai">📋</button><button data-a="stats" title="Analisis">📊</button>' +
      '<button data-a="more" title="Lainnya">⋯</button></div></article>';
  }

  function bindCards() {
    $$('.gcard').forEach(function (card) {
      card.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var code = card.dataset.code;
        var g = cache.games.filter(function (x) { return x.code === code; })[0];
        var a = b.dataset.a;
        if (a === 'share') share(g);
        if (a === 'edit') location.hash = '#/guru/edit/' + code;
        if (a === 'recap') location.hash = '#/guru/rekap/' + code;
        if (a === 'stats') location.hash = '#/guru/analisis/' + code;
        if (a === 'more') moreMenu(g);
      };
    });
  }

  function moreMenu(g) {
    var on = g.settings.active !== false;
    var m = U.modal('<h3>' + esc(g.title) + '</h3><div class="menu-list">' +
      '<button data-a="toggle">' + (on ? '🔒 Tutup akses game' : '🔓 Buka akses game') + '</button>' +
      '<button data-a="dup">📄 Duplikat</button>' +
      '<button data-a="export">💾 Ekspor template (.json)</button>' +
      '<button data-a="board">🏆 Buka papan skor</button>' +
      '<button data-a="play">▶️ Coba mainkan</button>' +
      '<button data-a="del" class="danger-txt">🗑️ Hapus game & nilainya</button></div>');
    m.el.onclick = function (e) {
      var a = e.target.getAttribute('data-a');
      if (!a) return;
      if (a === 'toggle') {
        var copy = JSON.parse(JSON.stringify(g));
        copy.settings.active = !on;
        Api.call('saveGame', { game: copy }).then(function () { U.toast(on ? 'Game ditutup.' : 'Game dibuka.', 'ok'); m.close(); library(); }).catch(fail);
      }
      if (a === 'dup') {
        var d = JSON.parse(JSON.stringify(g));
        d.code = ''; d.title += ' (salinan)';
        d.questions.forEach(function (q) { q.id = U.uid(); });
        Api.call('saveGame', { game: d }).then(function () { U.toast('Game diduplikat.', 'ok'); m.close(); library(); }).catch(fail);
      }
      if (a === 'export') { exportGames([g], 'template-' + slug(g.title)); m.close(); }
      if (a === 'board') { m.close(); location.hash = '#/skor/' + g.code; }
      if (a === 'play') { m.close(); location.hash = '#/main/' + g.code; }
      if (a === 'del') {
        m.close();
        U.confirm('Hapus "' + g.title + '" beserta SEMUA nilai siswanya? Tindakan ini tidak dapat dibatalkan.', 'Hapus').then(function (ok) {
          if (!ok) return;
          Api.call('deleteGame', { code: g.code }).then(function () { U.toast('Game dihapus.', 'ok'); library(); }).catch(fail);
        });
      }
    };
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'game'; }

  function exportGames(list, name) {
    var data = {
      format: 'gamebelajar', version: 1, exportedAt: new Date().toISOString(),
      games: list.map(function (g) {
        var c = JSON.parse(JSON.stringify(g));
        delete c.participants; delete c.status;
        return c;
      })
    };
    U.download(name + '.json', JSON.stringify(data, null, 2), 'application/json');
    U.toast('Template diekspor ✓', 'ok');
  }

  function library() {
    loadingMain('aktivitas');
    games(true).then(function (gs) {
      var subjects = {};
      gs.forEach(function (g) { subjects[g.subject || 'Umum'] = (subjects[g.subject || 'Umum'] || 0) + 1; });
      var f = { q: '', s: '', st: '' };
      shell('aktivitas', '<div class="page-head"><div><h1>🗂️ Aktivitas Saya</h1><p class="muted">Semua game yang sudah dibuat. Bisa dipakai ulang untuk semua mata pelajaran dan kelas.</p></div>' +
        '<div class="row gap wrap"><label class="btn ghost">📥 Impor<input type="file" accept=".json" id="imp" hidden></label>' +
        '<button class="btn ghost" id="expall">💾 Ekspor semua</button><a class="btn glow" href="#/guru/buat">✨ Buat Game</a></div></div>' +
        '<div class="filters"><input id="fq" placeholder="🔍 Cari judul atau kode…">' +
        '<select id="fst"><option value="">Semua status</option><option value="open">Aktif</option><option value="closed">Ditutup</option><option value="scheduled">Terjadwal</option><option value="ended">Berakhir</option></select></div>' +
        '<div class="subject-tabs" id="ftabs"><button class="on" data-s="">Semua <b>' + gs.length + '</b></button>' +
        Object.keys(subjects).sort().map(function (s) { return '<button data-s="' + esc(s) + '">' + esc(s) + ' <b>' + subjects[s] + '</b></button>'; }).join('') + '</div>' +
        '<div class="gcards" id="glist"></div>');
      function draw() {
        var list = gs.filter(function (g) {
          var t = (g.title + ' ' + g.code).toLowerCase();
          return (!f.q || t.indexOf(f.q) >= 0) && (!f.s || (g.subject || 'Umum') === f.s) && (!f.st || g.status === f.st);
        });
        $('#glist').innerHTML = list.map(gameCard).join('') ||
          '<div class="card center-box"><div class="big-emoji">🗃️</div><p>Belum ada aktivitas yang cocok.</p><a class="btn" href="#/guru/template">Mulai dari template</a></div>';
        bindCards();
      }
      $('#fq').oninput = function (e) { f.q = e.target.value.toLowerCase(); draw(); };
      $('#fst').onchange = function (e) { f.st = e.target.value; draw(); };
      $('#ftabs').onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        $$('#ftabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
        f.s = b.dataset.s; draw();
      };
      $('#expall').onclick = function () { if (gs.length) exportGames(gs, 'semua-aktivitas'); };
      $('#imp').onchange = importFile;
      draw();
    }).catch(fail);
  }

  function importFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    U.readFile(file).then(function (txt) {
      var data = JSON.parse(txt);
      var list = data.games || (data.questions ? [data] : null);
      if (!list || !list.length) throw new Error('File bukan template Game Belajar.');
      if (list.length === 1) {
        D = prepareDraft(list[0]);
        location.hash = '#/guru/buat/impor';
        return;
      }
      var chain = Promise.resolve();
      list.forEach(function (g) {
        chain = chain.then(function () { return Api.call('saveGame', { game: prepareDraft(g) }); });
      });
      return chain.then(function () { U.toast(list.length + ' game berhasil diimpor ✓', 'ok'); library(); });
    }).catch(function (err) { U.toast('Gagal impor: ' + err.message, 'err'); });
  }

  function prepareDraft(g) {
    var d = JSON.parse(JSON.stringify(g));
    d.code = '';
    d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
    (d.questions || []).forEach(function (q) { q.id = U.uid(); });
    delete d.participants; delete d.status; delete d.createdAt; delete d.updatedAt;
    return d;
  }

  /* ================= TEMPLATE ================= */
  function templates() {
    shell('template', '<div class="page-head"><div><h1>🎨 Galeri Template</h1><p class="muted">Pilih template, ubah soalnya, dan game siap dibagikan dalam hitungan menit.</p></div>' +
      '<label class="btn ghost">📥 Impor template (.json)<input type="file" accept=".json" id="imp" hidden></label></div>' +
      '<h3>🧩 Jenis permainan</h3><div class="qtypes">' + Object.keys(QTYPES).map(function (k) {
        return '<div class="qt"><span>' + QTYPES[k].icon + '</span><b>' + QTYPES[k].name + '</b><small>' + QTYPES[k].hint + '</small></div>';
      }).join('') + '</div>' +
      '<h3>🌈 Tema visual</h3><div class="theme-row">' + Object.keys(THEMES).map(function (k) {
        return '<div class="theme-swatch theme-' + k + '"><span>' + THEMES[k].icon + '</span><b>' + THEMES[k].name + '</b><small>' + THEMES[k].desc + '</small></div>';
      }).join('') + '</div>' +
      '<h3>📚 Template siap pakai</h3><div class="gcards">' + TEMPLATES.map(function (t) {
        var types = {};
        t.questions.forEach(function (q) { types[q.type] = 1; });
        return '<article class="gcard tpl theme-' + t.theme + '"><div class="gc-top"><span class="gc-icon">' + THEMES[t.theme].icon + '</span><span class="badge">' + esc(t.mode) + '</span></div>' +
          '<h4>' + esc(t.title) + '</h4><p class="small">' + esc(t.description) + '</p>' +
          '<div class="gc-meta"><span class="chip">' + esc(t.subject) + '</span>' + Object.keys(types).map(function (k) { return '<span class="chip" title="' + QTYPES[k].name + '">' + QTYPES[k].icon + '</span>'; }).join('') + '</div>' +
          '<div class="gc-actions"><a class="btn small" href="#/guru/buat/' + t.id + '">Pakai template →</a>' +
          '<button class="btn small ghost" data-exp="' + t.id + '">💾</button></div></article>';
      }).join('') + '</div>');
    $('#imp').onchange = importFile;
    $$('[data-exp]').forEach(function (b) {
      b.onclick = function () {
        var t = TEMPLATES.filter(function (x) { return x.id === b.dataset.exp; })[0];
        exportGames([gameFromTemplate(t)], 'template-' + slug(t.title));
      };
    });
  }

  /* ================= EDITOR ================= */
  function blankGame() {
    return {
      code: '', title: '', subject: 'Matematika', cls: '', description: '', theme: 'galaxy',
      settings: Object.assign({}, DEFAULT_SETTINGS), questions: [newQuestion('mcq')]
    };
  }

  function newQuestion(type) {
    var q = { id: U.uid(), type: type, q: '' };
    if (type === 'mcq') { q.options = ['', '', '', '']; q.answer = 0; }
    if (type === 'tf') q.answer = true;
    if (type === 'short') q.answers = [''];
    if (type === 'match') q.pairs = [['', ''], ['', ''], ['', '']];
    if (type === 'order') q.items = ['', '', ''];
    return q;
  }

  function editor(code, tpl) {
    loadingMain(code ? 'aktivitas' : 'buat');
    var p;
    if (code) {
      p = games().then(function (gs) {
        var g = gs.filter(function (x) { return x.code === code; })[0];
        if (!g) throw new Error('Game tidak ditemukan.');
        var d = JSON.parse(JSON.stringify(g));
        d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings);
        delete d.participants; delete d.status;
        return d;
      });
    } else if (tpl === 'impor' && D) {
      p = Promise.resolve(D);
    } else if (tpl) {
      var t = TEMPLATES.filter(function (x) { return x.id === tpl; })[0];
      p = Promise.resolve(t ? gameFromTemplate(t) : blankGame());
    } else {
      p = Promise.resolve(blankGame());
    }
    p.then(function (d) { D = d; renderEditor(); }).catch(fail);
  }

  function renderEditor() {
    var s = D.settings;
    var subj = SUBJECTS.indexOf(D.subject) >= 0 ? D.subject : 'Lainnya';
    shell(D.code ? 'aktivitas' : 'buat',
      '<div class="page-head sticky"><div><h1>' + (D.code ? '✏️ Sunting Game <span class="code-tag">' + esc(D.code) + '</span>' : '✨ Buat Game Baru') + '</h1>' +
      '<p class="muted">Atur isi, tampilan, dan aturan akses game.</p></div>' +
      '<div class="row gap wrap"><button class="btn ghost" id="preview">👀 Pratinjau tema</button><button class="btn glow" id="save">💾 Simpan & Bagikan</button></div></div>' +

      '<div class="editor">' +
      '<div class="ed-main">' +
      '<section class="card"><h3>📝 Informasi</h3>' +
      '<label>Judul game<input data-g="title" maxlength="100" value="' + esc(D.title) + '" placeholder="cth. Kuis Kilat Sistem Pernapasan"></label>' +
      '<div class="row gap wrap"><label class="grow">Mata pelajaran<select data-g="subjectSel">' + SUBJECTS.map(function (x) {
        return '<option ' + (x === subj ? 'selected' : '') + '>' + x + '</option>';
      }).join('') + '</select></label>' +
      '<label class="grow" id="subjOther" ' + (subj === 'Lainnya' ? '' : 'hidden') + '>Nama mapel<input data-g="subjectOther" value="' + esc(subj === 'Lainnya' && D.subject !== 'Lainnya' ? D.subject : '') + '" placeholder="cth. Prakarya"></label>' +
      '<label class="grow">Kelas sasaran<input data-g="cls" maxlength="40" value="' + esc(D.cls || '') + '" placeholder="cth. XI IPA"></label></div>' +
      '<label>Deskripsi / petunjuk untuk siswa<textarea data-g="description" rows="2" maxlength="300">' + esc(D.description || '') + '</textarea></label></section>' +

      '<section class="card"><h3>🌈 Tema tampilan</h3><div class="theme-pick">' + Object.keys(THEMES).map(function (k) {
        return '<button type="button" class="theme-swatch theme-' + k + (D.theme === k ? ' on' : '') + '" data-theme="' + k + '"><span>' + THEMES[k].icon + '</span><b>' + THEMES[k].name + '</b></button>';
      }).join('') + '</div></section>' +

      '<section class="card"><div class="row between wrap gap"><h3>❓ Soal <span class="muted" id="qcount"></span></h3>' +
      '<button class="btn small ghost" id="bulk">⚡ Impor soal cepat (teks)</button></div>' +
      '<div id="qlist"></div>' +
      '<div class="add-q"><span>Tambah soal:</span>' + Object.keys(QTYPES).map(function (k) {
        return '<button type="button" class="btn small" data-add="' + k + '">' + QTYPES[k].icon + ' ' + QTYPES[k].name + '</button>';
      }).join('') + '</div></section>' +
      '</div>' +

      '<aside class="ed-side"><section class="card"><h3>⚙️ Aturan & Akses</h3>' +
      '<label>Jumlah soal yang diujikan<input type="number" min="0" data-s="questionCount" value="' + (s.questionCount || 0) + '"><small>0 = semua soal. Jika lebih kecil dari bank soal, tiap siswa mendapat soal acak berbeda.</small></label>' +
      '<label>Waktu per soal (detik)<input type="number" min="0" max="600" data-s="timePerQuestion" value="' + s.timePerQuestion + '"><small>0 = tanpa batas waktu.</small></label>' +
      '<label>Maksimal kesempatan per siswa<input type="number" min="0" max="50" data-s="maxAttempts" value="' + s.maxAttempts + '"><small>0 = tak terbatas. Kesempatan terpakai saat siswa menekan "Mulai".</small></label>' +
      '<label>Nilai yang dipakai<select data-s="scorePolicy">' +
      [['best', 'Nilai tertinggi'], ['last', 'Nilai terakhir'], ['first', 'Nilai percobaan pertama']].map(function (o) {
        return '<option value="' + o[0] + '" ' + (s.scorePolicy === o[0] ? 'selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>' +
      '<label>KKM / KKTP<input type="number" min="0" max="100" data-s="kkm" value="' + s.kkm + '"></label>' +
      '<label>Dibuka mulai<input type="datetime-local" data-s="openAt" value="' + U.toLocalInput(s.openAt) + '"></label>' +
      '<label>Ditutup pada<input type="datetime-local" data-s="closeAt" value="' + U.toLocalInput(s.closeAt) + '"></label>' +
      '<label>Batas keluar halaman (anti-curang)<input type="number" min="0" max="20" data-s="antiCheat" value="' + s.antiCheat + '"><small>Jawaban otomatis dikumpulkan jika siswa pindah tab/aplikasi sebanyak ini. 0 = hanya dicatat.</small></label>' +
      toggle('active', 'Game aktif (bisa dimainkan)') +
      toggle('shuffleQuestions', 'Acak urutan soal') +
      toggle('shuffleOptions', 'Acak pilihan jawaban') +
      toggle('showFeedback', 'Tampilkan benar/salah langsung', 'Matikan untuk ulangan resmi: kunci jawaban tidak dikirim ke perangkat siswa.') +
      toggle('showLeaderboard', 'Tampilkan papan skor ke siswa') +
      toggle('powerUps', 'Aktifkan power-up (50:50 & +15 detik)') +
      '</section></aside></div>');

    drawQuestions();

    var main = $('#main');
    main.addEventListener('input', onEdit);
    main.addEventListener('change', onEdit);
    main.addEventListener('click', onClick);
    $('#save').onclick = save;
    $('#bulk').onclick = bulkImport;
    $('#preview').onclick = function () {
      U.modal('<div class="preview-frame">' + Student.themed(D.theme, '<div class="play"><div class="qcard pop"><div class="qtype">🔠 Pilihan Ganda</div>' +
        '<h2 class="qtext">' + esc((D.questions[0] && D.questions[0].q) || 'Contoh pertanyaan') + '</h2></div><div class="answers"><div class="opts n4">' +
        ['A', 'B', 'C', 'D'].map(function (x, i) { return '<button class="opt c' + i + '"><span class="shape">' + ['▲', '◆', '●', '■'][i] + '</span><span class="ot">Pilihan ' + x + '</span></button>'; }).join('') +
        '</div></div></div>') + '</div>', { wide: true });
    };
  }

  function toggle(key, label, help) {
    return '<label class="switch"><input type="checkbox" data-s="' + key + '" ' + (D.settings[key] ? 'checked' : '') + '><span class="sw"></span><span>' + label +
      (help ? '<small>' + help + '</small>' : '') + '</span></label>';
  }

  function drawQuestions() {
    $('#qcount').textContent = '(' + D.questions.length + ')';
    $('#qlist').innerHTML = D.questions.map(function (q, i) {
      var t = QTYPES[q.type];
      var body = '';
      if (q.type === 'mcq') {
        body = '<div class="opt-edit">' + q.options.map(function (o, j) {
          return '<div class="oe"><label class="radio" title="Tandai sebagai jawaban benar"><input type="radio" name="ans' + i + '" data-f="answer" data-j="' + j + '" ' + (Number(q.answer) === j ? 'checked' : '') + '><span>' + String.fromCharCode(65 + j) + '</span></label>' +
            '<input data-f="option" data-j="' + j + '" value="' + esc(o) + '" placeholder="Pilihan ' + String.fromCharCode(65 + j) + '">' +
            (q.options.length > 2 ? '<button type="button" class="x" data-act="delopt" data-j="' + j + '" aria-label="Hapus pilihan">✕</button>' : '') + '</div>';
        }).join('') + '</div>' + (q.options.length < 6 ? '<button type="button" class="link" data-act="addopt">+ Tambah pilihan</button>' : '') +
          '<small class="muted">Pilih bulatan huruf untuk menandai jawaban benar.</small>';
      } else if (q.type === 'tf') {
        body = '<div class="row gap"><label class="pill-radio"><input type="radio" name="tf' + i + '" data-f="tf" value="true" ' + (q.answer ? 'checked' : '') + '><span>✔ Benar</span></label>' +
          '<label class="pill-radio"><input type="radio" name="tf' + i + '" data-f="tf" value="false" ' + (!q.answer ? 'checked' : '') + '><span>✖ Salah</span></label></div>';
      } else if (q.type === 'short') {
        body = '<label>Kunci jawaban (pisahkan beberapa alternatif dengan titik koma ;)<input data-f="answers" value="' + esc(q.answers.join('; ')) + '" placeholder="cth. fotosintesis; foto sintesis"></label>' +
          '<small class="muted">Huruf besar/kecil dan spasi berlebih diabaikan.</small>';
      } else if (q.type === 'match') {
        body = '<div class="pairs">' + q.pairs.map(function (p, j) {
          return '<div class="pr"><input data-f="left" data-j="' + j + '" value="' + esc(p[0]) + '" placeholder="Kiri ' + (j + 1) + '"><span>↔</span>' +
            '<input data-f="right" data-j="' + j + '" value="' + esc(p[1]) + '" placeholder="Pasangan ' + (j + 1) + '">' +
            (q.pairs.length > 2 ? '<button type="button" class="x" data-act="delpair" data-j="' + j + '" aria-label="Hapus pasangan">✕</button>' : '') + '</div>';
        }).join('') + '</div>' + (q.pairs.length < 8 ? '<button type="button" class="link" data-act="addpair">+ Tambah pasangan</button>' : '');
      } else if (q.type === 'order') {
        body = '<small class="muted">Tulis dalam urutan yang BENAR. Urutan akan diacak saat dimainkan.</small><div class="pairs">' + q.items.map(function (it, j) {
          return '<div class="pr"><span class="onum">' + (j + 1) + '</span><input data-f="item" data-j="' + j + '" value="' + esc(it) + '" placeholder="Langkah ' + (j + 1) + '">' +
            '<button type="button" class="x" data-act="itemup" data-j="' + j + '" ' + (j === 0 ? 'disabled' : '') + ' aria-label="Naik">↑</button>' +
            (q.items.length > 2 ? '<button type="button" class="x" data-act="delitem" data-j="' + j + '" aria-label="Hapus">✕</button>' : '') + '</div>';
        }).join('') + '</div>' + (q.items.length < 8 ? '<button type="button" class="link" data-act="additem">+ Tambah item</button>' : '');
      }
      return '<div class="qedit" data-qi="' + i + '"><div class="qe-head"><span class="qnum">' + (i + 1) + '</span><span class="badge">' + t.icon + ' ' + t.name + '</span>' +
        '<span class="grow"></span><button type="button" data-act="up" ' + (i === 0 ? 'disabled' : '') + ' title="Naik">↑</button>' +
        '<button type="button" data-act="down" ' + (i === D.questions.length - 1 ? 'disabled' : '') + ' title="Turun">↓</button>' +
        '<button type="button" data-act="dup" title="Duplikat">⧉</button><button type="button" data-act="del" title="Hapus" class="danger-txt">🗑</button></div>' +
        '<textarea data-f="q" rows="2" placeholder="Tulis pertanyaan…">' + esc(q.q) + '</textarea>' + body +
        '<details ' + (q.img ? 'open' : '') + '><summary>🖼️ Gambar (opsional)</summary><input data-f="img" value="' + esc(q.img || '') + '" placeholder="https://… tautan gambar (mis. dari Google Drive publik)"></details></div>';
    }).join('');
  }

  function onEdit(e) {
    var t = e.target;
    var gk = t.getAttribute('data-g');
    if (gk) {
      if (gk === 'subjectSel') {
        $('#subjOther').hidden = t.value !== 'Lainnya';
        D.subject = t.value === 'Lainnya' ? ($('[data-g=subjectOther]').value.trim() || 'Lainnya') : t.value;
      } else if (gk === 'subjectOther') {
        D.subject = t.value.trim() || 'Lainnya';
      } else D[gk] = t.value;
      return;
    }
    var sk = t.getAttribute('data-s');
    if (sk) {
      if (t.type === 'checkbox') D.settings[sk] = t.checked;
      else if (t.type === 'number') D.settings[sk] = Math.max(0, Number(t.value) || 0);
      else if (t.type === 'datetime-local') D.settings[sk] = t.value ? new Date(t.value).toISOString() : '';
      else D.settings[sk] = t.value;
      return;
    }
    var f = t.getAttribute('data-f');
    var card = t.closest('.qedit');
    if (!f || !card) return;
    var q = D.questions[Number(card.dataset.qi)];
    var j = Number(t.getAttribute('data-j'));
    if (f === 'q') q.q = t.value;
    if (f === 'img') q.img = t.value.trim();
    if (f === 'option') q.options[j] = t.value;
    if (f === 'answer') q.answer = j;
    if (f === 'tf') q.answer = t.value === 'true';
    if (f === 'answers') q.answers = t.value.split(';').map(function (x) { return x.trim(); }).filter(Boolean);
    if (f === 'left') q.pairs[j][0] = t.value;
    if (f === 'right') q.pairs[j][1] = t.value;
    if (f === 'item') q.items[j] = t.value;
  }

  function onClick(e) {
    var th = e.target.closest('[data-theme]');
    if (th) {
      D.theme = th.dataset.theme;
      $$('[data-theme]').forEach(function (b) { b.classList.toggle('on', b === th); });
      return;
    }
    var add = e.target.closest('[data-add]');
    if (add) {
      D.questions.push(newQuestion(add.dataset.add));
      drawQuestions();
      var cards = $$('.qedit');
      cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      cards[cards.length - 1].querySelector('textarea').focus({ preventScroll: true });
      return;
    }
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var card = b.closest('.qedit');
    var i = Number(card.dataset.qi);
    var q = D.questions[i];
    var j = Number(b.dataset.j);
    switch (b.dataset.act) {
      case 'up': D.questions.splice(i - 1, 0, D.questions.splice(i, 1)[0]); break;
      case 'down': D.questions.splice(i + 1, 0, D.questions.splice(i, 1)[0]); break;
      case 'dup': var c = JSON.parse(JSON.stringify(q)); c.id = U.uid(); D.questions.splice(i + 1, 0, c); break;
      case 'del':
        if (D.questions.length === 1) { U.toast('Minimal harus ada 1 soal.', 'err'); return; }
        D.questions.splice(i, 1); break;
      case 'addopt': q.options.push(''); break;
      case 'delopt':
        q.options.splice(j, 1);
        if (q.answer === j) q.answer = 0; else if (q.answer > j) q.answer--;
        break;
      case 'addpair': q.pairs.push(['', '']); break;
      case 'delpair': q.pairs.splice(j, 1); break;
      case 'additem': q.items.push(''); break;
      case 'delitem': q.items.splice(j, 1); break;
      case 'itemup': q.items.splice(j - 1, 0, q.items.splice(j, 1)[0]); break;
      default: return;
    }
    drawQuestions();
  }

  // Format teks cepat:
  //   Pertanyaan
  //   *Jawaban benar
  //   Pilihan lain
  //   (baris kosong untuk soal berikutnya)
  //   Baris "= jawaban" → isian singkat. Pilihan "Benar/Salah" → benar/salah.
  function bulkImport() {
    var m = U.modal('<h3>⚡ Impor soal cepat</h3><p class="muted small">Pisahkan tiap soal dengan baris kosong. Tandai jawaban benar dengan <b>*</b>. ' +
      'Untuk isian singkat, tulis kunci dengan awalan <b>=</b> (alternatif dipisah <b>;</b>).</p>' +
      '<textarea id="bt" rows="12" placeholder="Ibu kota Indonesia adalah…\n*Jakarta\nBandung\nSurabaya\nMedan\n\nMatahari terbit dari timur.\n*Benar\nSalah\n\nRumus kimia air adalah…\n= H2O"></textarea>' +
      '<div class="row end gap"><label class="switch"><input type="checkbox" id="brep"><span class="sw"></span><span>Ganti semua soal yang ada</span></label>' +
      '<button class="btn" id="bgo">Tambahkan</button></div>', { wide: true });
    $('#bgo', m.el).onclick = function () {
      var blocks = $('#bt', m.el).value.split(/\n\s*\n/).map(function (b) { return b.split('\n').map(function (l) { return l.trim(); }).filter(Boolean); }).filter(function (b) { return b.length; });
      var out = [], bad = 0;
      blocks.forEach(function (b) {
        var q = b[0], rest = b.slice(1);
        if (rest.length === 1 && rest[0].charAt(0) === '=') {
          out.push({ id: U.uid(), type: 'short', q: q, answers: rest[0].slice(1).split(';').map(function (x) { return x.trim(); }).filter(Boolean) });
          return;
        }
        var ans = -1;
        var opts = rest.map(function (o, i) { if (o.charAt(0) === '*') { ans = i; return o.slice(1).trim(); } return o; });
        if (opts.length < 2 || ans < 0) { bad++; return; }
        var low = opts.map(function (o) { return o.toLowerCase(); });
        if (opts.length === 2 && low.indexOf('benar') >= 0 && low.indexOf('salah') >= 0) {
          out.push({ id: U.uid(), type: 'tf', q: q, answer: low[ans] === 'benar' });
        } else {
          out.push({ id: U.uid(), type: 'mcq', q: q, options: opts.slice(0, 6), answer: ans < 6 ? ans : 0 });
        }
      });
      if (!out.length) { U.toast('Tidak ada soal yang terbaca. Periksa formatnya.', 'err'); return; }
      if ($('#brep', m.el).checked) D.questions = out;
      else {
        if (D.questions.length === 1 && !D.questions[0].q.trim()) D.questions = [];
        D.questions = D.questions.concat(out);
      }
      drawQuestions();
      m.close();
      U.toast(out.length + ' soal ditambahkan' + (bad ? ', ' + bad + ' dilewati (tanpa tanda *)' : '') + '.', bad ? '' : 'ok');
    };
  }

  function save() {
    var btn = $('#save');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    if (D.settings.openAt && D.settings.closeAt && Date.parse(D.settings.closeAt) <= Date.parse(D.settings.openAt)) {
      U.toast('Waktu tutup harus setelah waktu buka.', 'err');
      btn.disabled = false; btn.textContent = '💾 Simpan & Bagikan';
      return;
    }
    Api.call('saveGame', { game: D }).then(function (r) {
      var isNew = !D.code;
      D = r.game;
      cache.games = null;
      U.toast('Game tersimpan ✓', 'ok');
      U.sfx.correct();
      if (isNew) history.replaceState(null, '', '#/guru/edit/' + D.code);
      renderEditor();
      share(D);
    }).catch(function (err) {
      U.toast(err.message, 'err');
      btn.disabled = false; btn.textContent = '💾 Simpan & Bagikan';
    });
  }

  /* ================= BAGIKAN ================= */
  function share(g) {
    var link = Api.shareLink(g.code);
    var board = Api.shareLink(g.code, true);
    var wa = 'https://wa.me/?text=' + encodeURIComponent('🎮 Ayo main "' + g.title + '"!\nKode game: ' + g.code + '\nLink: ' + link);
    var m = U.modal('<div class="share"><h3>🔗 Bagikan ke siswa</h3>' +
      (Api.isLocal() ? '<div class="notice warn small">Mode Lokal: link hanya berfungsi di perangkat ini. Hubungkan Google Sheets di Pengaturan agar siswa bisa bermain dari HP masing-masing.</div>' : '') +
      '<div class="share-code"><small>KODE GAME</small><b>' + esc(g.code) + '</b></div>' +
      '<div id="qr" class="qr"></div>' +
      '<label>Link game<div class="copy-row"><input readonly value="' + esc(link) + '"><button class="btn small" data-copy="' + esc(link) + '">Salin</button></div></label>' +
      '<label>Link papan skor (untuk ditampilkan di proyektor)<div class="copy-row"><input readonly value="' + esc(board) + '"><button class="btn small" data-copy="' + esc(board) + '">Salin</button></div></label>' +
      '<div class="row gap wrap center"><a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">💬 Kirim via WhatsApp</a>' +
      '<a class="btn ghost" href="#/skor/' + esc(g.code) + '" target="_blank">🏆 Buka papan skor</a></div></div>');
    $$('[data-copy]', m.el).forEach(function (b) { b.onclick = function () { U.copy(b.dataset.copy); }; });
    if (window.QRCode) {
      try { new QRCode($('#qr', m.el), { text: link, width: 168, height: 168, correctLevel: QRCode.CorrectLevel.L }); } catch (e) { /* lewati QR */ }
    }
  }

  /* ================= REKAP NILAI ================= */
  function gamePicker(gs, code, base) {
    return '<select id="gpick" class="gpick"><option value="">— Pilih game —</option>' + gs.map(function (g) {
      return '<option value="' + esc(g.code) + '" ' + (g.code === code ? 'selected' : '') + '>' + esc(g.title) + ' · ' + esc(g.subject || '') + ' (' + esc(g.code) + ')</option>';
    }).join('') + '</select>';
  }

  function bindPicker(base) {
    $('#gpick').onchange = function (e) { location.hash = '#/guru/' + base + (e.target.value ? '/' + e.target.value : ''); };
  }

  function recap(code) {
    loadingMain('rekap');
    games().then(function (gs) {
      if (!code) {
        shell('rekap', '<div class="page-head"><div><h1>📋 Rekap Nilai</h1><p class="muted">Pilih game untuk melihat nilai siswa.</p></div></div>' +
          '<div class="card">' + gamePicker(gs, '') + '</div><div class="gcards">' + gs.map(gameCard).join('') + '</div>');
        bindPicker('rekap'); bindCards();
        return;
      }
      var g = gs.filter(function (x) { return x.code === code; })[0];
      if (!g) throw new Error('Game tidak ditemukan.');
      return Api.call('results', { code: code }).then(function (r) { recapView(gs, g, r.rows); });
    }).catch(fail);
  }

  function recapView(gs, g, rows) {
    var s = g.settings;
    var kkm = Number(s.kkm) || 75;
    var people = Logic.rank(Logic.counted(rows, s.scorePolicy));
    var classes = {};
    people.forEach(function (p) { classes[p.cls] = 1; });
    var f = { q: '', cls: '', sort: 'rank' };
    var policy = { best: 'nilai tertinggi', last: 'nilai terakhir', first: 'percobaan pertama' }[s.scorePolicy] || 'nilai tertinggi';
    shell('rekap', '<div class="page-head"><div><h1>📋 Rekap Nilai</h1><p class="muted">Nilai yang dipakai: <b>' + policy + '</b> · KKM ' + kkm + '</p></div>' +
      '<div class="row gap wrap">' + gamePicker(gs, g.code) + '</div></div>' +
      '<div class="toolbar card">' +
      '<input id="rq" placeholder="🔍 Cari nama / NIS…"><select id="rc"><option value="">Semua kelas</option>' +
      Object.keys(classes).sort().map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="rs"><option value="rank">Urut: peringkat</option><option value="name">Urut: nama</option><option value="cls">Urut: kelas</option><option value="low">Urut: nilai terendah</option></select>' +
      '<span class="grow"></span>' +
      '<button class="btn small ghost" id="xcsv">⬇️ CSV</button><button class="btn small ghost" id="xxls">⬇️ Excel</button>' +
      '<button class="btn small" id="xdrive">☁️ Simpan ke Google Drive</button><button class="btn small ghost" onclick="window.print()">🖨️ Cetak</button></div>' +
      '<div class="print-title"><h2>Rekap Nilai: ' + esc(g.title) + '</h2><p>' + esc(g.subject || '') + ' · Kode ' + esc(g.code) + ' · Dicetak ' + U.fmtDate(new Date().toISOString()) + '</p></div>' +
      '<div class="card table-card"><div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>NIS/Absen</th><th>Nilai</th><th>Keterangan</th>' +
      '<th>Benar</th><th>Percobaan</th><th>Durasi</th><th title="Jumlah keluar dari halaman game">⚠️</th><th>Terakhir</th><th class="no-print">Aksi</th></tr></thead><tbody id="rt"></tbody></table></div>' +
      '<p class="muted small" id="rsum"></p></div>');
    bindPicker('rekap');

    function visible() {
      var list = people.filter(function (p) {
        var t = (p.name + ' ' + p.sid).toLowerCase();
        return (!f.cls || p.cls === f.cls) && (!f.q || t.indexOf(f.q) >= 0);
      });
      if (f.sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      if (f.sort === 'cls') list.sort(function (a, b) { return a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name); });
      if (f.sort === 'low') list.sort(function (a, b) { return a.score - b.score; });
      return list;
    }
    function label(p) { return !p.finished ? 'Tidak selesai' : p.score >= kkm ? 'Tuntas' : 'Remedial'; }

    function draw() {
      var list = visible();
      $('#rt').innerHTML = list.map(function (p, i) {
        var l = label(p);
        return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.cls) + '</td><td>' + esc(p.sid) + '</td>' +
          '<td><span class="score-pill ' + (!p.finished ? 'na' : p.score >= kkm ? 'ok' : 'bad') + '">' + (p.finished ? p.score : '-') + '</span></td>' +
          '<td>' + l + '</td><td>' + p.correct + '/' + p.total + '</td><td>' + p.attempts + (s.maxAttempts ? '/' + s.maxAttempts : '') + '</td>' +
          '<td>' + U.fmtTime(p.durationSec) + '</td><td class="' + (p.violations ? 'txt-bad' : '') + '">' + p.violations + '</td>' +
          '<td class="small">' + U.fmtDate(p.finishedAt) + '</td>' +
          '<td class="no-print"><button class="icon-btn" data-d="' + esc(p.key) + '" title="Detail percobaan">👁️</button>' +
          '<button class="icon-btn" data-r="' + esc(p.key) + '" title="Reset kesempatan">🔁</button></td></tr>';
      }).join('') || '<tr><td colspan="12" class="center muted">Belum ada data.</td></tr>';
      var done = list.filter(function (p) { return p.finished; });
      $('#rsum').textContent = list.length + ' siswa · ' + done.filter(function (p) { return p.score >= kkm; }).length + ' tuntas · ' +
        done.filter(function (p) { return p.score < kkm; }).length + ' remedial · rata-rata ' +
        (done.length ? Math.round(Analytics.mean(done.map(function (p) { return p.score; })) * 10) / 10 : 0);
    }

    $('#rq').oninput = function (e) { f.q = e.target.value.toLowerCase(); draw(); };
    $('#rc').onchange = function (e) { f.cls = e.target.value; draw(); };
    $('#rs').onchange = function (e) { f.sort = e.target.value; draw(); };
    $('#rt').onclick = function (e) {
      var d = e.target.closest('[data-d]'), r = e.target.closest('[data-r]');
      if (d) attemptsModal(g, rows.filter(function (x) { return x.key === d.dataset.d; }));
      if (r) {
        var p = people.filter(function (x) { return x.key === r.dataset.r; })[0];
        U.confirm('Reset semua percobaan ' + p.name + '? Nilainya akan dihapus dan siswa bisa mengerjakan dari awal.', 'Reset').then(function (ok) {
          if (!ok) return;
          Api.call('resetAttempts', { code: g.code, studentKey: p.key }).then(function () { U.toast('Kesempatan direset ✓', 'ok'); recap(g.code); }).catch(fail);
        });
      }
    };

    function table() {
      var head = ['No', 'Nama', 'Kelas', 'NIS/Absen', 'Nilai', 'Keterangan', 'Benar', 'Jumlah Soal', 'Percobaan', 'Durasi (detik)', 'Pelanggaran', 'Waktu Selesai'];
      return [head].concat(visible().map(function (p, i) {
        return [i + 1, p.name, p.cls, p.sid, p.finished ? p.score : '', label(p), p.correct, p.total, p.attempts, p.durationSec, p.violations, U.fmtDate(p.finishedAt)];
      }));
    }
    var fname = 'rekap-' + slug(g.title) + '-' + g.code;
    $('#xcsv').onclick = function () { U.download(fname + '.csv', U.csv(table()), 'text/csv;charset=utf-8'); };
    $('#xxls').onclick = function () { U.download(fname + '.xls', U.excel('Rekap Nilai ' + g.title, table()), 'application/vnd.ms-excel'); };
    $('#xdrive').onclick = function () {
      if (Api.isLocal()) {
        U.modal('<h3>☁️ Simpan ke Google Drive</h3><p>Fitur ini membuat file Google Sheets rekap (lengkap dengan diagram) langsung di folder <b>"Rekap Game Belajar"</b> di Drive Anda.</p>' +
          '<p>Saat ini aplikasi masih di <b>Mode Lokal</b>. Hubungkan dulu ke Google Sheets di menu <a href="#/guru/pengaturan">Pengaturan</a> (sekitar 10 menit, cukup sekali).</p>' +
          '<p class="muted small">Alternatif: unduh CSV/Excel lalu unggah manual ke Google Drive.</p>');
        return;
      }
      var b = $('#xdrive');
      b.disabled = true; b.textContent = 'Menyimpan ke Drive…';
      Api.call('exportDrive', { code: g.code }).then(function (r) {
        b.disabled = false; b.textContent = '☁️ Simpan ke Google Drive';
        U.modal('<div class="center-box"><div class="big-emoji">✅</div><h3>Tersimpan di Google Drive!</h3><p>File rekap beserta diagram dan analisis soal tersimpan di folder <b>Rekap Game Belajar</b>.</p>' +
          '<a class="btn glow" href="' + esc(r.url) + '" target="_blank" rel="noopener">Buka file di Google Sheets ↗</a></div>');
      }).catch(function (err) { b.disabled = false; b.textContent = '☁️ Simpan ke Google Drive'; fail(err); });
    };
    draw();
  }

  function attemptsModal(g, list) {
    list = list.slice().sort(function (a, b) { return a.attempt - b.attempt; });
    var p = list[0];
    U.modal('<h3>' + esc(p.name) + ' <small class="muted">' + esc(p.cls) + ' · ' + esc(p.sid) + '</small></h3>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Ke-</th><th>Status</th><th>Nilai</th><th>Benar</th><th>Durasi</th><th>⚠️</th><th>Mulai</th></tr></thead><tbody>' +
      list.map(function (r) {
        return '<tr><td>' + r.attempt + '</td><td>' + (r.status === 'done' ? '✅ Selesai' : '⏸️ Tidak selesai') + '</td><td>' + (r.status === 'done' ? r.score : '-') + '</td>' +
          '<td>' + r.correct + '/' + r.total + '</td><td>' + U.fmtTime(r.durationSec) + '</td><td>' + r.violations + '</td><td class="small">' + U.fmtDate(r.startedAt) + '</td></tr>';
      }).join('') + '</tbody></table></div>', { wide: true });
  }

  /* ================= ANALISIS PER GAME ================= */
  function analysis(code) {
    loadingMain('analisis');
    games().then(function (gs) {
      if (!code) {
        shell('analisis', '<div class="page-head"><div><h1>📊 Analisis Nilai</h1><p class="muted">Pilih game untuk melihat diagram, analisis soal, dan rekomendasi tindakan.</p></div>' +
          '<a class="btn" href="#/guru/kemajuan">📈 Lihat kemajuan lintas game</a></div><div class="card">' + gamePicker(gs, '') + '</div>' +
          '<div class="gcards">' + gs.map(gameCard).join('') + '</div>');
        bindPicker('analisis'); bindCards();
        return;
      }
      var g = gs.filter(function (x) { return x.code === code; })[0];
      if (!g) throw new Error('Game tidak ditemukan.');
      return Api.call('results', { code: code }).then(function (r) { analysisView(gs, g, r.rows, ''); });
    }).catch(fail);
  }

  function analysisView(gs, g, rows, cls) {
    var A = Analytics.game(g, rows, cls);
    var classes = {};
    rows.forEach(function (r) { classes[r.cls] = 1; });
    var advice = Analytics.gameAdvice(A, g);
    var kkm = A.kkm;
    var colorScore = function (v) { return v >= kkm ? '#22c55e' : v >= kkm - 15 ? '#f59e0b' : '#ef4444'; };
    shell('analisis', '<div class="page-head"><div><h1>📊 Analisis: ' + esc(g.title) + '</h1><p class="muted">' + esc(g.subject || '') + ' · KKM ' + kkm + ' · ' + A.n + ' siswa selesai</p></div>' +
      '<div class="row gap wrap no-print">' + gamePicker(gs, g.code) +
      '<select id="acls"><option value="">Semua kelas</option>' + Object.keys(classes).sort().map(function (c) { return '<option ' + (c === cls ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<button class="btn ghost" onclick="window.print()">🖨️ Cetak laporan</button></div></div>' +

      '<div class="kpis">' + kpi('👥', A.n, 'Siswa selesai') + kpi('📈', A.avg, 'Rata-rata') + kpi('🎯', A.median, 'Median') +
      kpi('🏔️', A.max, 'Tertinggi') + kpi('🔻', A.min, 'Terendah') + kpi('📏', A.sd, 'Simpangan baku') + kpi('✅', A.passRate + '%', 'Ketuntasan') + '</div>' +

      '<section class="card advice"><h3>🧭 Kesimpulan & rekomendasi tindakan guru</h3>' + adviceHtml(advice) + '</section>' +

      '<div class="grid2">' +
      '<section class="card"><h3>🍩 Ketuntasan</h3>' + Charts.donut([
        { label: 'Tuntas (≥ ' + kkm + ')', value: A.passN, color: '#22c55e' },
        { label: 'Remedial', value: A.n - A.passN, color: '#ef4444' },
        { label: 'Tidak selesai', value: A.unfinished, color: '#94a3b8' }], A.passRate + '%', 'tuntas') + '</section>' +
      '<section class="card"><h3>📶 Sebaran nilai</h3>' + Charts.bar({
        labels: A.bins.map(function (b) { return b.label; }), values: A.bins.map(function (b) { return b.count; }),
        colors: function (v, i) { return colorScore(A.bins[i].lo + 9); }, suffix: ' siswa', aria: 'Sebaran nilai' }) + '</section>' +
      '</div>' +

      (A.classes.length > 1 ? '<section class="card"><h3>🏫 Rata-rata per kelas</h3>' + Charts.hbar(A.classes.map(function (c) {
        return { label: c.cls, value: c.avg, sub: c.pass + '/' + c.n + ' tuntas' };
      }), 100, colorScore) + '</section>' : '') +

      '<section class="card"><h3>🔬 Analisis butir soal (% siswa menjawab benar)</h3>' + Charts.bar({
        labels: A.items.map(function (it) { return 'S' + it.no; }), values: A.items.map(function (it) { return it.pct || 0; }), max: 100,
        titles: A.items.map(function (it) { return 'Soal ' + it.no + ' — ' + it.q.q.slice(0, 60); }),
        colors: function (v) { return v < 30 ? '#ef4444' : v <= 70 ? '#f59e0b' : '#22c55e'; }, suffix: '%', ref: { value: 40, label: 'batas 40%' }, aria: 'Persentase benar per soal' }) +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>No</th><th>Pertanyaan</th><th>Jenis</th><th>% Benar</th><th>Kesukaran</th><th>Daya pembeda</th></tr></thead><tbody>' +
      A.items.map(function (it) {
        return '<tr><td>' + it.no + '</td><td>' + esc(it.q.q) + '</td><td>' + QTYPES[it.q.type].icon + '</td><td><b>' + (it.pct === null ? '-' : it.pct + '%') + '</b></td>' +
          '<td><span class="badge ' + ({ Sukar: 'bad', Sedang: 'warn', Mudah: 'ok' }[it.level] || '') + '">' + it.level + '</span></td>' +
          '<td>' + (it.D === null ? '<span class="muted small">min. 6 siswa</span>' : it.D + ' · ' + it.dLabel) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +

      '<div class="grid3">' +
      listCard('🩹 Perlu remedial', A.remedial, 'Semua siswa sudah tuntas 🎉') +
      listCard('🚀 Siap pengayaan (≥ 90)', A.enrich, 'Belum ada') +
      listCard('🕵️ Perlu verifikasi', A.suspicious, 'Tidak ada indikasi kecurangan', true) +
      '</div>');
    bindPicker('analisis');
    $('#acls').onchange = function (e) { analysisView(gs, g, rows, e.target.value); };
  }

  function adviceHtml(list) {
    return '<div class="advice-list">' + list.map(function (a) {
      return '<div class="adv ' + a.t + '"><b>' + esc(a.h) + '</b><p>' + esc(a.p) + '</p></div>';
    }).join('') + '</div>';
  }

  function listCard(title, list, emptyMsg, showViol) {
    return '<section class="card"><h3>' + title + ' <span class="muted">(' + list.length + ')</span></h3>' +
      (list.length ? '<ul class="plist">' + list.map(function (p) {
        return '<li><span>' + esc(p.name) + ' <small class="muted">' + esc(p.cls) + '</small></span><b>' + p.score + '</b>' +
          (showViol ? '<small class="muted">⚠️' + p.violations + ' · ' + U.fmtTime(p.durationSec) + '</small>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="muted">' + emptyMsg + '</p>') + '</section>';
  }

  /* ================= KEMAJUAN LINTAS GAME ================= */
  function progressView() {
    loadingMain('analisis');
    Promise.all([games(true), Api.call('results')]).then(function (res) {
      var gs = res[0], rows = res[1].rows;
      var subjects = {}, classes = {};
      gs.forEach(function (g) { subjects[g.subject || 'Umum'] = 1; });
      rows.forEach(function (r) { classes[r.cls] = 1; });
      var f = { subj: Object.keys(subjects).sort()[0] || '', cls: '' };

      function draw() {
        var list = gs.filter(function (g) { return !f.subj || (g.subject || 'Umum') === f.subj; });
        var P = Analytics.progress(list, rows, f.cls);
        var kkm = P.perGame.length ? P.perGame[P.perGame.length - 1].kkm : 75;
        $('#pbody').innerHTML =
          '<section class="card advice"><h3>🧭 Kesimpulan & rekomendasi</h3>' + adviceHtml(Analytics.progressAdvice(P)) + '</section>' +
          '<section class="card"><h3>📈 Tren rata-rata & ketuntasan per game</h3>' + Charts.line({
            labels: P.perGame.map(function (x) { return x.game.title; }),
            series: [{ name: 'Rata-rata nilai', color: '#6366f1', values: P.perGame.map(function (x) { return x.avg; }) },
              { name: '% Ketuntasan', color: '#22c55e', values: P.perGame.map(function (x) { return x.passRate; }) }],
            max: 100, ref: { value: kkm, label: 'KKM ' + kkm } }) +
          '<ul class="legend inline"><li><i style="background:#6366f1"></i>Rata-rata nilai</li><li><i style="background:#22c55e"></i>% Ketuntasan</li></ul></section>' +
          '<section class="card"><h3>🧑‍🎓 Perkembangan tiap siswa</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Kelas</th><th>Game</th>' +
          '<th>Nilai awal</th><th>Nilai terakhir</th><th>Perubahan</th><th>Rata-rata</th><th>Riwayat</th><th>Tren</th></tr></thead><tbody>' +
          P.students.map(function (st) {
            var spark = st.scores.map(function (x) {
              return '<i style="height:' + Math.max(4, x.score * 0.28) + 'px;background:' + (x.score >= x.kkm ? '#22c55e' : '#ef4444') + '" title="' + esc(x.title + ': ' + x.score) + '"></i>';
            }).join('');
            return '<tr><td><b>' + esc(st.name) + '</b></td><td>' + esc(st.cls) + '</td><td>' + st.scores.length + '</td><td>' + st.first + '</td><td>' + st.last + '</td>' +
              '<td class="' + (st.delta > 0 ? 'txt-ok' : st.delta < 0 ? 'txt-bad' : '') + '">' + (st.delta > 0 ? '▲ +' : st.delta < 0 ? '▼ ' : '') + st.delta + '</td>' +
              '<td>' + st.avg + '</td><td><span class="spark">' + spark + '</span></td>' +
              '<td><span class="badge ' + ({ Meningkat: 'ok', Menurun: 'bad', Stabil: '' }[st.trend] || '') + '">' + st.trend + '</span></td></tr>';
          }).join('') + '</tbody></table></div>' + (P.students.length ? '' : '<p class="muted">Belum ada data.</p>') + '</section>';
      }

      shell('analisis', '<div class="page-head"><div><h1>📈 Kemajuan Siswa</h1><p class="muted">Bandingkan hasil antar-game (diurutkan berdasarkan tanggal dibuat) untuk melihat perkembangan belajar.</p></div>' +
        '<div class="row gap wrap no-print"><select id="psub"><option value="">Semua mapel</option>' + Object.keys(subjects).sort().map(function (s) {
          return '<option ' + (s === f.subj ? 'selected' : '') + '>' + esc(s) + '</option>';
        }).join('') + '</select><select id="pcls"><option value="">Semua kelas</option>' + Object.keys(classes).sort().map(function (c) {
          return '<option>' + esc(c) + '</option>';
        }).join('') + '</select><button class="btn ghost" onclick="window.print()">🖨️ Cetak</button></div></div><div id="pbody"></div>');
      $('#psub').onchange = function (e) { f.subj = e.target.value; draw(); };
      $('#pcls').onchange = function (e) { f.cls = e.target.value; draw(); };
      draw();
    }).catch(fail);
  }

  /* ================= PENGATURAN ================= */
  function settings() {
    var local = Api.isLocal();
    shell('pengaturan', '<div class="page-head"><div><h1>⚙️ Pengaturan</h1><p class="muted">Hubungkan aplikasi ke Google Sheets agar siswa bisa bermain dari mana saja dan rekap tersimpan di Google Drive.</p></div></div>' +
      '<section class="card"><h3>☁️ Server Google Sheets (Google Apps Script)</h3>' +
      '<p>Status: <b>' + (local ? '💻 Mode Lokal (belum terhubung)' : '☁️ Terhubung ke Google Sheets') + '</b></p>' +
      '<label>URL Web App<input id="surl" value="' + esc(Api.url()) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
      '<div class="row gap wrap"><button class="btn" id="stest">🔌 Uji koneksi</button><button class="btn glow" id="ssave">💾 Simpan</button>' +
      (local ? '' : '<button class="btn ghost" id="sclear">Kembali ke Mode Lokal</button>') + '</div></section>' +

      '<section class="card guide"><h3>📘 Cara menghubungkan (sekali saja, ±10 menit)</h3><ol>' +
      '<li>Buka <a href="https://sheets.new" target="_blank" rel="noopener">sheets.new</a> untuk membuat Google Sheets baru, beri nama misalnya <b>Database Game Belajar</b>.</li>' +
      '<li>Klik menu <b>Ekstensi → Apps Script</b>.</li>' +
      '<li>Hapus kode bawaan, lalu salin seluruh isi file <a href="backend/Code.gs" target="_blank">backend/Code.gs</a> dan tempelkan.</li>' +
      '<li>Buka <b>Project Settings</b> (ikon ⚙️ di kiri) → <b>Script Properties</b> → <b>Add script property</b>. Isi <i>Property</i>: <code>TEACHER_KEY</code> dan <i>Value</i>: kata sandi Anda, lalu <b>Save</b>. Kata sandi tidak ditulis di kode.</li>' +
      '<li>Klik <b>Terapkan → Deployment baru</b> → pilih jenis <b>Aplikasi web</b>. Setel <i>Jalankan sebagai:</i> <b>Saya</b>, <i>Yang memiliki akses:</i> <b>Siapa saja</b>. Klik <b>Terapkan</b> dan izinkan aksesnya.</li>' +
      '<li>Salin <b>URL aplikasi web</b> (berakhiran <code>/exec</code>), tempel di kolom di atas, lalu klik <b>Simpan</b>.</li>' +
      '<li>Keluar lalu masuk lagi menggunakan kata sandi yang Anda isi pada <b>TEACHER_KEY</b>.</li></ol>' +
      '<p class="muted small">Semua nilai tersimpan di Google Sheets tersebut (lembar <b>Results</b>), dan tombol "Simpan ke Google Drive" di Rekap membuat file rekap lengkap dengan diagram di folder <b>Rekap Game Belajar</b>. ' +
      'Jika Anda mengubah Code.gs, buat ulang deployment melalui <b>Terapkan → Kelola deployment → Edit → Versi baru</b>.</p></section>' +

      (local ? '<section class="card"><h3>💾 Cadangan data Mode Lokal</h3><p class="muted">Pindahkan data lokal ke perangkat lain atau simpan sebagai cadangan.</p>' +
        '<div class="row gap wrap"><button class="btn ghost" id="bk">⬇️ Unduh cadangan</button><label class="btn ghost">⬆️ Pulihkan cadangan<input type="file" accept=".json" id="rs" hidden></label>' +
        '<button class="btn ghost" id="pin">🔑 Ganti PIN</button></div>' +
        '<p class="muted small">Untuk memindahkan game ke Google Sheets: Aktivitas Saya → Ekspor semua, hubungkan Google Sheets, lalu Impor file tersebut.</p></section>' : ''));

    $('#stest').onclick = function () {
      var u = $('#surl').value.trim();
      if (!u) { U.toast('Isi URL terlebih dahulu.', 'err'); return; }
      Api.call('ping', {}, u).then(function () { U.toast('Koneksi berhasil ✓', 'ok'); }).catch(function (e) { U.toast(e.message, 'err'); });
    };
    $('#ssave').onclick = function () {
      var u = $('#surl').value.trim();
      if (u && !/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) { U.toast('URL harus berasal dari script.google.com', 'err'); return; }
      Api.setUrl(u); Api.setAuth(''); cache.games = null;
      U.toast('Tersimpan. Silakan masuk kembali.', 'ok');
      route('');
    };
    var c = $('#sclear');
    if (c) c.onclick = function () { Api.setUrl(''); Api.setAuth(''); cache.games = null; route(''); };
    var bk = $('#bk');
    if (bk) bk.onclick = function () { U.download('cadangan-game-belajar.json', JSON.stringify(LocalDB.backup()), 'application/json'); };
    var rs = $('#rs');
    if (rs) rs.onchange = function (e) {
      U.readFile(e.target.files[0]).then(function (t) {
        LocalDB.restore(JSON.parse(t)); cache.games = null; U.toast('Data dipulihkan ✓', 'ok');
      }).catch(function (err) { U.toast(err.message, 'err'); });
    };
    var pin = $('#pin');
    if (pin) pin.onclick = function () {
      var m = U.modal('<h3>Ganti PIN</h3><input type="password" id="np" minlength="4" placeholder="PIN baru"><div class="row end"><button class="btn" id="npok">Simpan</button></div>');
      $('#npok', m.el).onclick = function () {
        var v = $('#np', m.el).value;
        if (v.length < 4) { U.toast('Minimal 4 karakter.', 'err'); return; }
        LocalDB.setPin(v); Api.setAuth(v); m.close(); U.toast('PIN diganti ✓', 'ok');
      };
    };
  }

  return { route: route };
})();
