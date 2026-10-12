/* ================== BAGIAN SERVER GOOGLE SHEETS ==================
 * Ganti kata sandi guru di bawah ini sebelum melakukan Deploy!
 */
var TEACHER_KEY = 'ganti-kata-sandi-ini';
var DRIVE_FOLDER = 'Rekap Game Belajar';

var GAME_HEADERS = ['code', 'title', 'subject', 'updatedAt', 'json'];
var RESULT_HEADERS = ['id', 'code', 'key', 'name', 'cls', 'sid', 'attempt', 'status', 'score', 'correct', 'total',
  'durationSec', 'violations', 'xp', 'startedAt', 'finishedAt', 'servedKey', 'answers', 'detail'];
var JSON_FIELDS = ['servedKey', 'answers', 'detail'];
var WRITE_ACTIONS = ['start', 'submit', 'saveGame', 'deleteGame', 'resetAttempts'];

function doGet() {
  return json_({ ok: true, app: 'Game Belajar', message: 'Backend aktif. Tempelkan URL ini di menu Pengaturan aplikasi.' });
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
    o[h] = v;
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

var SheetsDB = {
  mode: 'sheets',
  teacherKey: function () { return TEACHER_KEY; },

  games_: function () { return sheet_('Games', GAME_HEADERS); },
  results_: function () { return sheet_('Results', RESULT_HEADERS); },

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

  // Membuat file rekap baru di folder Google Drive guru, lengkap dengan diagram.
  exportDrive: function (g, rows) {
    var s = g.settings || {};
    var kkm = Number(s.kkm) || 75;
    var list = Logic.rank(Logic.counted(rows, s.scorePolicy));
    var tz = Session.getScriptTimeZone();
    var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH.mm');
    var ss = SpreadsheetApp.create('Rekap ' + g.title + ' (' + g.code + ') ' + stamp);

    var rekap = ss.getSheets()[0].setName('Rekap Nilai');
    var head = ['Peringkat', 'Nama', 'Kelas', 'NIS/Absen', 'Nilai', 'Keterangan', 'Benar', 'Jumlah Soal', 'Durasi (detik)', 'Percobaan', 'Pelanggaran'];
    var data = list.map(function (x, i) {
      return [i + 1, x.name, x.cls, x.sid, x.score, !x.finished ? 'Tidak selesai' : (x.score >= kkm ? 'Tuntas' : 'Remedial'),
        x.correct, x.total, x.durationSec, x.attempts, x.violations];
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
      var p = vals.length ? vals.reduce(function (a, b) { return a + Number(b); }, 0) / vals.length : 0;
      return [i + 1, q.q, q.type, vals.length, Math.round(p * 100), !vals.length ? '-' : p < 0.3 ? 'Sukar' : p <= 0.7 ? 'Sedang' : 'Mudah'];
    });
    items.getRange(1, 1, 1, 6).setValues(iHead).setFontWeight('bold');
    if (iData.length) items.getRange(2, 1, iData.length, 6).setValues(iData);

    var all = ss.insertSheet('Semua Percobaan');
    var aHead = [['Nama', 'Kelas', 'NIS/Absen', 'Percobaan ke', 'Status', 'Nilai', 'Mulai', 'Selesai', 'Durasi (detik)', 'Pelanggaran']];
    var aData = rows.map(function (r) {
      return [r.name, r.cls, r.sid, r.attempt, r.status === 'done' ? 'Selesai' : 'Tidak selesai', r.status === 'done' ? Number(r.score) : '',
        r.startedAt, r.finishedAt, r.durationSec, r.violations];
    });
    all.getRange(1, 1, 1, aHead[0].length).setValues(aHead).setFontWeight('bold');
    if (aData.length) all.getRange(2, 1, aData.length, aHead[0].length).setValues(aData);

    var folders = DriveApp.getFoldersByName(DRIVE_FOLDER);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    return ss.getUrl();
  }
};
