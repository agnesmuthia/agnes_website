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

  /* ---------- Login Google (Google Identity Services) ---------- */
  var gisPromise = null;
  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (!gisPromise) {
      gisPromise = new Promise(function (resolve, reject) {
        var sc = document.createElement('script');
        sc.src = 'https://accounts.google.com/gsi/client';
        sc.async = true;
        sc.onload = resolve;
        sc.onerror = function () { gisPromise = null; reject(new Error('Gagal memuat login Google. Periksa koneksi internet.')); };
        document.head.appendChild(sc);
      });
    }
    return gisPromise;
  }

  // Hanya untuk tampilan (nama & email). Keabsahan token diperiksa di server.
  function jwtPayload(token) {
    try {
      var b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch (e) { return {}; }
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
    root().innerHTML = themed('galaxy',
      '<header class="topbar"><div class="logo">🎮 <b>Game</b>Belajar</div><div class="row gap">' + muteBtn() +
      '<a class="btn small ghost" href="#/guru">👩‍🏫 Masuk Guru</a></div></header>' +
      '<section class="hero">' +
      '<div class="hero-badge">Untuk siswa SMA ✨</div>' +
      '<h1 class="hero-title">Belajar jadi <span class="shine">seru</span>,<br>nilai jadi <span class="shine alt">juara!</span></h1>' +
      '<p class="hero-sub">Masukkan kode game dari gurumu, lalu tunjukkan kemampuanmu!</p>' +
      '<form class="join-card" id="join">' +
      '<label for="code" class="sr-only">Kode game</label>' +
      '<input id="code" maxlength="6" autocomplete="off" placeholder="KODE GAME" value="' + esc(st.lastCode || '') + '" />' +
      '<button class="btn big glow" type="submit">Gabung ▶</button></form>' +
      '<div class="chips"><span>⚡ Kuis kilat</span><span>🔗 Menjodohkan</span><span>🔢 Mengurutkan</span><span>🏆 Papan skor</span><span>🔥 Combo & XP</span></div>' +
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
      var info = [
        ['📚', g.subject || 'Umum'], ['❓', g.questionCount + ' soal'],
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
        '<ul class="rules">' +
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
        }).catch(function (err) { note.textContent = '⚠️ ' + err.message; });
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

  function startPlay() {
    S.active = true;
    S.sending = false;
    if (S.idx >= S.served.length) { finish(); return; }
    document.addEventListener('visibilitychange', onVisibility);
    renderQuestion();
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

  /* ================= SOAL ================= */
  function renderQuestion() {
    clearInterval(timer);
    var q = S.served[S.idx];
    var total = S.served.length;
    var set = S.game.settings;
    var type = QTYPES[q.type];
    S.qStart = Date.now();
    S.timeLimit = set.timePerQuestion;
    S.extra = 0;
    S.locked = false;

    var power = '';
    if (set.powerUps) {
      var canFifty = q.type === 'mcq' && q.ans !== undefined && q.options.length > 2 && !S.used.fifty;
      var canTime = set.timePerQuestion > 0 && !S.used.time;
      power = '<div class="powerups">' +
        (q.ans !== undefined && q.type === 'mcq' ? '<button class="pu" id="pu-fifty" ' + (canFifty ? '' : 'disabled') + '>✂️ 50:50</button>' : '') +
        (set.timePerQuestion > 0 ? '<button class="pu" id="pu-time" ' + (canTime ? '' : 'disabled') + '>⏳ +15 detik</button>' : '') + '</div>';
    }

    root().innerHTML = themed(S.game.theme,
      '<div class="play">' +
      '<div class="hud">' +
      '<div class="hud-q">Soal <b>' + (S.idx + 1) + '</b>/' + total + '</div>' +
      '<div class="hud-progress"><i style="width:' + (S.idx / total * 100) + '%"></i></div>' +
      '<div class="hud-xp">⭐ <b id="xp">' + S.xp + '</b></div>' +
      '<div class="hud-combo ' + (S.combo >= 2 ? 'on' : '') + '" id="combo">🔥 x' + S.combo + '</div>' + muteBtn() +
      '</div>' +
      (set.timePerQuestion ? '<div class="timer"><i id="tbar"></i><span id="tnum">' + set.timePerQuestion + '</span></div>' : '') +
      '<div class="qcard pop"><div class="qtype">' + type.icon + ' ' + type.name + ' <span>· ' + type.hint + '</span></div>' +
      '<h2 class="qtext">' + esc(q.q) + '</h2>' +
      (q.img ? '<img class="qimg" src="' + esc(q.img) + '" alt="Gambar soal" loading="lazy">' : '') + '</div>' +
      '<div class="answers" id="answers"></div>' + power +
      '<div class="fx" id="fx" aria-live="polite"></div>' +
      '</div>', 'playing');
    bindMute(root());

    var box = $('#answers');
    ({ mcq: renderMcq, tf: renderTf, short: renderShort, match: renderMatch, order: renderOrder })[q.type](q, box);

    var f = $('#pu-fifty');
    if (f) f.onclick = function () {
      if (S.locked) return;
      S.used.fifty = true; f.disabled = true; U.sfx.combo();
      var wrong = $$('.opt', box).filter(function (b) { return Number(b.dataset.i) !== q.ans; });
      Logic.shuffle(wrong).slice(0, Math.max(0, q.options.length - 2)).forEach(function (b) { b.classList.add('gone'); b.disabled = true; });
      persist();
    };
    var t = $('#pu-time');
    if (t) t.onclick = function () {
      if (S.locked) return;
      S.used.time = true; t.disabled = true; S.extra += 15; U.sfx.combo(); persist();
    };

    if (set.timePerQuestion) {
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
    fx('<div class="fx-big">⏰ Waktu habis!</div>');
    lock(partial);
  }

  // Jawaban sebagian (menjodohkan/mengurutkan) tetap dihitung saat waktu habis.
  function collectPartial(q) {
    if (q.type === 'match' && S.matchState) return S.matchState.slice();
    if (q.type === 'order' && S.orderState) return S.orderState.slice();
    if (q.type === 'short') { var i = $('#short'); return i && i.value.trim() ? i.value.trim() : null; }
    return null;
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
    var q = S.served[S.idx];
    S.answers[S.idx] = answer;
    var limit = S.timeLimit + S.extra;
    var speed = limit ? Math.max(0, 1 - (Date.now() - S.qStart) / 1000 / limit) : 0.5;
    $$('.answers button, .answers input, .powerups button').forEach(function (b) { b.disabled = true; });

    var delay = 900;
    if (q.ans !== undefined) {
      var frac = Logic.gradeDisplay(q.type, q.ans, answer);
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
        root().querySelector('.qcard').classList.add('shake');
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
    S.idx++;
    persist();
    setTimeout(function () {
      if (!S || !S.active) return;
      if (S.idx >= S.served.length) finish(); else renderQuestion();
    }, delay);
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function reveal(q, a) {
    var box = $('#answers');
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
