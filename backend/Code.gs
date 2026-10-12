/* Code.gs — Backend Game Belajar untuk Google Apps Script.
 * FILE INI DIBUAT OTOMATIS oleh tools/build-backend.sh. Ubah file sumbernya:
 *   assets/js/logic.js, assets/js/core.js, backend/server.gs
 */

/* ================== BAGIAN SERVER GOOGLE SHEETS ==================
 * Kata sandi guru TIDAK ditulis di kode ini. Simpan di:
 *   Project Settings (ikon roda gigi) > Script Properties > Add script property
 *   Property: TEACHER_KEY      Value: kata sandi pilihan Anda
 * Pengaturan lain (Client ID Google, folder Drive, simpan otomatis) diatur
 * dari menu Pengaturan di aplikasi dan juga tersimpan di Script Properties.
 */
var DEFAULT_ROOT = 'GameBelajar';
var AUTO_SAVE_HANDLER = 'simpanOtomatisMalam';
var AUTO_SAVE_HOUR = 21;

var GAME_HEADERS = ['code', 'title', 'subject', 'updatedAt', 'json'];
var RESULT_HEADERS = ['id', 'code', 'key', 'name', 'cls', 'sid', 'attempt', 'status', 'score', 'correct', 'total',
  'durationSec', 'violations', 'xp', 'startedAt', 'finishedAt', 'servedKey', 'answers', 'detail', 'email', 'flags'];
var DRIVE_HEADERS = ['key', 'code', 'cls', 'fileId', 'url', 'name', 'path', 'updatedAt'];
var JSON_FIELDS = ['servedKey', 'answers', 'detail'];
var WRITE_ACTIONS = ['start', 'submit', 'saveGame', 'deleteGame', 'resetAttempts'];

function doGet() {
  return json_({ ok: true, app: 'Game Belajar', version: Core.VERSION, message: 'Backend aktif. Tempelkan URL ini di menu Pengaturan aplikasi.' });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Permintaan tidak valid.' });
  }
  var lock = null;
  try {
    if (WRITE_ACTIONS.indexOf(req.action) >= 0) {
      lock = LockService.getScriptLock();
      lock.waitLock(25000);
    }
    var res = Core.handle(SheetsDB, req);
    res.ok = true;
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    if (lock) try { lock.releaseLock(); } catch (e2) {}
  }
}

// Dijalankan otomatis setiap malam oleh pemicu (trigger) waktu.
function simpanOtomatisMalam() {
  var res = SheetsDB.autoSave();
  console.log(JSON.stringify(res));
}

// Opsional: jalankan sekali dari editor (pilih fungsi ini lalu klik Run) untuk
// memeriksa pengaturan dan memberi izin akses Google Drive/layanan eksternal.
function cekPengaturan() {
  var key = SheetsDB.teacherKey();
  console.log(key ? 'TEACHER_KEY sudah diatur (' + key.length + ' karakter).' : 'PERINGATAN: TEACHER_KEY belum diatur di Script Properties.');
  console.log('Versi backend: ' + Core.VERSION);
  console.log('Zona waktu skrip: ' + Session.getScriptTimeZone());
  console.log('Folder Drive utama: ' + pathOf_(root_(true)));
  UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=x', { muteHttpExceptions: true });
  console.log('Simpan otomatis: ' + (triggerActive_() ? 'aktif' : 'tidak aktif'));
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@'); // simpan semua sebagai teks
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < headers.length) {
    // Lembar dari versi lama: tambahkan kolom baru di kanan tanpa mengubah data yang ada.
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }
  return sh;
}

function cell_(v) {
  return v instanceof Date ? v.toISOString() : v;
}

function rowsOf_(sh, width) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, width).getValues();
}

function toResult_(arr) {
  var o = {};
  RESULT_HEADERS.forEach(function (h, i) {
    var v = cell_(arr[i]);
    if (JSON_FIELDS.indexOf(h) >= 0) {
      try { v = v ? JSON.parse(v) : (h === 'detail' ? {} : []); } catch (e) { v = h === 'detail' ? {} : []; }
    }
    o[h] = v === undefined ? '' : v;
  });
  return o;
}

function fromResult_(o) {
  return RESULT_HEADERS.map(function (h) {
    var v = o[h];
    if (JSON_FIELDS.indexOf(h) >= 0) return JSON.stringify(v || (h === 'detail' ? {} : []));
    return v === undefined || v === null ? '' : String(v);
  });
}

/* ---------- Pengaturan & folder Drive ---------- */
function props_() { return PropertiesService.getScriptProperties(); }

function setProp_(key, val) {
  if (val === '' || val === null || val === undefined) props_().deleteProperty(key);
  else props_().setProperty(key, String(val));
}

function cleanName_(s) {
  return String(s || '').replace(/[\\/:*?"<>|#]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Tanpa Nama';
}

function child_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function root_(create) {
  var id = props_().getProperty('DRIVE_ROOT_ID');
  if (id) {
    try {
      var f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (e) { /* folder dihapus atau tidak bisa diakses: pakai bawaan */ }
  }
  var it = DriveApp.getRootFolder().getFoldersByName(DEFAULT_ROOT);
  var f2 = it.hasNext() ? it.next() : (create ? DriveApp.getRootFolder().createFolder(DEFAULT_ROOT) : null);
  if (f2) props_().setProperty('DRIVE_ROOT_ID', f2.getId());
  return f2;
}

function schoolYear_() {
  var y = props_().getProperty('SCHOOL_YEAR');
  if (y) return y;
  var d = new Date(), yr = d.getFullYear();
  return d.getMonth() >= 6 ? yr + '-' + (yr + 1) : (yr - 1) + '-' + yr; // tahun ajaran mulai Juli
}

// Struktur otomatis: Folder utama / Tahun ajaran / Mapel / Kelas
function autoFolder_(subject, cls) {
  var f = child_(child_(root_(true), schoolYear_()), cleanName_(subject || 'Umum'));
  return cls ? child_(f, cleanName_(cls)) : f;
}

function crumbs_(folder) {
  var rootId = DriveApp.getRootFolder().getId();
  var list = [];
  var cur = folder;
  for (var i = 0; i < 12 && cur; i++) {
    var isRoot = cur.getId() === rootId;
    list.unshift({ id: cur.getId(), name: isRoot ? 'Drive Saya' : cur.getName() });
    if (isRoot) break;
    var ps = cur.getParents();
    cur = ps.hasNext() ? ps.next() : null;
  }
  return list;
}

function pathOf_(folder) {
  return folder ? crumbs_(folder).map(function (c) { return c.name; }).join(' / ') : '';
}

function triggerActive_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === AUTO_SAVE_HANDLER; });
}

function syncTrigger_(on) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === AUTO_SAVE_HANDLER) ScriptApp.deleteTrigger(t);
  });
  if (on) ScriptApp.newTrigger(AUTO_SAVE_HANDLER).timeBased().everyDays(1).atHour(AUTO_SAVE_HOUR).create();
}

/* ---------- Isi file rekap ---------- */
function buildRecap_(ss, g, rows) {
  var s = g.settings || {};
  var kkm = Number(s.kkm) || 75;
  var list = Logic.rank(Logic.counted(rows, s.scorePolicy));

  // Kosongkan file (dipakai juga saat memperbarui file lama).
  var tmp = ss.insertSheet('_tmp_' + Date.now());
  ss.getSheets().forEach(function (sh) { if (sh.getSheetId() !== tmp.getSheetId()) ss.deleteSheet(sh); });

  var rekap = ss.insertSheet('Rekap Nilai');
  var head = ['Peringkat', 'Nama', 'Kelas', 'NIS/Absen', 'Nilai', 'Keterangan', 'Benar', 'Jumlah Soal', 'Durasi (detik)',
    'Percobaan', 'Pelanggaran', 'Email', 'Catatan'];
  var data = list.map(function (x, i) {
    return [i + 1, x.name, x.cls, x.sid, x.score, !x.finished ? 'Tidak selesai' : (x.score >= kkm ? 'Tuntas' : 'Remedial'),
      x.correct, x.total, x.durationSec, x.attempts, x.violations, x.email || '', x.flags || ''];
  });
  rekap.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
  if (data.length) rekap.getRange(2, 1, data.length, head.length).setValues(data);
  rekap.setFrozenRows(1);
  rekap.autoResizeColumns(1, head.length);

  if (data.length) {
    rekap.insertChart(rekap.newChart().setChartType(Charts.ChartType.COLUMN)
      .addRange(rekap.getRange(1, 2, data.length + 1, 1)).addRange(rekap.getRange(1, 5, data.length + 1, 1))
      .setOption('title', 'Nilai per Siswa (KKM ' + kkm + ')').setOption('legend', { position: 'none' })
      .setPosition(2, head.length + 2, 0, 0).build());

    var dist = ss.insertSheet('Distribusi');
    var bins = [['Rentang Nilai', 'Jumlah Siswa']];
    for (var b = 0; b < 10; b++) {
      var lo = b * 10, hi = b === 9 ? 100 : lo + 9;
      bins.push([lo + '-' + hi, list.filter(function (x) { return x.finished && x.score >= lo && x.score <= hi; }).length]);
    }
    dist.getRange(1, 1, bins.length, 2).setValues(bins);
    dist.getRange(1, 1, 1, 2).setFontWeight('bold');
    dist.insertChart(dist.newChart().setChartType(Charts.ChartType.COLUMN).addRange(dist.getRange(1, 1, bins.length, 2))
      .setOption('title', 'Sebaran Nilai').setPosition(2, 4, 0, 0).build());
  }

  var items = ss.insertSheet('Analisis Soal');
  var iHead = [['No', 'Pertanyaan', 'Jenis', 'Dijawab', '% Benar', 'Tingkat Kesukaran']];
  var done = rows.filter(function (r) { return r.status === 'done'; });
  var iData = (g.questions || []).map(function (q, i) {
    var vals = done.map(function (r) { return r.detail ? r.detail[q.id] : undefined; }).filter(function (v) { return v !== undefined; });
    var p = vals.length ? vals.reduce(function (a, b2) { return a + Number(b2); }, 0) / vals.length : 0;
    return [i + 1, q.q, q.type, vals.length, Math.round(p * 100), !vals.length ? '-' : p < 0.3 ? 'Sukar' : p <= 0.7 ? 'Sedang' : 'Mudah'];
  });
  items.getRange(1, 1, 1, 6).setValues(iHead).setFontWeight('bold');
  if (iData.length) items.getRange(2, 1, iData.length, 6).setValues(iData);

  var all = ss.insertSheet('Semua Percobaan');
  var aHead = [['Nama', 'Kelas', 'NIS/Absen', 'Email', 'Percobaan ke', 'Status', 'Nilai', 'Mulai', 'Selesai', 'Durasi (detik)', 'Pelanggaran', 'Catatan']];
  var aData = rows.map(function (r) {
    return [r.name, r.cls, r.sid, r.email || '', r.attempt, r.status === 'done' ? 'Selesai' : 'Tidak selesai',
      r.status === 'done' ? Number(r.score) : '', r.startedAt, r.finishedAt, r.durationSec, r.violations, r.flags || ''];
  });
  all.getRange(1, 1, 1, aHead[0].length).setValues(aHead).setFontWeight('bold');
  if (aData.length) all.getRange(2, 1, aData.length, aHead[0].length).setValues(aData);

  ss.deleteSheet(tmp);
  ss.setActiveSheet(rekap);
}

var SheetsDB = {
  mode: 'sheets',
  teacherKey: function () {
    return props_().getProperty('TEACHER_KEY') || '';
  },

  games_: function () { return sheet_('Games', GAME_HEADERS); },
  results_: function () { return sheet_('Results', RESULT_HEADERS); },
  driveLog_: function () { return sheet_('DriveFiles', DRIVE_HEADERS); },

  getGame: function (code) {
    var rows = rowsOf_(this.games_(), GAME_HEADERS.length);
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === code) return JSON.parse(rows[i][4]);
    return null;
  },
  listGames: function () {
    return rowsOf_(this.games_(), GAME_HEADERS.length).map(function (r) { return JSON.parse(r[4]); });
  },
  saveGame: function (g) {
    var sh = this.games_();
    var vals = [[g.code, g.title, g.subject || '', g.updatedAt, JSON.stringify(g)]];
    var rows = rowsOf_(sh, GAME_HEADERS.length);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === g.code) { sh.getRange(i + 2, 1, 1, GAME_HEADERS.length).setValues(vals); return; }
    }
    sh.getRange(sh.getLastRow() + 1, 1, 1, GAME_HEADERS.length).setNumberFormat('@').setValues(vals);
  },
  deleteGame: function (code) {
    var sh = this.games_();
    var rows = rowsOf_(sh, GAME_HEADERS.length);
    for (var i = rows.length - 1; i >= 0; i--) if (String(rows[i][0]) === code) sh.deleteRow(i + 2);
  },

  results: function (f) {
    return rowsOf_(this.results_(), RESULT_HEADERS.length).map(toResult_).filter(function (r) {
      return (!f.code || r.code === f.code) && (!f.key || r.key === f.key);
    });
  },
  getResult: function (id) {
    var rows = rowsOf_(this.results_(), RESULT_HEADERS.length);
    for (var i = rows.length - 1; i >= 0; i--) if (String(rows[i][0]) === id) return toResult_(rows[i]);
    return null;
  },
  appendResult: function (o) {
    var sh = this.results_();
    sh.getRange(sh.getLastRow() + 1, 1, 1, RESULT_HEADERS.length).setNumberFormat('@').setValues([fromResult_(o)]);
  },
  updateResult: function (o) {
    var sh = this.results_();
    var rows = rowsOf_(sh, 1);
    for (var i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][0]) === o.id) { sh.getRange(i + 2, 1, 1, RESULT_HEADERS.length).setValues([fromResult_(o)]); return; }
    }
  },
  deleteResults: function (f) {
    var sh = this.results_();
    var rows = rowsOf_(sh, RESULT_HEADERS.length);
    var keep = rows.filter(function (r) {
      return !(String(r[1]) === f.code && (!f.key || String(r[2]) === f.key));
    });
    var removed = rows.length - keep.length;
    if (!removed) return 0;
    if (rows.length) sh.getRange(2, 1, rows.length, RESULT_HEADERS.length).clearContent();
    if (keep.length) sh.getRange(2, 1, keep.length, RESULT_HEADERS.length).setValues(keep.map(function (r) { return r.map(cell_); }));
    return removed;
  },

  /* ---------- Pengaturan ---------- */
  getConfig: function () {
    var p = props_().getProperties();
    return {
      googleClientId: p.GOOGLE_CLIENT_ID || '', driveRootId: p.DRIVE_ROOT_ID || '', schoolYear: p.SCHOOL_YEAR || '',
      autoSave: p.AUTO_SAVE === '1', autoSaveMode: p.AUTO_SAVE_MODE || 'perClass', lastAutoSave: p.LAST_AUTOSAVE || ''
    };
  },
  setConfig: function (c) {
    if ('googleClientId' in c) setProp_('GOOGLE_CLIENT_ID', c.googleClientId);
    if ('schoolYear' in c) setProp_('SCHOOL_YEAR', c.schoolYear);
    if ('autoSaveMode' in c) setProp_('AUTO_SAVE_MODE', c.autoSaveMode);
    if ('driveRootId' in c) {
      if (c.driveRootId) {
        var f;
        try { f = DriveApp.getFolderById(c.driveRootId); } catch (e) { throw new Error('Folder tidak ditemukan atau tidak bisa diakses.'); }
        if (f.isTrashed()) throw new Error('Folder itu ada di Sampah.');
      }
      setProp_('DRIVE_ROOT_ID', c.driveRootId);
    }
    if ('autoSave' in c) {
      syncTrigger_(c.autoSave);
      setProp_('AUTO_SAVE', c.autoSave ? '1' : '0');
    }
  },
  driveInfo: function () {
    var root = root_(false);
    return {
      root: root ? { id: root.getId(), name: root.getName(), url: root.getUrl(), path: pathOf_(root) } : { name: DEFAULT_ROOT, pending: true },
      schoolYear: schoolYear_(), triggerActive: triggerActive_(), autoSaveHour: AUTO_SAVE_HOUR,
      timeZone: Session.getScriptTimeZone()
    };
  },

  /* ---------- Login Google siswa ---------- */
  verifyGoogleToken: function (token) {
    var cid = props_().getProperty('GOOGLE_CLIENT_ID');
    if (!cid) throw new Error('Login Google belum diatur oleh guru (Client ID kosong).');
    if (!token) throw new Error('Silakan masuk dengan akun Google terlebih dahulu.');
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Sesi login Google tidak valid atau kedaluwarsa. Silakan masuk ulang.');
    var j = JSON.parse(res.getContentText());
    if (j.aud !== cid) throw new Error('Login Google ini bukan untuk aplikasi ini.');
    if (['accounts.google.com', 'https://accounts.google.com'].indexOf(j.iss) < 0) throw new Error('Penerbit login tidak dikenal.');
    if (String(j.email_verified) !== 'true') throw new Error('Email Google belum terverifikasi.');
    if (Number(j.exp) * 1000 < Date.now()) throw new Error('Sesi login Google kedaluwarsa. Silakan masuk ulang.');
    return { email: String(j.email || '').toLowerCase(), name: String(j.name || '') };
  },

  /* ---------- Folder Drive ---------- */
  driveFolders: function (parentId, fromMyDrive) {
    var folder;
    try {
      folder = parentId ? DriveApp.getFolderById(parentId) : (fromMyDrive ? DriveApp.getRootFolder() : root_(true));
    } catch (e) {
      throw new Error('Folder tidak ditemukan atau tidak bisa diakses.');
    }
    var children = [];
    var it = folder.getFolders();
    while (it.hasNext() && children.length < 300) {
      var f = it.next();
      if (!f.isTrashed()) children.push({ id: f.getId(), name: f.getName() });
    }
    children.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { folder: { id: folder.getId(), name: folder.getName(), url: folder.getUrl() }, crumbs: crumbs_(folder), children: children };
  },
  driveCreateFolder: function (parentId, name) {
    var parent;
    try { parent = parentId ? DriveApp.getFolderById(parentId) : root_(true); } catch (e) { throw new Error('Folder induk tidak ditemukan.'); }
    var f = child_(parent, cleanName_(name));
    return { id: f.getId(), name: f.getName(), url: f.getUrl() };
  },
  driveHistory: function (code) {
    return rowsOf_(this.driveLog_(), DRIVE_HEADERS.length).filter(function (r) { return !code || String(r[1]) === code; })
      .map(function (r) {
        return { code: r[1], cls: r[2], url: r[4], name: r[5], path: r[6], updatedAt: cell_(r[7]) };
      }).sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  },

  // Membuat atau MEMPERBARUI file rekap di Google Drive (satu file per kelas atau gabungan).
  exportDrive: function (g, rows, opts) {
    opts = opts || {};
    var mode = opts.mode === 'combined' ? 'combined' : 'perClass';
    var target = null;
    if (opts.folderId) {
      try { target = DriveApp.getFolderById(opts.folderId); } catch (e) { throw new Error('Folder tujuan tidak ditemukan.'); }
    }
    var groups = {};
    rows.forEach(function (r) {
      var k = mode === 'perClass' ? (r.cls || 'TANPA KELAS') : '';
      (groups[k] = groups[k] || []).push(r);
    });
    var log = this.driveLog_();
    var self = this;
    return Object.keys(groups).sort().map(function (cls) {
      var folder = target || autoFolder_(g.subject, cls);
      var name = 'Rekap ' + cleanName_(g.title) + ' - ' + (cls || 'Semua Kelas') + ' (' + g.code + ')';
      return self.upsertFile_(log, g, groups[cls], folder, name, g.code + '|' + (cls || '*'), cls);
    });
  },
  upsertFile_: function (log, g, rows, folder, name, key, cls) {
    var data = rowsOf_(log, DRIVE_HEADERS.length);
    var idx = -1;
    for (var i = 0; i < data.length; i++) if (String(data[i][0]) === key) idx = i;
    var file = null;
    if (idx >= 0) {
      try {
        file = DriveApp.getFileById(String(data[idx][3]));
        if (file.isTrashed()) file = null;
      } catch (e) { file = null; }
    }
    var updated = !!file;
    var ss;
    if (file) {
      ss = SpreadsheetApp.openById(file.getId());
      ss.rename(name);
      var inFolder = false;
      var ps = file.getParents();
      while (ps.hasNext()) if (ps.next().getId() === folder.getId()) inFolder = true;
      if (!inFolder) file.moveTo(folder);
    } else {
      ss = SpreadsheetApp.create(name);
      file = DriveApp.getFileById(ss.getId());
      file.moveTo(folder);
    }
    buildRecap_(ss, g, rows);
    var path = pathOf_(folder);
    var rec = [key, g.code, cls || '', file.getId(), ss.getUrl(), name, path, new Date().toISOString()];
    if (idx >= 0) log.getRange(idx + 2, 1, 1, DRIVE_HEADERS.length).setValues([rec]);
    else log.getRange(log.getLastRow() + 1, 1, 1, DRIVE_HEADERS.length).setNumberFormat('@').setValues([rec]);
    return { cls: cls || '', name: name, url: ss.getUrl(), path: path, updated: updated };
  },

  // Simpan otomatis: hanya game yang punya aktivitas baru sejak penyimpanan terakhir.
  autoSave: function () {
    var p = props_();
    var last = p.getProperty('LAST_AUTOSAVE') || '';
    var mode = p.getProperty('AUTO_SAVE_MODE') || 'perClass';
    var startedAt = new Date().toISOString();
    var all = this.results({});
    var changed = {};
    all.forEach(function (r) {
      var t = String(r.finishedAt || r.startedAt || '');
      if (!last || t > last) changed[r.code] = 1;
    });
    var saved = [], errors = [], self = this;
    Object.keys(changed).forEach(function (code) {
      var g = self.getGame(code);
      if (!g) return;
      try {
        var files = self.exportDrive(g, all.filter(function (r) { return r.code === code; }), { mode: mode });
        saved.push({ code: code, title: g.title, files: files.length });
      } catch (e) {
        errors.push(g.title + ': ' + (e && e.message || e));
      }
    });
    p.setProperty('LAST_AUTOSAVE', startedAt);
    return { saved: saved, errors: errors, at: startedAt };
  }
};

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
    shuffle: shuffle, norm: norm, studentKey: studentKey, answerKey: answerKey,
    gradeDisplay: gradeDisplay, buildAttempt: buildAttempt, grade: grade, counted: counted, rank: rank
  };
})();

/*
 * core.js — "Server" aplikasi. Semua aturan (akses, batas percobaan, penilaian,
 * papan skor) ada di sini. Dipakai oleh Mode Lokal di browser dan disalin ke
 * backend/Code.gs untuk Google Sheets, dengan objek `db` yang berbeda.
 */
var Core = (function () {
  var VERSION = 2; // naikkan setiap kali backend (Code.gs) berubah
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
      theme: g.theme || 'galaxy', questionCount: questionTotal(g),
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

  function domainOk(email, domain) {
    domain = String(domain || '').trim().toLowerCase().replace(/^@/, '');
    if (!domain) return true;
    var host = email.split('@')[1] || '';
    return host === domain || host.slice(-(domain.length + 1)) === '.' + domain;
  }

  // Penanda (bukan penolakan) agar jawaban siswa tidak hilang, tetapi guru tahu.
  function lateFlags(r, s) {
    var flags = [];
    var fin = Date.parse(r.finishedAt);
    if (s.closeAt && fin > Date.parse(s.closeAt) + 120000) flags.push('Dikirim setelah game ditutup');
    var tpq = Number(s.timePerQuestion) || 0;
    if (tpq > 0) {
      var limit = Number(r.total) * (tpq + 4) + (s.powerUps ? 15 : 0) + 120;
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
    var isTeacher = !!tkey && !!req.auth && sameKey(req.auth, tkey);
    if (TEACHER_ACTIONS.indexOf(action) >= 0 && !isTeacher) fail('Kata sandi guru salah.');

    switch (action) {
      case 'ping':
        return { mode: db.mode, teacher: isTeacher, configured: !!tkey, version: VERSION, googleLogin: !!config(db).googleClientId };

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
          r.flags = lateFlags(r, g2.settings || {});
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
        return { config: config(db), drive: db.driveInfo ? db.driveInfo() : null };

      case 'saveConfig': {
        if (!db.setConfig) fail(NO_DRIVE);
        db.setConfig(cleanConfig(req.config));
        return { config: config(db), drive: db.driveInfo ? db.driveInfo() : null };
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
