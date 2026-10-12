/* student.js — Tampilan siswa: gabung game, login, bermain, hasil, papan skor. */
var Student = (function () {
  var esc = U.esc, $ = U.$, $$ = U.$$;
  var S = null;           // status permainan yang sedang berjalan
  var timer = null;       // interval timer soal
  var boardTimer = null;  // interval auto-refresh papan skor
  var SHAPES = ['▲', '◆', '●', '■', '★', '⬟'];
  var PAIR_COLORS = ['#f43f5e', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

  function root() { return $('#app'); }

  function themed(theme, inner, extra) {
    var t = THEMES[theme] ? theme : 'galaxy';
    var deco = THEMES[t].deco.concat(THEMES[t].deco).map(function (d, i) {
      return '<span style="left:' + ((i * 37) % 100) + '%;animation-delay:' + (i * -2.3) + 's;animation-duration:' + (14 + (i % 5) * 3) + 's">' + d + '</span>';
    }).join('');
    return '<div class="gs theme-' + t + ' ' + (extra || '') + '"><div class="deco" aria-hidden="true">' + deco + '</div>' +
      '<div class="gs-inner">' + inner + '</div></div>';
  }

  function muteBtn() {
    return '<button class="icon-btn mute" title="Suara" aria-label="Nyalakan/matikan suara">' + (U.isMuted() ? '🔇' : '🔊') + '</button>';
  }

  function bindMute(el) {
    $$('.mute', el).forEach(function (b) {
      b.onclick = function () { b.textContent = U.toggleMute() ? '🔇' : '🔊'; };
    });
  }

  function savedStudent() {
    try { return JSON.parse(localStorage.getItem('gb_student')) || {}; } catch (e) { return {}; }
  }

  function progKey(code) { return 'gb_prog_' + code; }

  var loadGis = U.loadGis, jwtPayload = U.jwtPayload;

  // Token Google siswa disimpan sementara di tab ini (hilang saat tab ditutup) supaya tidak perlu masuk ulang di tiap game.
  function savedToken() {
    var t = sessionStorage.getItem('gb_gtoken');
    if (!t) return '';
    var p = jwtPayload(t);
    if (!(Number(p.exp) * 1000 > Date.now() + 120000)) { sessionStorage.removeItem('gb_gtoken'); return ''; }
    return t;
  }

  function loadProgress(code) { try { return JSON.parse(localStorage.getItem(progKey(code))); } catch (e) { return null; } }
  function persist() { if (S) localStorage.setItem(progKey(S.code), JSON.stringify(S)); }

  function cleanup() {
    clearInterval(timer); timer = null;
    clearInterval(boardTimer); boardTimer = null;
    document.removeEventListener('visibilitychange', onVisibility);
    if (S) S.active = false;
  }

  function loading(theme, text) {
    root().innerHTML = themed(theme || 'galaxy', '<div class="center-box"><div class="spinner"></div><p>' + esc(text || 'Memuat…') + '</p></div>');
  }

  function errorScreen(theme, msg, code) {
    root().innerHTML = themed(theme || 'galaxy', '<div class="card glass center-box">' +
      '<div class="big-emoji">😵</div><h2>Ups!</h2><p>' + esc(msg) + '</p>' +
      '<div class="row center gap">' + (code ? '<a class="btn" href="#/main/' + esc(code) + '">Coba lagi</a>' : '') +
      '<a class="btn ghost" href="#/">Ke beranda</a></div></div>');
  }

  /* ================= BERANDA SISWA ================= */
  function home() {
    cleanup();
    var st = savedStudent();
    var loggedIn = !!Api.auth();
    var who = sessionStorage.getItem('gb_temail');
    root().innerHTML = themed('galaxy',
      '<header class="topbar"><div class="logo">🎮 <b>Game</b>Belajar</div><div class="row gap">' + muteBtn() + '</div></header>' +
      '<section class="hero">' +
      '<div class="hero-badge">Untuk siswa SMA ✨</div>' +
      '<h1 class="hero-title">Belajar jadi <span class="shine">seru</span>,<br>nilai jadi <span class="shine alt">juara!</span></h1>' +
      '<p class="hero-sub">Pilih jalur masukmu di bawah ini.</p>' +
      '<div class="entry">' +

      '<section class="entry-card glass" aria-labelledby="eh-s">' +
      '<div class="entry-icon">🎮</div><h2 id="eh-s">Saya Siswa</h2>' +
      '<p class="entry-sub">Masukkan kode game dari gurumu, lalu tunjukkan kemampuanmu!</p>' +
      '<form class="join-card" id="join">' +
      '<label for="code" class="sr-only">Kode game</label>' +
      '<input id="code" maxlength="6" autocomplete="off" placeholder="KODE GAME" value="' + esc(st.lastCode || '') + '" />' +
      '<button class="btn big glow" type="submit">Gabung ▶</button></form>' +
      '<p class="entry-note">🔐 Jika gurumu meminta login Google, tombol <b>Masuk dengan Google</b> muncul di langkah berikutnya, setelah kamu memasukkan kode.</p>' +
      '</section>' +

      '<section class="entry-card glass teacher" aria-labelledby="eh-g">' +
      '<div class="entry-icon">👩‍🏫</div><h2 id="eh-g">Saya Guru</h2>' +
      '<p class="entry-sub">Buat game, bagikan kode, lihat nilai, dan analisis kemajuan siswa.</p>' +
      (loggedIn
        ? '<a class="btn big glow full" href="#/guru">📊 Buka Dasbor Guru</a>' +
          (who ? '<p class="entry-note">Masuk sebagai <b>' + esc(who) + '</b></p>' : '')
        : '<div id="hgoogle" class="hgoogle" hidden><div id="hgbtn"></div><div class="or"><span>atau</span></div></div>' +
          '<a class="btn big full" href="#/guru">🔑 Masuk dengan Kata Sandi</a>' +
          '<p class="entry-note" id="hnote"></p>') +
      '</section></div>' +
      '<div class="chips"><span>⚡ Kuis kilat</span><span>🎈 Balon meletus</span><span>🔨 Pukul tikus</span><span>🎡 Roda putar</span><span>🏆 Papan skor</span></div>' +
      '</section>');
    bindMute(root());
    var input = $('#code');
    input.addEventListener('input', function () { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    $('#join').onsubmit = function (e) {
      e.preventDefault();
      var c = input.value.trim();
      if (c.length < 4) { U.toast('Kode game terdiri dari 6 karakter.', 'err'); input.focus(); return; }
      U.sfx.click();
      location.hash = '#/main/' + c;
    };

    if (loggedIn) return;
    var note = $('#hnote');
    if (Api.isLocal()) {
      note.innerHTML = '💻 Mode Lokal: data hanya tersimpan di browser ini. <a href="#/guru/pengaturan">Hubungkan ke Google</a> agar siswa bisa bermain dari HP dan guru bisa masuk dengan Gmail.';
      return;
    }
    Api.call('ping').then(function (r) {
      if (!$('#hnote')) return;
      if (r.googleClientId && window.Teacher) {
        $('#hgoogle').hidden = false;
        return Teacher.mountGoogleButton($('#hgbtn'), r.googleClientId, function () { location.hash = '#/guru'; });
      }
      $('#hnote').textContent = 'Login Gmail untuk guru aktif setelah Client ID disimpan di menu Pengaturan.';
    }).catch(function () {
      if ($('#hnote')) $('#hnote').textContent = 'Server belum bisa dijangkau. Periksa koneksi internet atau URL server di menu Pengaturan.';
    });
  }

  /* ================= LOBI + LOGIN ================= */
  function lobby(code) {
    cleanup();
    code = String(code || '').toUpperCase();
    loading('galaxy', 'Mencari game ' + code + '…');
    Api.call('getGame', { code: code }).then(function (res) {
      var g = res.game, s = g.settings;
      var st = savedStudent();
      var useGoogle = s.loginMode === 'google';
      var gUser = null;
      var prog = loadProgress(code);
      var md = MODES[g.mode] || MODES.classic;
      var info = [
        [md.icon, md.name], ['📚', g.subject || 'Umum'], ['❓', g.questionCount + ' soal'],
        ['⏱️', s.timePerQuestion ? s.timePerQuestion + ' dtk/soal' : 'Tanpa batas waktu'],
        ['🔁', s.maxAttempts ? s.maxAttempts + 'x kesempatan' : 'Tak terbatas'], ['🎯', 'KKM ' + s.kkm]
      ];
      var resume = prog && prog.attemptId && !prog.submitted ?
        '<div class="notice warn">⏸️ Kamu punya pengerjaan yang belum selesai sebagai <b>' + esc(prog.student.name) + '</b>.' +
        '<button class="btn small" id="resume">Lanjutkan ▶</button></div>' : '';
      root().innerHTML = themed(g.theme,
        '<header class="topbar"><a class="logo" href="#/">🎮 <b>Game</b>Belajar</a><div class="row gap">' + muteBtn() + '</div></header>' +
        '<div class="lobby">' +
        '<div class="card glass lobby-info">' +
        '<div class="theme-icon">' + THEMES[g.theme in THEMES ? g.theme : 'galaxy'].icon + '</div>' +
        '<div class="code-pill">KODE ' + esc(g.code) + '</div>' +
        '<h1>' + esc(g.title) + '</h1>' +
        (g.description ? '<p class="muted">' + esc(g.description) + '</p>' : '') +
        '<div class="info-grid">' + info.map(function (x) { return '<div><span>' + x[0] + '</span>' + esc(x[1]) + '</div>'; }).join('') + '</div>' +
        '<ul class="rules"><li>🎮 <b>Cara main:</b> ' + esc(md.how) + '</li>' +
        (s.antiCheat ? '<li>🛡️ Jangan keluar dari halaman game. Batas pindah tab: <b>' + s.antiCheat + 'x</b>, setelah itu jawaban otomatis dikumpulkan.</li>' : '') +
        '<li>⚠️ Menekan "Mulai" langsung memakai 1 kesempatan.</li>' +
        (s.powerUps ? '<li>🎁 Ada power-up yang bisa kamu pakai sekali!</li>' : '') +
        '</ul></div>' +
        '<form class="card glass lobby-form" id="login">' +
        (res.closed ? '<div class="notice err">🔒 ' + esc(res.closed) + '</div>' : resume) +
        (useGoogle ? '<h2>Masuk dulu, ya! 👋</h2>' +
          '<div class="gbox" id="gbox"><div id="gbtn"></div><p class="small muted" id="gnote">Masuk dengan akun Google' +
          (s.allowedDomain ? ' <b>@' + esc(s.allowedDomain.replace(/^@/, '')) + '</b>' : '') + ' untuk mulai bermain.</p></div>' +
          '<div id="gchip"></div>'
          : '<h2>Siapa kamu? 👋</h2>') +
        '<div id="sfields"' + (useGoogle ? ' hidden' : '') + '>' +
        '<label>Nama lengkap<input name="name" required minlength="3" maxlength="80" value="' + esc(st.name || '') + '" placeholder="cth. Budi Santoso"></label>' +
        '<div class="row gap"><label class="grow">Kelas<input name="cls" required maxlength="30" value="' + esc(st.cls || '') + '" placeholder="cth. XI IPA 2"></label>' +
        '<label class="grow">NIS / No. Absen' + (useGoogle ? ' (opsional)' : '') + '<input name="sid" ' + (useGoogle ? '' : 'required ') +
        'maxlength="30" value="' + esc(st.sid || '') + '" placeholder="cth. 12"></label></div></div>' +
        '<button class="btn big glow full" type="submit" ' + (res.closed || useGoogle ? 'disabled' : '') + '>🚀 Mulai Main!</button>' +
        (s.showLeaderboard ? '<a class="btn ghost full" href="#/skor/' + esc(g.code) + '">🏆 Lihat Papan Skor</a>' : '') +
        '</form></div>');
      bindMute(root());
      var r = $('#resume');
      if (r) r.onclick = function () { S = prog; U.sfx.go(); countdown(); };

      if (useGoogle && !res.closed) setupGoogle();
      function setupGoogle() {
        var note = $('#gnote');
        if (!s.googleClientId) { note.textContent = '⚠️ Login Google belum diatur oleh guru. Hubungi gurumu.'; return; }
        loadGis().then(function () {
          window.google.accounts.id.initialize({
            client_id: s.googleClientId, auto_select: false, cancel_on_tap_outside: true,
            callback: function (resp) { onGoogle(resp.credential); }
          });
          window.google.accounts.id.renderButton($('#gbtn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', width: 260 });
        }).catch(function (err) { note.textContent = '⚠️ ' + err.message; }).then(function () {
          var saved = savedToken();
          if (saved && !gUser && $('#gbox')) onGoogle(saved);
        });
      }
      function onGoogle(token) {
        var p = jwtPayload(token);
        var email = String(p.email || '').toLowerCase();
        var dom = String(s.allowedDomain || '').replace(/^@/, '').toLowerCase();
        if (dom) {
          var host = email.split('@')[1] || '';
          if (host !== dom && host.slice(-(dom.length + 1)) !== '.' + dom) {
            U.toast('Gunakan akun Google dengan domain @' + dom + '.', 'err');
            return;
          }
        }
        gUser = { token: token, email: email, name: p.name || '' };
        try { sessionStorage.setItem('gb_gtoken', token); } catch (e) { /* penyimpanan sesi diblokir */ }
        $('#gbox').hidden = true;
        $('#gchip').innerHTML = '<div class="gchip">' + (p.picture ? '<img src="' + esc(p.picture) + '" alt="" referrerpolicy="no-referrer">' : '✅') +
          '<span><small>Masuk sebagai</small><b>' + esc(email) + '</b></span><button type="button" class="btn small ghost" id="gswitch">Ganti</button></div>';
        $('#sfields').hidden = false;
        var f = $('#login');
        if (!f.name.value.trim()) f.name.value = gUser.name;
        f.querySelector('button[type=submit]').disabled = false;
        (f.cls.value ? f.name : f.cls).focus();
        $('#gswitch').onclick = function () {
          gUser = null;
          sessionStorage.removeItem('gb_gtoken');
          if (window.google) window.google.accounts.id.disableAutoSelect();
          $('#gchip').innerHTML = '';
          $('#gbox').hidden = false;
          $('#sfields').hidden = true;
          f.querySelector('button[type=submit]').disabled = true;
        };
      }
      $('#login').onsubmit = function (e) {
        e.preventDefault();
        var f = e.target;
        var student = { name: f.name.value.trim(), cls: f.cls.value.trim().toUpperCase(), sid: f.sid.value.trim() };
        if (useGoogle && !gUser) { U.toast('Masuk dengan akun Google terlebih dahulu.', 'err'); return; }
        localStorage.setItem('gb_student', JSON.stringify(Object.assign({}, student, { lastCode: g.code })));
        var same = prog && prog.attemptId && !prog.submitted && (useGoogle
          ? prog.student.email === gUser.email
          : Logic.studentKey(prog.student) === Logic.studentKey(student));
        if (same) { S = prog; countdown(); return; }
        var btn = f.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Menyiapkan soal…';
        var req = { code: g.code, student: student };
        if (useGoogle) req.idToken = gUser.token;
        Api.call('start', req).then(function (at) {
          localStorage.setItem('gb_me_' + g.code, at.attemptId);
          S = {
            code: g.code, attemptId: at.attemptId, served: at.served, game: at.game, student: at.student,
            attemptNo: at.attemptNo, maxAttempts: at.maxAttempts, idx: 0, answers: [], xp: 0, combo: 0, maxCombo: 0,
            correct: 0, violations: 0, used: {}, submitted: false
          };
          persist();
          U.sfx.go();
          countdown();
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = '🚀 Mulai Main!';
          U.toast(err.message, 'err');
        });
      };
    }).catch(function (err) { errorScreen('galaxy', err.message, code); });
  }

  /* ================= HITUNG MUNDUR ================= */
  function countdown() {
    var n = 3;
    root().innerHTML = themed(S.game.theme, '<div class="countdown"><div class="cd-title">' + esc(S.game.title) + '</div>' +
      '<div class="cd-num" id="cd">3</div><div class="cd-sub">Bersiap, ' + esc(S.student.name.split(' ')[0]) + '!</div></div>');
    U.sfx.count();
    var iv = setInterval(function () {
      n--;
      var el = $('#cd');
      if (!el) { clearInterval(iv); return; }
      if (n > 0) { el.textContent = n; el.className = 'cd-num'; void el.offsetWidth; el.className = 'cd-num again'; U.sfx.count(); }
      else if (n === 0) { el.textContent = 'MULAI!'; el.className = 'cd-num go'; U.sfx.go(); }
      else { clearInterval(iv); startPlay(); }
    }, 800);
  }

  /* ================= ANTI-CURANG ================= */
  function onVisibility() {
    if (!S || !S.active || S.submitted) return;
    if (document.visibilityState === 'hidden') {
      S.violations++;
      persist();
      return;
    }
    var lim = S.game.settings.antiCheat;
    U.sfx.warn();
    if (lim && S.violations >= lim) {
      showWarning('🚫 Kamu sudah keluar dari halaman game ' + S.violations + 'x. Jawabanmu dikumpulkan otomatis.', true);
      finish();
      return;
    }
    showWarning('⚠️ Kamu terdeteksi meninggalkan halaman game (' + S.violations + (lim ? '/' + lim : '') + '). ' +
      (lim ? 'Jika mencapai batas, jawaban akan dikumpulkan otomatis.' : 'Aktivitas ini tercatat dan dilihat guru.'));
  }

  function showWarning(msg) {
    var m = U.modal('<div class="center-box"><div class="big-emoji">👀</div><p>' + esc(msg) + '</p><button class="btn" data-ok>Mengerti</button></div>');
    m.el.querySelector('[data-ok]').onclick = m.close;
  }

  /* ================= MESIN PERMAINAN ================= */
  var NONSEQ = { wheel: 1, box: 1 };   // mode yang urutan soalnya dipilih siswa
  var qHooks = [];                     // pembersih (interval, animasi, keyboard) per soal
  function onQEnd(fn) { qHooks.push(fn); }
  function qEnd() { qHooks.splice(0).forEach(function (f) { try { f(); } catch (e) { /* abaikan */ } }); }
  function gmode() { return (S && S.game && MODES[S.game.mode]) ? S.game.mode : 'classic'; }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }

  function startPlay() {
    S.active = true;
    S.sending = false;
    S.done = S.done || [];
    S.fracs = S.fracs || {};
    document.removeEventListener('visibilitychange', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    proceed();
  }

  function proceed() {
    var n = S.served.length;
    if (NONSEQ[gmode()]) {
      if (S.done.length >= n) { finish(); return; }
      if (gmode() === 'wheel') showWheel(); else showBoxes();
      return;
    }
    if (S.idx >= n) { finish(); return; }
    renderQuestion();
  }

  function hudHtml() {
    var total = S.served.length, done = S.done.length;
    return '<div class="hud">' +
      '<div class="hud-q">Soal <b>' + Math.min(done + 1, total) + '</b>/' + total + '</div>' +
      '<div class="hud-progress"><i style="width:' + (done / total * 100) + '%"></i></div>' +
      '<div class="hud-xp">⭐ <b id="xp">' + S.xp + '</b></div>' +
      '<div class="hud-combo ' + (S.combo >= 2 ? 'on' : '') + '" id="combo">🔥 x' + S.combo + '</div>' + muteBtn() +
      '</div>';
  }

  var RENDER = {
    mcq: renderMcq, tf: renderTf, short: renderShort, match: renderMatch, order: renderOrder, group: renderGroup,
    word: renderAnagram, cloze: renderCloze, multi: renderMulti, wordsearch: renderWordsearch
  };
  var MODE_RENDER = {
    balloon: { mcq: renderBalloon, tf: renderBalloon }, memory: { match: renderMemory },
    whack: { multi: renderWhack }, hangman: { word: renderHangman }
  };
  var MODE_LABEL = {
    balloon: '🎈 Balon Meletus <span>· Letuskan balon jawaban yang benar</span>',
    memory: '🃏 Kartu Memori <span>· Temukan semua pasangan</span>',
    whack: '🔨 Pukul Tikus <span>· Pukul hanya yang benar!</span>',
    hangman: '🔡 Tebak Kata <span>· Petunjuk</span>'
  };

  function pickRenderer(q) {
    var m = gmode();
    var fn = (MODE_RENDER[m] && MODE_RENDER[m][q.type]) || RENDER[q.type] || renderUnknown;
    // Mode latihan butuh kunci; bila backend lama tidak mengirimnya, pakai tampilan standar.
    if ((fn === renderHangman || fn === renderMemory) && q.ans === undefined) fn = RENDER[q.type];
    return fn;
  }

  /* ================= SOAL ================= */
  function renderQuestion() {
    qEnd();
    clearInterval(timer);
    var m = gmode();
    var q = S.served[S.idx];
    var set = S.game.settings;
    var fn = pickRenderer(q);
    var type = QTYPES[q.type] || { icon: '❓', name: 'Soal', hint: '' };
    S.st = {};
    S.qStart = Date.now();
    S.timeLimit = q.time !== undefined ? Number(q.time) : Number(set.timePerQuestion) || 0;
    if (!S.timeLimit && fn === renderWhack) S.timeLimit = Math.max(20, q.items.length * 3); // pukul tikus selalu berwaktu
    S.extra = 0;
    S.locked = false;

    var label = (fn !== RENDER[q.type] && MODE_LABEL[m]) ? MODE_LABEL[m]
      : type.icon + ' ' + type.name + ' <span>· ' + type.hint + '</span>';
    if (fn === renderAnagram) label = '🔤 Susun Huruf <span>· Petunjuk</span>';

    var power = '';
    if (set.powerUps) {
      var canFifty = q.type === 'mcq' && q.ans !== undefined && q.options.length > 2 && !S.used.fifty;
      var canTime = S.timeLimit > 0 && !S.used.time;
      power = '<div class="powerups">' +
        (q.ans !== undefined && q.type === 'mcq' ? '<button class="pu" id="pu-fifty" ' + (canFifty ? '' : 'disabled') + '>✂️ 50:50</button>' : '') +
        (S.timeLimit > 0 && fn !== renderWhack ? '<button class="pu" id="pu-time" ' + (canTime ? '' : 'disabled') + '>⏳ +15 detik</button>' : '') + '</div>';
    }
    var compact = { wordsearch: 1, match: fn === renderMemory, multi: fn === renderWhack };

    root().innerHTML = themed(S.game.theme,
      '<div class="play mode-' + m + '">' + hudHtml() +
      (S.timeLimit ? '<div class="timer"><i id="tbar"></i><span id="tnum">' + S.timeLimit + '</span></div>' : '') +
      '<div class="qcard pop' + (compact[q.type] ? ' compact' : '') + '"><div class="qtype">' + label + '</div>' +
      '<h2 class="qtext">' + esc(q.q) + '</h2>' +
      (q.img ? '<img class="qimg" src="' + esc(q.img) + '" alt="Gambar soal" loading="lazy">' : '') + '</div>' +
      '<div class="answers" id="answers"></div>' + power +
      '<div class="fx" id="fx" aria-live="polite"></div>' +
      '</div>', 'playing');
    bindMute(root());

    var box = $('#answers');
    fn(q, box);

    var f = $('#pu-fifty');
    if (f) f.onclick = function () {
      if (S.locked) return;
      S.used.fifty = true; f.disabled = true; U.sfx.combo();
      var wrong = $$('[data-i]', box).filter(function (b) { return Number(b.dataset.i) !== q.ans; });
      Logic.shuffle(wrong).slice(0, Math.max(0, q.options.length - 2)).forEach(function (b) { b.classList.add('gone'); b.disabled = true; });
      persist();
    };
    var t = $('#pu-time');
    if (t) t.onclick = function () {
      if (S.locked) return;
      S.used.time = true; t.disabled = true; S.extra += 15; U.sfx.combo(); persist();
    };

    if (S.timeLimit) {
      var lastSec = -1;
      timer = setInterval(function () {
        var left = S.timeLimit + S.extra - (Date.now() - S.qStart) / 1000;
        var bar = $('#tbar'), num = $('#tnum');
        if (!bar) { clearInterval(timer); return; }
        bar.style.width = Math.max(0, left / (S.timeLimit + S.extra) * 100) + '%';
        var sec = Math.ceil(Math.max(0, left));
        num.textContent = sec;
        bar.parentNode.classList.toggle('low', left <= 5);
        if (left <= 5 && sec !== lastSec && sec > 0) { U.sfx.tick(); lastSec = sec; }
        if (left <= 0) { clearInterval(timer); timeUp(); }
      }, 100);
    }
  }

  function timeUp() {
    var q = S.served[S.idx];
    var partial = collectPartial(q);
    fx('<div class="fx-big">' + (pickRenderer(q) === renderWhack ? '⏱️ Selesai!' : '⏰ Waktu habis!') + '</div>');
    lock(partial);
  }

  // Jawaban sebagian tetap dihitung saat waktu habis.
  function collectPartial(q) {
    if (S.st && S.st.get) return S.st.get();
    if (q.type === 'match' && S.matchState) return S.matchState.slice();
    if (q.type === 'order' && S.orderState) return S.orderState.slice();
    if (q.type === 'short') { var i = $('#short'); return i && i.value.trim() ? i.value.trim() : null; }
    return null;
  }

  function renderUnknown(q, box) {
    box.innerHTML = '<div class="answer-key">Jenis soal ini belum didukung di perangkat ini. Lanjut ke soal berikutnya.</div>' +
      '<button class="btn big glow" id="skip">Lanjut ▶</button>';
    $('#skip').onclick = function () { lock(null); };
  }

  function renderMcq(q, box) {
    box.innerHTML = '<div class="opts n' + q.options.length + '">' + q.options.map(function (o, i) {
      return '<button class="opt c' + (i % 6) + '" data-i="' + i + '"><span class="shape">' + SHAPES[i % 6] + '</span><span class="ot">' + esc(o) + '</span></button>';
    }).join('') + '</div>';
    $$('.opt', box).forEach(function (b) {
      b.onclick = function () {
        if (S.locked) return;
        b.classList.add('picked');
        lock(Number(b.dataset.i));
      };
    });
  }

  function renderTf(q, box) {
    box.innerHTML = '<div class="opts tf"><button class="opt c3" data-v="true"><span class="shape">✔</span><span class="ot">BENAR</span></button>' +
      '<button class="opt c0" data-v="false"><span class="shape">✖</span><span class="ot">SALAH</span></button></div>';
    $$('.opt', box).forEach(function (b) {
      b.onclick = function () { if (S.locked) return; b.classList.add('picked'); lock(b.dataset.v === 'true'); };
    });
  }

  function renderShort(q, box) {
    box.innerHTML = '<form class="short-box" id="sf"><input id="short" autocomplete="off" placeholder="Ketik jawabanmu…" maxlength="200">' +
      '<button class="btn big glow" type="submit">Kunci ✔</button></form>';
    var input = $('#short');
    setTimeout(function () { input.focus(); }, 50);
    $('#sf').onsubmit = function (e) {
      e.preventDefault();
      if (S.locked) return;
      if (!input.value.trim()) { input.classList.add('shake'); setTimeout(function () { input.classList.remove('shake'); }, 400); return; }
      lock(input.value.trim());
    };
  }

  function renderMatch(q, box) {
    S.matchState = q.left.map(function () { return null; });
    var sel = null;
    function draw() {
      box.innerHTML = '<div class="match"><div class="mcol">' + q.left.map(function (l, i) {
        var p = S.matchState[i];
        return '<button class="mitem m-l ' + (sel === i ? 'sel' : '') + (p !== null ? ' paired' : '') + '" data-i="' + i + '" style="' +
          (p !== null ? '--pc:' + PAIR_COLORS[i % 8] : '') + '"><b>' + String.fromCharCode(65 + i) + '</b> ' + esc(l) + '</button>';
      }).join('') + '</div><div class="mcol">' + q.right.map(function (r, j) {
        var owner = S.matchState.indexOf(j);
        return '<button class="mitem m-r' + (owner >= 0 ? ' paired' : '') + '" data-j="' + j + '" style="' +
          (owner >= 0 ? '--pc:' + PAIR_COLORS[owner % 8] : '') + '">' + (owner >= 0 ? '<b>' + String.fromCharCode(65 + owner) + '</b> ' : '') + esc(r) + '</button>';
      }).join('') + '</div></div>' +
        '<p class="hint">Ketuk item kiri, lalu ketuk pasangannya di kanan.</p>' +
        '<button class="btn big glow" id="mdone" ' + (S.matchState.indexOf(null) >= 0 ? 'disabled' : '') + '>Kunci Jawaban ✔</button>';
      $$('.mitem.m-l', box).forEach(function (b) {
        b.onclick = function () {
          if (S.locked) return;
          var i = Number(b.dataset.i);
          U.sfx.click();
          if (S.matchState[i] !== null && sel !== i) { S.matchState[i] = null; sel = i; }
          else sel = sel === i ? null : i;
          draw();
        };
      });
      $$('.mitem.m-r', box).forEach(function (b) {
        b.onclick = function () {
          if (S.locked) return;
          var j = Number(b.dataset.j);
          var owner = S.matchState.indexOf(j);
          if (sel === null) {
            if (owner >= 0) { S.matchState[owner] = null; draw(); }
            return;
          }
          if (owner >= 0) S.matchState[owner] = null;
          S.matchState[sel] = j;
          U.sfx.click();
          var next = S.matchState.indexOf(null);
          sel = next >= 0 ? next : null;
          draw();
        };
      });
      $('#mdone').onclick = function () { if (!S.locked) lock(S.matchState.slice()); };
    }
    sel = 0;
    draw();
  }

  function renderOrder(q, box) {
    S.orderState = q.items.map(function (_, i) { return i; });
    var sel = null;
    function draw() {
      box.innerHTML = '<ol class="order">' + S.orderState.map(function (d, pos) {
        return '<li class="oitem ' + (sel === pos ? 'sel' : '') + '" data-p="' + pos + '"><span class="onum">' + (pos + 1) + '</span>' +
          '<span class="otext">' + esc(q.items[d]) + '</span>' +
          '<span class="oarrows"><button data-m="-1" aria-label="Naik" ' + (pos === 0 ? 'disabled' : '') + '>▲</button>' +
          '<button data-m="1" aria-label="Turun" ' + (pos === S.orderState.length - 1 ? 'disabled' : '') + '>▼</button></span></li>';
      }).join('') + '</ol><p class="hint">Gunakan ▲▼ atau ketuk dua item untuk menukar posisinya.</p>' +
        '<button class="btn big glow" id="odone">Kunci Urutan ✔</button>';
      $$('.oitem', box).forEach(function (li) {
        li.onclick = function (e) {
          if (S.locked) return;
          var pos = Number(li.dataset.p);
          var m = e.target.getAttribute('data-m');
          if (m) { swap(pos, pos + Number(m)); sel = null; draw(); return; }
          if (sel === null) sel = pos;
          else { if (sel !== pos) swap(sel, pos); sel = null; }
          U.sfx.click();
          draw();
        };
      });
      $('#odone').onclick = function () { if (!S.locked) lock(S.orderState.slice()); };
    }
    function swap(a, b) {
      if (b < 0 || b >= S.orderState.length) return;
      var t = S.orderState[a]; S.orderState[a] = S.orderState[b]; S.orderState[b] = t;
    }
    draw();
  }

  /* ---------- Kelompokkan ---------- */
  function renderGroup(q, box) {
    var st = S.st;
    st.place = q.items.map(function () { return null; });
    st.get = function () { return st.place.slice(); };
    var sel = 0;
    function next() { var i = st.place.indexOf(null); return i >= 0 ? i : null; }
    function chip(i) {
      return '<button type="button" class="sitem' + (sel === i ? ' sel' : '') + '" draggable="true" data-i="' + i + '">' + esc(q.items[i]) + '</button>';
    }
    function draw() {
      var tray = q.items.map(function (_, i) { return st.place[i] === null ? chip(i) : ''; }).join('');
      box.innerHTML = '<div class="gsort">' +
        '<div class="gtray" data-bin="tray">' + (tray || '<span class="hint">Semua item sudah ditempatkan ✔</span>') + '</div>' +
        '<div class="gbins n' + q.groups.length + '">' + q.groups.map(function (g, gi) {
          return '<div class="gbin c' + gi + (sel !== null ? ' ready' : '') + '" data-bin="' + gi + '"><div class="gbin-h">' + esc(g) + '</div><div class="gbin-b">' +
            q.items.map(function (_, i) { return st.place[i] === gi ? chip(i) : ''; }).join('') + '</div></div>';
        }).join('') + '</div></div>' +
        '<p class="hint">Ketuk item, lalu ketuk kelompok tujuannya. Bisa juga diseret.</p>' +
        '<button class="btn big glow" id="gdone" ' + (next() !== null ? 'disabled' : '') + '>Kunci Jawaban ✔</button>';
    }
    function place(i, bin) {
      st.place[i] = bin === 'tray' ? null : Number(bin);
      sel = next();
      U.sfx.click();
      draw();
    }
    box.onclick = function (e) {
      if (S.locked) return;
      if (e.target.id === 'gdone') { lock(st.get()); return; }
      var c = e.target.closest('.sitem');
      if (c) { var i = Number(c.dataset.i); sel = sel === i ? null : i; U.sfx.click(); draw(); return; }
      var bin = e.target.closest('[data-bin]');
      if (bin && sel !== null) place(sel, bin.dataset.bin);
    };
    box.ondragstart = function (e) {
      var c = e.target.closest('.sitem');
      if (c) { e.dataTransfer.setData('text/plain', c.dataset.i); sel = Number(c.dataset.i); }
    };
    box.ondragover = function (e) { if (e.target.closest('[data-bin]')) e.preventDefault(); };
    box.ondrop = function (e) {
      var bin = e.target.closest('[data-bin]');
      if (!bin || S.locked) return;
      e.preventDefault();
      place(Number(e.dataTransfer.getData('text/plain')), bin.dataset.bin);
    };
    st.reveal = function (a) {
      var wrong = [];
      $$('.sitem', box).forEach(function (c) {
        var i = Number(c.dataset.i);
        var ok = a && a[i] === q.ans[i];
        c.classList.add(ok ? 'right' : 'wrong');
        if (!ok) wrong.push('<div><b>' + esc(q.items[i]) + '</b> → ' + esc(q.groups[q.ans[i]]) + '</div>');
      });
      if (wrong.length) box.insertAdjacentHTML('beforeend', '<div class="answer-key">' + wrong.join('') + '</div>');
    };
    draw();
  }

  /* ---------- Susun Huruf ---------- */
  function renderAnagram(q, box) {
    var st = S.st;
    st.slots = [];
    st.get = function () { return st.slots.map(function (i) { return q.tiles[i]; }).join('') || null; };
    var pattern = q.pattern && q.pattern.length ? q.pattern : [q.tiles.length];
    function full() { return st.slots.length === q.tiles.length; }
    function draw() {
      var k = 0;
      var words = pattern.map(function (len) {
        var out = '';
        for (var j = 0; j < len; j++, k++) {
          var ti = st.slots[k];
          out += '<button type="button" class="slot' + (ti !== undefined ? ' filled' : '') + '" data-s="' + k + '">' + (ti !== undefined ? esc(q.tiles[ti]) : '') + '</button>';
        }
        return '<div class="aword">' + out + '</div>';
      }).join('');
      box.innerHTML = '<div class="anagram"><div class="aslots">' + words + '</div>' +
        '<div class="tiles">' + q.tiles.map(function (ch, i) {
          var used = st.slots.indexOf(i) >= 0;
          return '<button type="button" class="tile' + (used ? ' used' : '') + '" data-t="' + i + '" ' + (used ? 'disabled' : '') + '>' + esc(ch) + '</button>';
        }).join('') + '</div>' +
        '<div class="row center gap wrap"><button type="button" class="btn ghost" id="aback">⌫ Hapus</button>' +
        '<button type="button" class="btn ghost" id="areset">↺ Ulang</button>' +
        '<button type="button" class="btn big glow" id="adone" ' + (full() ? '' : 'disabled') + '>Kunci ✔</button></div></div>';
    }
    function add(i) {
      if (st.slots.indexOf(i) >= 0 || full()) return;
      st.slots.push(i);
      U.sfx.click();
      draw();
      if (full() && q.ans !== undefined && Logic.letters(st.get()) === Logic.letters(q.ans)) setTimeout(function () { lock(st.get()); }, 250);
    }
    box.onclick = function (e) {
      if (S.locked) return;
      var t = e.target.closest('.tile'), sl = e.target.closest('.slot');
      if (t) add(Number(t.dataset.t));
      else if (sl && sl.classList.contains('filled')) { st.slots.splice(Number(sl.dataset.s), 1); U.sfx.click(); draw(); }
      else if (e.target.id === 'aback') { st.slots.pop(); draw(); }
      else if (e.target.id === 'areset') { st.slots = []; draw(); }
      else if (e.target.id === 'adone' && full()) lock(st.get());
    };
    function onKey(e) {
      if (S.locked || e.ctrlKey || e.metaKey) return;
      var ch = (e.key || '').toUpperCase();
      if (e.key === 'Backspace') { st.slots.pop(); draw(); e.preventDefault(); return; }
      if (e.key === 'Enter' && full()) { lock(st.get()); return; }
      if (ch.length !== 1) return;
      for (var i = 0; i < q.tiles.length; i++) if (q.tiles[i] === ch && st.slots.indexOf(i) < 0) { add(i); return; }
    }
    document.addEventListener('keydown', onKey);
    onQEnd(function () { document.removeEventListener('keydown', onKey); });
    st.reveal = function (a) {
      var ok = Logic.letters(a) === Logic.letters(q.ans);
      $$('.slot', box).forEach(function (sl) { sl.classList.add(ok ? 'right' : 'wrong'); });
      if (!ok) box.insertAdjacentHTML('beforeend', '<div class="answer-key">Jawaban benar: <b>' + esc(q.ans) + '</b></div>');
    };
    draw();
  }

  /* ---------- Tebak Kata (hangman) ---------- */
  function renderHangman(q, box) {
    var st = S.st;
    var word = String(q.ans).toUpperCase(), target = Logic.letters(word);
    st.g = [];
    st.get = function () { return st.g.slice(); };
    var keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    '0123456789'.split('').forEach(function (d) { if (target.indexOf(d) >= 0) keys.push(d); });
    function misses() { return st.g.filter(function (c) { return target.indexOf(c) < 0; }).length; }
    function solved() { return target.split('').every(function (c) { return st.g.indexOf(c) >= 0; }); }
    function draw(popIdx) {
      var lives = Logic.HANGMAN_LIVES, miss = misses();
      var balloons = '';
      for (var i = 0; i < lives; i++) {
        balloons += '<span class="hb' + (i < lives - miss ? '' : ' gone') + (i === popIdx ? ' popnow' : '') + '">🎈</span>';
      }
      box.innerHTML = '<div class="hangman"><div class="hballoons" aria-label="Sisa nyawa">' + balloons + '<div class="hbasket">🧺</div></div>' +
        '<div class="hword">' + word.split(' ').map(function (w) {
          return '<span class="hw">' + w.split('').map(function (c) {
            var isL = Logic.letters(c) === c && c;
            var show = !isL || st.g.indexOf(c) >= 0;
            return '<span class="hl' + (show ? ' open' : '') + '">' + (show ? esc(c) : '') + '</span>';
          }).join('') + '</span>';
        }).join('') + '</div>' +
        '<div class="kb">' + keys.map(function (k) {
          var used = st.g.indexOf(k) >= 0;
          return '<button type="button" class="key' + (used ? (target.indexOf(k) >= 0 ? ' hit' : ' miss') : '') + '" data-k="' + k + '" ' + (used ? 'disabled' : '') + '>' + k + '</button>';
        }).join('') + '</div></div>';
    }
    function guess(k) {
      if (S.locked || st.g.indexOf(k) >= 0 || keys.indexOf(k) < 0) return;
      st.g.push(k);
      var hit = target.indexOf(k) >= 0;
      if (hit) U.sfx.flip(); else U.sfx.pop();
      draw(hit ? -1 : Logic.HANGMAN_LIVES - misses());
      if (solved() || misses() >= Logic.HANGMAN_LIVES) setTimeout(function () { lock(st.get()); }, 400);
    }
    box.onclick = function (e) { var b = e.target.closest('.key'); if (b) guess(b.dataset.k); };
    function onKey(e) { if (!e.ctrlKey && !e.metaKey && (e.key || '').length === 1) guess(e.key.toUpperCase()); }
    document.addEventListener('keydown', onKey);
    onQEnd(function () { document.removeEventListener('keydown', onKey); });
    st.reveal = function () {
      $$('.hl', box).forEach(function (el, i) { if (!el.classList.contains('open')) el.classList.add('missed'); });
      var chars = word.replace(/ /g, '').split('');
      $$('.hl', box).forEach(function (el, i) { if (!el.textContent) el.textContent = chars[i] || ''; });
    };
    draw(-1);
  }

  /* ---------- Lengkapi Kalimat ---------- */
  function renderCloze(q, box) {
    var st = S.st, nb = q.parts.length - 1;
    st.fill = range(nb).map(function () { return null; });
    st.cur = 0;
    st.get = function () { return st.fill.slice(); };
    function full() { return st.fill.indexOf(null) < 0; }
    function draw() {
      box.innerHTML = '<div class="cloze"><div class="cloze-text">' + q.parts.map(function (p, i) {
        var b = '';
        if (i < nb) {
          var k = st.fill[i];
          b = '<button type="button" class="blank' + (st.cur === i ? ' cur' : '') + (k !== null ? ' filled' : '') + '" data-b="' + i + '">' +
            (k !== null ? esc(q.bank[k]) : (i + 1)) + '</button>';
        }
        return esc(p) + b;
      }).join('') + '</div>' +
        '<div class="bank">' + q.bank.map(function (w, k) {
          var used = st.fill.indexOf(k) >= 0;
          return '<button type="button" class="bword' + (used ? ' used' : '') + '" data-k="' + k + '" ' + (used ? 'disabled' : '') + '>' + esc(w) + '</button>';
        }).join('') + '</div>' +
        '<p class="hint">Ketuk kata untuk mengisi kotak yang menyala. Ketuk kotak terisi untuk mengosongkannya.</p>' +
        '<button class="btn big glow" id="cdone" ' + (full() ? '' : 'disabled') + '>Kunci Jawaban ✔</button></div>';
    }
    box.onclick = function (e) {
      if (S.locked) return;
      if (e.target.id === 'cdone' && full()) { lock(st.get()); return; }
      var b = e.target.closest('.blank'), w = e.target.closest('.bword');
      if (b) {
        var i = Number(b.dataset.b);
        if (st.fill[i] !== null) st.fill[i] = null;
        st.cur = i; U.sfx.click(); draw();
      } else if (w) {
        st.fill[st.cur] = Number(w.dataset.k);
        var nxt = -1;
        for (var j = 1; j <= nb; j++) { var c = (st.cur + j) % nb; if (st.fill[c] === null) { nxt = c; break; } }
        if (nxt >= 0) st.cur = nxt;
        U.sfx.click(); draw();
      }
    };
    st.reveal = function (a) {
      $$('.blank', box).forEach(function (el, i) {
        var pick = a && a[i] !== null && a[i] !== undefined ? q.ans.bank[a[i]] : '';
        el.classList.add(Logic.norm(pick) === Logic.norm(q.ans.blanks[i]) ? 'right' : 'wrong');
      });
      box.insertAdjacentHTML('beforeend', '<div class="answer-key">' + q.parts.map(function (p, i) {
        return esc(p) + (i < nb ? '<b>' + esc(q.ans.blanks[i]) + '</b>' : '');
      }).join('') + '</div>');
    };
    draw();
  }

  /* ---------- Pilih Semua yang Benar ---------- */
  function renderMulti(q, box) {
    var st = S.st;
    st.sel = [];
    st.get = function () { return st.sel.slice(); };
    function draw() {
      box.innerHTML = '<div class="multi">' + q.items.map(function (t, i) {
        return '<button type="button" class="mopt' + (st.sel.indexOf(i) >= 0 ? ' on' : '') + '" data-i="' + i + '"><span class="tick">✔</span>' + esc(t) + '</button>';
      }).join('') + '</div><p class="hint">Bisa lebih dari satu jawaban. Pilihan yang salah mengurangi nilai.</p>' +
        '<button class="btn big glow" id="mudone" ' + (st.sel.length ? '' : 'disabled') + '>Kunci (' + st.sel.length + ' dipilih) ✔</button>';
    }
    box.onclick = function (e) {
      if (S.locked) return;
      if (e.target.id === 'mudone') { lock(st.get()); return; }
      var b = e.target.closest('.mopt');
      if (!b) return;
      var i = Number(b.dataset.i), at = st.sel.indexOf(i);
      if (at >= 0) st.sel.splice(at, 1); else st.sel.push(i);
      U.sfx.click(); draw();
    };
    st.reveal = function (a) {
      $$('.mopt', box).forEach(function (b) {
        var i = Number(b.dataset.i), picked = (a || []).indexOf(i) >= 0;
        b.classList.add(q.ans[i] ? (picked ? 'right' : 'missed') : (picked ? 'wrong' : 'dim'));
      });
    };
    draw();
  }

  /* ---------- Cari Kata ---------- */
  function wordCells(grid, w) {
    var n = grid.length, D = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
    for (var r = 0; r < n; r++) for (var c = 0; c < grid[r].length; c++) for (var d = 0; d < D.length; d++) {
      var cells = [], ok = true;
      for (var i = 0; i < w.length && ok; i++) {
        var rr = r + D[d][0] * i, cc = c + D[d][1] * i;
        if (rr < 0 || rr >= n || cc < 0 || cc >= grid[rr].length || grid[rr].charAt(cc) !== w.charAt(i)) ok = false;
        else cells.push([rr, cc]);
      }
      if (ok) return cells;
    }
    return [];
  }

  function lineCells(a, b) {
    var dr = b.r - a.r, dc = b.c - a.c;
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return [];
    var n = Math.max(Math.abs(dr), Math.abs(dc)) + 1, sr = Math.sign(dr), sc = Math.sign(dc), out = [];
    for (var i = 0; i < n; i++) out.push([a.r + sr * i, a.c + sc * i]);
    return out;
  }

  function renderWordsearch(q, box) {
    var st = S.st, grid = q.grid, words = q.words;
    st.sel = [];
    st.found = {};
    st.get = function () { return st.sel.slice(); };
    box.innerHTML = '<div class="ws"><div class="ws-grid" id="wsg" style="--n:' + grid.length + '">' + grid.map(function (row, r) {
      return row.split('').map(function (ch, c) { return '<span class="wc" data-r="' + r + '" data-c="' + c + '">' + ch + '</span>'; }).join('');
    }).join('') + '</div>' +
      '<ul class="ws-words">' + words.map(function (w, i) { return '<li data-w="' + i + '">' + esc(w) + '</li>'; }).join('') + '</ul></div>' +
      '<p class="hint">Geser dari huruf pertama ke huruf terakhir, atau ketuk keduanya. <b id="wscount">0</b>/' + words.length + ' kata ditemukan.</p>' +
      '<button class="btn big ghost" id="wsdone">Selesai ✔</button>';
    var g = $('#wsg');
    var cellEls = $$('.wc', g);
    function cellEl(r, c) { return cellEls[r * grid[0].length + c]; }
    function at(x, y) {
      var el = document.elementFromPoint(x, y);
      el = el && el.closest ? el.closest('.wc') : null;
      return el && g.contains(el) ? { r: Number(el.dataset.r), c: Number(el.dataset.c) } : null;
    }
    function preview(a, b) {
      cellEls.forEach(function (el) { el.classList.remove('pv'); });
      (b ? lineCells(a, b) : [[a.r, a.c]]).forEach(function (p) { var el = cellEl(p[0], p[1]); if (el) el.classList.add('pv'); });
    }
    function clear() { cellEls.forEach(function (el) { el.classList.remove('pv'); }); }
    function attempt(a, b) {
      var t = Logic.lineText(grid, a.r, a.c, b.r, b.c), rev = t.split('').reverse().join('');
      var wi = -1;
      words.forEach(function (w, i) { if (wi < 0 && !st.found[i] && t && (w === t || w === rev)) wi = i; });
      clear();
      if (wi < 0) { g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); U.sfx.bonk(); return; }
      st.found[wi] = 1;
      st.sel.push([a.r, a.c, b.r, b.c]);
      lineCells(a, b).forEach(function (p) { cellEl(p[0], p[1]).classList.add('found', 'f' + (wi % 6)); });
      $('.ws-words li[data-w="' + wi + '"]', box).classList.add('done');
      $('#wscount').textContent = Object.keys(st.found).length;
      U.sfx.correct();
      if (Object.keys(st.found).length === words.length) setTimeout(function () { lock(st.get()); }, 500);
    }
    var start = null, dragging = false, cur = null;
    g.addEventListener('pointerdown', function (e) {
      if (S.locked) return;
      var c = at(e.clientX, e.clientY);
      if (!c) return;
      e.preventDefault();
      if (start && !dragging) { attempt(start, c); start = null; return; }
      start = c; cur = c; dragging = true;
      preview(start);
      try { g.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
    });
    g.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var c = at(e.clientX, e.clientY);
      if (c) { cur = c; preview(start, c); }
    });
    g.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      if (cur && (cur.r !== start.r || cur.c !== start.c)) { attempt(start, cur); start = null; }
      cur = null;
    });
    $('#wsdone').onclick = function () { if (!S.locked) lock(st.get()); };
    st.reveal = function () {
      words.forEach(function (w, i) {
        if (st.found[i]) return;
        wordCells(grid, w).forEach(function (p) { cellEl(p[0], p[1]).classList.add('missed'); });
      });
    };
  }

  /* ---------- Balon Meletus ---------- */
  function renderBalloon(q, box) {
    var st = S.st;
    var opts = q.type === 'tf' ? [{ t: 'BENAR', v: true }, { t: 'SALAH', v: false }]
      : q.options.map(function (o, i) { return { t: o, v: i }; });
    box.innerHTML = '<div class="sky" id="sky">' + opts.map(function (o, k) {
      return '<button type="button" class="balloon b' + (k % 6) + (String(o.t).length > 22 || String(o.t).split(/\s+/).some(function (w) { return w.length > 9; }) ? ' long' : '') + '" data-k="' + k + '"' +
        (q.type === 'mcq' ? ' data-i="' + k + '"' : '') + '><span class="btext">' + esc(o.t) + '</span></button>';
    }).join('') + '</div>';
    var sky = $('#sky'), els = $$('.balloon', sky);
    var H = sky.clientHeight || 360, W = sky.clientWidth || 320;
    var bs = els.map(function (el, k) {
      return {
        el: el, x: (k + 0.5) / opts.length, y: H * (0.2 + 0.7 * ((k * 0.618) % 1)),
        sp: (H / (6 + Math.random() * 2.5)), ph: Math.random() * 6.28, amp: 10 + Math.random() * 12
      };
    });
    var last = performance.now(), raf = 0, alive = true;
    function frame(t) {
      if (!alive) return;
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      H = sky.clientHeight || H; W = sky.clientWidth || W;
      bs.forEach(function (b) {
        if (b.el.classList.contains('gone')) return;
        b.y -= b.sp * dt;
        if (b.y < -b.el.offsetHeight - 30) b.y = H + 10 + Math.random() * 60;
        var bw = b.el.offsetWidth;
        var x = Math.max(0, Math.min(W - bw, b.x * W - bw / 2 + Math.sin(t / 700 + b.ph) * b.amp));
        b.el.style.transform = 'translate(' + x + 'px,' + b.y + 'px) rotate(' + Math.sin(t / 900 + b.ph) * 6 + 'deg)';
      });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    onQEnd(function () { alive = false; cancelAnimationFrame(raf); });
    box.onclick = function (e) {
      var el = e.target.closest('.balloon');
      if (!el || S.locked || el.disabled) return;
      el.classList.add('popped');
      U.sfx.pop();
      lock(opts[Number(el.dataset.k)].v);
    };
    st.reveal = function (a) {
      els.forEach(function (el, k) {
        var v = opts[k].v;
        if (v === q.ans) el.classList.add('right'); else if (v === a) el.classList.add('wrong'); else el.classList.add('dim');
      });
    };
  }

  /* ---------- Kartu Memori ---------- */
  function renderMemory(q, box) {
    var st = S.st, n = q.left.length;
    st.found = q.left.map(function () { return null; });
    st.get = function () { return st.found.slice(); };
    var cards = [];
    q.left.forEach(function (t, i) { cards.push({ t: t, pair: i, side: 'L' }); });
    q.right.forEach(function (t, j) { cards.push({ t: t, pair: q.ans.indexOf(j), side: 'R', j: j }); });
    cards = Logic.shuffle(cards);
    var open = [], moves = 0, busy = false;
    box.innerHTML = '<div class="memory n' + cards.length + '">' + cards.map(function (c, k) {
      return '<button type="button" class="mcard side-' + c.side + '" data-c="' + k + '"><span class="face back">?</span>' +
        '<span class="face front">' + esc(c.t) + '</span></button>';
    }).join('') + '</div><p class="hint">Langkah: <b id="mmoves">0</b> · Pasangan: <b id="mpairs">0</b>/' + n + '</p>';
    var els = $$('.mcard', box);
    box.onclick = function (e) {
      var el = e.target.closest('.mcard');
      if (!el || S.locked || busy || el.classList.contains('flip')) return;
      var k = Number(el.dataset.c);
      el.classList.add('flip');
      U.sfx.flip();
      open.push(k);
      if (open.length < 2) return;
      moves++;
      $('#mmoves').textContent = moves;
      var a = cards[open[0]], b = cards[open[1]];
      if (a.pair === b.pair && a.side !== b.side) {
        var r = a.side === 'R' ? a : b;
        st.found[a.pair] = r.j;
        open.forEach(function (x) { els[x].classList.add('matched', 'p' + (a.pair % 8)); });
        open = [];
        var cnt = st.found.filter(function (v) { return v !== null; }).length;
        $('#mpairs').textContent = cnt;
        U.sfx.correct();
        if (cnt === n) setTimeout(function () { lock(st.get()); }, 600);
      } else {
        busy = true;
        var pairOpen = open.slice();
        open = [];
        setTimeout(function () {
          pairOpen.forEach(function (x) { els[x].classList.remove('flip'); });
          busy = false;
        }, 850);
      }
    };
    st.reveal = function () {
      els.forEach(function (el) { if (!el.classList.contains('matched')) el.classList.add('flip', 'dim'); });
    };
  }

  /* ---------- Pukul Tikus ---------- */
  function renderWhack(q, box) {
    var st = S.st;
    st.hits = [];
    st.get = function () { return st.hits.slice(); };
    var HOLES = 9;
    box.innerHTML = '<div class="whack">' + range(HOLES).map(function (h) {
      return '<div class="hole" data-h="' + h + '"><button type="button" class="mole"><span class="mface">🐹</span><span class="mlabel"></span></button><div class="dirt"></div></div>';
    }).join('') + '</div><div class="row center gap wrap"><span class="hint">Kena: <b id="whits">0</b>' +
      (q.ans !== undefined ? ' · Benar: <b id="wgood">0</b>/' + q.ans.filter(Boolean).length : '') + '</span>' +
      '<button type="button" class="btn ghost" id="wdone">Selesai ✔</button></div>';
    var holes = $$('.hole', box);
    var state = holes.map(function () { return null; }); // item yang sedang muncul
    var queue = [], timers = [], alive = true, spawnIv;
    function nextItem() {
      if (!queue.length) queue = Logic.shuffle(range(q.items.length));
      return queue.shift();
    }
    function spawn() {
      if (!alive || S.locked) return;
      var free = range(HOLES).filter(function (h) { return state[h] === null; });
      if (!free.length) return;
      var h = free[Math.floor(Math.random() * free.length)], item = nextItem();
      state[h] = item;
      var hole = holes[h];
      hole.querySelector('.mlabel').textContent = q.items[item];
      hole.classList.remove('hit', 'good', 'bad');
      hole.classList.add('up');
      timers.push(setTimeout(function () { if (state[h] === item) { hole.classList.remove('up'); state[h] = null; } }, 1500 + Math.random() * 500));
    }
    spawn();
    spawnIv = setInterval(spawn, 750);
    onQEnd(function () { alive = false; clearInterval(spawnIv); timers.forEach(clearTimeout); });
    box.onpointerdown = function (e) {
      var m = e.target.closest('.mole');
      if (!m || S.locked) return;
      var hole = m.parentNode, h = Number(hole.dataset.h), item = state[h];
      if (item === null || !hole.classList.contains('up')) return;
      e.preventDefault();
      state[h] = null;
      hole.classList.add('hit');
      if (st.hits.indexOf(item) < 0) st.hits.push(item);
      $('#whits').textContent = st.hits.length;
      if (q.ans !== undefined) {
        var ok = q.ans[item];
        hole.classList.add(ok ? 'good' : 'bad');
        if (ok) U.sfx.correct(); else U.sfx.wrong();
        var good = st.hits.filter(function (i) { return q.ans[i]; }).length;
        $('#wgood').textContent = good;
        if (good === q.ans.filter(Boolean).length) setTimeout(function () { lock(st.get()); }, 500);
      } else U.sfx.bonk();
      timers.push(setTimeout(function () { hole.classList.remove('up'); }, 350));
    };
    $('#wdone').onclick = function () { if (!S.locked) lock(st.get()); };
    st.reveal = function (a) {
      var missed = q.items.filter(function (t, i) { return q.ans[i] && (a || []).indexOf(i) < 0; });
      var wrong = q.items.filter(function (t, i) { return !q.ans[i] && (a || []).indexOf(i) >= 0; });
      box.insertAdjacentHTML('beforeend', '<div class="answer-key">' +
        (missed.length ? '<div>Terlewat: <b>' + missed.map(esc).join(', ') + '</b></div>' : '<div>Semua jawaban benar sudah kamu pukul! 🎯</div>') +
        (wrong.length ? '<div>Salah pukul: <b>' + wrong.map(esc).join(', ') + '</b></div>' : '') + '</div>');
    };
  }

  /* ---------- Roda Putar ---------- */
  function wrapHud() {
    return hudHtml();
  }

  function showWheel() {
    qEnd();
    clearInterval(timer);
    var n = S.served.length, seg = 360 / n, R = 140, C = 150;
    var left = range(n).filter(function (i) { return S.done.indexOf(i) < 0; });
    var colors = ['#f43f5e', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];
    function pt(a, r) { var rad = a * Math.PI / 180; return [C + r * Math.sin(rad), C - r * Math.cos(rad)]; }
    var paths = range(n).map(function (i) {
      var a0 = i * seg, a1 = (i + 1) * seg, p0 = pt(a0, R), p1 = pt(a1, R), mid = pt(a0 + seg / 2, R * 0.72);
      var done = S.done.indexOf(i) >= 0;
      var d = n === 1 ? 'M' + C + ' ' + (C - R) + ' A' + R + ' ' + R + ' 0 1 1 ' + (C - 0.01) + ' ' + (C - R) + 'Z'
        : 'M' + C + ' ' + C + ' L' + p0[0] + ' ' + p0[1] + ' A' + R + ' ' + R + ' 0 ' + (seg > 180 ? 1 : 0) + ' 1 ' + p1[0] + ' ' + p1[1] + 'Z';
      return '<path d="' + d + '" fill="' + (done ? '#64748b' : colors[i % colors.length]) + '" stroke="#fff" stroke-width="2"/>' +
        '<text x="' + mid[0] + '" y="' + mid[1] + '" text-anchor="middle" dominant-baseline="middle" class="wl" transform="rotate(' + (a0 + seg / 2) + ' ' + mid[0] + ' ' + mid[1] + ')">' +
        (done ? '✓' : (i + 1)) + '</text>';
    }).join('');
    S.wheelRot = S.wheelRot || 0;
    root().innerHTML = themed(S.game.theme, '<div class="play mode-wheel">' + wrapHud() +
      '<div class="wrap-title"><h2>🎡 Putar roda!</h2><p class="muted">Roda akan memilih soal berikutnya secara acak. Sisa ' + left.length + ' soal.</p></div>' +
      '<div class="wheel-wrap"><div class="wheel-pin">▼</div><svg class="wheel" id="wheel" viewBox="0 0 300 300" style="transform:rotate(' + S.wheelRot + 'deg)">' +
      '<circle cx="150" cy="150" r="146" fill="#1e1b4b"/>' + paths + '<circle cx="150" cy="150" r="22" fill="#fff" stroke="#1e1b4b" stroke-width="4"/></svg></div>' +
      '<div class="row center"><button class="btn big glow" id="spin">🎡 PUTAR!</button></div><div class="fx" id="fx"></div></div>', 'playing');
    bindMute(root());
    $('#spin').onclick = function () {
      var btn = this;
      btn.disabled = true;
      var target = left[Math.floor(Math.random() * left.length)];
      var theta = target * seg + seg / 2 + (Math.random() - 0.5) * seg * 0.5;
      var base = ((-theta - S.wheelRot) % 360 + 360) % 360;
      var rot = S.wheelRot + 360 * 5 + base;
      var w = $('#wheel');
      w.style.transition = 'transform 4s cubic-bezier(.17,.67,.12,1)';
      w.style.transform = 'rotate(' + rot + 'deg)';
      var ticks = 0, tickIv = setInterval(function () { if (ticks++ < 30) U.sfx.spin(); else clearInterval(tickIv); }, 120);
      onQEnd(function () { clearInterval(tickIv); });
      setTimeout(function () {
        if (!S || !S.active) return;
        S.wheelRot = rot % 360;
        S.idx = target;
        persist();
        U.sfx.go();
        fx('<div class="fx-big">Soal nomor ' + (target + 1) + '!</div>');
        setTimeout(function () { if (S && S.active) renderQuestion(); }, 900);
      }, 4200);
    };
  }

  /* ---------- Kotak Misteri ---------- */
  function showBoxes() {
    qEnd();
    clearInterval(timer);
    var n = S.served.length;
    root().innerHTML = themed(S.game.theme, '<div class="play mode-box">' + wrapHud() +
      '<div class="wrap-title"><h2>🎁 Pilih kotak misteri!</h2><p class="muted">Setiap kotak berisi satu tantangan. Buka semuanya!</p></div>' +
      '<div class="boxes">' + range(n).map(function (i) {
        var done = S.done.indexOf(i) >= 0, f = S.fracs[i];
        var mark = !done ? '' : f === undefined ? '🔒' : f >= 0.999 ? '✅' : f > 0 ? '🌗' : '❌';
        return '<button type="button" class="mbox c' + (i % 6) + (done ? ' opened' : '') + '" data-i="' + i + '" ' + (done ? 'disabled' : '') + '>' +
          '<span class="lid"></span><span class="bnum">' + (done ? mark : (i + 1)) + '</span></button>';
      }).join('') + '</div></div>', 'playing');
    bindMute(root());
    $$('.mbox:not(.opened)').forEach(function (b) {
      b.onclick = function () {
        $$('.mbox').forEach(function (x) { x.disabled = true; });
        b.classList.add('opening');
        U.sfx.combo();
        setTimeout(function () {
          if (!S || !S.active) return;
          S.idx = Number(b.dataset.i);
          persist();
          renderQuestion();
        }, 650);
      };
    });
  }

  function fx(html, cls) {
    var el = $('#fx');
    if (!el) return;
    el.innerHTML = html;
    el.className = 'fx show ' + (cls || '');
  }

  /* ================= MENGUNCI JAWABAN ================= */
  function lock(answer) {
    if (S.locked) return;
    S.locked = true;
    clearInterval(timer);
    qEnd();
    var q = S.served[S.idx];
    S.answers[S.idx] = answer;
    var limit = S.timeLimit + S.extra;
    var speed = limit ? Math.max(0, 1 - (Date.now() - S.qStart) / 1000 / limit) : 0.5;
    $$('.answers button, .answers input, .powerups button').forEach(function (b) { b.disabled = true; });

    var delay = 900;
    if (q.ans !== undefined) {
      var frac = Logic.gradeDisplay(q.type, q.ans, answer);
      S.fracs[S.idx] = frac;
      var full = frac >= 0.999;
      S.combo = full ? S.combo + 1 : 0;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      if (full) S.correct++;
      var gain = Math.round(frac * (100 + 50 * speed) * (1 + Math.min(S.combo, 5) * 0.1));
      S.xp += gain;
      reveal(q, answer);
      if (full) {
        U.sfx[S.combo >= 3 ? 'combo' : 'correct']();
        fx('<div class="fx-big ok">' + pick(['Mantap! 🎉', 'Benar! ✨', 'Keren! 😎', 'Jenius! 🧠', 'Tepat! 🎯']) + '</div><div class="fx-xp">+' + gain + ' XP</div>' +
          (S.combo >= 2 ? '<div class="fx-combo">🔥 COMBO x' + S.combo + '!</div>' : ''), 'good');
        delay = 1500;
      } else if (frac > 0) {
        U.sfx.lock();
        fx('<div class="fx-big mid">Hampir! 👍 ' + Math.round(frac * 100) + '% benar</div><div class="fx-xp">+' + gain + ' XP</div>', 'mid');
        delay = 2600;
      } else {
        U.sfx.wrong();
        var qc = root().querySelector('.qcard');
        if (qc) qc.classList.add('shake');
        fx('<div class="fx-big bad">' + (answer === null ? '⏰ Waktu habis!' : pick(['Belum tepat 😅', 'Ups, salah! 🙈', 'Coba lagi nanti 💪'])) + '</div>', 'bad');
        delay = 2600;
      }
    } else {
      var g2 = Math.round(50 + 50 * speed);
      S.xp += answer === null ? 0 : g2;
      U.sfx.lock();
      fx('<div class="fx-big">🔒 Jawaban terkunci</div>' + (answer === null ? '' : '<div class="fx-xp">+' + g2 + ' XP</div>'));
    }
    var xpEl = $('#xp'); if (xpEl) xpEl.textContent = S.xp;
    var cEl = $('#combo'); if (cEl) { cEl.textContent = '🔥 x' + S.combo; cEl.classList.toggle('on', S.combo >= 2); }
    if (S.done.indexOf(S.idx) < 0) S.done.push(S.idx);
    if (!NONSEQ[gmode()]) S.idx++;
    persist();
    setTimeout(function () {
      if (!S || !S.active) return;
      proceed();
    }, delay);
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function reveal(q, a) {
    var box = $('#answers');
    if (S.st && S.st.reveal) { S.st.reveal(a); return; }
    if (q.type === 'mcq') {
      $$('.opt', box).forEach(function (b) {
        var i = Number(b.dataset.i);
        if (i === q.ans) b.classList.add('right'); else if (i === a) b.classList.add('wrong'); else b.classList.add('dim');
      });
    } else if (q.type === 'tf') {
      $$('.opt', box).forEach(function (b) {
        var v = b.dataset.v === 'true';
        if (v === q.ans) b.classList.add('right'); else if (v === a) b.classList.add('wrong'); else b.classList.add('dim');
      });
    } else if (q.type === 'short') {
      var input = $('#short');
      var ok = Logic.gradeDisplay('short', q.ans, a) === 1;
      input.classList.add(ok ? 'right' : 'wrong');
      if (!ok) box.insertAdjacentHTML('beforeend', '<div class="answer-key">Jawaban benar: <b>' + esc(q.ans[0]) + '</b></div>');
    } else if (q.type === 'match') {
      $$('.mitem.m-l', box).forEach(function (b) {
        var i = Number(b.dataset.i);
        b.classList.add(a && a[i] === q.ans[i] ? 'right' : 'wrong');
      });
      box.insertAdjacentHTML('beforeend', '<div class="answer-key">' + q.left.map(function (l, i) {
        return '<div><b>' + esc(l) + '</b> → ' + esc(q.right[q.ans[i]]) + '</div>';
      }).join('') + '</div>');
    } else if (q.type === 'order') {
      $$('.oitem', box).forEach(function (li, pos) {
        li.classList.add(a && a[pos] === q.ans[pos] ? 'right' : 'wrong');
      });
      box.insertAdjacentHTML('beforeend', '<div class="answer-key">Urutan benar: ' + q.ans.map(function (d, i) {
        return (i + 1) + '. ' + esc(q.items[d]);
      }).join(' → ') + '</div>');
    }
  }

  /* ================= SELESAI ================= */
  function finish() {
    if (!S || S.sending) return;
    S.active = false;
    S.sending = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    persist();
    root().innerHTML = themed(S.game.theme, '<div class="center-box"><div class="spinner"></div><h2>Mengirim jawaban…</h2><p>Jangan tutup halaman ini.</p></div>');
    var payload = { attemptId: S.attemptId, answers: S.served.map(function (_, i) { return S.answers[i] === undefined ? null : S.answers[i]; }), violations: S.violations, xp: S.xp };
    Api.call('submit', payload).then(function (res) {
      var done = S;
      done.submitted = true;
      localStorage.removeItem(progKey(done.code));
      S = null;
      result(done, res.result);
    }).catch(function (err) {
      S.sending = false;
      root().innerHTML = themed(S.game.theme, '<div class="card glass center-box"><div class="big-emoji">📡</div><h2>Gagal mengirim</h2>' +
        '<p>' + esc(err.message) + '</p><p class="muted">Jawabanmu tetap tersimpan di perangkat ini.</p><button class="btn big" id="retry">Kirim ulang</button></div>');
      $('#retry').onclick = finish;
    });
  }

  function result(st, r) {
    var kkm = r.kkm;
    var msg = r.score >= 90 ? ['🏆', 'LUAR BIASA!', 'Kamu benar-benar menguasai materi ini!']
      : r.score >= kkm ? ['🎉', 'TUNTAS!', 'Kerja bagus, pertahankan prestasimu!']
      : r.score >= kkm - 15 ? ['💪', 'SEDIKIT LAGI!', 'Kamu hampir mencapai KKM. Pelajari lagi bagian yang salah ya!']
      : ['📚', 'TETAP SEMANGAT!', 'Setiap juara pernah gagal. Ulangi materinya dan coba lagi!'];
    var C = 2 * Math.PI * 70;
    var canRetry = r.remaining !== 0;
    root().innerHTML = themed(st.game.theme,
      '<div class="result">' +
      '<div class="card glass result-card">' +
      '<div class="medal">' + msg[0] + '</div>' +
      '<h1 class="result-title">' + msg[1] + '</h1>' +
      '<p class="muted">' + esc(st.student.name) + ' · ' + esc(st.student.cls) + '</p>' +
      '<div class="score-ring"><svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" class="ring-bg"/>' +
      '<circle cx="80" cy="80" r="70" class="ring-fg ' + (r.score >= kkm ? 'pass' : 'fail') + '" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" id="ring"/></svg>' +
      '<div class="ring-text"><b id="sc">0</b><small>/100</small></div></div>' +
      '<p>' + msg[2] + '</p>' +
      '<div class="stat-grid">' +
      '<div><span>✅</span><b>' + r.correct + '/' + r.total + '</b><small>Benar</small></div>' +
      '<div><span>⏱️</span><b>' + U.fmtTime(r.durationSec) + '</b><small>Waktu</small></div>' +
      '<div><span>⭐</span><b>' + r.xp + '</b><small>XP</small></div>' +
      '<div><span>🔥</span><b>' + (st.maxCombo || 0) + '</b><small>Combo maks</small></div>' +
      '<div><span>🔁</span><b>' + r.attempt + (r.maxAttempts ? '/' + r.maxAttempts : '') + '</b><small>Percobaan</small></div>' +
      '</div>' +
      '<div class="row center gap wrap">' +
      (r.showLeaderboard ? '<a class="btn glow" href="#/skor/' + esc(st.code) + '">🏆 Papan Skor</a>' : '') +
      (canRetry ? '<a class="btn" href="#/main/' + esc(st.code) + '">🔁 Main Lagi' + (r.remaining > 0 ? ' (sisa ' + r.remaining + ')' : '') + '</a>' : '') +
      '<a class="btn ghost" href="#/">🏠 Beranda</a></div>' +
      (!canRetry ? '<p class="muted small">Kesempatanmu untuk game ini sudah habis. Nilai sudah tercatat oleh guru. 👍</p>' : '') +
      '</div></div>');
    U.countUp($('#sc'), r.score, 1400);
    setTimeout(function () { var ring = $('#ring'); if (ring) ring.style.strokeDashoffset = C * (1 - r.score / 100); }, 50);
    if (r.score >= kkm) { U.sfx.fanfare(); U.confetti(); } else U.sfx.lock();
  }

  /* ================= PAPAN SKOR ================= */
  function board(code) {
    cleanup();
    code = String(code || '').toUpperCase();
    var state = { page: 0, q: '', cls: '', list: [], game: null, auto: true };
    var PER = 50;
    loading('sport', 'Memuat papan skor…');

    function fetchData(first) {
      return Api.call('leaderboard', { code: code, me: localStorage.getItem('gb_me_' + code) || '' }).then(function (res) {
        state.list = res.list.map(function (x, i) { x.rank = i + 1; return x; });
        state.game = res.game;
        if (first) layout(); else draw();
      }).catch(function (err) {
        if (first) errorScreen('sport', err.message);
      });
    }

    function layout() {
      var g = state.game;
      var classes = {};
      state.list.forEach(function (x) { classes[x.cls] = 1; });
      root().innerHTML = themed(g.theme,
        '<div class="board">' +
        '<header class="topbar"><a class="logo" href="#/">🎮 <b>Game</b>Belajar</a><div class="row gap">' +
        '<button class="btn small ghost" id="fs">⛶ Layar penuh</button><a class="btn small" href="#/main/' + esc(g.code) + '">▶ Main</a></div></header>' +
        '<div class="board-head"><div class="trophy">🏆</div><h1>Papan Skor</h1><p>' + esc(g.title) + ' · <b>' + esc(g.subject || '') + '</b> · KODE ' + esc(g.code) + '</p></div>' +
        '<div id="podium"></div>' +
        '<div class="card glass board-card">' +
        '<div class="board-tools"><input id="bq" placeholder="🔍 Cari nama…" aria-label="Cari nama">' +
        '<select id="bc" aria-label="Filter kelas"><option value="">Semua kelas</option>' +
        Object.keys(classes).sort().map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<label class="toggle"><input type="checkbox" id="ba" checked> Perbarui otomatis</label>' +
        '<span class="muted" id="bcount"></span></div>' +
        '<div id="blist"></div><div class="pager" id="bpager"></div></div></div>');
      $('#bq').oninput = function (e) { state.q = e.target.value.toLowerCase(); state.page = 0; draw(); };
      $('#bc').onchange = function (e) { state.cls = e.target.value; state.page = 0; draw(); };
      $('#ba').onchange = function (e) { state.auto = e.target.checked; };
      $('#fs').onclick = function () {
        if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      };
      draw();
      boardTimer = setInterval(function () { if (state.auto && !document.hidden) fetchData(false); }, 15000);
    }

    function draw() {
      var top = state.list.slice(0, 3);
      var order = [top[1], top[0], top[2]];
      $('#podium').innerHTML = top.length ? '<div class="podium">' + order.map(function (x, i) {
        if (!x) return '<div class="pod empty"></div>';
        var place = [2, 1, 3][i];
        return '<div class="pod p' + place + (x.me ? ' me' : '') + '"><div class="pod-medal">' + ['🥇', '🥈', '🥉'][place - 1] + '</div>' +
          '<div class="pod-name">' + esc(x.name) + '</div><div class="pod-cls">' + esc(x.cls) + '</div>' +
          '<div class="pod-score">' + x.score + '</div><div class="pod-bar"><span>' + place + '</span></div></div>';
      }).join('') + '</div>' : '<div class="card glass center-box"><div class="big-emoji">🕹️</div><p>Belum ada yang menyelesaikan game ini. Jadilah yang pertama!</p></div>';

      var rows = state.list.filter(function (x) {
        return (!state.cls || x.cls === state.cls) && (!state.q || x.name.toLowerCase().indexOf(state.q) >= 0);
      });
      var pages = Math.max(1, Math.ceil(rows.length / PER));
      state.page = Math.min(state.page, pages - 1);
      var slice = rows.slice(state.page * PER, state.page * PER + PER);
      $('#bcount').textContent = rows.length + ' peserta';
      $('#blist').innerHTML = '<div class="lb-row lb-head"><span>#</span><span>Nama</span><span>Kelas</span><span>Waktu</span><span>Nilai</span></div>' +
        slice.map(function (x) {
          return '<div class="lb-row' + (x.me ? ' me' : '') + (x.rank <= 3 ? ' top' : '') + '">' +
            '<span class="lb-rank">' + (x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank) + '</span>' +
            '<span class="lb-name">' + esc(x.name) + (x.me ? ' <em>(kamu)</em>' : '') + '</span>' +
            '<span>' + esc(x.cls) + '</span><span>' + U.fmtTime(x.durationSec) + '</span>' +
            '<span class="lb-score">' + x.score + '</span></div>';
        }).join('') + (rows.length ? '' : '<p class="muted center">Tidak ada yang cocok.</p>');
      var pg = '', gap = false;
      if (pages > 1) {
        pg += '<button data-p="' + (state.page - 1) + '" ' + (state.page === 0 ? 'disabled' : '') + '>‹</button>';
        for (var i = 0; i < pages; i++) {
          if (pages > 9 && Math.abs(i - state.page) > 2 && i !== 0 && i !== pages - 1) { if (!gap) pg += '<span>…</span>'; gap = true; continue; }
          gap = false;
          pg += '<button data-p="' + i + '" class="' + (i === state.page ? 'on' : '') + '">' + (i + 1) + '</button>';
        }
        pg += '<button data-p="' + (state.page + 1) + '" ' + (state.page >= pages - 1 ? 'disabled' : '') + '>›</button>';
      }
      var pager = $('#bpager');
      pager.innerHTML = pg;
      $$('button', pager).forEach(function (b) { b.onclick = function () { state.page = Number(b.dataset.p); draw(); }; });
    }

    fetchData(true);
  }

  return { home: home, lobby: lobby, board: board, cleanup: cleanup, themed: themed };
})();
