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
