/*
 * api.js — Penghubung ke "server".
 * - Jika URL Google Apps Script diisi → data disimpan di Google Sheets (Drive guru),
 *   siswa bisa bermain dari perangkat masing-masing.
 * - Jika kosong → Mode Lokal: data hanya tersimpan di browser ini (untuk mencoba).
 */
var LocalDB = (function () {
  var GK = 'gb_games', RK = 'gb_results', PK = 'gb_pin';
  function read(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error('Penyimpanan browser penuh atau diblokir.'); }
  }
  return {
    mode: 'local',
    teacherKey: function () { return localStorage.getItem(PK) || ''; },
    getGame: function (code) { return read(GK, {})[code] || null; },
    listGames: function () { var g = read(GK, {}); return Object.keys(g).map(function (k) { return g[k]; }); },
    saveGame: function (game) { var g = read(GK, {}); g[game.code] = game; write(GK, g); },
    deleteGame: function (code) { var g = read(GK, {}); delete g[code]; write(GK, g); },
    results: function (f) {
      return read(RK, []).filter(function (r) { return (!f.code || r.code === f.code) && (!f.key || r.key === f.key); });
    },
    getResult: function (id) { return read(RK, []).filter(function (r) { return r.id === id; })[0] || null; },
    appendResult: function (r) { var a = read(RK, []); a.push(r); write(RK, a); },
    updateResult: function (r) { write(RK, read(RK, []).map(function (x) { return x.id === r.id ? r : x; })); },
    deleteResults: function (f) {
      var a = read(RK, []);
      var keep = a.filter(function (r) { return !(r.code === f.code && (!f.key || r.key === f.key)); });
      write(RK, keep);
      return a.length - keep.length;
    },
    hasPin: function () { return !!localStorage.getItem(PK); },
    setPin: function (p) { localStorage.setItem(PK, p); },
    backup: function () { return { games: read(GK, {}), results: read(RK, []) }; },
    restore: function (d) {
      if (!d || typeof d.games !== 'object' || !Array.isArray(d.results)) throw new Error('File cadangan tidak valid.');
      write(GK, d.games); write(RK, d.results);
    }
  };
})();

var Api = (function () {
  var params = new URLSearchParams(location.search);
  var linkUrl = params.get('api');

  function url() {
    return linkUrl || localStorage.getItem('gb_api') || '';
  }

  function setUrl(u) {
    linkUrl = null;
    if (u) localStorage.setItem('gb_api', u.trim()); else localStorage.removeItem('gb_api');
  }

  function auth() { return sessionStorage.getItem('gb_auth') || ''; }
  function setAuth(a) {
    if (a) sessionStorage.setItem('gb_auth', a);
    else { sessionStorage.removeItem('gb_auth'); sessionStorage.removeItem('gb_bver'); sessionStorage.removeItem('gb_glogin'); }
  }

  function call(action, payload, endpoint) {
    var req = Object.assign({ action: action, auth: auth() }, payload || {});
    var u = endpoint !== undefined ? endpoint : url();
    if (!u) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try { resolve(JSON.parse(JSON.stringify(Core.handle(LocalDB, JSON.parse(JSON.stringify(req)))))); }
          catch (e) { reject(e); }
        }, 120);
      });
    }
    // text/plain agar tidak memicu preflight CORS di Google Apps Script.
    return fetch(u, { method: 'POST', body: JSON.stringify(req), headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
      .catch(function () { throw new Error('Tidak dapat terhubung ke server. Periksa internet, lalu pastikan URL /exec benar dan deployment Apps Script diatur "Yang memiliki akses: Siapa saja (Anyone)".'); })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Terjadi kesalahan di server.');
        return res;
      });
  }

  function shareLink(code, board) {
    var base = location.origin + location.pathname;
    var q = url() ? '?api=' + encodeURIComponent(url()) : '';
    return base + q + '#/' + (board ? 'skor' : 'main') + '/' + code;
  }

  // Versi backend (Code.gs) yang dibutuhkan aplikasi ini. Sama dengan Core.VERSION.
  var REQUIRED_BACKEND = 3;
  function backendVersion() { return Number(sessionStorage.getItem('gb_bver')) || 0; }
  function setBackendInfo(r) {
    sessionStorage.setItem('gb_bver', String(r.version || 1));
    sessionStorage.setItem('gb_glogin', r.googleLogin ? '1' : '');
  }
  function backendOutdated() { var v = backendVersion(); return !!url() && v > 0 && v < REQUIRED_BACKEND; }

  return {
    call: call, url: url, setUrl: setUrl, auth: auth, setAuth: setAuth, shareLink: shareLink, isLocal: function () { return !url(); },
    REQUIRED_BACKEND: REQUIRED_BACKEND, backendVersion: backendVersion, setBackendInfo: setBackendInfo, backendOutdated: backendOutdated,
    googleLoginReady: function () { return sessionStorage.getItem('gb_glogin') === '1'; }
  };
})();
