/* charts.js — Diagram SVG ringan (batang, garis, donat, batang horizontal). */
var Charts = (function () {
  var esc = U.esc;
  var PALETTE = ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#22c55e', '#8b5cf6', '#ef4444', '#14b8a6'];

  function empty(msg) { return '<div class="chart-empty">' + esc(msg || 'Belum ada data') + '</div>'; }

  function gridY(x0, x1, y, h, max, steps) {
    if (max < steps && max === Math.round(max)) steps = Math.max(1, max);
    var s = '';
    for (var i = 0; i <= steps; i++) {
      var v = max / steps * i, yy = y + h - h * i / steps;
      s += '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + yy + '" y2="' + yy + '" class="c-grid"/>' +
        '<text x="' + (x0 - 6) + '" y="' + (yy + 4) + '" class="c-axis" text-anchor="end">' + Math.round(v) + '</text>';
    }
    return s;
  }

  function refLine(x0, x1, y, h, max, ref) {
    if (!ref) return '';
    var yy = y + h - h * ref.value / max;
    return '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + yy + '" y2="' + yy + '" class="c-ref"/>' +
      '<text x="' + x1 + '" y="' + (yy - 5) + '" class="c-ref-t" text-anchor="end">' + esc(ref.label) + '</text>';
  }

  // opts: labels, values, max, colors(fn|array), ref {value,label}, suffix, titles
  function bar(opts) {
    var n = opts.values.length;
    if (!n) return empty();
    var W = Math.max(520, n * 34), H = 260, L = 40, R = 12, T = 18, B = 46;
    var max = opts.max || Math.max.apply(null, opts.values.concat([1]));
    var w = (W - L - R) / n, h = H - T - B;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + esc(opts.aria || 'Diagram batang') + '">';
    s += gridY(L, W - R, T, h, max, 5);
    opts.values.forEach(function (v, i) {
      var bh = h * Math.max(0, v) / max, x = L + i * w + w * 0.15, y = T + h - bh;
      var col = typeof opts.colors === 'function' ? opts.colors(v, i) : (opts.colors || PALETTE)[i % (opts.colors || PALETTE).length];
      s += '<g class="c-bar"><title>' + esc((opts.titles ? opts.titles[i] : opts.labels[i]) + ': ' + v + (opts.suffix || '')) + '</title>' +
        '<rect x="' + x + '" y="' + y + '" width="' + (w * 0.7) + '" height="' + bh + '" rx="4" fill="' + col + '"/>' +
        (n <= 30 ? '<text x="' + (x + w * 0.35) + '" y="' + (y - 4) + '" class="c-val" text-anchor="middle">' + v + '</text>' : '') +
        '<text x="' + (x + w * 0.35) + '" y="' + (H - B + 16) + '" class="c-axis" text-anchor="middle">' + esc(String(opts.labels[i]).slice(0, 10)) + '</text></g>';
    });
    s += refLine(L, W - R, T, h, max, opts.ref);
    return s + '</svg>';
  }

  // opts: labels, series [{name, color, values}], max, ref
  function line(opts) {
    var n = opts.labels.length;
    if (!n) return empty();
    var W = Math.max(520, n * 70), H = 260, L = 40, R = 20, T = 18, B = 46;
    var max = opts.max || 100, h = H - T - B;
    var step = n > 1 ? (W - L - R) / (n - 1) : 0;
    var px = function (i) { return n > 1 ? L + i * step : (L + W - R) / 2; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Diagram garis">';
    s += gridY(L, W - R, T, h, max, 5);
    s += refLine(L, W - R, T, h, max, opts.ref);
    opts.labels.forEach(function (lb, i) {
      s += '<text x="' + px(i) + '" y="' + (H - B + 16) + '" class="c-axis" text-anchor="middle">' + esc(String(lb).slice(0, 14)) + '</text>';
    });
    opts.series.forEach(function (se, k) {
      var col = se.color || PALETTE[k % PALETTE.length];
      var pts = se.values.map(function (v, i) { return v == null ? null : [px(i), T + h - h * v / max, v, i]; }).filter(Boolean);
      if (pts.length > 1) s += '<polyline fill="none" stroke="' + col + '" stroke-width="3" stroke-linejoin="round" points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '"/>';
      pts.forEach(function (p) {
        s += '<g><title>' + esc(se.name + ' — ' + opts.labels[p[3]] + ': ' + p[2]) + '</title><circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="' + col + '" stroke="#fff" stroke-width="2"/></g>';
      });
    });
    return s + '</svg>';
  }

  // parts: [{label, value, color}]
  function donut(parts, center, sub) {
    var total = parts.reduce(function (a, p) { return a + p.value; }, 0);
    if (!total) return empty();
    var R = 70, C = 2 * Math.PI * R, off = 0;
    var s = '<div class="donut"><svg viewBox="0 0 200 200" class="chart donut-svg" role="img" aria-label="Diagram donat">';
    parts.forEach(function (p) {
      var len = C * p.value / total;
      s += '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="' + p.color + '" stroke-width="26" stroke-dasharray="' + len + ' ' + (C - len) +
        '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 100 100)"><title>' + esc(p.label + ': ' + p.value) + '</title></circle>';
      off += len;
    });
    s += '<text x="100" y="98" text-anchor="middle" class="donut-c">' + esc(center) + '</text>' +
      '<text x="100" y="120" text-anchor="middle" class="donut-s">' + esc(sub || '') + '</text></svg><ul class="legend">';
    parts.forEach(function (p) {
      s += '<li><i style="background:' + p.color + '"></i>' + esc(p.label) + ' <b>' + p.value + '</b> <span>(' + Math.round(p.value / total * 100) + '%)</span></li>';
    });
    return s + '</ul></div>';
  }

  // Batang horizontal: rows [{label, value, sub}]
  function hbar(rows, max, colorFn) {
    if (!rows.length) return empty();
    max = max || 100;
    return '<div class="hbars">' + rows.map(function (r) {
      var col = colorFn ? colorFn(r.value) : PALETTE[0];
      return '<div class="hbar"><span class="hb-l" title="' + esc(r.label) + '">' + esc(r.label) + '</span>' +
        '<span class="hb-track"><span class="hb-fill" style="width:' + Math.max(1, r.value / max * 100) + '%;background:' + col + '"></span></span>' +
        '<b class="hb-v">' + r.value + (r.sub ? ' <small>' + esc(r.sub) + '</small>' : '') + '</b></div>';
    }).join('') + '</div>';
  }

  return { bar: bar, line: line, donut: donut, hbar: hbar, PALETTE: PALETTE };
})();
