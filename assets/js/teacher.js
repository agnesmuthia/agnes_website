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
      (sessionStorage.getItem('gb_temail') ? '<div class="who small" title="Masuk dengan Gmail">👤 ' + esc(sessionStorage.getItem('gb_temail')) + '</div>' : '') +
      '<button class="btn small ghost full" id="logout">Keluar</button></div></aside>' +
      '<main class="main" id="main">' +
      (Api.isLocal() && active !== 'pengaturan' ? '<div class="notice warn">💻 <span><b>Mode Lokal:</b> data hanya tersimpan di browser ini, sehingga siswa belum bisa bermain dari perangkat lain. ' +
        '<a href="#/guru/pengaturan">Hubungkan ke Google Sheets</a> agar bisa dibagikan dan rekap tersimpan di Google Drive.</span></div>' : '') +
      (Api.backendOutdated() ? '<div class="notice warn">⚙️ <span><b>Backend perlu diperbarui:</b> Code.gs di Google Apps Script masih versi ' +
        Api.backendVersion() + ', aplikasi membutuhkan versi ' + Api.REQUIRED_BACKEND + '. Fitur folder Drive, login Google siswa, dan simpan otomatis belum aktif. ' +
        '<a href="#/guru/pengaturan">Lihat cara memperbarui</a>.</span></div>' : '') +
      content + '</main></div>';
    $('#logout').onclick = function () {
      if (Api.auth().indexOf('gs_') === 0) Api.call('logout').catch(function () { /* sesi tetap kedaluwarsa sendiri */ });
      Api.setAuth(''); sessionStorage.removeItem('gb_temail'); cache.games = null; location.hash = '#/';
    };
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

  // Tombol "Masuk dengan Google" untuk guru. Dipakai di halaman masuk guru dan halaman awal.
  function mountGoogleButton(el, clientId, onDone) {
    return U.loadGis().then(function () {
      window.google.accounts.id.initialize({
        client_id: clientId, auto_select: false,
        callback: function (resp) {
          Api.call('teacherGoogle', { idToken: resp.credential }).then(function (res) {
            Api.setAuth(res.session);
            sessionStorage.setItem('gb_temail', res.email);
            return Api.call('ping');
          }).then(function (p) {
            if (!p.teacher) throw new Error('Sesi tidak valid, coba lagi.');
            onDone(p);
          }).catch(function (err) { Api.setAuth(''); sessionStorage.removeItem('gb_temail'); U.toast(err.message, 'err'); });
        }
      });
      window.google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', width: 280 });
    });
  }

  /* ================= LOGIN GURU ================= */
  function login() {
    var local = Api.isLocal();
    var needPin = local && !LocalDB.hasPin();
    root().innerHTML = Student.themed('galaxy',
      '<header class="topbar"><a class="logo" href="#/">🎮 <b>Game</b>Belajar</a></header>' +
      '<form class="card glass login-card" id="tl"><div class="big-emoji">👩‍🏫</div>' +
      '<h2>' + (needPin ? 'Buat PIN Guru' : 'Masuk sebagai Guru') + '</h2>' +
      (local ? '' : '<div id="tgoogle" class="tgoogle" hidden><div id="tgbtn"></div><div class="or"><span>atau masuk dengan kata sandi</span></div></div>') +
      '<p class="muted">' + (needPin ? 'Buat PIN untuk melindungi dasbor di perangkat ini (Mode Lokal).'
        : local ? 'Masukkan PIN guru perangkat ini.' : 'Masukkan kata sandi guru (TEACHER_KEY di Google Apps Script).') + '</p>' +
      '<input type="password" name="k" required minlength="4" placeholder="' + (needPin ? 'PIN baru (min. 4 karakter)' : 'Kata sandi / PIN') + '" autocomplete="current-password">' +
      (needPin ? '<input type="password" name="k2" required minlength="4" placeholder="Ulangi PIN">' : '') +
      '<button class="btn big glow full">Masuk</button>' +
      '<p class="small muted">Server: ' + (local ? 'Mode Lokal (browser ini)' : 'Google Sheets') + ' · <a href="#/guru/pengaturan" id="toset">ubah</a></p></form>');
    $('#toset').onclick = function (e) { e.preventDefault(); settingsPublic(); };
    function enter(r) {
      Api.setBackendInfo(r);
      U.toast('Selamat datang! 👋', 'ok');
      route(location.hash.replace(/^#\/guru\/?/, ''));
    }
    if (!local) {
      Api.call('ping').then(function (r) {
        if (!r.googleClientId || !$('#tgoogle')) return;
        $('#tgoogle').hidden = false;
        return mountGoogleButton($('#tgbtn'), r.googleClientId, enter);
      }).catch(function () { /* tombol Google tidak ditampilkan */ });
    }
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
        sessionStorage.removeItem('gb_temail');
        enter(r);
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
    if (!Api.isLocal() && !Api.backendVersion()) {
      Api.call('ping').then(function (r) { Api.setBackendInfo(r); route(path); }).catch(function () { Api.setBackendInfo({ version: 1 }); route(path); });
      return;
    }
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
      '<div class="gc-meta"><span class="chip">' + esc(g.subject || 'Umum') + '</span>' + (g.cls ? '<span class="chip">' + esc(g.cls) + '</span>' : '') +
      '<span class="chip">' + (MODES[g.mode] || MODES.classic).icon + ' ' + esc((MODES[g.mode] || MODES.classic).name) + '</span></div>' +
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
      '<h3>🎮 Jenis permainan</h3><p class="muted small">Setiap jenis punya cara main yang berbeda. Klik untuk membuat game baru dengan jenis tersebut.</p>' +
      '<div class="mode-pick gallery">' + Object.keys(MODES).map(function (k) {
        return '<a class="mode-card" href="#/guru/buat/mode-' + k + '"><span>' + MODES[k].icon + '</span><b>' + MODES[k].name + '</b><small>' + MODES[k].desc + '</small></a>';
      }).join('') + '</div>' +
      '<h3>🌈 Tema visual</h3><div class="theme-row">' + Object.keys(THEMES).map(function (k) {
        return '<div class="theme-swatch theme-' + k + '"><span>' + THEMES[k].icon + '</span><b>' + THEMES[k].name + '</b><small>' + THEMES[k].desc + '</small></div>';
      }).join('') + '</div>' +
      '<h3>📚 Template siap pakai</h3><div class="gcards">' + TEMPLATES.map(function (t) {
        var types = {};
        t.questions.forEach(function (q) { types[q.type] = 1; });
        var md = MODES[t.mode] || MODES.classic;
        return '<article class="gcard tpl theme-' + t.theme + '"><div class="gc-top"><span class="gc-icon">' + md.icon + '</span><span class="badge">' + (t.exam ? '📝 Mode Ujian' : esc(md.name)) + '</span></div>' +
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
      code: '', title: '', subject: 'Matematika', cls: '', description: '', theme: 'galaxy', mode: 'classic',
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
    if (type === 'group') q.groups = [{ name: '', items: [] }, { name: '', items: [] }];
    if (type === 'word') q.answer = '';
    if (type === 'cloze') { q.text = ''; q.extra = []; }
    if (type === 'multi') q.items = [['', true], ['', false], ['', false], ['', false]];
    if (type === 'wordsearch') q.words = [];
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
        d.mode = MODES[d.mode] ? d.mode : 'classic';
        delete d.participants; delete d.status;
        return d;
      });
    } else if (tpl === 'impor' && D) {
      p = Promise.resolve(D);
    } else if (tpl && tpl.indexOf('mode-') === 0) {
      var nb = blankGame(), mk = tpl.slice(5);
      if (MODES[mk]) { nb.mode = mk; nb.questions = [newQuestion(MODES[mk].types[0])]; }
      p = Promise.resolve(nb);
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

      '<section class="card"><h3>🎮 Jenis permainan</h3><p class="muted small">Pilih cara bermain. Setiap jenis punya tampilan dan tantangan berbeda.</p>' +
      '<div class="mode-pick">' + Object.keys(MODES).map(function (k) {
        return '<button type="button" class="mode-card' + (D.mode === k ? ' on' : '') + '" data-mode="' + k + '"><span>' + MODES[k].icon + '</span><b>' + MODES[k].name + '</b><small>' + MODES[k].desc + '</small></button>';
      }).join('') + '</div><div id="modeNote"></div></section>' +

      '<section class="card"><h3>🌈 Tema tampilan</h3><div class="theme-pick">' + Object.keys(THEMES).map(function (k) {
        return '<button type="button" class="theme-swatch theme-' + k + (D.theme === k ? ' on' : '') + '" data-theme="' + k + '"><span>' + THEMES[k].icon + '</span><b>' + THEMES[k].name + '</b></button>';
      }).join('') + '</div></section>' +

      '<section class="card"><div class="row between wrap gap"><h3>❓ Soal <span class="muted" id="qcount"></span></h3>' +
      '<button class="btn small ghost" id="bulk">⚡ Impor soal cepat (teks)</button></div>' +
      '<div id="qlist"></div>' +
      '<div class="add-q" id="addq"></div></section>' +
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
      '<label>Cara login siswa<select data-s="loginMode">' +
      [['form', '📝 Formulir (nama, kelas, NIS)'], ['google', '🔐 Akun Google (Gmail)']].map(function (o) {
        return '<option value="' + o[0] + '" ' + ((s.loginMode || 'form') === o[0] ? 'selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select><small>' + loginHelp() + '</small></label>' +
      '<label id="domWrap" ' + (s.loginMode === 'google' ? '' : 'hidden') + '>Batasi domain email (opsional)' +
      '<input data-s="allowedDomain" maxlength="60" value="' + esc(s.allowedDomain || '') + '" placeholder="kosongkan = semua akun Google">' +
      '<small>Contoh: <code>sma.belajar.id</code>. Kosongkan agar semua akun Gmail bisa masuk.</small></label>' +
      toggle('active', 'Game aktif (bisa dimainkan)') +
      toggle('shuffleQuestions', 'Acak urutan soal') +
      toggle('shuffleOptions', 'Acak pilihan jawaban') +
      toggle('showFeedback', 'Tampilkan benar/salah langsung', 'Matikan untuk ulangan resmi: kunci jawaban tidak dikirim ke perangkat siswa.') +
      toggle('showLeaderboard', 'Tampilkan papan skor ke siswa') +
      toggle('powerUps', 'Aktifkan power-up (50:50 & +15 detik)') +
      '</section></aside></div>');

    drawQuestions();
    drawModeExtras();

    var main = $('#main');
    main.addEventListener('input', onEdit);
    main.addEventListener('change', onEdit);
    main.addEventListener('click', onClick);
    $('#save').onclick = save;
    $('#bulk').onclick = bulkImport;
    $('#preview').onclick = function () {
      var q0 = D.questions.filter(function (q) { return q.type === 'mcq'; })[0];
      var opts = q0 ? q0.options.filter(function (o) { return o.trim(); }) : [];
      if (opts.length < 2) opts = ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'];
      var md = MODES[D.mode] || MODES.classic;
      U.modal('<div class="preview-frame">' + Student.themed(D.theme, '<div class="play"><div class="qcard pop"><div class="qtype">' + md.icon + ' ' + esc(md.name) + '</div>' +
        '<h2 class="qtext">' + esc((q0 && q0.q) || (D.questions[0] && D.questions[0].q) || 'Contoh pertanyaan') + '</h2></div><div class="answers"><div class="opts n' + Math.min(opts.length, 6) + '">' +
        opts.slice(0, 6).map(function (x, i) { return '<button class="opt c' + i + '"><span class="shape">' + ['▲', '◆', '●', '■', '★', '⬟'][i] + '</span><span class="ot">' + esc(x) + '</span></button>'; }).join('') +
        '</div></div></div>') + '</div>', { wide: true });
    };
  }

  function drawModeExtras() {
    var md = MODES[D.mode] || MODES.classic;
    var rec = md.types, others = ALL_TYPES.filter(function (k) { return rec.indexOf(k) < 0; });
    $('#addq').innerHTML = '<span>Tambah soal:</span>' + rec.map(function (k) {
      return '<button type="button" class="btn small" data-add="' + k + '">' + QTYPES[k].icon + ' ' + QTYPES[k].name + '</button>';
    }).join('') + (others.length ? '<details class="more-types"><summary>Jenis lain</summary>' + others.map(function (k) {
      return '<button type="button" class="btn small ghost" data-add="' + k + '">' + QTYPES[k].icon + ' ' + QTYPES[k].name + '</button>';
    }).join('') + '<small class="muted">Soal jenis lain tetap bisa dimainkan dengan tampilan standar.</small></details>' : '');
    var note = '';
    if (md.reveal) {
      note += '<div class="notice warn small">🎓 <span><b>Mode latihan:</b> ' + esc(md.name) + ' membutuhkan kunci jawaban di perangkat siswa agar bisa dimainkan. ' +
        'Cocok untuk latihan; untuk ulangan resmi gunakan <b>Kuis Klasik</b> dengan "Tampilkan benar/salah langsung" dimatikan.</span></div>';
    }
    var odd = D.questions.filter(function (q) { return rec.indexOf(q.type) < 0; });
    if (odd.length) {
      note += '<div class="notice small">ℹ️ <span>' + odd.length + ' soal bukan jenis ' + esc(rec.map(function (k) { return QTYPES[k].name; }).join(' / ')) +
        '. Soal tersebut tetap dimainkan dengan tampilan standar.</span></div>';
    }
    $('#modeNote').innerHTML = note;
  }

  function loginHelp() {
    if (Api.isLocal()) return '⚠️ Login Google hanya berfungsi jika aplikasi terhubung ke Google Sheets.';
    if (Api.backendOutdated()) return '⚠️ Perbarui Code.gs dulu agar login Google bisa dipakai.';
    if (!Api.googleLoginReady()) return '⚠️ Isi Client ID Google di menu <a href="#/guru/pengaturan">Pengaturan</a> agar login Google aktif.';
    return 'Akun Google membuat identitas siswa terverifikasi; kesempatan dihitung per email. Tentukan sebelum siswa mulai bermain.';
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
      } else if (q.type === 'group') {
        body = '<div class="grp-edit">' + q.groups.map(function (g, j) {
          return '<div class="ge c' + j + '"><div class="pr"><input data-f="gname" data-j="' + j + '" value="' + esc(g.name) + '" placeholder="Nama kelompok ' + (j + 1) + '">' +
            (q.groups.length > 2 ? '<button type="button" class="x" data-act="delgroup" data-j="' + j + '" aria-label="Hapus kelompok">✕</button>' : '') + '</div>' +
            '<textarea data-f="gitems" data-j="' + j + '" rows="' + Math.max(3, g.items.length + 1) + '" placeholder="Satu item per baris">' + esc(g.items.join('\n')) + '</textarea></div>';
        }).join('') + '</div>' + (q.groups.length < 4 ? '<button type="button" class="link" data-act="addgroup">+ Tambah kelompok</button>' : '');
      } else if (q.type === 'word') {
        body = '<label>Kata jawaban<input data-f="wanswer" maxlength="40" value="' + esc(q.answer || '') + '" placeholder="cth. MITOKONDRIA"></label>' +
          '<small class="muted">Huruf/angka saja (spasi boleh untuk dua kata). Dipakai di mode Susun Huruf dan Tebak Kata.</small>';
      } else if (q.type === 'cloze') {
        body = '<label>Teks dengan bagian kosong<textarea data-f="ctext" rows="3" placeholder="Ibu kota Indonesia adalah [Jakarta] dan terletak di Pulau [Jawa].">' + esc(q.text || '') + '</textarea></label>' +
          '<small class="muted">Tulis kata yang harus diisi siswa di dalam <b>[kurung siku]</b>.</small>' +
          '<label>Kata pengecoh (opsional, pisahkan dengan ;)<input data-f="cextra" value="' + esc((q.extra || []).join('; ')) + '" placeholder="cth. Bandung; Sumatra"></label>';
      } else if (q.type === 'multi') {
        body = '<small class="muted">Centang semua jawaban yang benar. Di mode Pukul Tikus, pilihan ini muncul di atas tikus.</small><div class="pairs">' + q.items.map(function (it, j) {
          return '<div class="pr"><label class="chk" title="Tandai benar"><input type="checkbox" data-f="mok" data-j="' + j + '" ' + (it[1] ? 'checked' : '') + '><span>✔</span></label>' +
            '<input data-f="mtext" data-j="' + j + '" value="' + esc(it[0]) + '" placeholder="Pilihan ' + (j + 1) + '">' +
            (q.items.length > 3 ? '<button type="button" class="x" data-act="delmulti" data-j="' + j + '" aria-label="Hapus">✕</button>' : '') + '</div>';
        }).join('') + '</div>' + (q.items.length < 14 ? '<button type="button" class="link" data-act="addmulti">+ Tambah pilihan</button>' : '');
      } else if (q.type === 'wordsearch') {
        body = '<label>Kata yang dicari (satu per baris, 3–14 huruf, maks. 12 kata)<textarea data-f="wwords" rows="5" placeholder="ATMOSFER\nLITOSFER\nHIDROSFER">' + esc((q.words || []).join('\n')) + '</textarea></label>';
      }
      var ph = { word: 'Petunjuk, cth. "Organel penghasil energi"', cloze: 'Instruksi (opsional)', wordsearch: 'Judul teka-teki, cth. "Temukan nama planet!"',
        multi: 'Perintah, cth. "Pilih/pukul semua bilangan prima!"', group: 'Instruksi, cth. "Kelompokkan hewan berikut"' }[q.type] || 'Tulis pertanyaan…';
      return '<div class="qedit" data-qi="' + i + '"><div class="qe-head"><span class="qnum">' + (i + 1) + '</span><span class="badge">' + t.icon + ' ' + t.name + '</span>' +
        '<span class="grow"></span><button type="button" data-act="up" ' + (i === 0 ? 'disabled' : '') + ' title="Naik">↑</button>' +
        '<button type="button" data-act="down" ' + (i === D.questions.length - 1 ? 'disabled' : '') + ' title="Turun">↓</button>' +
        '<button type="button" data-act="dup" title="Duplikat">⧉</button><button type="button" data-act="del" title="Hapus" class="danger-txt">🗑</button></div>' +
        '<textarea data-f="q" rows="2" placeholder="' + esc(ph) + '">' + esc(q.q) + '</textarea>' + body +
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
      if (sk === 'loginMode') $('#domWrap').hidden = t.value !== 'google';
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
    var lines = function (v) { return v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
    if (f === 'gname') q.groups[j].name = t.value;
    if (f === 'gitems') q.groups[j].items = lines(t.value);
    if (f === 'wanswer') q.answer = t.value.toUpperCase();
    if (f === 'ctext') q.text = t.value;
    if (f === 'cextra') q.extra = t.value.split(';').map(function (x) { return x.trim(); }).filter(Boolean);
    if (f === 'mok') q.items[j][1] = t.checked;
    if (f === 'mtext') q.items[j][0] = t.value;
    if (f === 'wwords') q.words = lines(t.value.toUpperCase());
  }

  function onClick(e) {
    var mb = e.target.closest('[data-mode]');
    if (mb) {
      D.mode = mb.dataset.mode;
      $$('[data-mode]').forEach(function (b) { b.classList.toggle('on', b === mb); });
      var rec = MODES[D.mode].types;
      var only = D.questions.length === 1 && !String(D.questions[0].q || '').trim() && rec.indexOf(D.questions[0].type) < 0;
      if (only) { D.questions = [newQuestion(rec[0])]; drawQuestions(); }
      drawModeExtras();
      U.sfx.click();
      return;
    }
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
      drawModeExtras();
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
      case 'addgroup': q.groups.push({ name: '', items: [] }); break;
      case 'delgroup': q.groups.splice(j, 1); break;
      case 'addmulti': q.items.push(['', false]); break;
      case 'delmulti': q.items.splice(j, 1); break;
      default: return;
    }
    drawQuestions();
    drawModeExtras();
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
      '<input id="rq" placeholder="🔍 Cari nama / NIS / email…"><select id="rc"><option value="">Semua kelas</option>' +
      Object.keys(classes).sort().map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="rs"><option value="rank">Urut: peringkat</option><option value="name">Urut: nama</option><option value="cls">Urut: kelas</option><option value="low">Urut: nilai terendah</option></select>' +
      '<span class="grow"></span>' +
      '<button class="btn small ghost" id="xcsv">⬇️ CSV</button><button class="btn small ghost" id="xxls">⬇️ Excel</button>' +
      '<button class="btn small" id="xdrive">☁️ Simpan ke Google Drive</button><button class="btn small ghost" onclick="window.print()">🖨️ Cetak</button></div>' +
      '<div class="print-title"><h2>Rekap Nilai: ' + esc(g.title) + '</h2><p>' + esc(g.subject || '') + ' · Kode ' + esc(g.code) + ' · Dicetak ' + U.fmtDate(new Date().toISOString()) + '</p></div>' +
      '<div class="card table-card"><div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>NIS/Absen</th><th>Nilai</th><th>Keterangan</th>' +
      '<th>Benar</th><th>Percobaan</th><th>Durasi</th><th title="Jumlah keluar dari halaman game">⚠️</th><th>Terakhir</th><th class="no-print">Aksi</th></tr></thead><tbody id="rt"></tbody></table></div>' +
      '<p class="muted small" id="rsum"></p></div>' +
      (Api.isLocal() ? '' : '<section class="card no-print" id="dhist"><h3>☁️ File rekap di Google Drive</h3><p class="muted small">Memuat…</p></section>'));
    bindPicker('rekap');
    loadHistory(g);

    function visible() {
      var list = people.filter(function (p) {
        var t = (p.name + ' ' + p.sid + ' ' + p.email).toLowerCase();
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
        return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(p.name) + '</b>' + (p.email ? '<br><small class="muted">' + esc(p.email) + '</small>' : '') +
          (p.flags ? '<br><span class="badge warn" title="Jawaban tetap diterima, tetapi perlu dicek">⏰ ' + esc(p.flags) + '</span>' : '') +
          '</td><td>' + esc(p.cls) + '</td><td>' + esc(p.sid) + '</td>' +
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
      var head = ['No', 'Nama', 'Kelas', 'NIS/Absen', 'Email', 'Nilai', 'Keterangan', 'Benar', 'Jumlah Soal', 'Percobaan', 'Durasi (detik)', 'Pelanggaran', 'Waktu Selesai', 'Catatan'];
      return [head].concat(visible().map(function (p, i) {
        return [i + 1, p.name, p.cls, p.sid, p.email, p.finished ? p.score : '', label(p), p.correct, p.total, p.attempts, p.durationSec, p.violations, U.fmtDate(p.finishedAt), p.flags];
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
      if (Api.backendOutdated()) {
        U.modal('<h3>☁️ Simpan ke Google Drive</h3><p>Pilihan folder dan file per kelas membutuhkan Code.gs versi ' + Api.REQUIRED_BACKEND +
          '. Perbarui dulu Code.gs di Google Apps Script (lihat <a href="#/guru/pengaturan">Pengaturan</a>).</p>');
        return;
      }
      exportDialog(g);
    };
    draw();
  }

  /* ================= GOOGLE DRIVE ================= */
  function loadHistory(g) {
    var box = $('#dhist');
    if (!box || Api.backendOutdated()) { if (box) box.remove(); return; }
    Api.call('driveHistory', { code: g.code }).then(function (r) {
      if (!$('#dhist')) return;
      box.innerHTML = '<h3>☁️ File rekap di Google Drive</h3>' + (r.files.length ? '<ul class="file-list">' + r.files.map(fileItem).join('') + '</ul>' +
        '<p class="muted small">Menekan "Simpan ke Google Drive" lagi akan memperbarui file-file ini, bukan membuat salinan baru.</p>'
        : '<p class="muted">Belum ada file. Klik <b>☁️ Simpan ke Google Drive</b> di atas.</p>');
    }).catch(function () { box.remove(); });
  }

  function fileItem(f) {
    return '<li><span class="fi-icon">📊</span><span class="fi-main"><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
      '<small class="muted">📁 ' + esc(f.path) + (f.updatedAt ? ' · ' + U.fmtDate(f.updatedAt) : '') + '</small></span>' +
      (f.updated === true ? '<span class="badge">Diperbarui</span>' : f.updated === false ? '<span class="badge ok">Baru</span>' : '') + '</li>';
  }

  function exportDialog(g) {
    var st = { mode: 'perClass', folder: null };
    var m = U.modal('<h3>☁️ Simpan rekap ke Google Drive</h3>' +
      '<p class="muted small">Rekap disimpan sebagai Google Sheets lengkap dengan diagram dan analisis soal. Menyimpan ulang akan memperbarui file yang sama.</p>' +
      '<p class="lbl">Bentuk file</p><div class="pick-row">' +
      '<label class="pick"><input type="radio" name="xm" value="perClass" checked><span><b>📚 Satu file per kelas</b><small>Setiap kelas punya file sendiri</small></span></label>' +
      '<label class="pick"><input type="radio" name="xm" value="combined"><span><b>🗂️ Satu file semua kelas</b><small>Semua kelas dalam satu file</small></span></label></div>' +
      '<p class="lbl">Lokasi penyimpanan</p><div class="pick-row">' +
      '<label class="pick"><input type="radio" name="xl" value="auto" checked><span><b>📁 Otomatis</b><small id="xauto">Memuat…</small></span></label>' +
      '<label class="pick"><input type="radio" name="xl" value="custom"><span><b>📂 Pilih folder sendiri</b><small id="xcustom">Belum dipilih</small></span></label></div>' +
      '<div class="row end"><button type="button" class="link" data-x="pick">📂 Pilih / ganti folder…</button></div>' +
      '<div class="row end gap"><button class="btn ghost" data-x="cancel">Batal</button><button class="btn glow" data-x="go">☁️ Simpan ke Drive</button></div>', { wide: true });
    var autoText = function (info) {
      var base = (info ? info.root.name + ' / ' + info.schoolYear : 'Folder utama / Tahun ajaran') + ' / ' + (g.subject || 'Umum');
      $('#xauto', m.el).textContent = base + (st.mode === 'perClass' ? ' / [Kelas]' : '');
    };
    var info = null;
    autoText(null);
    Api.call('getConfig').then(function (r) { info = r.drive; autoText(info); }).catch(function () { /* tampilkan teks umum */ });
    m.el.addEventListener('change', function (e) {
      if (e.target.name === 'xm') { st.mode = e.target.value; autoText(info); }
      if (e.target.name === 'xl' && e.target.value === 'custom' && !st.folder) chooseFolder();
    });
    function chooseFolder() {
      folderPicker({ title: 'Pilih folder tujuan rekap' }).then(function (f) {
        if (!f) {
          if (!st.folder) $('input[name=xl][value=auto]', m.el).checked = true;
          return;
        }
        st.folder = f;
        $('#xcustom', m.el).textContent = f.path;
        $('input[name=xl][value=custom]', m.el).checked = true;
      });
    }
    m.el.addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-x');
      if (a === 'cancel') m.close();
      if (a === 'pick') chooseFolder();
      if (a !== 'go') return;
      var custom = $('input[name=xl][value=custom]', m.el).checked;
      if (custom && !st.folder) { chooseFolder(); return; }
      e.target.disabled = true;
      e.target.textContent = 'Menyimpan… (bisa sampai 1 menit)';
      Api.call('exportDrive', { code: g.code, mode: st.mode, folderId: custom ? st.folder.id : '' }).then(function (r) {
        m.close();
        U.sfx.correct();
        U.modal('<div class="center-box"><div class="big-emoji">✅</div><h3>Tersimpan di Google Drive!</h3></div>' +
          '<ul class="file-list">' + r.files.map(fileItem).join('') + '</ul>', { wide: true });
        loadHistory(g);
      }).catch(function (err) {
        e.target.disabled = false;
        e.target.textContent = '☁️ Simpan ke Drive';
        U.toast(err.message, 'err');
      });
    });
  }

  // Penjelajah folder Google Drive. Hasil: Promise {id, name, path} atau null bila dibatalkan.
  function folderPicker(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      var cur = null;
      var m = U.modal('<h3>' + esc(opts.title || 'Pilih folder') + '</h3><div id="fp"><div class="center-box"><div class="spinner dark"></div></div></div>',
        { wide: true, onClose: function () { if (!done) resolve(null); } });
      function open(parentId, fromMyDrive) {
        $('#fp', m.el).innerHTML = '<div class="center-box"><div class="spinner dark"></div></div>';
        Api.call('driveFolders', { parentId: parentId || '', fromMyDrive: !!fromMyDrive }).then(draw).catch(function (err) {
          $('#fp', m.el).innerHTML = '<div class="notice err">' + esc(err.message) + '</div><button class="btn ghost" data-top>Kembali ke Drive Saya</button>';
        });
      }
      function draw(r) {
        cur = r;
        $('#fp', m.el).innerHTML =
          '<div class="crumbs">' + r.crumbs.map(function (c, i) {
            return (i ? '<span>›</span>' : '') + '<button data-open="' + esc(c.id) + '">' + (i ? '' : '🏠 ') + esc(c.name) + '</button>';
          }).join('') + '</div>' +
          '<ul class="folder-list">' + (r.children.length ? r.children.map(function (c) {
            return '<li><button data-open="' + esc(c.id) + '">📁 ' + esc(c.name) + '</button></li>';
          }).join('') : '<li class="muted small">Belum ada subfolder di sini.</li>') + '</ul>' +
          '<div class="copy-row"><input id="fpnew" maxlength="80" placeholder="Nama folder baru, cth. Kelas XI IPA 1"><button class="btn small" data-new>＋ Buat folder</button></div>' +
          '<div class="row between gap wrap fp-foot"><span class="muted small">Folder terpilih: <b>' + esc(r.crumbs.map(function (c) { return c.name; }).join(' / ')) + '</b></span>' +
          '<button class="btn glow" data-choose>✔ Pilih folder ini</button></div>';
      }
      m.el.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-open')) open(b.getAttribute('data-open'));
        if (b.hasAttribute('data-top')) open('', true);
        if (b.hasAttribute('data-new')) {
          var name = $('#fpnew', m.el).value.trim();
          if (!name) { $('#fpnew', m.el).focus(); return; }
          b.disabled = true;
          Api.call('driveCreateFolder', { parentId: cur.folder.id, name: name }).then(function (r) {
            U.toast('Folder "' + r.folder.name + '" dibuat ✓', 'ok');
            open(r.folder.id);
          }).catch(function (err) { b.disabled = false; U.toast(err.message, 'err'); });
        }
        if (b.hasAttribute('data-choose') && cur) {
          done = true;
          resolve({ id: cur.folder.id, name: cur.folder.name, url: cur.folder.url, path: cur.crumbs.map(function (c) { return c.name; }).join(' / ') });
          m.close();
        }
      });
      open(opts.parentId || '', !!opts.fromMyDrive);
    });
  }

  function attemptsModal(g, list) {
    list = list.slice().sort(function (a, b) { return a.attempt - b.attempt; });
    var p = list[0];
    U.modal('<h3>' + esc(p.name) + ' <small class="muted">' + esc(p.cls) + (p.sid ? ' · ' + esc(p.sid) : '') + (p.email ? ' · ' + esc(p.email) : '') + '</small></h3>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Ke-</th><th>Status</th><th>Nilai</th><th>Benar</th><th>Durasi</th><th>⚠️</th><th>Mulai</th></tr></thead><tbody>' +
      list.map(function (r) {
        return '<tr><td>' + r.attempt + '</td><td>' + (r.status === 'done' ? '✅ Selesai' : '⏸️ Tidak selesai') + '</td><td>' + (r.status === 'done' ? r.score : '-') + '</td>' +
          '<td>' + r.correct + '/' + r.total + '</td><td>' + U.fmtTime(r.durationSec) + '</td><td>' + r.violations + '</td><td class="small">' + U.fmtDate(r.startedAt) +
          (r.flags ? '<br><span class="badge warn">⏰ ' + esc(r.flags) + '</span>' : '') + '</td></tr>';
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
      (local ? '' : '<button class="btn ghost" id="sclear">Kembali ke Mode Lokal</button>') + '</div>' +
      (local ? '' : '<p class="small muted" style="margin-top:12px">Versi backend (Code.gs): <b>' + (Api.backendVersion() || '?') + '</b> · dibutuhkan: <b>' +
        Api.REQUIRED_BACKEND + '</b> ' + (Api.backendOutdated() ? '⚠️' : '✅') + '</p>') + '</section>' +
      (local ? '' : (Api.backendOutdated() ? updateGuide() : '<div id="cloudcfg"><div class="card center-box"><div class="spinner dark"></div><p>Memuat pengaturan Google…</p></div></div>')) +

      '<section class="card guide"><h3>📘 Cara menghubungkan (sekali saja, ±10 menit)</h3><ol>' +
      '<li>Buka <a href="https://sheets.new" target="_blank" rel="noopener">sheets.new</a> untuk membuat Google Sheets baru, beri nama misalnya <b>Database Game Belajar</b>.</li>' +
      '<li>Klik menu <b>Ekstensi → Apps Script</b>.</li>' +
      '<li>Hapus kode bawaan, lalu salin seluruh isi file <a href="backend/Code.gs" target="_blank">backend/Code.gs</a> dan tempelkan.</li>' +
      '<li>Buka <b>Project Settings</b> (ikon ⚙️ di kiri) → <b>Script Properties</b> → <b>Add script property</b>. Isi <i>Property</i>: <code>TEACHER_KEY</code> dan <i>Value</i>: kata sandi Anda, lalu <b>Save</b>. Kata sandi tidak ditulis di kode.</li>' +
      '<li>Klik <b>Terapkan → Deployment baru</b> → pilih jenis <b>Aplikasi web</b>. Setel <i>Jalankan sebagai:</i> <b>Saya</b>, <i>Yang memiliki akses:</i> <b>Siapa saja</b>. Klik <b>Terapkan</b> dan izinkan aksesnya.</li>' +
      '<li>Salin <b>URL aplikasi web</b> (berakhiran <code>/exec</code>), tempel di kolom di atas, lalu klik <b>Simpan</b>.</li>' +
      '<li>Keluar lalu masuk lagi menggunakan kata sandi yang Anda isi pada <b>TEACHER_KEY</b>.</li></ol>' +
      '<p class="muted small">Semua nilai tersimpan di Google Sheets tersebut (lembar <b>Results</b>). Tombol "Simpan ke Google Drive" di Rekap membuat file rekap lengkap dengan diagram di folder Drive yang Anda atur di halaman ini. ' +
      'Jika Anda mengubah Code.gs, buat ulang deployment melalui <b>Terapkan → Kelola deployment → Edit → Versi baru</b>.</p></section>' +

      (local ? '<section class="card"><h3>💾 Cadangan data Mode Lokal</h3><p class="muted">Pindahkan data lokal ke perangkat lain atau simpan sebagai cadangan.</p>' +
        '<div class="row gap wrap"><button class="btn ghost" id="bk">⬇️ Unduh cadangan</button><label class="btn ghost">⬆️ Pulihkan cadangan<input type="file" accept=".json" id="rs" hidden></label>' +
        '<button class="btn ghost" id="pin">🔑 Ganti PIN</button></div>' +
        '<p class="muted small">Untuk memindahkan game ke Google Sheets: Aktivitas Saya → Ekspor semua, hubungkan Google Sheets, lalu Impor file tersebut.</p></section>' : ''));

    if (!local && !Api.backendOutdated()) cloudSettings();

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

  function updateGuide() {
    return '<section class="card guide"><h3>⚙️ Cara memperbarui Code.gs (versi ' + Api.REQUIRED_BACKEND + ')</h3><ol>' +
      '<li>Buka file <a href="backend/Code.gs" target="_blank">backend/Code.gs</a>, pilih semua (Ctrl+A) dan salin (Ctrl+C).</li>' +
      '<li>Di editor Google Apps Script, klik di area kode, tekan Ctrl+A lalu Delete sampai kosong, kemudian tempel (Ctrl+V). Klik 💾 Simpan.</li>' +
      '<li>Klik <b>Terapkan → Kelola deployment</b> → ikon ✏️ → <b>Versi: Versi baru</b> → <b>Terapkan</b>. Izinkan akses tambahan bila diminta.</li>' +
      '<li>Kembali ke aplikasi, klik <b>Keluar</b>, lalu masuk lagi.</li></ol>' +
      '<p class="muted small">Data nilai dan game tidak berubah. URL /exec tetap sama.</p></section>';
  }

  function cloudSettings() {
    Api.call('getConfig').then(function (r) {
      var c = r.config, d = r.drive;
      var box = $('#cloudcfg');
      if (!box) return;
      var origin = location.origin;
      box.innerHTML =
        '<section class="card"><h3>🔐 Login Google untuk siswa</h3>' +
        '<p class="muted">Agar siswa bisa masuk dengan Gmail, isi <b>Client ID</b> dari Google Cloud Console. Client ID bukan rahasia (aman ditampilkan), berbeda dengan kata sandi guru.</p>' +
        '<label>OAuth Client ID<input id="cid" value="' + esc(c.googleClientId) + '" placeholder="1234567890-abc123.apps.googleusercontent.com"></label>' +
        '<p class="small">Status: <b>' + (c.googleClientId ? '✅ Aktif — pilih "Akun Google" di pengaturan game' : '⏸️ Belum diatur') + '</b></p>' +
        '<details class="small"><summary>Cara membuat Client ID</summary><ol>' +
        '<li>Buka <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> dan buat project baru (mis. "GameBelajar").</li>' +
        '<li>Menu <b>Google Auth Platform</b> (atau <b>APIs & Services → OAuth consent screen</b>) → <b>Get started</b>. Isi nama aplikasi & email, pilih <b>External</b>.</li>' +
        '<li>Di bagian <b>Audience</b>, klik <b>Publish app</b> agar semua akun Gmail bisa masuk.</li>' +
        '<li>Menu <b>Clients</b> (Credentials) → <b>Create client</b> → jenis <b>Web application</b>.</li>' +
        '<li><b>Authorized JavaScript origins</b>: tambahkan <code>' + esc(origin) + '</code>. Klik <b>Create</b>.</li>' +
        '<li>Salin <b>Client ID</b> lalu tempel di kolom di atas dan klik Simpan.</li></ol></details>' +
        '<div class="row end"><button class="btn" id="savecid">💾 Simpan Client ID</button></div></section>' +

        '<section class="card" id="tmail"><h3>👩‍🏫 Guru yang boleh masuk dengan Gmail</h3>' +
        '<p class="muted">Guru di daftar ini bisa masuk ke dasbor dengan tombol <b>Masuk dengan Google</b> (butuh Client ID di atas). ' +
        'Semua guru di daftar ini memakai data yang sama. Kata sandi guru tetap bisa dipakai sebagai cadangan.</p>' +
        '<ul class="file-list">' + (r.owner ? '<li><span class="fi-icon">👑</span><span class="fi-main"><b>' + esc(r.owner) + '</b><small class="muted">Pemilik Apps Script, selalu diizinkan</small></span></li>' : '') +
        c.teacherEmails.map(function (em) {
          return '<li><span class="fi-icon">👤</span><span class="fi-main"><b>' + esc(em) + '</b></span><button class="btn small ghost" data-rm="' + esc(em) + '">Hapus</button></li>';
        }).join('') + '</ul>' +
        '<div class="copy-row"><input id="newt" type="email" placeholder="email.guru@gmail.com"><button class="btn small" id="addt">＋ Tambah guru</button></div>' +
        (r.me ? '<p class="small muted" style="margin-top:10px">Anda sedang masuk sebagai <b>' + esc(r.me) + '</b>.</p>' : '') + '</section>' +

        '<section class="card"><h3>📁 Folder Google Drive</h3>' +
        '<p class="muted">Rekap otomatis disusun dengan struktur: <b>Folder utama / Tahun ajaran / Mata pelajaran / Kelas</b>.</p>' +
        '<div class="drive-root"><span class="fi-icon">📁</span><span class="fi-main"><b id="rootname">' + esc(d.root.path || d.root.name) + '</b>' +
        '<small class="muted">' + (d.root.pending ? 'Akan dibuat otomatis di Drive Saya saat pertama menyimpan.' : 'Folder utama') + '</small></span>' +
        (d.root.url ? '<a class="btn small ghost" href="' + esc(d.root.url) + '" target="_blank" rel="noopener">Buka ↗</a>' : '') +
        '<button class="btn small" id="chroot">Ganti folder…</button></div>' +
        '<label>Tahun ajaran<input id="sy" value="' + esc(c.schoolYear) + '" placeholder="' + esc(d.schoolYear) + ' (otomatis)"><small>Kosongkan agar dihitung otomatis (tahun ajaran baru mulai Juli).</small></label>' +
        '<div class="row end gap"><button class="btn" id="savedrive">💾 Simpan pengaturan folder</button></div></section>' +

        '<section class="card"><h3>🌙 Simpan otomatis setiap malam</h3>' +
        '<label class="switch"><input type="checkbox" id="auto" ' + (c.autoSave ? 'checked' : '') + '><span class="sw"></span><span>Aktifkan simpan otomatis' +
        '<small>Setiap hari sekitar pukul ' + d.autoSaveHour + '.00 (zona waktu skrip: ' + esc(d.timeZone) + '), rekap game yang ada aktivitas baru diperbarui di Drive.</small></span></label>' +
        '<label>Bentuk file<select id="amode"><option value="perClass" ' + (c.autoSaveMode !== 'combined' ? 'selected' : '') + '>Satu file per kelas</option>' +
        '<option value="combined" ' + (c.autoSaveMode === 'combined' ? 'selected' : '') + '>Satu file semua kelas</option></select></label>' +
        '<p class="small">Status pemicu: <b>' + (d.triggerActive ? '✅ aktif' : '⏸️ tidak aktif') + '</b>' +
        (c.lastAutoSave ? ' · terakhir berjalan: ' + U.fmtDate(c.lastAutoSave) : '') + '</p>' +
        '<div class="row end gap wrap"><button class="btn ghost" id="runnow">▶️ Jalankan sekarang</button><button class="btn" id="saveauto">💾 Simpan</button></div></section>';

      function save(btn, cfg, msg) {
        btn.disabled = true;
        return Api.call('saveConfig', { config: cfg }).then(function (res) {
          Api.setBackendInfo({ version: Api.backendVersion(), googleLogin: !!res.config.googleClientId });
          U.toast(msg, 'ok');
          settings();
        }).catch(function (err) { btn.disabled = false; U.toast(err.message, 'err'); });
      }
      $('#savecid').onclick = function () { save(this, { googleClientId: $('#cid').value.trim() }, 'Client ID tersimpan ✓'); };
      $('#addt').onclick = function () {
        var em = $('#newt').value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { U.toast('Tulis alamat email yang valid.', 'err'); return; }
        save(this, { teacherEmails: c.teacherEmails.concat([em]) }, em + ' ditambahkan ✓');
      };
      $('#tmail').addEventListener('click', function (e) {
        var b = e.target.closest('[data-rm]');
        if (!b) return;
        var em = b.getAttribute('data-rm');
        U.confirm('Hapus ' + em + ' dari daftar guru? Jika sedang masuk, sesinya langsung berakhir.', 'Hapus').then(function (ok) {
          if (ok) save(b, { teacherEmails: c.teacherEmails.filter(function (x) { return x !== em; }) }, em + ' dihapus');
        });
      });
      $('#savedrive').onclick = function () { save(this, { schoolYear: $('#sy').value.trim() }, 'Pengaturan folder tersimpan ✓'); };
      $('#saveauto').onclick = function () {
        save(this, { autoSave: $('#auto').checked, autoSaveMode: $('#amode').value }, $('#auto').checked ? 'Simpan otomatis aktif ✓' : 'Simpan otomatis dimatikan');
      };
      $('#chroot').onclick = function () {
        folderPicker({ title: 'Pilih folder utama untuk semua rekap', fromMyDrive: true }).then(function (f) {
          if (f) save($('#chroot'), { driveRootId: f.id }, 'Folder utama diganti ke "' + f.name + '" ✓');
        });
      };
      $('#runnow').onclick = function () {
        var b = this;
        b.disabled = true; b.textContent = 'Menyimpan… (bisa beberapa menit)';
        Api.call('runAutoSave').then(function (res) {
          U.modal('<h3>🌙 Simpan otomatis selesai</h3>' + (res.saved.length ? '<ul>' + res.saved.map(function (x) {
            return '<li>' + esc(x.title) + ' — ' + x.files + ' file</li>';
          }).join('') + '</ul>' : '<p>Tidak ada aktivitas baru sejak penyimpanan terakhir.</p>') +
            (res.errors.length ? '<div class="notice err">' + res.errors.map(esc).join('<br>') + '</div>' : ''));
          settings();
        }).catch(function (err) { b.disabled = false; b.textContent = '▶️ Jalankan sekarang'; U.toast(err.message, 'err'); });
      };
    }).catch(function (err) {
      var box = $('#cloudcfg');
      if (box) box.innerHTML = '<div class="notice err">' + esc(err.message) + '</div>';
    });
  }

  return { route: route, mountGoogleButton: mountGoogleButton };
})();
