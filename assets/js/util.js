/* util.js — Fungsi bantu: DOM, notifikasi, efek suara, konfeti, unduhan. */
var U = (function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function toast(msg, type) {
    var box = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 3200);
    setTimeout(function () { el.remove(); }, 3700);
  }

  function modal(html, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
      '<button class="modal-x" aria-label="Tutup">✕</button>' + html + '</div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      var all = document.querySelectorAll('.modal-wrap');
      if (all[all.length - 1] === wrap) close();
    }
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('.modal-x')) close(); });
    document.addEventListener('keydown', onKey);
    return { el: wrap.firstChild, close: close };
  }

  function confirmBox(msg, okLabel) {
    return new Promise(function (resolve) {
      var m = modal('<h3>Konfirmasi</h3><p>' + esc(msg) + '</p><div class="row end gap">' +
        '<button class="btn ghost" data-a="no">Batal</button><button class="btn danger" data-a="yes">' + esc(okLabel || 'Ya, lanjutkan') + '</button></div>',
        { onClose: function () { resolve(false); } });
      m.el.addEventListener('click', function (e) {
        var a = e.target.getAttribute('data-a');
        if (a === 'yes') { resolve(true); m.close(); }
        if (a === 'no') m.close();
      });
    });
  }

  function copy(text) {
    var done = function () { toast('Disalin ke papan klip ✓', 'ok'); };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done);
    var t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Gagal menyalin, salin secara manual.', 'err'); }
    t.remove();
  }

  function download(name, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function csv(rows) {
    return '\ufeff' + rows.map(function (r) {
      return r.map(function (v) {
        v = v == null ? '' : String(v);
        return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
  }

  // Tabel HTML yang bisa dibuka langsung di Microsoft Excel (.xls).
  function excel(title, rows) {
    var body = rows.map(function (r, i) {
      var tag = i === 0 ? 'th' : 'td';
      return '<tr>' + r.map(function (v) { return '<' + tag + '>' + esc(v) + '</' + tag + '>'; }).join('') + '</tr>';
    }).join('');
    return '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">' +
      '<style>th{background:#4f46e5;color:#fff}td,th{border:1px solid #ccc;mso-number-format:"\\@"}</style></head><body>' +
      '<h3>' + esc(title) + '</h3><table>' + body + '</table></body></html>';
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtDate(iso, withTime) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d)) return '-';
    var o = { day: 'numeric', month: 'short', year: 'numeric' };
    if (withTime !== false) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString('id-ID', o);
  }

  // Ubah ISO → nilai input datetime-local (waktu setempat).
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function readFile(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = rej;
      r.readAsText(file);
    });
  }

  /* ---------- Efek suara (Web Audio, tanpa file) ---------- */
  var ctx = null;
  var muted = localStorage.getItem('gb_mute') === '1';
  function tone(freq, dur, type, when, vol) {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      var t = ctx.currentTime + (when || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio tidak tersedia */ }
  }
  var sfx = {
    correct: function () { [523, 659, 784].forEach(function (f, i) { tone(f, 0.18, 'triangle', i * 0.08); }); },
    wrong: function () { tone(180, 0.35, 'sawtooth', 0, 0.08); tone(140, 0.4, 'sawtooth', 0.12, 0.08); },
    tick: function () { tone(880, 0.05, 'square', 0, 0.04); },
    click: function () { tone(600, 0.06, 'triangle', 0, 0.06); },
    combo: function () { [659, 784, 988, 1319].forEach(function (f, i) { tone(f, 0.15, 'square', i * 0.06, 0.06); }); },
    lock: function () { tone(440, 0.1, 'triangle'); tone(660, 0.12, 'triangle', 0.08); },
    go: function () { tone(392, 0.15, 'square', 0, 0.07); tone(784, 0.3, 'square', 0.15, 0.07); },
    count: function () { tone(523, 0.12, 'square', 0, 0.07); },
    fanfare: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'triangle', i * 0.12, 0.1); }); },
    warn: function () { tone(300, 0.2, 'square', 0, 0.08); tone(300, 0.2, 'square', 0.25, 0.08); },
    pop: function () { tone(900, 0.05, 'square', 0, 0.09); tone(300, 0.12, 'triangle', 0.03, 0.08); },
    bonk: function () { tone(220, 0.08, 'square', 0, 0.1); tone(160, 0.1, 'triangle', 0.05, 0.08); },
    flip: function () { tone(700, 0.04, 'triangle', 0, 0.05); },
    spin: function () { tone(1200, 0.02, 'square', 0, 0.03); }
  };
  function toggleMute() { muted = !muted; localStorage.setItem('gb_mute', muted ? '1' : '0'); return muted; }
  function isMuted() { return muted; }

  /* ---------- Konfeti ---------- */
  function confetti(duration) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = document.createElement('canvas');
    c.className = 'confetti';
    document.body.appendChild(c);
    var x = c.getContext('2d');
    var W = c.width = innerWidth, H = c.height = innerHeight;
    var colors = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#06b6d4', '#facc15'];
    var parts = [];
    for (var i = 0; i < 180; i++) {
      parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.6, w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
        vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: -0.2 + Math.random() * 0.4,
        c: colors[i % colors.length] });
    }
    var end = Date.now() + (duration || 3500);
    (function frame() {
      x.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.03;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
      });
      if (Date.now() < end) requestAnimationFrame(frame); else c.remove();
    })();
  }

  function countUp(el, to, ms) {
    var start = performance.now();
    (function step(t) {
      var p = Math.min(1, (t - start) / (ms || 1200));
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

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
  return {
    esc: esc, $: $, $$: $$, toast: toast, modal: modal, confirm: confirmBox, copy: copy, download: download, csv: csv,
    excel: excel, fmtTime: fmtTime, fmtDate: fmtDate, toLocalInput: toLocalInput, uid: uid, readFile: readFile,
    sfx: sfx, toggleMute: toggleMute, isMuted: isMuted, confetti: confetti, countUp: countUp,
    loadGis: loadGis, jwtPayload: jwtPayload
  };
})();
