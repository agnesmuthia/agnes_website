#!/usr/bin/env sh
# Menggabungkan logika bersama + server Google Sheets menjadi satu file
# backend/Code.gs yang tinggal disalin-tempel ke Google Apps Script.
set -e
cd "$(dirname "$0")/.."
{
  echo "/* Code.gs — Backend Game Belajar untuk Google Apps Script."
  echo " * FILE INI DIBUAT OTOMATIS oleh tools/build-backend.sh. Ubah file sumbernya:"
  echo " *   assets/js/logic.js, assets/js/core.js, backend/server.gs"
  echo " */"
  echo
  cat backend/server.gs
  echo
  cat assets/js/logic.js
  echo
  cat assets/js/core.js
} > backend/Code.gs
echo "backend/Code.gs diperbarui."
