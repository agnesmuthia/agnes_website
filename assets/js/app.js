/* app.js — Router berbasis hash.
 *   #/              beranda siswa (masukkan kode)
 *   #/main/KODE     lobi + login + bermain
 *   #/skor/KODE     papan skor
 *   #/guru/...      dasbor guru
 */
(function () {
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    window.scrollTo(0, 0);
    if (parts[0] === 'main' && parts[1]) return Student.lobby(parts[1]);
    if (parts[0] === 'skor' && parts[1]) return Student.board(parts[1]);
    if (parts[0] === 'guru') return Teacher.route(parts.slice(1).join('/'));
    Student.home();
  }
  window.addEventListener('hashchange', route);
  route();
})();
